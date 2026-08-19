import { createAuthoredSystemRuntime, getAuthoredSystemDefinition } from './content.js?v=20260819-ob138';
import {
  calculateBodyPositionAtTime,
  createOrbitTrapState,
  createVector,
  FlightSkimClearance,
  getTacticalBodyCollisionRadius,
} from './physics.js?v=20260819-ob138';
import {
  PhysicsModelVersion,
  ReplaySchemaVersion,
  parseReplay,
} from './replay.js?v=20260819-ob138';
import { createScoreState } from './scoring.js?v=20260819-ob138';
import { createRunState, releaseRunLaunch } from './run.js?v=20260819-ob138';
import { createRelayNetworkState } from './network.js?v=20260819-ob138';
import { createWardenPursuitState } from './warden.js?v=20260819-ob138';
import {
  advanceSimulatedFlightStep,
  applyFlightBreakerBurn,
  createStartingPosition,
  getActiveTacticalBodies,
  resolveWardenAfterNonCommandFlight,
  settleCommandLanding,
  settleFailedFlight,
  settleSeedstoneLanding,
  settleWorldLanding,
} from './flight-resolver.js?v=20260819-ob138';
import {
  FixedPhysicsStepHertz,
  MaximumValidatedFlightSteps,
  RunnerRadius,
  SurfaceOriginTolerance,
  SurfaceRestLift,
} from './sim-constants.js?v=20260819-ob138';

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
    || Replay.fixedStepHz !== FixedPhysicsStepHertz
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
  const RelayNetworkState = createRelayNetworkState(Runtime.startingWorldIdentifier);
  let WardenState = createWardenPursuitState();
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
      const SurfaceDistance = LaunchBodyDefinition.radius + RunnerRadius + SurfaceRestLift;
      const RecordedSurfaceDistance = Math.hypot(
        Launch.originX - LaunchBodyPosition.x,
        Launch.originY - LaunchBodyPosition.y,
      );
      if (Math.abs(RecordedSurfaceDistance - SurfaceDistance) > SurfaceOriginTolerance) {
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
    const OrbitTrapState = createOrbitTrapState();
    let FlightSettled = false;
    let BurnApplied = false;
    let CircuitClosedThisFlight = false;
    let ReachedCommandThisFlight = false;

    for (let FlightStepIndex = 0; FlightStepIndex < MaximumValidatedFlightSteps; FlightStepIndex += 1) {
      CurrentStepIndex += 1;
      FlightStepCount += 1;
      const SimulationTimeSeconds = CurrentStepIndex * FixedStepSeconds;
      if (Launch.burnStepIndex === CurrentStepIndex) {
        PhysicsState = applyFlightBreakerBurn(
          PhysicsState,
          Number.isFinite(Launch.burnDirectionX) && Number.isFinite(Launch.burnDirectionY)
            ? { x: Launch.burnDirectionX, y: Launch.burnDirectionY }
            : null,
        );
        BurnApplied = true;
      }
      const StepResult = advanceSimulatedFlightStep({
        physicsState: PhysicsState,
        worlds: Runtime.worlds,
        tacticalBodies: getActiveTacticalBodies(
          Runtime,
          SeedstoneUsesRemaining,
          IsWorldheartOpen,
        ),
        stardust: Runtime.stardust,
        scoreState: ScoreState,
        fixedStepSeconds: FixedStepSeconds,
        simulationTimeSeconds: SimulationTimeSeconds,
        ignoredWorldIdentifier: IgnoredWorldIdentifier,
        ignoredBodyIdentifier: IgnoredBodyIdentifier,
        ignoredBodyDefinition: IgnoredBodyIdentifier ? Seedstone : null,
        flightOriginWorldIdentifier: FlightOriginWorldIdentifier,
        flightElapsedSteps: FlightStepIndex + 1,
        flightCollectedStardust: FlightCollectedStardust,
        outOfBoundsDistance: OutOfBoundsDistance,
        orbitTrapState: OrbitTrapState,
      });
      PhysicsState = StepResult.physicsState;
      IgnoredWorldIdentifier = StepResult.ignoredWorldIdentifier;
      IgnoredBodyIdentifier = StepResult.ignoredBodyIdentifier;

      if (StepResult.collisionBody?.definition.kind === 'hazard') {
        const Failed = settleFailedFlight({
          runState: RunState,
          scoreState: ScoreState,
          stardust: Runtime.stardust,
          flightCollectedStardust: FlightCollectedStardust,
          lastSafeNodeIdentifier: LastSafeNodeIdentifier,
          lastSafePosition: LastSafePosition,
        });
        RunState = Failed.runState;
        CurrentNodeIdentifier = Failed.nodeIdentifier;
        CurrentPosition = Failed.position;
        FlightSettled = true;
      } else if (StepResult.collisionBody?.definition.kind === 'seedstone') {
        const SeedstoneLanding = settleSeedstoneLanding({
          seedstone: Seedstone,
          scoreState: ScoreState,
          runState: RunState,
          impactPosition: PhysicsState.position,
          bodyPosition: StepResult.collisionBody.position,
        });
        AttachedSeedstoneOffset = SeedstoneLanding.attachedOffset;
        CurrentPosition = SeedstoneLanding.position;
        CurrentNodeIdentifier = SeedstoneLanding.nodeIdentifier;
        RunState = SeedstoneLanding.runState;
        FlightSettled = true;
      } else if (StepResult.collisionBody?.definition.kind === 'worldheart') {
        if (IsWorldheartOpen && !Worldheart.restored) {
          const CommandLanding = settleCommandLanding({
            runtime: Runtime,
            worldheart: Worldheart,
            scoreState: ScoreState,
            runState: RunState,
            wardenState: WardenState,
          });
          RunState = CommandLanding.runState;
          CurrentNodeIdentifier = CommandLanding.nodeIdentifier;
          ReachedCommandThisFlight = true;
          FlightSettled = true;
        } else {
          const Failed = settleFailedFlight({
            runState: RunState,
            scoreState: ScoreState,
            stardust: Runtime.stardust,
            flightCollectedStardust: FlightCollectedStardust,
            lastSafeNodeIdentifier: LastSafeNodeIdentifier,
            lastSafePosition: LastSafePosition,
          });
          RunState = Failed.runState;
          CurrentNodeIdentifier = Failed.nodeIdentifier;
          CurrentPosition = Failed.position;
          FlightSettled = true;
        }
      } else if (StepResult.collisionWorld) {
        const WorldLanding = settleWorldLanding({
          runtime: Runtime,
          networkState: RelayNetworkState,
          scoreState: ScoreState,
          runState: RunState,
          world: StepResult.collisionWorld,
          impactPosition: PhysicsState.position,
          flightOriginWorldIdentifier: FlightOriginWorldIdentifier,
        });
        CircuitClosedThisFlight = WorldLanding.circuitClosed;
        CurrentPosition = WorldLanding.position;
        CurrentNodeIdentifier = WorldLanding.nodeIdentifier;
        LastSafeNodeIdentifier = WorldLanding.nodeIdentifier;
        LastSafePosition = createVector(
          CurrentPosition.x,
          CurrentPosition.y,
          CurrentPosition.z,
        );
        RunState = WorldLanding.runState;
        FlightSettled = true;
      } else if (StepResult.outOfBounds || StepResult.orbitTrapped) {
        const TrappedOnCommand = StepResult.orbitTrapped
          && (
            OrbitTrapState.worldIdentifier === Worldheart.id
            || OrbitTrapState.skimWorldIdentifier === Worldheart.id
          );
        if (TrappedOnCommand && IsWorldheartOpen && !Worldheart.restored) {
          const CommandPosition = calculateBodyPositionAtTime(Worldheart, SimulationTimeSeconds);
          const CommandCatch = getTacticalBodyCollisionRadius(Worldheart)
            + RunnerRadius
            + FlightSkimClearance;
          const CommandDistance = Math.hypot(
            PhysicsState.position.x - CommandPosition.x,
            PhysicsState.position.y - CommandPosition.y,
          );
          if (CommandDistance <= CommandCatch) {
            const CommandLanding = settleCommandLanding({
              runtime: Runtime,
              worldheart: Worldheart,
              scoreState: ScoreState,
              runState: RunState,
              wardenState: WardenState,
              impactPosition: PhysicsState.position,
              bodyPosition: CommandPosition,
            });
            RunState = CommandLanding.runState;
            CurrentNodeIdentifier = CommandLanding.nodeIdentifier;
            ReachedCommandThisFlight = true;
            FlightSettled = true;
          }
        }
        if (!FlightSettled) {
          const Failed = settleFailedFlight({
            runState: RunState,
            scoreState: ScoreState,
            stardust: Runtime.stardust,
            flightCollectedStardust: FlightCollectedStardust,
            lastSafeNodeIdentifier: LastSafeNodeIdentifier,
            lastSafePosition: LastSafePosition,
          });
          RunState = Failed.runState;
          CurrentNodeIdentifier = Failed.nodeIdentifier;
          CurrentPosition = Failed.position;
          FlightSettled = true;
        }
      }

      if (FlightSettled) {
        break;
      }
    }

    if (!FlightSettled) {
      return invalid(`Launch ${LaunchIndex + 1} did not settle within the validation limit.`);
    }
    if (!ReachedCommandThisFlight) {
      const WardenResolution = resolveWardenAfterNonCommandFlight({
        runtime: Runtime,
        networkState: RelayNetworkState,
        wardenState: WardenState,
        currentNodeIdentifier: CurrentNodeIdentifier,
        firstCircuitClosed: CircuitClosedThisFlight,
        isWorldheartOpen: IsWorldheartOpen,
      });
      WardenState = WardenResolution.wardenState;
      if (WardenResolution.caught) {
        return invalid('Replay is caught by the Warden before completion.');
      }
      IsWorldheartOpen = WardenResolution.isWorldheartOpen;
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
      networkScore: ScoreState.networkScore,
      liberationScore: ScoreState.liberationScore,
      circuitScore: ScoreState.circuitScore,
      victoryScore: ScoreState.victoryScore,
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
