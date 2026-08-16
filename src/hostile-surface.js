/**
 * Hostile-surface presentation and runner surface movement.
 * Owns the cut preview/guide, clamp pylon refresh, encounter lifecycle and
 * great-circle walking. Cut resolution physics stays in encounter.js; this
 * module only reads deterministic state and presents it.
 */

import {
  adjustSurfaceAngle,
  getSurfacePosition,
  shouldCancelAimedLaunch,
} from './controls.js';
import {
  createHostileEncounterState,
  getCutEndPoint,
  getCutHits,
  getHostileEncounterAngularDistance,
  getHostileEncounterMoveDirection,
  getNearestClampCut,
  getRemainingClamps,
} from './encounter.js';
import { createVector } from './physics.js';
import { calculateSurfaceRestPosition as calculateSharedSurfaceRestPosition } from './flight-resolver.js';

export function createHostileSurface(THREE, host) {
  const {
    GameCanvas,
    AimPanelElement,
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

  function getRunnerSurfaceAngle(WorldDefinition) {
    return Math.atan2(
      host.SeedPhysicsState.position.y - WorldDefinition.position.y,
      host.SeedPhysicsState.position.x - WorldDefinition.position.x,
    );
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
        host.ActiveHostileEncounterState.maxCutLength,
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
    CutGuideMaterial.color.setHex(Preview.hits.length > 0 ? 0xffd678 : 0xff766d);
    CutGuideMaterial.opacity = Preview.hits.length > 0 ? 0.95 : 0.55;
    CutGuideLine.visible = true;
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
          ? 'Grab the ship and drag through a gold bar. Drag back onto it to cancel.'
          : `${RemainingCount} left. A longer drag can take more than one.`,
      );
    } else if (RemainingCount === host.ActiveHostileEncounterState.clamps.length
      && RemainingCount === 1) {
      showInstruction(
        `${AttachedWorld.label} has one leftover bar.`,
        'Grab the ship and drag through it. Destroy the cage.',
      );
    } else if (RemainingCount === 3) {
      showInstruction(
        `${AttachedWorld.label} still has bars.`,
        'Grab the ship and drag through a clamp. Walk with Q/E if destroy cannot reach.',
      );
    } else {
      showInstruction(
        `${RemainingCount} clamp${RemainingCount === 1 ? '' : 's'} left on ${AttachedWorld.label}.`,
        DistanceDegrees > 18
          ? `Walk ${MoveKey} toward the next one, then drag through it.`
          : 'A longer drag can take more than one.',
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
    AimPanelElement.hidden = true;
    GameCanvas.dataset.keyboardAimAngle = '';
    GameCanvas.dataset.keyboardAimPower = '';
    GameCanvas.dataset.keyboardAimAssist = '';
    clearTrajectoryPreview();
    publishHostileEncounterState();
    updateBreakerBurnInterface();
    showHostileEncounterInstruction();
    return true;
  }

  /** Repositions the Runner around a world's playable great-circle without spending a launch. */
  function setRunnerSurfaceAngle(AngleRadians, InputKind = 'pointer') {
    const AttachedWorld = getCurrentAttachedWorld();
    if (!AttachedWorld || host.ReplayPlaybackState !== null) return false;
    const SurfacePosition = getSurfacePosition(
      AttachedWorld.position,
      AttachedWorld.radius + SeedRadius + 0.03,
      AngleRadians,
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
    if (host.CurrentWorldIdentifier === WorldheartDefinition.id) {
      host.AttachedWorldheartSurfaceAngle = AngleRadians;
    }
    publishAttachedSeedState(host.CurrentWorldIdentifier, SurfacePosition);
    GameCanvas.dataset.surfaceAngle = AngleRadians.toFixed(4);
    GameCanvas.dataset.surfaceInput = InputKind;
    if (host.ActiveHostileEncounterState) {
      publishHostileEncounterState();
      updateBreakerBurnInterface();
      showHostileEncounterInstruction();
    }
    return true;
  }

  function moveRunnerAroundSurface(Direction, Fine = false) {
    const AttachedWorld = getCurrentAttachedWorld();
    if (!AttachedWorld) return false;
    const CurrentAngle = Math.atan2(
      host.SeedPhysicsState.position.y - AttachedWorld.position.y,
      host.SeedPhysicsState.position.x - AttachedWorld.position.x,
    );
    return setRunnerSurfaceAngle(
      adjustSurfaceAngle(CurrentAngle, Direction, { fine: Fine }),
      'keyboard',
    );
  }

  return {
    calculateSurfaceRestPosition,
    getCurrentAttachedWorld,
    getRunnerSurfaceAngle,
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
    moveRunnerAroundSurface,
  };
}
