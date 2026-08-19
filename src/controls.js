const FullCircleRadians = Math.PI * 2;

export const SurfaceGestureModes = Object.freeze({
  pending: 'pending',
  aim: 'aim',
  walk: 'walk',
});

/** Where a landed pointer-down starts. The verb stays locked for the whole gesture. */
export const LandedPointerTargets = Object.freeze({
  ship: 'ship',
  cage: 'cage',
  world: 'world',
  space: 'space',
});

/**
 * Hull mesh wins over a cage halo so Bastion ship-pull still aims. A finger
 * on the cage itself still Destroys. Proximity ship halo still yields to cage.
 */
export function classifyLandedPointerStart({
  isOverShip = false,
  isOverCage = false,
  isOverWorld = false,
  isOverShipMesh = false,
} = {}) {
  if (isOverShipMesh === true) {
    return LandedPointerTargets.ship;
  }
  if (isOverCage === true) {
    return LandedPointerTargets.cage;
  }
  if (isOverShip === true) {
    return LandedPointerTargets.ship;
  }
  if (isOverWorld === true) {
    return LandedPointerTargets.world;
  }
  return LandedPointerTargets.space;
}

/**
 * Generous screen halo around the ship in empty space, larger than the tiny
 * diorama mesh. Used only when the parked world is a small scout target.
 */
export const SeedScreenGrabRadiusPixels = 96;
/**
 * On a filling phone globe, min(72, worldRadius*0.38) became a ~210px disc
 * that armed launch over half of 390px. Grab the parked hull only.
 */
export const SeedOnGlobeGrabRadiusPixels = 48;
/** Floor so a tiny world still has a tappable hull disk. */
export const SeedOnGlobeGrabMinRadiusPixels = 28;
/**
 * Hull disk as a fraction of world screen radius. 0.38 of a filling planet
 * swallowed the crust; 0.22 covers the parked hull without eating the walk.
 */
export const SeedOnGlobeGrabWorldRadiusScale = 0.22;

/**
 * Ship grab is the parked hull on a filling globe, and the 96px empty-space
 * halo only when the world is a small scout target. Crust drags walk; a
 * finger on or near a cage still Destroy.
 */
export function getLandedShipGrabRadiusPixels({
  isOverWorld = false,
  worldScreenRadiusPixels = Number.POSITIVE_INFINITY,
  haloPixels = SeedScreenGrabRadiusPixels,
  onGlobePixels = SeedOnGlobeGrabRadiusPixels,
  onGlobeMinPixels = SeedOnGlobeGrabMinRadiusPixels,
  onGlobeWorldRadiusScale = SeedOnGlobeGrabWorldRadiusScale,
} = {}) {
  if (
    !(haloPixels > 0)
    || !Number.isFinite(haloPixels)
    || !(onGlobePixels > 0)
    || !Number.isFinite(onGlobePixels)
    || !(onGlobeMinPixels > 0)
    || !Number.isFinite(onGlobeMinPixels)
    || !(onGlobeWorldRadiusScale > 0)
    || !Number.isFinite(onGlobeWorldRadiusScale)
  ) {
    throw new Error('Ship grab radius requires positive finite pixel sizes.');
  }
  const HasMeasuredWorld = Number.isFinite(worldScreenRadiusPixels);
  const WorldRadiusPixels = HasMeasuredWorld
    ? Math.max(0, worldScreenRadiusPixels)
    : Number.POSITIVE_INFINITY;
  const ScaledHullPixels = Number.isFinite(WorldRadiusPixels)
    ? WorldRadiusPixels * onGlobeWorldRadiusScale
    : onGlobePixels;
  const HullPixels = Math.min(onGlobePixels, Math.max(onGlobeMinPixels, ScaledHullPixels));
  // A filling globe is as large as the empty-space halo, so that 96px disc
  // would arm launch around the parked hull even for presses in the void.
  const WorldFillsScreen = HasMeasuredWorld && WorldRadiusPixels >= haloPixels;
  if (isOverWorld === true || WorldFillsScreen) {
    return HullPixels;
  }
  return haloPixels;
}

/**
 * Phone-thumb halo around a Destroy cage. Larger than the hull-sized ship grab
 * so a finger on or near a cage Destroy, not launch.
 */
export const CageScreenGrabRadiusPixels = 88;

export function getLandedCageGrabRadiusPixels({
  worldScreenRadiusPixels = Number.POSITIVE_INFINITY,
} = {}) {
  if (!(CageScreenGrabRadiusPixels > 0) || !Number.isFinite(CageScreenGrabRadiusPixels)) {
    throw new Error('Cage grab radius requires a positive finite pixel size.');
  }
  const WorldRadiusPixels = Number.isFinite(worldScreenRadiusPixels)
    ? Math.max(0, worldScreenRadiusPixels)
    : Number.POSITIVE_INFINITY;
  return Math.min(110, Math.max(CageScreenGrabRadiusPixels, WorldRadiusPixels * 0.42));
}

/**
 * True when ship and cage screen halos would both claim the same press.
 * Used to keep leftover/default cages outside the parked ship's grab.
 */
export function doLandedCageAndShipHalosOverlap({
  angularSeparationRadians,
  worldScreenRadiusPixels,
} = {}) {
  if (!Number.isFinite(angularSeparationRadians) || !Number.isFinite(worldScreenRadiusPixels)) {
    throw new Error('Cage/ship overlap requires finite angular separation and screen radius.');
  }
  const ArcPixels = Math.abs(angularSeparationRadians) * worldScreenRadiusPixels;
  const ShipHalo = getLandedShipGrabRadiusPixels({
    isOverWorld: true,
    worldScreenRadiusPixels,
  });
  const CageHalo = getLandedCageGrabRadiusPixels({ worldScreenRadiusPixels });
  return ArcPixels < (ShipHalo + CageHalo);
}

function normalizeAngle(AngleRadians) {
  return ((AngleRadians + Math.PI) % FullCircleRadians + FullCircleRadians) % FullCircleRadians
    - Math.PI;
}

/**
 * Distinguishes a deliberate trace around a world's rim from a pull away from it.
 * The decision is pure and becomes locked by the caller for the rest of the gesture.
 */
export function classifySurfaceGesture({
  startPosition,
  currentPosition,
  bodyPosition,
  deadzone = 0.18,
  tangentialBias = 1.18,
}) {
  const StartOffsetX = startPosition.x - bodyPosition.x;
  const StartOffsetY = startPosition.y - bodyPosition.y;
  const StartDistance = Math.hypot(StartOffsetX, StartOffsetY);
  const MovementX = currentPosition.x - startPosition.x;
  const MovementY = currentPosition.y - startPosition.y;
  if (StartDistance <= 0 || Math.hypot(MovementX, MovementY) < deadzone) {
    return SurfaceGestureModes.pending;
  }
  const RadialX = StartOffsetX / StartDistance;
  const RadialY = StartOffsetY / StartDistance;
  const TangentX = -RadialY;
  const TangentY = RadialX;
  const RadialMovement = Math.abs((MovementX * RadialX) + (MovementY * RadialY));
  const TangentialMovement = Math.abs((MovementX * TangentX) + (MovementY * TangentY));
  return TangentialMovement > RadialMovement * tangentialBias
    ? SurfaceGestureModes.walk
    : SurfaceGestureModes.aim;
}

function hypot3(X, Y, Z) {
  return Math.hypot(X, Y, Z);
}

function normalize3(Vector) {
  const Length = hypot3(Vector.x, Vector.y, Vector.z ?? 0) || 1;
  return {
    x: Vector.x / Length,
    y: Vector.y / Length,
    z: (Vector.z ?? 0) / Length,
  };
}

/** Returns a deterministic point on the orbital-plane circumference. */
export function getSurfacePosition(BodyPosition, SurfaceDistance, AngleRadians) {
  if (!(SurfaceDistance > 0) || !Number.isFinite(AngleRadians)) {
    throw new Error('Surface position requires a positive distance and finite angle.');
  }
  return {
    x: BodyPosition.x + (Math.cos(AngleRadians) * SurfaceDistance),
    y: BodyPosition.y + (Math.sin(AngleRadians) * SurfaceDistance),
    z: 0,
  };
}

/** Longitude around Z and latitude toward the poles. Flight still launches from the equator. */
export function createSurfacePose({ longitude = 0, latitude = 0, meridianSign = 1 } = {}) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error('Surface pose requires finite longitude and latitude.');
  }
  return {
    longitude: normalizeAngle(longitude),
    latitude: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, latitude)),
    meridianSign: meridianSign < 0 ? -1 : 1,
  };
}

export function getSurfaceDirection(Pose) {
  const CosLatitude = Math.cos(Pose.latitude);
  return {
    x: CosLatitude * Math.cos(Pose.longitude),
    y: CosLatitude * Math.sin(Pose.longitude),
    z: Math.sin(Pose.latitude),
  };
}

export function getSurfacePoseFromDirection(Direction) {
  const Unit = normalize3(Direction);
  return createSurfacePose({
    longitude: Math.atan2(Unit.y, Unit.x),
    latitude: Math.asin(Math.max(-1, Math.min(1, Unit.z))),
  });
}

export function getSurfacePoseFromPosition(BodyPosition, Position) {
  return getSurfacePoseFromDirection({
    x: Position.x - BodyPosition.x,
    y: Position.y - BodyPosition.y,
    z: (Position.z ?? 0) - (BodyPosition.z ?? 0),
  });
}

/** Places the Runner on the sphere, including over the poles and the far face. */
export function getSphereSurfacePosition(BodyPosition, SurfaceDistance, Pose) {
  if (!(SurfaceDistance > 0)) {
    throw new Error('Sphere surface position requires a positive distance.');
  }
  const Direction = getSurfaceDirection(Pose);
  return {
    x: BodyPosition.x + (Direction.x * SurfaceDistance),
    y: BodyPosition.y + (Direction.y * SurfaceDistance),
    z: (BodyPosition.z ?? 0) + (Direction.z * SurfaceDistance),
  };
}

export function flattenSurfacePoseToEquator(Pose) {
  return createSurfacePose({
    longitude: Pose.longitude,
    latitude: 0,
    meridianSign: 1,
  });
}

/** One keyboard tap, matching a short weighty pointer step rather than a twitch. */
export const SurfaceWalkTapRadians = 2 * (Math.PI / 180);

/** Walks east/west and north/south on the sphere, wrapping over the poles. */
export function adjustSurfacePose(Pose, { east = 0, north = 0, fine = false, stepRadians } = {}) {
  if (!Number.isFinite(Pose?.longitude) || !Number.isFinite(Pose?.latitude)) {
    throw new Error('Surface pose must be finite.');
  }
  const StepRadians = Number.isFinite(stepRadians)
    ? Math.max(0, stepRadians)
    : (fine ? SurfaceWalkTapRadians * 0.5 : SurfaceWalkTapRadians);
  let Longitude = Pose.longitude;
  let Latitude = Pose.latitude;
  let MeridianSign = Pose.meridianSign < 0 ? -1 : 1;
  if (east !== 0) {
    Longitude += Math.sign(east) * StepRadians;
  }
  if (north !== 0) {
    Latitude += Math.sign(north) * MeridianSign * StepRadians;
    if (Latitude > Math.PI / 2) {
      Latitude = Math.PI - Latitude;
      Longitude += Math.PI;
      MeridianSign *= -1;
    } else if (Latitude < -Math.PI / 2) {
      Latitude = -Math.PI - Latitude;
      Longitude += Math.PI;
      MeridianSign *= -1;
    }
  }
  return createSurfacePose({
    longitude: Longitude,
    latitude: Latitude,
    meridianSign: MeridianSign,
  });
}

/** Caps how far one walk sample may travel so the globe has weight. */
export const SurfaceWalkRadiansPerSecond = 0.7;
/** Hard cap so a lagged pointer sample cannot dump a huge arc. */
export const SurfaceWalkMaxRadiansPerSample = 0.12;
/** Ignore globe-hit jitter until the pointer actually traces the crust. */
export const SurfaceWalkPointerDeadzoneRadians = 0.045;
/** Seconds of sustained drag before pointer walk reaches full cruise speed. */
export const SurfaceWalkAccelerationSeconds = 0.32;

export function getSurfaceWalkArcLimit(DeltaTimeSeconds) {
  if (!Number.isFinite(DeltaTimeSeconds) || DeltaTimeSeconds < 0) {
    throw new Error('Walk arc limit requires a non-negative finite duration.');
  }
  return Math.min(
    SurfaceWalkMaxRadiansPerSample,
    DeltaTimeSeconds * SurfaceWalkRadiansPerSecond,
  );
}

/**
 * Pointer walk ramps from a standstill so a flick across the disc cannot
 * sling the Runner around the globe at cruise speed.
 */
export function getSurfaceWalkPointerArcLimit(DeltaTimeSeconds, DragAgeSeconds) {
  const BaseLimit = getSurfaceWalkArcLimit(DeltaTimeSeconds);
  if (!(DragAgeSeconds > 0) || !Number.isFinite(DragAgeSeconds)) {
    return 0;
  }
  const Ramp = Math.max(0, Math.min(1, DragAgeSeconds / SurfaceWalkAccelerationSeconds));
  const EasedRamp = Ramp * Ramp * (3 - (2 * Ramp));
  return BaseLimit * EasedRamp;
}

/** True once a pointer trace has left the press dead-zone on the sphere. */
export function hasLeftSurfaceWalkDeadzone(PressPose, TargetPose, DeadzoneRadians = SurfaceWalkPointerDeadzoneRadians) {
  if (!(DeadzoneRadians >= 0) || !Number.isFinite(DeadzoneRadians)) {
    throw new Error('Walk dead-zone requires a non-negative finite arc.');
  }
  return getGreatCircleAngle(PressPose, TargetPose) >= DeadzoneRadians;
}

export function getGreatCircleAngle(FromPose, ToPose) {
  const Start = getSurfaceDirection(FromPose);
  const Target = getSurfaceDirection(ToPose);
  const Dot = Math.max(-1, Math.min(
    1,
    (Start.x * Target.x) + (Start.y * Target.y) + (Start.z * Target.z),
  ));
  return Math.acos(Dot);
}

/** Walks toward a target pose without snapping across the globe. */
export function stepSurfacePoseToward(FromPose, ToPose, MaxArcRadians) {
  if (!(MaxArcRadians >= 0) || !Number.isFinite(MaxArcRadians)) {
    throw new Error('Walk step requires a non-negative finite arc.');
  }
  const Angle = getGreatCircleAngle(FromPose, ToPose);
  if (Angle <= 1e-6 || MaxArcRadians === 0) {
    return createSurfacePose(FromPose);
  }
  if (Angle <= MaxArcRadians) {
    return createSurfacePose({
      longitude: ToPose.longitude,
      latitude: ToPose.latitude,
      meridianSign: FromPose.meridianSign,
    });
  }
  const Start = getSurfaceDirection(FromPose);
  const Target = getSurfaceDirection(ToPose);
  const T = MaxArcRadians / Angle;
  const Dot = Math.max(-1, Math.min(
    1,
    (Start.x * Target.x) + (Start.y * Target.y) + (Start.z * Target.z),
  ));
  let Stepped;
  if (Dot > 0.9995) {
    Stepped = normalize3({
      x: Start.x + ((Target.x - Start.x) * T),
      y: Start.y + ((Target.y - Start.y) * T),
      z: Start.z + ((Target.z - Start.z) * T),
    });
  } else {
    const Theta = Math.acos(Dot);
    const SinTheta = Math.sin(Theta) || 1;
    const StartWeight = Math.sin((1 - T) * Theta) / SinTheta;
    const TargetWeight = Math.sin(T * Theta) / SinTheta;
    Stepped = {
      x: (Start.x * StartWeight) + (Target.x * TargetWeight),
      y: (Start.y * StartWeight) + (Target.y * TargetWeight),
      z: (Start.z * StartWeight) + (Target.z * TargetWeight),
    };
  }
  return createSurfacePose({
    ...getSurfacePoseFromDirection(Stepped),
    meridianSign: FromPose.meridianSign,
  });
}

/** Moves a keyboard-controlled Runner around the orbital-plane circumference. */
export function adjustSurfaceAngle(AngleRadians, Direction, { fine = false } = {}) {
  if (!Number.isFinite(AngleRadians)) {
    throw new Error('Surface angle must be finite.');
  }
  const StepRadians = (fine ? 1 : 2) * (Math.PI / 180);
  return normalizeAngle(AngleRadians + (Math.sign(Direction) * StepRadians));
}

export function intersectRaySphere(Origin, Direction, Center, Radius, { nearOnly = false } = {}) {
  if (!(Radius > 0)) {
    throw new Error('Sphere intersection requires a positive radius.');
  }
  const Unit = normalize3(Direction);
  const OffsetX = Origin.x - Center.x;
  const OffsetY = Origin.y - Center.y;
  const OffsetZ = (Origin.z ?? 0) - (Center.z ?? 0);
  const HalfB = (OffsetX * Unit.x) + (OffsetY * Unit.y) + (OffsetZ * Unit.z);
  const C = (OffsetX * OffsetX) + (OffsetY * OffsetY) + (OffsetZ * OffsetZ) - (Radius * Radius);
  const Discriminant = (HalfB * HalfB) - C;
  if (Discriminant < 0) {
    return null;
  }
  const Root = Math.sqrt(Discriminant);
  const Near = -HalfB - Root;
  const Far = -HalfB + Root;
  if (nearOnly === true && !(Near >= 0)) {
    return null;
  }
  const Distance = Near >= 0 ? Near : Far;
  if (!(Distance >= 0)) {
    return null;
  }
  return {
    x: Origin.x + (Unit.x * Distance),
    y: Origin.y + (Unit.y * Distance),
    z: (Origin.z ?? 0) + (Unit.z * Distance),
    distance: Distance,
  };
}

/** Closest point on the sphere to a ray, used when a drag leaves the visible limb. */
export function projectRayOntoSphere(Origin, Direction, Center, Radius) {
  const Hit = intersectRaySphere(Origin, Direction, Center, Radius);
  if (Hit) {
    return Hit;
  }
  const Unit = normalize3(Direction);
  const OffsetX = Center.x - Origin.x;
  const OffsetY = Center.y - Origin.y;
  const OffsetZ = (Center.z ?? 0) - (Origin.z ?? 0);
  const Along = Math.max(0, (OffsetX * Unit.x) + (OffsetY * Unit.y) + (OffsetZ * Unit.z));
  const ClosestX = Origin.x + (Unit.x * Along);
  const ClosestY = Origin.y + (Unit.y * Along);
  const ClosestZ = (Origin.z ?? 0) + (Unit.z * Along);
  return {
    ...getSphereSurfacePosition(
      Center,
      Radius,
      getSurfacePoseFromPosition(Center, { x: ClosestX, y: ClosestY, z: ClosestZ }),
    ),
    distance: Along,
  };
}

/**
 * Legacy movement classifier kept for tests. Live play locks walk vs aim from
 * classifyLandedPointerStart instead, so a planet drag cannot become a launch.
 */
export function classifySphereSurfaceGesture({
  worldCenter,
  worldRadius,
  startPosition,
  sphereHit = null,
  planePosition,
  deadzone = 0.18,
}) {
  if (!(worldRadius > 0)) {
    throw new Error('Sphere gesture classification requires a positive world radius.');
  }
  if (sphereHit) {
    const Start = getSurfacePoseFromPosition(worldCenter, startPosition);
    const Target = getSurfacePoseFromPosition(worldCenter, sphereHit);
    const StartDirection = getSurfaceDirection(Start);
    const TargetDirection = getSurfaceDirection(Target);
    const Dot = Math.max(-1, Math.min(
      1,
      (StartDirection.x * TargetDirection.x)
      + (StartDirection.y * TargetDirection.y)
      + (StartDirection.z * TargetDirection.z),
    ));
    const Arc = Math.acos(Dot) * worldRadius;
    return Arc < deadzone ? SurfaceGestureModes.pending : SurfaceGestureModes.walk;
  }
  const PlaneMove = Math.hypot(
    planePosition.x - startPosition.x,
    planePosition.y - startPosition.y,
  );
  return PlaneMove < deadzone ? SurfaceGestureModes.pending : SurfaceGestureModes.aim;
}

/** Describes Scout zoom consistently for buttons, keyboard input and assistive status. */
export function getScoutZoomPresentation(
  Scale,
  { minimumScale = 0.38, maximumScale = 1.95 } = {},
) {
  if (
    !Number.isFinite(Scale)
    || !Number.isFinite(minimumScale)
    || !Number.isFinite(maximumScale)
    || minimumScale <= 0
    || maximumScale <= minimumScale
    || Scale < minimumScale
    || Scale > maximumScale
  ) {
    throw new Error('Scout zoom presentation requires a scale inside valid bounds.');
  }
  const Percentage = Math.round(100 / Scale);
  return {
    percentage: Percentage,
    status: `Scout zoom ${Percentage}%`,
    zoomInLabel: `Scout zoom in, currently ${Percentage}%`,
    zoomOutLabel: `Scout zoom out, currently ${Percentage}%`,
    canZoomIn: Scale > minimumScale,
    canZoomOut: Scale < maximumScale,
  };
}

/**
 * Mid power so W and S both change the throw. Full power from the inner
 * wells dumps every line into a neighbour; starting at 1 made W a no-op.
 */
export const KeyboardAimDefaultPowerRatio = 0.62;
/** Coarse A/D tap. Hold repeats faster so a 135° re-aim is not twenty-odd taps. */
export const KeyboardAimCoarseDegrees = 18;
export const KeyboardAimRepeatDegrees = 26;
export const KeyboardAimFineDegrees = 3;
export const KeyboardAimFineRepeatDegrees = 6;
export const KeyboardAimCoarsePowerStep = 0.1;
export const KeyboardAimRepeatPowerStep = 0.14;
export const KeyboardAimFinePowerStep = 0.02;
export const KeyboardAimHoldDelayMs = 160;
export const KeyboardAimHoldIntervalMs = 45;

/** Space and Enter both fire the aimed throw, including Numpad Enter. */
export function isLaunchKeyboardEvent(KeyboardEventData) {
  const Key = String(KeyboardEventData?.key ?? '').toLowerCase();
  const Code = String(KeyboardEventData?.code ?? '');
  return Key === 'enter' || Key === ' ' || Key === 'spacebar'
    || Code === 'Enter' || Code === 'NumpadEnter' || Code === 'Space';
}

/** Space alone smashes a leftover cage when the ship is not already aiming. */
export function isSpaceKeyboardEvent(KeyboardEventData) {
  const Key = String(KeyboardEventData?.key ?? '').toLowerCase();
  const Code = String(KeyboardEventData?.code ?? '');
  return Key === ' ' || Key === 'spacebar' || Code === 'Space';
}

/** Keeps keyboard aim state finite, normalized and inside the playable power range. */
export function createKeyboardAimState({
  directionX = 1,
  directionY = 0,
  powerRatio = KeyboardAimDefaultPowerRatio,
} = {}) {
  const DirectionLength = Math.hypot(directionX, directionY);
  const AngleRadians = DirectionLength > 0
    ? Math.atan2(directionY / DirectionLength, directionX / DirectionLength)
    : 0;
  const FallbackPower = KeyboardAimDefaultPowerRatio;
  return {
    angleRadians: (AngleRadians + FullCircleRadians) % FullCircleRadians,
    powerRatio: Math.min(
      1,
      Math.max(0.04, Number.isFinite(powerRatio) ? powerRatio : FallbackPower),
    ),
  };
}

/** Applies one keyboard steering or power adjustment without coupling input to physics. */
export function adjustKeyboardAimState(
  AimState,
  { rotationDirection = 0, powerDirection = 0, fine = false, repeat = false } = {},
) {
  const CoarseDegrees = repeat === true ? KeyboardAimRepeatDegrees : KeyboardAimCoarseDegrees;
  const FineDegrees = repeat === true ? KeyboardAimFineRepeatDegrees : KeyboardAimFineDegrees;
  const RotationStepRadians = (fine ? FineDegrees : CoarseDegrees) * (Math.PI / 180);
  const PowerStep = fine
    ? KeyboardAimFinePowerStep
    : (repeat === true ? KeyboardAimRepeatPowerStep : KeyboardAimCoarsePowerStep);
  return {
    angleRadians: (
      AimState.angleRadians
      + (Math.sign(rotationDirection) * RotationStepRadians)
      + FullCircleRadians
    ) % FullCircleRadians,
    powerRatio: Math.min(
      1,
      Math.max(0.04, AimState.powerRatio + (Math.sign(powerDirection) * PowerStep)),
    ),
  };
}

/** Converts keyboard angle and power into the same world-space pull vector as pointer input. */
export function getKeyboardAimDragVector(AimState, MaximumDragDistance) {
  const DragDistance = MaximumDragDistance * AimState.powerRatio;
  return {
    x: Math.cos(AimState.angleRadians) * DragDistance,
    y: Math.sin(AimState.angleRadians) * DragDistance,
  };
}

/** Finds the nearest bounded angle accepted by a deterministic route-lock predicate. */
export function findNearestKeyboardAimAngle(
  BaseAngleRadians,
  LocksRouteAtAngle,
  {
    stepRadians = 2 * (Math.PI / 180),
    maximumOffsetRadians = 60 * (Math.PI / 180),
  } = {},
) {
  if (
    !Number.isFinite(BaseAngleRadians)
    || typeof LocksRouteAtAngle !== 'function'
    || !(stepRadians > 0)
    || !(maximumOffsetRadians >= 0)
  ) {
    throw new Error('Keyboard aim search requires a finite angle, predicate and bounded steps.');
  }
  const NormalizedBaseAngle = (
    (BaseAngleRadians % FullCircleRadians) + FullCircleRadians
  ) % FullCircleRadians;
  const MaximumStepCount = Math.floor(maximumOffsetRadians / stepRadians);
  for (let StepIndex = 0; StepIndex <= MaximumStepCount; StepIndex += 1) {
    const CandidateOffsets = StepIndex === 0
      ? [0]
      : [StepIndex * stepRadians, -StepIndex * stepRadians];
    for (const CandidateOffset of CandidateOffsets) {
      const CandidateAngle = (
        NormalizedBaseAngle + CandidateOffset + FullCircleRadians
      ) % FullCircleRadians;
      if (LocksRouteAtAngle(CandidateAngle)) return CandidateAngle;
    }
  }
  return NormalizedBaseAngle;
}

/** Wheel and pinch share one scale so Scout, follow and flight stay on the same zoom. */
export function clampCameraZoomScale(
  Scale,
  { minimumScale = 0.38, maximumScale = 1.95 } = {},
) {
  if (
    !Number.isFinite(Scale)
    || !Number.isFinite(minimumScale)
    || !Number.isFinite(maximumScale)
    || minimumScale <= 0
    || maximumScale <= minimumScale
  ) {
    throw new Error('Camera zoom requires finite bounds.');
  }
  return Math.min(maximumScale, Math.max(minimumScale, Scale));
}

/** Spreading fingers zooms in (smaller camera scale). */
export function getPinchZoomScale(
  StartDistance,
  CurrentDistance,
  StartScale,
  { minimumScale = 0.38, maximumScale = 1.95 } = {},
) {
  if (!(StartDistance > 0) || !(CurrentDistance > 0) || !Number.isFinite(StartScale)) {
    throw new Error('Pinch zoom requires positive pointer distance and a finite start scale.');
  }
  return clampCameraZoomScale(
    StartScale * (StartDistance / CurrentDistance),
    { minimumScale, maximumScale },
  );
}

export function getPointerClientDistance(FirstPointer, SecondPointer) {
  if (
    !Number.isFinite(FirstPointer?.clientX)
    || !Number.isFinite(FirstPointer?.clientY)
    || !Number.isFinite(SecondPointer?.clientX)
    || !Number.isFinite(SecondPointer?.clientY)
  ) {
    throw new Error('Pinch distance requires two client pointers.');
  }
  return Math.hypot(
    SecondPointer.clientX - FirstPointer.clientX,
    SecondPointer.clientY - FirstPointer.clientY,
  );
}

/** Keeps landed empty-space pans from losing the courier off-screen. */
export function clampLandedCameraPanOffset(offset, worldRadius, maxRadiusScale = 0.42) {
  const X = Number(offset?.x);
  const Y = Number(offset?.y);
  const Radius = Number(worldRadius);
  if (!Number.isFinite(X) || !Number.isFinite(Y)) {
    return { x: 0, y: 0 };
  }
  if (!Number.isFinite(Radius) || Radius <= 0) {
    return { x: X, y: Y };
  }
  const MaxLength = Radius * maxRadiusScale;
  const Length = Math.hypot(X, Y);
  if (Length <= MaxLength) {
    return { x: X, y: Y };
  }
  const Scale = MaxLength / Length;
  return { x: X * Scale, y: Y * Scale };
}

/** Screen pull that leaves a ship-locked twitch pending and then shows the aim tether. */
export const ShipGrabAimDeadzonePixels = 20;

/**
 * Ship grab never walks. A tiny screen twitch stays pending; anything past the
 * deadzone aims, including while the camera ray still hits the globe.
 */
export function classifyPendingShipGrab({
  screenDistanceFromShip,
  deadzonePixels = ShipGrabAimDeadzonePixels,
} = {}) {
  if (!Number.isFinite(screenDistanceFromShip) || screenDistanceFromShip < 0) {
    throw new Error('Pending ship grab requires a non-negative screen distance.');
  }
  if (!(deadzonePixels > 0) || !Number.isFinite(deadzonePixels)) {
    throw new Error('Pending ship grab requires a positive deadzone.');
  }
  return screenDistanceFromShip < deadzonePixels
    ? SurfaceGestureModes.pending
    : SurfaceGestureModes.aim;
}

export const AimCameraStages = Object.freeze({
  globe: 'globe',
  planning: 'planning',
});

/**
 * Flatten happens immediately. The neighbourhood map waits until the pull leaves
 * the cancel disk, unless reduced motion or a prior commit already snapped.
 */
export function getAimCameraStage({
  willCancel,
  hasCommitted,
  prefersReducedMotion = false,
} = {}) {
  if (prefersReducedMotion || hasCommitted || !willCancel) {
    return AimCameraStages.planning;
  }
  return AimCameraStages.globe;
}

/** True when a key should type into a field instead of firing a game hotkey. */
export function isEditingTextField(Target) {
  if (!Target || typeof Target !== 'object') {
    return false;
  }
  if (Target.isContentEditable === true) {
    return true;
  }
  const TagName = typeof Target.tagName === 'string' ? Target.tagName.toUpperCase() : '';
  return TagName === 'INPUT' || TagName === 'TEXTAREA' || TagName === 'SELECT';
}

/** World-space cancel disk used when the planning camera has not jumped yet. */
export const LaunchCancelRadius = 0.85;
/** Screen-space cancel disk so a zoomed-out aim can still be dropped on the visible ship. */
export const LaunchCancelScreenRadiusPixels = 52;

/**
 * A committed pull still launches. Dragging back onto the ship, or never pulling far
 * enough, cancels without spending the flight. After aiming zooms out, world units shrink
 * on screen, so a constant pixel radius around the visible ship is also a cancel.
 */
export function shouldCancelAimedLaunch({
  pointerDistanceFromShip,
  cancelRadius = LaunchCancelRadius,
  screenDistancePixels = Number.POSITIVE_INFINITY,
  screenCancelRadiusPixels = LaunchCancelScreenRadiusPixels,
} = {}) {
  if (!Number.isFinite(pointerDistanceFromShip) || pointerDistanceFromShip < 0) {
    throw new Error('Launch cancel requires a non-negative ship distance.');
  }
  if (!(cancelRadius > 0) || !Number.isFinite(cancelRadius)) {
    throw new Error('Launch cancel requires a positive cancel radius.');
  }
  if (Number.isFinite(screenDistancePixels) && screenDistancePixels < 0) {
    throw new Error('Launch cancel requires a non-negative screen distance.');
  }
  if (!(screenCancelRadiusPixels > 0) || !Number.isFinite(screenCancelRadiusPixels)) {
    throw new Error('Launch cancel requires a positive screen cancel radius.');
  }
  const ScreenCancel = Number.isFinite(screenDistancePixels)
    && screenDistancePixels <= screenCancelRadiusPixels;
  return pointerDistanceFromShip <= cancelRadius || ScreenCancel;
}
