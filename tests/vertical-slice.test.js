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
  predictTrajectory,
  simulatePhysicsStep,
} from '../src/physics.js';
import { predictSlingshotEvents } from '../src/scoring.js';

const SeedRadius = 0.46;
const FixedStepSeconds = 1 / 120;
const RankedPredictionVisibleSteps = 160;

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

  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
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
      maximumSteps: 520,
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

test("Breaker\'s Reach offers a readable safe route and a hidden high-score route", () => {
  const Runtime = createAuthoredSystemRuntime(BreakerReachSystemDefinition, { createVector });
  const SafeRoute = predictOpeningRoute(Runtime.worlds, Runtime.tacticalBodies, 0, 6);
  const HighScoreRoute = predictOpeningRoute(Runtime.worlds, Runtime.tacticalBodies, 25, 11.5);

  assert.equal(SafeRoute.collisionWorldIdentifier, 'ember');
  assert.ok(SafeRoute.points.length - 1 <= RankedPredictionVisibleSteps);
  assert.equal(HighScoreRoute.collisionWorldIdentifier, 'tide');
  assert.ok(HighScoreRoute.points.length - 1 > RankedPredictionVisibleSteps);

  const AssistEvents = predictSlingshotEvents(HighScoreRoute.points, Runtime.worlds, {
    runnerRadius: SeedRadius,
    ignoredBodyIdentifier: 'meadow',
  });
  assert.deepEqual(
    AssistEvents.map((Event) => [Event.bodyIdentifier, Event.tier]),
    [['ember', 'razor'], ['grove', 'razor']],
  );
  assert.equal(
    AssistEvents.reduce((Total, Event) => Total + Event.points, 0),
    3150,
  );
});

test("Breaker\'s Reach dark-rim route requires repositioning and a timed Burn", () => {
  const Runtime = createAuthoredSystemRuntime(BreakerReachSystemDefinition, { createVector });
  const RouteInput = {
    surfaceAngleDegrees: -115,
    launchAngleDegrees: 80,
    speed: 6.8,
    burnStepIndex: 50,
  };
  const BurnRoute = simulateOpeningBurnRoute(Runtime, RouteInput);
  const NoBurnRoute = simulateOpeningBurnRoute(Runtime, {
    ...RouteInput,
    burnStepIndex: null,
  });
  const DefaultSurfaceRoute = simulateOpeningBurnRoute(Runtime, {
    ...RouteInput,
    surfaceAngleDegrees: 4.0856,
  });

  assert.deepEqual(BurnRoute, {
    collisionIdentifier: 'frost',
    collisionStepIndex: 258,
    collectedStardustIdentifiers: ['breaker-arc-2'],
  });
  assert.equal(NoBurnRoute.collisionIdentifier, null);
  assert.equal(DefaultSurfaceRoute.collisionIdentifier, null);

  const Frost = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'frost');
  const Ember = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'ember');
  assert.ok(Frost.liberationValue > Ember.liberationValue);
});

test("Breaker\'s Reach has a deterministic four-launch completion route", () => {
  const Runtime = createAuthoredSystemRuntime(BreakerReachSystemDefinition, { createVector });
  const Route = [
    { source: 'meadow', target: 'ember', angle: 2 },
    { source: 'ember', target: 'grove', angle: 2 },
    { source: 'grove', target: 'tide', angle: 8 },
    { source: 'tide', target: 'worldheart', angle: 49 },
  ];
  let Position = createOpeningPosition(Runtime.worlds);
  let SimulationTimeSeconds = 0;

  for (const RouteStep of Route) {
    const AngleRadians = RouteStep.angle * (Math.PI / 180);
    const IsCommandStep = RouteStep.target === 'worldheart';
    const Prediction = predictTrajectory(
      Position,
      createVector(
        Math.cos(AngleRadians) * 18.25,
        Math.sin(AngleRadians) * 18.25,
        0,
      ),
      Runtime.worlds,
      {
        seedRadius: SeedRadius,
        fixedStepSeconds: FixedStepSeconds,
        maximumSteps: 520,
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
