/**
 * World-restoration presentation: the signature spherical liberation wave,
 * staged surface growth, atmosphere recolouring, stillness cages and the
 * range veil. Reads deterministic restoration timing from the fixed-step
 * simulation and drives only visuals plus the one-shot completion moment
 * (memory toast, hostile-encounter start, victory reveal).
 */

import { getLeftoverHostileEncounter } from './encounter.js';
import { countLiveRelayWorlds } from './network.js';
import {
  getRangeVeilStrength,
  getRelayRevealHoldDurationSeconds,
  getStillnessPresentation,
} from './presentation.js';
import {
  calculateRestorationWaveProgress,
  calculateStagedGrowthProgress,
} from './restoration.js';
import { WardenPursuitEvents } from './warden.js';

export function createRestorationVisuals(THREE, host) {
  const {
    GameCanvas,
    WorldDefinitions,
    WorldRuntimeByIdentifier,
    WorldseedSound,
    getSectorClusterRules,
    isLiveInnerCluster,
    setSurfacePropRestorationProgress,
    showStatusToast,
    hideInstruction,
    revealVictoryPanel,
    beginHostileEncounter,
    showRouteChoiceInstruction,
    flushQueuedStoryBoardsIfReady,
  } = host;

  const TyrantAtmosphereColor = new THREE.Color(0x5a2418);
  const AtmosphereRestoreColor = new THREE.Color();

  function applyRangeVeilToWorld(WorldRuntime, WorldDefinition, InnerClusterLive) {
    const VeilStrength = getRangeVeilStrength(
      WorldDefinition.id,
      InnerClusterLive,
      getSectorClusterRules(),
    );
    if (VeilStrength <= 0) {
      return 0;
    }
    WorldRuntime.stillnessCageGroup.visible = true;
    WorldRuntime.stillnessCageGroup.scale.setScalar(1.06 + (VeilStrength * 0.1));
    WorldRuntime.stillnessCageMaterial.opacity = WorldDefinition.restored
      ? 0.1 * VeilStrength
      : Math.max(WorldRuntime.stillnessCageMaterial.opacity, 0.36 * VeilStrength);
    if (WorldRuntime.atmosphereMaterial && Number.isFinite(WorldRuntime.atmosphereMaterial.opacity)) {
      WorldRuntime.atmosphereMaterial.opacity *= 1 - (0.62 * VeilStrength);
    }
    return VeilStrength;
  }

  /**
   * Advances the signature spherical restoration wave, staged surface growth and atmosphere.
   *
   * @param {number} ElapsedTimeSeconds - Total elapsed game time.
   */
  function updateWorldRestorationVisuals(ElapsedTimeSeconds) {
    const InnerClusterLive = isLiveInnerCluster();
    const VeiledWorldIdentifiers = [];
    GameCanvas.dataset.innerClusterLive = String(InnerClusterLive);
    for (const WorldDefinition of WorldDefinitions) {
      const WorldRuntime = WorldRuntimeByIdentifier.get(WorldDefinition.id);

      if (!WorldDefinition.restored) {
        WorldRuntime.group.rotation.y += 0.0005;
        WorldRuntime.stillnessCageGroup.rotation.y += 0.0015;
        if (WorldRuntime.atmosphereMaterial?.color) {
          WorldRuntime.atmosphereMaterial.color.copy(TyrantAtmosphereColor);
          WorldRuntime.atmosphereMaterial.opacity = 0.11;
        }
        if (applyRangeVeilToWorld(WorldRuntime, WorldDefinition, InnerClusterLive) > 0) {
          VeiledWorldIdentifiers.push(WorldDefinition.id);
        }
        continue;
      }

      const IsFullyRestoredAtStart = WorldRuntime.restorationStartedAtSeconds === -Infinity;
      const RestorationElapsedSeconds = IsFullyRestoredAtStart
        ? WorldDefinition.restoration.durationSeconds
        : Math.max(0, ElapsedTimeSeconds - WorldRuntime.restorationStartedAtSeconds);
      const LinearRestorationProgress = THREE.MathUtils.clamp(
        RestorationElapsedSeconds / WorldDefinition.restoration.durationSeconds,
        0,
        1,
      );
      const WaveProgress = calculateRestorationWaveProgress(LinearRestorationProgress);
      const ShaderWaveProgress = LinearRestorationProgress >= 1 ? 1.2 : WaveProgress;
      WorldRuntime.restorationUniforms.restorationProgress.value = ShaderWaveProgress;
      WorldRuntime.restorationWaveMesh.visible = LinearRestorationProgress < 1;
      const StillnessPresentation = getStillnessPresentation(
        true,
        LinearRestorationProgress,
      );
      WorldRuntime.stillnessCageGroup.visible = StillnessPresentation.visible;
      WorldRuntime.stillnessCageGroup.scale.setScalar(StillnessPresentation.scale);
      WorldRuntime.stillnessCageMaterial.opacity = StillnessPresentation.opacity;
      WorldRuntime.stillnessCageGroup.rotation.x += 0.0018 * (1 + LinearRestorationProgress);
      WorldRuntime.stillnessCageGroup.rotation.y += 0.0025 * (1 + LinearRestorationProgress);

      const AtmosphereLinearProgress = THREE.MathUtils.clamp(
        (LinearRestorationProgress - 0.12) / 0.76,
        0,
        1,
      );
      const AtmosphereProgress = 1 - Math.pow(1 - AtmosphereLinearProgress, 3);
      WorldRuntime.atmosphereMaterial.opacity = THREE.MathUtils.lerp(
        0.025,
        WorldDefinition.restoration.atmosphereOpacity,
        AtmosphereProgress,
      );
      if (WorldRuntime.atmosphereMaterial?.color) {
        AtmosphereRestoreColor.set(WorldDefinition.atmosphereColor);
        WorldRuntime.atmosphereMaterial.color.copy(TyrantAtmosphereColor).lerp(
          AtmosphereRestoreColor,
          AtmosphereProgress,
        );
      }
      WorldRuntime.atmosphereMesh.scale.setScalar(
        THREE.MathUtils.lerp(0.96, 1, AtmosphereProgress),
      );

      for (const SurfacePropObject of WorldRuntime.surfaceMarkerGroup.children) {
        const GrowthProgress = IsFullyRestoredAtStart
          ? 1
          : calculateStagedGrowthProgress(
            WaveProgress,
            SurfacePropObject.userData.restorationDistance,
            WorldDefinition.restoration.growthTrailWidth,
          );
        const GrowthScale = SurfacePropObject.userData.baseScale * Math.max(0.05, GrowthProgress);
        SurfacePropObject.scale.setScalar(GrowthScale);
        setSurfacePropRestorationProgress(SurfacePropObject, GrowthProgress);
      }

      if (LinearRestorationProgress < 1) {
        const PulseScale = 1 + (Math.sin(LinearRestorationProgress * Math.PI) * 0.045);
        WorldRuntime.group.scale.setScalar(PulseScale);
      } else {
        WorldRuntime.group.scale.setScalar(1);
        if (!WorldRuntime.restorationCompleted) {
          WorldRuntime.restorationCompleted = true;
          WorldseedSound.restorationComplete(WorldDefinition.id);
          if (host.CurrentWorldIdentifier === WorldDefinition.id) {
            const ShouldPreserveWardenReveal = (
              host.WardenPursuitState.lastEvent === WardenPursuitEvents.revealed
              && GameCanvas.dataset.wardenArrivalBroadcast !== ''
            );
            GameCanvas.dataset.lastMemory = WorldDefinition.memory;
            if (!ShouldPreserveWardenReveal) {
              showStatusToast(WorldDefinition.memory, 2100, 'memory');
            }
            if (host.WorldheartJustUnlocked) {
              host.WorldheartJustUnlocked = false;
              WorldseedSound.worldheartOpen();
            }
            if (host.GamePhase === 'victoryPending') {
              revealVictoryPanel();
              host.GamePhase = 'victory';
              WorldseedSound.victory();
              hideInstruction();
            } else if (host.GamePhase === 'restoring') {
              host.GamePhase = 'attached';
              if (host.PrefersReducedMotion || !host.RelayRevealLookTarget) {
                host.RelayRevealLookTarget = null;
                host.RelayRevealHoldUntilSeconds = 0;
                GameCanvas.dataset.relayReveal = '';
              } else {
                host.RelayRevealHoldUntilSeconds = ElapsedTimeSeconds
                  + getRelayRevealHoldDurationSeconds({
                    liveRelayCount: countLiveRelayWorlds(host.RelayNetworkState),
                    prefersReducedMotion: host.PrefersReducedMotion,
                  });
              }
              const EncounterDefinition = WorldDefinition.hostileEncounter
                ?? (
                  host.PendingRecaptureCutWorldIdentifier === WorldDefinition.id
                    ? getLeftoverHostileEncounter()
                    : null
                );
              const DidBeginHostileEncounter = beginHostileEncounter(
                WorldDefinition,
                EncounterDefinition,
              );
              if (DidBeginHostileEncounter
                && host.PendingRecaptureCutWorldIdentifier === WorldDefinition.id) {
                host.RecaptureCutGiftAvailable = false;
                host.PendingRecaptureCutWorldIdentifier = null;
                showStatusToast('RECAPTURE CUT', 1350);
              }
              if (!DidBeginHostileEncounter && !ShouldPreserveWardenReveal) {
                showRouteChoiceInstruction();
              }
              flushQueuedStoryBoardsIfReady();
            }
          }
        }
      }

      const MotionProgress = THREE.MathUtils.smoothstep(LinearRestorationProgress, 0.28, 0.92);
      WorldRuntime.group.rotation.y += THREE.MathUtils.lerp(
        0.0005,
        WorldDefinition.restoration.rotationSpeed,
        MotionProgress,
      );
      WorldRuntime.contourRingGroup.rotation.z += 0.0007 * MotionProgress;
      WorldRuntime.contourRingGroup.scale.setScalar(
        THREE.MathUtils.lerp(0.88, 1, AtmosphereProgress),
      );
      if (WorldRuntime.ambientMoteGroup) {
        WorldRuntime.ambientMoteGroup.material.opacity = (
          WorldRuntime.ambientMoteGroup.userData.baseOpacity * AtmosphereProgress
        );
      }
      if (applyRangeVeilToWorld(WorldRuntime, WorldDefinition, InnerClusterLive) > 0) {
        VeiledWorldIdentifiers.push(WorldDefinition.id);
      }
    }
    GameCanvas.dataset.rangeVeil = InnerClusterLive ? 'lifted' : VeiledWorldIdentifiers.join(',');
  }

  return {
    updateWorldRestorationVisuals,
  };
}
