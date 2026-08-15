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

/** Describes launches and bonus fuel without implying that zero fuel ends the run. */
export function getRunResourceSummary(RunState) {
  const LaunchesUsed = RunState?.launchesUsed;
  const BonusFuelRemaining = RunState?.remainingLaunches;
  if (
    !Number.isInteger(LaunchesUsed)
    || LaunchesUsed < 0
    || !Number.isInteger(BonusFuelRemaining)
    || BonusFuelRemaining < 0
  ) {
    throw new Error('Run resource summary requires a valid run state.');
  }
  const LaunchLabel = LaunchesUsed === 1 ? 'launch' : 'launches';
  const FuelLabel = BonusFuelRemaining === 0
    ? 'bonus fuel spent'
    : `${BonusFuelRemaining} bonus fuel left`;
  return `${LaunchesUsed} ${LaunchLabel} · ${FuelLabel}`;
}

/** Keeps the completed run score distinct from an older, stronger local record. */
export function getPersonalBestStatus({
  isReplayVerified,
  runScore,
  personalBestScore = null,
  isNewPersonalBest = false,
}) {
  if (!isReplayVerified) {
    return 'UNVERIFIED REPLAY · LOCAL BEST NOT UPDATED';
  }
  if (personalBestScore === null) {
    return 'RANKED · LOCAL BEST UNAVAILABLE';
  }
  if (
    !Number.isInteger(runScore)
    || runScore < 0
    || !Number.isInteger(personalBestScore)
    || personalBestScore < 0
  ) {
    throw new Error('Personal-best status requires valid scores.');
  }
  return isNewPersonalBest
    ? `VERIFIED · NEW PERSONAL BEST · ${runScore.toLocaleString('en-GB')}`
    : `VERIFIED · RUN ${runScore.toLocaleString('en-GB')} · PERSONAL BEST ${personalBestScore.toLocaleString('en-GB')}`;
}

/** Names a new-world aim target without reusing the Warden fiction's “locked” state. */
export function getWorldLandingAimLabel(WorldLabel, IsNewWorldLanding) {
  if (typeof WorldLabel !== 'string' || WorldLabel.trim().length < 1) {
    throw new Error('World landing aim label requires a destination.');
  }
  return IsNewWorldLanding ? `${WorldLabel} TARGET` : 'SAFE LANDING';
}

/** Keeps permanent relay links visible while retaining a restrained network pulse. */
export function getRelayLinkOpacity(ElapsedTimeSeconds, { reducedMotion = false } = {}) {
  if (!Number.isFinite(ElapsedTimeSeconds)) {
    throw new Error('Relay link presentation requires finite time.');
  }
  if (reducedMotion) return 0.8;
  return 0.8 + (Math.sin(ElapsedTimeSeconds * 2.4) * 0.1);
}

/** Publishes the finale presentation without mutating authoritative pursuit state. */
export function getPublishedWardenState(PursuitStatus, IsCommandDefeated = false) {
  if (typeof PursuitStatus !== 'string' || PursuitStatus.length < 1) {
    throw new Error('Published Warden state requires a pursuit status.');
  }
  const IsVisible = PursuitStatus !== 'hidden';
  const IsExposed = PursuitStatus === 'exposed';
  return {
    status: IsCommandDefeated ? 'defeated' : PursuitStatus,
    landmark: IsCommandDefeated
      ? 'command-world-disabled'
      : (IsExposed ? 'command-world-exposed' : (IsVisible ? 'iron-crown-pursuit' : 'hidden')),
  };
}

/** Separates two nearby route labels horizontally while preserving their projected order. */
export function separateOverlappingRouteLabels(
  LabelPositions,
  {
    minimumGap = 76,
    verticalClearance = 24,
    minimumX = 0,
    maximumX = Number.POSITIVE_INFINITY,
  } = {},
) {
  if (
    !Array.isArray(LabelPositions)
    || LabelPositions.some((Position) => (
      !Number.isFinite(Position?.x) || !Number.isFinite(Position?.y)
    ))
    || !Number.isFinite(minimumGap)
    || minimumGap < 0
    || !Number.isFinite(verticalClearance)
    || verticalClearance < 0
    || !Number.isFinite(minimumX)
    || maximumX < minimumX + minimumGap
  ) {
    throw new Error('Route label separation requires finite positions and bounds.');
  }

  const ResolvedPositions = LabelPositions.map((Position) => ({ ...Position }));
  if (ResolvedPositions.length !== 2) return ResolvedPositions;
  const [FirstPosition, SecondPosition] = ResolvedPositions;
  if (
    Math.abs(FirstPosition.x - SecondPosition.x) >= minimumGap
    || Math.abs(FirstPosition.y - SecondPosition.y) >= verticalClearance
  ) {
    return ResolvedPositions;
  }

  const MidpointX = (FirstPosition.x + SecondPosition.x) * 0.5;
  const LeftX = Math.max(
    minimumX,
    Math.min(maximumX - minimumGap, MidpointX - (minimumGap * 0.5)),
  );
  const FirstIsLeft = FirstPosition.x <= SecondPosition.x;
  ResolvedPositions[FirstIsLeft ? 0 : 1].x = LeftX;
  ResolvedPositions[FirstIsLeft ? 1 : 0].x = LeftX + minimumGap;
  return ResolvedPositions;
}
