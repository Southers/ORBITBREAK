/**
 * Planning camera, Scout zoom and live follow.
 * Trajectory line drawing stays in the playable shell next to player meshes.
 */

import { getScoutZoomPresentation } from './controls.js?v=20260819-ob140';
import { countLiveRelayWorlds, listRelayCircuits } from './network.js?v=20260819-ob140';
import {
  getActiveViewZoomMinimumScale,
  getLandedCameraScale,
  getLandedSurfaceCameraPose,
  getFlightFollowFrame,
  getPlanningAtmosphere,
  getPlanningFocusWorldIdentifiers,
  getSectorPlanningCamera,
  shouldHoldCommittedPrediction,
} from './presentation.js?v=20260819-ob140';

/** How quickly the camera height eases between landed, Scout and flight. */
const CameraRigStiffness = 4.2;
/** World +Z is the only camera up. Never blend through a surface-normal facing up. */
const WorldCameraUp = Object.freeze({ x: 0, y: 0, z: 1 });
/** How quickly fog density and exposure ease when entering or leaving the aim frame. */
const AtmosphereBlendStiffness = 5;
/** Peak positional amplitude of the landing impact shake. */
const CameraShakeAmplitude = 0.055;
/** Scout pullback is a camera move, not a HUD widget. */
const ScoutPullbackScale = 1.62;

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
  let ScoutReturnZoomScale = 1;

  /**
   * Continuously blended camera height. Look target eases, but Camera.up stays
   * world +Z in every mode so landed, Scout, aim and flight cannot flip the
   * horizon. Only run resets and reduced motion write the rig directly.
   */
  const CameraRigOffset = new THREE.Vector3(0, 0, 1);
  const DesiredCameraOffset = new THREE.Vector3();
  let IsCameraRigInitialized = false;

  function applyWorldCameraUp() {
    Camera.up.set(WorldCameraUp.x, WorldCameraUp.y, WorldCameraUp.z);
  }

  function snapCameraRigToCurrentCamera() {
    CameraRigOffset.set(
      Camera.position.x - CameraLookTarget.x,
      Camera.position.y - CameraLookTarget.y,
      Camera.position.z - CameraLookTarget.z,
    );
    applyWorldCameraUp();
    IsCameraRigInitialized = true;
  }

  function getLandedCameraWorld() {
    if (host.CurrentWorldIdentifier === WorldheartDefinition.id) {
      return WorldheartDefinition;
    }
    if (host.SeedstoneDefinition && host.CurrentWorldIdentifier === host.SeedstoneDefinition.id) {
      return host.SeedstoneDefinition;
    }
    return getWorldDefinition(host.CurrentWorldIdentifier);
  }

  function getFlightFramingTargetPoint(ShipX, ShipY) {
    const PredictedId = host.LastPredictedBodyIdentifier;
    if (PredictedId === WorldheartDefinition.id) {
      const CommandPosition = calculateBodyPositionAtTime(
        WorldheartDefinition,
        host.PhysicsElapsedTimeSeconds,
      );
      return { x: CommandPosition.x, y: CommandPosition.y };
    }
    if (PredictedId) {
      const PredictedWorld = getWorldDefinition(PredictedId);
      if (PredictedWorld) {
        return { x: PredictedWorld.position.x, y: PredictedWorld.position.y };
      }
    }
    let NearestWorld = null;
    let NearestDistance = Infinity;
    for (const WorldDefinition of WorldDefinitions) {
      if (WorldDefinition.id === host.CurrentWorldIdentifier) {
        continue;
      }
      const Distance = Math.hypot(
        WorldDefinition.position.x - ShipX,
        WorldDefinition.position.y - ShipY,
      );
      if (Distance < NearestDistance) {
        NearestDistance = Distance;
        NearestWorld = WorldDefinition;
      }
    }
    if (NearestWorld && NearestDistance > (NearestWorld.radius * 1.25)) {
      return { x: NearestWorld.position.x, y: NearestWorld.position.y };
    }
    return null;
  }

  function getLiveFlightFollowFrame() {
    const ShipX = host.SeedPhysicsState.position.x;
    const ShipY = host.SeedPhysicsState.position.y;
    const Velocity = host.SeedPhysicsState.velocity ?? { x: 0, y: 0 };
    const TargetPoint = getFlightFramingTargetPoint(ShipX, ShipY);
    const FlightWorld = getWorldDefinition(host.CurrentWorldIdentifier);
    return getFlightFollowFrame({
      shipX: ShipX,
      shipY: ShipY,
      velocityX: Velocity.x,
      velocityY: Velocity.y,
      targetX: TargetPoint?.x,
      targetY: TargetPoint?.y,
      worldRadius: FlightWorld?.radius ?? 3,
      viewportWorldHeight: ActiveSystem.camera?.viewportWorldHeight ?? 24,
    });
  }

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
    hasTravelledFurther: typeof host.isLiveFurtherReach === 'function'
      ? host.isLiveFurtherReach()
      : false,
    predictedBodyIdentifiers: [
      host.LastPredictedBodyIdentifier,
      ...PredictedSlingshotWorldIdentifiers,
    ],
    currentWorldIdentifier: CurrentWorldIdentifier,
    nearbyWorldIdentifiers: NearbyWorldIdentifiers,
    sectorWorldIdentifiers: isLiveInnerCluster()
      ? WorldDefinitions.map((WorldDefinition) => WorldDefinition.id)
      : [],
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
    viewportWorldWidth: ActiveSystem.camera?.viewportWorldWidth ?? 20,
    viewportWorldHeight: ActiveSystem.camera?.viewportWorldHeight ?? 24,
  });
  PlanningCameraLookTarget.set(PlanningCamera.lookX, PlanningCamera.lookY, 0);
  host.PlanningCameraScale = PlanningCamera.scale;
  GameCanvas.dataset.planningCameraScale = PlanningCamera.scale.toFixed(2);
  GameCanvas.dataset.planningFocusCount = String(FocusPoints.length);
}

/** Jumps to the sector aim frame; reserved for reduced motion and hard resets. */
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
  applyWorldCameraUp();
  Camera.lookAt(CameraLookTarget);
  snapCameraRigToCurrentCamera();
}

function shouldUseSectorPlanningCamera() {
  return (host.IsKeyboardAiming || (host.IsPointerAiming && host.HasCommittedAimCamera))
    && !host.IsScoutMode
    && host.GamePhase !== 'restoring'
    && host.GamePhase !== 'recovering'
    && host.GamePhase !== 'flying';
}

/** Commits to the neighbourhood map once per gesture and keeps it if the pull returns. */
function commitAimPlanningCamera() {
  if (host.HasCommittedAimCamera && GameCanvas.dataset.aimCamera === 'planning') {
    return;
  }
  host.HasCommittedAimCamera = true;
  GameCanvas.dataset.aimCamera = 'planning';
  if (host.PrefersReducedMotion) {
    snapLiveCameraToPlanningView();
  } else {
    applySectorPlanningCamera();
  }
  refreshPlanningZoomControls();
}

function clearCommittedAimCamera() {
  host.HasCommittedAimCamera = false;
  GameCanvas.dataset.aimCamera = '';
}

/** Snaps the parked globe back after aim cancel so Grove cannot stay a sector map. */
function restoreLandedViewAfterAim({ snap = true } = {}) {
  clearCommittedAimCamera();
  releaseAimInteractionCamera();
  if (host.IsScoutMode) {
    refreshPlanningZoomControls();
    return;
  }
  if (host.GamePhase !== 'attached' && host.GamePhase !== 'restoring') {
    refreshPlanningZoomControls();
    return;
  }
  const LandedWorld = getLandedCameraWorld();
  if (LandedWorld) {
    const LandedScale = getLandedCameraScale({
      worldRadius: LandedWorld.radius,
      viewportWorldHeight: ActiveSystem.camera?.viewportWorldHeight ?? 24,
    });
    host.CameraDistanceScale = LandedScale * (Number(host.CameraZoomScale) > 0
      ? host.CameraZoomScale
      : 1);
  }
  centerLandedCamera({ snap });
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
  const Visible = host.IsPauseSheetOpen === true
    || host.IsScoutMode
    || shouldUseSectorPlanningCamera()
    || (
      ActiveSystem.camera?.followPlayer === true
      && host.ReplayPlaybackState === null
      && (
        host.GamePhase === 'attached'
        || host.GamePhase === 'restoring'
        || host.GamePhase === 'flying'
      )
    );
  ScoutZoomOutButtonElement.hidden = !Visible;
  ScoutZoomInButtonElement.hidden = !Visible;
  if (!Visible) {
    if (!host.IsScoutMode) ScoutZoomStatusElement.textContent = '';
    return;
  }
  const UsingPlanning = shouldUseSectorPlanningCamera() && !host.IsScoutMode;
  const Scale = UsingPlanning
    ? host.AimZoomScale
    : (host.IsScoutMode ? host.ScoutZoomScale : host.CameraZoomScale);
  const Presentation = getScoutZoomPresentation(Scale, {
    minimumScale: getActiveViewZoomMinimumScale({
      isScoutMode: host.IsScoutMode === true,
      isPlanningCamera: UsingPlanning,
    }),
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
  const EnteringScout = host.IsScoutMode && !WasScoutMode;
  const LeavingScout = !host.IsScoutMode && WasScoutMode;
  if (EnteringScout) {
    ScoutReturnZoomScale = host.CameraZoomScale;
    const MaximumScale = getActiveMaximumScoutZoomScale();
    host.ScoutZoomScale = Math.min(
      MaximumScale,
      Math.max(host.ScoutZoomScale, ScoutPullbackScale),
    );
  } else if (LeavingScout && snapToRunner) {
    host.CameraZoomScale = ScoutReturnZoomScale;
    host.ScoutZoomScale = ScoutReturnZoomScale;
  }
  const ShouldRestoreScoutButtonFocus = !host.IsScoutMode
    && (
      host.getActiveElement() === ScoutZoomOutButtonElement
      || host.getActiveElement() === ScoutZoomInButtonElement
    );
  ScoutButtonElement.textContent = host.IsScoutMode ? 'Runner [C]' : 'Scout map [C]';
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
  const UsingPlanning = shouldUseSectorPlanningCamera() && !host.IsScoutMode;
  const MinimumScale = getActiveViewZoomMinimumScale({
    isScoutMode: host.IsScoutMode === true,
    isPlanningCamera: UsingPlanning,
  });
  const Step = Math.sign(Direction) * 0.1;
  if (UsingPlanning) {
    const PreviousScale = host.AimZoomScale;
    host.AimZoomScale = THREE.MathUtils.clamp(
      host.AimZoomScale + Step,
      MinimumScale,
      MaximumScale,
    );
    const DidChange = host.AimZoomScale !== PreviousScale;
    refreshPlanningZoomControls({ announce: true });
    if (DidChange) {
      GameCanvas.dataset.aimZoom = host.AimZoomScale.toFixed(2);
    }
    return DidChange;
  }
  if (host.IsScoutMode) {
    const PreviousScale = host.ScoutZoomScale;
    host.ScoutZoomScale = THREE.MathUtils.clamp(
      host.ScoutZoomScale + Step,
      MinimumScale,
      MaximumScale,
    );
    const DidChange = host.ScoutZoomScale !== PreviousScale;
    refreshPlanningZoomControls({ announce: true });
    if (!DidChange) return false;
    GameCanvas.dataset.scoutZoom = host.ScoutZoomScale.toFixed(2);
    resizeRenderer();
    return true;
  }
  const PreviousScale = host.CameraZoomScale;
  host.CameraZoomScale = THREE.MathUtils.clamp(
    host.CameraZoomScale + Step,
    MinimumScale,
    MaximumScale,
  );
  const DidChange = host.CameraZoomScale !== PreviousScale;
  refreshPlanningZoomControls({ announce: DidChange });
  if (!DidChange) return false;
  GameCanvas.dataset.scoutZoom = host.CameraZoomScale.toFixed(2);
  resizeRenderer();
  return true;
}

function handleScoutWheel(WheelEventData) {
  if (host.IsOpeningBriefingActive || host.IsHowToPlayOpen || host.ReplayPlaybackState !== null) return;
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
  const LandedWorld = getLandedCameraWorld();
  if (LandedWorld) {
    const LandedPose = getLandedSurfaceCameraPose({
      worldX: LandedWorld.position.x,
      worldY: LandedWorld.position.y,
      worldZ: LandedWorld.position.z ?? 0,
      worldRadius: LandedWorld.radius,
      runnerX: Point.x,
      runnerY: Point.y,
      runnerZ: Point.z ?? 0,
      cameraScale: host.CameraDistanceScale || 0.5,
      baseCameraDistance: host.BaseCameraDistance,
      reducedMotion: host.PrefersReducedMotion,
    });
    DesiredCameraLookTarget.set(LandedPose.lookAtX, LandedPose.lookAtY, LandedPose.lookAtZ);
    if (snap) {
      CameraLookTarget.copy(DesiredCameraLookTarget);
      Camera.position.set(LandedPose.cameraX, LandedPose.cameraY, LandedPose.cameraZ);
      applyWorldCameraUp();
      Camera.lookAt(CameraLookTarget);
      snapCameraRigToCurrentCamera();
    }
  } else {
    DesiredCameraLookTarget.set(Point.x, Point.y, 0);
    if (snap) {
      CameraLookTarget.copy(DesiredCameraLookTarget);
      Camera.position.x = Point.x;
      Camera.position.y = Point.y;
      applyWorldCameraUp();
      snapCameraRigToCurrentCamera();
    }
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
  // The relay reveal pan waits until the liberation wave has finished so the
  // landing settles on the Runner first, then eases out to show the new link.
  const RevealPanActive = Boolean(host.RelayRevealLookTarget)
    && host.GamePhase !== 'restoring'
    && !host.PrefersReducedMotion;
  const AtmosphereBlendAlpha = host.PrefersReducedMotion
    ? 1
    : 1 - Math.exp(-DeltaTimeSeconds * AtmosphereBlendStiffness);
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
    Scene.fog.density += (PlanningAtmosphere.fogDensity - Scene.fog.density)
      * AtmosphereBlendAlpha;
    Renderer.toneMappingExposure += (
      PlanningAtmosphere.toneMappingExposure - Renderer.toneMappingExposure
    ) * AtmosphereBlendAlpha;
  }
  if (UsesExplorationCamera && StoryLookPoint) {
    DesiredCameraLookTarget.set(StoryLookPoint.x, StoryLookPoint.y, 0);
  } else if (UsesExplorationCamera && host.IsScoutMode) {
    DesiredCameraLookTarget.copy(ScoutCameraTarget);
  } else if (UsesExplorationCamera && RevealPanActive) {
    DesiredCameraLookTarget.set(host.RelayRevealLookTarget.x, host.RelayRevealLookTarget.y, 0);
  } else if (UsesPlanningCamera) {
    DesiredCameraLookTarget.copy(PlanningCameraLookTarget).add(CameraPanOffset);
  } else if (
    UsesExplorationCamera
    && (host.GamePhase === 'attached' || host.GamePhase === 'restoring')
  ) {
    const LandedWorld = getLandedCameraWorld();
    if (LandedWorld) {
      const LandedLookPose = getLandedSurfaceCameraPose({
        worldX: LandedWorld.position.x,
        worldY: LandedWorld.position.y,
        worldZ: LandedWorld.position.z ?? 0,
        worldRadius: LandedWorld.radius,
        runnerX: host.SeedPhysicsState.position.x,
        runnerY: host.SeedPhysicsState.position.y,
        runnerZ: host.SeedPhysicsState.position.z ?? 0,
        cameraScale: host.CameraDistanceScale,
        baseCameraDistance: host.BaseCameraDistance,
        reducedMotion: host.PrefersReducedMotion,
      });
      DesiredCameraLookTarget.set(
        LandedLookPose.lookAtX + CameraPanOffset.x,
        LandedLookPose.lookAtY + CameraPanOffset.y,
        LandedLookPose.lookAtZ,
      );
    } else {
      DesiredCameraLookTarget.set(
        host.SeedPhysicsState.position.x + CameraPanOffset.x,
        host.SeedPhysicsState.position.y + CameraPanOffset.y,
        0,
      );
    }
  } else if (UsesExplorationCamera && host.GamePhase === 'flying') {
    const FlightFrame = getLiveFlightFollowFrame();
    DesiredCameraLookTarget.set(
      FlightFrame.lookX + CameraPanOffset.x,
      FlightFrame.lookY + CameraPanOffset.y,
      FlightFrame.lookZ,
    );
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
      host.GamePhase === 'flying' || StoryLookPoint || host.IsScoutMode
        ? 8.6
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
    DesiredDistanceScale = getLiveFlightFollowFrame().scale;
  } else if (
    UsesExplorationCamera
    && (host.GamePhase === 'attached' || host.GamePhase === 'restoring')
  ) {
    const LandedWorld = getLandedCameraWorld();
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
    const ShakeStrength = (host.CameraImpactLifeSeconds / 0.24) * CameraShakeAmplitude;
    CameraShakeX = Math.sin(host.GameElapsedTimeSeconds * 93) * ShakeStrength;
    CameraShakeY = Math.cos(host.GameElapsedTimeSeconds * 77) * ShakeStrength;
  } else {
    host.CameraImpactLifeSeconds = 0;
  }
  DesiredCameraOffset.set(
    UsesExplorationCamera ? 0 : -CameraLookTarget.x,
    UsesExplorationCamera ? 0 : -CameraLookTarget.y,
    (host.BaseCameraDistance * host.CameraDistanceScale) - CameraLookTarget.z,
  );
  const RigBlendAlpha = host.PrefersReducedMotion
    ? 1
    : 1 - Math.exp(-DeltaTimeSeconds * CameraRigStiffness);
  if (!IsCameraRigInitialized) {
    CameraRigOffset.copy(DesiredCameraOffset);
    IsCameraRigInitialized = true;
  } else {
    CameraRigOffset.lerp(DesiredCameraOffset, RigBlendAlpha);
  }
  Camera.position.set(
    CameraLookTarget.x + CameraRigOffset.x + CameraShakeX,
    CameraLookTarget.y + CameraRigOffset.y + CameraShakeY,
    CameraLookTarget.z + CameraRigOffset.z,
  );
  applyWorldCameraUp();
  GameCanvas.dataset.landedFacingCamera = 'false';
  GameCanvas.dataset.cameraUp = 'world-z';
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
    commitAimPlanningCamera,
    clearCommittedAimCamera,
    restoreLandedViewAfterAim,
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
