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
import { predictSlingshotEvents } from '../src/scoring.js';

const SeedRadius = 0.46;
const FixedStepSeconds = 1 / 120;
const MaximumTrajectoryPredictionSteps = 720;

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

function predictOpeningRoute(WorldDefinitions, TacticalBodyDefinitions, AngleDegrees, Speed) {
  const AngleRadians = AngleDegrees * (Math.PI / 180);
  return predictTrajectory(
    createOpeningPosition(WorldDefinitions),
    createVector(
      Math.cos(AngleRadians) * Speed,
      Math.sin(AngleRadians) * Speed,
      0,
    ),
    WorldDefinitions,
    {
      seedRadius: SeedRadius,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: MaximumTrajectoryPredictionSteps,
      ignoredWorldIdentifier: 'meadow',
      collisionBodyDefinitions: TacticalBodyDefinitions.filter(
        (BodyDefinition) => BodyDefinition.kind !== 'worldheart',
      ),
      startTimeSeconds: 0,
    },
  );
}

function calculateRestPosition(BodyDefinition, ImpactPosition) {
  const DeltaX = ImpactPosition.x - BodyDefinition.position.x;
  const DeltaY = ImpactPosition.y - BodyDefinition.position.y;
  const Distance = Math.hypot(DeltaX, DeltaY) || 1;
  const SurfaceDistance = BodyDefinition.radius + SeedRadius + 0.03;
  return createVector(
    BodyDefinition.position.x + ((DeltaX / Distance) * SurfaceDistance),
    BodyDefinition.position.y + ((DeltaY / Distance) * SurfaceDistance),
    0,
  );
}

test("Breaker\'s Reach offers a readable safe hop and a visible multi-world chain", () => {
  const Runtime = createAuthoredSystemRuntime(BreakerReachSystemDefinition, { createVector });
  const SafeRoute = predictOpeningRoute(Runtime.worlds, Runtime.tacticalBodies, 0, 6);
  const HighScoreRoute = predictOpeningRoute(
    Runtime.worlds,
    Runtime.tacticalBodies,
    16.5,
    MaximumLaunchSpeed,
  );
  const TripleChain = predictOpeningRoute(
    Runtime.worlds,
    Runtime.tacticalBodies,
    16,
    MaximumLaunchSpeed,
  );

  assert.equal(SafeRoute.collisionWorldIdentifier, 'ember');
  assert.ok(SafeRoute.points.length - 1 <= MaximumTrajectoryPredictionSteps);
  assert.equal(HighScoreRoute.collisionWorldIdentifier, 'tide');
  assert.ok(HighScoreRoute.collisionKind !== null);

  const AssistEvents = predictSlingshotEvents(HighScoreRoute.points, Runtime.worlds, {
    runnerRadius: SeedRadius,
    ignoredBodyIdentifier: 'meadow',
  });
  assert.deepEqual(
    AssistEvents.map((Event) => [Event.bodyIdentifier, Event.tier]),
    [['ember', 'assist'], ['grove', 'assist']],
  );
  assert.equal(
    AssistEvents.reduce((Total, Event) => Total + Event.points, 0),
    1050,
  );

  const TripleEvents = predictSlingshotEvents(TripleChain.points, Runtime.worlds, {
    runnerRadius: SeedRadius,
    ignoredBodyIdentifier: 'meadow',
  });
  assert.deepEqual(
    TripleEvents.map((Event) => Event.bodyIdentifier),
    ['ember', 'grove', 'tide'],
  );
});

test("Breaker\'s Reach near-max opening shot can chain Ember and Grove into Tide", () => {
  const Runtime = createAuthoredSystemRuntime(BreakerReachSystemDefinition, { createVector });
  const ChainRoute = predictOpeningRoute(
    Runtime.worlds,
    Runtime.tacticalBodies,
    16.5,
    MaximumLaunchSpeed,
  );

  assert.equal(ChainRoute.collisionWorldIdentifier, 'tide');
  const AssistEvents = predictSlingshotEvents(ChainRoute.points, Runtime.worlds, {
    runnerRadius: SeedRadius,
    ignoredBodyIdentifier: 'meadow',
  });
  assert.deepEqual(
    AssistEvents.map((Event) => Event.bodyIdentifier),
    ['ember', 'grove'],
  );
  assert.ok(AssistEvents.length >= 2);
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
    surfaceAngleDegrees: -140,
    launchAngleDegrees: 90,
    speed: 7.5,
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

  assert.equal(BurnRoute.collisionIdentifier, 'frost');
  assert.equal(BurnRoute.collisionStepIndex, 272);
  assert.equal(NoBurnRoute.collisionIdentifier, null);
  assert.equal(DefaultSurfaceRoute.collisionIdentifier, null);

  const Frost = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'frost');
  assert.ok(Frost.liberationValue > Ember.liberationValue);
});

test("Breaker\'s Reach has a deterministic four-launch completion route", () => {
  const Runtime = createAuthoredSystemRuntime(BreakerReachSystemDefinition, { createVector });
  const Route = [
    { source: 'meadow', target: 'ember', angle: 0 },
    { source: 'ember', target: 'grove', angle: 48 },
    { source: 'grove', target: 'tide', angle: 36 },
    { source: 'tide', target: 'worldheart', angle: -10 },
  ];
  let Position = createOpeningPosition(Runtime.worlds);
  let SimulationTimeSeconds = 0;

  for (const RouteStep of Route) {
    const AngleRadians = RouteStep.angle * (Math.PI / 180);
    const IsCommandStep = RouteStep.target === 'worldheart';
    const Prediction = predictTrajectory(
      Position,
      createVector(
        Math.cos(AngleRadians) * MaximumLaunchSpeed,
        Math.sin(AngleRadians) * MaximumLaunchSpeed,
        0,
      ),
      Runtime.worlds,
      {
        seedRadius: SeedRadius,
        fixedStepSeconds: FixedStepSeconds,
        maximumSteps: MaximumTrajectoryPredictionSteps,
        ignoredWorldIdentifier: RouteStep.source,
        collisionBodyDefinitions: Runtime.tacticalBodies.filter(
          (BodyDefinition) => BodyDefinition.kind !== 'worldheart' || IsCommandStep,
        ),
        startTimeSeconds: SimulationTimeSeconds,
      },
    );
    assert.equal(
      IsCommandStep
        ? Prediction.collisionBodyIdentifier
        : Prediction.collisionWorldIdentifier,
      RouteStep.target,
    );
    SimulationTimeSeconds += (Prediction.points.length - 1) * FixedStepSeconds;
    const TargetDefinition = IsCommandStep
      ? Runtime.tacticalBodies.find((BodyDefinition) => BodyDefinition.id === RouteStep.target)
      : Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === RouteStep.target);
    Position = calculateRestPosition(TargetDefinition, Prediction.points.at(-1));
  }

  assert.equal(Route.length, 4);
  assert.ok(Route.length < BreakerReachSystemDefinition.launchBudget);
});
