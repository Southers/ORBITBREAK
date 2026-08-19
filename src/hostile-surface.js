/**
 * Hostile-surface presentation and runner surface movement.
 * Owns the cut preview/guide, clamp pylon refresh, encounter lifecycle and
 * great-circle walking. Cut resolution physics stays in encounter.js; this
 * module only reads deterministic state and presents it.
 */

import {
  adjustSurfacePose,
  createSurfacePose,
  flattenSurfacePoseToEquator,
  getSphereSurfacePosition,
  getSurfacePoseFromPosition,
  shouldCancelAimedLaunch,
} from './controls.js';
import {
  createHostileEncounterState,
  getCutEndPoint,
  getCutHits,
  getCutMaxLength,
  getHostileEncounterAngularDistance,
  getHostileEncounterMoveDirection,
  getNearestClampCut,
  getRemainingClamps,
} from './encounter.js?v=20260819-ob126';
import { createVector } from './physics.js';
import { calculateSurfaceRestPosition as calculateSharedSurfaceRestPosition } from './flight-resolver.js';

export function createHostileSurface(THREE, host) {
  const {
    GameCanvas,
    SeedGroup,
    SeedRadius,
    LaunchCancelRadius,
    ActiveSystem,
    WorldheartDefinition,
    CutGuideLine,
    CutGuideGeometry,
    CutGuideMaterial,
    HostilePylonGroup,
    CompletedHostileEncounterWorldIdentifiers,
    positionHostilePylons,
    getWorldDefinition,
    publishAttachedSeedState,
    showInstruction,
    clearTrajectoryPreview,
    cancelCutAim,
    updateBreakerBurnInterface,
  } = host;

  function calculateSurfaceRestPosition(WorldDefinition, ImpactPosition, BodyPosition = WorldDefinition.position) {
    return calculateSharedSurfaceRestPosition(WorldDefinition, ImpactPosition, BodyPosition);
  }

  function getCurrentAttachedWorld() {
    if (host.GamePhase !== 'attached') return null;
    return host.CurrentWorldIdentifier === WorldheartDefinition.id
      ? WorldheartDefinition
      : getWorldDefinition(host.CurrentWorldIdentifier);
  }

  function getRunnerSurfacePose(WorldDefinition) {
    const Pose = getSurfacePoseFromPosition(WorldDefinition.position, host.SeedPhysicsState.position);
    return createSurfacePose({
      longitude: Pose.longitude,
      latitude: Pose.latitude,
      meridianSign: host.AttachedSurfaceMeridianSign ?? 1,
    });
  }

  function getRunnerSurfaceAngle(WorldDefinition) {
    return getRunnerSurfacePose(WorldDefinition).longitude;
  }

  function getShipCutOrigin() {
    return {
      x: host.SeedPhysicsState.position.x,
      y: host.SeedPhysicsState.position.y,
    };
  }

  function getCurrentCutPreview() {
    if (!host.ActiveHostileEncounterState) return null;
    const AttachedWorld = getCurrentAttachedWorld();
    if (!AttachedWorld) return null;
    const Origin = getShipCutOrigin();
    const CutAimPointer = host.CutAimPointer;
    if (CutAimPointer) {
      const End = getCutEndPoint(
        Origin,
        CutAimPointer,
        getCutMaxLength(AttachedWorld, host.ActiveHostileEncounterState.maxCutLength),
      );
      const Distance = Math.hypot(CutAimPointer.x - Origin.x, CutAimPointer.y - Origin.y);
      return {
        origin: Origin,
        end: End,
        distance: Distance,
        willCancel: shouldCancelAimedLaunch({
          pointerDistanceFromShip: Distance,
          cancelRadius: LaunchCancelRadius,
          screenDistancePixels: host.LastAimScreenDistancePixels,
        }),
        hits: getCutHits(host.ActiveHostileEncounterState, Origin, End, AttachedWorld),
      };
    }
    const RunnerSurfaceAngle = getRunnerSurfaceAngle(AttachedWorld);
    const AutoCut = getNearestClampCut(
      host.ActiveHostileEncounterState,
      Origin,
      AttachedWorld,
      RunnerSurfaceAngle,
    );
    return AutoCut
      ? {
        origin: AutoCut.origin,
        end: AutoCut.end,
        distance: Math.hypot(AutoCut.end.x - Origin.x, AutoCut.end.y - Origin.y),
        willCancel: false,
        hits: AutoCut.hits,
      }
      : null;
  }

  function getCurrentCutHitIds() {
    const Preview = getCurrentCutPreview();
    if (!Preview || Preview.willCancel) return [];
    return Preview.hits.map((Hit) => Hit.id);
  }

  function hideCutGuide() {
    CutGuideLine.visible = false;
    HostilePylonGroup.userData.hideCutSlash?.();
  }

  function renderCutGuide(Preview) {
    if (!Preview || Preview.willCancel) {
      hideCutGuide();
      return;
    }
    CutGuideGeometry.setFromPoints([
      new THREE.Vector3(Preview.origin.x, Preview.origin.y, 0.28),
      new THREE.Vector3(Preview.end.x, Preview.end.y, 0.28),
    ]);
    CutGuideLine.computeLineDistances();
    CutGuideMaterial.color.setHex(Preview.hits.length > 0 ? 0xffd678 : 0xffe7d2);
    CutGuideMaterial.opacity = Preview.hits.length > 0 ? 0.2 : 0.12;
    CutGuideLine.visible = false;
    if (typeof HostilePylonGroup.userData.placeCutSlash === 'function') {
      HostilePylonGroup.userData.placeCutSlash(
        Preview.origin,
        Preview.end,
        Preview.hits.length > 0,
      );
    }
  }

  function refreshHostileClampVisuals() {
    const AttachedWorld = getCurrentAttachedWorld();
    if (!AttachedWorld || !host.ActiveHostileEncounterState) {
      hideCutGuide();
      HostilePylonGroup.visible = false;
      return;
    }
    const Preview = getCurrentCutPreview();
    positionHostilePylons(
      AttachedWorld,
      host.ActiveHostileEncounterState,
      Preview && !Preview.willCancel ? Preview.hits.map((Hit) => Hit.id) : [],
    );
    if (host.IsCutAiming) {
      renderCutGuide(Preview);
    } else {
      hideCutGuide();
    }
  }

  function publishHostileEncounterState() {
    const Preview = getCurrentCutPreview();
    const RemainingCount = host.ActiveHostileEncounterState
      ? getRemainingClamps(host.ActiveHostileEncounterState).length
      : 0;
    const CutReady = Boolean(Preview && Preview.hits.length > 0 && !Preview.willCancel);
    GameCanvas.dataset.hostileEncounter = host.ActiveHostileEncounterState?.worldIdentifier ?? '';
    GameCanvas.dataset.hostilePulseReady = String(CutReady);
    GameCanvas.dataset.hostileClampCount = String(RemainingCount);
    GameCanvas.dataset.hostilePylonAngle = host.ActiveHostileEncounterState
      ? (getRemainingClamps(host.ActiveHostileEncounterState)[0]?.surfaceAngle ?? 0).toFixed(4)
      : '';
    refreshHostileClampVisuals();
    return CutReady;
  }

  function showHostileEncounterInstruction() {
    const AttachedWorld = getCurrentAttachedWorld();
    if (!AttachedWorld || !host.ActiveHostileEncounterState) return false;
    const IsCommandApproach = AttachedWorld.kind === 'worldheart';
    const RemainingCount = getRemainingClamps(host.ActiveHostileEncounterState).length;
    const CommandApproachTitle = ActiveSystem.commandApproachLine
      ?? 'The lattice is open.';
    const RunnerSurfaceAngle = getRunnerSurfaceAngle(AttachedWorld);
    const MoveKey = getHostileEncounterMoveDirection(
      host.ActiveHostileEncounterState,
      RunnerSurfaceAngle,
    ) > 0 ? 'Q' : 'E';
    const DistanceDegrees = Math.round(THREE.MathUtils.radToDeg(
      getHostileEncounterAngularDistance(host.ActiveHostileEncounterState, RunnerSurfaceAngle),
    ));
    if (IsCommandApproach) {
      showInstruction(
        CommandApproachTitle,
        RemainingCount === 3
          ? 'Tap the cage to break it. Pull the ship to fly.'
          : `${RemainingCount} left. Tap a cage.`,
      );
    } else if (RemainingCount === host.ActiveHostileEncounterState.clamps.length
      && RemainingCount === 1) {
      showInstruction(
        `${AttachedWorld.label} has one leftover cage.`,
        'Tap the cage to break it. Pull the ship to fly.',
      );
    } else if (RemainingCount === 3) {
      showInstruction(
        `${AttachedWorld.label} still has cages.`,
        'Tap the cage. Pull the ship to fly.',
      );
    } else {
      showInstruction(
        `${RemainingCount} clamp${RemainingCount === 1 ? '' : 's'} left on ${AttachedWorld.label}.`,
        DistanceDegrees > 18
          ? `Walk ${MoveKey} toward the next one, then tap the cage.`
          : 'Tap each cage. Walk the globe if one sits on the far face.',
      );
    }
    return true;
  }

  function beginHostileEncounter(WorldDefinition, EncounterDefinition = WorldDefinition.hostileEncounter) {
    if (
      host.ReplayPlaybackState !== null
      || !EncounterDefinition
      || CompletedHostileEncounterWorldIdentifiers.has(WorldDefinition.id)
    ) {
      return false;
    }
    cancelCutAim({ announce: false });
    host.ActiveHostileEncounterState = createHostileEncounterState({
      worldIdentifier: WorldDefinition.id,
      runnerSurfaceAngle: getRunnerSurfaceAngle(WorldDefinition),
      ...EncounterDefinition,
    });
    host.IsKeyboardAiming = false;
    host.IsPointerAiming = false;
    GameCanvas.classList.remove('is-aiming');
    GameCanvas.dataset.keyboardAimAngle = '';
    GameCanvas.dataset.keyboardAimPower = '';
    GameCanvas.dataset.keyboardAimAssist = '';
    clearTrajectoryPreview();
    publishHostileEncounterState();
    updateBreakerBurnInterface();
    showHostileEncounterInstruction();
    return true;
  }

  /** Repositions the Runner on the world's sphere without spending a launch. */
  function setRunnerSurfacePose(Pose, InputKind = 'pointer') {
    const AttachedWorld = getCurrentAttachedWorld();
    if (!AttachedWorld || host.ReplayPlaybackState !== null) return false;
    const NormalizedPose = createSurfacePose(Pose);
    const SurfacePosition = getSphereSurfacePosition(
      AttachedWorld.position,
      AttachedWorld.radius + SeedRadius + 0.03,
      NormalizedPose,
    );
    host.SeedPhysicsState.position = createVector(
      SurfacePosition.x,
      SurfacePosition.y,
      SurfacePosition.z,
    );
    host.SeedPhysicsState.velocity = createVector();
    SeedGroup.position.set(SurfacePosition.x, SurfacePosition.y, SurfacePosition.z);
    host.LastSafeWorldIdentifier = host.CurrentWorldIdentifier;
    host.LastSafeSeedPosition = createVector(SurfacePosition.x, SurfacePosition.y, SurfacePosition.z);
    host.AttachedSurfaceMeridianSign = NormalizedPose.meridianSign;
    if (host.CurrentWorldIdentifier === WorldheartDefinition.id) {
      host.AttachedWorldheartSurfaceAngle = NormalizedPose.longitude;
      host.AttachedWorldheartSurfaceLatitude = NormalizedPose.latitude;
    }
    publishAttachedSeedState(host.CurrentWorldIdentifier, SurfacePosition);
    GameCanvas.dataset.surfaceAngle = NormalizedPose.longitude.toFixed(4);
    GameCanvas.dataset.surfaceLatitude = NormalizedPose.latitude.toFixed(4);
    GameCanvas.dataset.surfaceMeridianSign = String(NormalizedPose.meridianSign);
    GameCanvas.dataset.surfaceInput = InputKind;
    if (host.ActiveHostileEncounterState) {
      publishHostileEncounterState();
      updateBreakerBurnInterface();
      showHostileEncounterInstruction();
    }
    return true;
  }

  function setRunnerSurfaceAngle(AngleRadians, InputKind = 'pointer') {
    const AttachedWorld = getCurrentAttachedWorld();
    if (!AttachedWorld) return false;
    const CurrentPose = getRunnerSurfacePose(AttachedWorld);
    return setRunnerSurfacePose({
      longitude: AngleRadians,
      latitude: CurrentPose.latitude,
      meridianSign: CurrentPose.meridianSign,
    }, InputKind);
  }

  function flattenRunnerToEquator(InputKind = 'pointer') {
    const AttachedWorld = getCurrentAttachedWorld();
    if (!AttachedWorld) return false;
    return setRunnerSurfacePose(
      flattenSurfacePoseToEquator(getRunnerSurfacePose(AttachedWorld)),
      InputKind,
    );
  }

  function moveRunnerAroundSurface(Direction, Fine = false) {
    return moveRunnerOnSurface({ east: Direction, fine: Fine });
  }

  function moveRunnerOnSurface({ east = 0, north = 0, fine = false, stepRadians } = {}) {
    const AttachedWorld = getCurrentAttachedWorld();
    if (!AttachedWorld) return false;
    if (east === 0 && north === 0) return false;
    return setRunnerSurfacePose(
      adjustSurfacePose(getRunnerSurfacePose(AttachedWorld), { east, north, fine, stepRadians }),
      'keyboard',
    );
  }

  return {
    calculateSurfaceRestPosition,
    getCurrentAttachedWorld,
    getRunnerSurfaceAngle,
    getRunnerSurfacePose,
    getShipCutOrigin,
    getCurrentCutPreview,
    getCurrentCutHitIds,
    hideCutGuide,
    renderCutGuide,
    refreshHostileClampVisuals,
    publishHostileEncounterState,
    showHostileEncounterInstruction,
    beginHostileEncounter,
    setRunnerSurfaceAngle,
    setRunnerSurfacePose,
    flattenRunnerToEquator,
    moveRunnerAroundSurface,
    moveRunnerOnSurface,
  };
}
