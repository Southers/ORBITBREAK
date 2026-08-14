const FullCircleRadians = Math.PI * 2;

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
