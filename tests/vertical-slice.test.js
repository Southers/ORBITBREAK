import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BreakerReachSystemDefinition,
  createAuthoredSystemRuntime,
} from '../src/content.js';
import {
  applyBreakerBurn,
  calculateDistanceSquared,
  createVector,
  findCollidingBody,
  findCollidingWorld,
  MaximumLaunchSpeed,
  predictTrajectory,
  simulatePhysicsStep,
} from '../src/physics.js';
import { validateSerializedReplay } from '../src/replay-validator.js';
import { predictSlingshotEvents } from '../src/scoring.js';
import { loadReplayFixture, loadSerializedReplayFixture } from './fixtures/load-fixture.js';

const SeedRadius = 0.46;
const FixedStepSeconds = 1 / 120;
const MaximumTrajectoryPredictionSteps = 7200;

function createOpeningPosition(WorldDefinitions) {
  const Haven = WorldDefinitions.find((WorldDefinition) => WorldDefinition.id === 'meadow');
  const Ember = WorldDefinitions.find((WorldDefinition) => WorldDefinition.id === 'ember');
  const DeltaX = Ember.position.x - Haven.position.x;
  const DeltaY = Ember.position.y - Haven.position.y;
  const Distance = Math.hypot(DeltaX, DeltaY);
  const SurfaceDistance = Haven.radius + SeedRadius + 0.03;
  return createVector(
    Haven.position.x + ((DeltaX / Distance) * SurfaceDistance),
    Haven.position.y + ((DeltaY / Distance) * SurfaceDistance),
    0,
  );
}

function createSurfacePosition(BodyDefinition, AngleDegrees) {
  const AngleRadians = AngleDegrees * (Math.PI / 180);
  return createVector(
    BodyDefinition.position.x
      + (Math.cos(AngleRadians) * (BodyDefinition.radius + SeedRadius + 0.03)),
    BodyDefinition.position.y
      + (Math.sin(AngleRadians) * (BodyDefinition.radius + SeedRadius + 0.03)),
    0,
  );
}

function simulateOpeningBurnRoute(Runtime, {
  surfaceAngleDegrees,
  launchAngleDegrees,
  speed,
  burnStepIndex = null,
}) {
  const Haven = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'meadow');
  const StartPosition = createSurfacePosition(Haven, surfaceAngleDegrees);
  const LaunchAngleRadians = launchAngleDegrees * (Math.PI / 180);
  let PhysicsState = {
    position: StartPosition,
    velocity: createVector(
      Math.cos(LaunchAngleRadians) * speed,
      Math.sin(LaunchAngleRadians) * speed,
      0,
    ),
  };
  let IgnoredWorldIdentifier = Haven.id;
  const CollectedStardustIdentifiers = new Set();
  const TacticalBodies = Runtime.tacticalBodies.filter(
    (BodyDefinition) => BodyDefinition.kind !== 'worldheart',
  );

  for (let StepIndex = 1; StepIndex <= MaximumTrajectoryPredictionSteps; StepIndex += 1) {
    if (StepIndex === burnStepIndex) PhysicsState = applyBreakerBurn(PhysicsState);
    PhysicsState = simulatePhysicsStep(
      PhysicsState,
      Runtime.worlds,
      FixedStepSeconds,
    );
    if (
      IgnoredWorldIdentifier
      && calculateDistanceSquared(PhysicsState.position, Haven.position)
        > (Haven.radius + SeedRadius + 0.35) ** 2
    ) {
      IgnoredWorldIdentifier = null;
    }
    for (const StardustDefinition of Runtime.stardust) {
      if (
        calculateDistanceSquared(PhysicsState.position, StardustDefinition.position)
          <= (SeedRadius + 0.22) ** 2
      ) {
        CollectedStardustIdentifiers.add(StardustDefinition.id);
      }
    }
    const CollisionWorld = findCollidingWorld(
      PhysicsState.position,
      SeedRadius,
      Runtime.worlds,
      IgnoredWorldIdentifier,
    );
    const CollisionBody = findCollidingBody(
      PhysicsState.position,
      SeedRadius,
      TacticalBodies,
      StepIndex * FixedStepSeconds,
    );
    if (CollisionWorld || CollisionBody) {
      return {
        collisionIdentifier: CollisionBody?.definition.id ?? CollisionWorld.id,
        collisionStepIndex: StepIndex,
        collectedStardustIdentifiers: [...CollectedStardustIdentifiers],
      };
    }
  }
  return {
    collisionIdentifier: null,
    collisionStepIndex: null,
    collectedStardustIdentifiers: [...CollectedStardustIdentifiers],
  };
}

function predictLaunch(Runtime, StartPosition, AngleDegrees, Speed, {
  includeWorldheart = false,
} = {}) {
  const AngleRadians = AngleDegrees * (Math.PI / 180);
  return predictTrajectory(
    StartPosition,
    createVector(
      Math.cos(AngleRadians) * Speed,
      Math.sin(AngleRadians) * Speed,
      0,
    ),
    Runtime.worlds,
    {
      seedRadius: SeedRadius,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: MaximumTrajectoryPredictionSteps,
      ignoredWorldIdentifier: 'meadow',
      collisionBodyDefinitions: Runtime.tacticalBodies.filter(
        (BodyDefinition) => BodyDefinition.kind !== 'worldheart' || includeWorldheart,
      ),
      startTimeSeconds: 0,
    },
  );
}

function calculateRadialAngleDegrees(Origin, Target) {
  return Math.atan2(
    Target.position.y - Origin.position.y,
    Target.position.x - Origin.position.x,
  ) * (180 / Math.PI);
}

test("Breaker\'s Reach offers a readable safe hop and a gravity-bent chain to Tide", () => {
  const Runtime = createAuthoredSystemRuntime(BreakerReachSystemDefinition, { createVector });
  const Haven = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'meadow');
  const Ember = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'ember');

  // The opening hop is a quick, readable radial shot.
  const SafeRoute = predictLaunch(
    Runtime,
    createOpeningPosition(Runtime.worlds),
    calculateRadialAngleDegrees(Haven, Ember),
    9,
  );
  assert.equal(SafeRoute.collisionWorldIdentifier, 'ember');
  assert.ok(SafeRoute.points.length - 1 <= 300);

  // Tide only falls to a full-power shot that bends through Frost and Bastion.
  const ChainRoute = predictLaunch(
    Runtime,
    createSurfacePosition(Haven, 12),
    42.1,
    MaximumLaunchSpeed,
  );
  assert.equal(ChainRoute.collisionWorldIdentifier, 'tide');

  const AssistEvents = predictSlingshotEvents(ChainRoute.points, Runtime.worlds, {
    runnerRadius: SeedRadius,
    ignoredBodyIdentifier: 'meadow',
  });
  assert.deepEqual(
    AssistEvents.map((Event) => Event.bodyIdentifier),
    ['frost', 'bastion'],
  );
  assert.ok(AssistEvents.reduce((Total, Event) => Total + Event.points, 0) > 0);
});

test("Breaker\'s Reach further-reach worlds refuse direct max-power shots from Haven", () => {
  const Runtime = createAuthoredSystemRuntime(BreakerReachSystemDefinition, { createVector });
  const Haven = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'meadow');
  const Worldheart = Runtime.tacticalBodies.find(
    (BodyDefinition) => BodyDefinition.kind === 'worldheart',
  );
  const FarTargets = [
    ...['tide', 'spindle', 'quarry', 'mirage'].map(
      (Identifier) => Runtime.worlds.find(
        (WorldDefinition) => WorldDefinition.id === Identifier,
      ),
    ),
    Worldheart,
  ];

  for (const Target of FarTargets) {
    const RadialAngleDegrees = calculateRadialAngleDegrees(Haven, Target);
    const DirectShot = predictLaunch(
      Runtime,
      createSurfacePosition(Haven, RadialAngleDegrees),
      RadialAngleDegrees,
      MaximumLaunchSpeed,
      { includeWorldheart: true },
    );
    const LandedIdentifier = DirectShot.collisionWorldIdentifier
      ?? DirectShot.collisionBodyIdentifier;
    assert.notEqual(
      LandedIdentifier,
      Target.id,
      `A direct max-power shot must not reach ${Target.id}; gravity assists are mandatory.`,
    );
  }
});

test("Breaker\'s Reach dark-rim route requires repositioning and a timed Burn", () => {
  const Runtime = createAuthoredSystemRuntime(BreakerReachSystemDefinition, { createVector });
  const Haven = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'meadow');
  const Ember = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'ember');
  const OpeningSurfaceAngleDegrees = Math.atan2(
    Ember.position.y - Haven.position.y,
    Ember.position.x - Haven.position.x,
  ) * (180 / Math.PI);
  const RouteInput = {
    surfaceAngleDegrees: 54,
    launchAngleDegrees: 42,
    speed: 11.5,
    burnStepIndex: 30,
  };
  const BurnRoute = simulateOpeningBurnRoute(Runtime, RouteInput);
  const NoBurnRoute = simulateOpeningBurnRoute(Runtime, {
    ...RouteInput,
    burnStepIndex: null,
  });
  const DefaultSurfaceRoute = simulateOpeningBurnRoute(Runtime, {
    ...RouteInput,
    surfaceAngleDegrees: OpeningSurfaceAngleDegrees,
  });

  assert.equal(BurnRoute.collisionIdentifier, 'quarry');
  assert.equal(BurnRoute.collisionStepIndex, 2820);
  assert.notEqual(NoBurnRoute.collisionIdentifier, 'quarry');
  assert.notEqual(DefaultSurfaceRoute.collisionIdentifier, 'quarry');

  const Quarry = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'quarry');
  assert.ok(Quarry.liberationValue > Ember.liberationValue);
});

test("Breaker\'s Reach has a deterministic slingshot completion route within budget", () => {
  const GoldenReplay = loadSerializedReplayFixture('breaker-reach-complete.v2.json');
  const ExpectedResult = loadReplayFixture('breaker-reach-complete.v2.result.json');
  const Validation = validateSerializedReplay(GoldenReplay);

  assert.equal(Validation.valid, true);
  assert.deepEqual(Validation.result, ExpectedResult);
  assert.equal(Validation.result.contentVersion, BreakerReachSystemDefinition.contentVersion);
  // Completion is possible inside the launch budget, but never as a short
  // direct sprint: the route must weave the sector's gravity wells.
  assert.ok(Validation.result.launchesUsed <= BreakerReachSystemDefinition.launchBudget);
  assert.ok(Validation.result.launchesUsed >= 6);
  assert.ok(Validation.result.slingshotScore > 0);
});
