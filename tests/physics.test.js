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
  BreakerBurnImpulse,
  MaximumLaunchSpeed,
  OrbitTrapMinSteps,
  OrbitTrapRevolutions,
  applyBreakerBurn,
  advanceOrbitTrap,
  calculateBodyPositionAtTime,
  calculateDistanceSquared,
  calculateGravityAcceleration,
  createOrbitTrapState,
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

test('launch speed stays inside the gravity-assist range', () => {
  assert.equal(MaximumLaunchSpeed, 12.5);
  assert.ok(MaximumLaunchSpeed < 18, 'Full-power darts must not outrun every well.');
});

test('Breaker Burn adds one deterministic impulse along current heading', () => {
  const Burned = applyBreakerBurn({
    position: createVector(4, 5, 0),
    velocity: createVector(3, 4, 0),
  });
  assert.deepEqual(Burned.position, createVector(4, 5, 0));
  assert.ok(Math.abs(Burned.velocity.x - (3 + (BreakerBurnImpulse * 0.6))) < 1e-12);
  assert.ok(Math.abs(Burned.velocity.y - (4 + (BreakerBurnImpulse * 0.8))) < 1e-12);
  assert.deepEqual(
    applyBreakerBurn({ position: createVector(1, 2, 0), velocity: createVector() }).velocity,
    createVector(),
  );
});

test('Breaker Burn can take a dragged direction without changing heading-only burns', () => {
  const Sideways = applyBreakerBurn(
    {
      position: createVector(4, 5, 0),
      velocity: createVector(3, 4, 0),
    },
    BreakerBurnImpulse,
    { x: 0, y: 2 },
  );
  assert.ok(Math.abs(Sideways.velocity.x - 3) < 1e-12);
  assert.ok(Math.abs(Sideways.velocity.y - (4 + BreakerBurnImpulse)) < 1e-12);
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

test('Wandering Garden opens with deterministic road and moon-route commitments', () => {
  const Runtime = createAuthoredSystemRuntime(WanderingGardenSystemDefinition, { createVector });
  const BowerDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'bower');
  const LanternDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'lantern');
  const DirectionX = LanternDefinition.position.x - BowerDefinition.position.x;
  const DirectionY = LanternDefinition.position.y - BowerDefinition.position.y;
  const DirectionLength = Math.hypot(DirectionX, DirectionY);
  const OpeningPosition = createVector(
    BowerDefinition.position.x + ((DirectionX / DirectionLength) * (BowerDefinition.radius + 0.49)),
    BowerDefinition.position.y + ((DirectionY / DirectionLength) * (BowerDefinition.radius + 0.49)),
    0,
  );
  const createOpeningPrediction = (AngleDegrees) => {
    const AngleRadians = AngleDegrees * (Math.PI / 180);
    return predictTrajectory(
      OpeningPosition,
      createVector(Math.cos(AngleRadians) * 18.4, Math.sin(AngleRadians) * 18.4, 0),
      Runtime.worlds,
      {
        seedRadius: 0.46,
        fixedStepSeconds: 1 / 120,
        maximumSteps: 520,
        ignoredWorldIdentifier: 'bower',
        collisionBodyDefinitions: Runtime.tacticalBodies,
        startTimeSeconds: 0,
      },
    );
  };
  const RoadPrediction = createOpeningPrediction(0);
  const MoonRoutePrediction = createOpeningPrediction(60);

  assert.equal(RoadPrediction.collisionWorldIdentifier, 'lantern');
  assert.equal(MoonRoutePrediction.collisionWorldIdentifier, 'canopy');
  assert.deepEqual(
    getTrajectoryPickupIdentifiers(MoonRoutePrediction.points, Runtime.stardust, 0.68).sort(),
    Runtime.stardust.map((StardustDefinition) => StardustDefinition.id).sort(),
  );
});

test('Wandering Garden has complete deterministic road and moving-moon routes', () => {
  const FixedStepSeconds = 1 / 120;
  const Runtime = createAuthoredSystemRuntime(WanderingGardenSystemDefinition, { createVector });
  const MoonDefinition = Runtime.tacticalBodies.find(
    (BodyDefinition) => BodyDefinition.id === 'pollen-moon',
  );
  const BowerDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'bower');
  const LanternDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'lantern');
  const DirectionX = LanternDefinition.position.x - BowerDefinition.position.x;
  const DirectionY = LanternDefinition.position.y - BowerDefinition.position.y;
  const DirectionLength = Math.hypot(DirectionX, DirectionY);
  const OpeningPosition = createVector(
    BowerDefinition.position.x + ((DirectionX / DirectionLength) * (BowerDefinition.radius + 0.49)),
    BowerDefinition.position.y + ((DirectionY / DirectionLength) * (BowerDefinition.radius + 0.49)),
    0,
  );
  const restOnBody = (BodyDefinition, ImpactPosition, BodyPosition = BodyDefinition.position) => {
    const OffsetX = ImpactPosition.x - BodyPosition.x;
    const OffsetY = ImpactPosition.y - BodyPosition.y;
    const OffsetLength = Math.hypot(OffsetX, OffsetY) || 1;
    return createVector(
      BodyPosition.x + ((OffsetX / OffsetLength) * (BodyDefinition.radius + 0.49)),
      BodyPosition.y + ((OffsetY / OffsetLength) * (BodyDefinition.radius + 0.49)),
      0,
    );
  };
  const predictShot = (Position, OriginIdentifier, AngleDegrees, StartTimeSeconds) => {
    const AngleRadians = AngleDegrees * (Math.PI / 180);
    return predictTrajectory(
      Position,
      createVector(Math.cos(AngleRadians) * 18.4, Math.sin(AngleRadians) * 18.4, 0),
      Runtime.worlds,
      {
        seedRadius: 0.46,
        fixedStepSeconds: FixedStepSeconds,
        maximumSteps: 520,
        ignoredWorldIdentifier: Runtime.worlds.some((WorldDefinition) => (
          WorldDefinition.id === OriginIdentifier
        )) ? OriginIdentifier : null,
        collisionBodyDefinitions: Runtime.tacticalBodies,
        ignoredCollisionBodyIdentifier: OriginIdentifier === 'pollen-moon'
          ? OriginIdentifier
          : null,
        startTimeSeconds: StartTimeSeconds,
      },
    );
  };
  const runWorldRoute = (Shots) => {
    let Position = OpeningPosition;
    let ElapsedTimeSeconds = 0;
    const Outcomes = [];
    for (const Shot of Shots) {
      const Prediction = predictShot(
        Position,
        Shot.originIdentifier,
        Shot.angleDegrees,
        ElapsedTimeSeconds,
      );
      Outcomes.push(Prediction);
      ElapsedTimeSeconds += (Prediction.points.length - 1) * FixedStepSeconds;
      const LandedWorld = Runtime.worlds.find((WorldDefinition) => (
        WorldDefinition.id === Prediction.collisionWorldIdentifier
      ));
      if (LandedWorld) Position = restOnBody(LandedWorld, Prediction.points.at(-1));
    }
    return Outcomes;
  };
  const RoadOutcomes = runWorldRoute([
    { originIdentifier: 'bower', angleDegrees: 2 },
    { originIdentifier: 'lantern', angleDegrees: 2 },
    { originIdentifier: 'nest', angleDegrees: 14 },
    { originIdentifier: 'dew', angleDegrees: 29.5 },
  ]);

  let ElapsedTimeSeconds = 0;
  const CanopyPrediction = predictShot(OpeningPosition, 'bower', 60, ElapsedTimeSeconds);
  ElapsedTimeSeconds += (CanopyPrediction.points.length - 1) * FixedStepSeconds;
  const CanopyDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'canopy');
  const CanopyPosition = restOnBody(CanopyDefinition, CanopyPrediction.points.at(-1));
  const MoonPrediction = predictShot(CanopyPosition, 'canopy', 319, ElapsedTimeSeconds);
  const MoonLaunchTimeSeconds = ElapsedTimeSeconds
    + ((MoonPrediction.points.length - 1) * FixedStepSeconds);
  const MoonPosition = calculateBodyPositionAtTime(MoonDefinition, MoonLaunchTimeSeconds);
  const MoonRestPosition = restOnBody(MoonDefinition, MoonPrediction.points.at(-1), MoonPosition);
  const MoonSurfaceOffset = createVector(
    MoonRestPosition.x - MoonPosition.x,
    MoonRestPosition.y - MoonPosition.y,
    0,
  );
  const MovingMoonPosition = calculateBodyPositionAtTime(MoonDefinition, MoonLaunchTimeSeconds);
  const CrownPrediction = predictShot(
    createVector(
      MovingMoonPosition.x + MoonSurfaceOffset.x,
      MovingMoonPosition.y + MoonSurfaceOffset.y,
      0,
    ),
    'pollen-moon',
    46.5,
    MoonLaunchTimeSeconds,
  );
  ElapsedTimeSeconds = MoonLaunchTimeSeconds
    + ((CrownPrediction.points.length - 1) * FixedStepSeconds);
  const CrownDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'crown');
  const CrownPosition = restOnBody(CrownDefinition, CrownPrediction.points.at(-1));
  const DewPrediction = predictShot(CrownPosition, 'crown', 0, ElapsedTimeSeconds);
  ElapsedTimeSeconds += (DewPrediction.points.length - 1) * FixedStepSeconds;
  const DewDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'dew');
  const DewPosition = restOnBody(DewDefinition, DewPrediction.points.at(-1));
  const HeartPrediction = predictShot(DewPosition, 'dew', 23, ElapsedTimeSeconds);
  const MoonRouteOutcomes = [
    CanopyPrediction,
    MoonPrediction,
    CrownPrediction,
    DewPrediction,
    HeartPrediction,
  ];

  assert.deepEqual(
    RoadOutcomes.map((Outcome) => Outcome.collisionWorldIdentifier ?? Outcome.collisionBodyIdentifier),
    ['lantern', 'nest', 'dew', 'garden-heart'],
  );
  assert.deepEqual(
    MoonRouteOutcomes.map((Outcome) => Outcome.collisionWorldIdentifier ?? Outcome.collisionBodyIdentifier),
    ['canopy', 'pollen-moon', 'crown', 'dew', 'garden-heart'],
  );
  assert.deepEqual(
    predictSlingshotEvents(CrownPrediction.points, Runtime.worlds, { runnerRadius: 0.46 })
      .map((Event) => [Event.bodyIdentifier, Event.tier, Event.points]),
    [['nest', 'razor', 2400]],
  );

  let LiveState = {
    position: CanopyPosition,
    velocity: createVector(
      Math.cos(319 * (Math.PI / 180)) * 18.4,
      Math.sin(319 * (Math.PI / 180)) * 18.4,
      0,
    ),
  };
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, Runtime.worlds, FixedStepSeconds);
    const LiveCollision = findCollidingBody(
      LiveState.position,
      0.46,
      Runtime.tacticalBodies,
      ((CanopyPrediction.points.length - 1) * FixedStepSeconds)
        + (StepIndex * FixedStepSeconds),
    );
    if (LiveCollision?.definition.id === 'pollen-moon') {
      LiveCollisionStep = StepIndex;
      break;
    }
  }
  assert.equal(LiveCollisionStep, MoonPrediction.points.length - 1);
});

test('Long Night opens with deterministic watchfire and chain-route commitments', () => {
  const Runtime = createAuthoredSystemRuntime(LongNightSystemDefinition, { createVector });
  const VigilDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'vigil');
  const PyreDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'pyre');
  const DirectionX = PyreDefinition.position.x - VigilDefinition.position.x;
  const DirectionY = PyreDefinition.position.y - VigilDefinition.position.y;
  const DirectionLength = Math.hypot(DirectionX, DirectionY);
  const StartingPosition = createVector(
    VigilDefinition.position.x + ((DirectionX / DirectionLength) * (VigilDefinition.radius + 0.49)),
    VigilDefinition.position.y + ((DirectionY / DirectionLength) * (VigilDefinition.radius + 0.49)),
    0,
  );
  const predictOpening = (AngleDegrees) => {
    const AngleRadians = AngleDegrees * (Math.PI / 180);
    return predictTrajectory(
      StartingPosition,
      createVector(Math.cos(AngleRadians) * 18.4, Math.sin(AngleRadians) * 18.4, 0),
      Runtime.worlds,
      {
        seedRadius: 0.46,
        fixedStepSeconds: 1 / 120,
        maximumSteps: 520,
        ignoredWorldIdentifier: 'vigil',
        collisionBodyDefinitions: Runtime.tacticalBodies,
        startTimeSeconds: 0,
      },
    );
  };
  const WatchfirePrediction = predictOpening(2);
  const ChainRoutePrediction = predictOpening(65.75);

  assert.equal(WatchfirePrediction.collisionWorldIdentifier, 'pyre');
  assert.equal(ChainRoutePrediction.collisionWorldIdentifier, 'hollow');
  assert.deepEqual(
    getTrajectoryPickupIdentifiers(ChainRoutePrediction.points, Runtime.stardust, 0.68).sort(),
    Runtime.stardust.map((StardustDefinition) => StardustDefinition.id).sort(),
  );
});

test('Long Night has complete deterministic safe and two-body chain routes', () => {
  const FixedStepSeconds = 1 / 120;
  const Runtime = createAuthoredSystemRuntime(LongNightSystemDefinition, { createVector });
  const VigilDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'vigil');
  const PyreDefinition = Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'pyre');
  const DirectionX = PyreDefinition.position.x - VigilDefinition.position.x;
  const DirectionY = PyreDefinition.position.y - VigilDefinition.position.y;
  const DirectionLength = Math.hypot(DirectionX, DirectionY);
  const OpeningPosition = createVector(
    VigilDefinition.position.x + ((DirectionX / DirectionLength) * (VigilDefinition.radius + 0.49)),
    VigilDefinition.position.y + ((DirectionY / DirectionLength) * (VigilDefinition.radius + 0.49)),
    0,
  );
  const restOnWorld = (WorldDefinition, ImpactPosition) => {
    const OffsetX = ImpactPosition.x - WorldDefinition.position.x;
    const OffsetY = ImpactPosition.y - WorldDefinition.position.y;
    const OffsetLength = Math.hypot(OffsetX, OffsetY) || 1;
    return createVector(
      WorldDefinition.position.x + ((OffsetX / OffsetLength) * (WorldDefinition.radius + 0.49)),
      WorldDefinition.position.y + ((OffsetY / OffsetLength) * (WorldDefinition.radius + 0.49)),
      0,
    );
  };
  const runRoute = (Shots) => {
    let Position = OpeningPosition;
    let ElapsedTimeSeconds = 0;
    const Entries = [];
    for (const Shot of Shots) {
      const AngleRadians = Shot.angleDegrees * (Math.PI / 180);
      const StartPosition = createVector(Position.x, Position.y, 0);
      const Prediction = predictTrajectory(
        StartPosition,
        createVector(
          Math.cos(AngleRadians) * Shot.speed,
          Math.sin(AngleRadians) * Shot.speed,
          0,
        ),
        Runtime.worlds,
        {
          seedRadius: 0.46,
          fixedStepSeconds: FixedStepSeconds,
          maximumSteps: 520,
          ignoredWorldIdentifier: Shot.originIdentifier,
          collisionBodyDefinitions: Runtime.tacticalBodies,
          startTimeSeconds: ElapsedTimeSeconds,
        },
      );
      Entries.push({
        originIdentifier: Shot.originIdentifier,
        angleDegrees: Shot.angleDegrees,
        speed: Shot.speed,
        startPosition: StartPosition,
        startTimeSeconds: ElapsedTimeSeconds,
        prediction: Prediction,
      });
      ElapsedTimeSeconds += (Prediction.points.length - 1) * FixedStepSeconds;
      const LandedWorld = Runtime.worlds.find((WorldDefinition) => (
        WorldDefinition.id === Prediction.collisionWorldIdentifier
      ));
      if (LandedWorld) Position = restOnWorld(LandedWorld, Prediction.points.at(-1));
    }
    return Entries;
  };
  const SafeEntries = runRoute([
    { originIdentifier: 'vigil', angleDegrees: 2, speed: 18.4 },
    { originIdentifier: 'pyre', angleDegrees: 50, speed: 18.4 },
    { originIdentifier: 'lumen', angleDegrees: 352.75, speed: 18.4 },
    { originIdentifier: 'umbra', angleDegrees: 17.25, speed: 18.4 },
  ]);
  const ChainEntries = runRoute([
    { originIdentifier: 'vigil', angleDegrees: 65.75, speed: 18.4 },
    { originIdentifier: 'hollow', angleDegrees: 338.5, speed: 10.4 },
    { originIdentifier: 'umbra', angleDegrees: 162.75, speed: 18.4 },
    { originIdentifier: 'beacon', angleDegrees: 4, speed: 18.4 },
  ]);

  assert.deepEqual(
    SafeEntries.map(({ prediction }) => (
      prediction.collisionWorldIdentifier ?? prediction.collisionBodyIdentifier
    )),
    ['pyre', 'lumen', 'umbra', 'night-heart'],
  );
  assert.deepEqual(
    ChainEntries.map(({ prediction }) => (
      prediction.collisionWorldIdentifier ?? prediction.collisionBodyIdentifier
    )),
    ['hollow', 'umbra', 'beacon', 'night-heart'],
  );
  const ChainEntry = ChainEntries[1];
  assert.ok(ChainEntry.prediction.points.length - 1 > 160);
  assert.deepEqual(
    predictSlingshotEvents(ChainEntry.prediction.points, Runtime.worlds, {
      runnerRadius: 0.46,
      ignoredBodyIdentifier: 'hollow',
    }).map((Event) => [
      Event.bodyIdentifier,
      Event.tier,
      Event.chainCount,
      Event.points,
    ]),
    [
      ['lumen', 'razor', 1, 1950],
      ['beacon', 'assist', 2, 2400],
    ],
  );

  const ChainAngleRadians = ChainEntry.angleDegrees * (Math.PI / 180);
  let LiveState = {
    position: ChainEntry.startPosition,
    velocity: createVector(
      Math.cos(ChainAngleRadians) * ChainEntry.speed,
      Math.sin(ChainAngleRadians) * ChainEntry.speed,
      0,
    ),
  };
  let IgnoredWorldIdentifier = 'hollow';
  let LiveCollisionIdentifier = null;
  let LiveCollisionStep = null;
  for (let StepIndex = 1; StepIndex <= 520; StepIndex += 1) {
    LiveState = simulatePhysicsStep(LiveState, Runtime.worlds, FixedStepSeconds);
    if (IgnoredWorldIdentifier) {
      const HollowDefinition = Runtime.worlds.find((WorldDefinition) => (
        WorldDefinition.id === IgnoredWorldIdentifier
      ));
      const ClearDistance = HollowDefinition.radius + 0.46 + 0.35;
      if (calculateDistanceSquared(LiveState.position, HollowDefinition.position) > ClearDistance ** 2) {
        IgnoredWorldIdentifier = null;
      }
    }
    const CollisionWorld = findCollidingWorld(
      LiveState.position,
      0.46,
      Runtime.worlds,
      IgnoredWorldIdentifier,
    );
    const CollisionBody = findCollidingBody(
      LiveState.position,
      0.46,
      Runtime.tacticalBodies,
      ChainEntry.startTimeSeconds + (StepIndex * FixedStepSeconds),
    );
    if (CollisionWorld || CollisionBody) {
      LiveCollisionIdentifier = CollisionWorld?.id ?? CollisionBody.definition.id;
      LiveCollisionStep = StepIndex;
      break;
    }
  }
  assert.equal(LiveCollisionIdentifier, 'umbra');
  assert.equal(LiveCollisionStep, ChainEntry.prediction.points.length - 1);
});

test('Worldheart finale opens with deterministic road and memory commitments', () => {
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
  const DirectAngle = 2 * (Math.PI / 180);
  const Direct = predictOpening(createVector(
    Math.cos(DirectAngle) * 18.4,
    Math.sin(DirectAngle) * 18.4,
    0,
  ));
  const AlternateAngle = 64.5 * (Math.PI / 180);
  const Alternate = predictOpening(createVector(
    Math.cos(AlternateAngle) * 18.4,
    Math.sin(AlternateAngle) * 18.4,
    0,
  ));

  assert.equal(Direct.collisionWorldIdentifier, 'kindle');
  assert.equal(Alternate.collisionWorldIdentifier, 'memory');
  assert.deepEqual(
    getTrajectoryPickupIdentifiers(Alternate.points, Runtime.stardust, 0.68).sort(),
    Runtime.stardust.map((Pickup) => Pickup.id).sort(),
  );
});

test('Worldheart safe road reaches the core in four deterministic launches', () => {
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
  const restOnWorld = (World, Impact) => {
    const OffsetX = Impact.x - World.position.x;
    const OffsetY = Impact.y - World.position.y;
    const OffsetLength = Math.hypot(OffsetX, OffsetY) || 1;
    return createVector(
      World.position.x + ((OffsetX / OffsetLength) * (World.radius + 0.49)),
      World.position.y + ((OffsetY / OffsetLength) * (World.radius + 0.49)),
      0,
    );
  };
  const Shots = [
    { origin: 'confluence', angle: 2 },
    { origin: 'kindle', angle: 48.75 },
    { origin: 'chorus', angle: 0 },
    { origin: 'dawn', angle: 27.5 },
  ];
  let Position = StartingPosition;
  let ElapsedTimeSeconds = 0;
  const Predictions = [];
  for (const Shot of Shots) {
    const AngleRadians = Shot.angle * (Math.PI / 180);
    const Prediction = predictTrajectory(
      Position,
      createVector(Math.cos(AngleRadians) * 18.4, Math.sin(AngleRadians) * 18.4, 0),
      Runtime.worlds,
      {
        seedRadius: 0.46,
        fixedStepSeconds: 1 / 120,
        maximumSteps: 520,
        ignoredWorldIdentifier: Shot.origin,
        collisionBodyDefinitions: Runtime.tacticalBodies,
        startTimeSeconds: ElapsedTimeSeconds,
      },
    );
    Predictions.push(Prediction);
    ElapsedTimeSeconds += (Prediction.points.length - 1) / 120;
    const LandedWorld = Runtime.worlds.find((World) => (
      World.id === Prediction.collisionWorldIdentifier
    ));
    if (LandedWorld) Position = restOnWorld(LandedWorld, Prediction.points.at(-1));
  }

  assert.deepEqual(
    Predictions.map((Prediction) => (
      Prediction.collisionWorldIdentifier ?? Prediction.collisionBodyIdentifier
    )),
    ['kindle', 'chorus', 'dawn', 'worldheart-core'],
  );
  assert.deepEqual(
    predictSlingshotEvents(Predictions[2].points, Runtime.worlds, {
      runnerRadius: 0.46,
      ignoredBodyIdentifier: 'chorus',
    }).map((Event) => [Event.bodyIdentifier, Event.tier, Event.points]),
    [['starwell', 'assist', 1300]],
  );
  const SafeLiberationScore = ['kindle', 'chorus', 'dawn']
    .map((Identifier) => Runtime.worlds.find((World) => World.id === Identifier).liberationValue)
    .reduce((Total, Value) => Total + Value, 0);
  assert.equal(SafeLiberationScore + 1300 + (4 * 1000), 9200);
});

test('Worldheart Memory Moon matches the moving prediction after the long opening route', () => {
  const FixedStepSeconds = 1 / 120;
  const Runtime = createAuthoredSystemRuntime(WorldheartSystemDefinition, { createVector });
  const Confluence = Runtime.worlds.find((World) => World.id === 'confluence');
  const Kindle = Runtime.worlds.find((World) => World.id === 'kindle');
  const Memory = Runtime.worlds.find((World) => World.id === 'memory');
  const DirectionX = Kindle.position.x - Confluence.position.x;
  const DirectionY = Kindle.position.y - Confluence.position.y;
  const DirectionLength = Math.hypot(DirectionX, DirectionY);
  const OpeningPosition = createVector(
    Confluence.position.x + ((DirectionX / DirectionLength) * (Confluence.radius + 0.49)),
    Confluence.position.y + ((DirectionY / DirectionLength) * (Confluence.radius + 0.49)),
    0,
  );
  const OpeningAngle = 64.5 * (Math.PI / 180);
  const OpeningPrediction = predictTrajectory(
    OpeningPosition,
    createVector(Math.cos(OpeningAngle) * 18.4, Math.sin(OpeningAngle) * 18.4, 0),
    Runtime.worlds,
    {
      seedRadius: 0.46,
      fixedStepSeconds: FixedStepSeconds,
      maximumSteps: 520,
      ignoredWorldIdentifier: 'confluence',
      collisionBodyDefinitions: Runtime.tacticalBodies,
      startTimeSeconds: 0,
    },
  );
  const MemoryImpact = OpeningPrediction.points.at(-1);
  const MemoryOffsetX = MemoryImpact.x - Memory.position.x;
  const MemoryOffsetY = MemoryImpact.y - Memory.position.y;
  const MemoryOffsetLength = Math.hypot(MemoryOffsetX, MemoryOffsetY);
  const StartingPosition = createVector(
    Memory.position.x + ((MemoryOffsetX / MemoryOffsetLength) * (Memory.radius + 0.49)),
    Memory.position.y + ((MemoryOffsetY / MemoryOffsetLength) * (Memory.radius + 0.49)),
    0,
  );
  const LaunchAngle = 341 * (Math.PI / 180);
  const LaunchVelocity = createVector(
    Math.cos(LaunchAngle) * 18.4,
    Math.sin(LaunchAngle) * 18.4,
    0,
  );
  const ActiveBodies = Runtime.tacticalBodies.filter((Body) => Body.kind !== 'worldheart');
  const StartTimeSeconds = (OpeningPrediction.points.length - 1) * FixedStepSeconds;
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

test('Worldheart mastery route recombines the moving moon, hidden chain and core assist', () => {
  const FixedStepSeconds = 1 / 120;
  const Runtime = createAuthoredSystemRuntime(WorldheartSystemDefinition, { createVector });
  const world = (Identifier) => Runtime.worlds.find((World) => World.id === Identifier);
  const Moon = Runtime.tacticalBodies.find((Body) => Body.id === 'memory-moon');
  const restOnBody = (Body, Impact, BodyPosition = Body.position) => {
    const OffsetX = Impact.x - BodyPosition.x;
    const OffsetY = Impact.y - BodyPosition.y;
    const OffsetLength = Math.hypot(OffsetX, OffsetY) || 1;
    return createVector(
      BodyPosition.x + ((OffsetX / OffsetLength) * (Body.radius + 0.49)),
      BodyPosition.y + ((OffsetY / OffsetLength) * (Body.radius + 0.49)),
      0,
    );
  };
  const Confluence = world('confluence');
  const Kindle = world('kindle');
  const DirectionX = Kindle.position.x - Confluence.position.x;
  const DirectionY = Kindle.position.y - Confluence.position.y;
  const DirectionLength = Math.hypot(DirectionX, DirectionY);
  const OpeningPosition = createVector(
    Confluence.position.x + ((DirectionX / DirectionLength) * (Confluence.radius + 0.49)),
    Confluence.position.y + ((DirectionY / DirectionLength) * (Confluence.radius + 0.49)),
    0,
  );
  const predictShot = (Position, Origin, AngleDegrees, Speed, StartTimeSeconds) => {
    const AngleRadians = AngleDegrees * (Math.PI / 180);
    return predictTrajectory(
      Position,
      createVector(Math.cos(AngleRadians) * Speed, Math.sin(AngleRadians) * Speed, 0),
      Runtime.worlds,
      {
        seedRadius: 0.46,
        fixedStepSeconds: FixedStepSeconds,
        maximumSteps: 520,
        ignoredWorldIdentifier: world(Origin) ? Origin : null,
        collisionBodyDefinitions: Runtime.tacticalBodies,
        ignoredCollisionBodyIdentifier: Origin === 'memory-moon' ? Origin : null,
        startTimeSeconds: StartTimeSeconds,
      },
    );
  };

  let ElapsedTimeSeconds = 0;
  const MemoryPrediction = predictShot(OpeningPosition, 'confluence', 64.5, 18.4, 0);
  ElapsedTimeSeconds += (MemoryPrediction.points.length - 1) * FixedStepSeconds;
  const MemoryRest = restOnBody(world('memory'), MemoryPrediction.points.at(-1));
  const MoonPrediction = predictShot(MemoryRest, 'memory', 341, 18.4, ElapsedTimeSeconds);
  ElapsedTimeSeconds += (MoonPrediction.points.length - 1) * FixedStepSeconds;
  const MoonPosition = calculateBodyPositionAtTime(Moon, ElapsedTimeSeconds);
  const MoonRest = restOnBody(Moon, MoonPrediction.points.at(-1), MoonPosition);
  const MoonOffset = createVector(
    MoonRest.x - MoonPosition.x,
    MoonRest.y - MoonPosition.y,
    0,
  );
  const MovingMoonPosition = calculateBodyPositionAtTime(Moon, ElapsedTimeSeconds);
  const ChainPrediction = predictShot(
    createVector(
      MovingMoonPosition.x + MoonOffset.x,
      MovingMoonPosition.y + MoonOffset.y,
      0,
    ),
    'memory-moon',
    357,
    12.6,
    ElapsedTimeSeconds,
  );
  ElapsedTimeSeconds += (ChainPrediction.points.length - 1) * FixedStepSeconds;
  const DawnRest = restOnBody(world('dawn'), ChainPrediction.points.at(-1));
  const StarwellPrediction = predictShot(DawnRest, 'dawn', 161.75, 18.4, ElapsedTimeSeconds);
  ElapsedTimeSeconds += (StarwellPrediction.points.length - 1) * FixedStepSeconds;
  const StarwellRest = restOnBody(world('starwell'), StarwellPrediction.points.at(-1));
  const CorePrediction = predictShot(StarwellRest, 'starwell', 4.5, 18.4, ElapsedTimeSeconds);

  assert.deepEqual([
    MemoryPrediction,
    MoonPrediction,
    ChainPrediction,
    StarwellPrediction,
    CorePrediction,
  ].map((Prediction) => (
    Prediction.collisionWorldIdentifier ?? Prediction.collisionBodyIdentifier
  )), ['memory', 'memory-moon', 'dawn', 'starwell', 'worldheart-core']);
  assert.ok(ChainPrediction.points.length - 1 > 160);
  assert.deepEqual(
    predictSlingshotEvents(ChainPrediction.points, Runtime.worlds, { runnerRadius: 0.46 })
      .map((Event) => [Event.bodyIdentifier, Event.tier, Event.chainCount, Event.points]),
    [
      ['chorus', 'razor', 1, 2100],
      ['starwell', 'assist', 2, 2600],
    ],
  );
  assert.deepEqual(
    predictSlingshotEvents(CorePrediction.points, Runtime.worlds, {
      runnerRadius: 0.46,
      ignoredBodyIdentifier: 'starwell',
    }).map((Event) => [Event.bodyIdentifier, Event.tier, Event.points]),
    [['dawn', 'deep', 1700]],
  );
  const MasteryLiberationScore = ['memory', 'dawn', 'starwell']
    .map((Identifier) => world(Identifier).liberationValue)
    .reduce((Total, Value) => Total + Value, 0);
  assert.equal(MasteryLiberationScore + 4700 + 1700 + (3 * 1000), 14600);
});

test('orbit trap counts wrapped travel and ignores a short graze', () => {
  const World = {
    id: 'well',
    radius: 1.6,
    position: { x: 0, y: 0, z: 0 },
  };
  const TrapState = createOrbitTrapState();
  const Radius = 3.2;
  const StepRadians = 4 * (Math.PI / 180);
  let Trapped = false;
  for (let StepIndex = 0; StepIndex < 200; StepIndex += 1) {
    const Angle = StepIndex * StepRadians;
    Trapped = advanceOrbitTrap(TrapState, {
      x: Math.cos(Angle) * Radius,
      y: Math.sin(Angle) * Radius,
      z: 0,
    }, [World]);
    if (Trapped) {
      assert.ok(StepIndex + 1 >= OrbitTrapMinSteps);
      assert.ok(TrapState.accumulatedAngle >= OrbitTrapRevolutions * Math.PI * 2);
      break;
    }
  }
  assert.equal(Trapped, true);

  const GrazeState = createOrbitTrapState();
  for (let StepIndex = 0; StepIndex < 40; StepIndex += 1) {
    const Angle = StepIndex * StepRadians;
    assert.equal(advanceOrbitTrap(GrazeState, {
      x: Math.cos(Angle) * Radius,
      y: Math.sin(Angle) * Radius,
      z: 0,
    }, [World]), false);
  }
  assert.equal(advanceOrbitTrap(GrazeState, { x: 20, y: 0, z: 0 }, [World]), false);
  assert.equal(GrazeState.worldIdentifier, null);
});
