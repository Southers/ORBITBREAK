/**
 * Shared ranked flight simulation.
 *
 * Live play, prediction and replay validation must settle flights through this
 * module so scoring, relays and Warden pursuit cannot drift apart.
 */

import { isWorldheartUnlocked } from './campaign.js?v=20260819-ob139';
import {
  applyBreakerBurn,
  calculateBodyPositionAtTime,
  calculateDistanceSquared,
  createOrbitTrapState,
  createVector,
  findCollidingBody,
  findCollidingWorld,
  simulatePhysicsStep,
  advanceOrbitTrap,
} from './physics.js?v=20260819-ob139';
import {
  addCircuitBonus,
  addVictoryBonus,
  bankFlightScore,
  rollbackFlightScore,
  sampleSlingshotBodies,
} from './scoring.js?v=20260819-ob139';
import { settleRunFlight } from './run.js?v=20260819-ob139';
import {
  connectRelayWorlds,
  countLiveRelayWorlds,
  isRelayWorldLive,
  listProtectedRelayWorlds,
  listVulnerableRelayWorlds,
  suppressRelayWorld,
} from './network.js?v=20260819-ob139';
import {
  WardenPursuitEvents,
  chooseWardenTarget,
  resetWardenAfterSuppression,
  resolveWardenPursuit,
  shouldRevealWarden,
  shouldWardenCatchRunner,
} from './warden.js?v=20260819-ob139';
import {
  hasTravelledFurther,
  isInnerClusterLive,
  shouldOpenCommandWorldRoute,
} from './sector.js?v=20260819-ob139';
import {
  DefaultLiberationValue,
  hasClearedLaunchOrigin,
  RelayPortBullseyeBonus,
  RelayPortBullseyeFraction,
  RelayPortCleanBonus,
  RunnerRadius,
  StardustCollectionRadiusSquared,
  SurfaceRestLift,
} from './sim-constants.js?v=20260819-ob139';

/** Snaps an impact onto a body's orbital-plane circumference. */
export function calculateSurfaceRestPosition(BodyDefinition, ImpactPosition, BodyPosition) {
  const DifferenceX = ImpactPosition.x - BodyPosition.x;
  const DifferenceY = ImpactPosition.y - BodyPosition.y;
  const SurfacePadding = BodyDefinition.kind === 'worldheart'
    ? 0.12
    : RunnerRadius + SurfaceRestLift;
  if ((DifferenceX * DifferenceX) + (DifferenceY * DifferenceY) < 0.0001) {
    const SurfaceDistance = BodyDefinition.radius + SurfacePadding;
    return createVector(BodyPosition.x + SurfaceDistance, BodyPosition.y, 0);
  }
  const Distance = Math.hypot(DifferenceX, DifferenceY);
  const SurfaceDistance = BodyDefinition.radius + SurfacePadding;
  return createVector(
    BodyPosition.x + ((DifferenceX / Distance) * SurfaceDistance),
    BodyPosition.y + ((DifferenceY / Distance) * SurfaceDistance),
    0,
  );
}

/**
 * Grades a landing against a world's authored relay-port arc.
 *
 * Worlds without an authored port keep land-anywhere liberation. Inside the
 * arc, the inner third grades BULLSEYE for a larger deterministic bonus.
 * Shared by live play, prediction feedback and replay validation.
 */
export function evaluateRelayPortLanding(WorldDefinition, RestPosition, WorldPosition) {
  const Port = WorldDefinition.relayPort;
  if (!Port) {
    return {
      hasPort: false,
      insidePort: true,
      precisionTier: null,
      precisionBonus: 0,
      angularErrorRadians: 0,
    };
  }
  const LandingAngle = Math.atan2(
    RestPosition.y - WorldPosition.y,
    RestPosition.x - WorldPosition.x,
  );
  const RawDelta = LandingAngle - Port.angleRadians;
  const AngularError = Math.abs(Math.atan2(Math.sin(RawDelta), Math.cos(RawDelta)));
  if (AngularError > Port.halfWidthRadians) {
    return {
      hasPort: true,
      insidePort: false,
      precisionTier: null,
      precisionBonus: 0,
      angularErrorRadians: AngularError,
    };
  }
  const IsBullseye = AngularError <= Port.halfWidthRadians * RelayPortBullseyeFraction;
  return {
    hasPort: true,
    insidePort: true,
    precisionTier: IsBullseye ? 'bullseye' : 'clean',
    precisionBonus: IsBullseye ? RelayPortBullseyeBonus : RelayPortCleanBonus,
    angularErrorRadians: AngularError,
  };
}

/** Places the Runner on the starting world's opening-guide bearing. */
export function createStartingPosition(Runtime) {
  const StartingWorld = Runtime.worlds.find(
    (World) => World.id === Runtime.startingWorldIdentifier,
  );
  const OpeningTarget = Runtime.worlds.find(
    (World) => World.id === Runtime.openingGuideTargetIdentifier,
  );
  return calculateSurfaceRestPosition(
    StartingWorld,
    OpeningTarget.position,
    StartingWorld.position,
  );
}

/** Filters tactical bodies the current run is allowed to collide with. */
export function getActiveTacticalBodies(Runtime, SeedstoneUsesRemaining, IsWorldheartOpen) {
  return Runtime.tacticalBodies.filter((Body) => (
    Body.kind === 'hazard'
    || (Body.kind === 'seedstone' && SeedstoneUsesRemaining > 0)
    || (Body.kind === 'worldheart' && IsWorldheartOpen)
  ));
}

/** Collects any uncollected stardust the Runner currently overlaps. */
export function collectFlightStardust(StardustDefinitions, Position, FlightCollectedIdentifiers) {
  for (const Stardust of StardustDefinitions) {
    if (
      !Stardust.collected
      && calculateDistanceSquared(Position, Stardust.position)
        <= StardustCollectionRadiusSquared
    ) {
      Stardust.collected = true;
      FlightCollectedIdentifiers.add(Stardust.id);
    }
  }
}

/** Restores pickups touched during a failed flight. */
export function rollbackFlightStardust(StardustDefinitions, FlightCollectedIdentifiers) {
  for (const Stardust of StardustDefinitions) {
    if (FlightCollectedIdentifiers.has(Stardust.id)) {
      Stardust.collected = false;
    }
  }
}

/** Drops the launch-ignore once the Runner has cleared the origin body. */
export function clearLaunchIgnoreIfReady(
  IgnoredIdentifier,
  BodyDefinition,
  BodyPosition,
  RunnerPosition,
  elapsedSteps = 0,
) {
  if (!IgnoredIdentifier) {
    return null;
  }
  if (!BodyDefinition || !BodyPosition) {
    return null;
  }
  if (hasClearedLaunchOrigin({
    originRadius: BodyDefinition.radius,
    originX: BodyPosition.x,
    originY: BodyPosition.y,
    originZ: BodyPosition.z,
    runnerX: RunnerPosition.x,
    runnerY: RunnerPosition.y,
    runnerZ: RunnerPosition.z,
    seedRadius: RunnerRadius,
    elapsedSteps,
  })) {
    return null;
  }
  return IgnoredIdentifier;
}

function listLiveWorldIdentifiers(NetworkState) {
  return [...NetworkState.activeWorldIdentifiers].filter(
    (WorldIdentifier) => isRelayWorldLive(NetworkState, WorldIdentifier),
  );
}

/**
 * Advances one ranked physics step: integrate, collect, clear launch ignore,
 * sample slingshots and report collisions. Burn is applied by the caller first.
 */
export function advanceSimulatedFlightStep({
  physicsState,
  worlds,
  tacticalBodies,
  stardust,
  scoreState,
  fixedStepSeconds,
  simulationTimeSeconds,
  ignoredWorldIdentifier = null,
  ignoredBodyIdentifier = null,
  ignoredBodyDefinition = null,
  flightOriginWorldIdentifier = null,
  flightElapsedSteps = 0,
  flightCollectedStardust,
  outOfBoundsDistance,
  orbitTrapState = null,
}) {
  const NextPhysicsState = simulatePhysicsStep(physicsState, worlds, fixedStepSeconds);
  collectFlightStardust(stardust, NextPhysicsState.position, flightCollectedStardust);

  const OriginWorld = ignoredWorldIdentifier
    ? worlds.find((World) => World.id === ignoredWorldIdentifier)
    : null;
  const NextIgnoredWorldIdentifier = clearLaunchIgnoreIfReady(
    ignoredWorldIdentifier,
    OriginWorld,
    OriginWorld?.position ?? null,
    NextPhysicsState.position,
    flightElapsedSteps,
  );
  const IgnoredBodyPosition = ignoredBodyDefinition
    ? calculateBodyPositionAtTime(ignoredBodyDefinition, simulationTimeSeconds)
    : null;
  const NextIgnoredBodyIdentifier = clearLaunchIgnoreIfReady(
    ignoredBodyIdentifier,
    ignoredBodyDefinition,
    IgnoredBodyPosition,
    NextPhysicsState.position,
    flightElapsedSteps,
  );

  const SlingshotEvents = sampleSlingshotBodies(
    scoreState,
    NextPhysicsState.position,
    worlds,
    {
      runnerRadius: RunnerRadius,
      ignoredBodyIdentifier: flightOriginWorldIdentifier,
    },
  );
  const CollisionWorld = findCollidingWorld(
    NextPhysicsState.position,
    RunnerRadius,
    worlds,
    NextIgnoredWorldIdentifier,
  );
  const CollisionBody = findCollidingBody(
    NextPhysicsState.position,
    RunnerRadius,
    tacticalBodies,
    simulationTimeSeconds,
    NextIgnoredBodyIdentifier,
  );
  const OutOfBounds = (
    (NextPhysicsState.position.x ** 2) + (NextPhysicsState.position.y ** 2)
    > (outOfBoundsDistance ** 2)
  );
  const TrapState = orbitTrapState ?? createOrbitTrapState();
  const OrbitTrapped = advanceOrbitTrap(
    TrapState,
    NextPhysicsState.position,
    worlds,
    NextIgnoredWorldIdentifier,
    {
      extraBodies: tacticalBodies,
      elapsedTimeSeconds: simulationTimeSeconds,
      ignoredBodyIdentifier: NextIgnoredBodyIdentifier,
    },
  );

  return {
    physicsState: NextPhysicsState,
    ignoredWorldIdentifier: NextIgnoredWorldIdentifier,
    ignoredBodyIdentifier: NextIgnoredBodyIdentifier,
    slingshotEvents: SlingshotEvents,
    collisionWorld: CollisionWorld,
    collisionBody: CollisionBody,
    outOfBounds: OutOfBounds,
    orbitTrapped: OrbitTrapped,
  };
}

/** Applies a recorded or live Breaker Burn to the current physics state. */
export function applyFlightBreakerBurn(PhysicsState, BurnDirection = null) {
  return applyBreakerBurn(
    PhysicsState,
    undefined,
    BurnDirection
      && Number.isFinite(BurnDirection.x)
      && Number.isFinite(BurnDirection.y)
      ? { x: BurnDirection.x, y: BurnDirection.y }
      : null,
  );
}

/** Miss / hazard settlement: bank is rolled back and the Runner returns to last safe. */
export function settleFailedFlight({
  runState,
  scoreState,
  stardust,
  flightCollectedStardust,
  lastSafeNodeIdentifier,
  lastSafePosition,
}) {
  rollbackFlightScore(scoreState);
  rollbackFlightStardust(stardust, flightCollectedStardust);
  return {
    runState: settleRunFlight(runState),
    nodeIdentifier: lastSafeNodeIdentifier,
    position: createVector(lastSafePosition.x, lastSafePosition.y, lastSafePosition.z),
  };
}

/**
 * Lands on a restorable world, banks the shot and maybe closes a relay circuit.
 *
 * A landing always docks safely and links the relay, but a world with an
 * authored relay-port arc only liberates (or re-liberates after suppression)
 * when the Runner rests inside the arc; the Warden still advances either way.
 */
export function settleWorldLanding({
  runtime,
  networkState,
  scoreState,
  runState,
  world,
  impactPosition,
  flightOriginWorldIdentifier,
}) {
  const WasRestored = world.restored;
  const WasSuppressed = networkState.suppressedWorldIdentifiers.has(world.id);
  const RelayConnection = flightOriginWorldIdentifier
    && flightOriginWorldIdentifier !== world.id
    ? connectRelayWorlds(
      networkState,
      flightOriginWorldIdentifier,
      world.id,
    )
    : null;
  const Position = calculateSurfaceRestPosition(world, impactPosition, world.position);
  const PortLanding = evaluateRelayPortLanding(world, Position, world.position);
  const Liberated = !WasRestored && PortLanding.insidePort;
  if (Liberated) {
    world.restored = true;
  }
  bankFlightScore(scoreState, {
    landingBonus: !Liberated || WasSuppressed
      ? 0
      : (world.liberationValue ?? DefaultLiberationValue) + PortLanding.precisionBonus,
  });
  if (RelayConnection?.circuitClosed) {
    addCircuitBonus(scoreState, runtime.circuitBonusValue);
  }
  return {
    runState: settleRunFlight(runState),
    position: Position,
    nodeIdentifier: world.id,
    circuitClosed: RelayConnection?.circuitClosed === true,
    relayConnection: RelayConnection,
    wasRestored: WasRestored,
    wasSuppressed: WasSuppressed,
    liberated: Liberated,
    dockedOutsidePort: !WasRestored && !PortLanding.insidePort,
    portLanding: PortLanding,
  };
}

/** Lands on the one-use launch node without counting it as an awakened world. */
export function settleSeedstoneLanding({
  seedstone,
  scoreState,
  runState,
  impactPosition,
  bodyPosition,
}) {
  const Position = calculateSurfaceRestPosition(seedstone, impactPosition, bodyPosition);
  bankFlightScore(scoreState);
  return {
    runState: settleRunFlight(runState),
    position: Position,
    nodeIdentifier: seedstone.id,
    attachedOffset: createVector(
      Position.x - bodyPosition.x,
      Position.y - bodyPosition.y,
      Position.z - bodyPosition.z,
    ),
  };
}

/** Lands on the exposed Command World and banks the victory bonus. */
export function settleCommandLanding({
  runtime,
  worldheart,
  scoreState,
  runState,
  wardenState,
  impactPosition = null,
  bodyPosition = null,
}) {
  if (impactPosition && bodyPosition) {
    calculateSurfaceRestPosition(worldheart, impactPosition, bodyPosition);
  }
  bankFlightScore(scoreState);
  addVictoryBonus(
    scoreState,
    wardenState.distance,
    runtime.wardenVictoryValuePerStep,
  );
  return {
    runState: settleRunFlight(runState, { reachedCommandWorld: true }),
    nodeIdentifier: worldheart.id,
  };
}

/**
 * Advances Warden pursuit exactly once after a non-command resolved flight.
 * Mutates the relay network when a world is suppressed.
 */
export function resolveWardenAfterNonCommandFlight({
  runtime,
  networkState,
  wardenState,
  currentNodeIdentifier,
  firstCircuitClosed = false,
  isWorldheartOpen = false,
}) {
  const LiveWorldIdentifiers = listLiveWorldIdentifiers(networkState);
  let NextWardenState = resolveWardenPursuit(wardenState, {
    activeRelayCount: Math.max(1, countLiveRelayWorlds(networkState)),
    targetWorldIdentifier: chooseWardenTarget(
      runtime.worlds,
      listVulnerableRelayWorlds(networkState),
    ),
    firstCircuitClosed,
    shouldReveal: shouldRevealWarden({
      innerClusterLive: isInnerClusterLive(
        LiveWorldIdentifiers,
        runtime.innerClusterWorldIdentifiers,
      ),
      furtherWorldLive: hasTravelledFurther(
        LiveWorldIdentifiers,
        runtime.innerClusterWorldIdentifiers,
        runtime.furtherReachWorldIdentifiers,
        runtime.commandWorldIdentifier,
      ),
    }),
  });

  let SuppressedWorld = null;
  let Caught = false;
  if (NextWardenState.lastEvent === WardenPursuitEvents.arrived) {
    const SuppressedWorldIdentifier = NextWardenState.targetWorldIdentifier;
    if (shouldWardenCatchRunner(
      NextWardenState,
      currentNodeIdentifier,
      listProtectedRelayWorlds(networkState),
    )) {
      Caught = true;
    } else if (SuppressedWorldIdentifier) {
      suppressRelayWorld(networkState, SuppressedWorldIdentifier);
      SuppressedWorld = runtime.worlds.find(
        (World) => World.id === SuppressedWorldIdentifier,
      ) ?? null;
      if (SuppressedWorld) {
        SuppressedWorld.restored = false;
      }
      NextWardenState = resetWardenAfterSuppression(
        NextWardenState,
        chooseWardenTarget(
          runtime.worlds,
          listVulnerableRelayWorlds(networkState),
        ),
      );
    }
  }

  let NextWorldheartOpen = isWorldheartOpen;
  if (!NextWorldheartOpen) {
    NextWorldheartOpen = shouldOpenCommandWorldRoute({
      restorationUnlocked: isWorldheartUnlocked(
        runtime.worlds,
        runtime.worldheartUnlockThreshold,
      ),
      liveWorldIdentifiers: LiveWorldIdentifiers,
      innerClusterWorldIdentifiers: runtime.innerClusterWorldIdentifiers,
      furtherReachWorldIdentifiers: runtime.furtherReachWorldIdentifiers,
      requiresShieldBreaks: runtime.commandWorldRequiresShieldBreaks === true,
      wardenStatus: NextWardenState.status,
      commandWorldIdentifier: runtime.commandWorldIdentifier,
      currentWorldIdentifier: currentNodeIdentifier,
    });
  }

  return {
    wardenState: NextWardenState,
    suppressedWorld: SuppressedWorld,
    caught: Caught,
    isWorldheartOpen: NextWorldheartOpen,
  };
}
