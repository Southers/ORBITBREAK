import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthoredSystemRuntime, getAuthoredSystemDefinition } from '../src/content.js';
import {
  calculateBodyPositionAtTime,
  createOrbitTrapState,
  createVector,
  getTacticalBodyCollisionRadius,
} from '../src/physics.js';
import { advanceSimulatedFlightStep } from '../src/flight-resolver.js';
import { createScoreState } from '../src/scoring.js';
import { RunnerRadius, SurfaceRestLift } from '../src/sim-constants.js';

function createBreakerReachRuntime() {
  return createAuthoredSystemRuntime(
    getAuthoredSystemDefinition('breaker-reach'),
    { createVector },
  );
}

function surfaceLaunchToward(world, toward, speed) {
  const DeltaX = toward.x - world.position.x;
  const DeltaY = toward.y - world.position.y;
  const Length = Math.hypot(DeltaX, DeltaY) || 1;
  const NormalX = DeltaX / Length;
  const NormalY = DeltaY / Length;
  const Rest = world.radius + RunnerRadius + SurfaceRestLift;
  return {
    position: createVector(
      world.position.x + (NormalX * Rest),
      world.position.y + (NormalY * Rest),
      0,
    ),
    velocity: createVector(NormalX * speed, NormalY * speed, 0),
  };
}

/**
 * Flies a live/ranked step until the throw lands, recaptures, or times out.
 * This is the playtest contract: aiming at exposed Command must settle.
 */
function flyTowardExposedCommand({
  originId,
  speed,
  startTimeSeconds = 8,
  maxSteps = 8000,
} = {}) {
  const Runtime = createBreakerReachRuntime();
  const Command = Runtime.tacticalBodies.find((Body) => Body.kind === 'worldheart');
  Command.routeAvailable = true;
  const Origin = Runtime.worlds.find((World) => World.id === originId);
  const CommandNow = calculateBodyPositionAtTime(Command, startTimeSeconds);
  const Launch = surfaceLaunchToward(Origin, CommandNow, speed);
  const TrapState = createOrbitTrapState();
  let PhysicsState = { position: Launch.position, velocity: Launch.velocity };
  let IgnoredWorldIdentifier = Origin.id;
  let ClosestCommandDistance = Infinity;
  for (let StepIndex = 1; StepIndex <= maxSteps; StepIndex += 1) {
    const SimulationTimeSeconds = startTimeSeconds + (StepIndex / 120);
    const StepResult = advanceSimulatedFlightStep({
      physicsState: PhysicsState,
      worlds: Runtime.worlds,
      tacticalBodies: [Command],
      stardust: [],
      scoreState: createScoreState(),
      fixedStepSeconds: 1 / 120,
      simulationTimeSeconds: SimulationTimeSeconds,
      ignoredWorldIdentifier: IgnoredWorldIdentifier,
      flightOriginWorldIdentifier: Origin.id,
      flightElapsedSteps: StepIndex,
      flightCollectedStardust: new Set(),
      outOfBoundsDistance: Runtime.camera?.outOfBoundsDistance ?? 34,
      orbitTrapState: TrapState,
    });
    PhysicsState = StepResult.physicsState;
    IgnoredWorldIdentifier = StepResult.ignoredWorldIdentifier;
    const CommandAtTime = calculateBodyPositionAtTime(Command, SimulationTimeSeconds);
    const CommandDistance = Math.hypot(
      PhysicsState.position.x - CommandAtTime.x,
      PhysicsState.position.y - CommandAtTime.y,
    );
    ClosestCommandDistance = Math.min(ClosestCommandDistance, CommandDistance);
    if (StepResult.collisionBody?.definition.kind === 'worldheart') {
      return {
        settled: true,
        outcome: 'command',
        steps: StepIndex,
        commandDistance: CommandDistance,
        closestCommandDistance: ClosestCommandDistance,
        catchRadius: getTacticalBodyCollisionRadius(Command) + RunnerRadius,
      };
    }
    const TrappedOnCommand = StepResult.orbitTrapped === true
      && (
        TrapState.skimWorldIdentifier === Command.id
        || TrapState.worldIdentifier === Command.id
      );
    if (TrappedOnCommand) {
      return {
        settled: true,
        outcome: 'command-recapture',
        steps: StepIndex,
        commandDistance: CommandDistance,
        closestCommandDistance: ClosestCommandDistance,
        catchRadius: getTacticalBodyCollisionRadius(Command) + RunnerRadius,
      };
    }
    if (StepResult.collisionWorld || StepResult.orbitTrapped || StepResult.outOfBounds) {
      return {
        settled: true,
        outcome: StepResult.collisionWorld?.id
          ?? (StepResult.orbitTrapped ? `trap:${TrapState.worldIdentifier}` : 'oob'),
        steps: StepIndex,
        commandDistance: CommandDistance,
        closestCommandDistance: ClosestCommandDistance,
        catchRadius: getTacticalBodyCollisionRadius(Command) + RunnerRadius,
      };
    }
  }
  return {
    settled: false,
    outcome: 'timeout',
    steps: maxSteps,
    closestCommandDistance: ClosestCommandDistance,
    catchRadius: getTacticalBodyCollisionRadius(Command) + RunnerRadius,
  };
}

test('a Glasswing throw aimed at exposed Command lands on Command', () => {
  const Flight = flyTowardExposedCommand({
    originId: 'glasswing',
    speed: 12,
    startTimeSeconds: 8,
  });
  assert.equal(Flight.settled, true);
  assert.equal(Flight.outcome, 'command');
  assert.ok(Flight.commandDistance <= Flight.catchRadius);
});

test('a Bastion near-miss that parked off Command still lands', () => {
  const Flight = flyTowardExposedCommand({
    originId: 'bastion',
    speed: 14,
    startTimeSeconds: 40,
  });
  assert.equal(Flight.settled, true);
  assert.equal(Flight.outcome, 'command');
  assert.ok(Flight.closestCommandDistance <= Flight.catchRadius);
});
