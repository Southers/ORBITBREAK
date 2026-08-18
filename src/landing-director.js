/**
 * Landing presentation: planet-wrapping restoration, attach feedback, command
 * liberation and the finale pulse. Flight settlement and Warden pursuit stay in
 * the playable shell / flight resolver.
 */

import { countRestoredWorlds } from './campaign.js';
import { evaluateRelayPortLanding } from './flight-resolver.js';
import { connectRelayWorlds } from './network.js';
import { createVector } from './physics.js';
import {
  getRelayRevealLookTarget,
  LiberationCelebrateHoldSeconds,
  getStillnessPresentation,
  getTriggeredCampaignStoryBoardIds,
} from './presentation.js';
import { calculateNormalizedSphericalDistance } from './restoration.js';
import { addCircuitBonus, addVictoryBonus } from './scoring.js';
import { settleRunFlight } from './run.js';
import { WardenPursuitEvents } from './warden.js';

export function createLandingDirector(THREE, host) {
  const {
    WorldRuntimeByIdentifier,
    WorldDefinitions,
    Camera,
    RouteLabelProjection,
    LiberationFlashElement,
    WorldseedSound,
    GameCanvas,
    clearTrajectoryPreview,
    setSurfacePropRestorationProgress,
    updateWorldCounter,
    updateCommandWorldAvailability,
    updateWorldheartObjective,
    showStatusToast,
    showScoreBurst,
    updateScannerInterface,
    SeedGroup,
    ImpactPulseMesh,
    HostilePylonGroup,
    FinaleCoreMesh,
    FinaleLinkMesh,
    FinalePulseMesh,
    FinaleSparkMesh,
    FinaleCoreMaterial,
    FinaleLinkMaterial,
    FinalePulseMaterial,
    FinaleSparkMaterial,
    FinaleLinkPositionValues,
    FinaleLinkPositionAttribute,
    FinalePulseCount,
    FinalePulseTransform,
    FinaleSparkCount,
    FinaleSparkTransform,
    Scene,
    Renderer,
    InitialSceneBackgroundColor,
    FirstRelayAnswerLine,
    SecondRelayAnswerLine,
    ShownStoryBoardIds,
    CompletedHostileEncounterWorldIdentifiers,
    CourierStartTimesByLinkId,
  } = host;
  const centerLandedCamera = (...Args) => host.centerLandedCamera(...Args);

  /**
   * Starts the lightweight greybox restoration animation and marks objective state.
   *
   * @param {object} WorldDefinition - World that has just been awakened.
   * @param {{x:number,y:number,z:number}} ImpactPosition - World-space landing point.
   */
  function restoreWorld(WorldDefinition, ImpactPosition) {
    if (WorldDefinition.restored) {
      return;
    }

    WorldDefinition.restored = true;
    const WorldRuntime = WorldRuntimeByIdentifier.get(WorldDefinition.id);
    host.GamePhase = 'restoring';
    clearTrajectoryPreview();
    WorldRuntime.group.updateWorldMatrix(true, false);
    WorldRuntime.restorationOriginLocal.copy(
      WorldRuntime.group.worldToLocal(new THREE.Vector3(
        ImpactPosition.x,
        ImpactPosition.y,
        ImpactPosition.z,
      )),
    ).normalize();
    WorldRuntime.restorationUniforms.restorationOrigin.value.copy(
      WorldRuntime.restorationOriginLocal,
    );
    WorldRuntime.restorationUniforms.restorationProgress.value = -0.025;
    WorldRuntime.restorationStartedAtSeconds = host.GameElapsedTimeSeconds;
    WorldRuntime.cageClearPulseStartedAtSeconds = null;
    WorldRuntime.restorationWaveMesh.visible = true;
    host.LiberationCelebrateUntilSeconds = Math.max(
      host.LiberationCelebrateUntilSeconds ?? 0,
      host.GameElapsedTimeSeconds
        + (host.PrefersReducedMotion === true
          ? LiberationCelebrateHoldSeconds
          : WorldDefinition.restoration.durationSeconds + LiberationCelebrateHoldSeconds),
    );
    WorldRuntime.contourRingGroup.visible = true;
    RouteLabelProjection.set(ImpactPosition.x, ImpactPosition.y, ImpactPosition.z).project(Camera);
    LiberationFlashElement.style.setProperty(
      '--liberation-x',
      `${THREE.MathUtils.clamp((RouteLabelProjection.x * 0.5 + 0.5) * 100, 0, 100)}%`,
    );
    LiberationFlashElement.style.setProperty(
      '--liberation-y',
      `${THREE.MathUtils.clamp((-RouteLabelProjection.y * 0.5 + 0.5) * 100, 0, 100)}%`,
    );
    host.LiberationFlashLifeSeconds = 0.72;
    host.CameraImpactLifeSeconds = Math.max(host.CameraImpactLifeSeconds, 0.26);

    for (const SurfacePropObject of WorldRuntime.surfaceMarkerGroup.children) {
      SurfacePropObject.userData.restorationDistance = calculateNormalizedSphericalDistance(
        WorldRuntime.restorationOriginLocal,
        SurfacePropObject.userData.surfaceDirection,
      );
      SurfacePropObject.scale.setScalar(SurfacePropObject.userData.baseScale * 0.05);
      setSurfacePropRestorationProgress(SurfacePropObject, 0);
    }

    updateWorldCounter();
    const RestoredWorldCount = countRestoredWorlds(WorldDefinitions);
    updateCommandWorldAvailability();
    updateWorldheartObjective();
    WorldseedSound.restore(WorldDefinition.id, RestoredWorldCount);
    showStatusToast(`CONTROL SIGNAL BREAKING · ${WorldDefinition.label}`, 1450);
  }

  /** Returns an exposed relay world to its occupied presentation without erasing its route history. */
  function suppressWorld(WorldDefinition) {
    if (!WorldDefinition.restored) {
      return false;
    }

    WorldDefinition.restored = false;
    const WorldRuntime = WorldRuntimeByIdentifier.get(WorldDefinition.id);
    WorldRuntime.restorationStartedAtSeconds = null;
    WorldRuntime.restorationCompleted = false;
    WorldRuntime.cageClearPulseStartedAtSeconds = null;
    const ShouldSnapSuppression = host.PrefersReducedMotion === true;
    WorldRuntime.suppressionStartedAtSeconds = ShouldSnapSuppression
      ? null
      : host.GameElapsedTimeSeconds;
    WorldRuntime.restorationUniforms.restorationProgress.value = ShouldSnapSuppression ? -0.1 : 1;
    WorldRuntime.restorationWaveMesh.visible = !ShouldSnapSuppression;
    if (ShouldSnapSuppression) {
      WorldRuntime.atmosphereMaterial.opacity = 0.025;
      WorldRuntime.atmosphereMesh.scale.setScalar(0.96);
      WorldRuntime.contourRingGroup.visible = false;
      const StillnessPresentation = getStillnessPresentation(false);
      WorldRuntime.stillnessCageGroup.visible = StillnessPresentation.visible;
      WorldRuntime.stillnessCageGroup.scale.setScalar(StillnessPresentation.scale);
      WorldRuntime.stillnessCageMaterial.opacity = StillnessPresentation.opacity;
      WorldRuntime.group.scale.setScalar(1);
      if (WorldRuntime.ambientMoteGroup) {
        WorldRuntime.ambientMoteGroup.material.opacity = 0;
      }
      for (const SurfacePropObject of WorldRuntime.surfaceMarkerGroup.children) {
        setSurfacePropRestorationProgress(SurfacePropObject, 0);
        SurfacePropObject.scale.setScalar(SurfacePropObject.userData.baseScale * 0.05);
      }
    } else {
      WorldRuntime.contourRingGroup.visible = false;
    }
    updateWorldCounter();
    updateWorldheartObjective();
    updateScannerInterface();
    return true;
  }

  /**
   * Places the seed on a world and returns control to the player.
   *
   * @param {object} WorldDefinition - World that received the seed.
   * @param {{x:number,y:number,z:number}} ImpactPosition - Approximate impact position.
   */
  function attachSeedToWorld(WorldDefinition, ImpactPosition) {
    host.IsBreakerBurnAvailable = false;
    host.IsBreakerBurnPending = false;
    host.CommittedPredictionPoints = null;
    GameCanvas.dataset.predictionHoldActive = 'false';
    host.hideInstruction();
    const LandingOriginWorldIdentifier = host.FlightOriginWorldIdentifier;
    const SurfaceRestPosition = host.calculateSurfaceRestPosition(WorldDefinition, ImpactPosition);

    ImpactPulseMesh.material.color.set(0xfff2bc);
    ImpactPulseMesh.position.set(ImpactPosition.x, ImpactPosition.y, 0.22);
    ImpactPulseMesh.scale.setScalar(1);
    ImpactPulseMesh.visible = true;
    host.ImpactPulseLifeSeconds = 0.58;
    host.CameraImpactLifeSeconds = 0.24;
    WorldseedSound.impact(WorldDefinition.id);
    if (!WorldDefinition.restored) {
      WorldseedSound.haulLane();
    }

    host.SeedPhysicsState = {
      position: SurfaceRestPosition,
      velocity: createVector(),
    };
    SeedGroup.position.set(SurfaceRestPosition.x, SurfaceRestPosition.y, SurfaceRestPosition.z);

    host.CurrentWorldIdentifier = WorldDefinition.id;
    host.publishAttachedSeedState(host.CurrentWorldIdentifier, SurfaceRestPosition);
    host.LastSafeWorldIdentifier = WorldDefinition.id;
    host.LastSafeSeedPosition = createVector(
      SurfaceRestPosition.x,
      SurfaceRestPosition.y,
      SurfaceRestPosition.z,
    );
    host.LaunchIgnoredWorldIdentifier = null;
    host.AttachedSurfaceMeridianSign = 1;
    centerLandedCamera({ snap: false });

    const LiveWorldsBefore = host.listLiveWorldIdentifiers();
    const InnerClusterLiveBefore = host.isLiveInnerCluster(LiveWorldsBefore);
    const FurtherReachLiveBefore = host.isLiveFurtherReach(LiveWorldsBefore);
    const CommandAvailableBefore = host.WorldheartDefinition.routeAvailable === true;

    const WasAlreadyRestored = WorldDefinition.restored;
    const WasSuppressed = host.RelayNetworkState.suppressedWorldIdentifiers.has(WorldDefinition.id);
    const PortLanding = evaluateRelayPortLanding(
      WorldDefinition,
      SurfaceRestPosition,
      WorldDefinition.position,
    );
    const Liberated = !WasAlreadyRestored && PortLanding.insidePort;
    const DockedOutsidePort = !WasAlreadyRestored && !PortLanding.insidePort;
    const LandingAccolade = host.getCurrentLandingAccolade(
      WorldDefinition.id,
      Liberated && !WasSuppressed,
    );
    const BankResult = host.bankCurrentFlight(
      !Liberated || WasSuppressed
        ? 0
        : (WorldDefinition.liberationValue ?? 1000) + PortLanding.precisionBonus,
    );
    const RelayConnection = LandingOriginWorldIdentifier
      && LandingOriginWorldIdentifier !== WorldDefinition.id
      ? connectRelayWorlds(
        host.RelayNetworkState,
        LandingOriginWorldIdentifier,
        WorldDefinition.id,
      )
      : null;
    const CircuitBonus = RelayConnection?.circuitClosed
      ? addCircuitBonus(host.ScoreState, host.ActiveSystem.circuitBonusValue)
      : 0;
    const TotalBankedPoints = BankResult.bankedPoints + CircuitBonus;
    if (CircuitBonus > 0) {
      GameCanvas.dataset.lastCircuitBonus = String(CircuitBonus);
      host.updateScoreInterface();
    }
    if (TotalBankedPoints > 0) {
      showScoreBurst(
        ImpactPosition,
        `+${TotalBankedPoints.toLocaleString('en-GB')}`,
        CircuitBonus > 0 ? 'circuit' : 'bank',
      );
    }
    if (RelayConnection?.created || RelayConnection?.destinationReactivated) {
      host.synchronizeRelayNetworkVisuals();
      CourierStartTimesByLinkId.set(RelayConnection.link.id, host.GameElapsedTimeSeconds);
      WorldseedSound.tradeLane();
    }
    if (
      RelayConnection?.destinationReactivated
      && host.RecaptureCutGiftAvailable
      && !WorldDefinition.hostileEncounter
      && !CompletedHostileEncounterWorldIdentifiers.has(WorldDefinition.id)
    ) {
      host.PendingRecaptureCutWorldIdentifier = WorldDefinition.id;
    }
    GameCanvas.dataset.lastFlightAccolade = LandingAccolade ?? '';
    GameCanvas.dataset.lastPortLanding = DockedOutsidePort
      ? 'missed'
      : (PortLanding.precisionTier ?? '');
    host.commitFlightStardust();
    host.resetFlightFeedback();
    if (Liberated) {
      restoreWorld(WorldDefinition, ImpactPosition);
    }

    if (host.GamePhase === 'restoring') {
      const AnswerLine = host.RelayNetworkState.links.size === 1
        ? FirstRelayAnswerLine
        : (host.RelayNetworkState.links.size === 2
          ? SecondRelayAnswerLine
          : WorldDefinition.memory);
      host.showInstruction(
        RelayConnection?.destinationReactivated
          ? `Signal restored: ${WorldDefinition.label}`
          : RelayConnection?.created
          ? `Relay linked: ${host.getWorldDefinition(LandingOriginWorldIdentifier).label} ↔ ${WorldDefinition.label}`
          : `Life is racing around ${WorldDefinition.label}`,
        RelayConnection?.destinationReactivated
          ? 'The original route and courier are live again.'
          : RelayConnection?.created ? AnswerLine : WorldDefinition.memory,
      );
      const PortGrade = PortLanding.precisionTier === 'bullseye'
        ? 'BULLSEYE PORT'
        : (PortLanding.hasPort ? 'PORT LOCKED' : null);
      if (LandingAccolade || PortGrade) {
        showStatusToast(
          `${LandingAccolade ?? PortGrade} · +${TotalBankedPoints.toLocaleString('en-GB')} BANKED`,
          1450,
        );
      }
    } else if (
      DockedOutsidePort
      && host.GamePhase !== 'victory'
      && host.GamePhase !== 'victoryPending'
    ) {
      host.GamePhase = 'attached';
      clearTrajectoryPreview();
      showStatusToast(
        TotalBankedPoints > 0
          ? `DOCKED · BEACON ARC MISSED · +${TotalBankedPoints.toLocaleString('en-GB')} BANKED`
          : 'DOCKED · BEACON ARC MISSED',
        1450,
      );
      host.showInstruction(
        `Docked at ${WorldDefinition.label}`,
        'The relay is linked, but the cage holds. Launch again and land inside the gold beacon arc to liberate this world.',
        'missed-port',
      );
    } else if (WasAlreadyRestored && host.GamePhase !== 'victory' && host.GamePhase !== 'victoryPending') {
      host.GamePhase = 'attached';
      clearTrajectoryPreview();
      showStatusToast(
        TotalBankedPoints > 0
          ? `+${TotalBankedPoints.toLocaleString('en-GB')} BANKED`
          : (LandingAccolade ?? 'CLEAN LANDING'),
        850,
      );
      host.showRouteChoiceInstruction();
    }
    const SuppressedWorld = host.settleNonCommandFlight({
      firstCircuitClosed: RelayConnection?.circuitClosed === true,
      circuit: RelayConnection?.circuit ?? null,
    });
    if (host.RunState.status === 'failed' || host.GamePhase === 'runFailed') {
      host.updateBreakerBurnInterface();
      return;
    }
    const LiveWorldsAfter = host.listLiveWorldIdentifiers();
    host.enqueueCampaignStoryBoards(
      getTriggeredCampaignStoryBoardIds({
        shownIds: [...ShownStoryBoardIds],
        createdLinkCount: host.RelayNetworkState.links.size,
        linkCreated: RelayConnection?.created === true,
        linkedWorldIdentifier: WorldDefinition.id,
        innerClusterJustUnlocked: !InnerClusterLiveBefore
          && host.isLiveInnerCluster(LiveWorldsAfter),
        neighbourhoodJustAwake: host.isLiveInnerCluster(LiveWorldsAfter)
          && !FurtherReachLiveBefore
          && host.isLiveFurtherReach(LiveWorldsAfter),
        wardenJustRevealed: host.WardenPursuitState.lastEvent === WardenPursuitEvents.revealed,
        circuitJustClosed: RelayConnection?.circuitClosed === true,
        worldJustSuppressed: Boolean(SuppressedWorld),
        worldJustRecaptured: RelayConnection?.destinationReactivated === true,
        commandJustExposed: !CommandAvailableBefore
          && host.WorldheartDefinition.routeAvailable === true,
      }),
      { world: (SuppressedWorld ?? WorldDefinition).label },
    );
    if (
      host.GamePhase === 'restoring'
      && LandingOriginWorldIdentifier
      && (RelayConnection?.created || RelayConnection?.destinationReactivated)
      && host.WardenPursuitState.lastEvent !== WardenPursuitEvents.revealed
    ) {
      const OriginWorld = host.getWorldDefinition(LandingOriginWorldIdentifier);
      if (OriginWorld) {
        host.RelayRevealLookTarget = getRelayRevealLookTarget({
          origin: OriginWorld.position,
          destination: WorldDefinition.position,
          runner: SurfaceRestPosition,
          viewportWorldWidth: host.ActiveSystem.camera?.viewportWorldWidth ?? 20,
          viewportWorldHeight: host.ActiveSystem.camera?.viewportWorldHeight ?? 24,
        });
        GameCanvas.dataset.relayReveal = `${LandingOriginWorldIdentifier}:${WorldDefinition.id}`;
      }
    }
    host.updateBreakerBurnInterface();
  }

  /** Lands on the one-use launch node without counting it as an awakened world. */
  function attachSeedToSeedstone(ImpactPosition, BodyPosition) {
    host.IsBreakerBurnAvailable = false;
    host.IsBreakerBurnPending = false;
    host.SeedstoneDefinition.position.x = BodyPosition.x;
    host.SeedstoneDefinition.position.y = BodyPosition.y;
    host.SeedstoneDefinition.position.z = BodyPosition.z;
    const LandingAccolade = host.getCurrentLandingAccolade(host.SeedstoneDefinition.id, true);
    const SurfaceRestPosition = host.calculateSurfaceRestPosition(
      host.SeedstoneDefinition,
      ImpactPosition,
    );
    host.AttachedSeedstoneSurfaceOffset = createVector(
      SurfaceRestPosition.x - BodyPosition.x,
      SurfaceRestPosition.y - BodyPosition.y,
      SurfaceRestPosition.z - BodyPosition.z,
    );

    ImpactPulseMesh.material.color.set(0x72d9ff);
    ImpactPulseMesh.position.set(ImpactPosition.x, ImpactPosition.y, 0.22);
    ImpactPulseMesh.scale.setScalar(1);
    ImpactPulseMesh.visible = true;
    host.ImpactPulseLifeSeconds = 0.58;
    host.CameraImpactLifeSeconds = 0.18;
    WorldseedSound.impact('seedstone');

    host.SeedPhysicsState = {
      position: SurfaceRestPosition,
      velocity: createVector(),
    };
    SeedGroup.position.set(SurfaceRestPosition.x, SurfaceRestPosition.y, SurfaceRestPosition.z);
    host.CurrentWorldIdentifier = host.SeedstoneDefinition.id;
    host.publishAttachedSeedState(host.CurrentWorldIdentifier, SurfaceRestPosition);
    host.LaunchIgnoredWorldIdentifier = null;
    host.LaunchIgnoredBodyIdentifier = null;
    host.AttachedSurfaceMeridianSign = 1;
    host.GamePhase = 'attached';
    centerLandedCamera({ snap: false });
    GameCanvas.dataset.lastFlightAccolade = LandingAccolade ?? '';
    const BankResult = host.bankCurrentFlight();
    if (BankResult.bankedPoints > 0) {
      showScoreBurst(ImpactPosition, `+${BankResult.bankedPoints.toLocaleString('en-GB')}`);
    }
    host.commitFlightStardust();
    host.resetFlightFeedback();
    showStatusToast(BankResult.bankedPoints > 0
      ? `+${BankResult.bankedPoints.toLocaleString('en-GB')} BANKED · ${host.SeedstoneDefinition.label}`
      : (LandingAccolade
        ? `${LandingAccolade} · ${host.SeedstoneDefinition.label} READY`
        : `${host.SeedstoneDefinition.label} READY · 1 LAUNCH`), 1100);
    host.showInstruction(
      host.SeedstoneDefinition.orbit ? 'Moving launch window' : 'Temporary launchpad',
      host.SeedstoneDefinition.orbit
        ? `Ride ${host.SeedstoneDefinition.label} into position, then launch before it crumbles.`
        : `Choose the next world carefully — ${host.SeedstoneDefinition.label} crumbles after launch.`,
    );
    host.settleNonCommandFlight();
    host.updateBreakerBurnInterface();
  }

  /** Completes the command landing only after its lattice teeth are cut. */
  function completeWorldheartLiberation() {
    if (host.WorldheartDefinition.restored) return false;
    CompletedHostileEncounterWorldIdentifiers.add(host.WorldheartDefinition.id);
    host.ActiveHostileEncounterState = null;
    HostilePylonGroup.visible = false;
    host.hideCutGuide();
    host.publishHostileEncounterState();
    host.WorldheartDefinition.restored = true;
    const CompletionBonus = addVictoryBonus(
      host.ScoreState,
      host.WardenPursuitState.distance,
      host.ActiveSystem.wardenVictoryValuePerStep,
    );
    host.updateScoreInterface();
    GameCanvas.dataset.completionBonus = String(CompletionBonus);
    GameCanvas.dataset.commandPulse = 'fired';
    host.beginCommandDefeat(host.GameElapsedTimeSeconds);
    host.startWardenEventPulse(host.WorldheartDefinition.position, 0x72d9ff, 'defeat');
    host.GamePhase = 'victoryPending';
    updateWorldheartObjective();
    host.publishWardenState();
    host.updateVictorySummary();
    host.hideInstruction();
    beginFinaleRestoration();
    if (host.IsCampaignFinale) {
      showStatusToast('THE WORLDHEART IS AWAKENING', 2200, 'memory');
    } else {
      showStatusToast(
        host.ActiveSystem.completion.expansionSting
          ? `${host.ActiveSystem.completion.expansionSting} · +${(host.PendingWorldheartBankedPoints + CompletionBonus).toLocaleString('en-GB')} BANKED`
          : `COMMAND BROKEN · +${(host.PendingWorldheartBankedPoints + CompletionBonus).toLocaleString('en-GB')} BANKED`,
        1800,
      );
    }

    const VictoryDelaySeconds = host.PrefersReducedMotion
      ? 0.85
      : host.ActiveSystem.finale?.victoryDelaySeconds ?? 1.35;
    host.WorldheartCompletionTimeoutIdentifier = host.setTimeout(() => {
      host.WorldheartCompletionTimeoutIdentifier = null;
      host.PendingVictoryAfterStoryBoard = true;
      if (host.enqueueCampaignStoryBoards(
        getTriggeredCampaignStoryBoardIds({
          shownIds: [...ShownStoryBoardIds],
          reachJustAnswered: true,
        }),
      )) {
        return;
      }
      host.PendingVictoryAfterStoryBoard = false;
      host.revealVictoryPanel();
      host.GamePhase = 'victory';
      WorldseedSound.victory();
    }, VictoryDelaySeconds * 1000);
    host.updateBreakerBurnInterface();
    return true;
  }

  /** Lands on the exposed mobile command body and starts its final surface approach. */
  function attachSeedToWorldheart(ImpactPosition, BodyPosition) {
    if (!host.WorldheartDefinition.routeAvailable || host.WorldheartDefinition.restored) {
      return;
    }
    host.IsBreakerBurnAvailable = false;
    host.IsBreakerBurnPending = false;
    host.WorldheartDefinition.position.x = BodyPosition.x;
    host.WorldheartDefinition.position.y = BodyPosition.y;
    host.WorldheartDefinition.position.z = BodyPosition.z;

    const SurfaceRestPosition = host.calculateSurfaceRestPosition(
      host.WorldheartDefinition,
      ImpactPosition,
    );
    const LandingAccolade = host.getCurrentLandingAccolade(host.WorldheartDefinition.id, true);
    ImpactPulseMesh.material.color.set(0xffd678);
    ImpactPulseMesh.position.set(ImpactPosition.x, ImpactPosition.y, 0.24);
    ImpactPulseMesh.scale.setScalar(1.2);
    ImpactPulseMesh.visible = true;
    host.ImpactPulseLifeSeconds = 0.58;
    host.CameraImpactLifeSeconds = 0.24;
    WorldseedSound.impact('worldheart');

    host.SeedPhysicsState = { position: SurfaceRestPosition, velocity: createVector() };
    SeedGroup.position.set(SurfaceRestPosition.x, SurfaceRestPosition.y, SurfaceRestPosition.z);
    host.CurrentWorldIdentifier = host.WorldheartDefinition.id;
    host.publishAttachedSeedState(host.CurrentWorldIdentifier, SurfaceRestPosition);
    host.AttachedWorldheartSurfaceAngle = host.getRunnerSurfaceAngle(host.WorldheartDefinition);
    host.AttachedWorldheartSurfaceLatitude = 0;
    host.AttachedSurfaceMeridianSign = 1;
    centerLandedCamera({ snap: false });
    host.RunState = settleRunFlight(host.RunState, { reachedCommandWorld: true });
    host.updateFuelLights();
    const BankResult = host.bankCurrentFlight();
    host.PendingWorldheartBankedPoints = BankResult.bankedPoints;
    GameCanvas.dataset.lastFlightAccolade = LandingAccolade ?? '';
    GameCanvas.dataset.commandPulse = 'required';
    host.commitFlightStardust();
    host.resetFlightFeedback();
    host.GamePhase = 'attached';
    clearTrajectoryPreview();
    updateWorldheartObjective();
    const HasSurfaceApproach = host.beginHostileEncounter(host.WorldheartDefinition);
    if (host.ReplayPlaybackState !== null || !HasSurfaceApproach) {
      completeWorldheartLiberation();
    } else {
      showStatusToast('COMMAND LANDED · CORE LATTICE ACTIVE', 1500);
      host.enqueueCampaignStoryBoards(
        getTriggeredCampaignStoryBoardIds({
          shownIds: [...ShownStoryBoardIds],
          commandJustLanded: true,
        }),
      );
    }
    host.updateBreakerBurnInterface();
  }

  /** Starts the final system-scale pulse only after the seed physically lands in the core. */
  function beginFinaleRestoration() {
    host.FinaleRestorationStartedAtSeconds = host.GameElapsedTimeSeconds;
    FinaleCoreMesh.position.set(
      host.WorldheartDefinition.position.x,
      host.WorldheartDefinition.position.y,
      0.1,
    );
    FinaleCoreMesh.visible = true;
    FinaleLinkMesh.visible = true;
    FinalePulseMesh.visible = true;
    FinaleSparkMesh.visible = true;
    FinaleLinkMaterial.opacity = 0;
    FinalePulseMaterial.opacity = 0;
    FinaleSparkMaterial.opacity = 0;
    GameCanvas.dataset.finaleRestoration = 'active';
  }

  /**
   * Sends the living pulse back through every restored route before revealing the final summary.
   * This is presentation-only; physics and campaign state are already settled at impact.
   */
  function updateFinaleRestorationVisuals(ElapsedTimeSeconds) {
    if (host.FinaleRestorationStartedAtSeconds === null) {
      return;
    }

    const FinaleDurationSeconds = host.ActiveSystem.finale?.victoryDelaySeconds ?? 1.35;
    const FinaleElapsedSeconds = host.PrefersReducedMotion
      ? FinaleDurationSeconds
      : Math.min(
        FinaleDurationSeconds,
        Math.max(0, ElapsedTimeSeconds - host.FinaleRestorationStartedAtSeconds),
      );
    const FinaleProgress = THREE.MathUtils.smoothstep(
      FinaleElapsedSeconds / FinaleDurationSeconds,
      0,
      1,
    );
    const PulseArrivalProgress = THREE.MathUtils.smoothstep(
      FinaleElapsedSeconds,
      host.IsCampaignFinale ? 0.18 : 0.08,
      host.IsCampaignFinale ? 2.25 : 0.82,
    );

    FinaleCoreMesh.position.set(
      host.WorldheartDefinition.position.x,
      host.WorldheartDefinition.position.y,
      0.1,
    );
    FinaleCoreMesh.rotation.x = FinaleElapsedSeconds * 0.38;
    FinaleCoreMesh.rotation.y = FinaleElapsedSeconds * 0.62;
    FinaleCoreMesh.scale.setScalar(
      1 + (Math.sin(FinaleElapsedSeconds * 4.2) * 0.08) + (FinaleProgress * 0.18),
    );
    FinaleCoreMaterial.emissiveIntensity = 2.4 + (PulseArrivalProgress * 2.2);

    let LinkValueOffset = 0;
    WorldDefinitions.forEach((WorldDefinition, WorldIndex) => {
      const WorldPulseProgress = WorldDefinition.restored
        ? THREE.MathUtils.smoothstep(
          FinaleElapsedSeconds,
          host.IsCampaignFinale ? 0.2 + (WorldIndex * 0.12) : 0.08 + (WorldIndex * 0.045),
          host.IsCampaignFinale ? 1.35 + (WorldIndex * 0.12) : 0.62 + (WorldIndex * 0.1),
        )
        : 0;
      FinaleLinkPositionValues[LinkValueOffset] = host.WorldheartDefinition.position.x;
      FinaleLinkPositionValues[LinkValueOffset + 1] = host.WorldheartDefinition.position.y;
      FinaleLinkPositionValues[LinkValueOffset + 2] = 0.04;
      FinaleLinkPositionValues[LinkValueOffset + 3] = THREE.MathUtils.lerp(
        host.WorldheartDefinition.position.x,
        WorldDefinition.position.x,
        WorldPulseProgress,
      );
      FinaleLinkPositionValues[LinkValueOffset + 4] = THREE.MathUtils.lerp(
        host.WorldheartDefinition.position.y,
        WorldDefinition.position.y,
        WorldPulseProgress,
      );
      FinaleLinkPositionValues[LinkValueOffset + 5] = 0.04;
      LinkValueOffset += 6;
    });
    FinaleLinkPositionAttribute.needsUpdate = true;
    FinaleLinkMaterial.opacity = 0.12 + (PulseArrivalProgress * 0.54);

    for (let PulseIndex = 0; PulseIndex < FinalePulseCount; PulseIndex += 1) {
      const PulseElapsedSeconds = FinaleElapsedSeconds - (PulseIndex * 0.34);
      const IsPulseActive = PulseElapsedSeconds >= 0;
      const PulseScale = IsPulseActive
        ? host.WorldheartDefinition.radius * (1.2 + (PulseElapsedSeconds * 2.8))
        : 0.001;
      FinalePulseTransform.position.set(
        host.WorldheartDefinition.position.x,
        host.WorldheartDefinition.position.y,
        0.02 + (PulseIndex * 0.004),
      );
      FinalePulseTransform.rotation.set(0, 0, PulseIndex * 0.3);
      FinalePulseTransform.scale.setScalar(PulseScale);
      FinalePulseTransform.updateMatrix();
      FinalePulseMesh.setMatrixAt(PulseIndex, FinalePulseTransform.matrix);
    }
    FinalePulseMesh.instanceMatrix.needsUpdate = true;
    FinalePulseMaterial.opacity = 0.46 * (1 - (FinaleProgress * 0.45));

    for (let SparkIndex = 0; SparkIndex < FinaleSparkCount; SparkIndex += 1) {
      const SparkFraction = SparkIndex / FinaleSparkCount;
      const SparkAngle = (SparkIndex * 2.399963) + (FinaleElapsedSeconds * 0.18);
      const SparkRadius = host.WorldheartDefinition.radius
        + (PulseArrivalProgress * (1.4 + (SparkFraction * 8.6)));
      FinaleSparkTransform.position.set(
        host.WorldheartDefinition.position.x + (Math.cos(SparkAngle) * SparkRadius),
        host.WorldheartDefinition.position.y + (Math.sin(SparkAngle) * SparkRadius),
        -0.3 + ((SparkIndex % 9) * 0.08),
      );
      FinaleSparkTransform.rotation.set(
        SparkAngle * 0.5,
        SparkAngle * 0.32,
        SparkAngle,
      );
      FinaleSparkTransform.scale.setScalar(
        (0.42 + ((SparkIndex % 5) * 0.09)) * PulseArrivalProgress,
      );
      FinaleSparkTransform.updateMatrix();
      FinaleSparkMesh.setMatrixAt(SparkIndex, FinaleSparkTransform.matrix);
    }
    FinaleSparkMesh.instanceMatrix.needsUpdate = true;
    FinaleSparkMaterial.opacity = 0.28 + (PulseArrivalProgress * 0.62);

    Scene.background.copy(InitialSceneBackgroundColor).lerp(
      host.ActiveSystem.finale?.awakenedBackgroundColor ?? InitialSceneBackgroundColor,
      FinaleProgress,
    );
    Renderer.toneMappingExposure = host.ActiveSystem.environment.toneMappingExposure
      + (Math.sin(FinaleProgress * Math.PI) * 0.22)
      + (FinaleProgress * 0.08);
    if (FinaleProgress >= 1) {
      GameCanvas.dataset.finaleRestoration = 'complete';
    }
  }

  /** Clears command-completion timers and restores landing presentation to the opening state. */
  function resetLandingDirector() {
    if (host.WorldheartCompletionTimeoutIdentifier !== null) {
      host.clearTimeout(host.WorldheartCompletionTimeoutIdentifier);
      host.WorldheartCompletionTimeoutIdentifier = null;
    }
    host.PendingWorldheartBankedPoints = 0;
    host.FinaleRestorationStartedAtSeconds = null;
    FinaleCoreMesh.visible = false;
    FinaleCoreMesh.scale.setScalar(1);
    FinaleLinkMesh.visible = false;
    FinalePulseMesh.visible = false;
    FinaleSparkMesh.visible = false;
    FinaleLinkMaterial.opacity = 0;
    FinalePulseMaterial.opacity = 0;
    FinaleSparkMaterial.opacity = 0;
    Scene.background.copy(InitialSceneBackgroundColor);
    Renderer.toneMappingExposure = host.ActiveSystem.environment.toneMappingExposure;
    GameCanvas.dataset.finaleRestoration = '';

    for (const WorldDefinition of WorldDefinitions) {
      const IsInitiallyRestored = WorldDefinition.initiallyRestored === true;
      WorldDefinition.restored = IsInitiallyRestored;
      const WorldRuntime = WorldRuntimeByIdentifier.get(WorldDefinition.id);
      WorldRuntime.restorationStartedAtSeconds = IsInitiallyRestored ? -Infinity : null;
      WorldRuntime.suppressionStartedAtSeconds = null;
      WorldRuntime.restorationCompleted = IsInitiallyRestored;
      WorldRuntime.restorationOriginLocal.set(1, 0, 0);
      WorldRuntime.restorationUniforms.restorationOrigin.value.set(1, 0, 0);
      WorldRuntime.restorationUniforms.restorationProgress.value = IsInitiallyRestored
        ? 1.2
        : -0.1;
      WorldRuntime.restorationWaveMesh.visible = false;
      WorldRuntime.surfaceMaterial.color.set(0xffffff);
      WorldRuntime.atmosphereMaterial.opacity = IsInitiallyRestored
        ? WorldDefinition.restoration.atmosphereOpacity
        : 0.025;
      WorldRuntime.atmosphereMesh.scale.setScalar(IsInitiallyRestored ? 1 : 0.96);
      WorldRuntime.contourRingGroup.visible = IsInitiallyRestored;
      WorldRuntime.contourRingGroup.rotation.set(0, 0, 0);
      WorldRuntime.contourRingGroup.scale.setScalar(1);
      const StillnessPresentation = getStillnessPresentation(IsInitiallyRestored, 1);
      WorldRuntime.stillnessCageGroup.visible = StillnessPresentation.visible;
      WorldRuntime.stillnessCageGroup.rotation.set(0, 0, 0);
      WorldRuntime.stillnessCageGroup.scale.setScalar(StillnessPresentation.scale);
      WorldRuntime.stillnessCageMaterial.opacity = StillnessPresentation.opacity;
      WorldRuntime.group.rotation.set(0, 0, 0);
      WorldRuntime.group.scale.setScalar(1);
      if (WorldRuntime.ambientMoteGroup) {
        WorldRuntime.ambientMoteGroup.rotation.set(0, 0, 0);
        WorldRuntime.ambientMoteGroup.material.opacity = IsInitiallyRestored
          ? WorldRuntime.ambientMoteGroup.userData.baseOpacity
          : 0;
      }

      for (const SurfacePropObject of WorldRuntime.surfaceMarkerGroup.children) {
        const RestorationProgress = IsInitiallyRestored ? 1 : 0;
        setSurfacePropRestorationProgress(SurfacePropObject, RestorationProgress);
        SurfacePropObject.userData.restorationDistance = IsInitiallyRestored ? 0 : 1;
        SurfacePropObject.scale.setScalar(
          SurfacePropObject.userData.baseScale * (IsInitiallyRestored ? 1 : 0.05),
        );
      }
    }
  }

  return {
    restoreWorld,
    suppressWorld,
    attachSeedToWorld,
    attachSeedToSeedstone,
    attachSeedToWorldheart,
    completeWorldheartLiberation,
    updateFinaleRestorationVisuals,
    resetLandingDirector,
  };
}
