import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BreakerReachSystemDefinition,
  createAuthoredSystemRuntime,
} from '../src/content.js';
import { createVector, predictTrajectory } from '../src/physics.js';
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
