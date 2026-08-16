/**
 * Pointer, keyboard, pinch, cut and Breaker Burn input.
 * Aim preview stays on the fixed physics step; this module only captures gestures.
 */

import {
  SurfaceGestureModes,
  adjustKeyboardAimState,
  createKeyboardAimState,
  findNearestKeyboardAimAngle,
  getKeyboardAimDragVector,
  getPinchZoomScale,
  getPointerClientDistance,
  shouldCancelAimedLaunch,
} from './controls.js';
import {
  getHostileEncounterAngularDistance,
  getHostileEncounterMoveDirection,
  getNearestClampCut,
  getRemainingClamps,
  resolveHostileCut,
} from './encounter.js';
import {
  applyBreakerBurn,
  createVector,
  predictTrajectory,
} from './physics.js';
import { shouldAssistCommandLock } from './presentation.js';
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
    AimPanelElement,
    AimLabelElement,
    AimPowerFillElement,
    AimPowerValueElement,
    BurnButtonElement,
    SeedGroup,
    SeedPointerHitMesh,
    LaunchPulseMesh,
    ImpactPulseMesh,
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
    shouldUseSectorPlanningCamera,
    getActiveMaximumScoutZoomScale,
    refreshPlanningZoomControls,
    resizeRenderer,
    setScoutMode,
    getCurrentAttachedWorld,
    setRunnerSurfaceAngle,
    moveRunnerAroundSurface,
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
    completeWorldheartLiberation,
    flushQueuedStoryBoardsIfReady,
    updateLaunchCounter,
    captureCommittedLaunchPrediction,
    captureAimInteractionCamera,
    releaseAimInteractionCamera,
    applySectorPlanningCamera,
    snapLiveCameraToPlanningView,
    clearTrajectoryPreview,
    updateAimPreview,
    updateKeyboardAimPreview,
    getCurrentRouteChoices,
    predictCurrentLaunchTrajectory,
    getActiveTacticalBodyDefinitions,
    renderTrajectoryLine,
    getCurrentCutHitIds,
    MinimumScoutZoomScale,
  } = host;

/**
 * Converts pointer coordinates into the XY orbital plane.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 * @returns {THREE.Vector3|null} Intersection position or null if the ray misses the plane.
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
  const IntersectionResult = PointerRaycaster.ray.intersectPlane(OrbitalPlane, PointerWorldPosition);
  return IntersectionResult ? PointerWorldPosition : null;
}

/**
 * Returns true when the supplied pointer begins close enough to the visible seed.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 * @returns {boolean} Whether the user acquired the seed.
 */
const SeedScreenProjection = new THREE.Vector3();
const SeedScreenGrabRadiusPixels = 44;

function isPointerOverSeed(PointerEventData) {
  const CanvasBounds = GameCanvas.getBoundingClientRect();
  PointerNormalizedDeviceCoordinates.x = (
    ((PointerEventData.clientX - CanvasBounds.left) / CanvasBounds.width) * 2
  ) - 1;
  PointerNormalizedDeviceCoordinates.y = -(
    ((PointerEventData.clientY - CanvasBounds.top) / CanvasBounds.height) * 2
  ) + 1;
  PointerRaycaster.setFromCamera(PointerNormalizedDeviceCoordinates, Camera);

  if (PointerRaycaster.intersectObject(SeedPointerHitMesh, false).length > 0) {
    return true;
  }
  // A constant screen-space target keeps the ship acquirable at any zoom level.
  SeedScreenProjection.copy(SeedGroup.position).project(Camera);
  const SeedScreenX = CanvasBounds.left + (((SeedScreenProjection.x + 1) / 2) * CanvasBounds.width);
  const SeedScreenY = CanvasBounds.top + (((1 - SeedScreenProjection.y) / 2) * CanvasBounds.height);
  return Math.hypot(
    PointerEventData.clientX - SeedScreenX,
    PointerEventData.clientY - SeedScreenY,
  ) <= SeedScreenGrabRadiusPixels;
}

function isPointerOverAttachedWorld(WorldPosition) {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !WorldPosition) {
    return false;
  }
  const Distance = Math.hypot(
    WorldPosition.x - AttachedWorld.position.x,
    WorldPosition.y - AttachedWorld.position.y,
  );
  return Distance <= AttachedWorld.radius + 0.45;
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
      minimumScale: MinimumScoutZoomScale,
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
    || host.ActiveHostileEncounterState !== null
    || host.RunState.status !== 'active'
    || host.ReplayPlaybackState !== null
    || host.IsPointerAiming
    || host.IsKeyboardAiming
  ) {
    return false;
  }

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
  host.IsKeyboardAiming = true;
  CameraPanOffset.set(0, 0, 0);
  host.AimZoomScale = 1;
  WorldseedSound.beginAim();
  GameCanvas.classList.add('is-aiming');
  PullGuideLine.visible = false;
  AimPanelElement.hidden = false;
  updateKeyboardAimPreview();
  snapLiveCameraToPlanningView();
  refreshPlanningZoomControls();
  showInstruction(
    'Keyboard aim ready',
    'Left/right steer · up/down set power · pinch or wheel to zoom the map · Enter launches.',
  );
  return true;
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
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting');
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  GameCanvas.dataset.keyboardAimAngle = '';
  GameCanvas.dataset.keyboardAimPower = '';
  GameCanvas.dataset.keyboardAimAssist = '';
  releaseAimInteractionCamera();
  clearTrajectoryPreview();
  if (WasAiming) WorldseedSound.endAim();
  if (WasAiming && announce) showStatusToast('LAUNCH CANCELED', 700);
  if (WasAiming) showRouteChoiceInstruction();
  refreshPlanningZoomControls();
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
  if (host.IsOpeningBriefingActive) {
    return false;
  }
  if (host.getActiveElement() !== GameCanvas) {
    return false;
  }

  const PressedKey = KeyboardEventData.key.toLowerCase();
  if (
    !host.IsKeyboardAiming
    && (PressedKey === 'q' || PressedKey === 'e')
    && host.GamePhase === 'attached'
    && host.ReplayPlaybackState === null
  ) {
    KeyboardEventData.preventDefault();
    setScoutMode(false);
    const DidMove = moveRunnerAroundSurface(
      PressedKey === 'q' ? 1 : -1,
      KeyboardEventData.shiftKey,
    );
    if (DidMove) {
      host.RunnerWalkLifeSeconds = 0.34;
    }
    if (DidMove && !host.ActiveHostileEncounterState) {
      showInstruction(
        'Launch point moved',
        'Q/E walk · Shift makes fine steps · arrows aim · Enter launches.',
      );
    }
    return DidMove;
  }
  const IsLaunchKey = PressedKey === 'enter' || PressedKey === ' ';
  const RotationDirection = PressedKey === 'arrowleft' || PressedKey === 'a'
    ? 1
    : (PressedKey === 'arrowright' || PressedKey === 'd' ? -1 : 0);
  const PowerDirection = PressedKey === 'arrowup' || PressedKey === 'w'
    ? 1
    : (PressedKey === 'arrowdown' || PressedKey === 's' ? -1 : 0);

  if (PressedKey === 'escape' && (
    host.IsKeyboardAiming || host.IsPointerAiming || host.IsBurnAiming || host.IsCutAiming
  )) {
    KeyboardEventData.preventDefault();
    if (host.IsCutAiming) {
      cancelCutAim();
    } else if (host.IsBurnAiming) {
      cancelBurnAim();
    } else {
      cancelAimedLaunch();
    }
    return true;
  }
  if (host.ActiveHostileEncounterState && host.GamePhase === 'attached') {
    if (!IsLaunchKey && RotationDirection === 0 && PowerDirection === 0) {
      return false;
    }
    KeyboardEventData.preventDefault();
    if (IsLaunchKey) {
      if (KeyboardEventData.repeat) return true;
      if (host.IsCutAiming) fireHostileCutFromPreview();
      else fireNearestHostileCut();
      return true;
    }
    const AttachedWorld = getCurrentAttachedWorld();
    const Origin = getShipCutOrigin();
    const BasisPointer = host.CutAimPointer ?? (
      AttachedWorld
        ? getNearestClampCut(
          host.ActiveHostileEncounterState,
          Origin,
          AttachedWorld,
          getRunnerSurfaceAngle(AttachedWorld),
        )?.end
        : null
    ) ?? { x: Origin.x + 1, y: Origin.y };
    host.KeyboardAimState = createKeyboardAimState({
      directionX: BasisPointer.x - Origin.x,
      directionY: BasisPointer.y - Origin.y,
      powerRatio: Math.min(
        1,
        Math.max(
          0.2,
          Math.hypot(BasisPointer.x - Origin.x, BasisPointer.y - Origin.y)
            / host.ActiveHostileEncounterState.maxCutLength,
        ),
      ),
    });
    host.IsCutAiming = true;
    GameCanvas.classList.add('is-aiming');
    AimPanelElement.hidden = false;
    host.KeyboardAimState = adjustKeyboardAimState(host.KeyboardAimState, {
      rotationDirection: RotationDirection,
      powerDirection: PowerDirection,
      fine: KeyboardEventData.shiftKey,
    });
    const Drag = getKeyboardAimDragVector(
      host.KeyboardAimState,
      host.ActiveHostileEncounterState.maxCutLength,
    );
    updateCutAimPreview({
      x: Origin.x + Drag.x,
      y: Origin.y + Drag.y,
    });
    return true;
  }
  if (!IsLaunchKey && RotationDirection === 0 && PowerDirection === 0) {
    return false;
  }
  if (IsLaunchKey && KeyboardEventData.repeat) {
    KeyboardEventData.preventDefault();
    return true;
  }
  if (!host.IsKeyboardAiming && !beginKeyboardAim()) {
    return false;
  }

  KeyboardEventData.preventDefault();
  if (IsLaunchKey) {
    if (host.IsKeyboardAiming) {
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
  host.IsCutAiming = true;
  host.CutAimPointer = { x: WorldPosition.x, y: WorldPosition.y };
  GameCanvas.classList.add('is-aiming');
  AimPanelElement.hidden = false;
  AimLabelElement.textContent = 'CUT';
  updateCutAimPreview(WorldPosition);
  return true;
}

function updateCutAimPreview(WorldPosition) {
  if (!host.IsCutAiming || !host.ActiveHostileEncounterState) return;
  host.CutAimPointer = { x: WorldPosition.x, y: WorldPosition.y };
  const Preview = getCurrentCutPreview();
  const WillCancel = Boolean(Preview?.willCancel);
  const HitCount = Preview && !WillCancel ? Preview.hits.length : 0;
  AimPanelElement.classList.toggle('is-cancel', WillCancel);
  AimLabelElement.textContent = WillCancel ? 'RELEASE TO CANCEL' : 'CUT';
  const PowerRatio = THREE.MathUtils.clamp(
    (Preview?.distance ?? 0) / host.ActiveHostileEncounterState.maxCutLength,
    0,
    1,
  );
  AimPowerFillElement.style.width = WillCancel ? '0%' : `${Math.round(PowerRatio * 100)}%`;
  AimPowerFillElement.style.transform = 'none';
  AimPowerValueElement.textContent = WillCancel
    ? 'CANCEL'
    : (HitCount > 0 ? `${HitCount} HIT` : 'MISS');
  publishHostileEncounterState();
  updateBreakerBurnInterface();
}

function cancelCutAim({ announce = true } = {}) {
  const WasAiming = host.IsCutAiming;
  host.IsCutAiming = false;
  host.CutAimPointer = null;
  host.ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming');
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  hideCutGuide();
  if (WasAiming && announce) showStatusToast('CUT CANCELED', 650);
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
  host.ActiveHostileEncounterState = Resolved.state;
  const LastHit = Resolved.hitIds.at(-1);
  const HitClamp = Resolved.state.clamps[LastHit];
  if (HitClamp) {
    const HitPosition = {
      x: AttachedWorld.position.x
        + (Math.cos(HitClamp.surfaceAngle) * (AttachedWorld.radius + 0.3)),
      y: AttachedWorld.position.y
        + (Math.sin(HitClamp.surfaceAngle) * (AttachedWorld.radius + 0.3)),
    };
    ImpactPulseMesh.material.color.set(0xffd678);
    ImpactPulseMesh.position.set(HitPosition.x, HitPosition.y, 0.28);
    ImpactPulseMesh.scale.setScalar(1.2);
    ImpactPulseMesh.visible = true;
    host.ImpactPulseLifeSeconds = 0.58;
  }
  WorldseedSound.impact(AttachedWorld.id);
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
    updateBreakerBurnInterface();
    showStatusToast('THE RIM IS CLEAR', 1350);
    showInstruction(
      `${AttachedWorld.label} can fly.`,
      'Grab the ship and launch. Drag empty space to look around.',
    );
    flushQueuedStoryBoardsIfReady();
    return true;
  }
  publishHostileEncounterState();
  updateBreakerBurnInterface();
  const RemainingCount = getRemainingClamps(Resolved.state).length;
  showStatusToast(
    Resolved.hitIds.length > 1
      ? `${Resolved.hitIds.length} CLAMPS GONE`
      : 'CLAMP GONE',
    900,
  );
  showInstruction(
    `${RemainingCount} left on ${AttachedWorld.label}.`,
    RemainingCount === 1
      ? 'One tooth remains. Drag through it.'
      : 'A longer drag can take more than one.',
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
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  hideCutGuide();
  return applyHostileCut(Preview.origin, Preview.end);
}

function releaseCutAim() {
  return fireHostileCutFromPreview();
}

function fireNearestHostileCut() {
  const AttachedWorld = getCurrentAttachedWorld();
  if (!AttachedWorld || !host.ActiveHostileEncounterState) return false;
  host.CutAimPointer = null;
  let Preview = getCurrentCutPreview();
  if (!Preview || Preview.hits.length < 1) {
    // Out of reach: each tap walks the rim toward the nearest clamp so the
    // one-pointer CUT button can never feel like a soft-lock.
    const RunnerAngle = getRunnerSurfaceAngle(AttachedWorld);
    const MoveDirection = getHostileEncounterMoveDirection(
      host.ActiveHostileEncounterState,
      RunnerAngle,
    );
    const AngularDistance = getHostileEncounterAngularDistance(
      host.ActiveHostileEncounterState,
      RunnerAngle,
    );
    const StepRadians = Math.min(0.35, Math.max(0, AngularDistance - 0.45));
    if (MoveDirection !== 0 && StepRadians > 0.001) {
      setRunnerSurfaceAngle(RunnerAngle + (MoveDirection * StepRadians), 'keyboard');
      Preview = getCurrentCutPreview();
    }
    if (!Preview || Preview.hits.length < 1) {
      showStatusToast(
        MoveDirection !== 0 ? 'WALKING TO THE CLAMP · CUT AGAIN' : 'TOO FAR',
        950,
      );
      showHostileEncounterInstruction();
      return false;
    }
  }
  return applyHostileCut(Preview.origin, Preview.end);
}

function beginBurnAim(WorldPosition) {
  host.IsBurnAiming = true;
  host.BurnAimDirection = {
    x: WorldPosition.x - host.SeedPhysicsState.position.x,
    y: WorldPosition.y - host.SeedPhysicsState.position.y,
  };
  GameCanvas.classList.add('is-aiming');
  AimPanelElement.hidden = false;
  AimLabelElement.textContent = 'BREAK';
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
  });
  AimPanelElement.classList.toggle('is-cancel', WillCancel);
  AimLabelElement.textContent = WillCancel ? 'RELEASE TO CANCEL' : 'BREAK';
  const PowerRatio = THREE.MathUtils.clamp(Distance / MaximumDragDistance, 0, 1);
  AimPowerFillElement.style.width = WillCancel ? '0%' : `${Math.round(PowerRatio * 100)}%`;
  AimPowerFillElement.style.transform = 'none';
  AimPowerValueElement.textContent = WillCancel ? 'CANCEL' : `${Math.round(PowerRatio * 100)}%`;
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
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  clearTrajectoryPreview();
  if (announce) showStatusToast('BREAK CANCELED', 650);
}

function releaseBurnAim() {
  const Direction = host.BurnAimDirection;
  const Distance = Math.hypot(Direction?.x ?? 0, Direction?.y ?? 0);
  const WillCancel = shouldCancelAimedLaunch({
    pointerDistanceFromShip: Distance,
    cancelRadius: LaunchCancelRadius,
  });
  host.IsBurnAiming = false;
  host.ActivePointerIdentifier = null;
  GameCanvas.classList.remove('is-aiming');
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  clearTrajectoryPreview();
  if (WillCancel || !Direction) {
    host.BurnAimDirection = null;
    showStatusToast('BREAK CANCELED', 650);
    return false;
  }
  host.BurnAimDirection = Direction;
  return requestBreakerBurn();
}

/**
 * Begins a slingshot drag when the seed is attached and the pointer acquired it.
 *
 * @param {PointerEvent} PointerEventData - Browser pointer event.
 */
function handlePointerDown(PointerEventData) {
  if (host.IsOpeningBriefingActive) {
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
  if (isPointerOverSeed(PointerEventData) && host.ActiveHostileEncounterState) {
    setScoutMode(false);
    host.PointerGestureMode = SurfaceGestureModes.aim;
    beginCutAim(CurrentPointerWorldPosition);
    PointerEventData.preventDefault();
    return;
  }

  if (isPointerOverSeed(PointerEventData) && !host.ActiveHostileEncounterState) {
    setScoutMode(false);
    host.PointerGestureMode = SurfaceGestureModes.aim;
    PointerGestureStartWorldPosition.copy(CurrentPointerWorldPosition);
    LastAimPointerWorldPosition.copy(CurrentPointerWorldPosition);
    captureAimInteractionCamera();
    CameraPanOffset.set(0, 0, 0);
    host.AimZoomScale = 1;
    host.IsPointerAiming = true;
    WorldseedSound.beginAim();
    GameCanvas.classList.add('is-aiming');
    AimPanelElement.hidden = false;
    updateAimPreview(CurrentPointerWorldPosition);
    snapLiveCameraToPlanningView();
    refreshPlanningZoomControls();
    PointerEventData.preventDefault();
    return;
  }

  if (isPointerOverAttachedWorld(CurrentPointerWorldPosition)) {
    setScoutMode(false);
    host.PointerGestureMode = SurfaceGestureModes.walk;
    host.IsPointerWalking = true;
    GameCanvas.classList.add('is-walking');
    const AttachedWorld = getCurrentAttachedWorld();
    if (!showHostileEncounterInstruction()) {
      showInstruction(
        `Walking around ${AttachedWorld.label}`,
        'Trace the rim to choose a launch point. Grab the ship to aim. Drag empty space to pan. Pinch or wheel to zoom.',
      );
    }
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
    GameCanvas.classList.toggle(
      'is-grab-ready',
      CanGrabSeed
      && host.ReplayPlaybackState === null
      && !host.IsOpeningBriefingActive
      && isPointerOverSeed(PointerEventData),
    );
  }
  if (PointerEventData.pointerId !== host.ActivePointerIdentifier) {
    return;
  }

  const CurrentPointerWorldPosition = getPointerWorldPosition(
    PointerEventData,
    (host.IsPointerAiming && host.AimInteractionCamera) ? host.AimInteractionCamera : Camera,
  );
  if (!CurrentPointerWorldPosition) {
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
    const AttachedWorld = getCurrentAttachedWorld();
    const SurfaceAngle = Math.atan2(
      CurrentPointerWorldPosition.y - AttachedWorld.position.y,
      CurrentPointerWorldPosition.x - AttachedWorld.position.x,
    );
    setRunnerSurfaceAngle(SurfaceAngle);
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
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting');
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  releaseAimInteractionCamera();

  if (AimDragVector.length() < MinimumLaunchDragDistance) {
    clearTrajectoryPreview();
    WorldseedSound.endAim();
    showInstruction('Aim the Runner', 'Drag, or use the arrow keys and press Enter to launch.');
    return false;
  }

  applySectorPlanningCamera();

  host.RunState = releaseRunLaunch(host.RunState);
  updateLaunchCounter();
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
  host.IsBreakerBurnAvailable = true;
  host.IsBreakerBurnPending = false;
  updateBreakerBurnInterface();
  host.HasLaunchedOnce = true;
  captureCommittedLaunchPrediction(AimLaunchVelocity);
  refreshPlanningZoomControls();
  LaunchPulseMesh.position.copy(SeedGroup.position);
  LaunchPulseMesh.scale.setScalar(1);
  LaunchPulseMesh.visible = true;
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
      'Break ready',
      'Drag from the ship to break your line any direction. Drag back onto it, or press Escape, to cancel.',
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
  const PreviewHitCount = IsHostileCut ? getCurrentCutHitIds().length : 0;
  if (IsHostileCut) publishHostileEncounterState();
  BurnButtonElement.hidden = host.GamePhase !== 'flying' && !IsHostileCut;
  BurnButtonElement.classList.toggle('is-pulse', IsHostileCut);
  BurnButtonElement.classList.toggle(
    'is-spent',
    IsHostileCut ? RemainingCount < 1 : !host.IsBreakerBurnAvailable,
  );
  BurnButtonElement.disabled = IsHostileCut ? RemainingCount < 1 : !host.IsBreakerBurnAvailable;
  BurnButtonElement.querySelector('span').textContent = IsHostileCut ? 'CUT' : 'BREAK';
  BurnButtonElement.querySelector('strong').textContent = IsHostileCut
    ? (PreviewHitCount > 0 ? `${PreviewHitCount} HIT` : `${RemainingCount} LEFT`)
    : host.IsBreakerBurnAvailable
      ? (host.IsBreakerBurnPending ? 'ARMED' : 'READY')
      : 'SPENT';
  BurnButtonElement.setAttribute(
    'aria-label',
    IsHostileCut
      ? `Cut ${RemainingCount} clamp${RemainingCount === 1 ? '' : 's'} remaining`
      : `Break ${host.IsBreakerBurnAvailable ? 'ready' : 'spent'}`,
  );
  GameCanvas.dataset.breakerBurn = host.GamePhase !== 'flying'
    ? 'stowed'
    : (host.IsBreakerBurnAvailable ? (host.IsBreakerBurnPending ? 'armed' : 'ready') : 'spent');
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
  host.SeedPhysicsState = applyBreakerBurn(host.SeedPhysicsState, undefined, host.BurnAimDirection);
  host.IsBreakerBurnAvailable = false;
  host.IsBreakerBurnPending = false;
  host.CommittedPredictionPoints = null;
  GameCanvas.dataset.predictionHoldActive = 'false';
  if (record) {
    host.ReplayState = recordReplayBurn(host.ReplayState, {
      stepIndex: Math.round(host.PhysicsElapsedTimeSeconds * FixedPhysicsStepHertz),
      directionX: host.BurnAimDirection?.x ?? null,
      directionY: host.BurnAimDirection?.y ?? null,
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
  host.LaunchPulseLifeSeconds = 0.5;
  showStatusToast('BREAK', 650);
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
    GameCanvas.classList.remove('is-walking');
    if (!showHostileEncounterInstruction()) showRouteChoiceInstruction();
    PointerEventData.preventDefault();
    return;
  }

  if (!host.IsPointerAiming) {
    host.ActivePointerIdentifier = null;
    host.PointerGestureMode = SurfaceGestureModes.pending;
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
  GameCanvas.classList.remove('is-aiming', 'is-walking', 'is-scouting');
  AimPanelElement.hidden = true;
  AimPanelElement.classList.remove('is-cancel');
  releaseAimInteractionCamera();
  clearTrajectoryPreview();
  if (WasAiming) WorldseedSound.endAim();
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
