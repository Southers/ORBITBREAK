/**
 * Planning camera, Scout zoom and live follow.
 * Trajectory line drawing stays in the playable shell next to player meshes.
 */

import { getScoutZoomPresentation } from './controls.js';
import { countLiveRelayWorlds, listRelayCircuits } from './network.js';
import {
  getLandedCameraScale,
  getFlightCameraScale,
  getPlanningAtmosphere,
  getPlanningFocusWorldIdentifiers,
  getSectorPlanningCamera,
  shouldHoldCommittedPrediction,
} from './presentation.js';

export function createCameraController(THREE, host) {
  const {
    Camera,
    GameCanvas,
    Scene,
    Renderer,
    CameraLookTarget,
    DesiredCameraLookTarget,
    PlanningCameraLookTarget,
    CameraPanOffset,
    ScoutCameraTarget,
    ScoutZoomOutButtonElement,
    ScoutZoomInButtonElement,
    ScoutZoomStatusElement,
    ScoutButtonElement,
    WorldDefinitions,
    WorldheartDefinition,
    PredictedSlingshotWorldIdentifiers,
    TrajectoryMaterial,
    MinimumScoutZoomScale,
    isLiveInnerCluster,
    getSectorClusterRules,
    calculateBodyPositionAtTime,
    getWorldDefinition,
    getActiveMaximumScoutZoomScale,
    renderTrajectoryLine,
    predictCurrentLaunchTrajectory,
    updatePersonalBestGhostVisibility,
    resizeRenderer,
    updateScannerInterface,
  } = host;
  const ActiveSystem = host.ActiveSystem;

function captureAimInteractionCamera() {
  if (host.AimInteractionCamera) {
    return;
  }
  host.AimInteractionCamera = Camera.clone();
}

function releaseAimInteractionCamera() {
  host.AimInteractionCamera = null;
}

function rememberPlanningPath(Prediction) {
  host.LastPredictedBodyIdentifier = Prediction?.collisionWorldIdentifier
    || Prediction?.collisionBodyIdentifier
    || '';
  const Points = Array.isArray(Prediction?.points) ? Prediction.points : [];
  if (Points.length < 1) {
    host.LastPlanningPathPoints = [];
    return;
  }
  const Sampled = [];
  const SampleStride = Math.max(1, Math.floor(Points.length / 12));
  for (let PointIndex = 0; PointIndex < Points.length; PointIndex += SampleStride) {
    const Point = Points[PointIndex];
    Sampled.push({ x: Point.x, y: Point.y });
  }
  const LastPoint = Points[Points.length - 1];
  Sampled.push({ x: LastPoint.x, y: LastPoint.y });
  host.LastPlanningPathPoints = Sampled;
}

function getPlanningFocusPoints() {
  const CurrentWorldIdentifier = host.CurrentWorldIdentifier ?? '';
  const NearbyWorldIdentifiers = ActiveSystem.routeSuggestions?.[CurrentWorldIdentifier] ?? [];
  const AllowedIdentifiers = new Set(getPlanningFocusWorldIdentifiers({
    innerClusterLive: isLiveInnerCluster(),
    commandRouteAvailable: WorldheartDefinition.routeAvailable === true,
    predictedBodyIdentifiers: [
      host.LastPredictedBodyIdentifier,
      ...PredictedSlingshotWorldIdentifiers,
    ],
    currentWorldIdentifier: CurrentWorldIdentifier,
    nearbyWorldIdentifiers: NearbyWorldIdentifiers,
    ...getSectorClusterRules(),
  }));
  const FocusPoints = WorldDefinitions
    .filter((WorldDefinition) => AllowedIdentifiers.has(WorldDefinition.id))
    .map((WorldDefinition) => WorldDefinition.position);
  if (AllowedIdentifiers.has(WorldheartDefinition.id)) {
    FocusPoints.push(calculateBodyPositionAtTime(WorldheartDefinition, host.PhysicsElapsedTimeSeconds));
  }
  return FocusPoints;
}

function applySectorPlanningCamera() {
  if (host.IsScoutMode || !ActiveSystem.camera?.followPlayer) {
    host.PlanningCameraScale = 1;
    return;
  }
  const FocusPoints = getPlanningFocusPoints();
  const PlanningCamera = getSectorPlanningCamera({
    runner: host.SeedPhysicsState.position,
    focusPoints: FocusPoints,
    pathPoints: host.LastPlanningPathPoints,
    viewportWorldWidth: ActiveSystem.camera?.viewportWorldWidth ?? 20,
    viewportWorldHeight: ActiveSystem.camera?.viewportWorldHeight ?? 24,
  });
  PlanningCameraLookTarget.set(PlanningCamera.lookX, PlanningCamera.lookY, 0);
  host.PlanningCameraScale = PlanningCamera.scale;
  GameCanvas.dataset.planningCameraScale = PlanningCamera.scale.toFixed(2);
  GameCanvas.dataset.planningFocusCount = String(FocusPoints.length);
}

/** Jumps to the sector aim frame so landed pan/zoom cannot hide the path in fog. */
function snapLiveCameraToPlanningView() {
  applySectorPlanningCamera();
  CameraLookTarget.copy(PlanningCameraLookTarget);
  DesiredCameraLookTarget.copy(PlanningCameraLookTarget);
  host.CameraDistanceScale = host.PlanningCameraScale * host.AimZoomScale;
  Camera.position.set(
    CameraLookTarget.x,
    CameraLookTarget.y,
    host.BaseCameraDistance * host.CameraDistanceScale,
  );
  Camera.lookAt(CameraLookTarget);
}

function shouldUseSectorPlanningCamera() {
  return (host.IsPointerAiming || host.IsKeyboardAiming)
    && !host.IsScoutMode
    && host.GamePhase !== 'restoring'
    && host.GamePhase !== 'recovering'
    && host.GamePhase !== 'flying';
}

function updateFlightPlanningPresentation() {
  const LiveRelayCount = countLiveRelayWorlds(host.RelayNetworkState);
  if (shouldHoldCommittedPrediction({
    liveRelayCount: LiveRelayCount,
    flightElapsedSeconds: host.FlightElapsedSeconds,
    prefersReducedMotion: host.PrefersReducedMotion,
    committedPointCount: host.CommittedPredictionPoints?.length ?? 0,
  })) {
    renderTrajectoryLine(host.CommittedPredictionPoints);
    TrajectoryMaterial.color.set(0xffd98a);
    TrajectoryMaterial.opacity = 0.86;
    applySectorPlanningCamera();
    GameCanvas.dataset.predictionHoldActive = 'true';
    return;
  }
  GameCanvas.dataset.predictionHoldActive = 'false';
  const TrajectoryPrediction = predictCurrentLaunchTrajectory(host.SeedPhysicsState.velocity, {
    ignoredWorldIdentifier: host.LaunchIgnoredWorldIdentifier,
    ignoredCollisionBodyIdentifier: host.LaunchIgnoredBodyIdentifier,
  });
  rememberPlanningPath(TrajectoryPrediction);
  if (TrajectoryPrediction.points.length > 1) {
    renderTrajectoryLine(TrajectoryPrediction.points);
  }
  applySectorPlanningCamera();
}

function refreshPlanningZoomControls({ announce = false } = {}) {
  const Visible = host.IsScoutMode || shouldUseSectorPlanningCamera();
  ScoutZoomOutButtonElement.hidden = !Visible;
  ScoutZoomInButtonElement.hidden = !Visible;
  if (!Visible) {
    if (!host.IsScoutMode) ScoutZoomStatusElement.textContent = '';
    return;
  }
  const Scale = shouldUseSectorPlanningCamera() && !host.IsScoutMode
    ? host.AimZoomScale
    : (host.IsScoutMode ? host.ScoutZoomScale : host.CameraZoomScale);
  const Presentation = getScoutZoomPresentation(Scale, {
    minimumScale: MinimumScoutZoomScale,
    maximumScale: getActiveMaximumScoutZoomScale(),
  });
  ScoutZoomInButtonElement.setAttribute('aria-disabled', String(!Presentation.canZoomIn));
  ScoutZoomOutButtonElement.setAttribute('aria-disabled', String(!Presentation.canZoomOut));
  ScoutZoomInButtonElement.setAttribute('aria-label', Presentation.zoomInLabel);
  ScoutZoomOutButtonElement.setAttribute('aria-label', Presentation.zoomOutLabel);
  if (announce) ScoutZoomStatusElement.textContent = Presentation.status;
}

function updateScoutZoomInterface({ announce = false } = {}) {
  refreshPlanningZoomControls({ announce });
}

function setScoutMode(Enabled, { snapToRunner = true } = {}) {
  const CanScout = ActiveSystem.camera?.followPlayer === true
    && host.GamePhase === 'attached'
    && host.ReplayPlaybackState === null;
  const WasScoutMode = host.IsScoutMode;
  host.IsScoutMode = Enabled && CanScout;
  if (host.IsScoutMode) {
    ScoutCameraTarget.copy(CameraLookTarget);
  } else if (snapToRunner) {
    ScoutCameraTarget.set(host.SeedPhysicsState.position.x, host.SeedPhysicsState.position.y, 0);
    CameraPanOffset.set(0, 0, 0);
  }
  const ShouldRestoreScoutButtonFocus = !host.IsScoutMode
    && (
      host.getActiveElement() === ScoutZoomOutButtonElement
      || host.getActiveElement() === ScoutZoomInButtonElement
    );
  ScoutButtonElement.textContent = host.IsScoutMode ? 'Runner [C]' : 'Scout [C]';
  ScoutButtonElement.setAttribute('aria-pressed', String(host.IsScoutMode));
  if (!host.IsScoutMode) {
    ScoutZoomStatusElement.textContent = WasScoutMode ? 'Scout view off' : '';
  }
  refreshPlanningZoomControls({ announce: host.IsScoutMode });
  GameCanvas.dataset.scoutMode = String(host.IsScoutMode);
  GameCanvas.dataset.scoutZoom = host.ScoutZoomScale.toFixed(2);
  GameCanvas.classList.toggle('is-scouting', host.IsScoutMode && host.IsPointerScouting);
  if (ShouldRestoreScoutButtonFocus) ScoutButtonElement.focus({ preventScroll: true });
  updatePersonalBestGhostVisibility();
  resizeRenderer();
}

function adjustScoutZoom(Direction) {
  return adjustViewZoom(Direction);
}

function adjustViewZoom(Direction) {
  const MaximumScale = getActiveMaximumScoutZoomScale();
  if (shouldUseSectorPlanningCamera()) {
    const PreviousScale = host.AimZoomScale;
    host.AimZoomScale = THREE.MathUtils.clamp(
      host.AimZoomScale + (Math.sign(Direction) * 0.1),
      MinimumScoutZoomScale,
      MaximumScale,
    );
    const DidChange = host.AimZoomScale !== PreviousScale;
    if (DidChange) {
      refreshPlanningZoomControls({ announce: true });
      GameCanvas.dataset.aimZoom = host.AimZoomScale.toFixed(2);
    }
    return DidChange;
  }
  const PreviousScale = host.CameraZoomScale;
  host.CameraZoomScale = THREE.MathUtils.clamp(
    host.CameraZoomScale + (Math.sign(Direction) * 0.1),
    MinimumScoutZoomScale,
    MaximumScale,
  );
  host.ScoutZoomScale = host.CameraZoomScale;
  const DidChange = host.CameraZoomScale !== PreviousScale;
  if (host.IsScoutMode) updateScoutZoomInterface({ announce: DidChange });
  if (!DidChange) return false;
  GameCanvas.dataset.scoutZoom = host.CameraZoomScale.toFixed(2);
  resizeRenderer();
  return true;
}

function handleScoutWheel(WheelEventData) {
  if (host.IsOpeningBriefingActive || host.ReplayPlaybackState !== null) return;
  if (host.GamePhase === 'victory' || host.GamePhase === 'runFailed' || host.GamePhase === 'victoryPending') {
    return;
  }
  if (adjustViewZoom(WheelEventData.deltaY > 0 ? 1 : -1)) {
    WheelEventData.preventDefault();
  }
}

function resolveStoryLookPoint(Focus) {
  if (!Focus) {
    return null;
  }
  if (Focus.kind === 'runner') {
    return host.SeedPhysicsState.position;
  }
  if (Focus.kind === 'warden') {
    return host.getWardenLookPosition?.() ?? host.SeedPhysicsState.position;
  }
  if (Focus.kind === 'command') {
    return calculateBodyPositionAtTime(WorldheartDefinition, host.PhysicsElapsedTimeSeconds);
  }
  if (Focus.kind === 'neighbourhood') {
    const Planning = getSectorPlanningCamera({
      runner: host.SeedPhysicsState.position,
      focusPoints: getPlanningFocusPoints(),
      pathPoints: [],
      viewportWorldWidth: ActiveSystem.camera?.viewportWorldWidth ?? 20,
      viewportWorldHeight: ActiveSystem.camera?.viewportWorldHeight ?? 24,
    });
    return { x: Planning.lookX, y: Planning.lookY, scale: Planning.scale };
  }
  if (Focus.kind === 'world' && Focus.worldId) {
    if (Focus.worldId === WorldheartDefinition.id) {
      return calculateBodyPositionAtTime(WorldheartDefinition, host.PhysicsElapsedTimeSeconds);
    }
    const WorldDefinition = getWorldDefinition(Focus.worldId);
    return WorldDefinition?.position ?? host.SeedPhysicsState.position;
  }
  if (Focus.kind === 'named') {
    const NamedLabel = String(host.ActiveStoryBoardTokens?.world ?? '').trim().toUpperCase();
    const NamedWorld = WorldDefinitions.find((WorldDefinition) => (
      WorldDefinition.label.toUpperCase() === NamedLabel
    ));
    return NamedWorld?.position ?? host.SeedPhysicsState.position;
  }
  return host.SeedPhysicsState.position;
}

function centerLandedCamera({ snap = true } = {}) {
  host.IsScoutMode = false;
  CameraPanOffset.set(0, 0, 0);
  const Point = host.SeedPhysicsState.position;
  DesiredCameraLookTarget.set(Point.x, Point.y, 0);
  if (snap) {
    CameraLookTarget.copy(DesiredCameraLookTarget);
    Camera.position.x = Point.x;
    Camera.position.y = Point.y;
  }
  GameCanvas.dataset.scoutMode = 'false';
  GameCanvas.classList.remove('is-scouting');
  refreshPlanningZoomControls();
}

/**
 * Adds gentle camera follow while the seed is flying without losing the level overview.
 * This is intentionally restrained for motion comfort on phones.
 *
 * @param {number} DeltaTimeSeconds - Real frame delta.
 */
function updateCamera(DeltaTimeSeconds) {
  const UsesExplorationCamera = ActiveSystem.camera?.followPlayer === true;
  const UsesPlanningCamera = UsesExplorationCamera && shouldUseSectorPlanningCamera();
  const StoryFocus = host.IsOpeningBriefingActive ? host.StoryLookFocus : null;
  const StoryLookPoint = StoryFocus ? resolveStoryLookPoint(StoryFocus) : null;
  if (
    host.GamePhase !== 'victory'
    && host.GamePhase !== 'victoryPending'
    && Scene.fog
  ) {
    const PlanningAtmosphere = getPlanningAtmosphere({
      isPlanning: UsesPlanningCamera,
      fogDensity: ActiveSystem.environment.fogDensity,
      toneMappingExposure: ActiveSystem.environment.toneMappingExposure,
    });
    Scene.fog.density = PlanningAtmosphere.fogDensity;
    Renderer.toneMappingExposure = PlanningAtmosphere.toneMappingExposure;
  }
  if (UsesExplorationCamera && StoryLookPoint) {
    DesiredCameraLookTarget.set(StoryLookPoint.x, StoryLookPoint.y, 0);
  } else if (UsesExplorationCamera && host.IsScoutMode) {
    DesiredCameraLookTarget.copy(ScoutCameraTarget);
  } else if (UsesExplorationCamera && host.RelayRevealLookTarget && !host.PrefersReducedMotion) {
    DesiredCameraLookTarget.set(host.RelayRevealLookTarget.x, host.RelayRevealLookTarget.y, 0);
  } else if (UsesPlanningCamera) {
    DesiredCameraLookTarget.copy(PlanningCameraLookTarget).add(CameraPanOffset);
  } else if (UsesExplorationCamera) {
    DesiredCameraLookTarget.set(
      host.SeedPhysicsState.position.x + CameraPanOffset.x,
      host.SeedPhysicsState.position.y + CameraPanOffset.y,
      0,
    );
  } else if (host.GamePhase === 'flying' && !host.PrefersReducedMotion) {
    DesiredCameraLookTarget.set(
      THREE.MathUtils.clamp(host.SeedPhysicsState.position.x * 0.12, -1.8, 1.8),
      THREE.MathUtils.clamp(host.SeedPhysicsState.position.y * 0.12, -1.5, 1.5),
      0,
    );
  } else {
    DesiredCameraLookTarget.set(0, 0, 0);
  }

  const CameraFollowAlpha = host.PrefersReducedMotion
    ? 1
    : 1 - Math.exp(-DeltaTimeSeconds * (
      host.GamePhase === 'flying' || StoryLookPoint
        ? 5.2
        : (UsesExplorationCamera ? 3.8 : 2.6)
    ));
  CameraLookTarget.lerp(DesiredCameraLookTarget, CameraFollowAlpha);

  let DesiredDistanceScale = 1;
  if (StoryLookPoint) {
    DesiredDistanceScale = StoryLookPoint.scale ?? StoryFocus?.scale ?? 0.7;
  } else if (host.IsScoutMode) {
    DesiredDistanceScale = host.ScoutZoomScale;
  } else if (UsesPlanningCamera) {
    DesiredDistanceScale = host.PlanningCameraScale * host.AimZoomScale;
  } else if (UsesExplorationCamera && host.GamePhase === 'flying') {
    const FlightWorld = getWorldDefinition(host.CurrentWorldIdentifier);
    DesiredDistanceScale = getFlightCameraScale({
      worldRadius: FlightWorld?.radius ?? 3,
      viewportWorldHeight: ActiveSystem.camera?.viewportWorldHeight ?? 24,
    });
  } else if (
    UsesExplorationCamera
    && (host.GamePhase === 'attached' || host.GamePhase === 'restoring')
  ) {
    const LandedWorld = getWorldDefinition(host.CurrentWorldIdentifier);
    DesiredDistanceScale = LandedWorld
      ? getLandedCameraScale({
        worldRadius: LandedWorld.radius,
        viewportWorldHeight: ActiveSystem.camera?.viewportWorldHeight ?? 24,
      })
      : 0.5;
    GameCanvas.dataset.landedCameraScale = DesiredDistanceScale.toFixed(2);
  }
  if (!host.IsScoutMode && !UsesPlanningCamera && !StoryLookPoint) {
    DesiredDistanceScale *= host.CameraZoomScale;
  }
  host.CameraDistanceScale += (DesiredDistanceScale - host.CameraDistanceScale) * CameraFollowAlpha;

  let CameraShakeX = 0;
  let CameraShakeY = 0;
  if (host.CameraImpactLifeSeconds > 0 && !host.PrefersReducedMotion) {
    host.CameraImpactLifeSeconds = Math.max(0, host.CameraImpactLifeSeconds - DeltaTimeSeconds);
    const ShakeStrength = (host.CameraImpactLifeSeconds / 0.24) * 0.13;
    CameraShakeX = Math.sin(host.GameElapsedTimeSeconds * 93) * ShakeStrength;
    CameraShakeY = Math.cos(host.GameElapsedTimeSeconds * 77) * ShakeStrength;
  } else {
    host.CameraImpactLifeSeconds = 0;
  }
  Camera.position.x = (UsesExplorationCamera ? CameraLookTarget.x : 0) + CameraShakeX;
  Camera.position.y = (UsesExplorationCamera ? CameraLookTarget.y : 0) + CameraShakeY;
  Camera.position.z = host.BaseCameraDistance * host.CameraDistanceScale;
  Camera.lookAt(CameraLookTarget);
  updateScannerInterface();
}

  return {
    captureAimInteractionCamera,
    releaseAimInteractionCamera,
    rememberPlanningPath,
    getPlanningFocusPoints,
    applySectorPlanningCamera,
    snapLiveCameraToPlanningView,
    shouldUseSectorPlanningCamera,
    updateFlightPlanningPresentation,
    refreshPlanningZoomControls,
    updateScoutZoomInterface,
    setScoutMode,
    adjustScoutZoom,
    adjustViewZoom,
    handleScoutWheel,
    updateCamera,
    centerLandedCamera,
  };
}
