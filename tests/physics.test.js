import test from 'node:test';
import assert from 'node:assert/strict';

import { getTrajectoryPickupIdentifiers } from '../src/campaign.js';
import {
  BrokenBeltSystemDefinition,
  LongNightSystemDefinition,
  WorldheartSystemDefinition,
  WanderingGardenSystemDefinition,
  createAuthoredSystemRuntime,
} from '../src/content.js';

import {
  calculateBodyPositionAtTime,
  calculateDistanceSquared,
  calculateGravityAcceleration,
  createVector,
  findCollidingBody,
  findCollidingWorld,
  predictTrajectory,
  simulatePhysicsStep,
} from '../src/physics.js';
import { predictSlingshotEvents } from '../src/scoring.js';

/**
 * The tests below lock the core jam mechanic before visual work begins. They deliberately
 * validate behaviour rather than exact floating-point implementation details.
 */

test('gravity accelerates the seed toward a world', () => {
  const GravityAcceleration = calculateGravityAcceleration(
    { x: 10, y: 0, z: 0 },
    [{
      position: { x: 0, y: 0, z: 0 },
      gravitationalParameter: 100,
    }],
  );

  assert.ok(GravityAcceleration.x < 0, 'Gravity should pull toward the world centre.');
  assert.equal(GravityAcceleration.y, 0);
  assert.equal(GravityAcceleration.z, 0);
});

test('collision expands the world radius by the seed radius', () => {
  const WorldDefinitions = [{
    id: 'meadow',
    position: { x: 0, y: 0, z: 0 },
    radius: 4,
    gravitationalParameter: 100,
  }];

  assert.equal(
    findCollidingWorld({ x: 4.4, y: 0, z: 0 }, 0.5, WorldDefinitions)?.id,
    'meadow',
  );
  assert.equal(
    findCollidingWorld({ x: 4.6, y: 0, z: 0 }, 0.5, WorldDefinitions),
    null,
  );
});

test('trajectory prediction reports a world landing', () => {
  const WorldDefinitions = [
    {
      id: 'origin',
      position: { x: -8, y: 0, z: 0 },
      radius: 2.5,
      gravitationalParameter: 30,
    },
    {
      id: 'target',
      position: { x: 8, y: 0, z: 0 },
      radius: 2.5,
      gravitationalParameter: 30,
    },
  ];

  const TrajectoryPrediction = predictTrajectory(
    { x: -5, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    WorldDefinitions,
    {
      seedRadius: 0.45,
      fixedStepSeconds: 1 / 120,
      maximumSteps: 360,
      ignoredWorldIdentifier: 'origin',
    },
  );

  assert.equal(TrajectoryPrediction.collisionWorldIdentifier, 'target');
  assert.ok(TrajectoryPrediction.points.length > 2);
});

test('orbiting body positions are a deterministic function of simulation time', () => {
  const AsteroidDefinition = {
    id: 'wayfarer',
    radius: 0.55,
    orbit: {
      centre: createVector(2, -1, 0),
      radius: 4,
      phaseRadians: Math.PI / 2,
      angularSpeedRadiansPerSecond: Math.PI / 2,
    },
  };

  const StartingAsteroidPosition = calculateBodyPositionAtTime(AsteroidDefinition, 0);
  assert.ok(Math.abs(StartingAsteroidPosition.x - 2) < 0.000001);
  assert.ok(Math.abs(StartingAsteroidPosition.y - 3) < 0.000001);
  assert.equal(StartingAsteroidPosition.z, 0);
  const HalfSecondPosition = calculateBodyPositionAtTime(AsteroidDefinition, 0.5);
  assert.ok(Math.abs(HalfSecondPosition.x - (2 - Math.sqrt(8))) < 0.000001);
  assert.ok(Math.abs(HalfSecondPosition.y - (-1 + Math.sqrt(8))) < 0.000001);
});

test('prediction and live flight hit a moving asteroid on the same fixed step', () => {
  const FixedStepSeconds = 1 / 120;
  const SeedRadius = 0.2;
  const AsteroidDefinitions = [{
    id: 'wayfarer',
    kind: 'hazard',
    radius: 0.3,
    orbit: {
      centre: createVector(0, 0, 0),
      radius: 2,
      phaseRadians: Math.PI,
      angularSpeedRadiansPerSecond: 0.1,
    },
  }];
  const StartingPosition = createVector(-5, 0, 0);
  const StartingVelocity = createVector(3, 0, 0);

  const Prediction = predictTrajectory(
    StartingPosition,
    StartingVelocity,
    [],
    {
      seedRadius: SeedRadius,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 240,
      ignoredWorldIdentifier: null,
      collisionBodyDefinitions: AsteroidDefinitions,
      startTimeSeconds: 0,
    },
  );

  let LiveState = { position: StartingPosition, velocity: StartingVelocity };
  let LiveCollision = null;
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 240; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, [], FixedStepSeconds);
    LiveCollision = findCollidingBody(
      LiveState.position,
      SeedRadius,
      AsteroidDefinitions,
      StepIndex * FixedStepSeconds,
    );
    if (LiveCollision) {
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(Prediction.collisionKind, 'hazard');
  assert.equal(Prediction.collisionBodyIdentifier, 'wayfarer');
  assert.equal(LiveCollision?.definition.id, 'wayfarer');
  assert.equal(LiveCollisionStep, Prediction.points.length - 1);
});

test('First Light Seedstone is reachable with matching prediction and live flight', () => {
  const FixedStepSeconds = 1 / 120;
  const SeedRadius = 0.46;
  const WorldDefinitions = [
    { id: 'meadow', position: createVector(-8, -6.4, 0), radius: 3.35, gravitationalParameter: 92 },
    { id: 'ember', position: createVector(7.8, -3.3, 0), radius: 3, gravitationalParameter: 82 },
    { id: 'grove', position: createVector(-8.8, 3, 0), radius: 2.05, gravitationalParameter: 44 },
    { id: 'frost', position: createVector(0.7, 8, 0), radius: 3.55, gravitationalParameter: 102 },
    { id: 'tide', position: createVector(9.7, 6, 0), radius: 2.15, gravitationalParameter: 48 },
  ];
  const SeedstoneDefinitions = [{
    id: 'seedstone',
    kind: 'seedstone',
    position: createVector(0.15, -0.55, 0),
    radius: 0.72,
  }];
  const MeadowToEmber = createVector(15.8, 3.1, 0);
  const MeadowToEmberLength = Math.hypot(MeadowToEmber.x, MeadowToEmber.y);
  const SurfaceDistance = WorldDefinitions[0].radius + SeedRadius + 0.03;
  const StartingPosition = createVector(
    WorldDefinitions[0].position.x + ((MeadowToEmber.x / MeadowToEmberLength) * SurfaceDistance),
    WorldDefinitions[0].position.y + ((MeadowToEmber.y / MeadowToEmberLength) * SurfaceDistance),
    0,
  );
  const LaunchAngleRadians = 20 * (Math.PI / 180);
  const LaunchVelocity = createVector(
    Math.cos(LaunchAngleRadians) * 4.25,
    Math.sin(LaunchAngleRadians) * 4.25,
    0,
  );

  const Prediction = predictTrajectory(
    StartingPosition,
    LaunchVelocity,
    WorldDefinitions,
    {
      seedRadius: SeedRadius,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'meadow',
      collisionBodyDefinitions: SeedstoneDefinitions,
      startTimeSeconds: 0,
    },
  );

  let LiveState = { position: StartingPosition, velocity: LaunchVelocity };
  let IgnoredWorldIdentifier = 'meadow';
  let LiveCollision = null;
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, WorldDefinitions, FixedStepSeconds);
    if (IgnoredWorldIdentifier) {
      const ClearDistance = WorldDefinitions[0].radius + SeedRadius + 0.35;
      if (
        calculateDistanceSquared(LiveState.position, WorldDefinitions[0].position)
        > (ClearDistance * ClearDistance)
      ) {
        IgnoredWorldIdentifier = null;
      }
    }
    LiveCollision = findCollidingBody(
      LiveState.position,
      SeedRadius,
      SeedstoneDefinitions,
      StepIndex * FixedStepSeconds,
    );
    if (LiveCollision) {
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(Prediction.collisionKind, 'seedstone');
  assert.equal(Prediction.collisionBodyIdentifier, 'seedstone');
  assert.equal(LiveCollision?.definition.id, 'seedstone');
  assert.equal(LiveCollisionStep, Prediction.points.length - 1);
});

test('an orbiting launch node lands on the same fixed step in prediction and live flight', () => {
  const FixedStepSeconds = 1 / 120;
  const SeedRadius = 0.46;
  const MovingMoonDefinitions = [{
    id: 'pollen-moon',
    kind: 'seedstone',
    position: createVector(2, 0, 0),
    radius: 0.62,
    orbit: {
      centre: createVector(0, 0, 0),
      radius: 2,
      phaseRadians: 0,
      angularSpeedRadiansPerSecond: 0.25,
    },
  }];
  const StartingPosition = createVector(2, -5, 0);
  const LaunchVelocity = createVector(0, 2.25, 0);

  const Prediction = predictTrajectory(StartingPosition, LaunchVelocity, [], {
    seedRadius: SeedRadius,
    fixedStepSeconds: FixedStepSeconds,
    maximumSteps: 520,
    collisionBodyDefinitions: MovingMoonDefinitions,
    startTimeSeconds: 0,
  });

  let LiveState = { position: StartingPosition, velocity: LaunchVelocity };
  let LiveCollision = null;
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, [], FixedStepSeconds);
    LiveCollision = findCollidingBody(
      LiveState.position,
      SeedRadius,
      MovingMoonDefinitions,
      StepIndex * FixedStepSeconds,
    );
    if (LiveCollision) {
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(Prediction.collisionKind, 'seedstone');
  assert.equal(Prediction.collisionBodyIdentifier, 'pollen-moon');
  assert.equal(LiveCollision?.definition.id, 'pollen-moon');
  assert.equal(LiveCollisionStep, Prediction.points.length - 1);
});

test('the authored First Light Arc collects all stardust and lands on Frost', () => {
  const WorldDefinitions = [
    { id: 'meadow', position: createVector(-8, -6.4, 0), radius: 3.35, gravitationalParameter: 92 },
    { id: 'ember', position: createVector(7.8, -3.3, 0), radius: 3, gravitationalParameter: 82 },
    { id: 'grove', position: createVector(-8.8, 3, 0), radius: 2.05, gravitationalParameter: 44 },
    { id: 'frost', position: createVector(0.7, 8, 0), radius: 3.55, gravitationalParameter: 102 },
    { id: 'tide', position: createVector(9.7, 6, 0), radius: 2.15, gravitationalParameter: 48 },
  ];
  const TacticalBodyDefinitions = [
    {
      id: 'seedstone',
      kind: 'seedstone',
      position: createVector(0.15, -0.55, 0),
      radius: 0.72,
    },
    {
      id: 'wayfarer',
      kind: 'hazard',
      radius: 0.66,
      orbit: {
        centre: createVector(0.7, 8, 0),
        radius: 5.35,
        phaseRadians: -1.18,
        angularSpeedRadiansPerSecond: 0.34,
      },
    },
  ];
  const StardustDefinitions = [
    { id: 'first-light-arc-1', position: createVector(-1.56, -2.72, 0), collected: false },
    { id: 'first-light-arc-2', position: createVector(-1.20, -0.45, 0), collected: false },
    { id: 'first-light-arc-3', position: createVector(-0.99, 1.45, 0), collected: false },
  ];
  const MeadowToEmber = createVector(15.8, 3.1, 0);
  const MeadowToEmberLength = Math.hypot(MeadowToEmber.x, MeadowToEmber.y);
  const StartingPosition = createVector(
    -8 + ((MeadowToEmber.x / MeadowToEmberLength) * (3.35 + 0.46 + 0.03)),
    -6.4 + ((MeadowToEmber.y / MeadowToEmberLength) * (3.35 + 0.46 + 0.03)),
    0,
  );
  const LaunchAngleRadians = 23 * (Math.PI / 180);
  const Prediction = predictTrajectory(
    StartingPosition,
    createVector(
      Math.cos(LaunchAngleRadians) * 4.125,
      Math.sin(LaunchAngleRadians) * 4.125,
      0,
    ),
    WorldDefinitions,
    {
      seedRadius: 0.46,
      fixedStepSeconds: 1 / 120,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'meadow',
      collisionBodyDefinitions: TacticalBodyDefinitions,
      startTimeSeconds: 0,
    },
  );

  assert.equal(Prediction.collisionWorldIdentifier, 'frost');
  assert.deepEqual(
    getTrajectoryPickupIdentifiers(Prediction.points, StardustDefinitions, 0.68).sort(),
    StardustDefinitions.map((StardustDefinition) => StardustDefinition.id).sort(),
  );
});

test('the authored Frost exit reaches the unlocked Worldheart deterministically', () => {
  const FixedStepSeconds = 1 / 120;
  const WorldDefinitions = [
    { id: 'meadow', position: createVector(-8, -6.4, 0), radius: 3.35, gravitationalParameter: 92 },
    { id: 'ember', position: createVector(7.8, -3.3, 0), radius: 3, gravitationalParameter: 82 },
    { id: 'grove', position: createVector(-8.8, 3, 0), radius: 2.05, gravitationalParameter: 44 },
    { id: 'frost', position: createVector(0.7, 8, 0), radius: 3.55, gravitationalParameter: 102 },
    { id: 'tide', position: createVector(9.7, 6, 0), radius: 2.15, gravitationalParameter: 48 },
  ];
  const TacticalBodyDefinitions = [
    {
      id: 'wayfarer',
      kind: 'hazard',
      radius: 0.66,
      orbit: {
        centre: createVector(0.7, 8, 0),
        radius: 5.35,
        phaseRadians: -1.18,
        angularSpeedRadiansPerSecond: 0.34,
      },
    },
    {
      id: 'worldheart',
      kind: 'worldheart',
      position: createVector(-4.35, 8.75, 0),
      radius: 0.9,
    },
  ];
  const StartingPosition = createVector(-0.5689926623506649, 4.164474270337876, 0);
  const LaunchAngleRadians = 22 * (Math.PI / 180);
  const LaunchVelocity = createVector(
    Math.cos(LaunchAngleRadians) * 5.25,
    Math.sin(LaunchAngleRadians) * 5.25,
    0,
  );
  const StartTimeSeconds = 8;
  const Prediction = predictTrajectory(
    StartingPosition,
    LaunchVelocity,
    WorldDefinitions,
    {
      seedRadius: 0.46,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'frost',
      collisionBodyDefinitions: TacticalBodyDefinitions,
      startTimeSeconds: StartTimeSeconds,
    },
  );

  let LiveState = { position: StartingPosition, velocity: LaunchVelocity };
  let LiveCollision = null;
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, WorldDefinitions, FixedStepSeconds);
    LiveCollision = findCollidingBody(
      LiveState.position,
      0.46,
      TacticalBodyDefinitions,
      StartTimeSeconds + (StepIndex * FixedStepSeconds),
    );
    if (LiveCollision) {
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(Prediction.collisionKind, 'worldheart');
  assert.equal(Prediction.collisionBodyIdentifier, 'worldheart');
  assert.equal(LiveCollision?.definition.id, 'worldheart');
  assert.equal(LiveCollisionStep, Prediction.points.length - 1);
});

test('waiting changes an authored Tide-to-Frost asteroid shot from danger to landing', () => {
  const WorldDefinitions = [
    { id: 'meadow', position: createVector(-8, -6.4, 0), radius: 3.35, gravitationalParameter: 92 },
    { id: 'ember', position: createVector(7.8, -3.3, 0), radius: 3, gravitationalParameter: 82 },
    { id: 'grove', position: createVector(-8.8, 3, 0), radius: 2.05, gravitationalParameter: 44 },
    { id: 'frost', position: createVector(0.7, 8, 0), radius: 3.55, gravitationalParameter: 102 },
    { id: 'tide', position: createVector(9.7, 6, 0), radius: 2.15, gravitationalParameter: 48 },
  ];
  const AsteroidDefinitions = [{
    id: 'wayfarer',
    kind: 'hazard',
    radius: 0.66,
    orbit: {
      centre: createVector(0.7, 8, 0),
      radius: 5.35,
      phaseRadians: -1.18,
      angularSpeedRadiansPerSecond: 0.34,
    },
  }];
  const TideToFrost = createVector(-9, 2, 0);
  const TideToFrostLength = Math.hypot(TideToFrost.x, TideToFrost.y);
  const StartingPosition = createVector(
    9.7 + ((TideToFrost.x / TideToFrostLength) * (2.15 + 0.46 + 0.03)),
    6 + ((TideToFrost.y / TideToFrostLength) * (2.15 + 0.46 + 0.03)),
    0,
  );
  const LaunchAngleRadians = 4 * (Math.PI / 180);
  const LaunchVelocity = createVector(
    Math.cos(LaunchAngleRadians) * 4.75,
    Math.sin(LaunchAngleRadians) * 4.75,
    0,
  );
  const createPredictionSettings = (StartTimeSeconds) => ({
    seedRadius: 0.46,
    fixedStepSeconds: 1 / 120,
    maximumSteps: 520,
    ignoredWorldIdentifier: 'tide',
    collisionBodyDefinitions: AsteroidDefinitions,
    startTimeSeconds: StartTimeSeconds,
  });

  const ImmediatePrediction = predictTrajectory(
    StartingPosition,
    LaunchVelocity,
    WorldDefinitions,
    createPredictionSettings(0),
  );
  const WaitedPrediction = predictTrajectory(
    StartingPosition,
    LaunchVelocity,
    WorldDefinitions,
    createPredictionSettings(4),
  );

  assert.equal(ImmediatePrediction.collisionKind, 'hazard');
  assert.equal(ImmediatePrediction.collisionBodyIdentifier, 'wayfarer');
  assert.equal(WaitedPrediction.collisionKind, 'world');
  assert.equal(WaitedPrediction.collisionWorldIdentifier, 'frost');
});

test('the opening Meadow shot predicts and reaches Ember on the same fixed step', () => {
  const SeedRadius = 0.46;
  const FixedStepSeconds = 1 / 120;
  const WorldDefinitions = [
    {
      id: 'meadow',
      position: createVector(-8, -6.4, 0),
      radius: 3.35,
      gravitationalParameter: 92,
    },
    {
      id: 'ember',
      position: createVector(7.8, -3.3, 0),
      radius: 3,
      gravitationalParameter: 82,
    },
    {
      id: 'frost',
      position: createVector(0.7, 8, 0),
      radius: 3.55,
      gravitationalParameter: 102,
    },
    {
      id: 'grove',
      position: createVector(-8.8, 3, 0),
      radius: 2.05,
      gravitationalParameter: 44,
    },
    {
      id: 'tide',
      position: createVector(9.7, 6, 0),
      radius: 2.15,
      gravitationalParameter: 48,
    },
  ];
  const MeadowToEmber = createVector(15.8, 3.1, 0);
  const MeadowToEmberLength = Math.hypot(MeadowToEmber.x, MeadowToEmber.y);
  const SurfaceDistance = WorldDefinitions[0].radius + SeedRadius + 0.03;
  const StartingPosition = createVector(
    WorldDefinitions[0].position.x + ((MeadowToEmber.x / MeadowToEmberLength) * SurfaceDistance),
    WorldDefinitions[0].position.y + ((MeadowToEmber.y / MeadowToEmberLength) * SurfaceDistance),
    0,
  );
  const OpeningVelocity = createVector(
    (MeadowToEmber.x / MeadowToEmberLength) * 8.85,
    (MeadowToEmber.y / MeadowToEmberLength) * 8.85,
    0,
  );

  const Prediction = predictTrajectory(
    StartingPosition,
    OpeningVelocity,
    WorldDefinitions,
    {
      seedRadius: SeedRadius,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'meadow',
    },
  );

  let LiveState = { position: StartingPosition, velocity: OpeningVelocity };
  let IgnoredWorldIdentifier = 'meadow';
  let LiveCollision = null;
  let LiveCollisionStep = null;

  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, WorldDefinitions, FixedStepSeconds);
    if (IgnoredWorldIdentifier) {
      const ClearDistance = WorldDefinitions[0].radius + SeedRadius + 0.35;
      if (
        calculateDistanceSquared(LiveState.position, WorldDefinitions[0].position)
        > (ClearDistance * ClearDistance)
      ) {
        IgnoredWorldIdentifier = null;
      }
    }
    LiveCollision = findCollidingWorld(
      LiveState.position,
      SeedRadius,
      WorldDefinitions,
      IgnoredWorldIdentifier,
    );
    if (LiveCollision) {
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(Prediction.collisionWorldIdentifier, 'ember');
  assert.equal(LiveCollision?.id, 'ember');
  assert.equal(LiveCollisionStep, Prediction.points.length - 1);
});

test('the alternate Meadow shot predicts and reaches Grove on the same fixed step', () => {
  const SeedRadius = 0.46;
  const FixedStepSeconds = 1 / 120;
  const WorldDefinitions = [
    {
      id: 'meadow',
      position: createVector(-8, -6.4, 0),
      radius: 3.35,
      gravitationalParameter: 92,
    },
    {
      id: 'ember',
      position: createVector(7.8, -3.3, 0),
      radius: 3,
      gravitationalParameter: 82,
    },
    {
      id: 'frost',
      position: createVector(0.7, 8, 0),
      radius: 3.55,
      gravitationalParameter: 102,
    },
    {
      id: 'grove',
      position: createVector(-8.8, 3, 0),
      radius: 2.05,
      gravitationalParameter: 44,
    },
    {
      id: 'tide',
      position: createVector(9.7, 6, 0),
      radius: 2.15,
      gravitationalParameter: 48,
    },
  ];
  const MeadowToEmber = createVector(15.8, 3.1, 0);
  const MeadowToEmberLength = Math.hypot(MeadowToEmber.x, MeadowToEmber.y);
  const SurfaceDistance = WorldDefinitions[0].radius + SeedRadius + 0.03;
  const StartingPosition = createVector(
    WorldDefinitions[0].position.x + ((MeadowToEmber.x / MeadowToEmberLength) * SurfaceDistance),
    WorldDefinitions[0].position.y + ((MeadowToEmber.y / MeadowToEmberLength) * SurfaceDistance),
    0,
  );
  const GroveLaunchAngleRadians = 106 * (Math.PI / 180);
  const GroveVelocity = createVector(
    Math.cos(GroveLaunchAngleRadians) * 8,
    Math.sin(GroveLaunchAngleRadians) * 8,
    0,
  );

  const Prediction = predictTrajectory(
    StartingPosition,
    GroveVelocity,
    WorldDefinitions,
    {
      seedRadius: SeedRadius,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'meadow',
    },
  );

  let LiveState = { position: StartingPosition, velocity: GroveVelocity };
  let IgnoredWorldIdentifier = 'meadow';
  let LiveCollision = null;
  let LiveCollisionStep = null;

  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, WorldDefinitions, FixedStepSeconds);
    if (IgnoredWorldIdentifier) {
      const ClearDistance = WorldDefinitions[0].radius + SeedRadius + 0.35;
      if (
        calculateDistanceSquared(LiveState.position, WorldDefinitions[0].position)
        > (ClearDistance * ClearDistance)
      ) {
        IgnoredWorldIdentifier = null;
      }
    }
    LiveCollision = findCollidingWorld(
      LiveState.position,
      SeedRadius,
      WorldDefinitions,
      IgnoredWorldIdentifier,
    );
    if (LiveCollision) {
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(Prediction.collisionWorldIdentifier, 'grove');
  assert.equal(LiveCollision?.id, 'grove');
  assert.equal(LiveCollisionStep, Prediction.points.length - 1);
});

test('Broken Belt opens with deterministic safe and mastery commitments', () => {
  const Runtime = createAuthoredSystemRuntime(BrokenBeltSystemDefinition, { createVector });
  const RelayDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'relay');
  const KilnDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'kiln');
  const RelayToKiln = createVector(
    KilnDefinition.position.x - RelayDefinition.position.x,
    KilnDefinition.position.y - RelayDefinition.position.y,
    0,
  );
  const RelayToKilnLength = Math.hypot(RelayToKiln.x, RelayToKiln.y);
  const StartingPosition = createVector(
    RelayDefinition.position.x
      + ((RelayToKiln.x / RelayToKilnLength) * (RelayDefinition.radius + 0.49)),
    RelayDefinition.position.y
      + ((RelayToKiln.y / RelayToKilnLength) * (RelayDefinition.radius + 0.49)),
    0,
  );
  const createPrediction = (Velocity, StartTimeSeconds = 0) => predictTrajectory(
    StartingPosition,
    Velocity,
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: 1 / 120,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'relay',
      collisionBodyDefinitions: Runtime.tacticalBodies,
      startTimeSeconds: StartTimeSeconds,
    },
  );
  const SafeAngleRadians = 4 * (Math.PI / 180);
  const DirectPrediction = createPrediction(createVector(
    Math.cos(SafeAngleRadians) * 18.4,
    Math.sin(SafeAngleRadians) * 18.4,
    0,
  ));
  const HighRouteAngleRadians = 62 * (Math.PI / 180);
  const HighRoutePrediction = createPrediction(createVector(
    Math.cos(HighRouteAngleRadians) * 18.4,
    Math.sin(HighRouteAngleRadians) * 18.4,
    0,
  ));

  assert.equal(DirectPrediction.collisionWorldIdentifier, 'kiln');
  assert.equal(HighRoutePrediction.collisionWorldIdentifier, 'loom');
  assert.deepEqual(
    getTrajectoryPickupIdentifiers(HighRoutePrediction.points, Runtime.stardust, 0.68).sort(),
    Runtime.stardust.map((StardustDefinition) => StardustDefinition.id).sort(),
  );
});

test('Broken Belt has complete deterministic four-launch safe and mastery routes', () => {
  const Runtime = createAuthoredSystemRuntime(BrokenBeltSystemDefinition, { createVector });
  const RelayDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'relay');
  const KilnDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'kiln');
  const OpeningDirection = createVector(
    KilnDefinition.position.x - RelayDefinition.position.x,
    KilnDefinition.position.y - RelayDefinition.position.y,
    0,
  );
  const OpeningDirectionLength = Math.hypot(OpeningDirection.x, OpeningDirection.y);
  const OpeningPosition = createVector(
    RelayDefinition.position.x
      + ((OpeningDirection.x / OpeningDirectionLength) * (RelayDefinition.radius + 0.49)),
    RelayDefinition.position.y
      + ((OpeningDirection.y / OpeningDirectionLength) * (RelayDefinition.radius + 0.49)),
    0,
  );
  const runRoute = (Shots) => {
    let Position = OpeningPosition;
    let ElapsedTimeSeconds = 0;
    const Outcomes = [];
    for (const Shot of Shots) {
      ElapsedTimeSeconds = Math.max(ElapsedTimeSeconds, Shot.notBeforeSeconds ?? 0);
      const AngleRadians = Shot.angleDegrees * (Math.PI / 180);
      const Prediction = predictTrajectory(
        Position,
        createVector(
          Math.cos(AngleRadians) * Shot.speed,
          Math.sin(AngleRadians) * Shot.speed,
          0,
        ),
        Runtime.worlds,
        {
          seedRadius: 0.46,
          fixedStepSeconds: 1 / 120,
          maximumSteps: 520,
          ignoredWorldIdentifier: Shot.originIdentifier,
          collisionBodyDefinitions: Runtime.tacticalBodies,
          startTimeSeconds: ElapsedTimeSeconds,
        },
      );
      Outcomes.push(Prediction);
      Position = Prediction.points.at(-1);
      ElapsedTimeSeconds += (Prediction.points.length - 1) / 120;
    }
    return Outcomes;
  };
  const SafeOutcomes = runRoute([
    { originIdentifier: 'relay', angleDegrees: 4, speed: 18.4 },
    { originIdentifier: 'kiln', angleDegrees: 35, speed: 18.4 },
    { originIdentifier: 'drift', angleDegrees: 12, speed: 18.4 },
    { originIdentifier: 'vault', angleDegrees: 21, speed: 18.4 },
  ]);
  const MasteryOutcomes = runRoute([
    { originIdentifier: 'relay', angleDegrees: 62, speed: 18.4 },
    { originIdentifier: 'loom', angleDegrees: 0.5, speed: 18.4, notBeforeSeconds: 2.5 },
    { originIdentifier: 'drift', angleDegrees: 4, speed: 18.4 },
    { originIdentifier: 'vault', angleDegrees: 34, speed: 18.4 },
  ]);

  assert.deepEqual(
    SafeOutcomes.map((Outcome) => (
      Outcome.collisionWorldIdentifier ?? Outcome.collisionBodyIdentifier
    )),
    ['kiln', 'drift', 'vault', 'belt-heart'],
  );
  assert.deepEqual(
    MasteryOutcomes.map((Outcome) => (
      Outcome.collisionWorldIdentifier ?? Outcome.collisionBodyIdentifier
    )),
    ['loom', 'drift', 'vault', 'belt-heart'],
  );
  const MasteryEvents = predictSlingshotEvents(
    MasteryOutcomes[1].points,
    Runtime.worlds,
    { runnerRadius: 0.46, ignoredBodyIdentifier: 'loom' },
  );
  assert.deepEqual(
    MasteryEvents.map((Event) => [Event.bodyIdentifier, Event.tier, Event.points]),
    [['shard', 'deep', 2400]],
  );
});

test('Broken Belt Sentinel closes and opens the same mastery line deterministically', () => {
  const Runtime = createAuthoredSystemRuntime(BrokenBeltSystemDefinition, { createVector });
  const StartingPosition = createVector(-13.416387701359206, 5.309760114113797, 0);
  const AngleRadians = 0.5 * (Math.PI / 180);
  const LaunchVelocity = createVector(
    Math.cos(AngleRadians) * 18.4,
    Math.sin(AngleRadians) * 18.4,
    0,
  );
  const createPrediction = (StartTimeSeconds) => predictTrajectory(
    StartingPosition,
    LaunchVelocity,
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: 1 / 120,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'loom',
      collisionBodyDefinitions: Runtime.tacticalBodies,
      startTimeSeconds: StartTimeSeconds,
    },
  );
  const BlockedPrediction = createPrediction(0);
  const OpenPrediction = createPrediction(2.5);

  let LiveState = {
    position: createVector(StartingPosition.x, StartingPosition.y, 0),
    velocity: createVector(LaunchVelocity.x, LaunchVelocity.y, 0),
  };
  let LiveCollisionIdentifier = null;
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, Runtime.worlds, 1 / 120);
    const CollisionBody = findCollidingBody(
      LiveState.position,
      0.46,
      Runtime.tacticalBodies,
      2.5 + (StepIndex / 120),
    );
    const CollisionWorld = findCollidingWorld(
      LiveState.position,
      0.46,
      Runtime.worlds,
      'loom',
    );
    if (CollisionBody || CollisionWorld) {
      LiveCollisionIdentifier = CollisionBody?.definition.id ?? CollisionWorld.id;
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(BlockedPrediction.collisionKind, 'hazard');
  assert.equal(BlockedPrediction.collisionBodyIdentifier, 'sentinel');
  assert.equal(OpenPrediction.collisionWorldIdentifier, 'drift');
  assert.equal(LiveCollisionIdentifier, 'drift');
  assert.equal(LiveCollisionStep, OpenPrediction.points.length - 1);
});

test('Wandering Garden opens safely and its moving moon matches live collision timing', () => {
  const FixedStepSeconds = 1 / 120;
  const Runtime = createAuthoredSystemRuntime(WanderingGardenSystemDefinition, { createVector });
  const BowerDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'bower');
  const LanternDefinition = Runtime.worlds.find(
    (WorldDefinition) => WorldDefinition.id === 'lantern',
  );
  const CanopyDefinition = Runtime.worlds.find(
    (WorldDefinition) => WorldDefinition.id === 'canopy',
  );
  const BowerToLantern = createVector(
    LanternDefinition.position.x - BowerDefinition.position.x,
    LanternDefinition.position.y - BowerDefinition.position.y,
    0,
  );
  const BowerToLanternLength = Math.hypot(BowerToLantern.x, BowerToLantern.y);
  const OpeningPosition = createVector(
    BowerDefinition.position.x
      + ((BowerToLantern.x / BowerToLanternLength) * (BowerDefinition.radius + 0.49)),
    BowerDefinition.position.y
      + ((BowerToLantern.y / BowerToLanternLength) * (BowerDefinition.radius + 0.49)),
    0,
  );
  const createOpeningPrediction = (Velocity) => predictTrajectory(
    OpeningPosition,
    Velocity,
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'bower',
    },
  );
  const DirectPrediction = createOpeningPrediction(createVector(
    (BowerToLantern.x / BowerToLanternLength) * 8.85,
    (BowerToLantern.y / BowerToLanternLength) * 8.85,
    0,
  ));
  const HighRouteAngleRadians = 106 * (Math.PI / 180);
  const HighRoutePrediction = createOpeningPrediction(createVector(
    Math.cos(HighRouteAngleRadians) * 8,
    Math.sin(HighRouteAngleRadians) * 8,
    0,
  ));

  assert.equal(DirectPrediction.collisionWorldIdentifier, 'lantern');
  assert.equal(HighRoutePrediction.collisionWorldIdentifier, 'canopy');

  const CanopyImpactPosition = HighRoutePrediction.points.at(-1);
  const CanopyImpactOffset = createVector(
    CanopyImpactPosition.x - CanopyDefinition.position.x,
    CanopyImpactPosition.y - CanopyDefinition.position.y,
    0,
  );
  const CanopyImpactOffsetLength = Math.hypot(
    CanopyImpactOffset.x,
    CanopyImpactOffset.y,
  );
  const CanopyLaunchPosition = createVector(
    CanopyDefinition.position.x
      + ((CanopyImpactOffset.x / CanopyImpactOffsetLength) * (CanopyDefinition.radius + 0.49)),
    CanopyDefinition.position.y
      + ((CanopyImpactOffset.y / CanopyImpactOffsetLength) * (CanopyDefinition.radius + 0.49)),
    0,
  );
  const MoonRouteAngleRadians = 328 * (Math.PI / 180);
  const MoonRouteVelocity = createVector(
    Math.cos(MoonRouteAngleRadians) * 4.4,
    Math.sin(MoonRouteAngleRadians) * 4.4,
    0,
  );
  const ActiveBodyDefinitions = Runtime.tacticalBodies.filter(
    (BodyDefinition) => BodyDefinition.kind !== 'worldheart',
  );
  const MoonRouteStartTimeSeconds = 3;
  const MoonPrediction = predictTrajectory(
    CanopyLaunchPosition,
    MoonRouteVelocity,
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'canopy',
      collisionBodyDefinitions: ActiveBodyDefinitions,
      startTimeSeconds: MoonRouteStartTimeSeconds,
    },
  );

  let LiveState = { position: CanopyLaunchPosition, velocity: MoonRouteVelocity };
  let LiveCollision = null;
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, Runtime.worlds, FixedStepSeconds);
    LiveCollision = findCollidingBody(
      LiveState.position,
      0.46,
      ActiveBodyDefinitions,
      MoonRouteStartTimeSeconds + (StepIndex * FixedStepSeconds),
    );
    if (LiveCollision) {
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(MoonPrediction.collisionKind, 'seedstone');
  assert.equal(MoonPrediction.collisionBodyIdentifier, 'pollen-moon');
  assert.equal(LiveCollision?.definition.id, 'pollen-moon');
  assert.equal(LiveCollisionStep, MoonPrediction.points.length - 1);
});

test('Long Night opens with a safe line and a long high-route landing', () => {
  const Runtime = createAuthoredSystemRuntime(LongNightSystemDefinition, { createVector });
  const VigilDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'vigil');
  const PyreDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'pyre');
  const VigilToPyre = createVector(
    PyreDefinition.position.x - VigilDefinition.position.x,
    PyreDefinition.position.y - VigilDefinition.position.y,
    0,
  );
  const VigilToPyreLength = Math.hypot(VigilToPyre.x, VigilToPyre.y);
  const StartingPosition = createVector(
    VigilDefinition.position.x
      + ((VigilToPyre.x / VigilToPyreLength) * (VigilDefinition.radius + 0.49)),
    VigilDefinition.position.y
      + ((VigilToPyre.y / VigilToPyreLength) * (VigilDefinition.radius + 0.49)),
    0,
  );
  const ActiveBodyDefinitions = Runtime.tacticalBodies.filter(
    (BodyDefinition) => BodyDefinition.kind !== 'worldheart',
  );
  const createPrediction = (Velocity) => predictTrajectory(
    StartingPosition,
    Velocity,
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: 1 / 120,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'vigil',
      collisionBodyDefinitions: ActiveBodyDefinitions,
      startTimeSeconds: 0,
    },
  );
  const DirectPrediction = createPrediction(createVector(
    (VigilToPyre.x / VigilToPyreLength) * 7.1,
    (VigilToPyre.y / VigilToPyreLength) * 7.1,
    0,
  ));
  const HighRouteAngleRadians = 160 * (Math.PI / 180);
  const HighRoutePrediction = createPrediction(createVector(
    Math.cos(HighRouteAngleRadians) * 3.4,
    Math.sin(HighRouteAngleRadians) * 3.4,
    0,
  ));

  assert.equal(DirectPrediction.collisionWorldIdentifier, 'pyre');
  assert.equal(HighRoutePrediction.collisionWorldIdentifier, 'hollow');
  assert.ok(HighRoutePrediction.points.length > DirectPrediction.points.length + 200);
});

test('Long Night Eclipse blocks the full Arc until a deterministic safe window', () => {
  const FixedStepSeconds = 1 / 120;
  const Runtime = createAuthoredSystemRuntime(LongNightSystemDefinition, { createVector });
  const VigilDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'vigil');
  const PyreDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'pyre');
  const VigilToPyre = createVector(
    PyreDefinition.position.x - VigilDefinition.position.x,
    PyreDefinition.position.y - VigilDefinition.position.y,
    0,
  );
  const VigilToPyreLength = Math.hypot(VigilToPyre.x, VigilToPyre.y);
  const StartingPosition = createVector(
    VigilDefinition.position.x
      + ((VigilToPyre.x / VigilToPyreLength) * (VigilDefinition.radius + 0.49)),
    VigilDefinition.position.y
      + ((VigilToPyre.y / VigilToPyreLength) * (VigilDefinition.radius + 0.49)),
    0,
  );
  const ArcAngleRadians = 18 * (Math.PI / 180);
  const ArcVelocity = createVector(
    Math.cos(ArcAngleRadians) * 4.1,
    Math.sin(ArcAngleRadians) * 4.1,
    0,
  );
  const ActiveBodyDefinitions = Runtime.tacticalBodies.filter(
    (BodyDefinition) => BodyDefinition.kind !== 'worldheart',
  );
  const createArcPrediction = (StartTimeSeconds) => predictTrajectory(
    StartingPosition,
    ArcVelocity,
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'vigil',
      collisionBodyDefinitions: ActiveBodyDefinitions,
      startTimeSeconds: StartTimeSeconds,
    },
  );
  const BlockedPrediction = createArcPrediction(0);
  const ClearPrediction = createArcPrediction(2.5);

  let LiveState = { position: StartingPosition, velocity: ArcVelocity };
  let LiveCollision = null;
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, Runtime.worlds, FixedStepSeconds);
    LiveCollision = findCollidingBody(
      LiveState.position,
      0.46,
      ActiveBodyDefinitions,
      StepIndex * FixedStepSeconds,
    );
    if (LiveCollision) {
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(BlockedPrediction.collisionKind, 'hazard');
  assert.equal(BlockedPrediction.collisionBodyIdentifier, 'eclipse');
  assert.equal(LiveCollision?.definition.id, 'eclipse');
  assert.equal(LiveCollisionStep, BlockedPrediction.points.length - 1);
  assert.equal(ClearPrediction.collisionWorldIdentifier, 'beacon');
  assert.deepEqual(
    getTrajectoryPickupIdentifiers(ClearPrediction.points, Runtime.stardust, 0.68).sort(),
    Runtime.stardust.map((StardustDefinition) => StardustDefinition.id).sort(),
  );
});

test('Long Night Beacon exit reaches the Night Heart with matching live physics', () => {
  const FixedStepSeconds = 1 / 120;
  const Runtime = createAuthoredSystemRuntime(LongNightSystemDefinition, { createVector });
  const BeaconLaunchPosition = createVector(-3.761034475181679, 5.668893830250314, 0);
  const LaunchAngleRadians = 43 * (Math.PI / 180);
  const LaunchVelocity = createVector(
    Math.cos(LaunchAngleRadians) * 2,
    Math.sin(LaunchAngleRadians) * 2,
    0,
  );
  const CollisionBodyDefinitions = Runtime.tacticalBodies.filter(
    (BodyDefinition) => BodyDefinition.kind !== 'seedstone',
  );
  const StartTimeSeconds = 10;
  const Prediction = predictTrajectory(
    BeaconLaunchPosition,
    LaunchVelocity,
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'beacon',
      collisionBodyDefinitions: CollisionBodyDefinitions,
      startTimeSeconds: StartTimeSeconds,
    },
  );

  let LiveState = { position: BeaconLaunchPosition, velocity: LaunchVelocity };
  let IgnoredWorldIdentifier = 'beacon';
  let LiveCollision = null;
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, Runtime.worlds, FixedStepSeconds);
    if (IgnoredWorldIdentifier) {
      const ClearDistance = 4.1 + 0.46 + 0.35;
      if (
        calculateDistanceSquared(LiveState.position, { x: 0, y: 8.3, z: 0 })
        > (ClearDistance * ClearDistance)
      ) {
        IgnoredWorldIdentifier = null;
      }
    }
    LiveCollision = findCollidingBody(
      LiveState.position,
      0.46,
      CollisionBodyDefinitions,
      StartTimeSeconds + (StepIndex * FixedStepSeconds),
    );
    if (LiveCollision) {
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(Prediction.collisionKind, 'worldheart');
  assert.equal(Prediction.collisionBodyIdentifier, 'night-heart');
  assert.equal(LiveCollision?.definition.id, 'night-heart');
  assert.equal(LiveCollisionStep, Prediction.points.length - 1);
});

test('Worldheart finale opens with a safe landing and a long alternate commitment', () => {
  const Runtime = createAuthoredSystemRuntime(WorldheartSystemDefinition, { createVector });
  const Confluence = Runtime.worlds.find((World) => World.id === 'confluence');
  const Kindle = Runtime.worlds.find((World) => World.id === 'kindle');
  const Direction = createVector(
    Kindle.position.x - Confluence.position.x,
    Kindle.position.y - Confluence.position.y,
    0,
  );
  const DirectionLength = Math.hypot(Direction.x, Direction.y);
  const StartingPosition = createVector(
    Confluence.position.x + ((Direction.x / DirectionLength) * (Confluence.radius + 0.49)),
    Confluence.position.y + ((Direction.y / DirectionLength) * (Confluence.radius + 0.49)),
    0,
  );
  const ActiveBodies = Runtime.tacticalBodies.filter((Body) => Body.kind !== 'worldheart');
  const predictOpening = (Velocity) => predictTrajectory(
    StartingPosition,
    Velocity,
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: 1 / 120,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'confluence',
      collisionBodyDefinitions: ActiveBodies,
      startTimeSeconds: 0,
    },
  );
  const Direct = predictOpening(createVector(
    (Direction.x / DirectionLength) * 7.1,
    (Direction.y / DirectionLength) * 7.1,
    0,
  ));
  const AlternateAngle = 160 * (Math.PI / 180);
  const Alternate = predictOpening(createVector(
    Math.cos(AlternateAngle) * 3.4,
    Math.sin(AlternateAngle) * 3.4,
    0,
  ));

  assert.equal(Direct.collisionWorldIdentifier, 'kindle');
  assert.equal(Alternate.collisionWorldIdentifier, 'memory');
  assert.ok(Alternate.points.length > Direct.points.length + 200);
});

test('Worldheart Arc is blocked by Last Shadow until its deterministic opening', () => {
  const Runtime = createAuthoredSystemRuntime(WorldheartSystemDefinition, { createVector });
  const Confluence = Runtime.worlds.find((World) => World.id === 'confluence');
  const Kindle = Runtime.worlds.find((World) => World.id === 'kindle');
  const Direction = createVector(
    Kindle.position.x - Confluence.position.x,
    Kindle.position.y - Confluence.position.y,
    0,
  );
  const DirectionLength = Math.hypot(Direction.x, Direction.y);
  const StartingPosition = createVector(
    Confluence.position.x + ((Direction.x / DirectionLength) * (Confluence.radius + 0.49)),
    Confluence.position.y + ((Direction.y / DirectionLength) * (Confluence.radius + 0.49)),
    0,
  );
  const ArcAngle = 18 * (Math.PI / 180);
  const ArcVelocity = createVector(
    Math.cos(ArcAngle) * 4.1,
    Math.sin(ArcAngle) * 4.1,
    0,
  );
  const ActiveBodies = Runtime.tacticalBodies.filter((Body) => Body.kind !== 'worldheart');
  const predictArc = (StartTimeSeconds) => predictTrajectory(
    StartingPosition,
    ArcVelocity,
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: 1 / 120,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'confluence',
      collisionBodyDefinitions: ActiveBodies,
      startTimeSeconds: StartTimeSeconds,
    },
  );
  const Blocked = predictArc(0);
  const Clear = predictArc(2.5);

  assert.equal(Blocked.collisionKind, 'hazard');
  assert.equal(Blocked.collisionBodyIdentifier, 'last-shadow');
  assert.equal(Clear.collisionWorldIdentifier, 'starwell');
  assert.deepEqual(
    getTrajectoryPickupIdentifiers(Clear.points, Runtime.stardust, 0.68).sort(),
    Runtime.stardust.map((Pickup) => Pickup.id).sort(),
  );
});

test('Worldheart Memory Moon matches the moving prediction after the long opening route', () => {
  const FixedStepSeconds = 1 / 120;
  const Runtime = createAuthoredSystemRuntime(WorldheartSystemDefinition, { createVector });
  const StartingPosition = createVector(-8.847697764545135, 1.1902870284989984, 0);
  const LaunchAngle = 316 * (Math.PI / 180);
  const LaunchVelocity = createVector(
    Math.cos(LaunchAngle) * 5.1,
    Math.sin(LaunchAngle) * 5.1,
    0,
  );
  const ActiveBodies = Runtime.tacticalBodies.filter((Body) => Body.kind !== 'worldheart');
  const StartTimeSeconds = 7;
  const Prediction = predictTrajectory(
    StartingPosition,
    LaunchVelocity,
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'memory',
      collisionBodyDefinitions: ActiveBodies,
      startTimeSeconds: StartTimeSeconds,
    },
  );

  let LiveState = { position: StartingPosition, velocity: LaunchVelocity };
  let LiveCollision = null;
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, Runtime.worlds, FixedStepSeconds);
    LiveCollision = findCollidingBody(
      LiveState.position,
      0.46,
      ActiveBodies,
      StartTimeSeconds + (StepIndex * FixedStepSeconds),
    );
    if (LiveCollision) {
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(Prediction.collisionKind, 'seedstone');
  assert.equal(Prediction.collisionBodyIdentifier, 'memory-moon');
  assert.equal(LiveCollision?.definition.id, 'memory-moon');
  assert.equal(LiveCollisionStep, Prediction.points.length - 1);
});

test('Worldheart finale exit reaches the core with matching live physics', () => {
  const FixedStepSeconds = 1 / 120;
  const Runtime = createAuthoredSystemRuntime(WorldheartSystemDefinition, { createVector });
  const StartingPosition = createVector(-3.761034475181679, 5.668893830250314, 0);
  const LaunchAngle = 43 * (Math.PI / 180);
  const LaunchVelocity = createVector(
    Math.cos(LaunchAngle) * 2,
    Math.sin(LaunchAngle) * 2,
    0,
  );
  const CollisionBodies = Runtime.tacticalBodies.filter((Body) => Body.kind !== 'seedstone');
  const StartTimeSeconds = 10;
  const Prediction = predictTrajectory(
    StartingPosition,
    LaunchVelocity,
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'starwell',
      collisionBodyDefinitions: CollisionBodies,
      startTimeSeconds: StartTimeSeconds,
    },
  );

  let LiveState = { position: StartingPosition, velocity: LaunchVelocity };
  let LiveCollision = null;
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, Runtime.worlds, FixedStepSeconds);
    LiveCollision = findCollidingBody(
      LiveState.position,
      0.46,
      CollisionBodies,
      StartTimeSeconds + (StepIndex * FixedStepSeconds),
    );
    if (LiveCollision) {
      LiveCollisionStep = StepIndex;
      break;
    }
  }

  assert.equal(Prediction.collisionKind, 'worldheart');
  assert.equal(Prediction.collisionBodyIdentifier, 'worldheart-core');
  assert.equal(LiveCollision?.definition.id, 'worldheart-core');
  assert.equal(LiveCollisionStep, Prediction.points.length - 1);
});
