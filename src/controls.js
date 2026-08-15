const FullCircleRadians = Math.PI * 2;

export const SurfaceGestureModes = Object.freeze({
  pending: 'pending',
  aim: 'aim',
  walk: 'walk',
});

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

/** Moves a keyboard-controlled Runner around the same circumference as pointer walking. */
export function adjustSurfaceAngle(AngleRadians, Direction, { fine = false } = {}) {
  if (!Number.isFinite(AngleRadians)) {
    throw new Error('Surface angle must be finite.');
  }
  const StepRadians = (fine ? 1 : 4) * (Math.PI / 180);
  return normalizeAngle(AngleRadians + (Math.sign(Direction) * StepRadians));
}

/** Describes Scout zoom consistently for buttons, keyboard input and assistive status. */
export function getScoutZoomPresentation(
  Scale,
  { minimumScale = 0.72, maximumScale = 1.55 } = {},
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

/** Keeps keyboard aim state finite, normalized and inside the playable power range. */
export function createKeyboardAimState({
  directionX = 1,
  directionY = 0,
  powerRatio = 1,
} = {}) {
  const DirectionLength = Math.hypot(directionX, directionY);
  const AngleRadians = DirectionLength > 0
    ? Math.atan2(directionY / DirectionLength, directionX / DirectionLength)
    : 0;
  return {
    angleRadians: (AngleRadians + FullCircleRadians) % FullCircleRadians,
    powerRatio: Math.min(1, Math.max(0.04, Number.isFinite(powerRatio) ? powerRatio : 1)),
  };
}

/** Applies one keyboard steering or power adjustment without coupling input to physics. */
export function adjustKeyboardAimState(
  AimState,
  { rotationDirection = 0, powerDirection = 0, fine = false } = {},
) {
  const RotationStepRadians = (fine ? 0.5 : 2) * (Math.PI / 180);
  const PowerStep = fine ? 0.01 : 0.04;
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
