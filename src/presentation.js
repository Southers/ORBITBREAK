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
export const PlanningMaximumZoomScale = 3.85;
export const PlanningNeighbourhoodPadding = 3.4;

/**
 * Default aim frames the readable neighbourhood, not the whole dark Reach.
 * Before the veil lifts that is the inner cluster. Afterward it is the current
 * world plus its authored neighbours. Predicted landings and Command expand it.
 */
export function getPlanningFocusWorldIdentifiers({
  innerClusterLive = false,
  commandRouteAvailable = false,
  predictedBodyIdentifiers = [],
  currentWorldIdentifier = '',
  innerClusterWorldIdentifiers = [],
  furtherReachWorldIdentifiers = [],
  commandWorldIdentifier = 'worldheart',
  nearbyWorldIdentifiers = [],
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
  if (!Array.isArray(nearbyWorldIdentifiers)) {
    throw new Error('Planning focus requires a nearby-world list.');
  }
  const Identifiers = new Set();
  if (typeof currentWorldIdentifier === 'string' && currentWorldIdentifier.length > 0) {
    Identifiers.add(currentWorldIdentifier);
  }
  if (innerClusterLive !== true) {
    for (const WorldIdentifier of innerClusterWorldIdentifiers) {
      Identifiers.add(WorldIdentifier);
    }
  } else {
    for (const WorldIdentifier of nearbyWorldIdentifiers) {
      if (typeof WorldIdentifier === 'string' && WorldIdentifier.length > 0) {
        Identifiers.add(WorldIdentifier);
      }
    }
  }
  if (commandRouteAvailable === true && typeof commandWorldIdentifier === 'string') {
    Identifiers.add(commandWorldIdentifier);
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
  if (Keys.includes('ember') || Keys.includes('kiln') || Keys.includes('lantern')) {
    return 'barge';
  }
  if (
    Keys.includes('grove')
    || Keys.includes('loom')
    || Keys.includes('bower')
    || Keys.includes('canopy')
  ) {
    return 'sail';
  }
  if (Keys.includes('frost') || Keys.includes('crown')) {
    return 'sled';
  }
  if (Keys.includes('tide') || Keys.includes('drift') || Keys.includes('dew')) {
    return 'hull';
  }
  if (
    Keys.includes('vault')
    || Keys.includes('shard')
    || Keys.includes('nest')
    || Keys.includes('bastion')
  ) {
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

/** Three pooled hulls: barges, sails and a shared low courier. */
export function getTradeHullFamily(kind) {
  if (kind === 'sail') {
    return 'sail';
  }
  if (kind === 'barge') {
    return 'barge';
  }
  return 'sled';
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

const DerivedOccupationLatitudes = [0.35, -0.35, 0.7, -0.7, 0.18, -0.55];
const ProsperityBuildingFamilies = {
  meadow: 'cottage',
  bower: 'cottage',
  relay: 'cottage',
  ember: 'furnace',
  kiln: 'furnace',
  lantern: 'furnace',
  vault: 'furnace',
  shard: 'furnace',
  crown: 'furnace',
  grove: 'canopy',
  loom: 'canopy',
  canopy: 'canopy',
  tide: 'jetty',
  drift: 'jetty',
  dew: 'jetty',
  frost: 'jetty',
  nest: 'jetty',
};

/** Spreads fallback scars off the equator so unauthored globes are not empty rings. */
export function getDerivedOccupationLatitude(patternIndex = 0) {
  if (!Number.isInteger(patternIndex) || patternIndex < 0) {
    throw new Error('Derived occupation latitude requires a non-negative pattern index.');
  }
  return DerivedOccupationLatitudes[patternIndex % DerivedOccupationLatitudes.length];
}

export function resolveOccupationSite(siteOrAngle, patternIndex = 0, { deriveLatitude = false } = {}) {
  if (Number.isFinite(siteOrAngle)) {
    return {
      longitude: siteOrAngle,
      latitude: deriveLatitude ? getDerivedOccupationLatitude(patternIndex) : 0,
    };
  }
  if (
    siteOrAngle
    && Number.isFinite(siteOrAngle.longitude)
    && Number.isFinite(siteOrAngle.latitude)
  ) {
    return {
      longitude: siteOrAngle.longitude,
      latitude: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, siteOrAngle.latitude)),
    };
  }
  throw new Error('Occupation site requires a finite angle or longitude and latitude.');
}

/** Authored sphere sites win; scar angles fall back, optionally leaving the equator. */
export function listOccupationSites(worldDefinition = {}, { deriveLatitude = true } = {}) {
  const AuthoredSites = worldDefinition.occupationSites;
  if (Array.isArray(AuthoredSites) && AuthoredSites.length > 0) {
    return AuthoredSites.map((Site, PatternIndex) => (
      resolveOccupationSite(Site, PatternIndex, { deriveLatitude: false })
    ));
  }
  const ScarAngles = worldDefinition.occupationScarAngles ?? [];
  return ScarAngles.map((Angle, PatternIndex) => (
    resolveOccupationSite(Angle, PatternIndex, { deriveLatitude })
  ));
}

/** Cottage, furnace, canopy or jetty — pooled families, not per-world meshes. */
export function getProsperityBuildingFamily(visualKey) {
  if (typeof visualKey !== 'string' || visualKey.length === 0) {
    throw new Error('Prosperity building family requires a visual key.');
  }
  return ProsperityBuildingFamilies[visualKey] ?? 'cottage';
}

/**
 * Places life on the crust with up along the surface normal. Presentation only:
 * Destroy clamps and flight stay in the orbital plane.
 */
export function getSphereLifePlacement({
  worldX,
  worldY,
  worldZ = 0,
  worldRadius,
  longitude,
  latitude,
  radialOffset = 0,
} = {}) {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY) || !Number.isFinite(worldZ)) {
    throw new Error('Sphere life placement requires a finite world centre.');
  }
  if (!Number.isFinite(worldRadius) || worldRadius <= 0) {
    throw new Error('Sphere life placement requires a positive world radius.');
  }
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error('Sphere life placement requires a finite longitude and latitude.');
  }
  if (!Number.isFinite(radialOffset)) {
    throw new Error('Sphere life placement requires a finite radial offset.');
  }
  const CosLatitude = Math.cos(latitude);
  const DirectionX = CosLatitude * Math.cos(longitude);
  const DirectionY = CosLatitude * Math.sin(longitude);
  const DirectionZ = Math.sin(latitude);
  const Distance = worldRadius + radialOffset;
  return {
    x: worldX + (DirectionX * Distance),
    y: worldY + (DirectionY * Distance),
    z: worldZ + (DirectionZ * Distance),
    directionX: DirectionX,
    directionY: DirectionY,
    directionZ: DirectionZ,
    longitude,
    latitude,
  };
}

/** Short patrols around a home site, huddling at the mine and gathering at a dock. */
export function getInhabitantSurfaceSite({
  homeSite,
  slotIndex = 0,
  isGuard = false,
  freedom = 1,
  walkingOffset = 0,
  gatherSite = null,
  gatherBlend = 0,
} = {}) {
  if (!Number.isFinite(homeSite?.longitude) || !Number.isFinite(homeSite?.latitude)) {
    throw new Error('Inhabitant surface site requires a finite home site.');
  }
  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    throw new Error('Inhabitant surface site requires a non-negative slot index.');
  }
  if (!Number.isFinite(freedom) || !Number.isFinite(walkingOffset) || !Number.isFinite(gatherBlend)) {
    throw new Error('Inhabitant surface site requires finite motion values.');
  }
  const HeldLongitude = homeSite.longitude + (isGuard ? 0.1 : -0.14);
  const HeldLatitude = homeSite.latitude + (isGuard ? 0.04 : -0.03);
  const PatrolLongitude = homeSite.longitude + walkingOffset;
  const PatrolLatitude = homeSite.latitude
    + (Math.sin((slotIndex * 0.9) + (walkingOffset * 3)) * 0.12);
  let FreeLongitude = PatrolLongitude;
  let FreeLatitude = PatrolLatitude;
  if (gatherSite && gatherBlend > 0) {
    if (!Number.isFinite(gatherSite.longitude) || !Number.isFinite(gatherSite.latitude)) {
      throw new Error('Inhabitant gather site requires finite longitude and latitude.');
    }
    FreeLongitude += (gatherSite.longitude - PatrolLongitude) * gatherBlend;
    FreeLatitude += (gatherSite.latitude - PatrolLatitude) * gatherBlend;
  }
  return {
    longitude: HeldLongitude + ((FreeLongitude - HeldLongitude) * freedom),
    latitude: Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, HeldLatitude + ((FreeLatitude - HeldLatitude) * freedom)),
    ),
  };
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

/** Worker and child share a helmeted walker; pack is a four-legged beast. */
export function getInhabitantSilhouette(slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    throw new Error('Inhabitant silhouette requires a non-negative slot index.');
  }
  const Variants = ['worker', 'child', 'pack'];
  const Kind = Variants[slotIndex % 3];
  const Scales = {
    worker: { x: 1.28, y: 1.36, z: 1.22 },
    child: { x: 0.88, y: 0.82, z: 0.86 },
    pack: { x: 1.48, y: 1.12, z: 1.72 },
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

/**
 * Sits outside the Runner's current face of the globe so walking traverses 3D
 * rotational space. Reduced motion keeps the current top-down follow. Launch
 * still flattens into the orbital plane.
 */
export function getLandedSurfaceCameraPose({
  worldX,
  worldY,
  worldZ = 0,
  worldRadius,
  runnerX,
  runnerY,
  runnerZ = 0,
  cameraScale,
  baseCameraDistance,
  reducedMotion = false,
} = {}) {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY) || !Number.isFinite(worldZ)) {
    throw new Error('Landed camera pose requires a finite world centre.');
  }
  if (!Number.isFinite(worldRadius) || worldRadius <= 0) {
    throw new Error('Landed camera pose requires a positive world radius.');
  }
  if (!Number.isFinite(runnerX) || !Number.isFinite(runnerY) || !Number.isFinite(runnerZ)) {
    throw new Error('Landed camera pose requires a finite runner position.');
  }
  if (!Number.isFinite(cameraScale) || cameraScale <= 0) {
    throw new Error('Landed camera pose requires a positive camera scale.');
  }
  if (!Number.isFinite(baseCameraDistance) || baseCameraDistance <= 0) {
    throw new Error('Landed camera pose requires a positive base camera distance.');
  }
  if (reducedMotion) {
    return {
      cameraX: runnerX,
      cameraY: runnerY,
      cameraZ: baseCameraDistance * cameraScale,
      lookAtX: runnerX,
      lookAtY: runnerY,
      lookAtZ: 0,
      upX: 0,
      upY: 0,
      upZ: 1,
    };
  }
  const OffsetX = runnerX - worldX;
  const OffsetY = runnerY - worldY;
  const OffsetZ = runnerZ - worldZ;
  const OffsetDistance = Math.hypot(OffsetX, OffsetY, OffsetZ) || 1;
  const DirectionX = OffsetX / OffsetDistance;
  const DirectionY = OffsetY / OffsetDistance;
  const DirectionZ = OffsetZ / OffsetDistance;
  const PoleLock = Math.abs(DirectionZ) > 0.92;
  const LiftedZ = PoleLock ? DirectionZ : DirectionZ + 0.38;
  const LiftedDistance = Math.hypot(DirectionX, DirectionY, LiftedZ) || 1;
  const CameraDirectionX = DirectionX / LiftedDistance;
  const CameraDirectionY = DirectionY / LiftedDistance;
  const CameraDirectionZ = LiftedZ / LiftedDistance;
  const ClosePull = worldRadius * 2.35;
  const ZoomPull = baseCameraDistance * cameraScale;
  const RadialPull = Math.max(ClosePull, ZoomPull);
  const LookAlongRadius = worldRadius * 0.34;
  return {
    cameraX: worldX + (CameraDirectionX * RadialPull),
    cameraY: worldY + (CameraDirectionY * RadialPull),
    cameraZ: worldZ + (CameraDirectionZ * RadialPull),
    lookAtX: worldX + (DirectionX * LookAlongRadius),
    lookAtY: worldY + (DirectionY * LookAlongRadius),
    lookAtZ: worldZ + (DirectionZ * LookAlongRadius),
    upX: 0,
    upY: PoleLock ? 1 : 0,
    upZ: PoleLock ? 0 : 1,
  };
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
  const FramedHeight = worldRadius * 3.22;
  return Math.min(
    maximumScale,
    Math.max(minimumScale, FramedHeight / viewportWorldHeight),
  );
}

/** Follows the ship in flight with enough height to read the next gravity well. */
export function getFlightCameraScale({
  worldRadius = 3,
  viewportWorldHeight = 24,
  minimumScale = 0.62,
  maximumScale = 0.92,
  targetDistance = 0,
  shipSpeed = 0,
} = {}) {
  if (!Number.isFinite(worldRadius) || worldRadius <= 0) {
    throw new Error('Flight camera requires a positive world radius.');
  }
  if (!Number.isFinite(viewportWorldHeight) || viewportWorldHeight <= 0) {
    throw new Error('Flight camera requires a positive viewport height.');
  }
  const SafeTargetDistance = Number.isFinite(targetDistance) ? Math.max(0, targetDistance) : 0;
  const SafeShipSpeed = Number.isFinite(shipSpeed) ? Math.max(0, shipSpeed) : 0;
  const FramedHeight = (worldRadius * 6.2)
    + Math.min(8.5, SafeTargetDistance * 0.22)
    + Math.min(4.5, SafeShipSpeed * 0.38);
  return Math.min(
    maximumScale,
    Math.max(minimumScale, FramedHeight / viewportWorldHeight),
  );
}

/**
 * Keeps the ship in frame after a Break or void miss by looking ahead of
 * velocity and biasing slightly toward the next world.
 */
export function getFlightFollowFrame({
  shipX,
  shipY,
  velocityX = 0,
  velocityY = 0,
  targetX = null,
  targetY = null,
  worldRadius = 3,
  viewportWorldHeight = 24,
  lookaheadSeconds = 0.48,
} = {}) {
  if (!Number.isFinite(shipX) || !Number.isFinite(shipY)) {
    throw new Error('Flight follow requires a finite ship position.');
  }
  const VelocityX = Number.isFinite(velocityX) ? velocityX : 0;
  const VelocityY = Number.isFinite(velocityY) ? velocityY : 0;
  const Speed = Math.hypot(VelocityX, VelocityY);
  const Lookahead = Math.min(6.2, Speed * Math.max(0, lookaheadSeconds));
  let lookX = shipX;
  let lookY = shipY;
  if (Speed > 1e-4) {
    lookX += (VelocityX / Speed) * Lookahead;
    lookY += (VelocityY / Speed) * Lookahead;
  }
  let targetDistance = 0;
  if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
    targetDistance = Math.hypot(targetX - shipX, targetY - shipY);
    const FrameBlend = Math.min(0.28, targetDistance / 42);
    lookX += (targetX - lookX) * FrameBlend;
    lookY += (targetY - lookY) * FrameBlend;
  }
  return {
    lookX,
    lookY,
    lookZ: 0,
    scale: getFlightCameraScale({
      worldRadius,
      viewportWorldHeight,
      targetDistance,
      shipSpeed: Speed,
    }),
  };
}

/** Occupied rims keep biome colour instead of flattening to one grey shell. */
export function getOccupiedAtmosphereOpacity(atmosphereOpacity = 0.12) {
  if (!Number.isFinite(atmosphereOpacity) || atmosphereOpacity < 0) {
    throw new Error('Occupied atmosphere requires a non-negative opacity.');
  }
  return Math.max(0.08, Math.min(0.16, 0.07 + (atmosphereOpacity * 0.5)));
}

/** Frost ice, Ember basalt and Grove canopy read at a glance without extra draws. */
export function getWorldSurfaceFinish(visualKey) {
  if (visualKey === 'frost' || visualKey === 'nest' || visualKey === 'shard') {
    return { roughness: 0.28, metalness: 0.22 };
  }
  if (visualKey === 'ember' || visualKey === 'kiln' || visualKey === 'lantern' || visualKey === 'vault') {
    return { roughness: 0.5, metalness: 0.14 };
  }
  if (visualKey === 'tide' || visualKey === 'drift' || visualKey === 'dew') {
    return { roughness: 0.4, metalness: 0.16 };
  }
  if (visualKey === 'grove' || visualKey === 'canopy') {
    return { roughness: 0.76, metalness: 0.04 };
  }
  return { roughness: 0.82, metalness: 0.03 };
}

/** World pills stay off during landed play and while a toast covers the playfield. */
export function shouldShowPlayfieldWorldLabels({
  isPointerAiming = false,
  isKeyboardAiming = false,
  isScoutMode = false,
  toastVisible = false,
} = {}) {
  return (isPointerAiming === true || isKeyboardAiming === true || isScoutMode === true)
    && toastVisible !== true;
}

function getPlayfieldLabelStyle(LabelElement) {
  if (!LabelElement.style) {
    LabelElement.style = {};
  }
  return LabelElement.style;
}

/**
 * Collapses a projected world/tactical chip so an empty label cannot paint a
 * leftover screen-space box (cream plaque or black bar) after hide.
 */
export function collapsePlayfieldLabelBox(LabelElement) {
  if (!LabelElement) {
    return LabelElement;
  }
  LabelElement.textContent = '';
  LabelElement.hidden = true;
  if (LabelElement.dataset) {
    LabelElement.dataset.visible = 'false';
  }
  const Style = getPlayfieldLabelStyle(LabelElement);
  Style.left = '';
  Style.top = '';
  Style.display = 'none';
  Style.visibility = 'hidden';
  Style.background = 'none';
  Style.border = '0';
  Style.padding = '0';
  Style.margin = '0';
  Style.width = '0';
  Style.height = '0';
  Style.minWidth = '0';
  Style.minHeight = '0';
  Style.maxWidth = '0';
  Style.maxHeight = '0';
  Style.overflow = 'hidden';
  Style.boxShadow = 'none';
  Style.backdropFilter = 'none';
  Style.webkitBackdropFilter = 'none';
  Style.color = 'transparent';
  Style.textShadow = 'none';
  Style.transform = 'none';
  Style.opacity = '0';
  Style.pointerEvents = 'none';
  return LabelElement;
}

/** Restores a chip so aiming/scout text can size to its glyphs only. */
export function revealPlayfieldLabelBox(LabelElement) {
  if (!LabelElement) {
    return LabelElement;
  }
  LabelElement.hidden = false;
  if (LabelElement.dataset) {
    LabelElement.dataset.visible = 'true';
  }
  const Style = getPlayfieldLabelStyle(LabelElement);
  Style.display = '';
  Style.visibility = '';
  Style.width = '';
  Style.height = '';
  Style.minWidth = '';
  Style.minHeight = '';
  Style.maxWidth = '';
  Style.maxHeight = '';
  Style.overflow = '';
  Style.color = '';
  Style.textShadow = '';
  Style.transform = '';
  Style.opacity = '';
  Style.margin = '';
  Style.background = 'none';
  Style.border = '0';
  Style.padding = '0';
  Style.boxShadow = 'none';
  Style.backdropFilter = 'none';
  Style.webkitBackdropFilter = 'none';
  Style.pointerEvents = 'none';
  return LabelElement;
}

/** True when an empty playfield chip has no background and no layout size. */
export function isPlayfieldLabelBoxCollapsed(LabelElement) {
  if (!LabelElement) {
    return true;
  }
  const Text = typeof LabelElement.textContent === 'string'
    ? LabelElement.textContent.trim()
    : '';
  const Style = LabelElement.style ?? {};
  const Background = String(Style.background ?? '');
  return LabelElement.hidden === true
    && LabelElement.dataset?.visible === 'false'
    && Text.length < 1
    && Style.display === 'none'
    && Style.width === '0'
    && Style.height === '0'
    && (Background === 'none' || Background === 'transparent')
    && Style.overflow === 'hidden';
}

/** Close-up cameras keep space dark; scout can keep more nebula without washing planets. */
export function getCloseViewPresentation(cameraDistanceScale = 1) {
  if (!Number.isFinite(cameraDistanceScale) || cameraDistanceScale <= 0) {
    throw new Error('Close view presentation requires a positive camera scale.');
  }
  const CloseFade = Math.max(0, Math.min(1, (1.05 - cameraDistanceScale) / 0.7));
  return {
    closeFade: CloseFade,
    nebulaIntensity: 0.58 - (CloseFade * 0.22),
    dustOpacityScale: 0.4 + ((1 - CloseFade) * 0.6),
    bloomStrength: 0.32 + ((1 - CloseFade) * 0.2),
    bloomThreshold: 0.76 + (CloseFade * 0.14),
  };
}

/** Hides a projected chip that has collapsed onto the current world's disc. */
export function isProjectedLabelInsideWorldDisc({
  labelNdcX,
  labelNdcY,
  worldNdcX,
  worldNdcY,
  worldRimNdcX,
  worldRimNdcY,
} = {}) {
  const Values = [labelNdcX, labelNdcY, worldNdcX, worldNdcY, worldRimNdcX, worldRimNdcY];
  if (Values.some((Value) => !Number.isFinite(Value))) {
    return false;
  }
  const DiscRadius = Math.hypot(worldRimNdcX - worldNdcX, worldRimNdcY - worldNdcY);
  if (!(DiscRadius > 0)) {
    return false;
  }
  return Math.hypot(labelNdcX - worldNdcX, labelNdcY - worldNdcY) < (DiscRadius * 0.92);
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

/**
 * The face the Runner stands on is the launch azimuth. Walking exists to look
 * at a destination, not to tour the planet.
 */
export function getLaunchFacingPresentation({
  originX,
  originY,
  longitude,
  candidates = [],
} = {}) {
  if (!Number.isFinite(originX) || !Number.isFinite(originY) || !Number.isFinite(longitude)) {
    throw new Error('Launch facing requires a finite origin and longitude.');
  }
  if (!Array.isArray(candidates) || candidates.length < 1) {
    return {
      worldId: null,
      label: '',
      alignment: 0,
      isFacing: false,
    };
  }
  const RadialX = Math.cos(longitude);
  const RadialY = Math.sin(longitude);
  let Best = null;
  for (const Candidate of candidates) {
    const OffsetX = Candidate.x - originX;
    const OffsetY = Candidate.y - originY;
    const Length = Math.hypot(OffsetX, OffsetY) || 1;
    const Alignment = ((OffsetX / Length) * RadialX) + ((OffsetY / Length) * RadialY);
    if (!Best || Alignment > Best.alignment) {
      Best = {
        worldId: Candidate.id,
        label: Candidate.label,
        alignment: Alignment,
      };
    }
  }
  return {
    worldId: Best.worldId,
    label: Best.label,
    alignment: Best.alignment,
    isFacing: Best.alignment > 0.35,
  };
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
 * Frames the whole Reach while aiming so a multi-world slingshot chain is visible.
 * Flight follows the ship; intimate rest framing returns after landing.
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
    wellOpacity: Visible ? 0.14 : 0,
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

/** Route chips use the same half-width clamp so they are not cut in half at the edge. */
export function getRouteLabelHorizontalMargin(LabelText) {
  return getTacticalLabelHorizontalMargin(LabelText);
}

/** Opening plays once per session; later Reset/R restarts the run without the Warden intro. */
export function shouldPlayOpeningBriefing({
  hasCompletedOpeningBriefing = false,
  replayActive = false,
} = {}) {
  if (replayActive === true) {
    return false;
  }
  return hasCompletedOpeningBriefing !== true;
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

/** Keeps aim/scout labels below the pause control and above the caption band. */
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
  const WardenReserve = wardenVisible ? (isShortLandscape ? 72 : 88) : 0;
  if (isShortLandscape) return 56 + WardenReserve;
  if (isCompact) return (isTactical ? 64 : 72) + WardenReserve;
  return (isTactical ? 56 : 64) + WardenReserve;
}

/** Keeps projected chips inside the playfield when HTML labels are active. */
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
  const CaptionReserve = isCompact ? 96 : 88;
  const BaseMaximumY = viewportHeight - CaptionReserve;
  const MaximumY = Math.max(
    0,
    Math.min(BaseMaximumY, instructionTop - 16),
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
      label: 'CLOSE LOOPS',
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
      body: 'The next world hides behind gravity. Bend the aim line through a gold slingshot ring to reach it.',
    };
  }
  return {
    title: Title,
    body: typeof openingBody === 'string' && openingBody.trim() !== ''
      ? openingBody
      : 'They are still out there. Carry the first word.',
  };
}

/** Makes pursuit readable: a launch is the turn, a return flight closes the loop. */
export function getPursuitRouteCoach({
  circuitLabels = [],
  expansionLabel = '',
  commandAvailable = false,
  allWorldsRestored = false,
  uniqueCircuitCount = 0,
  circuitExposeCount = 2,
  remainingBonusFuel = 0,
  wardenDistance = 0,
  wardenTargetLabel = '',
  authoredGuidance = '',
} = {}) {
  if (!Array.isArray(circuitLabels)) {
    throw new Error('Pursuit coach requires circuit labels.');
  }
  if (!Number.isInteger(uniqueCircuitCount) || uniqueCircuitCount < 0) {
    throw new Error('Pursuit coach requires a non-negative circuit count.');
  }
  const FuelNote = remainingBonusFuel === 0
    ? ' Bonus fuel is spent — you can still launch.'
    : '';
  const TargetNote = typeof wardenTargetLabel === 'string' && wardenTargetLabel !== ''
    ? ` before it silences ${wardenTargetLabel}`
    : '';
  const StepNote = Number.isInteger(wardenDistance) && wardenDistance > 0
    ? ` Each launch is one Warden step (${wardenDistance} left${TargetNote}).`
    : ' Each launch is one Warden step.';
  const FirstCircuit = typeof circuitLabels[0] === 'string' ? circuitLabels[0] : '';
  const SecondCircuit = typeof circuitLabels[1] === 'string' ? circuitLabels[1] : '';
  const Guidance = typeof authoredGuidance === 'string' && authoredGuidance.trim() !== ''
    ? authoredGuidance
    : '';

  if (commandAvailable === true) {
    return {
      title: 'The COMMAND WORLD route is open',
      body: (allWorldsRestored === true
        ? 'Land on the moving golden core.'
        : 'Land on the moving Command World, or free another world first.') + FuelNote,
    };
  }
  if (FirstCircuit && SecondCircuit) {
    return {
      title: `Close a loop via ${FirstCircuit} or ${SecondCircuit}`,
      body: (Guidance || 'A loop is a return flight to a world that already talks. Two loops expose Command.')
        + StepNote + FuelNote,
    };
  }
  if (FirstCircuit) {
    return {
      title: `Close a loop via ${FirstCircuit}`,
      body: (Guidance || (
        expansionLabel
          ? `Fly back to ${FirstCircuit} to close gold, or expand to ${expansionLabel}.`
          : `Fly back to ${FirstCircuit}. Visiting new worlds is not enough.`
      )) + StepNote + FuelNote,
    };
  }
  if (allWorldsRestored === true) {
    return {
      title: 'Worlds are awake. Close a loop.',
      body: `Fly back to a neighbour you already linked. ${uniqueCircuitCount} / ${circuitExposeCount} loops closed.`
        + StepNote + FuelNote,
    };
  }
  return {
    title: 'Close a gold loop',
    body: 'Land on a world that already talks to this one by another route. That landing is the turn.'
      + StepNote + FuelNote,
  };
}

/** Warden HUD copy: distance is remaining resolved flights, not a separate clock. */
export function getWardenApproachCopy({
  defeated = false,
  exposed = false,
  distance = 0,
  targetLabel = '',
  blocked = false,
} = {}) {
  if (defeated === true) {
    return {
      state: 'WARDEN DEFEATED',
      distance: 'SIGNAL BROKEN',
      target: 'WORLDS RESPONDING',
    };
  }
  if (exposed === true) {
    return {
      state: 'COMMAND EXPOSED',
      distance: 'LAND ON COMMAND',
      target: 'COMMAND WORLD',
    };
  }
  if (!Number.isInteger(distance) || distance < 0) {
    throw new Error('Warden approach copy requires a non-negative flight distance.');
  }
  const Target = typeof targetLabel === 'string' && targetLabel.trim() !== ''
    ? `NEXT: ${targetLabel.trim()}`
    : (blocked === true ? 'NETWORK BLOCKED' : 'TARGET UNKNOWN');
  return {
    state: 'WARDEN INBOUND',
    distance: distance === 0
      ? 'ARRIVING THIS LANDING'
      : `${distance} FLIGHT${distance === 1 ? '' : 'S'} AWAY`,
    target: Target,
  };
}

/**
 * Pursuit-track pips between the Warden and the Runner.
 *
 * Returns one entry per flight of maximum pursuit range: 'taken' pips are the
 * ground the Warden has already covered, 'remaining' pips are the flights left
 * before it arrives. An empty array hides the track (defeated/exposed states).
 */
export function getWardenTrackPips({ distance = 0, maximumDistance = 0, visible = true } = {}) {
  if (
    visible !== true
    || !Number.isInteger(distance)
    || !Number.isInteger(maximumDistance)
    || maximumDistance < 1
    || distance < 0
    || distance > maximumDistance
  ) {
    return [];
  }
  const Pips = [];
  for (let PipIndex = 0; PipIndex < maximumDistance; PipIndex += 1) {
    Pips.push(PipIndex < maximumDistance - distance ? 'taken' : 'remaining');
  }
  return Pips;
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

const StoryPortraitWorldIdentifiers = Object.freeze({
  haven: 'meadow',
  ember: 'ember',
  grove: 'grove',
  tide: 'tide',
  frost: 'frost',
  bastion: 'bastion',
  command: 'worldheart',
});

/** Chooses what a story board should look at without taking control of physics. */
export function getStoryBoardCameraFocus({
  boardId = '',
  portrait = '',
  focusWorldId = '',
} = {}) {
  if (typeof boardId !== 'string' || typeof portrait !== 'string') {
    throw new Error('Story camera focus requires board and portrait ids.');
  }
  if (boardId === 'rangeUnlock' || boardId === 'neighbourhood') {
    return { kind: 'neighbourhood', scale: 1 };
  }
  if (boardId === 'wardenArrival' || portrait === 'warden') {
    return { kind: 'warden', scale: 0.82 };
  }
  if (boardId === 'commandExposed' || portrait === 'command') {
    return { kind: 'command', scale: 0.78 };
  }
  if (typeof focusWorldId === 'string' && focusWorldId.trim() !== '') {
    return { kind: 'world', worldId: focusWorldId, scale: 0.62 };
  }
  if (portrait === 'runner' || portrait === 'orbitbreaker') {
    return { kind: 'runner', scale: 0.55 };
  }
  const WorldId = StoryPortraitWorldIdentifiers[portrait];
  if (WorldId) {
    return { kind: 'world', worldId: WorldId, scale: 0.62 };
  }
  if (boardId === 'suppression' || boardId === 'recapture') {
    return { kind: 'named', scale: 0.62 };
  }
  return { kind: 'runner', scale: 0.55 };
}

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
  maybeQueue('firstSpindle', linkCreated === true && linkedWorldIdentifier === 'spindle');
  maybeQueue('firstQuarry', linkCreated === true && linkedWorldIdentifier === 'quarry');
  maybeQueue('firstMirage', linkCreated === true && linkedWorldIdentifier === 'mirage');
  maybeQueue('firstShard', linkCreated === true && linkedWorldIdentifier === 'shard');
  maybeQueue('firstDrift', linkCreated === true && linkedWorldIdentifier === 'drift');
  maybeQueue('firstVault', linkCreated === true && linkedWorldIdentifier === 'vault');
  maybeQueue('firstCrown', linkCreated === true && linkedWorldIdentifier === 'crown');
  maybeQueue('firstDew', linkCreated === true && linkedWorldIdentifier === 'dew');
  maybeQueue('firstNest', linkCreated === true && linkedWorldIdentifier === 'nest');
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
  'firstVault',
  'firstNest',
]);

/**
 * Beats that change the run's rules. They jump ahead of flavour beats and may
 * present back-to-back; flavour beats are spaced to at most one per landing.
 */
export const CriticalStoryBoardIds = Object.freeze([
  'wardenArrival',
  'circuitClosed',
  'suppression',
  'recapture',
  'commandExposed',
  'commandApproach',
  'reachAnswers',
  'runLost',
]);

/** True when a story board must present immediately rather than wait for a later landing. */
export function isCriticalStoryBoard(BoardId) {
  return CriticalStoryBoardIds.includes(BoardId);
}

/** Boards wait for the landing beat, then pause play. They never cover a live liberation. */
export function isCampaignStoryBoardReadyToPresent({
  briefingActive = false,
  replayActive = false,
  gamePhase = 'attached',
  relayRevealActive = false,
  liberationCelebrateActive = false,
  hostileEncounterActive = false,
  boardId = '',
} = {}) {
  if (
    briefingActive === true
    || replayActive === true
    || relayRevealActive === true
    || liberationCelebrateActive === true
  ) {
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
export const LiberationCelebrateHoldSeconds = 1.05;
export const CageClearPulseDurationSeconds = 1.08;
export const CageClearPulseReducedMotionDurationSeconds = 0.18;

/** Cage-clear wrap/bloom duration after the last Destroy. Reduced motion keeps a short flash. */
export function getCageClearPulseDurationSeconds({
  prefersReducedMotion = false,
} = {}) {
  return prefersReducedMotion === true
    ? CageClearPulseReducedMotionDurationSeconds
    : CageClearPulseDurationSeconds;
}

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

/**
 * One always-visible chip that says which control mode the Runner is in, so a
 * new player never has to guess whether a drag will walk, aim or scout.
 */
export function getControlModePresentation({
  gamePhase = 'attached',
  isAiming = false,
  isWalking = false,
  isScoutMode = false,
  isBurnAiming = false,
  isBreakAvailable = false,
  replayActive = false,
  briefingActive = false,
} = {}) {
  if (typeof gamePhase !== 'string' || gamePhase.length === 0) {
    throw new Error('Control mode presentation requires a game phase.');
  }
  const Hidden = { mode: 'hidden', label: '', hint: '', visible: false };
  if (replayActive || briefingActive) {
    return Hidden;
  }
  if (gamePhase === 'victory' || gamePhase === 'victoryPending' || gamePhase === 'runFailed') {
    return Hidden;
  }
  if (gamePhase === 'recovering') {
    return {
      mode: 'recover',
      label: 'RECOVERY',
      hint: 'Returning to your last safe world',
      visible: true,
    };
  }
  if (gamePhase === 'flying') {
    if (isBurnAiming) {
      return {
        mode: 'flight',
        label: 'BREAK',
        hint: 'Release to bend your line',
        visible: true,
      };
    }
    return {
      mode: 'flight',
      label: 'FLIGHT',
      hint: isBreakAvailable
        ? 'Riding gravity · tap once to Break your line'
        : 'Riding gravity to the landing',
      visible: true,
    };
  }
  if (isScoutMode) {
    return {
      mode: 'scout',
      label: 'SCOUT',
      hint: 'Drag to survey the sector · Scout again to return',
      visible: true,
    };
  }
  if (isAiming) {
    return {
      mode: 'launch',
      label: 'LAUNCH',
      hint: 'Release to fly · drag back to the ship to cancel',
      visible: true,
    };
  }
  if (isWalking) {
    return {
      mode: 'walk',
      label: 'WALK',
      hint: 'Trace the globe · release to stand and face your route',
      visible: true,
    };
  }
  return {
    mode: 'explore',
    label: 'EXPLORE',
    hint: 'Trace the globe to walk · pull the ship to launch',
    visible: true,
  };
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

