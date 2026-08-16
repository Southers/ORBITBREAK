/**
 * Compact spatial scanner for systems that intentionally span several views.
 * Owns the SVG marker elements and the world-to-scanner projection; the
 * Warden marker is positioned by warden-visuals via the shared projection.
 */

import { calculateBodyPositionAtTime } from './physics.js';
import { countLiveRelayWorlds } from './network.js';
import {
  getPublishedWardenState,
  getScannerAccessibleLabel,
} from './presentation.js';

export function createScanner(host) {
  const {
    GameCanvas,
    ScannerPanelElement,
    ScannerBodyLayerElement,
    ScannerRunnerElement,
    ActiveSystem,
    WorldDefinitions,
    WorldheartDefinition,
    AsteroidDefinition,
    getWorldDefinition,
  } = host;

  const ScannerWorldElements = new Map();
  let ScannerHazardElement = null;
  let ScannerCommandElement = null;
  let ScannerProjection = null;
  let LastScannerAccessibleLabel = '';

  function projectScannerPosition(Position) {
    const NormalizedX = (Position.x - ScannerProjection.minimumX) / ScannerProjection.width;
    const NormalizedY = (Position.y - ScannerProjection.minimumY) / ScannerProjection.height;
    return {
      x: 8 + (NormalizedX * 144),
      y: 82 - (NormalizedY * 74),
    };
  }

  /** Builds a compact spatial map only for systems that intentionally span several views. */
  function configureScannerInterface() {
    const UsesExplorationCamera = ActiveSystem.camera?.followPlayer === true;
    ScannerPanelElement.hidden = !UsesExplorationCamera;
    GameCanvas.dataset.scannerAvailable = String(UsesExplorationCamera);
    if (!UsesExplorationCamera) {
      return;
    }

    const BoundsPositions = [
      ...WorldDefinitions.map((WorldDefinition) => WorldDefinition.position),
      WorldheartDefinition.position,
    ];
    if (AsteroidDefinition.orbit) {
      const Orbit = AsteroidDefinition.orbit;
      BoundsPositions.push(
        { x: Orbit.centre.x - Orbit.radius, y: Orbit.centre.y - Orbit.radius },
        { x: Orbit.centre.x + Orbit.radius, y: Orbit.centre.y + Orbit.radius },
      );
    }
    if (WorldheartDefinition.orbit) {
      const Orbit = WorldheartDefinition.orbit;
      BoundsPositions.push(
        { x: Orbit.centre.x - Orbit.radius, y: Orbit.centre.y - Orbit.radius },
        { x: Orbit.centre.x + Orbit.radius, y: Orbit.centre.y + Orbit.radius },
      );
    }
    const Margin = 4;
    const MinimumX = Math.min(...BoundsPositions.map((Position) => Position.x)) - Margin;
    const MaximumX = Math.max(...BoundsPositions.map((Position) => Position.x)) + Margin;
    const MinimumY = Math.min(...BoundsPositions.map((Position) => Position.y)) - Margin;
    const MaximumY = Math.max(...BoundsPositions.map((Position) => Position.y)) + Margin;
    ScannerProjection = {
      minimumX: MinimumX,
      minimumY: MinimumY,
      width: MaximumX - MinimumX,
      height: MaximumY - MinimumY,
    };

    const SvgNamespace = 'http://www.w3.org/2000/svg';
    ScannerBodyLayerElement.replaceChildren();
    ScannerWorldElements.clear();
    for (const WorldDefinition of WorldDefinitions) {
      const Marker = document.createElementNS(SvgNamespace, 'circle');
      const MarkerPosition = projectScannerPosition(WorldDefinition.position);
      Marker.setAttribute('cx', String(MarkerPosition.x));
      Marker.setAttribute('cy', String(MarkerPosition.y));
      Marker.setAttribute('r', String(Math.max(2.2, WorldDefinition.radius * 0.85)));
      Marker.classList.add('scanner-world');
      Marker.dataset.bodyIdentifier = WorldDefinition.id;
      ScannerBodyLayerElement.append(Marker);
      ScannerWorldElements.set(WorldDefinition.id, Marker);
    }

    const CommandMarker = document.createElementNS(SvgNamespace, 'circle');
    const CommandPosition = projectScannerPosition(WorldheartDefinition.position);
    CommandMarker.setAttribute('cx', String(CommandPosition.x));
    CommandMarker.setAttribute('cy', String(CommandPosition.y));
    CommandMarker.setAttribute('r', '4');
    CommandMarker.classList.add('scanner-command');
    ScannerBodyLayerElement.append(CommandMarker);
    ScannerCommandElement = CommandMarker;

    ScannerHazardElement = document.createElementNS(SvgNamespace, 'circle');
    ScannerHazardElement.setAttribute('r', '2');
    ScannerHazardElement.classList.add('scanner-hazard');
    ScannerBodyLayerElement.append(ScannerHazardElement);
  }

  function updateScannerInterface() {
    if (!ScannerProjection) {
      return;
    }
    const RunnerPosition = projectScannerPosition(host.SeedPhysicsState.position);
    ScannerRunnerElement.setAttribute('cx', String(RunnerPosition.x));
    ScannerRunnerElement.setAttribute('cy', String(RunnerPosition.y));
    for (const WorldDefinition of WorldDefinitions) {
      ScannerWorldElements.get(WorldDefinition.id)?.classList.toggle(
        'is-restored',
        WorldDefinition.restored,
      );
    }
    const HazardPosition = projectScannerPosition(calculateBodyPositionAtTime(
      AsteroidDefinition,
      host.PhysicsElapsedTimeSeconds,
    ));
    ScannerHazardElement.setAttribute('cx', String(HazardPosition.x));
    ScannerHazardElement.setAttribute('cy', String(HazardPosition.y));
    const CommandPosition = projectScannerPosition(WorldheartDefinition.position);
    ScannerCommandElement?.setAttribute('cx', String(CommandPosition.x));
    ScannerCommandElement?.setAttribute('cy', String(CommandPosition.y));
    const CurrentWorld = getWorldDefinition(host.CurrentWorldIdentifier);
    const PublishedWardenState = getPublishedWardenState(
      host.WardenPursuitState.status,
      WorldheartDefinition.restored,
    );
    const WardenTarget = getWorldDefinition(host.WardenPursuitState.targetWorldIdentifier);
    const ScannerAccessibleLabel = getScannerAccessibleLabel({
      runnerLocation: host.GamePhase === 'flying'
        ? 'in flight'
        : `at ${CurrentWorld?.label ?? 'an unknown world'}`,
      activeWorldCount: countLiveRelayWorlds(host.RelayNetworkState),
      worldCount: WorldDefinitions.length,
      wardenStatus: PublishedWardenState.status,
      wardenDistance: host.WardenPursuitState.distance,
      wardenTargetLabel: WardenTarget?.label ?? '',
    });
    if (ScannerAccessibleLabel !== LastScannerAccessibleLabel) {
      ScannerPanelElement.setAttribute('aria-label', ScannerAccessibleLabel);
      LastScannerAccessibleLabel = ScannerAccessibleLabel;
    }
    GameCanvas.dataset.scannerRunnerX = RunnerPosition.x.toFixed(1);
    GameCanvas.dataset.scannerRunnerY = RunnerPosition.y.toFixed(1);
  }

  return {
    projectScannerPosition,
    configureScannerInterface,
    updateScannerInterface,
    get ScannerProjection() { return ScannerProjection; },
  };
}
