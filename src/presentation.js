import {
  getRangeVeilStrength as getAuthoredRangeVeilStrength,
  isFurtherReachLive,
  isInnerClusterLive,
} from './sector.js';

/** Maps gameplay state to one legible Runner animation state. */
export function getRunnerAnimationState(GamePhase, IsPointerAiming, IsWalking = false) {
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
  if (IsWalking) {
    return 'walking';
  }
  return 'ready';
}

/** Returns the target limb pose without introducing frame-rate-dependent state. */
export function getRunnerPose(AnimationState, WalkPhase = 0) {
  if (AnimationState === 'walking') {
    const Swing = Number.isFinite(WalkPhase) ? Math.sin(WalkPhase) : 0;
    return {
      armAngle: 0.28 + (Swing * 0.58),
      legAngle: 0.12 - (Swing * 0.72),
      thrusterVisible: false,
    };
  }
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

/**
 * Every world is tyrant, isolated or living. Art contrast is the primary judging signal.
 */
export function getWorldLifeStage({ restored, liveLinkCount = 0 } = {}) {
  if (typeof restored !== 'boolean') {
    throw new Error('World life stage requires a restored flag.');
  }
  if (!Number.isInteger(liveLinkCount) || liveLinkCount < 0) {
    throw new Error('World life stage requires a non-negative live link count.');
  }
  if (!restored) {
    return 'tyrant';
  }
  return liveLinkCount >= 1 ? 'living' : 'isolated';
}

export { isFurtherReachLive, isInnerClusterLive };

export function getRangeVeilStrength(
  worldIdentifier,
  innerClusterLive,
  SectorRules = {},
) {
  return getAuthoredRangeVeilStrength(worldIdentifier, innerClusterLive, SectorRules);
}

export const PlanningMinimumZoomScale = 0.22;
export const PlanningMaximumZoomScale = 3.15;
export const PlanningNeighbourhoodPadding = 3.4;

/**
 * Default aim frames the readable neighbourhood, not the whole dark Reach.
 * Predicted landings and unveiled worlds expand the map; Command waits until it is exposed.
 */
export function getPlanningFocusWorldIdentifiers({
  innerClusterLive = false,
  commandRouteAvailable = false,
  predictedBodyIdentifiers = [],
  currentWorldIdentifier = '',
  innerClusterWorldIdentifiers = [],
  furtherReachWorldIdentifiers = [],
  commandWorldIdentifier = 'worldheart',
} = {}) {
  if (typeof innerClusterLive !== 'boolean') {
    throw new Error('Planning focus requires an inner-cluster flag.');
  }
  if (typeof commandRouteAvailable !== 'boolean') {
    throw new Error('Planning focus requires a Command route flag.');
  }
  if (!Array.isArray(predictedBodyIdentifiers)) {
    throw new Error('Planning focus requires a predicted-body list.');
  }
  if (!Array.isArray(innerClusterWorldIdentifiers) || !Array.isArray(furtherReachWorldIdentifiers)) {
    throw new Error('Planning focus requires authored cluster identifier lists.');
  }
  const Identifiers = new Set(innerClusterWorldIdentifiers);
  if (innerClusterLive) {
    for (const WorldIdentifier of furtherReachWorldIdentifiers) {
      Identifiers.add(WorldIdentifier);
    }
  }
  if (commandRouteAvailable && typeof commandWorldIdentifier === 'string') {
    Identifiers.add(commandWorldIdentifier);
  }
  if (typeof currentWorldIdentifier === 'string' && currentWorldIdentifier.length > 0) {
    Identifiers.add(currentWorldIdentifier);
  }
  for (const BodyIdentifier of predictedBodyIdentifiers) {
    if (typeof BodyIdentifier === 'string' && BodyIdentifier.length > 0) {
      Identifiers.add(BodyIdentifier);
    }
  }
  return [...Identifiers];
}

/** Lifts exponential fog while aiming or flying so the planning map stays readable. */
export function getPlanningAtmosphere({
  isPlanning = false,
  fogDensity,
  toneMappingExposure,
} = {}) {
  if (!(fogDensity >= 0) || !(fogDensity <= 0.05)) {
    throw new Error('Planning atmosphere requires a bounded fog density.');
  }
  if (!(toneMappingExposure > 0.5) || toneMappingExposure > 2) {
    throw new Error('Planning atmosphere requires a bounded exposure.');
  }
  if (isPlanning !== true) {
    return { fogDensity, toneMappingExposure };
  }
  return {
    fogDensity: fogDensity * 0.34,
    toneMappingExposure: Math.min(1.55, toneMappingExposure * 1.16),
  };
}

/** Linked houses, busy workshops or circuit festival — never wall-clock prosperity. */
export function getProsperityStage({
  restored,
  liveLinkCount = 0,
  inLiveCircuit = false,
} = {}) {
  const LifeStage = getWorldLifeStage({ restored, liveLinkCount });
  if (LifeStage === 'tyrant') {
    return 'tyrant';
  }
  if (LifeStage === 'isolated') {
    return 'isolated';
  }
  if (inLiveCircuit) {
    return 'circuit';
  }
  if (liveLinkCount >= 2) {
    return 'busy';
  }
  return 'linked';
}

export function getTradeHullKind(originVisualKey, destinationVisualKey) {
  const Keys = [originVisualKey, destinationVisualKey];
  if (Keys.includes('ember')) {
    return 'barge';
  }
  if (Keys.includes('grove')) {
    return 'sail';
  }
  if (Keys.includes('frost')) {
    return 'sled';
  }
  if (Keys.includes('tide')) {
    return 'hull';
  }
  if (Keys.includes('vault')) {
    return 'spine';
  }
  return 'boat';
}

export function getLiveLinkShipCount({
  originDegree = 1,
  destinationDegree = 1,
  inLiveCircuit = false,
} = {}) {
  if (!Number.isInteger(originDegree) || originDegree < 0
    || !Number.isInteger(destinationDegree) || destinationDegree < 0) {
    throw new Error('Live link ship count requires non-negative degrees.');
  }
  if (typeof inLiveCircuit !== 'boolean') {
    throw new Error('Live link ship count requires a circuit flag.');
  }
  return inLiveCircuit || originDegree >= 2 || destinationDegree >= 2 ? 2 : 1;
}

export function getTradeHullScale(kind) {
  const Scales = {
    barge: { x: 1.7, y: 0.42, z: 0.82 },
    sail: { x: 0.55, y: 1.45, z: 0.38 },
    sled: { x: 1.45, y: 0.32, z: 0.58 },
    hull: { x: 1.05, y: 0.7, z: 0.7 },
    spine: { x: 0.7, y: 1.2, z: 0.45 },
    boat: { x: 1, y: 0.55, z: 0.62 },
  };
  return Scales[kind] ?? Scales.boat;
}

export function getTradeHullColor(kind, inLiveCircuit = false) {
  if (typeof inLiveCircuit !== 'boolean') {
    throw new Error('Trade hull colour requires a circuit flag.');
  }
  const Colors = {
    barge: 0xff8a3a,
    sail: 0x7dcc74,
    sled: 0xe7f6ff,
    hull: 0x5fb8c9,
    spine: 0xc9a0ff,
    boat: 0xffd98a,
  };
  return inLiveCircuit ? 0xffe7b8 : (Colors[kind] ?? Colors.boat);
}

/** Houses appear on the first live link; workshops/chimneys densify later. */
export function getProsperityPresence(stage) {
  if (stage === 'linked') {
    return 0.78;
  }
  if (stage === 'busy') {
    return 1;
  }
  if (stage === 'circuit') {
    return 1.12;
  }
  return 0;
}

/** Linked worlds are all houses; busy and circuit mix workshops and docks on the same scars. */
export function getProsperityBuildingKind(stage, patternIndex = 0) {
  if (stage !== 'linked' && stage !== 'busy' && stage !== 'circuit') {
    return null;
  }
  if (!Number.isInteger(patternIndex) || patternIndex < 0) {
    throw new Error('Prosperity building kind requires a non-negative pattern index.');
  }
  if (stage === 'linked') {
    return 'house';
  }
  return ['house', 'workshop', 'dock'][patternIndex % 3];
}

export function getProsperityBuildingProfile(kind) {
  const Profiles = {
    house: { height: 0.92, width: 1, depth: 0.9, hasWindow: true, hasStreet: true },
    workshop: { height: 1.42, width: 0.62, depth: 0.72, hasWindow: true, hasStreet: false },
    dock: { height: 0.34, width: 1.62, depth: 0.7, hasWindow: false, hasStreet: false },
  };
  return Profiles[kind] ?? null;
}

/** Isolated stays a quiet trio; living crowds densify with degree without extra draws. */
export function getLivingInhabitantSlotCount(stage) {
  if (stage === 'isolated') {
    return 3;
  }
  if (stage === 'linked') {
    return 6;
  }
  if (stage === 'busy') {
    return 9;
  }
  if (stage === 'circuit') {
    return 12;
  }
  return 0;
}

export function shouldShowInhabitantSlot({
  lifeStage,
  prosperityStage,
  slotIndex,
} = {}) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    throw new Error('Inhabitant slot requires a non-negative index.');
  }
  if (lifeStage === 'tyrant') {
    return slotIndex < 6;
  }
  if (lifeStage === 'isolated') {
    return slotIndex < 3;
  }
  return slotIndex < getLivingInhabitantSlotCount(prosperityStage);
}

/** Worker, child-scale and pack silhouettes share one inhabitant draw. */
export function getInhabitantSilhouette(slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    throw new Error('Inhabitant silhouette requires a non-negative slot index.');
  }
  const Variants = ['worker', 'child', 'pack'];
  const Kind = Variants[slotIndex % 3];
  const Scales = {
    worker: { x: 1.06, y: 1.16, z: 1.04 },
    child: { x: 0.7, y: 0.64, z: 0.7 },
    pack: { x: 1.22, y: 0.9, z: 1.38 },
  };
  return { kind: Kind, scale: Scales[Kind] };
}

/** Returns which in-engine bed should follow network and Warden state. */
export function getStoryMusicStage({
  innerClusterLive = false,
  wardenStatus = 'hidden',
} = {}) {
  if (wardenStatus === 'exposed') {
    return 'crown';
  }
  if (wardenStatus === 'pursuing') {
    return 'hunt';
  }
  if (innerClusterLive === true) {
    return 'hope';
  }
  return 'quiet';
}

/** Mixes mine rumble, quiet garden and dock crowd without touching simulation. */
export function getWorldLifeAudioMix({
  tyrantWorldCount = 0,
  isolatedWorldCount = 0,
  livingWorldCount = 0,
} = {}) {
  if (
    !Number.isInteger(tyrantWorldCount) || tyrantWorldCount < 0
    || !Number.isInteger(isolatedWorldCount) || isolatedWorldCount < 0
    || !Number.isInteger(livingWorldCount) || livingWorldCount < 0
  ) {
    throw new Error('World-life audio mix requires non-negative world counts.');
  }
  const Total = Math.max(1, tyrantWorldCount + isolatedWorldCount + livingWorldCount);
  return {
    rumble: tyrantWorldCount / Total,
    garden: isolatedWorldCount / Total,
    dock: livingWorldCount / Total,
  };
}

/** Occupation industry collapses through the same wave that frees the world. */
export function getTyrantOccupationStrength(restored, restorationProgress = 0) {
  if (typeof restored !== 'boolean') {
    throw new Error('Tyrant occupation strength requires a restored flag.');
  }
  if (!restored) {
    return 1;
  }
  if (!Number.isFinite(restorationProgress)) {
    throw new Error('Tyrant occupation strength requires finite restoration progress.');
  }
  const ClampedProgress = Math.max(0, Math.min(1.2, restorationProgress));
  if (ClampedProgress <= 0) {
    return 1;
  }
  if (ClampedProgress >= 0.68) {
    return 0;
  }
  return 1 - (ClampedProgress / 0.68);
}

/**
 * One-way haul from an occupied world toward Command. Freighters leave full and never return.
 */
export function getExtractionFreighterTravelProgress(
  ElapsedSinceCreatedSeconds,
  { cycleSpeed = 0.075 } = {},
) {
  if (!Number.isFinite(ElapsedSinceCreatedSeconds) || ElapsedSinceCreatedSeconds < 0) {
    throw new Error('Extraction travel requires a non-negative age.');
  }
  if (!Number.isFinite(cycleSpeed) || cycleSpeed <= 0) {
    throw new Error('Extraction travel requires a positive cycle speed.');
  }
  const TravelProgress = (ElapsedSinceCreatedSeconds * cycleSpeed) % 1;
  const Opacity = TravelProgress < 0.1
    ? TravelProgress / 0.1
    : TravelProgress > 0.82
      ? Math.max(0, (1 - TravelProgress) / 0.18)
      : 1;
  return { travelProgress: TravelProgress, opacity: Opacity, isReturning: false };
}

/** Frames one landed world so mines, people and houses read, then aiming zooms back out. */
export function getLandedCameraScale({
  worldRadius,
  viewportWorldHeight,
  minimumScale = 0.42,
  maximumScale = 0.58,
} = {}) {
  if (!Number.isFinite(worldRadius) || worldRadius <= 0) {
    throw new Error('Landed camera requires a positive world radius.');
  }
  if (!Number.isFinite(viewportWorldHeight) || viewportWorldHeight <= 0) {
    throw new Error('Landed camera requires a positive viewport height.');
  }
  const FramedHeight = worldRadius * 3.35;
  return Math.min(
    maximumScale,
    Math.max(minimumScale, FramedHeight / viewportWorldHeight),
  );
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
 * Frames the whole Reach while aiming or flying so a multi-world slingshot chain is visible.
 * Intimate rest framing returns after landing; this view is the planning map, not Scout.
 */
export function getSectorPlanningCamera({
  runner,
  focusPoints = [],
  pathPoints = [],
  viewportWorldWidth,
  viewportWorldHeight,
  padding = PlanningNeighbourhoodPadding,
} = {}) {
  assertFinitePoint(runner, 'runner');
  if (
    !Number.isFinite(viewportWorldWidth)
    || viewportWorldWidth <= 0
    || !Number.isFinite(viewportWorldHeight)
    || viewportWorldHeight <= 0
  ) {
    throw new Error('Sector planning camera requires a positive viewport.');
  }
  if (!Number.isFinite(padding) || padding < 0) {
    throw new Error('Sector planning camera requires a non-negative padding.');
  }
  if (!Array.isArray(focusPoints)) {
    throw new Error('Sector planning camera requires focus points.');
  }
  if (!Array.isArray(pathPoints)) {
    throw new Error('Sector planning camera requires path points.');
  }

  let MinimumX = runner.x;
  let MaximumX = runner.x;
  let MinimumY = runner.y;
  let MaximumY = runner.y;
  for (const FocusPoint of [...focusPoints, ...pathPoints]) {
    assertFinitePoint(FocusPoint, 'focus point');
    MinimumX = Math.min(MinimumX, FocusPoint.x);
    MaximumX = Math.max(MaximumX, FocusPoint.x);
    MinimumY = Math.min(MinimumY, FocusPoint.y);
    MaximumY = Math.max(MaximumY, FocusPoint.y);
  }

  const FramedWidth = Math.max((MaximumX - MinimumX) + (padding * 2), viewportWorldWidth);
  const FramedHeight = Math.max((MaximumY - MinimumY) + (padding * 2), viewportWorldHeight);
  const LookX = (MinimumX + MaximumX) * 0.5;
  const LookY = (MinimumY + MaximumY) * 0.5;
  const MaximumOffsetX = FramedWidth * 0.42;
  const MaximumOffsetY = FramedHeight * 0.42;
  return {
    lookX: Math.min(runner.x + MaximumOffsetX, Math.max(runner.x - MaximumOffsetX, LookX)),
    lookY: Math.min(runner.y + MaximumOffsetY, Math.max(runner.y - MaximumOffsetY, LookY)),
    scale: Math.max(
      FramedWidth / viewportWorldWidth,
      FramedHeight / viewportWorldHeight,
      1,
    ),
  };
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
  { cycleSpeed = 0.11, dwellRatio = 0 } = {},
) {
  if (!Number.isFinite(ElapsedSinceCreatedSeconds) || ElapsedSinceCreatedSeconds < 0) {
    throw new Error('Courier travel requires a non-negative age.');
  }
  if (!Number.isFinite(cycleSpeed) || cycleSpeed <= 0) {
    throw new Error('Courier travel requires a positive cycle speed.');
  }
  if (!Number.isFinite(dwellRatio) || dwellRatio < 0 || dwellRatio > 0.24) {
    throw new Error('Courier dwell must stay between 0 and 0.24 of a leg.');
  }
  const CycleProgress = (ElapsedSinceCreatedSeconds * cycleSpeed) % 2;
  const IsReturning = CycleProgress > 1;
  const LegProgress = IsReturning ? CycleProgress - 1 : CycleProgress;
  let TravelProgress;
  let IsDocked = false;
  if (dwellRatio > 0 && LegProgress <= dwellRatio) {
    TravelProgress = 0;
    IsDocked = true;
  } else if (dwellRatio > 0 && LegProgress >= 1 - dwellRatio) {
    TravelProgress = 1;
    IsDocked = true;
  } else {
    const Span = 1 - (2 * dwellRatio);
    TravelProgress = Span <= 0 ? 1 : (LegProgress - dwellRatio) / Span;
  }
  if (IsReturning) {
    TravelProgress = 1 - TravelProgress;
  }
  return {
    travelProgress: TravelProgress,
    isReturning: IsReturning,
    isDocked: IsDocked,
  };
}

/** Docked hulls gather people at the destination on arrival and the origin on return. */
export function getCourierDockWorldRole({
  travelProgress,
  isDocked = false,
} = {}) {
  if (isDocked !== true) {
    return null;
  }
  if (!Number.isFinite(travelProgress)) {
    throw new Error('Dock world role requires finite travel progress.');
  }
  return travelProgress >= 0.5 ? 'destination' : 'origin';
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
  if (liveRelayCount <= 1) {
    return {
      label: 'NEIGHBOURHOOD',
      state: 'QUIET',
      filledPips: 0,
      pipCount: 0,
      open: false,
    };
  }
  if (liveRelayCount === 2) {
    return {
      label: 'NEIGHBOURHOOD',
      state: 'WAKING',
      filledPips: 0,
      pipCount: 0,
      open: false,
    };
  }
  return {
    label: 'NEIGHBOURHOOD',
    state: 'TALKING',
    filledPips: 0,
    pipCount: 0,
    open: false,
  };
}

/** Teaches the first connections before circuits, shields or Command. */
export function getHiddenWardenRouteCoach({
  liveRelayCount,
  routeLabels = [],
  openingBody = '',
  rangeUnlockLine = '',
  innerClusterLive = false,
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
  if (innerClusterLive || liveRelayCount >= 3) {
    return {
      title: Title,
      body: typeof rangeUnlockLine === 'string' && rangeUnlockLine.trim() !== ''
        ? rangeUnlockLine
        : 'The dark is not as wide as they said.',
    };
  }
  if (liveRelayCount >= 2) {
    return {
      title: Title,
      body: 'Land on another world. Watch it wake.',
    };
  }
  return {
    title: Title,
    body: typeof openingBody === 'string' && openingBody.trim() !== ''
      ? openingBody
      : 'They are still out there. Carry the first word.',
  };
}

export const StoryBoardPortraitFiles = Object.freeze({
  warden: './assets/warden-portrait.jpg',
  runner: './assets/runner-portrait.jpg',
  haven: './assets/haven-portrait.jpg',
  orbitbreaker: './assets/orbitbreaker-portrait.jpg',
  ember: './assets/ember-portrait.jpg',
  grove: './assets/grove-portrait.jpg',
  tide: './assets/tide-portrait.jpg',
  frost: './assets/frost-portrait.jpg',
  bastion: './assets/bastion-portrait.jpg',
  command: './assets/command-portrait.jpg',
});

export const StoryBoardPortraitTones = Object.freeze({
  warden: 'warden',
  runner: 'runner',
  haven: 'haven',
  orbitbreaker: 'courier',
  ember: 'ember',
  grove: 'grove',
  tide: 'tide',
  frost: 'frost',
  bastion: 'bastion',
  command: 'command',
});

/** Fills authored {world} tokens without turning boards into a conversation graph. */
export function formatStoryBoardCopy(text, tokens = {}) {
  if (typeof text !== 'string') {
    throw new Error('Story board copy requires a string.');
  }
  return text.replace(/\{([a-zA-Z]+)\}/g, (Match, TokenName) => {
    const Replacement = tokens[TokenName];
    return typeof Replacement === 'string' && Replacement.trim() !== ''
      ? Replacement
      : Match;
  });
}

/**
 * Major campaign beats, in story order. Reading them never advances pursuit.
 */
export function getTriggeredCampaignStoryBoardIds({
  shownIds = [],
  createdLinkCount = 0,
  linkCreated = false,
  linkedWorldIdentifier = '',
  innerClusterJustUnlocked = false,
  neighbourhoodJustAwake = false,
  wardenJustRevealed = false,
  circuitJustClosed = false,
  worldJustSuppressed = false,
  worldJustRecaptured = false,
  commandJustExposed = false,
  commandJustLanded = false,
  reachJustAnswered = false,
  runJustLost = false,
} = {}) {
  if (!Array.isArray(shownIds)) {
    throw new Error('Triggered story boards require a shown-id list.');
  }
  const Shown = new Set(shownIds);
  const Triggered = [];
  const maybeQueue = (BoardId, ShouldQueue) => {
    if (ShouldQueue && !Shown.has(BoardId)) {
      Triggered.push(BoardId);
    }
  };
  maybeQueue('firstAnswer', linkCreated === true && createdLinkCount === 1);
  maybeQueue('secondAnswer', linkCreated === true && createdLinkCount === 2);
  maybeQueue('rangeUnlock', innerClusterJustUnlocked === true);
  maybeQueue('firstTide', linkCreated === true && linkedWorldIdentifier === 'tide');
  maybeQueue('firstFrost', linkCreated === true && linkedWorldIdentifier === 'frost');
  maybeQueue('firstBastion', linkCreated === true && linkedWorldIdentifier === 'bastion');
  maybeQueue('neighbourhood', neighbourhoodJustAwake === true);
  maybeQueue('wardenArrival', wardenJustRevealed === true);
  maybeQueue('circuitClosed', circuitJustClosed === true && commandJustExposed !== true);
  maybeQueue('suppression', worldJustSuppressed === true);
  maybeQueue('recapture', worldJustRecaptured === true);
  maybeQueue('commandExposed', commandJustExposed === true);
  maybeQueue('commandApproach', commandJustLanded === true);
  maybeQueue('reachAnswers', reachJustAnswered === true);
  maybeQueue('runLost', runJustLost === true);
  return Triggered;
}

/** Command and Bastion speak on the rim before Cut. Other boards wait for leftover teeth. */
export const StoryBoardsAllowedDuringEncounter = Object.freeze([
  'commandApproach',
  'firstBastion',
]);

/** Boards wait for the landing beat, then pause play. They never cover a live liberation. */
export function isCampaignStoryBoardReadyToPresent({
  briefingActive = false,
  replayActive = false,
  gamePhase = 'attached',
  relayRevealActive = false,
  hostileEncounterActive = false,
  boardId = '',
} = {}) {
  if (briefingActive === true || replayActive === true || relayRevealActive === true) {
    return false;
  }
  if (
    hostileEncounterActive === true
    && !StoryBoardsAllowedDuringEncounter.includes(boardId)
  ) {
    return false;
  }
  return gamePhase === 'attached' || gamePhase === 'victoryPending';
}

export const DefaultRelayRevealHoldDurationSeconds = 0.85;
export const LinkedRelayRevealHoldDurationSeconds = 1.7;

/** After the first live link, hold the committed chain longer. Reduced motion skips it. */
export function getRelayRevealHoldDurationSeconds({
  liveRelayCount = 0,
  prefersReducedMotion = false,
} = {}) {
  if (!Number.isInteger(liveRelayCount) || liveRelayCount < 0) {
    throw new Error('Relay reveal hold requires a non-negative live relay count.');
  }
  if (prefersReducedMotion === true) {
    return 0;
  }
  return liveRelayCount >= 2
    ? LinkedRelayRevealHoldDurationSeconds
    : DefaultRelayRevealHoldDurationSeconds;
}

/** Same true path; the camera overlay keeps the committed chain before the remaining-path update. */
export function shouldHoldCommittedPrediction({
  liveRelayCount = 0,
  flightElapsedSeconds = 0,
  prefersReducedMotion = false,
  committedPointCount = 0,
} = {}) {
  if (!Number.isInteger(liveRelayCount) || liveRelayCount < 0) {
    throw new Error('Committed prediction hold requires a non-negative live relay count.');
  }
  if (!Number.isInteger(committedPointCount) || committedPointCount < 0) {
    throw new Error('Committed prediction hold requires a non-negative point count.');
  }
  if (!Number.isFinite(flightElapsedSeconds) || flightElapsedSeconds < 0) {
    throw new Error('Committed prediction hold requires a non-negative flight age.');
  }
  if (prefersReducedMotion === true || liveRelayCount < 2 || committedPointCount < 2) {
    return false;
  }
  return flightElapsedSeconds < getRelayRevealHoldDurationSeconds({
    liveRelayCount,
    prefersReducedMotion,
  });
}

/** Keyboard intercept lead is the finale gift, not an early Command snipe. */
export function shouldAssistCommandLock({
  wardenStatus = 'hidden',
  routeAvailable = false,
} = {}) {
  if (typeof wardenStatus !== 'string' || wardenStatus.length < 1) {
    throw new Error('Command lock assist requires a Warden status.');
  }
  return wardenStatus === 'exposed' && routeAvailable === true;
}

/** Run-local ladder. Gifts reset with the run. Extra Break stays a later ranked schema bump. */
export function getRunUnlockState({
  liveRelayCount = 0,
  uniqueCircuitCount = 0,
  wardenStatus = 'hidden',
  recaptureCutAvailable = false,
  prefersReducedMotion = false,
} = {}) {
  if (!Number.isInteger(liveRelayCount) || liveRelayCount < 0) {
    throw new Error('Run unlocks require a non-negative live relay count.');
  }
  if (!Number.isInteger(uniqueCircuitCount) || uniqueCircuitCount < 0) {
    throw new Error('Run unlocks require a non-negative unique circuit count.');
  }
  if (typeof wardenStatus !== 'string' || wardenStatus.length < 1) {
    throw new Error('Run unlocks require a Warden status.');
  }
  return {
    predictionHold: liveRelayCount >= 2 && prefersReducedMotion !== true,
    leftoverCut: liveRelayCount >= 2,
    circuitBeacon: uniqueCircuitCount >= 1,
    commandLock: wardenStatus === 'exposed',
    recaptureCut: recaptureCutAvailable === true,
  };
}

/** Turns authored briefing pages into one readable story board. */
export function getStoryBoardPresentation(pages, pageIndex, {
  lastContinueLabel = 'Continue',
  tokens = {},
} = {}) {
  if (!Array.isArray(pages) || pages.length < 1) {
    throw new Error('Story board requires at least one authored page.');
  }
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pages.length) {
    throw new Error('Story board requires a page inside the authored sequence.');
  }
  const Page = pages[pageIndex];
  if (
    typeof Page?.speaker !== 'string' || Page.speaker.trim() === ''
    || typeof Page?.kicker !== 'string' || Page.kicker.trim() === ''
    || typeof Page?.title !== 'string' || Page.title.trim() === ''
    || typeof Page?.body !== 'string' || Page.body.trim() === ''
    || typeof Page?.portrait !== 'string' || Page.portrait.trim() === ''
  ) {
    throw new Error('Story board pages require speaker, kicker, title, body and portrait.');
  }
  const IsLast = pageIndex === pages.length - 1;
  const ContinueLabel = typeof lastContinueLabel === 'string' && lastContinueLabel.trim() !== ''
    ? lastContinueLabel
    : 'Continue';
  return {
    speaker: Page.speaker,
    kicker: Page.kicker,
    title: formatStoryBoardCopy(Page.title, tokens),
    body: formatStoryBoardCopy(Page.body, tokens),
    portrait: Page.portrait,
    portraitSrc: StoryBoardPortraitFiles[Page.portrait] ?? StoryBoardPortraitFiles.runner,
    tone: StoryBoardPortraitTones[Page.portrait] ?? 'runner',
    pageIndex,
    pageCount: pages.length,
    isLast: IsLast,
    continueLabel: IsLast ? ContinueLabel : 'Continue',
    progressLabel: `${pageIndex + 1} / ${pages.length}`,
  };
}

export function getOpeningBriefingPresentation(pages, pageIndex) {
  return getStoryBoardPresentation(pages, pageIndex, {
    lastContinueLabel: 'Take the Orbitbreaker',
  });
}

