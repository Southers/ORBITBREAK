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

function assertFinitePoint(Point, Label) {
  if (!Point || !Number.isFinite(Point.x) || !Number.isFinite(Point.y)) {
    throw new Error(`Relay reveal camera requires a finite ${Label}.`);
  }
}

/**
 * Pulls the camera toward a new relay without letting the landed Runner leave the viewport.
 * The player should see the worlds answer each other, then regain a Runner-centred shot.
 */
export function getRelayRevealLookTarget({
  origin,
  destination,
  runner,
  viewportWorldWidth,
  viewportWorldHeight,
} = {}) {
  assertFinitePoint(origin, 'origin');
  assertFinitePoint(destination, 'destination');
  assertFinitePoint(runner, 'runner');
  if (
    !Number.isFinite(viewportWorldWidth)
    || viewportWorldWidth <= 0
    || !Number.isFinite(viewportWorldHeight)
    || viewportWorldHeight <= 0
  ) {
    throw new Error('Relay reveal camera requires a positive viewport.');
  }
  const MidX = (origin.x + destination.x) * 0.5;
  const MidY = (origin.y + destination.y) * 0.5;
  const MaximumOffsetX = viewportWorldWidth * 0.38;
  const MaximumOffsetY = viewportWorldHeight * 0.38;
  return {
    x: Math.min(runner.x + MaximumOffsetX, Math.max(runner.x - MaximumOffsetX, MidX)),
    y: Math.min(runner.y + MaximumOffsetY, Math.max(runner.y - MaximumOffsetY, MidY)),
  };
}

/** Starts each new courier at the origin of its live link instead of mid-route. */
export function getRelayCourierTravelProgress(
  ElapsedSinceCreatedSeconds,
  { cycleSpeed = 0.11 } = {},
) {
  if (!Number.isFinite(ElapsedSinceCreatedSeconds) || ElapsedSinceCreatedSeconds < 0) {
    throw new Error('Courier travel requires a non-negative age.');
  }
  if (!Number.isFinite(cycleSpeed) || cycleSpeed <= 0) {
    throw new Error('Courier travel requires a positive cycle speed.');
  }
  const CycleProgress = (ElapsedSinceCreatedSeconds * cycleSpeed) % 2;
  const IsReturning = CycleProgress > 1;
  return {
    travelProgress: IsReturning ? 2 - CycleProgress : CycleProgress,
    isReturning: IsReturning,
  };
}

/** Colors a long-arc preview when the visible line already threads scoring wells. */
export function getSlingshotPreviewPresentation(SlingshotEventCount) {
  if (!Number.isInteger(SlingshotEventCount) || SlingshotEventCount < 0) {
    throw new Error('Slingshot preview requires a scored event count.');
  }
  if (SlingshotEventCount >= 2) {
    return {
      color: 0xffd98a,
      opacity: 0.92,
      label: `CHAIN ×${Math.min(SlingshotEventCount, 4)}`,
    };
  }
  if (SlingshotEventCount === 1) {
    return {
      color: 0x9be7ff,
      opacity: 0.84,
      label: 'ASSIST',
    };
  }
  return null;
}

/** Gravity wells are visible only while aiming or flying, when they can still change the shot. */
export function getSlingshotBandVisualState({
  isAiming = false,
  isFlying = false,
} = {}) {
  const Visible = isAiming === true || isFlying === true;
  return {
    visible: Visible,
    assistOpacity: Visible ? 0.22 : 0,
    razorOpacity: Visible ? 0.3 : 0,
  };
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

/** Names the rankings action honestly before an offline player opens it. */
export function getLeaderboardActionLabel(IsConfigured) {
  if (typeof IsConfigured !== 'boolean') {
    throw new Error('Leaderboard action label requires configured state.');
  }
  return IsConfigured ? 'Rankings' : 'Rankings offline';
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

/** Moves route chips vertically out of nearby tactical annotations. */
export function separateRouteLabelsFromTacticalLabels(
  RoutePositions,
  TacticalPositions,
  {
    horizontalClearance = 100,
    verticalClearance = 30,
    minimumY = 0,
    maximumY = Number.POSITIVE_INFINITY,
  } = {},
) {
  const HasInvalidPosition = (Positions) => (
    !Array.isArray(Positions)
    || Positions.some((Position) => (
      !Number.isFinite(Position?.x) || !Number.isFinite(Position?.y)
    ))
  );
  if (
    HasInvalidPosition(RoutePositions)
    || HasInvalidPosition(TacticalPositions)
    || !Number.isFinite(horizontalClearance)
    || horizontalClearance < 0
    || !Number.isFinite(verticalClearance)
    || verticalClearance < 0
    || !Number.isFinite(minimumY)
    || maximumY < minimumY
  ) {
    throw new Error('Route and tactical label separation requires finite positions and bounds.');
  }

  return RoutePositions.map((RoutePosition) => {
    const BoundedRoutePosition = {
      ...RoutePosition,
      y: Math.max(minimumY, Math.min(maximumY, RoutePosition.y)),
    };
    const NearbyTacticalPositions = TacticalPositions.filter(
      (TacticalPosition) => (
        Math.abs(BoundedRoutePosition.x - TacticalPosition.x) < horizontalClearance
      ),
    );
    if (
      NearbyTacticalPositions.every((TacticalPosition) => (
        Math.abs(BoundedRoutePosition.y - TacticalPosition.y) >= verticalClearance
      ))
    ) {
      return BoundedRoutePosition;
    }

    const CandidateYPositions = [
      BoundedRoutePosition.y,
      minimumY,
      maximumY,
      ...NearbyTacticalPositions.flatMap((TacticalPosition) => ([
        TacticalPosition.y - verticalClearance,
        TacticalPosition.y + verticalClearance,
      ])),
    ].filter((CandidateY) => CandidateY >= minimumY && CandidateY <= maximumY);
    const ValidCandidateYPositions = CandidateYPositions.filter((CandidateY) => (
      NearbyTacticalPositions.every((TacticalPosition) => (
        Math.abs(CandidateY - TacticalPosition.y) >= verticalClearance
      ))
    ));
    if (ValidCandidateYPositions.length < 1) return BoundedRoutePosition;
    const ResolvedY = ValidCandidateYPositions.reduce((ClosestY, CandidateY) => (
      Math.abs(CandidateY - BoundedRoutePosition.y)
        < Math.abs(ClosestY - BoundedRoutePosition.y)
        ? CandidateY
        : ClosestY
    ));
    return { ...BoundedRoutePosition, y: ResolvedY };
  });
}

/** Separates moving tactical chips in stable authored order. */
export function separateOverlappingTacticalLabels(LabelPositions, Options = {}) {
  separateRouteLabelsFromTacticalLabels([], [], Options);
  const ResolvedPositions = [];
  for (const LabelPosition of LabelPositions) {
    const [ResolvedPosition] = separateRouteLabelsFromTacticalLabels(
      [LabelPosition],
      ResolvedPositions,
      Options,
    );
    ResolvedPositions.push(ResolvedPosition);
  }
  return ResolvedPositions;
}

/** Reserves enough horizontal room for a single-line tactical chip. */
export function getTacticalLabelHorizontalMargin(LabelText) {
  if (typeof LabelText !== 'string' || LabelText.trim().length < 1) {
    throw new Error('Tactical label margin requires visible text.');
  }
  return Math.max(64, Math.ceil([...LabelText].length * 4) + 4);
}

/** Describes the visual scanner without turning moving coordinates into live announcements. */
export function getScannerAccessibleLabel({
  runnerLocation,
  activeWorldCount,
  worldCount,
  wardenStatus,
  wardenDistance,
  wardenTargetLabel = '',
}) {
  if (
    typeof runnerLocation !== 'string'
    || runnerLocation.trim().length < 1
    || !Number.isInteger(activeWorldCount)
    || !Number.isInteger(worldCount)
    || activeWorldCount < 0
    || worldCount < 1
    || activeWorldCount > worldCount
    || !['hidden', 'pursuing', 'exposed', 'defeated'].includes(wardenStatus)
    || !Number.isInteger(wardenDistance)
    || wardenDistance < 0
    || typeof wardenTargetLabel !== 'string'
  ) {
    throw new Error('Scanner label requires valid runner, relay and Warden state.');
  }
  const WardenDescription = wardenStatus === 'hidden'
    ? 'Warden hidden.'
    : wardenStatus === 'exposed'
      ? 'Command World exposed.'
      : wardenStatus === 'defeated'
        ? 'Warden defeated.'
        : `Warden ${wardenDistance} flight${wardenDistance === 1 ? '' : 's'} away${
          wardenTargetLabel.trim().length > 0 ? `, targeting ${wardenTargetLabel.trim()}` : ''
        }.`;
  return `System scanner. Runner ${runnerLocation.trim()}. ${activeWorldCount} of ${worldCount}`
    + ` relay worlds active. ${WardenDescription} Moving bodies tracked.`;
}

/** Reserves the upper HUD band once the Warden forecast appears. */
export function getPlayfieldLabelTopMargin({
  isCompact,
  isShortLandscape = false,
  wardenVisible,
  isTactical,
}) {
  if (
    typeof isCompact !== 'boolean'
    || typeof isShortLandscape !== 'boolean'
    || typeof wardenVisible !== 'boolean'
    || typeof isTactical !== 'boolean'
  ) {
    throw new Error('Playfield label margin requires boolean layout state.');
  }
  if (wardenVisible && isShortLandscape) return 140;
  if (wardenVisible) return isCompact ? (isTactical ? 246 : 244) : 212;
  if (isCompact) return isTactical ? 116 : 172;
  return isTactical ? 70 : 78;
}

/** Keeps projected chips inside the real HUD corridor on short landscape screens. */
export function getPlayfieldLabelVerticalBounds({
  viewportHeight,
  instructionTop,
  isCompact,
  isShortLandscape,
  wardenVisible,
  isTactical,
}) {
  if (
    !Number.isFinite(viewportHeight)
    || viewportHeight <= 0
    || !Number.isFinite(instructionTop)
  ) {
    throw new Error('Playfield label bounds require a finite viewport and instruction edge.');
  }
  const MinimumY = getPlayfieldLabelTopMargin({
    isCompact,
    isShortLandscape,
    wardenVisible,
    isTactical,
  });
  const BaseMaximumY = viewportHeight - (isCompact ? 112 : 82);
  const MaximumY = Math.max(
    0,
    isShortLandscape
      ? Math.min(BaseMaximumY, instructionTop - 16)
      : BaseMaximumY,
  );
  return {
    minimumY: Math.min(MinimumY, MaximumY),
    maximumY: MaximumY,
  };
}

/**
 * Maps the live loop to one objective: relays, then circuits, then Command.
 * Judges should never see the boss counter before they have connected a world.
 */
export function getLoopObjectivePresentation({
  liveRelayCount,
  uniqueCircuitCount,
  wardenStatus,
  isOnCommandCore = false,
  isCommandLiberated = false,
  relayRevealCount = 3,
  circuitExposeCount = 2,
} = {}) {
  if (
    !Number.isInteger(liveRelayCount)
    || liveRelayCount < 0
    || !Number.isInteger(uniqueCircuitCount)
    || uniqueCircuitCount < 0
    || typeof wardenStatus !== 'string'
    || wardenStatus.length < 1
  ) {
    throw new Error('Loop objective requires relay, circuit and Warden state.');
  }
  if (isCommandLiberated) {
    return {
      label: 'COMMAND WORLD',
      state: 'LIBERATED',
      filledPips: 3,
      pipCount: 3,
      open: true,
    };
  }
  if (isOnCommandCore) {
    return {
      label: 'COMMAND WORLD',
      state: 'CORE LOCKED',
      filledPips: 3,
      pipCount: 3,
      open: true,
    };
  }
  if (wardenStatus === 'exposed') {
    return {
      label: 'COMMAND WORLD',
      state: 'COMMAND EXPOSED',
      filledPips: 3,
      pipCount: 3,
      open: true,
    };
  }
  if (wardenStatus !== 'hidden') {
    const Circuits = Math.min(uniqueCircuitCount, circuitExposeCount);
    return {
      label: 'CIRCUITS',
      state: `${Circuits} / ${circuitExposeCount}`,
      filledPips: Circuits,
      pipCount: circuitExposeCount,
      open: false,
    };
  }
  const Relays = Math.min(liveRelayCount, relayRevealCount);
  return {
    label: 'RELAYS',
    state: `${Relays} / ${relayRevealCount}`,
    filledPips: Relays,
    pipCount: relayRevealCount,
    open: false,
  };
}

/** Teaches the first connections before circuits, shields or Command. */
export function getHiddenWardenRouteCoach({
  liveRelayCount,
  routeLabels = [],
  openingBody = '',
} = {}) {
  if (!Number.isInteger(liveRelayCount) || liveRelayCount < 1) {
    throw new Error('Hidden Warden coach requires a live relay count.');
  }
  const First = routeLabels[0];
  const Second = routeLabels[1];
  const Title = First && Second
    ? `Choose ${First} or ${Second}`
    : First
      ? `Land on ${First}`
      : 'Land on the next world';
  if (liveRelayCount >= 2) {
    return {
      title: Title,
      body: 'One more live world and the Warden notices. Landing leaves another relay.',
    };
  }
  return {
    title: Title,
    body: typeof openingBody === 'string' && openingBody.trim() !== ''
      ? openingBody
      : 'Pull back from the Runner and release. A safe landing wakes the world and draws a relay.',
  };
}

