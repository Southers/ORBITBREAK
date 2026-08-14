import { isWorldheartUnlocked } from './campaign.js';
import {
  createAuthoredSystemRuntime,
  getAuthoredSystemDefinition,
} from './content.js';
import {
  applyBreakerBurn,
  calculateBodyPositionAtTime,
  calculateDistanceSquared,
  createVector,
  findCollidingBody,
  findCollidingWorld,
  simulatePhysicsStep,
} from './physics.js';
import {
  PhysicsModelVersion,
  ReplaySchemaVersion,
  parseReplay,
} from './replay.js';
import {
  addCompletionBonus,
  bankFlightScore,
  createScoreState,
  rollbackFlightScore,
  sampleSlingshotBodies,
} from './scoring.js';
import { createRunState, releaseRunLaunch, settleRunFlight } from './run.js';

const RunnerRadius = 0.46;
const StardustRadius = 0.22;
const StardustCollectionRadiusSquared = (RunnerRadius + StardustRadius) ** 2;
const MaximumValidatedFlightSteps = 15000;

function calculateSurfaceRestPosition(BodyDefinition, ImpactPosition, BodyPosition) {
  const DifferenceX = ImpactPosition.x - BodyPosition.x;
  const DifferenceY = ImpactPosition.y - BodyPosition.y;
  const Distance = Math.hypot(DifferenceX, DifferenceY) || 1;
  const SurfaceDistance = BodyDefinition.radius + RunnerRadius + 0.03;
  return createVector(
    BodyPosition.x + ((DifferenceX / Distance) * SurfaceDistance),
    BodyPosition.y + ((DifferenceY / Distance) * SurfaceDistance),
    0,
  );
}

function createStartingPosition(Runtime) {
  const StartingWorld = Runtime.worlds.find(
    (World) => World.id === Runtime.startingWorldIdentifier,
  );
  const OpeningTarget = Runtime.worlds.find(
    (World) => World.id === Runtime.openingGuideTargetIdentifier,
  );
  const DifferenceX = OpeningTarget.position.x - StartingWorld.position.x;
  const DifferenceY = OpeningTarget.position.y - StartingWorld.position.y;
  const Distance = Math.hypot(DifferenceX, DifferenceY) || 1;
  const SurfaceDistance = StartingWorld.radius + RunnerRadius + 0.03;
  return createVector(
    StartingWorld.position.x + ((DifferenceX / Distance) * SurfaceDistance),
    StartingWorld.position.y + ((DifferenceY / Distance) * SurfaceDistance),
    0,
  );
}

function getActiveTacticalBodies(Runtime, SeedstoneUsesRemaining, IsWorldheartOpen) {
  return Runtime.tacticalBodies.filter((Body) => (
    Body.kind === 'hazard'
    || (Body.kind === 'seedstone' && SeedstoneUsesRemaining > 0)
    || (Body.kind === 'worldheart' && IsWorldheartOpen)
  ));
}

function collectStardust(Runtime, Position, FlightCollectedIdentifiers) {
  for (const Stardust of Runtime.stardust) {
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

function rollbackStardust(Runtime, FlightCollectedIdentifiers) {
  for (const Stardust of Runtime.stardust) {
    if (FlightCollectedIdentifiers.has(Stardust.id)) {
      Stardust.collected = false;
    }
  }
}

function invalid(Reason) {
  return { valid: false, reason: Reason, result: null };
}

/**
 * Re-simulates an input-only replay and derives every ranked result field.
 * The implementation has no DOM, storage, rendering or client score dependency.
 */
export function validateReplay(Replay) {
  if (
    (Replay.schemaVersion !== 1 && Replay.schemaVersion !== ReplaySchemaVersion)
    || Replay.physicsVersion !== PhysicsModelVersion
    || Replay.outcome !== 'complete'
  ) {
    return invalid('Replay version or completion state is unsupported.');
  }

  let AuthoredSystem;
  try {
    AuthoredSystem = getAuthoredSystemDefinition(Replay.systemIdentifier);
  } catch {
    return invalid('Replay system is unknown.');
  }
  if (
    AuthoredSystem.id !== Replay.systemIdentifier
    || AuthoredSystem.contentVersion !== Replay.contentVersion
    || Replay.fixedStepHz !== 120
  ) {
    return invalid('Replay content or fixed-step version does not match.');
  }
  if (Replay.launches.length < 1 || Replay.launches.length > 64) {
    return invalid('Replay launch count is outside the supported limit.');
  }

  const Runtime = createAuthoredSystemRuntime(AuthoredSystem, { createVector });
  const FixedStepSeconds = 1 / Replay.fixedStepHz;
  const OutOfBoundsDistance = Runtime.camera?.outOfBoundsDistance ?? 34;
  const Seedstone = Runtime.tacticalBodies.find((Body) => Body.kind === 'seedstone');
  const Worldheart = Runtime.tacticalBodies.find((Body) => Body.kind === 'worldheart');
  let SeedstoneUsesRemaining = Seedstone.uses;
  let IsWorldheartOpen = Worldheart.routeAvailableInitially === true;
  let RunState = createRunState(Runtime.launchBudget);
  const ScoreState = createScoreState();
  let CurrentNodeIdentifier = Runtime.startingWorldIdentifier;
  let CurrentPosition = createStartingPosition(Runtime);
  let LastSafeNodeIdentifier = CurrentNodeIdentifier;
  let LastSafePosition = createVector(CurrentPosition.x, CurrentPosition.y, CurrentPosition.z);
  let AttachedSeedstoneOffset = null;
  let CurrentStepIndex = 0;
  let FlightStepCount = 0;

  for (let LaunchIndex = 0; LaunchIndex < Replay.launches.length; LaunchIndex += 1) {
    const Launch = Replay.launches[LaunchIndex];
    if (
      RunState.status !== 'active'
      || Launch.originIdentifier !== CurrentNodeIdentifier
      || Launch.stepIndex < CurrentStepIndex
    ) {
      return invalid(`Launch ${LaunchIndex + 1} has an impossible origin or time.`);
    }

    const IsLaunchingFromSeedstone = CurrentNodeIdentifier === Seedstone.id;
    let LaunchBodyPosition = null;
    let LaunchBodyDefinition = null;
    if (IsLaunchingFromSeedstone) {
      if (!AttachedSeedstoneOffset || SeedstoneUsesRemaining < 1) {
        return invalid(`Launch ${LaunchIndex + 1} uses an unavailable Seedstone.`);
      }
      const SeedstonePosition = calculateBodyPositionAtTime(
        Seedstone,
        Launch.stepIndex * FixedStepSeconds,
      );
      LaunchBodyDefinition = Seedstone;
      LaunchBodyPosition = SeedstonePosition;
      if (Replay.schemaVersion === 1) {
        CurrentPosition = createVector(
          SeedstonePosition.x + AttachedSeedstoneOffset.x,
          SeedstonePosition.y + AttachedSeedstoneOffset.y,
          SeedstonePosition.z + AttachedSeedstoneOffset.z,
        );
      }
      SeedstoneUsesRemaining = 0;
      AttachedSeedstoneOffset = null;
    } else {
      LaunchBodyDefinition = Runtime.worlds.find(
        (World) => World.id === CurrentNodeIdentifier,
      );
      LaunchBodyPosition = LaunchBodyDefinition?.position ?? null;
    }

    if (Replay.schemaVersion >= 2) {
      if (!LaunchBodyDefinition || !LaunchBodyPosition) {
        return invalid(`Launch ${LaunchIndex + 1} has no valid surface origin.`);
      }
      const SurfaceDistance = LaunchBodyDefinition.radius + RunnerRadius + 0.03;
      const RecordedSurfaceDistance = Math.hypot(
        Launch.originX - LaunchBodyPosition.x,
        Launch.originY - LaunchBodyPosition.y,
      );
      if (Math.abs(RecordedSurfaceDistance - SurfaceDistance) > 0.015) {
        return invalid(`Launch ${LaunchIndex + 1} leaves from outside its recorded surface.`);
      }
      CurrentPosition = createVector(Launch.originX, Launch.originY, 0);
      if (!IsLaunchingFromSeedstone) {
        LastSafePosition = createVector(CurrentPosition.x, CurrentPosition.y, 0);
      }
    }

    CurrentStepIndex = Launch.stepIndex;
    RunState = releaseRunLaunch(RunState);
    let PhysicsState = {
      position: createVector(CurrentPosition.x, CurrentPosition.y, CurrentPosition.z),
      velocity: createVector(Launch.velocityX, Launch.velocityY, 0),
    };
    let IgnoredWorldIdentifier = IsLaunchingFromSeedstone ? null : CurrentNodeIdentifier;
    let IgnoredBodyIdentifier = IsLaunchingFromSeedstone ? Seedstone.id : null;
    const FlightOriginWorldIdentifier = IsLaunchingFromSeedstone
      ? null
      : CurrentNodeIdentifier;
    const FlightCollectedStardust = new Set();
    let FlightSettled = false;
    let BurnApplied = false;

    for (let FlightStepIndex = 0; FlightStepIndex < MaximumValidatedFlightSteps; FlightStepIndex += 1) {
      CurrentStepIndex += 1;
      FlightStepCount += 1;
      const SimulationTimeSeconds = CurrentStepIndex * FixedStepSeconds;
      if (Launch.burnStepIndex === CurrentStepIndex) {
        PhysicsState = applyBreakerBurn(PhysicsState);
        BurnApplied = true;
      }
      PhysicsState = simulatePhysicsStep(PhysicsState, Runtime.worlds, FixedStepSeconds);
      collectStardust(Runtime, PhysicsState.position, FlightCollectedStardust);

      if (IgnoredWorldIdentifier) {
        const OriginWorld = Runtime.worlds.find((World) => World.id === IgnoredWorldIdentifier);
        const ClearDistance = OriginWorld.radius + RunnerRadius + 0.35;
        if (calculateDistanceSquared(PhysicsState.position, OriginWorld.position) > ClearDistance ** 2) {
          IgnoredWorldIdentifier = null;
        }
      }
      if (IgnoredBodyIdentifier) {
        const OriginBodyPosition = calculateBodyPositionAtTime(Seedstone, SimulationTimeSeconds);
        const ClearDistance = Seedstone.radius + RunnerRadius + 0.35;
        if (calculateDistanceSquared(PhysicsState.position, OriginBodyPosition) > ClearDistance ** 2) {
          IgnoredBodyIdentifier = null;
        }
      }

      sampleSlingshotBodies(ScoreState, PhysicsState.position, Runtime.worlds, {
        runnerRadius: RunnerRadius,
        ignoredBodyIdentifier: FlightOriginWorldIdentifier,
      });
      const CollisionWorld = findCollidingWorld(
        PhysicsState.position,
        RunnerRadius,
        Runtime.worlds,
        IgnoredWorldIdentifier,
      );
      const CollisionBody = findCollidingBody(
        PhysicsState.position,
        RunnerRadius,
        getActiveTacticalBodies(Runtime, SeedstoneUsesRemaining, IsWorldheartOpen),
        SimulationTimeSeconds,
        IgnoredBodyIdentifier,
      );

      if (CollisionBody?.definition.kind === 'hazard') {
        RunState = settleRunFlight(RunState);
        rollbackFlightScore(ScoreState);
        rollbackStardust(Runtime, FlightCollectedStardust);
        CurrentNodeIdentifier = LastSafeNodeIdentifier;
        CurrentPosition = createVector(LastSafePosition.x, LastSafePosition.y, LastSafePosition.z);
        FlightSettled = true;
      } else if (CollisionBody?.definition.kind === 'seedstone') {
        const BodyPosition = CollisionBody.position;
        CurrentPosition = calculateSurfaceRestPosition(
          CollisionBody.definition,
          PhysicsState.position,
          BodyPosition,
        );
        AttachedSeedstoneOffset = createVector(
          CurrentPosition.x - BodyPosition.x,
          CurrentPosition.y - BodyPosition.y,
          CurrentPosition.z - BodyPosition.z,
        );
        CurrentNodeIdentifier = Seedstone.id;
        bankFlightScore(ScoreState);
        RunState = settleRunFlight(RunState);
        FlightSettled = true;
      } else if (CollisionBody?.definition.kind === 'worldheart') {
        bankFlightScore(ScoreState);
        RunState = settleRunFlight(RunState, { reachedCommandWorld: true });
        addCompletionBonus(ScoreState, RunState.remainingLaunches);
        CurrentNodeIdentifier = Worldheart.id;
        FlightSettled = true;
      } else if (CollisionWorld) {
        const WasRestored = CollisionWorld.restored;
        CollisionWorld.restored = true;
        CurrentPosition = calculateSurfaceRestPosition(
          CollisionWorld,
          PhysicsState.position,
          CollisionWorld.position,
        );
        CurrentNodeIdentifier = CollisionWorld.id;
        LastSafeNodeIdentifier = CollisionWorld.id;
        LastSafePosition = createVector(CurrentPosition.x, CurrentPosition.y, CurrentPosition.z);
        bankFlightScore(ScoreState, {
          landingBonus: WasRestored ? 0 : (CollisionWorld.liberationValue ?? 1000),
        });
        if (!IsWorldheartOpen) {
          IsWorldheartOpen = isWorldheartUnlocked(
            Runtime.worlds,
            Runtime.worldheartUnlockThreshold,
          );
        }
        RunState = settleRunFlight(RunState);
        FlightSettled = true;
      } else if (
        (PhysicsState.position.x ** 2) + (PhysicsState.position.y ** 2)
        > OutOfBoundsDistance ** 2
      ) {
        RunState = settleRunFlight(RunState);
        rollbackFlightScore(ScoreState);
        rollbackStardust(Runtime, FlightCollectedStardust);
        CurrentNodeIdentifier = LastSafeNodeIdentifier;
        CurrentPosition = createVector(LastSafePosition.x, LastSafePosition.y, LastSafePosition.z);
        FlightSettled = true;
      }

      if (FlightSettled) {
        break;
      }
    }

    if (!FlightSettled) {
      return invalid(`Launch ${LaunchIndex + 1} did not settle within the validation limit.`);
    }
    if (Launch.burnStepIndex !== undefined && Launch.burnStepIndex !== null && !BurnApplied) {
      return invalid(`Launch ${LaunchIndex + 1} records a Burn outside its flight.`);
    }
    if (RunState.status === 'complete' && LaunchIndex !== Replay.launches.length - 1) {
      return invalid('Replay contains launches after completion.');
    }
    if (RunState.status === 'failed') {
      return invalid('Replay exhausts its launches before completion.');
    }
  }

  if (RunState.status !== 'complete' || CurrentNodeIdentifier !== Worldheart.id) {
    return invalid('Replay does not reach the Command World.');
  }
  return {
    valid: true,
    reason: null,
    result: {
      systemIdentifier: Runtime.id,
      contentVersion: Runtime.contentVersion,
      score: ScoreState.bankedScore,
      launchesUsed: RunState.launchesUsed,
      flightTimeMilliseconds: Math.round((FlightStepCount / Replay.fixedStepHz) * 1000),
      slingshotScore: ScoreState.bankedSlingshotScore,
      liberationScore: ScoreState.liberationScore,
      completionBonus: ScoreState.completionBonus,
      collectedStardustCount: Runtime.stardust.filter((Stardust) => Stardust.collected).length,
    },
  };
}

export function validateSerializedReplay(SerializedReplay) {
  try {
    return validateReplay(parseReplay(SerializedReplay));
  } catch (CaughtError) {
    return invalid(
      CaughtError instanceof Error ? CaughtError.message : 'Replay parsing failed.',
    );
  }
}
