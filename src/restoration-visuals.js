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
  getOccupiedAtmosphereOpacity,
  getRangeVeilStrength,
  getRelayRevealHoldDurationSeconds,
  getCageClearPulseDurationSeconds,
  LiberationCelebrateHoldSeconds,
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

  const BaseTyrantAtmosphereColor = new THREE.Color(0x5a2418);
  const TyrantAtmosphereColor = new THREE.Color(0x5a2418);
  const AtmosphereRestoreColor = new THREE.Color();
  const SuppressionDurationSeconds = 0.92;

  function paintTyrantAtmosphere(WorldRuntime, WorldDefinition, Opacity) {
    if (!WorldRuntime.atmosphereMaterial?.color) {
      return;
    }
    TyrantAtmosphereColor.copy(WorldDefinition.atmosphereColor)
      .lerp(BaseTyrantAtmosphereColor, 0.58);
    WorldRuntime.atmosphereMaterial.color.copy(TyrantAtmosphereColor);
    WorldRuntime.atmosphereMaterial.opacity = Opacity
      ?? getOccupiedAtmosphereOpacity(WorldDefinition.restoration?.atmosphereOpacity ?? 0.12);
  }

  function applyAtmosphereViewFade(WorldRuntime, WorldDefinition) {
    if (!WorldRuntime.atmosphereMaterial || !host.Camera) {
      return;
    }
    const Distance = Math.hypot(
      host.Camera.position.x - WorldRuntime.group.position.x,
      host.Camera.position.y - WorldRuntime.group.position.y,
      host.Camera.position.z - WorldRuntime.group.position.z,
    );
    const Apparent = WorldDefinition.radius / Math.max(Distance, 0.001);
    // Fades fully to zero so tiny distant worlds never keep a flat additive disc.
    const FarFade = THREE.MathUtils.clamp((Apparent - 0.012) / 0.05, 0, 1);
    // Landed close-ups keep a rim, not a blown-out white shell.
    const CloseFade = THREE.MathUtils.clamp((0.7 - Apparent) / 0.28, 0.48, 1);
    WorldRuntime.atmosphereMaterial.opacity *= FarFade * CloseFade;
  }

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
        const SuppressionStartedAt = WorldRuntime.suppressionStartedAtSeconds;
        if (Number.isFinite(SuppressionStartedAt) && !host.PrefersReducedMotion) {
          const SuppressionElapsedSeconds = Math.max(
            0,
            ElapsedTimeSeconds - SuppressionStartedAt,
          );
          const LinearSuppressionProgress = THREE.MathUtils.clamp(
            SuppressionElapsedSeconds / SuppressionDurationSeconds,
            0,
            1,
          );
          const WaveProgress = 1 - calculateRestorationWaveProgress(LinearSuppressionProgress);
          WorldRuntime.restorationUniforms.restorationProgress.value = (
            LinearSuppressionProgress >= 1 ? -0.1 : WaveProgress
          );
          WorldRuntime.restorationWaveMesh.visible = LinearSuppressionProgress < 1;
          const StillnessPresentation = getStillnessPresentation(false);
          WorldRuntime.stillnessCageGroup.visible = true;
          WorldRuntime.stillnessCageGroup.scale.setScalar(
            THREE.MathUtils.lerp(1.18, StillnessPresentation.scale, LinearSuppressionProgress),
          );
          WorldRuntime.stillnessCageMaterial.opacity = THREE.MathUtils.lerp(
            0,
            StillnessPresentation.opacity,
            LinearSuppressionProgress,
          );
          WorldRuntime.stillnessCageGroup.rotation.y += 0.003;
          paintTyrantAtmosphere(
            WorldRuntime,
            WorldDefinition,
            THREE.MathUtils.lerp(
              WorldDefinition.restoration.atmosphereOpacity || 0.1,
              getOccupiedAtmosphereOpacity(WorldDefinition.restoration?.atmosphereOpacity ?? 0.12),
              LinearSuppressionProgress,
            ),
          );
          if (WorldRuntime.atmosphereMaterial?.color) {
            AtmosphereRestoreColor.copy(WorldDefinition.atmosphereColor);
            TyrantAtmosphereColor.copy(WorldDefinition.atmosphereColor)
              .lerp(BaseTyrantAtmosphereColor, 0.58);
            WorldRuntime.atmosphereMaterial.color.copy(AtmosphereRestoreColor).lerp(
              TyrantAtmosphereColor,
              LinearSuppressionProgress,
            );
          }
          WorldRuntime.atmosphereMesh.scale.setScalar(
            THREE.MathUtils.lerp(1, 0.96, LinearSuppressionProgress),
          );
          WorldRuntime.group.scale.setScalar(
            1 + (Math.sin(LinearSuppressionProgress * Math.PI) * 0.03),
          );
          for (const SurfacePropObject of WorldRuntime.surfaceMarkerGroup.children) {
            const GrowthScale = SurfacePropObject.userData.baseScale * Math.max(
              0.05,
              1 - LinearSuppressionProgress,
            );
            SurfacePropObject.scale.setScalar(GrowthScale);
            setSurfacePropRestorationProgress(SurfacePropObject, 1 - LinearSuppressionProgress);
          }
          if (WorldRuntime.ambientMoteGroup) {
            WorldRuntime.ambientMoteGroup.material.opacity = (
              WorldRuntime.ambientMoteGroup.userData.baseOpacity * (1 - LinearSuppressionProgress)
            );
          }
          if (LinearSuppressionProgress >= 1) {
            WorldRuntime.suppressionStartedAtSeconds = null;
            WorldRuntime.group.scale.setScalar(1);
          }
          WorldRuntime.group.rotation.y += 0.0005;
          if (applyRangeVeilToWorld(WorldRuntime, WorldDefinition, InnerClusterLive) > 0) {
            VeiledWorldIdentifiers.push(WorldDefinition.id);
          }
          applyAtmosphereViewFade(WorldRuntime, WorldDefinition);
          continue;
        }
        WorldRuntime.group.rotation.y += 0.0005;
        WorldRuntime.stillnessCageGroup.rotation.y += 0.0015;
        paintTyrantAtmosphere(WorldRuntime, WorldDefinition);
        if (applyRangeVeilToWorld(WorldRuntime, WorldDefinition, InnerClusterLive) > 0) {
          VeiledWorldIdentifiers.push(WorldDefinition.id);
        }
        applyAtmosphereViewFade(WorldRuntime, WorldDefinition);
        continue;
      }

      const IsFullyRestoredAtStart = WorldRuntime.restorationStartedAtSeconds === -Infinity;
      const RestorationDuration = WorldDefinition.restoration.durationSeconds;
      const RestorationElapsedSeconds = IsFullyRestoredAtStart
        ? RestorationDuration + 10
        : Math.max(0, ElapsedTimeSeconds - WorldRuntime.restorationStartedAtSeconds);
      const LinearRestorationProgress = THREE.MathUtils.clamp(
        RestorationElapsedSeconds / RestorationDuration,
        0,
        1,
      );
      const CompletionHoldSeconds = host.PrefersReducedMotion ? 0.12 : 0.72;
      const PostCompleteSeconds = RestorationElapsedSeconds - RestorationDuration;
      const IsCompletionHold = !IsFullyRestoredAtStart
        && PostCompleteSeconds >= 0
        && PostCompleteSeconds < CompletionHoldSeconds;
      const WaveProgress = calculateRestorationWaveProgress(LinearRestorationProgress);
      const ShaderWaveProgress = LinearRestorationProgress >= 1
        ? (IsCompletionHold ? 1 : 1.2)
        : WaveProgress;
      WorldRuntime.restorationUniforms.restorationProgress.value = ShaderWaveProgress;
      WorldRuntime.restorationWaveMesh.visible = LinearRestorationProgress < 1 || IsCompletionHold;
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
      if (LinearRestorationProgress < 1 || IsCompletionHold) {
        const BloomPhase = IsCompletionHold
          ? 1 - (PostCompleteSeconds / CompletionHoldSeconds)
          : LinearRestorationProgress;
        WorldRuntime.atmosphereMaterial.opacity *= 1
          + (Math.sin(BloomPhase * Math.PI) * 1.2);
      }
      if (WorldRuntime.atmosphereMaterial?.color) {
        AtmosphereRestoreColor.copy(WorldDefinition.atmosphereColor);
        TyrantAtmosphereColor.copy(WorldDefinition.atmosphereColor)
          .lerp(BaseTyrantAtmosphereColor, 0.58);
        WorldRuntime.atmosphereMaterial.color.copy(TyrantAtmosphereColor).lerp(
          AtmosphereRestoreColor,
          AtmosphereProgress,
        );
      }
      WorldRuntime.atmosphereMesh.scale.setScalar(
        THREE.MathUtils.lerp(0.96, 1, AtmosphereProgress)
          * ((LinearRestorationProgress < 1 || IsCompletionHold)
            ? 1 + (Math.sin(
              (IsCompletionHold ? 1 : LinearRestorationProgress) * Math.PI,
            ) * 0.14)
            : 1),
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
        const PulseScale = 1 + (Math.sin(LinearRestorationProgress * Math.PI) * 0.07);
        WorldRuntime.group.scale.setScalar(PulseScale);
      } else {
        WorldRuntime.group.scale.setScalar(1);
        if (!WorldRuntime.restorationCompleted) {
          WorldRuntime.restorationCompleted = true;
          WorldseedSound.restorationComplete(WorldDefinition.id);
          host.LiberationCelebrateUntilSeconds = Math.max(
            host.LiberationCelebrateUntilSeconds ?? 0,
            ElapsedTimeSeconds + LiberationCelebrateHoldSeconds,
          );
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
                showStatusToast('RECAPTURE', 1350);
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
      if (WorldRuntime.cageClearPulseStartedAtSeconds != null) {
        const PulseElapsed = ElapsedTimeSeconds - WorldRuntime.cageClearPulseStartedAtSeconds;
        const PulseDuration = getCageClearPulseDurationSeconds({
          prefersReducedMotion: host.PrefersReducedMotion === true,
        });
        if (PulseElapsed < PulseDuration) {
          const PulseLinear = THREE.MathUtils.clamp(PulseElapsed / PulseDuration, 0, 1);
          WorldRuntime.restorationWaveMesh.visible = true;
          WorldRuntime.restorationUniforms.restorationProgress.value = calculateRestorationWaveProgress(
            PulseLinear,
          );
          WorldRuntime.atmosphereMaterial.opacity = WorldDefinition.restoration.atmosphereOpacity
            * (1 + (Math.sin(PulseLinear * Math.PI) * 1.35));
          WorldRuntime.atmosphereMesh.scale.setScalar(
            1 + (Math.sin(PulseLinear * Math.PI) * 0.16),
          );
        } else {
          WorldRuntime.cageClearPulseStartedAtSeconds = null;
          if (LinearRestorationProgress >= 1 && !IsCompletionHold) {
            WorldRuntime.restorationWaveMesh.visible = false;
          }
        }
      }
      if (applyRangeVeilToWorld(WorldRuntime, WorldDefinition, InnerClusterLive) > 0) {
        VeiledWorldIdentifiers.push(WorldDefinition.id);
      }
      applyAtmosphereViewFade(WorldRuntime, WorldDefinition);
    }
    GameCanvas.dataset.rangeVeil = InnerClusterLive ? 'lifted' : VeiledWorldIdentifiers.join(',');
  }

  return {
    updateWorldRestorationVisuals,
  };
}
