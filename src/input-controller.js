/**
 * Pointer, keyboard, pinch, cut and Breaker Burn input.
 * Aim preview stays on the fixed physics step; this module only captures gestures.
 */

import {
  SurfaceGestureModes,
  LandedPointerTargets,
  adjustKeyboardAimState,
  classifyPendingShipGrab,
  classifyLandedPointerStart,
  createKeyboardAimState,
  findNearestKeyboardAimAngle,
  getAimCameraStage,
  getKeyboardAimDragVector,
  getPinchZoomScale,
  getPointerClientDistance,
  getSurfacePoseFromDirection,
  getSurfacePoseFromPosition,
  getSurfaceWalkArcLimit,
  getSurfaceWalkPointerArcLimit,
  hasLeftSurfaceWalkDeadzone,
  intersectRaySphere,
  projectRayOntoSphere,
  SeedScreenGrabRadiusPixels,
  getLandedShipGrabRadiusPixels,
  getLandedCageGrabRadiusPixels,
  shouldCancelAimedLaunch,
  stepSurfacePoseToward,
  SurfaceWalkTapRadians,
} from './controls.js?v=20260819-ob126';
import {
  getNearestRemainingClamp,
  getRemainingClamps,
  resolveClampTap,
  resolveHostileCut,
} from './encounter.js?v=20260819-ob126';
import { applyBreakerBurn, createOrbitTrapState, createVector, getBreakerBurnDirection, predictTrajectory } from './physics.js';
import {
  getCageClearPulseDurationSeconds,
  getActiveViewZoomMinimumScale,
  getLaunchFacingPresentation,
  getLogicalSurfaceDirectionFromWorldHit,
  shouldAssistCommandLock,
} from './presentation.js';
import { recordReplayBurn, recordReplayLaunch } from './replay.js';
import { releaseRunLaunch } from './run.js';

export function createInputController(THREE, host) {
  const {
    GameCanvas,
    Camera,
    PointerRaycaster,
    PointerNormalizedDeviceCoordinates,
    OrbitalPlane,
    PointerWorldPosition,
    PointerByIdentifier,
    SeedGroup,
    SeedPointerHitMesh,
    LaunchPulseMesh,
    PullGuideLine,
    CameraPanOffset,
    PanOffsetStart,
    ScoutPointerStartWorldPosition,
    ScoutCameraStartTarget,
    ScoutCameraTarget,
    LastAimPointerWorldPosition,
    PointerGestureStartWorldPosition,
    AimDragVector,
    AimLaunchVelocity,
    WorldseedSound,
    MaximumDragDistance,
    LaunchVelocityPerDragUnit,
    MinimumLaunchDragDistance,
    LaunchCancelRadius,
    FixedPhysicsStepHertz,
    FixedPhysicsStepSeconds,
    MaximumTrajectoryPredictionSteps,
    SeedRadius,
    WorldDefinitions,
    SeedstoneDefinition,
    WorldheartDefinition,
    FlightCollectedStardustIdentifiers,
    FlightClosePassWorldIdentifiers,
    HostilePylonGroup,
    CompletedHostileEncounterWorldIdentifiers,
    WorldRuntimeByIdentifier,
    shouldUseSectorPlanningCamera,
    getActiveMaximumScoutZoomScale,
    refreshPlanningZoomControls,
    resizeRenderer,
    setScoutMode,
    getCurrentAttachedWorld,
    setRunnerSurfaceAngle,
    setRunnerSurfacePose,
    flattenRunnerToEquator,
    moveRunnerOnSurface,
    showInstruction,
    showStatusToast,
    hideInstruction,
    showHostileEncounterInstruction,
    showRouteChoiceInstruction,
    getCurrentCutPreview,
    hideCutGuide,
    publishHostileEncounterState,
    getShipCutOrigin,
    getRunnerSurfaceAngle,
    getRunnerSurfacePose,
    completeWorldheartLiberation,
    flushQueuedStoryBoardsIfReady,
    updateFuelLights,
    captureCommittedLaunchPrediction,
    captureAimInteractionCamera,
    releaseAimInteractionCamera,
    applySectorPlanningCamera,
    commitAimPlanningCamera,
    clearCommittedAimCamera,
    clearTrajectoryPreview,
    updateAimPreview,
    updateKeyboardAimPreview,
    getCurrentRouteChoices,
    predictCurrentLaunchTrajectory,
    getActiveTacticalBodyDefinitions,
    renderTrajectoryLine,
    getCurrentCutHitIds,
  } = host;

  const PointerFallbackPlane = new THREE.Plane();
  const PointerFallbackNormal = new THREE.Vector3();
  const PointerFallbackPoint = new THREE.Vector3();
  let LastSurfaceWalkAtSeconds = 0;
  let SurfaceWalkDragAgeSeconds = 0;
  let SurfaceWalkPressPose = null;
  let SurfaceWalkHasLeftDeadzone = false;
  const HeldWalkKeys = new Set();
  let HeldWalkFine = false;
  let HeldWalkFrameHandle = 0;

/**
 * Converts pointer coordinates into world space. Planning and flight still hit
 * the orbital plane; landed globe walking can hit the sphere when the camera
 * sits beside the world.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 * @returns {THREE.Vector3|null} Intersection position or null if the ray misses.
 */
function getPointerWorldPosition(PointerEventData, UnprojectCamera = Camera) {
  const CanvasBounds = GameCanvas.getBoundingClientRect();
  PointerNormalizedDeviceCoordinates.x = (
    ((PointerEventData.clientX - CanvasBounds.left) / CanvasBounds.width) * 2
  ) - 1;
  PointerNormalizedDeviceCoordinates.y = -(
    ((PointerEventData.clientY - CanvasBounds.top) / CanvasBounds.height) * 2
  ) + 1;

  PointerRaycaster.setFromCamera(PointerNormalizedDeviceCoordinates, UnprojectCamera);
  const ForceOrbitalPlane = host.IsPointerAiming || host.IsKeyboardAiming;
  const RayDirectionZ = PointerRaycaster.ray.direction.z;
  if (ForceOrbitalPlane || Math.abs(RayDirectionZ) > 0.12) {
    const PlaneHit = PointerRaycaster.ray.intersectPlane(OrbitalPlane, PointerWorldPosition);
    if (
      PlaneHit
      && PointerWorldPosition.distanceTo(PointerRaycaster.ray.origin) > 0.5
    ) {
      PointerWorldPosition.z = 0;
      return PointerWorldPosition;
    }
  }
  if (!ForceOrbitalPlane) {
    const AttachedWorld = getCurrentAttachedWorld();
    if (AttachedWorld) {
      const GlobeHit = intersectRaySphere(
        PointerRaycaster.ray.origin,
        PointerRaycaster.ray.direction,
        AttachedWorld.position,
        AttachedWorld.radius + 0.45,
      );
      if (GlobeHit) {
        PointerWorldPosition.set(GlobeHit.x, GlobeHit.y, GlobeHit.z);
        return PointerWorldPosition;
      }
    }
  }
  PointerFallbackNormal.copy(UnprojectCamera.getWorldDirection(PointerFallbackNormal));
  PointerFallbackPoint.copy(UnprojectCamera.position).addScaledVector(PointerFallbackNormal, 12);
  PointerFallbackPlane.setFromNormalAndCoplanarPoint(PointerFallbackNormal, PointerFallbackPoint);
  const FacingHit = PointerRaycaster.ray.intersectPlane(PointerFallbackPlane, PointerWorldPosition);
  if (FacingHit && ForceOrbitalPlane) {
    PointerWorldPosition.z = 0;
  }
  return FacingHit ? PointerWorldPosition : null;
}

/**
 * Returns true when the supplied pointer begins close enough to the visible seed.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 * @returns {boolean} Whether the user acquired the seed.
 */
const SeedScreenProjection = new THREE.Vector3();
const WorldScreenCenter = new THREE.Vector3();
const WorldScreenLimb = new THREE.Vector3();
const CageWorldPosition = new THREE.Vector3();
const CageScreenProjection = new THREE.Vector3();

function isPointerOverShipMesh() {
  return PointerRaycaster.intersectObject(SeedPointerHitMesh, false).length > 0;
}

function getAttachedWorldScreenRadiusPixels() {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld) {
    return Number.POSITIVE_INFINITY;
  }
  const CanvasBounds = GameCanvas.getBoundingClientRect();
  WorldScreenCenter.set(
    AttachedWorld.position.x,
    AttachedWorld.position.y,
    AttachedWorld.position.z ?? 0,
  ).project(Camera);
  WorldScreenLimb.set(
    AttachedWorld.position.x + AttachedWorld.radius,
    AttachedWorld.position.y,
    AttachedWorld.position.z ?? 0,
  ).project(Camera);
  return Math.hypot(
    ((WorldScreenLimb.x - WorldScreenCenter.x) * 0.5) * CanvasBounds.width,
    ((WorldScreenLimb.y - WorldScreenCenter.y) * 0.5) * CanvasBounds.height,
  );
}

function getLandedPointerOccupancy(PointerEventData, WorldPosition = null) {
  const CanvasBounds = GameCanvas.getBoundingClientRect();
  PointerNormalizedDeviceCoordinates.x = (
    ((PointerEventData.clientX - CanvasBounds.left) / CanvasBounds.width) * 2
  ) - 1;
  PointerNormalizedDeviceCoordinates.y = -(
    ((PointerEventData.clientY - CanvasBounds.top) / CanvasBounds.height) * 2
  ) + 1;
  PointerRaycaster.setFromCamera(PointerNormalizedDeviceCoordinates, Camera);
  const OverShipMesh = isPointerOverShipMesh();
  const OverWorld = Boolean(
    getAttachedGlobeHit(true) || (WorldPosition && isPointerOverAttachedWorld(WorldPosition)),
  );
  const GrabRadiusPixels = getLandedShipGrabRadiusPixels({
    isOverWorld: OverWorld,
    worldScreenRadiusPixels: getAttachedWorldScreenRadiusPixels(),
  });
  const OverShip = OverShipMesh
    || getScreenDistanceToSeed(PointerEventData) <= GrabRadiusPixels;
  const CageClampId = pickCageClampId(PointerEventData);
  return {
    isOverShipMesh: OverShipMesh,
    isOverWorld: OverWorld,
    isOverShip: OverShip,
    isOverCage: CageClampId !== null,
    cageClampId: CageClampId,
  };
}

function pickCageClampId(PointerEventData) {
  if (!host.ActiveHostileEncounterState || host.GamePhase !== 'attached') {
    return null;
  }
  const RemainingClamps = getRemainingClamps(host.ActiveHostileEncounterState);
  if (RemainingClamps.length < 1 || !HostilePylonGroup?.visible) {
    return null;
  }
  const RayHits = PointerRaycaster.intersectObject(HostilePylonGroup, true);
  for (const Hit of RayHits) {
    let Node = Hit.object;
    while (Node && Node !== HostilePylonGroup) {
      if (Number.isInteger(Node.userData?.clampId)) {
        const Clamp = RemainingClamps.find((Entry) => Entry.id === Node.userData.clampId);
        if (Clamp) {
          return Clamp.id;
        }
      }
      Node = Node.parent;
    }
  }
  const CanvasBounds = GameCanvas.getBoundingClientRect();
  let BestId = null;
  let BestDistance = getLandedCageGrabRadiusPixels({
    worldScreenRadiusPixels: getAttachedWorldScreenRadiusPixels(),
  });
  for (const Clamp of RemainingClamps) {
    const ClampMesh = HostilePylonGroup.children[Clamp.id];
    if (!ClampMesh?.visible) {
      continue;
    }
    ClampMesh.getWorldPosition(CageWorldPosition);
    CageScreenProjection.copy(CageWorldPosition).project(Camera);
    if (CageScreenProjection.z > 1) {
      continue;
    }
    const ScreenX = CanvasBounds.left + (((CageScreenProjection.x + 1) / 2) * CanvasBounds.width);
    const ScreenY = CanvasBounds.top + (((1 - CageScreenProjection.y) / 2) * CanvasBounds.height);
    const Distance = Math.hypot(
      PointerEventData.clientX - ScreenX,
      PointerEventData.clientY - ScreenY,
    );
    if (Distance < BestDistance) {
      BestDistance = Distance;
      BestId = Clamp.id;
    }
  }
  return BestId;
}

let CageBreakClampId = null;
let CageBreakStartX = 0;
let CageBreakStartY = 0;

function clearCageBreak() {
  CageBreakClampId = null;
  host.IsCageBreaking = false;
  GameCanvas.classList.remove('is-cage-breaking');
}

function finishArmedCageTap() {
  const ClampId = CageBreakClampId;
  clearCageBreak();
  host.ActivePointerIdentifier = null;
  host.PointerGestureMode = SurfaceGestureModes.pending;
  if (Number.isInteger(ClampId) && host.ActiveHostileEncounterState) {
    applyClampTap(ClampId);
    return true;
  }
  return false;
}

function isPointerOverSeed(PointerEventData) {
  const Occupancy = getLandedPointerOccupancy(PointerEventData);
  if (host.GamePhase === 'attached') {
    return Occupancy.isOverShip;
  }
  return Occupancy.isOverShipMesh
    || getScreenDistanceToSeed(PointerEventData) <= SeedScreenGrabRadiusPixels;
}

function getScreenDistanceToSeed(PointerEventData) {
  const CanvasBounds = GameCanvas.getBoundingClientRect();
  SeedScreenProjection.copy(SeedGroup.position).project(Camera);
  const SeedScreenX = CanvasBounds.left + (((SeedScreenProjection.x + 1) / 2) * CanvasBounds.width);
  const SeedScreenY = CanvasBounds.top + (((1 - SeedScreenProjection.y) / 2) * CanvasBounds.height);
  return Math.hypot(
    PointerEventData.clientX - SeedScreenX,
    PointerEventData.clientY - SeedScreenY,
  );
}

function rememberAimScreenDistance(PointerEventData) {
  host.LastAimScreenDistancePixels = getScreenDistanceToSeed(PointerEventData);
}

function clearAimScreenDistance() {
  host.LastAimScreenDistancePixels = Number.POSITIVE_INFINITY;
}

function clearWalkFacingDataset() {
  GameCanvas.dataset.facingWorld = '';
  GameCanvas.dataset.facingAlignment = '';
}

function isPointerOverAttachedWorld(WorldPosition) {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !WorldPosition) {
    return false;
  }
  const SphereHit = intersectRaySphere(
    PointerRaycaster.ray.origin,
    PointerRaycaster.ray.direction,
    AttachedWorld.position,
    AttachedWorld.radius + 0.45,
  );
  if (SphereHit) {
    return true;
  }
  const Distance = Math.hypot(
    WorldPosition.x - AttachedWorld.position.x,
    WorldPosition.y - AttachedWorld.position.y,
  );
  return Distance <= AttachedWorld.radius + 0.45;
}

function getAttachedGlobeHit(RequireVisibleFace = true) {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld) {
    return null;
  }
  const SurfaceRadius = AttachedWorld.radius + host.SeedRadius + 0.03;
  if (RequireVisibleFace !== false) {
    return intersectRaySphere(
      PointerRaycaster.ray.origin,
      PointerRaycaster.ray.direction,
      AttachedWorld.position,
      SurfaceRadius,
      { nearOnly: true },
    );
  }
  return projectRayOntoSphere(
    PointerRaycaster.ray.origin,
    PointerRaycaster.ray.direction,
    AttachedWorld.position,
    SurfaceRadius,
  );
}

function consumeSurfaceWalkDeltaSeconds() {
  const Now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  let DeltaSeconds = Now - LastSurfaceWalkAtSeconds;
  if (!(LastSurfaceWalkAtSeconds > 0) || DeltaSeconds > 0.2) {
    DeltaSeconds = 1 / 60;
  }
  LastSurfaceWalkAtSeconds = Now;
  return Math.min(0.05, Math.max(0, DeltaSeconds));
}

function getHeldWalkAxes() {
  let East = 0;
  let North = 0;
  if (HeldWalkKeys.has('q')) East += 1;
  if (HeldWalkKeys.has('e')) East -= 1;
  if (HeldWalkKeys.has('t')) North += 1;
  if (HeldWalkKeys.has('f')) North -= 1;
  return { east: East, north: North };
}

function isPlayInputBlocked() {
  return host.IsOpeningBriefingActive === true || host.IsHowToPlayOpen === true;
}

function canHoldWalkKeys() {
  return host.GamePhase === 'attached'
    && host.ReplayPlaybackState === null
    && host.IsKeyboardAiming !== true
    && host.IsPointerAiming !== true
    && host.IsCutAiming !== true
    && !isPlayInputBlocked();
}

function applyKeyboardWalkStep(StepRadians) {
  if (!(StepRadians > 1e-6) || !canHoldWalkKeys()) {
    return false;
  }
  const Axes = getHeldWalkAxes();
  if (Axes.east === 0 && Axes.north === 0) {
    return false;
  }
  const DidMove = moveRunnerOnSurface({
    east: Axes.east,
    north: Axes.north,
    stepRadians: StepRadians,
  });
  if (DidMove) {
    host.RunnerWalkLifeSeconds = 0.34;
    host.HasWalkedOnce = true;
    if (!host.ActiveHostileEncounterState) {
      showWalkFacingInstruction(getCurrentAttachedWorld());
    }
  }
  return DidMove;
}

function tickHeldWalk() {
  HeldWalkFrameHandle = 0;
  if (HeldWalkKeys.size < 1 || !canHoldWalkKeys()) {
    if (!canHoldWalkKeys()) {
      HeldWalkKeys.clear();
    }
    return;
  }
  const StepRadians = getSurfaceWalkArcLimit(consumeSurfaceWalkDeltaSeconds());
  applyKeyboardWalkStep(HeldWalkFine ? StepRadians * 0.5 : StepRadians);
  HeldWalkFrameHandle = requestAnimationFrame(tickHeldWalk);
}

function startHeldWalkLoop() {
  if (HeldWalkFrameHandle || typeof requestAnimationFrame !== 'function') {
    return;
  }
  HeldWalkFrameHandle = requestAnimationFrame(tickHeldWalk);
}

function handleWalkKeyUp(KeyboardEventData) {
  const ReleasedKey = KeyboardEventData.key.toLowerCase();
  if (ReleasedKey === 'q' || ReleasedKey === 'e' || ReleasedKey === 't' || ReleasedKey === 'f') {
    HeldWalkKeys.delete(ReleasedKey);
  }
  if (KeyboardEventData.key === 'Shift') {
    HeldWalkFine = false;
  }
}

GameCanvas.addEventListener('keyup', handleWalkKeyUp);
GameCanvas.addEventListener('blur', () => {
  HeldWalkKeys.clear();
  HeldWalkFine = false;
});

function showWalkFacingInstruction(AttachedWorld) {
  if (!AttachedWorld || showHostileEncounterInstruction()) {
    return;
  }
  const Pose = getRunnerSurfacePose(AttachedWorld);
  const Facing = getLaunchFacingPresentation({
    originX: AttachedWorld.position.x,
    originY: AttachedWorld.position.y,
    longitude: Pose.longitude,
    candidates: getCurrentRouteChoices(2).map((WorldDefinition) => ({
      id: WorldDefinition.id,
      label: WorldDefinition.label,
      x: WorldDefinition.position.x,
      y: WorldDefinition.position.y,
    })),
  });
  GameCanvas.dataset.facingWorld = Facing.worldId ?? '';
  GameCanvas.dataset.facingAlignment = Facing.alignment.toFixed(2);
}

function walkRunnerToGlobeHit(Hit, InputKind = 'pointer') {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !Hit) {
    return false;
  }
  const CurrentPose = getRunnerSurfacePose(AttachedWorld);
  const TargetPose = getLogicalWalkPose(AttachedWorld, Hit);
  let JustLeftDeadzone = false;
  if (!SurfaceWalkHasLeftDeadzone) {
    if (!hasLeftSurfaceWalkDeadzone(SurfaceWalkPressPose ?? CurrentPose, TargetPose)) {
      return false;
    }
    SurfaceWalkHasLeftDeadzone = true;
    SurfaceWalkDragAgeSeconds = 0;
    JustLeftDeadzone = true;
  }
  const DeltaSeconds = consumeSurfaceWalkDeltaSeconds();
  SurfaceWalkDragAgeSeconds += DeltaSeconds;
  let MaxArc = getSurfaceWalkPointerArcLimit(DeltaSeconds, SurfaceWalkDragAgeSeconds);
  if (JustLeftDeadzone) {
    MaxArc = Math.max(MaxArc, SurfaceWalkTapRadians);
  }
  const DidMove = setRunnerSurfacePose(
    stepSurfacePoseToward(
      CurrentPose,
      TargetPose,
      MaxArc,
    ),
    InputKind,
  );
  if (DidMove) {
    host.RunnerWalkLifeSeconds = 0.34;
    host.HasWalkedOnce = true;
    if (Hit) {
      host.WalkHintPosition.set(Hit.x, Hit.y, Hit.z ?? 0);
      host.WalkHintVisible = true;
    }
    showWalkFacingInstruction(AttachedWorld);
  }
  return DidMove;
}

function rememberPointerLocation(PointerEventData) {
  PointerByIdentifier.set(PointerEventData.pointerId, {
    clientX: PointerEventData.clientX,
    clientY: PointerEventData.clientY,
  });
}

function forgetPointerLocation(PointerEventData) {
  PointerByIdentifier.delete(PointerEventData.pointerId);
}

function beginPinchIfNeeded() {
  if (PointerByIdentifier.size !== 2 || host.IsBurnAiming || host.IsCutAiming) {
    return false;
  }
  const [FirstPointer, SecondPointer] = [...PointerByIdentifier.values()];
  host.PinchState = {
    startDistance: getPointerClientDistance(FirstPointer, SecondPointer),
    startScale: shouldUseSectorPlanningCamera() && !host.IsScoutMode
      ? host.AimZoomScale
      : host.CameraZoomScale,
  };
  host.IsPointerWalking = false;
  host.IsPointerScouting = false;
  GameCanvas.classList.remove('is-walking', 'is-scouting');
  return true;
}

function updatePinchZoom() {
  if (!host.PinchState || PointerByIdentifier.size !== 2) {
    return false;
  }
  const [FirstPointer, SecondPointer] = [...PointerByIdentifier.values()];
  const UsesPlanningZoom = shouldUseSectorPlanningCamera() && !host.IsScoutMode;
  const NextScale = getPinchZoomScale(
    host.PinchState.startDistance,
    getPointerClientDistance(FirstPointer, SecondPointer),
    host.PinchState.startScale,
    {
      minimumScale: getActiveViewZoomMinimumScale({
        isScoutMode: host.IsScoutMode === true,
        isPlanningCamera: UsesPlanningZoom,
      }),
      maximumScale: getActiveMaximumScoutZoomScale(),
    },
  );
  if (UsesPlanningZoom) {
    if (NextScale === host.AimZoomScale) {
      return false;
    }
    host.AimZoomScale = NextScale;
    refreshPlanningZoomControls();
    GameCanvas.dataset.aimZoom = host.AimZoomScale.toFixed(2);
    return true;
  }
  if (NextScale === host.CameraZoomScale) {
    return false;
  }
  host.CameraZoomScale = NextScale;
  host.ScoutZoomScale = NextScale;
  refreshPlanningZoomControls();
  GameCanvas.dataset.scoutZoom = host.CameraZoomScale.toFixed(2);
  resizeRenderer();
  return true;
}

/** Uses the shared predictor to give keyboard players a bounded lead on the moving Command World. */
function createSuggestedKeyboardAimState(SuggestedTarget) {
  const DirectAimState = createKeyboardAimState({
    directionX: SuggestedTarget.position.x - host.SeedPhysicsState.position.x,
    directionY: SuggestedTarget.position.y - host.SeedPhysicsState.position.y,
    powerRatio: 1,
  });
  const IsMovingCommandTarget = SuggestedTarget.id === WorldheartDefinition.id
    && Boolean(WorldheartDefinition.orbit)
    && shouldAssistCommandLock({
      wardenStatus: host.WardenPursuitState.status,
      routeAvailable: WorldheartDefinition.routeAvailable === true,
    });
  if (!IsMovingCommandTarget) {
    GameCanvas.dataset.keyboardAimAssist = WorldheartDefinition.routeAvailable
      && SuggestedTarget.id === WorldheartDefinition.id
      ? 'command-direct'
      : 'route';
    return DirectAimState;
  }

  const MaximumLaunchSpeed = MaximumDragDistance * LaunchVelocityPerDragUnit;
  let DidFindCommandLock = false;
  const AssistedAngleRadians = findNearestKeyboardAimAngle(
    DirectAimState.angleRadians,
    (CandidateAngleRadians) => {
      const Prediction = predictCurrentLaunchTrajectory(
        {
          x: Math.cos(CandidateAngleRadians) * MaximumLaunchSpeed,
          y: Math.sin(CandidateAngleRadians) * MaximumLaunchSpeed,
        },
      );
      DidFindCommandLock = Prediction.collisionBodyIdentifier === WorldheartDefinition.id;
      return DidFindCommandLock;
    },
  );
  GameCanvas.dataset.keyboardAimAssist = DidFindCommandLock ? 'command-lock' : 'command-direct';
  if (DidFindCommandLock && !host.HasAnnouncedCommandLockGift) {
    host.HasAnnouncedCommandLockGift = true;
    showStatusToast('COMMAND WORLD LOCKED', 1400);
  }
  return { ...DirectAimState, angleRadians: AssistedAngleRadians };
}

/** Opens keyboard aim toward the first authored route while retaining free steering. */
function beginKeyboardAim() {
  if (
    host.GamePhase !== 'attached'
    || host.IsCutAiming
    || host.RunState.status !== 'active'
    || host.ReplayPlaybackState !== null
    || host.IsPointerAiming
    || host.IsKeyboardAiming
  ) {
    return false;
  }

  flattenRunnerToEquator('keyboard');
  clearWalkFacingDataset();
  clearAimScreenDistance();
  const SuggestedTarget = getCurrentRouteChoices(1)[0];
  const SuggestedTargetPosition = SuggestedTarget?.position ?? {
    x: host.SeedPhysicsState.position.x + 1,
    y: host.SeedPhysicsState.position.y,
  };
  if (!SuggestedTarget) GameCanvas.dataset.keyboardAimAssist = 'direct';
  host.KeyboardAimState = SuggestedTarget
    ? createSuggestedKeyboardAimState(SuggestedTarget)
    : createKeyboardAimState({
      directionX: SuggestedTargetPosition.x - host.SeedPhysicsState.position.x,
      directionY: SuggestedTargetPosition.y - host.SeedPhysicsState.position.y,
      powerRatio: 1,
    });
  host.HasGrabbedShipOnce = true;
  host.IsKeyboardAiming = true;
  CameraPanOffset.set(0, 0, 0);
  host.AimZoomScale = 1;
  WorldseedSound.beginAim();
  GameCanvas.classList.add('is-aiming');
  PullGuideLine.visible = false;
  if (host.PullGuideRibbon) {
    host.PullGuideRibbon.mesh.visible = false;
  }
  syncKeyboardLaunchVectors();
  updateKeyboardAimPreview();
  commitAimPlanningCamera();
  GameCanvas.focus({ preventScroll: true });
  return true;
}

/** Copies keyboard aim into the same drag/velocity vectors the pointer path uses. */
function syncKeyboardLaunchVectors() {
  if (!host.IsKeyboardAiming || !host.KeyboardAimState) {
    return;
  }
  const DragVector = getKeyboardAimDragVector(host.KeyboardAimState, MaximumDragDistance);
  AimDragVector.set(DragVector.x, DragVector.y, 0);
  AimLaunchVelocity.copy(AimDragVector).multiplyScalar(LaunchVelocityPerDragUnit);
  host.LastAimScreenDistancePixels = Number.POSITIVE_INFINITY;
}

/** Cancels pointer or keyboard aim without spending a launch. */
function cancelAimedLaunch({ announce = true } = {}) {
  const WasAiming = host.IsPointerAiming || host.IsKeyboardAiming;
  host.IsPointerAiming = false;
  host.IsKeyboardAiming = false;
  host.IsPointerWalking = false;
  host.IsPointerScouting = false;
  host.PointerGestureMode = SurfaceGestureModes.pending;
  host.ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting', 'is-ship-armed');
  GameCanvas.dataset.keyboardAimAngle = '';
  GameCanvas.dataset.keyboardAimPower = '';
  GameCanvas.dataset.keyboardAimAssist = '';
  releaseAimInteractionCamera();
  clearCommittedAimCamera();
  clearTrajectoryPreview();
  if (WasAiming) WorldseedSound.endAim();
  if (WasAiming && announce) showStatusToast('LAUNCH CANCELED', 700);
  if (WasAiming) {
    clearWalkFacingDataset();
    showRouteChoiceInstruction();
  }
  refreshPlanningZoomControls();
  clearAimScreenDistance();
}

/** Cancels keyboard aiming without spending a launch. */
function cancelKeyboardAim() {
  if (!host.IsKeyboardAiming) {
    return;
  }
  cancelAimedLaunch({ announce: false });
}

/** Routes focused canvas keys into the same aim and launch state as a pointer gesture. */
function handleKeyboardAimKey(KeyboardEventData) {
  if (isPlayInputBlocked()) {
    return false;
  }
  if (host.getActiveElement() !== GameCanvas) {
    if (host.IsPauseSheetOpen) {
      return false;
    }
    GameCanvas.focus({ preventScroll: true });
  }

  const PressedKey = KeyboardEventData.key.toLowerCase();
  if (
    !host.IsKeyboardAiming
    && (PressedKey === 'q' || PressedKey === 'e' || PressedKey === 't' || PressedKey === 'f')
    && host.GamePhase === 'attached'
    && host.ReplayPlaybackState === null
  ) {
    KeyboardEventData.preventDefault();
    setScoutMode(false);
    HeldWalkFine = KeyboardEventData.shiftKey === true;
    HeldWalkKeys.add(PressedKey);
    startHeldWalkLoop();
    if (KeyboardEventData.repeat === true) {
      if (HeldWalkFrameHandle) {
        return true;
      }
      const RepeatStep = getSurfaceWalkArcLimit(consumeSurfaceWalkDeltaSeconds());
      return applyKeyboardWalkStep(
        KeyboardEventData.shiftKey ? RepeatStep * 0.5 : RepeatStep,
      );
    }
    LastSurfaceWalkAtSeconds = (
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    ) / 1000;
    return applyKeyboardWalkStep(
      KeyboardEventData.shiftKey ? SurfaceWalkTapRadians * 0.5 : SurfaceWalkTapRadians,
    );
  }
  const IsLaunchKey = PressedKey === 'enter' || PressedKey === ' ';
  const RotationDirection = PressedKey === 'arrowleft' || PressedKey === 'a'
    ? 1
    : (PressedKey === 'arrowright' || PressedKey === 'd' ? -1 : 0);
  const PowerDirection = PressedKey === 'arrowup' || PressedKey === 'w'
    ? 1
    : (PressedKey === 'arrowdown' || PressedKey === 's' ? -1 : 0);

  if (PressedKey === 'escape' && (
    host.IsKeyboardAiming
    || host.IsPointerAiming
    || host.IsBurnAiming
    || host.IsCutAiming
    || (
      host.ActivePointerIdentifier !== null
      && host.GamePhase === 'attached'
      && host.IsPointerWalking !== true
      && (
        host.PointerGestureMode === SurfaceGestureModes.pending
        || (host.PointerGestureMode === SurfaceGestureModes.aim && host.IsPointerAiming !== true)
      )
    )
  )) {
    KeyboardEventData.preventDefault();
    if (host.IsCutAiming) {
      cancelCutAim();
    } else if (host.IsBurnAiming) {
      cancelBurnAim();
    } else if (host.IsPointerAiming || host.IsKeyboardAiming) {
      cancelAimedLaunch();
    } else {
      host.ActivePointerIdentifier = null;
      host.PointerGestureMode = SurfaceGestureModes.pending;
      GameCanvas.classList.remove('is-ship-armed');
      clearAimScreenDistance();
      if (!showHostileEncounterInstruction()) {
        showWalkFacingInstruction(getCurrentAttachedWorld());
      }
    }
    return true;
  }
  if (host.ActiveHostileEncounterState && host.GamePhase === 'attached' && !host.IsKeyboardAiming) {
    if (PressedKey === ' ') {
      KeyboardEventData.preventDefault();
      if (KeyboardEventData.repeat) return true;
      if (host.IsCutAiming) fireHostileCutFromPreview();
      else fireNearestClampTap();
      return true;
    }
  }
  if (!IsLaunchKey && RotationDirection === 0 && PowerDirection === 0) {
    return false;
  }
  if (IsLaunchKey && KeyboardEventData.repeat) {
    KeyboardEventData.preventDefault();
    return true;
  }
  if (PressedKey === 'enter' && host.IsCutAiming) {
    cancelCutAim({ announce: false });
  }
  if (!host.IsKeyboardAiming && !beginKeyboardAim()) {
    return false;
  }

  KeyboardEventData.preventDefault();
  if (IsLaunchKey) {
    if (host.IsKeyboardAiming) {
      syncKeyboardLaunchVectors();
      releaseAimedLaunch();
    }
    return true;
  }

  host.KeyboardAimState = adjustKeyboardAimState(host.KeyboardAimState, {
    rotationDirection: RotationDirection,
    powerDirection: PowerDirection,
    fine: KeyboardEventData.shiftKey,
  });
  updateKeyboardAimPreview();
  return true;
}

function beginCameraPan(WorldPosition) {
  host.IsPointerScouting = true;
  ScoutPointerStartWorldPosition.copy(WorldPosition);
  if (host.IsScoutMode) {
    ScoutCameraStartTarget.copy(ScoutCameraTarget);
  } else {
    PanOffsetStart.copy(CameraPanOffset);
  }
  GameCanvas.classList.add('is-scouting');
  if (host.GamePhase === 'attached') {
    clearWalkFacingDataset();
    if (!showHostileEncounterInstruction()) showRouteChoiceInstruction();
  }
}

function updateCameraPan(WorldPosition) {
  const NextX = (host.IsScoutMode ? ScoutCameraStartTarget.x : PanOffsetStart.x)
    + (ScoutPointerStartWorldPosition.x - WorldPosition.x);
  const NextY = (host.IsScoutMode ? ScoutCameraStartTarget.y : PanOffsetStart.y)
    + (ScoutPointerStartWorldPosition.y - WorldPosition.y);
  if (host.IsScoutMode) {
    ScoutCameraTarget.set(
      host.ScannerProjection
        ? THREE.MathUtils.clamp(
          NextX,
          host.ScannerProjection.minimumX,
          host.ScannerProjection.minimumX + host.ScannerProjection.width,
        )
        : NextX,
      host.ScannerProjection
        ? THREE.MathUtils.clamp(
          NextY,
          host.ScannerProjection.minimumY,
          host.ScannerProjection.minimumY + host.ScannerProjection.height,
        )
        : NextY,
      0,
    );
    GameCanvas.dataset.scoutX = ScoutCameraTarget.x.toFixed(2);
    GameCanvas.dataset.scoutY = ScoutCameraTarget.y.toFixed(2);
    return;
  }
  CameraPanOffset.set(NextX, NextY, 0);
  GameCanvas.dataset.scoutX = CameraPanOffset.x.toFixed(2);
  GameCanvas.dataset.scoutY = CameraPanOffset.y.toFixed(2);
}

function beginCutAim(WorldPosition) {
  if (!host.ActiveHostileEncounterState || host.GamePhase !== 'attached') return false;
  flattenRunnerToEquator('pointer');
  host.IsCutAiming = true;
  host.CutAimPointer = { x: WorldPosition.x, y: WorldPosition.y };
  GameCanvas.classList.add('is-aiming');
  updateCutAimPreview(WorldPosition);
  return true;
}

function updateCutAimPreview(WorldPosition) {
  if (!host.IsCutAiming || !host.ActiveHostileEncounterState) return;
  host.CutAimPointer = { x: WorldPosition.x, y: WorldPosition.y };
  publishHostileEncounterState();
  updateBreakerBurnInterface();
}

function cancelCutAim({ announce = true } = {}) {
  const WasAiming = host.IsCutAiming;
  host.IsCutAiming = false;
  host.CutAimPointer = null;
  host.ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming');
  hideCutGuide();
  if (WasAiming && announce) showStatusToast('DESTROY CANCELED', 650);
  if (host.ActiveHostileEncounterState) {
    publishHostileEncounterState();
    updateBreakerBurnInterface();
    showHostileEncounterInstruction();
  }
}

function applyHostileCut(Origin, End) {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !host.ActiveHostileEncounterState || host.ReplayPlaybackState !== null) {
    return false;
  }
  const Resolved = resolveHostileCut(
    host.ActiveHostileEncounterState,
    Origin,
    End,
    AttachedWorld,
  );
  if (Resolved.hitIds.length < 1) {
    showStatusToast('MISSED', 700);
    showHostileEncounterInstruction();
    return false;
  }
  return applyResolvedClampHits(Resolved);
}

function applyClampTap(ClampId) {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !host.ActiveHostileEncounterState || host.ReplayPlaybackState !== null) {
    return false;
  }
  const Resolved = resolveClampTap(host.ActiveHostileEncounterState, ClampId);
  if (Resolved.hitIds.length < 1) {
    showStatusToast('MISSED', 700);
    showHostileEncounterInstruction();
    return false;
  }
  return applyResolvedClampHits(Resolved);
}

function applyResolvedClampHits(Resolved) {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld) {
    return false;
  }
  HostilePylonGroup.userData.breakClamps?.(
    AttachedWorld,
    Resolved.hitIds,
    host.ActiveHostileEncounterState,
  );
  WorldseedSound.cut(Resolved.hitIds.length);
  host.ActiveHostileEncounterState = Resolved.state;
  GameCanvas.dataset.lastHostileWorld = AttachedWorld.id;
  if (Resolved.state.completed) {
    CompletedHostileEncounterWorldIdentifiers.add(AttachedWorld.id);
    host.ActiveHostileEncounterState = null;
    HostilePylonGroup.visible = false;
    hideCutGuide();
    publishHostileEncounterState();
    if (AttachedWorld.kind === 'worldheart') {
      return completeWorldheartLiberation();
    }
    const WorldRuntime = WorldRuntimeByIdentifier.get(AttachedWorld.id);
    if (WorldRuntime) {
      WorldRuntime.cageClearPulseStartedAtSeconds = host.GameElapsedTimeSeconds;
      WorldRuntime.restorationWaveMesh.visible = true;
      WorldRuntime.restorationUniforms.restorationProgress.value = 0;
    }
    host.LiberationCelebrateUntilSeconds = Math.max(
      host.LiberationCelebrateUntilSeconds ?? 0,
      host.GameElapsedTimeSeconds
        + getCageClearPulseDurationSeconds({
          prefersReducedMotion: host.PrefersReducedMotion === true,
        }),
    );
    updateBreakerBurnInterface();
    showStatusToast('THE RIM IS CLEAR', 1350);
    showInstruction(
      `${AttachedWorld.label} can fly.`,
      'Pull the ship to fly. Drag the globe to walk. Drag empty space to look around.',
    );
    flushQueuedStoryBoardsIfReady();
    return true;
  }
  publishHostileEncounterState();
  updateBreakerBurnInterface();
  const RemainingCount = getRemainingClamps(Resolved.state).length;
  showStatusToast(
    Resolved.hitIds.length > 1
      ? `${Resolved.hitIds.length} CLAMPS GONE · ${RemainingCount} LEFT`
      : `CLAMP GONE · ${RemainingCount} LEFT`,
    900,
  );
  showInstruction(
    `${RemainingCount} left on ${AttachedWorld.label}.`,
    RemainingCount === 1
      ? 'One cage remains. Walk near it, then tap it.'
      : 'Walk near each cage, then tap it.',
  );
  return true;
}

function fireHostileCutFromPreview() {
  const Preview = getCurrentCutPreview();
  if (!Preview || Preview.willCancel) {
    cancelCutAim({ announce: true });
    return false;
  }
  host.IsCutAiming = false;
  host.CutAimPointer = null;
  host.ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming');
  hideCutGuide();
  return applyHostileCut(Preview.origin, Preview.end);
}

function releaseCutAim() {
  return fireHostileCutFromPreview();
}

function fireNearestClampTap() {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !host.ActiveHostileEncounterState) return false;
  const NearestClamp = getNearestRemainingClamp(
    host.ActiveHostileEncounterState,
    getRunnerSurfaceAngle(AttachedWorld),
  );
  if (!NearestClamp) return false;
  return applyClampTap(NearestClamp.id);
}

function fireNearestHostileCut() {
  return fireNearestClampTap();
}

function beginBurnAim(WorldPosition) {
  host.IsBurnAiming = true;
  host.BurnAimDirection = {
    x: WorldPosition.x - host.SeedPhysicsState.position.x,
    y: WorldPosition.y - host.SeedPhysicsState.position.y,
  };
  GameCanvas.classList.add('is-aiming');
  updateBurnAimPreview(WorldPosition);
}

function updateBurnAimPreview(WorldPosition) {
  host.BurnAimDirection = {
    x: WorldPosition.x - host.SeedPhysicsState.position.x,
    y: WorldPosition.y - host.SeedPhysicsState.position.y,
  };
  const Distance = Math.hypot(host.BurnAimDirection.x, host.BurnAimDirection.y);
  const WillCancel = shouldCancelAimedLaunch({
    pointerDistanceFromShip: Distance,
    cancelRadius: LaunchCancelRadius,
    screenDistancePixels: host.LastAimScreenDistancePixels,
  });
  if (WillCancel || Distance < 0.001) {
    clearTrajectoryPreview();
    return;
  }
  const BurnedState = applyBreakerBurn(host.SeedPhysicsState, undefined, host.BurnAimDirection);
  const TrajectoryPrediction = predictTrajectory(
    BurnedState.position,
    BurnedState.velocity,
    WorldDefinitions,
    {
      seedRadius: SeedRadius,
      fixedStepSeconds: FixedPhysicsStepSeconds,
      maximumSteps: MaximumTrajectoryPredictionSteps,
      ignoredWorldIdentifier: host.FlightOriginWorldIdentifier,
      collisionBodyDefinitions: getActiveTacticalBodyDefinitions(),
      startTimeSeconds: host.PhysicsElapsedTimeSeconds,
    },
  );
  if (TrajectoryPrediction.points.length > 1) {
    renderTrajectoryLine(TrajectoryPrediction.points);
  }
}

function cancelBurnAim({ announce = true } = {}) {
  host.IsBurnAiming = false;
  host.BurnAimDirection = null;
  host.ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming');
  clearTrajectoryPreview();
  if (announce) showStatusToast('BREAK CANCELED', 650);
}

function releaseBurnAim() {
  const Direction = host.BurnAimDirection;
  const Distance = Math.hypot(Direction?.x ?? 0, Direction?.y ?? 0);
  const WillCancel = shouldCancelAimedLaunch({
    pointerDistanceFromShip: Distance,
    cancelRadius: LaunchCancelRadius,
    screenDistancePixels: host.LastAimScreenDistancePixels,
  });
  host.IsBurnAiming = false;
  host.ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming');
  clearTrajectoryPreview();
  if (WillCancel || !Direction) {
    host.BurnAimDirection = null;
    showStatusToast('BREAK CANCELED', 650);
    return false;
  }
  host.BurnAimDirection = Direction;
  return requestBreakerBurn();
}

function beginLaunchAim(WorldPosition, PointerEventData = null) {
  flattenRunnerToEquator('pointer');
  host.HasGrabbedShipOnce = true;
  host.PointerGestureMode = SurfaceGestureModes.aim;
  host.HasCommittedAimCamera = false;
  GameCanvas.dataset.aimCamera = getAimCameraStage({
    willCancel: true,
    hasCommitted: false,
    prefersReducedMotion: host.PrefersReducedMotion,
  });
  clearWalkFacingDataset();
  captureAimInteractionCamera();
  CameraPanOffset.set(0, 0, 0);
  host.AimZoomScale = 1;
  host.IsPointerAiming = true;
  WorldseedSound.beginAim();
  GameCanvas.classList.add('is-aiming');
  GameCanvas.classList.remove('is-ship-armed');
  const AimPointer = PointerEventData
    ? (getPointerWorldPosition(PointerEventData, host.AimInteractionCamera) ?? WorldPosition)
    : WorldPosition;
  PointerGestureStartWorldPosition.copy(AimPointer);
  LastAimPointerWorldPosition.copy(AimPointer);
  updateAimPreview(AimPointer);
  if (host.PrefersReducedMotion) {
    commitAimPlanningCamera();
  }
  refreshPlanningZoomControls();
}

function beginSurfaceWalk() {
  host.PointerGestureMode = SurfaceGestureModes.walk;
  host.IsPointerWalking = true;
  host.WalkHintPosition.copy(SeedGroup.position);
  host.WalkHintVisible = true;
  WorldseedSound.beginWalk();
  GameCanvas.classList.add('is-walking');
  LastSurfaceWalkAtSeconds = 0;
  SurfaceWalkDragAgeSeconds = 0;
  SurfaceWalkHasLeftDeadzone = false;
  const AttachedWorld = getCurrentAttachedWorld();
  const PressHit = getAttachedGlobeHit(true);
  SurfaceWalkPressPose = PressHit && AttachedWorld
    ? getLogicalWalkPose(AttachedWorld, PressHit)
    : (AttachedWorld ? getRunnerSurfacePose(AttachedWorld) : null);
  showWalkFacingInstruction(AttachedWorld);
}

function getLogicalWalkPose(AttachedWorld, Hit) {
  const WorldRuntime = WorldRuntimeByIdentifier.get(AttachedWorld.id);
  const CrustQuaternion = WorldRuntime?.group?.quaternion;
  if (CrustQuaternion) {
    try {
      return getSurfacePoseFromDirection(getLogicalSurfaceDirectionFromWorldHit({
        worldX: AttachedWorld.position.x,
        worldY: AttachedWorld.position.y,
        worldZ: AttachedWorld.position.z ?? 0,
        hitX: Hit.x,
        hitY: Hit.y,
        hitZ: Hit.z ?? 0,
        crustQX: CrustQuaternion.x,
        crustQY: CrustQuaternion.y,
        crustQZ: CrustQuaternion.z,
        crustQW: CrustQuaternion.w,
      }));
    } catch {
      return getSurfacePoseFromPosition(AttachedWorld.position, Hit);
    }
  }
  return getSurfacePoseFromPosition(AttachedWorld.position, Hit);
}

/**
 * Begins a slingshot drag when the seed is attached and the pointer acquired it.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 */
function handlePointerDown(PointerEventData) {
  if (isPlayInputBlocked()) {
    return;
  }
  if (host.RunState.status !== 'active' || host.ReplayPlaybackState !== null) {
    return;
  }

  rememberPointerLocation(PointerEventData);
  if (beginPinchIfNeeded()) {
    PointerEventData.preventDefault();
    return;
  }
  if (host.ActivePointerIdentifier !== null || host.PinchState) {
    return;
  }

  const CurrentPointerWorldPosition = getPointerWorldPosition(PointerEventData);
  if (!CurrentPointerWorldPosition) {
    return;
  }

  rememberAimScreenDistance(PointerEventData);
  GameCanvas.focus({ preventScroll: true });
  host.ActivePointerIdentifier = PointerEventData.pointerId;
  GameCanvas.setPointerCapture(PointerEventData.pointerId);

  if (host.GamePhase === 'flying') {
    if (isPointerOverSeed(PointerEventData) && host.IsBreakerBurnAvailable && !host.IsBreakerBurnPending) {
      beginBurnAim(CurrentPointerWorldPosition);
    } else {
      beginCameraPan(CurrentPointerWorldPosition);
    }
    PointerEventData.preventDefault();
    return;
  }

  if (host.GamePhase !== 'attached') {
    host.ActivePointerIdentifier = null;
    if (GameCanvas.hasPointerCapture(PointerEventData.pointerId)) {
      GameCanvas.releasePointerCapture(PointerEventData.pointerId);
    }
    return;
  }

  cancelKeyboardAim();
  const Occupancy = getLandedPointerOccupancy(PointerEventData, CurrentPointerWorldPosition);
  const PointerStartTarget = classifyLandedPointerStart({
    isOverShip: Occupancy.isOverShip,
    isOverCage: Occupancy.isOverCage,
    isOverWorld: Occupancy.isOverWorld,
  });
  if (PointerStartTarget === LandedPointerTargets.ship) {
    setScoutMode(false);
    host.HasGrabbedShipOnce = true;
    host.PointerGestureMode = SurfaceGestureModes.aim;
    host.IsPointerWalking = false;
    host.WalkHintVisible = false;
    GameCanvas.classList.add('is-ship-armed');
    GameCanvas.classList.remove('is-walking', 'is-walk-ready');
    PointerGestureStartWorldPosition.copy(CurrentPointerWorldPosition);
    LastAimPointerWorldPosition.copy(CurrentPointerWorldPosition);
    PointerEventData.preventDefault();
    return;
  }

  if (PointerStartTarget === LandedPointerTargets.cage) {
    setScoutMode(false);
    host.PointerGestureMode = SurfaceGestureModes.pending;
    host.IsPointerWalking = false;
    host.IsCageBreaking = true;
    CageBreakClampId = Occupancy.cageClampId;
    CageBreakStartX = CurrentPointerWorldPosition.x;
    CageBreakStartY = CurrentPointerWorldPosition.y;
    GameCanvas.classList.add('is-cage-breaking');
    GameCanvas.classList.remove('is-walking', 'is-walk-ready', 'is-ship-armed');
    PointerEventData.preventDefault();
    return;
  }

  if (PointerStartTarget === LandedPointerTargets.world) {
    setScoutMode(false);
    beginSurfaceWalk();
    PointerEventData.preventDefault();
    return;
  }

  beginCameraPan(CurrentPointerWorldPosition);
  PointerEventData.preventDefault();
}

/**
 * Updates a slingshot drag.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 */
function handlePointerMove(PointerEventData) {
  rememberPointerLocation(PointerEventData);
  if (host.PinchState) {
    updatePinchZoom();
    PointerEventData.preventDefault();
    return;
  }
  if (host.ActivePointerIdentifier === null && PointerEventData.pointerType === 'mouse') {
    const CanGrabSeed = (
      host.GamePhase === 'attached'
      || (host.GamePhase === 'flying' && host.IsBreakerBurnAvailable && !host.IsBreakerBurnPending)
    );
    const LandedOccupancy = host.GamePhase === 'attached'
      ? getLandedPointerOccupancy(PointerEventData)
      : null;
    GameCanvas.classList.toggle(
      'is-grab-ready',
      CanGrabSeed
      && host.ReplayPlaybackState === null
      && !isPlayInputBlocked()
      && (
        host.GamePhase === 'attached'
          ? (LandedOccupancy.isOverShip && !LandedOccupancy.isOverCage)
          : isPointerOverSeed(PointerEventData)
      ),
    );
    GameCanvas.classList.toggle(
      'is-cage-ready',
      host.GamePhase === 'attached'
      && host.ReplayPlaybackState === null
      && !isPlayInputBlocked()
      && LandedOccupancy.isOverCage === true,
    );
    if (
      host.GamePhase === 'attached'
      && host.ReplayPlaybackState === null
      && !isPlayInputBlocked()
      && !LandedOccupancy.isOverShip
      && !LandedOccupancy.isOverCage
    ) {
      const IsWalkReady = LandedOccupancy.isOverWorld === true;
      GameCanvas.classList.toggle('is-walk-ready', IsWalkReady);
      if (IsWalkReady) {
        const GlobeHit = getAttachedGlobeHit(true);
        if (GlobeHit) {
          host.WalkHintPosition.set(GlobeHit.x, GlobeHit.y, GlobeHit.z ?? 0);
          host.WalkHintVisible = true;
        }
      } else {
        host.WalkHintVisible = false;
      }
    } else {
      GameCanvas.classList.remove('is-walk-ready');
      if (!host.IsPointerWalking) {
        host.WalkHintVisible = false;
      }
    }
  }
  if (PointerEventData.pointerId !== host.ActivePointerIdentifier) {
    return;
  }

  if (host.IsCageBreaking || CageBreakClampId !== null) {
    PointerEventData.preventDefault();
    return;
  }

  const CurrentPointerWorldPosition = getPointerWorldPosition(
    PointerEventData,
    (host.IsPointerAiming && host.AimInteractionCamera) ? host.AimInteractionCamera : Camera,
  );
  if (!CurrentPointerWorldPosition) {
    return;
  }

  rememberAimScreenDistance(PointerEventData);

  if (
    host.PointerGestureMode === SurfaceGestureModes.aim
    && host.GamePhase === 'attached'
    && !host.IsPointerAiming
    && !host.IsPointerWalking
    && !host.IsCutAiming
    && !host.IsBurnAiming
    && !host.IsPointerScouting
  ) {
    const AttachedWorld = getCurrentAttachedWorld();
    if (AttachedWorld) {
      const Classification = classifyPendingShipGrab({
        screenDistanceFromShip: host.LastAimScreenDistancePixels,
      });
      if (Classification === SurfaceGestureModes.aim) {
        beginLaunchAim(CurrentPointerWorldPosition, PointerEventData);
      }
    }
    PointerEventData.preventDefault();
    return;
  }

  if (host.IsCutAiming) {
    updateCutAimPreview(CurrentPointerWorldPosition);
    PointerEventData.preventDefault();
    return;
  }

  if (host.IsBurnAiming) {
    updateBurnAimPreview(CurrentPointerWorldPosition);
    PointerEventData.preventDefault();
    return;
  }

  if (host.IsPointerScouting) {
    updateCameraPan(CurrentPointerWorldPosition);
    PointerEventData.preventDefault();
    return;
  }

  if (host.IsPointerWalking) {
    walkRunnerToGlobeHit(getAttachedGlobeHit(true));
    PointerEventData.preventDefault();
    return;
  }

  if (host.IsPointerAiming) {
    LastAimPointerWorldPosition.copy(CurrentPointerWorldPosition);
    updateAimPreview(CurrentPointerWorldPosition);
  }
  PointerEventData.preventDefault();
}

/** Launches the current pointer or keyboard aim through the shared deterministic path. */
function releaseAimedLaunch() {
  if (host.IsKeyboardAiming) {
    syncKeyboardLaunchVectors();
  }
  if (AimDragVector.length() < MinimumLaunchDragDistance) {
    host.IsPointerAiming = false;
    host.IsPointerWalking = false;
    host.IsPointerScouting = false;
    host.PointerGestureMode = SurfaceGestureModes.pending;
    host.IsKeyboardAiming = false;
    host.ActivePointerIdentifier = null;
    GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting', 'is-ship-armed');
    releaseAimInteractionCamera();
    clearCommittedAimCamera();
    clearTrajectoryPreview();
    WorldseedSound.endAim();
    return false;
  }

  host.IsPointerAiming = false;
  host.IsPointerWalking = false;
  host.IsPointerScouting = false;
  host.PointerGestureMode = SurfaceGestureModes.pending;
  host.IsKeyboardAiming = false;
  setScoutMode(false);
  host.FlightElapsedSeconds = 0;
  host.IsBreakerBurnAvailable = false;
  host.IsBreakerBurnPending = false;
  host.ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting', 'is-ship-armed');
  releaseAimInteractionCamera();
  clearCommittedAimCamera();

  applySectorPlanningCamera();

  host.RunState = releaseRunLaunch(host.RunState);
  updateFuelLights();
  CameraPanOffset.set(0, 0, 0);

  host.SeedPhysicsState.velocity = createVector(
    AimLaunchVelocity.x,
    AimLaunchVelocity.y,
    0,
  );
  host.ReplayState = recordReplayLaunch(host.ReplayState, {
    stepIndex: Math.round(host.PhysicsElapsedTimeSeconds * FixedPhysicsStepHertz),
    originIdentifier: host.CurrentWorldIdentifier,
    originX: host.SeedPhysicsState.position.x,
    originY: host.SeedPhysicsState.position.y,
    velocityX: AimLaunchVelocity.x,
    velocityY: AimLaunchVelocity.y,
  });
  GameCanvas.dataset.replayLaunchCount = String(host.ReplayState.launches.length);
  GameCanvas.dataset.lastLaunchVelocityX = AimLaunchVelocity.x.toFixed(3);
  GameCanvas.dataset.lastLaunchVelocityY = AimLaunchVelocity.y.toFixed(3);
  GameCanvas.dataset.lastLaunchTime = host.PhysicsElapsedTimeSeconds.toFixed(3);
  const IsLaunchingFromSeedstone = host.CurrentWorldIdentifier === SeedstoneDefinition.id;
  host.FlightOriginWorldIdentifier = IsLaunchingFromSeedstone ? null : host.CurrentWorldIdentifier;
  FlightCollectedStardustIdentifiers.clear();
  host.FlightHadAsteroidClosePass = false;
  FlightClosePassWorldIdentifiers.clear();
  host.LaunchIgnoredWorldIdentifier = IsLaunchingFromSeedstone ? null : host.CurrentWorldIdentifier;
  host.LaunchIgnoredBodyIdentifier = IsLaunchingFromSeedstone ? SeedstoneDefinition.id : null;
  if (IsLaunchingFromSeedstone) {
    host.AttachedSeedstoneSurfaceOffset = null;
    host.SeedstoneUsesRemaining = 0;
    host.SeedstoneCrumbleStartedAtSeconds = host.GameElapsedTimeSeconds;
    showStatusToast(`${SeedstoneDefinition.label} SPENT`, 650);
  }
  host.GamePhase = 'flying';
  host.FlightElapsedSeconds = 0;
  host.FlightOrbitTrapState = createOrbitTrapState();
  host.IsBreakerBurnAvailable = true;
  host.IsBreakerBurnPending = false;
  updateBreakerBurnInterface();
  host.HasLaunchedOnce = true;
  captureCommittedLaunchPrediction(AimLaunchVelocity);
  refreshPlanningZoomControls();
  LaunchPulseMesh.position.copy(SeedGroup.position);
  LaunchPulseMesh.scale.setScalar(1);
  LaunchPulseMesh.visible = true;
  host.LaunchPulseDurationSeconds = 0.42;
  host.LaunchPulseLifeSeconds = 0.42;
  host.TrailEmissionAccumulatorSeconds = 0;
  WorldseedSound.launch(THREE.MathUtils.clamp(
    AimDragVector.length() / MaximumDragDistance,
    0,
    1,
  ));
  if (!host.HasTaughtBurn) {
    host.HasTaughtBurn = true;
    showInstruction(
      'Break ready — one free correction',
      'If the line drifts, drag from the ship (or press Space) to bend this flight once. Drag back onto the ship, or press Escape, to cancel.',
      'break',
    );
  } else {
    hideInstruction();
  }
  return true;
}

function updateBreakerBurnInterface() {
  const IsHostileCut = Boolean(host.ActiveHostileEncounterState);
  const RemainingCount = IsHostileCut
    ? getRemainingClamps(host.ActiveHostileEncounterState).length
    : 0;
  if (IsHostileCut) {
    const EncounterWorldId = host.ActiveHostileEncounterState.worldIdentifier;
    if (host.DestroyTeachWorldIdentifier !== EncounterWorldId) {
      host.DestroyTeachWorldIdentifier = EncounterWorldId;
      showStatusToast('Tap the cage to break it. Pull the ship to fly.', 2400);
      showHostileEncounterInstruction();
    }
    publishHostileEncounterState();
  } else {
    host.DestroyTeachWorldIdentifier = '';
  }
  GameCanvas.dataset.breakerBurn = host.GamePhase !== 'flying'
    ? 'stowed'
    : (host.IsBreakerBurnAvailable ? (host.IsBreakerBurnPending ? 'armed' : 'ready') : 'spent');
  GameCanvas.dataset.hostileClampCount = IsHostileCut ? String(RemainingCount) : '';
}

function requestBreakerPulse() {
  if (host.IsCutAiming) return fireHostileCutFromPreview();
  return fireNearestHostileCut();
}

function requestBreakerAction() {
  return host.ActiveHostileEncounterState
    ? requestBreakerPulse()
    : requestBreakerBurn();
}

/** Queues input for the next authoritative fixed step rather than mutating between frames. */
function requestBreakerBurn() {
  if (
    host.GamePhase !== 'flying'
    || !host.IsBreakerBurnAvailable
    || host.IsBreakerBurnPending
    || host.ReplayPlaybackState !== null
  ) {
    return false;
  }
  host.IsBreakerBurnPending = true;
  updateBreakerBurnInterface();
  return true;
}

function applyBreakerBurnAtCurrentStep({ record = false } = {}) {
  if (!host.IsBreakerBurnAvailable) return false;
  let BurnDirection = host.BurnAimDirection;
  if (!BurnDirection) {
    const OriginWorld = WorldDefinitions.find((WorldDefinition) => (
      WorldDefinition.id === host.FlightOriginWorldIdentifier
      || WorldDefinition.id === host.LaunchIgnoredWorldIdentifier
    ));
    BurnDirection = getBreakerBurnDirection(host.SeedPhysicsState, OriginWorld?.position ?? null);
  }
  host.SeedPhysicsState = applyBreakerBurn(host.SeedPhysicsState, undefined, BurnDirection);
  host.IsBreakerBurnAvailable = false;
  host.IsBreakerBurnPending = false;
  host.CommittedPredictionPoints = null;
  GameCanvas.dataset.predictionHoldActive = 'false';
  if (record) {
    host.ReplayState = recordReplayBurn(host.ReplayState, {
      stepIndex: Math.round(host.PhysicsElapsedTimeSeconds * FixedPhysicsStepHertz),
      directionX: BurnDirection?.x ?? null,
      directionY: BurnDirection?.y ?? null,
    });
  }
  GameCanvas.dataset.breakerBurnStep = String(
    Math.round(host.PhysicsElapsedTimeSeconds * FixedPhysicsStepHertz),
  );
  GameCanvas.dataset.breakerBurnSpeed = Math.hypot(
    host.SeedPhysicsState.velocity.x,
    host.SeedPhysicsState.velocity.y,
  ).toFixed(3);
  LaunchPulseMesh.position.copy(SeedGroup.position);
  LaunchPulseMesh.scale.setScalar(1.3);
  LaunchPulseMesh.visible = true;
  host.LaunchPulseDurationSeconds = 0.5;
  host.LaunchPulseLifeSeconds = 0.5;
  host.BreakerBurnFlareLifeSeconds = 0.55;
  WorldseedSound.breakerBurn();
  showStatusToast('BREAK · COURSE CHANGED', 850);
  host.BurnAimDirection = null;
  updateBreakerBurnInterface();
  return true;
}

/**
 * Converts the final drag vector into launch velocity, or cancels if the gesture was tiny.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 */
function handlePointerUp(PointerEventData) {
  forgetPointerLocation(PointerEventData);
  if (host.PinchState && PointerByIdentifier.size < 2) {
    host.PinchState = null;
    if (PointerEventData.pointerId === host.ActivePointerIdentifier) {
      host.ActivePointerIdentifier = null;
    }
    PointerEventData.preventDefault();
    return;
  }

  if (PointerEventData.pointerId !== host.ActivePointerIdentifier) {
    return;
  }

  if (GameCanvas.hasPointerCapture(PointerEventData.pointerId)) {
    GameCanvas.releasePointerCapture(PointerEventData.pointerId);
  }

  if (host.IsCageBreaking || CageBreakClampId !== null) {
    finishArmedCageTap();
    PointerEventData.preventDefault();
    return;
  }

  if (host.IsCutAiming) {
    const CurrentCutPointerWorldPosition = getPointerWorldPosition(PointerEventData);
    if (CurrentCutPointerWorldPosition) {
      updateCutAimPreview(CurrentCutPointerWorldPosition);
    }
    releaseCutAim();
    PointerEventData.preventDefault();
    return;
  }

  if (host.IsBurnAiming) {
    const CurrentPointerWorldPosition = getPointerWorldPosition(PointerEventData);
    if (CurrentPointerWorldPosition) {
      updateBurnAimPreview(CurrentPointerWorldPosition);
    }
    releaseBurnAim();
    PointerEventData.preventDefault();
    return;
  }

  if (host.IsPointerScouting) {
    host.IsPointerScouting = false;
    host.ActivePointerIdentifier = null;
    GameCanvas.classList.remove('is-scouting');
    PointerEventData.preventDefault();
    return;
  }

  if (host.IsPointerWalking) {
    host.IsPointerWalking = false;
    host.ActivePointerIdentifier = null;
    host.PointerGestureMode = SurfaceGestureModes.pending;
    host.WalkHintVisible = false;
    GameCanvas.classList.remove('is-walking');
    if (!showHostileEncounterInstruction()) {
      showWalkFacingInstruction(getCurrentAttachedWorld());
    }
    PointerEventData.preventDefault();
    return;
  }

  if (!host.IsPointerAiming) {
    host.ActivePointerIdentifier = null;
    host.PointerGestureMode = SurfaceGestureModes.pending;
    GameCanvas.classList.remove('is-ship-armed');
    clearAimScreenDistance();
    if (!showHostileEncounterInstruction()) {
      showWalkFacingInstruction(getCurrentAttachedWorld());
    }
    PointerEventData.preventDefault();
    return;
  }

  const CurrentPointerWorldPosition = getPointerWorldPosition(
    PointerEventData,
    (host.IsPointerAiming && host.AimInteractionCamera) ? host.AimInteractionCamera : Camera,
  );
  if (CurrentPointerWorldPosition) {
    LastAimPointerWorldPosition.copy(CurrentPointerWorldPosition);
    updateAimPreview(CurrentPointerWorldPosition);
  }

  if (shouldCancelAimedLaunch({
    pointerDistanceFromShip: AimDragVector.length(),
    cancelRadius: LaunchCancelRadius,
    screenDistancePixels: host.LastAimScreenDistancePixels,
  })) {
    cancelAimedLaunch();
    PointerEventData.preventDefault();
    return;
  }

  releaseAimedLaunch();
  host.PointerGestureMode = SurfaceGestureModes.pending;
  PointerEventData.preventDefault();
}

function handlePointerCancel(PointerEventData) {
  forgetPointerLocation(PointerEventData);
  if (host.PinchState && PointerByIdentifier.size < 2) {
    host.PinchState = null;
  }
  if (PointerEventData.pointerId !== host.ActivePointerIdentifier) return;
  if (GameCanvas.hasPointerCapture(PointerEventData.pointerId)) {
    GameCanvas.releasePointerCapture(PointerEventData.pointerId);
  }
  if (host.IsCageBreaking || CageBreakClampId !== null) {
    finishArmedCageTap();
    PointerEventData.preventDefault();
    return;
  }
  if (host.IsCutAiming) {
    cancelCutAim();
    return;
  }
  if (host.IsBurnAiming) {
    cancelBurnAim();
    return;
  }
  const WasAiming = host.IsPointerAiming;
  host.IsPointerAiming = false;
  host.IsPointerWalking = false;
  host.IsPointerScouting = false;
  host.ActivePointerIdentifier = null;
  host.PointerGestureMode = SurfaceGestureModes.pending;
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting', 'is-ship-armed');
  releaseAimInteractionCamera();
  clearCommittedAimCamera();
  clearTrajectoryPreview();
  if (WasAiming) WorldseedSound.endAim();
  clearAimScreenDistance();
  if (
    !WasAiming
    && host.GamePhase === 'attached'
    && !showHostileEncounterInstruction()
  ) {
    showWalkFacingInstruction(getCurrentAttachedWorld());
  }
}

  return {
    getPointerWorldPosition,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleKeyboardAimKey,
    updateBreakerBurnInterface,
    requestBreakerAction,
    requestBreakerBurn,
    applyBreakerBurnAtCurrentStep,
    fireHostileCutFromPreview,
    fireNearestHostileCut,
    cancelCutAim,
    cancelAimedLaunch,
    beginKeyboardAim,
  };
}
