/** Maps gameplay state to one legible Runner animation state. */
export function getRunnerAnimationState(GamePhase, IsPointerAiming) {
  if (GamePhase === 'runFailed' || GamePhase === 'recovering') {
    return 'recovering';
  }
  if (GamePhase === 'restoring' || GamePhase === 'victoryPending' || GamePhase === 'victory') {
    return 'liberating';
  }
  if (GamePhase === 'flying') {
    return 'flying';
  }
  if (IsPointerAiming) {
    return 'aiming';
  }
  return 'ready';
}

/** Returns the target limb pose without introducing frame-rate-dependent state. */
export function getRunnerPose(AnimationState) {
  const Poses = {
    ready: { armAngle: 0.22, legAngle: 0.08, thrusterVisible: false },
    aiming: { armAngle: 0.72, legAngle: 0.26, thrusterVisible: false },
    flying: { armAngle: -0.5, legAngle: 0.36, thrusterVisible: true },
    liberating: { armAngle: 1.78, legAngle: 0.42, thrusterVisible: false },
    recovering: { armAngle: 1.18, legAngle: 0.78, thrusterVisible: false },
  };
  return Poses[AnimationState] ?? Poses.ready;
}

/** Keeps the transformation visual-only while giving launch and flight distinct silhouettes. */
export function getRunnerForm(GamePhase, FlightElapsedSeconds = 0) {
  if (GamePhase !== 'flying') {
    return 'astronaut';
  }
  return FlightElapsedSeconds < 0.28 ? 'launch-craft' : 'ship';
}

/** Deterministic occupation-cage transition driven by restoration progress. */
export function getStillnessPresentation(IsRestored, RestorationProgress = 0) {
  if (!IsRestored) {
    return { visible: true, opacity: 0.22, scale: 1 };
  }
  const ClampedProgress = Math.max(0, Math.min(1, RestorationProgress));
  return {
    visible: ClampedProgress < 1,
    opacity: 0.22 * Math.pow(1 - ClampedProgress, 1.45),
    scale: 1 + (ClampedProgress * 0.22),
  };
}

/** Bright initial break followed by a clean, short screen-space fade. */
export function getLiberationFlashOpacity(RemainingSeconds, DurationSeconds = 0.72) {
  if (RemainingSeconds <= 0 || DurationSeconds <= 0) {
    return 0;
  }
  const LifeRatio = Math.min(1, RemainingSeconds / DurationSeconds);
  return Math.sin(LifeRatio * Math.PI * 0.5) * LifeRatio;
}
