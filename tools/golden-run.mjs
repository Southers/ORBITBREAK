/**
 * Golden-run generator.
 *
 * Drives the exact ranked state machine used by the replay validator, searching
 * deterministic launches leg by leg until an authored route completes, then
 * writes the serialized replay and its derived result as test fixtures.
 *
 * Usage:
 *   node tools/golden-run.mjs                 # regenerate breaker-reach fixtures
 *   node tools/golden-run.mjs --probe A B     # print launch solutions from A to B
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createAuthoredSystemRuntime, getAuthoredSystemDefinition } from '../src/content.js';
import {
  MaximumLaunchSpeed,
  calculateBodyPositionAtTime,
  createOrbitTrapState,
  createVector,
  findCollidingBody,
  findCollidingWorld,
  simulatePhysicsStep,
  advanceOrbitTrap,
  applyBreakerBurn,
  calculateDistanceSquared,
} from '../src/physics.js';
import { createScoreState, predictSlingshotEvents } from '../src/scoring.js';
import { createRunState, releaseRunLaunch } from '../src/run.js';
import { createRelayNetworkState } from '../src/network.js';
import { createWardenPursuitState } from '../src/warden.js';
import {
  advanceSimulatedFlightStep,
  applyFlightBreakerBurn,
  createStartingPosition,
  getActiveTacticalBodies,
  resolveWardenAfterNonCommandFlight,
  settleCommandLanding,
  settleWorldLanding,
} from '../src/flight-resolver.js';
import {
  FixedPhysicsStepHertz,
  FixedPhysicsStepSeconds,
  MaximumValidatedFlightSteps,
  RunnerRadius,
  SurfaceRestLift,
} from '../src/sim-constants.js';
import { validateSerializedReplay } from '../src/replay-validator.js';

const FixtureDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures');

const SurfaceAngleSamples = 60;
const AimOffsetSamples = 41;
const MaximumAimOffsetRadians = 2.1;
const SpeedFractions = [1, 0.92, 0.84, 0.76, 0.66, 0.56, 0.46];

/**
 * Flies one candidate launch with the shared physics step and reports where it
 * settles. Mirrors the validator's flight loop, including the optional Burn.
 */
function flyCandidate({
  startPosition,
  velocity,
  worlds,
  activeBodies,
  launchStepIndex,
  originIdentifier,
  originIsBody,
  burnFlightStep = null,
}) {
  let PhysicsState = {
    position: createVector(startPosition.x, startPosition.y, 0),
    velocity: createVector(velocity.x, velocity.y, 0),
  };
  let IgnoredWorldIdentifier = originIsBody ? null : originIdentifier;
  const OrbitTrapState = createOrbitTrapState();
  const Points = [createVector(PhysicsState.position.x, PhysicsState.position.y, 0)];
  const OriginWorld = originIsBody
    ? null
    : worlds.find((World) => World.id === originIdentifier);

  for (let FlightStep = 1; FlightStep <= MaximumValidatedFlightSteps; FlightStep += 1) {
    if (FlightStep === burnFlightStep) {
      PhysicsState = applyBreakerBurn(PhysicsState);
    }
    PhysicsState = simulatePhysicsStep(PhysicsState, worlds, FixedPhysicsStepSeconds);
    Points.push(createVector(PhysicsState.position.x, PhysicsState.position.y, 0));
    const SimulationTimeSeconds = (launchStepIndex + FlightStep) * FixedPhysicsStepSeconds;
    if (IgnoredWorldIdentifier && OriginWorld) {
      const ClearDistance = OriginWorld.radius + RunnerRadius + 0.35;
      if (
        calculateDistanceSquared(PhysicsState.position, OriginWorld.position)
        > (ClearDistance ** 2)
      ) {
        IgnoredWorldIdentifier = null;
      }
    }
    const CollisionBody = findCollidingBody(
      PhysicsState.position,
      RunnerRadius,
      activeBodies,
      SimulationTimeSeconds,
    );
    if (CollisionBody) {
      return {
        kind: CollisionBody.definition.kind,
        identifier: CollisionBody.definition.id,
        steps: FlightStep,
        points: Points,
      };
    }
    const CollisionWorld = findCollidingWorld(
      PhysicsState.position,
      RunnerRadius,
      worlds,
      IgnoredWorldIdentifier,
    );
    if (CollisionWorld) {
      return {
        kind: 'world', identifier: CollisionWorld.id, steps: FlightStep, points: Points,
      };
    }
    if (advanceOrbitTrap(OrbitTrapState, PhysicsState.position, worlds)) {
      return { kind: 'trap', identifier: null, steps: FlightStep, points: Points };
    }
    if ((PhysicsState.position.x ** 2) + (PhysicsState.position.y ** 2) > (96 ** 2)) {
      return { kind: 'bounds', identifier: null, steps: FlightStep, points: Points };
    }
  }
  return { kind: 'timeout', identifier: null, steps: MaximumValidatedFlightSteps, points: Points };
}

/** Searches surface angle, aim and speed for launches that settle on the target. */
function searchLeg({
  runtime,
  worlds,
  activeBodies,
  originIdentifier,
  targetIdentifier,
  launchStepIndex,
  burnFlightSteps = [null],
  maximumSolutions = 24,
}) {
  const Origin = worlds.find((World) => World.id === originIdentifier);
  const SurfaceDistance = Origin.radius + RunnerRadius + SurfaceRestLift;
  const Solutions = [];
  for (let AngleIndex = 0; AngleIndex < SurfaceAngleSamples; AngleIndex += 1) {
    const SurfaceAngle = (AngleIndex / SurfaceAngleSamples) * Math.PI * 2;
    const StartPosition = createVector(
      Origin.position.x + (Math.cos(SurfaceAngle) * SurfaceDistance),
      Origin.position.y + (Math.sin(SurfaceAngle) * SurfaceDistance),
      0,
    );
    for (let OffsetIndex = 0; OffsetIndex < AimOffsetSamples; OffsetIndex += 1) {
      const AimOffset = ((OffsetIndex / (AimOffsetSamples - 1)) * 2 - 1)
        * MaximumAimOffsetRadians;
      const AimAngle = SurfaceAngle + AimOffset;
      for (const SpeedFraction of SpeedFractions) {
        const Speed = MaximumLaunchSpeed * SpeedFraction;
        const Velocity = createVector(
          Math.cos(AimAngle) * Speed,
          Math.sin(AimAngle) * Speed,
          0,
        );
        for (const BurnFlightStep of burnFlightSteps) {
          const Outcome = flyCandidate({
            startPosition: StartPosition,
            velocity: Velocity,
            worlds,
            activeBodies,
            launchStepIndex,
            originIdentifier,
            originIsBody: false,
            burnFlightStep: BurnFlightStep,
          });
          if (Outcome.identifier !== targetIdentifier || Outcome.kind === 'trap') {
            continue;
          }
          const AssistEvents = predictSlingshotEvents(Outcome.points, worlds, {
            runnerRadius: RunnerRadius,
            ignoredBodyIdentifier: originIdentifier,
          }).filter((Event) => Event.bodyIdentifier !== targetIdentifier);
          Solutions.push({
            surfaceAngle: SurfaceAngle,
            startPosition: StartPosition,
            velocity: Velocity,
            speedFraction: SpeedFraction,
            burnFlightStep: BurnFlightStep,
            steps: Outcome.steps,
            assistPoints: AssistEvents.reduce((Total, Event) => Total + Event.points, 0),
            assistBodies: AssistEvents.map((Event) => `${Event.bodyIdentifier}:${Event.tier}`),
          });
          if (Solutions.length >= maximumSolutions * 8) {
            break;
          }
        }
      }
    }
  }
  Solutions.sort((First, Second) => (
    (Second.assistPoints - First.assistPoints) || (First.steps - Second.steps)
  ));
  return Solutions.slice(0, maximumSolutions);
}

function createFixtureState(SectorIdentifier) {
  const Definition = getAuthoredSystemDefinition(SectorIdentifier);
  const Runtime = createAuthoredSystemRuntime(Definition, { createVector });
  const Worldheart = Runtime.tacticalBodies.find((Body) => Body.kind === 'worldheart');
  const Seedstone = Runtime.tacticalBodies.find((Body) => Body.kind === 'seedstone');
  return {
    definition: Definition,
    runtime: Runtime,
    worldheart: Worldheart,
    seedstone: Seedstone,
    seedstoneUsesRemaining: Seedstone.uses,
    isWorldheartOpen: Worldheart.routeAvailableInitially === true,
    runState: createRunState(Runtime.launchBudget),
    scoreState: createScoreState(),
    networkState: createRelayNetworkState(Runtime.startingWorldIdentifier),
    wardenState: createWardenPursuitState(),
    currentNodeIdentifier: Runtime.startingWorldIdentifier,
    currentPosition: createStartingPosition(Runtime),
    currentStepIndex: 0,
    launches: [],
  };
}

/** Executes one chosen launch against the live fixture state, exactly like the validator. */
function executeLeg(State, Solution, TargetIdentifier) {
  const { runtime: Runtime } = State;
  const LaunchStepIndex = State.currentStepIndex === 0
    ? 0
    : State.currentStepIndex + 1;
  State.runState = releaseRunLaunch(State.runState);
  let PhysicsState = {
    position: createVector(Solution.startPosition.x, Solution.startPosition.y, 0),
    velocity: createVector(Solution.velocity.x, Solution.velocity.y, 0),
  };
  let IgnoredWorldIdentifier = State.currentNodeIdentifier;
  const FlightCollectedStardust = new Set();
  const OrbitTrapState = createOrbitTrapState();
  let StepIndex = LaunchStepIndex;
  let Settled = false;
  let CircuitClosed = false;
  let ReachedCommand = false;
  let BurnStepIndex = null;

  for (let FlightStep = 1; FlightStep <= MaximumValidatedFlightSteps; FlightStep += 1) {
    StepIndex += 1;
    if (FlightStep === Solution.burnFlightStep) {
      PhysicsState = applyFlightBreakerBurn(PhysicsState, null);
      BurnStepIndex = StepIndex;
    }
    const StepResult = advanceSimulatedFlightStep({
      physicsState: PhysicsState,
      worlds: Runtime.worlds,
      tacticalBodies: getActiveTacticalBodies(
        Runtime,
        State.seedstoneUsesRemaining,
        State.isWorldheartOpen,
      ),
      stardust: Runtime.stardust,
      scoreState: State.scoreState,
      fixedStepSeconds: FixedPhysicsStepSeconds,
      simulationTimeSeconds: StepIndex * FixedPhysicsStepSeconds,
      ignoredWorldIdentifier: IgnoredWorldIdentifier,
      flightOriginWorldIdentifier: State.currentNodeIdentifier,
      flightCollectedStardust: FlightCollectedStardust,
      outOfBoundsDistance: Runtime.camera?.outOfBoundsDistance ?? 34,
      orbitTrapState: OrbitTrapState,
    });
    PhysicsState = StepResult.physicsState;
    IgnoredWorldIdentifier = StepResult.ignoredWorldIdentifier;

    if (StepResult.collisionBody?.definition.kind === 'worldheart') {
      const Landing = settleCommandLanding({
        runtime: Runtime,
        worldheart: State.worldheart,
        scoreState: State.scoreState,
        runState: State.runState,
        wardenState: State.wardenState,
      });
      State.runState = Landing.runState;
      State.currentNodeIdentifier = Landing.nodeIdentifier;
      ReachedCommand = true;
      Settled = true;
    } else if (StepResult.collisionWorld) {
      const Landing = settleWorldLanding({
        runtime: Runtime,
        networkState: State.networkState,
        scoreState: State.scoreState,
        runState: State.runState,
        world: StepResult.collisionWorld,
        impactPosition: PhysicsState.position,
        flightOriginWorldIdentifier: State.currentNodeIdentifier,
      });
      CircuitClosed = Landing.circuitClosed;
      State.currentPosition = Landing.position;
      State.currentNodeIdentifier = Landing.nodeIdentifier;
      State.runState = Landing.runState;
      Settled = true;
    } else if (
      StepResult.collisionBody
      || StepResult.outOfBounds
      || StepResult.orbitTrapped
    ) {
      throw new Error(`Leg to ${TargetIdentifier} failed mid-flight.`);
    }
    if (Settled) {
      break;
    }
  }
  if (!Settled || State.currentNodeIdentifier !== TargetIdentifier) {
    throw new Error(`Leg to ${TargetIdentifier} did not settle as planned.`);
  }
  State.currentStepIndex = StepIndex;
  if (!ReachedCommand) {
    const Resolution = resolveWardenAfterNonCommandFlight({
      runtime: Runtime,
      networkState: State.networkState,
      wardenState: State.wardenState,
      currentNodeIdentifier: State.currentNodeIdentifier,
      firstCircuitClosed: CircuitClosed,
      isWorldheartOpen: State.isWorldheartOpen,
    });
    State.wardenState = Resolution.wardenState;
    if (Resolution.caught) {
      throw new Error('Golden route is caught by the Warden; reorder the legs.');
    }
    State.isWorldheartOpen = Resolution.isWorldheartOpen;
  }
  State.launches.push([
    LaunchStepIndex,
    Solution.originIdentifier,
    Solution.startPosition.x,
    Solution.startPosition.y,
    Solution.velocity.x,
    Solution.velocity.y,
    BurnStepIndex,
  ]);
  return { circuitClosed: CircuitClosed, reachedCommand: ReachedCommand };
}

function serializeFixture(State, Outcome) {
  return {
    v: 2,
    s: State.runtime.id,
    c: State.runtime.contentVersion,
    p: 'orbitbreak-fixed-step-v1',
    h: FixedPhysicsStepHertz,
    o: Outcome,
    l: State.launches,
  };
}

function solveRoute(SectorIdentifier, RouteLegs, { verbose = true } = {}) {
  const State = createFixtureState(SectorIdentifier);
  for (const Leg of RouteLegs) {
    const LaunchStepIndex = State.currentStepIndex === 0 ? 0 : State.currentStepIndex + 1;
    const ActiveBodies = getActiveTacticalBodies(
      State.runtime,
      State.seedstoneUsesRemaining,
      State.isWorldheartOpen,
    );
    const Solutions = searchLeg({
      runtime: State.runtime,
      worlds: State.runtime.worlds,
      activeBodies: ActiveBodies,
      originIdentifier: State.currentNodeIdentifier,
      targetIdentifier: Leg.target,
      launchStepIndex: LaunchStepIndex,
      burnFlightSteps: Leg.burn ? [30, 60, 96, 150, 210] : [null],
    });
    if (Solutions.length === 0) {
      throw new Error(`No launch found for ${State.currentNodeIdentifier} -> ${Leg.target}.`);
    }
    const Solution = { ...Solutions[0], originIdentifier: State.currentNodeIdentifier };
    const Result = executeLeg(State, Solution, Leg.target);
    if (verbose) {
      console.log(
        `${Solution.originIdentifier.padEnd(10)} -> ${Leg.target.padEnd(10)}`
        + ` speed ${(Solution.speedFraction * MaximumLaunchSpeed).toFixed(2).padStart(6)}`
        + ` steps ${String(Solution.steps).padStart(5)}`
        + (Solution.burnFlightStep ? ` burn@${Solution.burnFlightStep}` : '')
        + (Result.circuitClosed ? ' CIRCUIT' : '')
        + (Solution.assistBodies.length > 0 ? ` assists ${Solution.assistBodies.join(',')}` : ''),
      );
    }
  }
  return State;
}

function probe(SectorIdentifier, OriginIdentifier, TargetIdentifier, WithBurn) {
  const State = createFixtureState(SectorIdentifier);
  const Solutions = searchLeg({
    runtime: State.runtime,
    worlds: State.runtime.worlds,
    activeBodies: getActiveTacticalBodies(State.runtime, 1, true),
    originIdentifier: OriginIdentifier,
    targetIdentifier: TargetIdentifier,
    launchStepIndex: 0,
    burnFlightSteps: WithBurn ? [30, 60, 96, 150, 210] : [null],
    maximumSolutions: 24,
  });
  Solutions.sort((First, Second) => First.steps - Second.steps);
  for (const Solution of Solutions) {
    const AimAngleDegrees = Math.atan2(Solution.velocity.y, Solution.velocity.x)
      * (180 / Math.PI);
    console.log(
      `surface ${(Solution.surfaceAngle * (180 / Math.PI)).toFixed(1).padStart(7)}deg`
      + ` aim ${AimAngleDegrees.toFixed(1).padStart(7)}deg`
      + ` speed ${(Solution.speedFraction * MaximumLaunchSpeed).toFixed(2).padStart(6)}`
      + ` steps ${String(Solution.steps).padStart(5)}`
      + (Solution.burnFlightStep ? ` burn@${Solution.burnFlightStep}` : '')
      + ` assists [${Solution.assistBodies.join(', ')}] (${Solution.assistPoints})`,
    );
  }
}

const Arguments = process.argv.slice(2);
if (Arguments[0] === '--probe') {
  probe(
    Arguments[3] && Arguments[3] !== '--burn' ? Arguments[3] : 'breaker-reach',
    Arguments[1],
    Arguments[2],
    Arguments.includes('--burn'),
  );
} else {
  const GoldenRoute = [
    { target: 'ember' },
    { target: 'grove' },
    { target: 'meadow', burn: true },
    { target: 'frost' },
    { target: 'grove' },
    { target: 'tide' },
    { target: 'glasswing' },
    { target: 'worldheart' },
  ];
  console.log('Solving golden completion route...');
  const GoldenState = solveRoute('breaker-reach', GoldenRoute);
  const GoldenFixture = serializeFixture(GoldenState, 1);
  const Serialized = JSON.stringify(GoldenFixture);
  const Validation = validateSerializedReplay(Serialized);
  if (!Validation.valid) {
    throw new Error(`Generated golden replay failed validation: ${Validation.reason}`);
  }
  console.log('Derived result:', Validation.result);
  writeFileSync(
    resolve(FixtureDirectory, 'breaker-reach-complete.v2.json'),
    `${JSON.stringify(GoldenFixture, null, 2)}\n`,
  );
  writeFileSync(
    resolve(FixtureDirectory, 'breaker-reach-complete.v2.result.json'),
    `${JSON.stringify(Validation.result, null, 2)}\n`,
  );

  console.log('\nSolving command-shortcut (must be rejected) route...');
  const ShortcutState = solveRoute('breaker-reach', [
    { target: 'ember' },
    { target: 'grove' },
    { target: 'tide' },
  ]);
  // A fourth launch that flies out of bounds; the claimed-complete replay must
  // then be rejected because it never legitimately reaches the Command World.
  const Tide = ShortcutState.runtime.worlds.find((World) => World.id === 'tide');
  const EscapeStep = ShortcutState.currentStepIndex + 1;
  ShortcutState.launches.push([
    EscapeStep,
    'tide',
    Tide.position.x + Tide.radius + RunnerRadius + SurfaceRestLift,
    Tide.position.y,
    MaximumLaunchSpeed,
    0,
    null,
  ]);
  const ShortcutFixture = serializeFixture(ShortcutState, 1);
  const ShortcutValidation = validateSerializedReplay(JSON.stringify(ShortcutFixture));
  if (ShortcutValidation.valid || !/Command World/.test(ShortcutValidation.reason)) {
    throw new Error(
      `Shortcut fixture must fail on the Command World check, got: ${ShortcutValidation.reason}`,
    );
  }
  console.log('Shortcut rejection reason:', ShortcutValidation.reason);
  writeFileSync(
    resolve(FixtureDirectory, 'breaker-reach-command-shortcut.v2.json'),
    `${JSON.stringify(ShortcutFixture, null, 2)}\n`,
  );
  console.log('\nFixtures written.');
}
