/**
 * Compact spatial projection for systems that span several views.
 * The visual scanner HUD is gone; this still writes diagnostic datasets
 * used by tests and keeps a projection for optional tooling.
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
    ActiveSystem,
    WorldDefinitions,
    WorldheartDefinition,
    AsteroidDefinition,
    getWorldDefinition,
  } = host;

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
    GameCanvas.dataset.scannerAvailable = String(UsesExplorationCamera);
    if (!UsesExplorationCamera) {
      ScannerProjection = null;
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
  }

  function updateScannerInterface() {
    if (!ScannerProjection) {
      return;
    }
    const RunnerPosition = projectScannerPosition(host.SeedPhysicsState.position);
    GameCanvas.dataset.scannerRunnerX = RunnerPosition.x.toFixed(1);
    GameCanvas.dataset.scannerRunnerY = RunnerPosition.y.toFixed(1);
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
      LastScannerAccessibleLabel = ScannerAccessibleLabel;
      GameCanvas.dataset.scannerLabel = ScannerAccessibleLabel;
    }
  }

  return {
    projectScannerPosition,
    configureScannerInterface,
    updateScannerInterface,
    get ScannerProjection() { return ScannerProjection; },
  };
}
