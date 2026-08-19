/**
 * WORLDSEED physics helpers.
 *
 * This module intentionally has no Three.js dependency. Keeping the core trajectory
 * calculations framework-agnostic makes the launch model deterministic, easy to test,
 * and suitable for use both by the live seed simulation and the trajectory preview.
 */

import { hasClearedLaunchOrigin } from './sim-constants.js?v=20260819-ob133';

/**
 * Creates a small immutable-style vector object used by the deterministic physics layer.
 *
 * @param {number} PositionX - X component in world units.
 * @param {number} PositionY - Y component in world units.
 * @param {number} PositionZ - Z component in world units.
 * @returns {{x: number, y: number, z: number}} A vector value.
 */
export function createVector(PositionX = 0, PositionY = 0, PositionZ = 0) {
  return { x: PositionX, y: PositionY, z: PositionZ };
}

export const BreakerBurnImpulse = 3.4;

function clonePhysicsState(PhysicsState) {
  return {
    position: createVector(
      PhysicsState.position.x,
      PhysicsState.position.y,
      PhysicsState.position.z,
    ),
    velocity: createVector(
      PhysicsState.velocity.x,
      PhysicsState.velocity.y,
      PhysicsState.velocity.z,
    ),
  };
}

function getBurnDirection(PhysicsState, Direction) {
  if (
    Direction
    && Number.isFinite(Direction.x)
    && Number.isFinite(Direction.y)
    && Math.hypot(Direction.x, Direction.y) > 0
  ) {
    const Length = Math.hypot(Direction.x, Direction.y);
    return { x: Direction.x / Length, y: Direction.y / Length };
  }
  const Speed = Math.hypot(PhysicsState.velocity.x, PhysicsState.velocity.y);
  if (!(Speed > 0)) {
    return { x: 1, y: 0 };
  }
  return {
    x: PhysicsState.velocity.x / Speed,
    y: PhysicsState.velocity.y / Speed,
  };
}

/**
 * Heading-only Break uses current velocity. A stalled ship still burns away from
 * the launch world so Space is never a silent no-op.
 */
export function getBreakerBurnDirection(PhysicsState, OriginPosition = null) {
  const Speed = Math.hypot(PhysicsState.velocity.x, PhysicsState.velocity.y);
  if (Speed > 0.08) {
    return {
      x: PhysicsState.velocity.x / Speed,
      y: PhysicsState.velocity.y / Speed,
    };
  }
  if (
    OriginPosition
    && Number.isFinite(OriginPosition.x)
    && Number.isFinite(OriginPosition.y)
  ) {
    const EscapeX = PhysicsState.position.x - OriginPosition.x;
    const EscapeY = PhysicsState.position.y - OriginPosition.y;
    const EscapeLength = Math.hypot(EscapeX, EscapeY);
    if (EscapeLength > 0) {
      return { x: EscapeX / EscapeLength, y: EscapeY / EscapeLength };
    }
  }
  return { x: 1, y: 0 };
}

/** Applies the one-shot Burn along a dragged direction, or current heading if none is given. */
export function applyBreakerBurn(PhysicsState, Impulse = BreakerBurnImpulse, Direction = null) {
  const BurnDirection = getBurnDirection(PhysicsState, Direction);
  if (!BurnDirection || !(Impulse > 0) || !Number.isFinite(Impulse)) {
    return clonePhysicsState(PhysicsState);
  }
  const NextState = clonePhysicsState(PhysicsState);
  NextState.velocity.x += BurnDirection.x * Impulse;
  NextState.velocity.y += BurnDirection.y * Impulse;
  return NextState;
}

/** Fast enough to leave Grove and Ember after the first hop; a mid pull still rides gravity. */
export const MaximumLaunchSpeed = 16.5;

/** Tight wells that never intersect still recover after this many revolutions. */
export const OrbitTrapOuterRadiusFactor = 2.8;
export const OrbitTrapRevolutions = 1.35;
export const OrbitTrapMinSteps = 96;
/** 3 s at 120 Hz: a crawl that never completes a revolution still recovers. */
export const FlightStallTimeoutSteps = 360;
export const FlightStallDisplacement = 0.5;
/**
 * 2 s at 120 Hz. A skim just outside collision looks landed, kills walk,
 * and never completes a revolution. Recapture before the run dies. The
 * launch-origin world is ignored so a normal throw can leave the dock.
 */
export const FlightSkimTimeoutSteps = 240;
/** Thin shell beyond the collision radius. Origin-world launch height is ignored. */
export const FlightSkimClearance = 0.72;

/** Creates persistent orbit-trap accumulators shared by live flight, prediction and replay. */
export function createOrbitTrapState() {
  return {
    worldIdentifier: null,
    lastAngle: 0,
    accumulatedAngle: 0,
    steps: 0,
    stallX: 0,
    stallY: 0,
    stallSteps: 0,
    stallAnchored: false,
    skimWorldIdentifier: null,
    skimSteps: 0,
  };
}

/**
 * Counts wrapped travel around the nearest well. A graze that never collides still
 * recovers once the Runner has looped instead of flying forever.
 */
export function advanceOrbitTrap(
  TrapState,
  Position,
  WorldDefinitions,
  IgnoredWorldIdentifier = null,
) {
  if (!TrapState.stallAnchored) {
    TrapState.stallX = Position.x;
    TrapState.stallY = Position.y;
    TrapState.stallAnchored = true;
    TrapState.stallSteps = 0;
  } else {
    const StallDisplacement = Math.hypot(
      Position.x - TrapState.stallX,
      Position.y - TrapState.stallY,
    );
    if (StallDisplacement >= FlightStallDisplacement) {
      TrapState.stallX = Position.x;
      TrapState.stallY = Position.y;
      TrapState.stallSteps = 0;
    } else {
      TrapState.stallSteps += 1;
      if (TrapState.stallSteps >= FlightStallTimeoutSteps) {
        return true;
      }
    }
  }

  let NearestWorld = null;
  let NearestDistance = Infinity;
  for (const WorldDefinition of WorldDefinitions) {
    const Distance = Math.hypot(
      Position.x - WorldDefinition.position.x,
      Position.y - WorldDefinition.position.y,
    );
    const OuterRadius = WorldDefinition.radius * OrbitTrapOuterRadiusFactor;
    if (Distance <= OuterRadius && Distance < NearestDistance) {
      NearestWorld = WorldDefinition;
      NearestDistance = Distance;
    }
  }
  if (!NearestWorld) {
    TrapState.worldIdentifier = null;
    TrapState.lastAngle = 0;
    TrapState.accumulatedAngle = 0;
    TrapState.steps = 0;
    TrapState.skimWorldIdentifier = null;
    TrapState.skimSteps = 0;
    return false;
  }
  const SkimLimit = NearestWorld.radius + FlightSkimClearance;
  if (
    NearestDistance <= SkimLimit
    && NearestWorld.id !== IgnoredWorldIdentifier
  ) {
    if (TrapState.skimWorldIdentifier !== NearestWorld.id) {
      TrapState.skimWorldIdentifier = NearestWorld.id;
      TrapState.skimSteps = 1;
    } else {
      TrapState.skimSteps += 1;
      if (TrapState.skimSteps >= FlightSkimTimeoutSteps) {
        return true;
      }
    }
  } else {
    TrapState.skimWorldIdentifier = null;
    TrapState.skimSteps = 0;
  }
  const Angle = Math.atan2(
    Position.y - NearestWorld.position.y,
    Position.x - NearestWorld.position.x,
  );
  if (TrapState.worldIdentifier !== NearestWorld.id) {
    TrapState.worldIdentifier = NearestWorld.id;
    TrapState.lastAngle = Angle;
    TrapState.accumulatedAngle = 0;
    TrapState.steps = 0;
    return false;
  }
  let Delta = Angle - TrapState.lastAngle;
  if (Delta > Math.PI) {
    Delta -= Math.PI * 2;
  }
  if (Delta < -Math.PI) {
    Delta += Math.PI * 2;
  }
  TrapState.lastAngle = Angle;
  TrapState.accumulatedAngle += Math.abs(Delta);
  TrapState.steps += 1;
  return TrapState.steps >= OrbitTrapMinSteps
    && TrapState.accumulatedAngle >= OrbitTrapRevolutions * Math.PI * 2;
}

/**
 * Calculates the squared distance between two positions.
 *
 * @param {{x:number,y:number,z:number}} FirstPosition - First position.
 * @param {{x:number,y:number,z:number}} SecondPosition - Second position.
 * @returns {number} Squared distance in world units.
 */
export function calculateDistanceSquared(FirstPosition, SecondPosition) {
  const DifferenceX = SecondPosition.x - FirstPosition.x;
  const DifferenceY = SecondPosition.y - FirstPosition.y;
  const DifferenceZ = SecondPosition.z - FirstPosition.z;

  return (DifferenceX * DifferenceX) + (DifferenceY * DifferenceY) + (DifferenceZ * DifferenceZ);
}

/**
 * Calculates gravitational acceleration from every world at a supplied position.
 *
 * Each world uses a tuned gravitational parameter rather than real-world units. A small
 * softening term prevents extreme numerical acceleration very close to a world's centre,
 * while the maximum acceleration clamp keeps near-surface launches predictable.
 *
 * @param {{x:number,y:number,z:number}} SeedPosition - Current seed position.
 * @param {Array<{position:{x:number,y:number,z:number}, gravitationalParameter:number}>} WorldDefinitions - Gravity sources.
 * @param {number} GravitySofteningDistance - Softening distance used to stabilise the inverse-square calculation.
 * @param {number} MaximumAcceleration - Maximum total acceleration permitted per world.
 * @returns {{x:number,y:number,z:number}} Combined gravitational acceleration.
 */
export function calculateGravityAcceleration(
  SeedPosition,
  WorldDefinitions,
  GravitySofteningDistance = 0.75,
  MaximumAcceleration = 42,
) {
  const CombinedAcceleration = createVector();

  for (const WorldDefinition of WorldDefinitions) {
    const DifferenceX = WorldDefinition.position.x - SeedPosition.x;
    const DifferenceY = WorldDefinition.position.y - SeedPosition.y;
    const DifferenceZ = WorldDefinition.position.z - SeedPosition.z;
    const RawDistanceSquared = (DifferenceX * DifferenceX) + (DifferenceY * DifferenceY) + (DifferenceZ * DifferenceZ);
    const StabilisedDistanceSquared = Math.max(
      RawDistanceSquared,
      GravitySofteningDistance * GravitySofteningDistance,
    );
    const Distance = Math.sqrt(Math.max(RawDistanceSquared, 0.000001));
    const AccelerationMagnitude = Math.min(
      WorldDefinition.gravitationalParameter / StabilisedDistanceSquared,
      MaximumAcceleration,
    );

    CombinedAcceleration.x += (DifferenceX / Distance) * AccelerationMagnitude;
    CombinedAcceleration.y += (DifferenceY / Distance) * AccelerationMagnitude;
    CombinedAcceleration.z += (DifferenceZ / Distance) * AccelerationMagnitude;
  }

  return CombinedAcceleration;
}

/**
 * Advances one deterministic semi-implicit Euler physics step.
 *
 * @param {{position:{x:number,y:number,z:number},velocity:{x:number,y:number,z:number}}} SeedState - Current simulation state.
 * @param {Array<{position:{x:number,y:number,z:number}, gravitationalParameter:number}>} WorldDefinitions - Gravity sources.
 * @param {number} DeltaTimeSeconds - Fixed simulation step in seconds.
 * @returns {{position:{x:number,y:number,z:number},velocity:{x:number,y:number,z:number}}} New state after one step.
 */
export function simulatePhysicsStep(SeedState, WorldDefinitions, DeltaTimeSeconds) {
  const GravityAcceleration = calculateGravityAcceleration(SeedState.position, WorldDefinitions);
  const NewVelocity = createVector(
    SeedState.velocity.x + (GravityAcceleration.x * DeltaTimeSeconds),
    SeedState.velocity.y + (GravityAcceleration.y * DeltaTimeSeconds),
    SeedState.velocity.z + (GravityAcceleration.z * DeltaTimeSeconds),
  );
  const NewPosition = createVector(
    SeedState.position.x + (NewVelocity.x * DeltaTimeSeconds),
    SeedState.position.y + (NewVelocity.y * DeltaTimeSeconds),
    SeedState.position.z + (NewVelocity.z * DeltaTimeSeconds),
  );

  return {
    position: NewPosition,
    velocity: NewVelocity,
  };
}

/**
 * Returns the first world intersected by the seed at a point sample.
 *
 * The live game uses sufficiently small fixed simulation steps that a point-vs-expanded-
 * sphere collision is stable for the jam's launch speeds. The world's radius is expanded
 * by the seed radius so that the visual spheres touch rather than overlap.
 *
 * @param {{x:number,y:number,z:number}} SeedPosition - Sampled seed position.
 * @param {number} SeedRadius - Seed collision radius.
 * @param {Array<{id:string,position:{x:number,y:number,z:number},radius:number}>} WorldDefinitions - Candidate worlds.
 * @param {string|null} IgnoredWorldIdentifier - Optional world to ignore during launch grace.
 * @returns {object|null} The intersected world definition or null.
 */
export function findCollidingWorld(
  SeedPosition,
  SeedRadius,
  WorldDefinitions,
  IgnoredWorldIdentifier = null,
) {
  for (const WorldDefinition of WorldDefinitions) {
    if (WorldDefinition.id === IgnoredWorldIdentifier) {
      continue;
    }

    const CollisionDistance = WorldDefinition.radius + SeedRadius;
    const CollisionDistanceSquared = CollisionDistance * CollisionDistance;

    if (calculateDistanceSquared(SeedPosition, WorldDefinition.position) <= CollisionDistanceSquared) {
      return WorldDefinition;
    }
  }

  return null;
}

/**
 * Resolves the deterministic position of a static or orbiting tactical body.
 *
 * Orbiting bodies use authored circular paths in the gameplay plane. Their position is
 * therefore a pure function of fixed simulation time and can be sampled identically by
 * trajectory prediction and live flight.
 *
 * @param {object} BodyDefinition - Static body or body with an orbit definition.
 * @param {number} SimulationTimeSeconds - Fixed simulation time to sample.
 * @returns {{x:number,y:number,z:number}} Body position at the supplied time.
 */
export function calculateBodyPositionAtTime(BodyDefinition, SimulationTimeSeconds) {
  if (!BodyDefinition.orbit) {
    return createVector(
      BodyDefinition.position.x,
      BodyDefinition.position.y,
      BodyDefinition.position.z,
    );
  }

  const OrbitAngle = BodyDefinition.orbit.phaseRadians
    + (SimulationTimeSeconds * BodyDefinition.orbit.angularSpeedRadiansPerSecond);
  return createVector(
    BodyDefinition.orbit.centre.x + (Math.cos(OrbitAngle) * BodyDefinition.orbit.radius),
    BodyDefinition.orbit.centre.y + (Math.sin(OrbitAngle) * BodyDefinition.orbit.radius),
    BodyDefinition.orbit.centre.z,
  );
}

/**
 * Finds a collision with a deterministic tactical body at one fixed-step sample.
 *
 * @param {{x:number,y:number,z:number}} SeedPosition - Sampled seed position.
 * @param {number} SeedRadius - Seed collision radius.
 * @param {Array<object>} BodyDefinitions - Static or orbiting collision bodies.
 * @param {number} SimulationTimeSeconds - Fixed time associated with the sample.
 * @param {string|null} IgnoredBodyIdentifier - Optional launch body to ignore.
 * @returns {{definition:object,position:{x:number,y:number,z:number}}|null} Collision result.
 */
export function findCollidingBody(
  SeedPosition,
  SeedRadius,
  BodyDefinitions,
  SimulationTimeSeconds,
  IgnoredBodyIdentifier = null,
) {
  for (const BodyDefinition of BodyDefinitions) {
    if (BodyDefinition.id === IgnoredBodyIdentifier || BodyDefinition.active === false) {
      continue;
    }

    const BodyPosition = calculateBodyPositionAtTime(BodyDefinition, SimulationTimeSeconds);
    const CollisionDistance = BodyDefinition.radius + SeedRadius;
    if (
      calculateDistanceSquared(SeedPosition, BodyPosition)
      <= (CollisionDistance * CollisionDistance)
    ) {
      return { definition: BodyDefinition, position: BodyPosition };
    }
  }

  return null;
}

/**
 * Predicts a launch trajectory using the same deterministic physics step as live gameplay.
 *
 * @param {{x:number,y:number,z:number}} StartingPosition - Position where launch begins.
 * @param {{x:number,y:number,z:number}} StartingVelocity - Launch velocity.
 * @param {Array<object>} WorldDefinitions - World definitions used for gravity and collision.
 * @param {object} PredictionSettings - Tunable prediction parameters.
 * @param {number} PredictionSettings.seedRadius - Seed collision radius.
 * @param {number} PredictionSettings.fixedStepSeconds - Physics step duration.
 * @param {number} PredictionSettings.maximumSteps - Maximum points to predict.
 * @param {string|null} PredictionSettings.ignoredWorldIdentifier - Starting world ignored until the trajectory clears it.
 * @param {Array<object>} [PredictionSettings.collisionBodyDefinitions] - Optional deterministic tactical bodies.
 * @param {string|null} [PredictionSettings.ignoredCollisionBodyIdentifier] - Optional tactical launch body to ignore.
 * @param {number} [PredictionSettings.startTimeSeconds] - Fixed simulation time at launch.
 * @returns {{points:Array<{x:number,y:number,z:number}>, collisionWorldIdentifier:string|null, collisionBodyIdentifier:string|null, collisionKind:string|null, collisionTimeSeconds:number|null}} Predicted points and collision outcome.
 */
export function predictTrajectory(
  StartingPosition,
  StartingVelocity,
  WorldDefinitions,
  PredictionSettings,
) {
  const PredictedPoints = [createVector(StartingPosition.x, StartingPosition.y, StartingPosition.z)];
  let PredictedState = {
    position: createVector(StartingPosition.x, StartingPosition.y, StartingPosition.z),
    velocity: createVector(StartingVelocity.x, StartingVelocity.y, StartingVelocity.z),
  };
  let CollisionWorldIdentifier = null;
  let CollisionBodyIdentifier = null;
  let CollisionKind = null;
  let CollisionTimeSeconds = null;
  let IgnoredWorldIdentifier = PredictionSettings.ignoredWorldIdentifier;
  let IgnoredCollisionBodyIdentifier = (
    PredictionSettings.ignoredCollisionBodyIdentifier ?? null
  );
  const CollisionBodyDefinitions = PredictionSettings.collisionBodyDefinitions ?? [];
  const StartingSimulationTimeSeconds = PredictionSettings.startTimeSeconds ?? 0;
  const OrbitTrapState = createOrbitTrapState();

  for (let PredictionStepIndex = 0; PredictionStepIndex < PredictionSettings.maximumSteps; PredictionStepIndex += 1) {
    PredictedState = simulatePhysicsStep(
      PredictedState,
      WorldDefinitions,
      PredictionSettings.fixedStepSeconds,
    );

    if (IgnoredWorldIdentifier) {
      const StartingWorldDefinition = WorldDefinitions.find(
        (WorldDefinition) => WorldDefinition.id === IgnoredWorldIdentifier,
      );

      if (StartingWorldDefinition) {
        if (hasClearedLaunchOrigin({
          originRadius: StartingWorldDefinition.radius,
          originX: StartingWorldDefinition.position.x,
          originY: StartingWorldDefinition.position.y,
          originZ: StartingWorldDefinition.position.z,
          runnerX: PredictedState.position.x,
          runnerY: PredictedState.position.y,
          runnerZ: PredictedState.position.z,
          seedRadius: PredictionSettings.seedRadius,
          elapsedSteps: PredictionStepIndex + 1,
        })) {
          IgnoredWorldIdentifier = null;
        }
      } else {
        IgnoredWorldIdentifier = null;
      }
    }

    PredictedPoints.push(PredictedState.position);

    const PredictionTimeSeconds = StartingSimulationTimeSeconds
      + ((PredictionStepIndex + 1) * PredictionSettings.fixedStepSeconds);
    const CollisionWorldDefinition = findCollidingWorld(
      PredictedState.position,
      PredictionSettings.seedRadius,
      WorldDefinitions,
      IgnoredWorldIdentifier,
    );
    const CollisionBody = findCollidingBody(
      PredictedState.position,
      PredictionSettings.seedRadius,
      CollisionBodyDefinitions,
      PredictionTimeSeconds,
      IgnoredCollisionBodyIdentifier,
    );

    if (CollisionBody) {
      CollisionBodyIdentifier = CollisionBody.definition.id;
      CollisionKind = CollisionBody.definition.kind;
      CollisionTimeSeconds = PredictionTimeSeconds;
      break;
    }

    if (CollisionWorldDefinition) {
      CollisionWorldIdentifier = CollisionWorldDefinition.id;
      CollisionKind = 'world';
      CollisionTimeSeconds = PredictionTimeSeconds;
      break;
    }

    if (advanceOrbitTrap(
      OrbitTrapState,
      PredictedState.position,
      WorldDefinitions,
      IgnoredWorldIdentifier,
    )) {
      break;
    }

    if (IgnoredCollisionBodyIdentifier) {
      const IgnoredBodyDefinition = CollisionBodyDefinitions.find(
        (BodyDefinition) => BodyDefinition.id === IgnoredCollisionBodyIdentifier,
      );
      if (!IgnoredBodyDefinition) {
        IgnoredCollisionBodyIdentifier = null;
      } else {
        const IgnoredBodyPosition = calculateBodyPositionAtTime(
          IgnoredBodyDefinition,
          PredictionTimeSeconds,
        );
        if (hasClearedLaunchOrigin({
          originRadius: IgnoredBodyDefinition.radius,
          originX: IgnoredBodyPosition.x,
          originY: IgnoredBodyPosition.y,
          originZ: IgnoredBodyPosition.z,
          runnerX: PredictedState.position.x,
          runnerY: PredictedState.position.y,
          runnerZ: PredictedState.position.z,
          seedRadius: PredictionSettings.seedRadius,
          elapsedSteps: PredictionStepIndex + 1,
        })) {
          IgnoredCollisionBodyIdentifier = null;
        }
      }
    }
  }

  return {
    points: PredictedPoints,
    collisionWorldIdentifier: CollisionWorldIdentifier,
    collisionBodyIdentifier: CollisionBodyIdentifier,
    collisionKind: CollisionKind,
    collisionTimeSeconds: CollisionTimeSeconds,
  };
}
