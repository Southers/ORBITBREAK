/**
 * Per-frame presentation that reads simulation state but never changes it:
 * stardust motes, restrained biome motion, the flight trail and the Runner /
 * launch-craft / flight-ship pose. All gameplay-visible transitions stay in
 * the fixed-step simulation and its directors.
 */

import { SurfaceGestureModes } from './controls.js';
import {
  getLandedVerbHighlight,
  getLiberationFlashOpacity,
  getParkedShipPresentation,
  getRunnerAnimationState,
  getRunnerForm,
  getRunnerPose,
} from './presentation.js';

export function createFrameVisuals(THREE, host) {
  const {
    GameCanvas,
    Camera,
    SeedGroup,
    RouteLabelProjection,
    StardustDefinitions,
    StardustTransform,
    StardustMesh,
    StardustPredictedColor,
    StardustBaseColor,
    ShaderMotionVisualKeys,
    WorldRuntimesByVisualKey,
    EmptyWorldRuntimeList,
    SurfaceSwayQuaternion,
    LocalSwayAxis,
    TrailParticlePool,
    TrailParticleMesh,
    updateTrailParticleInstance,
    RunnerVisualGroup,
    ShipVisualGroup,
    ShipPresentationScale,
    RunnerArmMeshes,
    RunnerLegMeshes,
    RunnerThrusterGroup,
    ShipThrusterMesh,
    SeedHaloMesh,
    SeedHaloMaterial,
    WorldWalkHaloMesh,
    WorldWalkHaloMaterial,
    WalkCursorMesh,
    WalkCursorMaterial,
    LiberationFlashElement,
    LandingMarkerMesh,
    LaunchPulseMesh,
    ImpactPulseMesh,
    PullGuideLine,
    PullGuideRibbon,
    PullGuideMaterial,
    CutGuideLine,
    CutGuideMaterial,
    CircuitBeaconLine,
    CircuitBeaconMaterial,
    StartingWorldIdentifier,
    TacticalBodyDefinitions,
    getWorldDefinition,
    updateTargetBeacons,
    updateFlightPlanningPresentation,
  } = host;

  let NextTrailParticleIndex = 0;
  const SurfaceStandFrom = new THREE.Vector3(0, 1, 0);
  const SurfaceStandTo = new THREE.Vector3();
  const ParkedShipStarboard = new THREE.Vector3();
  const ParkedShipNose = new THREE.Vector3();
  const ParkedShipDorsal = new THREE.Vector3();
  const ParkedShipBasis = new THREE.Matrix4();

  let LastStardustSignature = '';
  let LastTrailLiveCount = -1;

  function getPresentationQuality() {
    return host.AdaptivePresentationSettings ?? null;
  }

  /** Animates uncollected motes and brightens those intersected by the current prediction. */
  function updateStardustVisuals(ElapsedTimeSeconds) {
    const ShouldShowStardust = ![
      'restoring',
      'victoryPending',
      'victory',
    ].includes(host.GamePhase);
    const QualitySettings = getPresentationQuality();
    const ShouldSpin = QualitySettings?.stardustSpin !== false;
    let HasVisibleStardust = false;
    let CollectedSignature = '';
    let PredictedSignature = '';

    for (let StardustIndex = 0; StardustIndex < StardustDefinitions.length; StardustIndex += 1) {
      const StardustDefinition = StardustDefinitions[StardustIndex];
      CollectedSignature += StardustDefinition.collected ? '1' : '0';
      if (host.PredictedStardustIdentifiers.has(StardustDefinition.id)) {
        PredictedSignature += `${StardustDefinition.id},`;
      }
      HasVisibleStardust ||= !StardustDefinition.collected;
    }

    const VisibilitySignature = `${ShouldShowStardust}|${HasVisibleStardust}|${CollectedSignature}|${PredictedSignature}`;
    if (!ShouldSpin && VisibilitySignature === LastStardustSignature) {
      StardustMesh.visible = ShouldShowStardust && HasVisibleStardust;
      return;
    }
    LastStardustSignature = VisibilitySignature;

    for (let StardustIndex = 0; StardustIndex < StardustDefinitions.length; StardustIndex += 1) {
      const StardustDefinition = StardustDefinitions[StardustIndex];
      const IsPredictedPickup = host.PredictedStardustIdentifiers.has(StardustDefinition.id);
      const PulseScale = ShouldSpin
        ? 0.9 + (Math.sin(
          (ElapsedTimeSeconds * 5.2) + (StardustIndex * 1.7),
        ) * 0.14)
        : 1;
      const StardustScale = StardustDefinition.collected
        ? 0
        : PulseScale * (IsPredictedPickup ? 1.55 : 1);

      StardustTransform.position.set(
        StardustDefinition.position.x,
        StardustDefinition.position.y,
        0.24,
      );
      if (ShouldSpin) {
        StardustTransform.rotation.set(
          ElapsedTimeSeconds * (0.8 + (StardustIndex * 0.12)),
          ElapsedTimeSeconds * (1.1 + (StardustIndex * 0.09)),
          ElapsedTimeSeconds * 0.7,
        );
      } else {
        StardustTransform.rotation.set(0, 0, 0);
      }
      StardustTransform.scale.setScalar(StardustScale);
      StardustTransform.updateMatrix();
      StardustMesh.setMatrixAt(StardustIndex, StardustTransform.matrix);
      StardustMesh.setColorAt(
        StardustIndex,
        IsPredictedPickup ? StardustPredictedColor : StardustBaseColor,
      );
    }

    StardustMesh.instanceMatrix.needsUpdate = true;
    StardustMesh.instanceColor.needsUpdate = true;
    StardustMesh.visible = ShouldShowStardust && HasVisibleStardust;
  }

  function emitTrailParticle() {
    const TrailParticle = TrailParticlePool[NextTrailParticleIndex];
    NextTrailParticleIndex = (NextTrailParticleIndex + 1) % TrailParticlePool.length;

    TrailParticle.position.copy(SeedGroup.position);
    TrailParticle.lifeRemainingSeconds = TrailParticle.maximumLifeSeconds;
    updateTrailParticleInstance(TrailParticle, 0.78);
    TrailParticleMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Advances trail fade and scale animation.
   *
   * @param {number} DeltaTimeSeconds - Real frame delta.
   */
  function updateTrailParticles(DeltaTimeSeconds) {
    const QualitySettings = getPresentationQuality();
    if (QualitySettings?.trailUpdates === false) {
      return;
    }
    let LiveCount = 0;
    for (const TrailParticle of TrailParticlePool) {
      if (TrailParticle.lifeRemainingSeconds <= 0) {
        continue;
      }

      TrailParticle.lifeRemainingSeconds -= DeltaTimeSeconds;
      LiveCount += 1;

      if (TrailParticle.lifeRemainingSeconds <= 0) {
        updateTrailParticleInstance(TrailParticle, 0);
        continue;
      }

      const LifeRatio = TrailParticle.lifeRemainingSeconds / TrailParticle.maximumLifeSeconds;
      updateTrailParticleInstance(TrailParticle, 0.18 + (LifeRatio * 0.69));
    }
    if (LiveCount > 0 || LastTrailLiveCount !== 0) {
      TrailParticleMesh.instanceMatrix.needsUpdate = true;
    }
    LastTrailLiveCount = LiveCount;
  }

  /** Adds distinct, restrained biome motion without distracting from aiming. */
  function updateWorldBiomeMotion(DeltaTimeSeconds, ElapsedTimeSeconds) {
    for (const VisualKey of ShaderMotionVisualKeys) {
      for (const WorldRuntime of (
        WorldRuntimesByVisualKey.get(VisualKey) ?? EmptyWorldRuntimeList
      )) {
        WorldRuntime.restorationUniforms.biomeTime.value = ElapsedTimeSeconds;
      }
    }

    for (const MeadowRuntime of (
      WorldRuntimesByVisualKey.get('meadow') ?? EmptyWorldRuntimeList
    )) {
      for (const SurfacePropObject of MeadowRuntime.surfaceMarkerGroup.children) {
        if (SurfacePropObject.userData.swayAmount) {
          const SwayAngle = Math.sin(
            (ElapsedTimeSeconds * 1.55) + SurfacePropObject.userData.swayPhase,
          ) * SurfacePropObject.userData.swayAmount;
          SurfaceSwayQuaternion.setFromAxisAngle(LocalSwayAxis, SwayAngle);
          SurfacePropObject.quaternion.copy(SurfacePropObject.userData.baseQuaternion).multiply(
            SurfaceSwayQuaternion,
          );
        }

        if (SurfacePropObject.userData.kind === 'pond') {
          SurfacePropObject.userData.waterMaterial.emissiveIntensity = 0.4
            + (Math.sin(ElapsedTimeSeconds * 1.8) * 0.08);
        }

        if (SurfacePropObject.userData.kind === 'cottage') {
          SurfacePropObject.userData.windowMaterial.emissiveIntensity = 0.7
            + (Math.sin((ElapsedTimeSeconds * 2.1) + 0.6) * 0.08);
        }
      }

      if (MeadowRuntime.ambientMoteGroup) {
        MeadowRuntime.ambientMoteGroup.rotation.y += DeltaTimeSeconds * 0.09;
        MeadowRuntime.ambientMoteGroup.rotation.z += DeltaTimeSeconds * 0.025;
        MeadowRuntime.ambientMoteGroup.material.opacity = (
          MeadowRuntime.ambientMoteGroup.userData.baseOpacity
          + (Math.sin(ElapsedTimeSeconds * 2.4) * 0.1)
        );
      }
    }

    for (const EmberRuntime of (
      WorldRuntimesByVisualKey.get('ember') ?? EmptyWorldRuntimeList
    )) {
      for (const SurfacePropObject of EmberRuntime.surfaceMarkerGroup.children) {
        const LavaMaterial = SurfacePropObject.userData.lavaMaterial
          ?? SurfacePropObject.userData.heatMaterial;
        if (LavaMaterial && EmberRuntime.definition.restored) {
          const Phase = SurfacePropObject.userData.motionPhase ?? 0;
          const BaseIntensity = SurfacePropObject.userData.kind === 'volcano' ? 2.2 : 1.8;
          LavaMaterial.emissiveIntensity = BaseIntensity
            + (Math.sin((ElapsedTimeSeconds * 4.2) + Phase) * 0.24);
        }
      }
      if (EmberRuntime.ambientMoteGroup) {
        EmberRuntime.ambientMoteGroup.rotation.y += DeltaTimeSeconds * 0.34;
        EmberRuntime.ambientMoteGroup.rotation.z -= DeltaTimeSeconds * 0.09;
      }
    }

    for (const FrostRuntime of (
      WorldRuntimesByVisualKey.get('frost') ?? EmptyWorldRuntimeList
    )) {
      for (const SurfacePropObject of FrostRuntime.surfaceMarkerGroup.children) {
        const CrystalMaterial = SurfacePropObject.userData.crystalMaterial;
        if (CrystalMaterial && FrostRuntime.definition.restored) {
          const Phase = SurfacePropObject.userData.motionPhase ?? 0;
          const BaseIntensity = SurfacePropObject.userData.kind === 'iceArch' ? 0.62 : 0.58;
          CrystalMaterial.emissiveIntensity = BaseIntensity
            + (Math.sin((ElapsedTimeSeconds * 1.25) + Phase) * 0.1);
        }
      }
      if (FrostRuntime.ambientMoteGroup) {
        FrostRuntime.ambientMoteGroup.rotation.y += DeltaTimeSeconds * 0.045;
        FrostRuntime.ambientMoteGroup.rotation.x += DeltaTimeSeconds * 0.018;
      }
    }
  }

  /**
   * Updates seed animation and trail independent of fixed-step physics.
   *
   * @param {number} DeltaTimeSeconds - Real frame delta.
   * @param {number} ElapsedTimeSeconds - Total elapsed game time.
   */
  function updateSeedVisuals(DeltaTimeSeconds, ElapsedTimeSeconds) {
    SeedGroup.position.set(
      host.SeedPhysicsState.position.x,
      host.SeedPhysicsState.position.y,
      host.SeedPhysicsState.position.z,
    );
    RouteLabelProjection.copy(SeedGroup.position).project(Camera);
    GameCanvas.dataset.seedScreenX = String(Math.round(
      (RouteLabelProjection.x * 0.5 + 0.5) * window.innerWidth,
    ));
    GameCanvas.dataset.seedScreenY = String(Math.round(
      (-RouteLabelProjection.y * 0.5 + 0.5) * window.innerHeight,
    ));
    GameCanvas.dataset.runnerScreenX = GameCanvas.dataset.seedScreenX;
    GameCanvas.dataset.runnerScreenY = GameCanvas.dataset.seedScreenY;

    const IsWalking = (
      host.PointerGestureMode === SurfaceGestureModes.walk
      || host.RunnerWalkLifeSeconds > 0
    ) && host.GamePhase === 'attached';
    if (host.RunnerWalkLifeSeconds > 0) {
      host.RunnerWalkLifeSeconds = Math.max(0, host.RunnerWalkLifeSeconds - DeltaTimeSeconds);
    }
    const RunnerAnimationState = getRunnerAnimationState(
      host.GamePhase,
      host.IsPointerAiming || host.IsKeyboardAiming,
      IsWalking && !host.PrefersReducedMotion,
    );
    const RunnerPose = getRunnerPose(
      RunnerAnimationState,
      ElapsedTimeSeconds * 9.2,
    );
    const RunnerForm = getRunnerForm(host.GamePhase, host.FlightElapsedSeconds);
    const PoseBlend = host.PrefersReducedMotion
      ? 1
      : 1 - Math.exp(-DeltaTimeSeconds * 13);
    GameCanvas.dataset.runnerAnimation = RunnerAnimationState;
    GameCanvas.dataset.runnerForm = RunnerForm;
    const ShowParkedShip = RunnerForm === 'astronaut';
    RunnerVisualGroup.visible = ShowParkedShip;
    ShipVisualGroup.visible = true;
    GameCanvas.dataset.parkedShip = String(ShowParkedShip);
    if (RunnerForm === 'launch-craft') {
      const UnfoldProgress = THREE.MathUtils.clamp(host.FlightElapsedSeconds / 0.28, 0, 1);
      ShipVisualGroup.scale.set(
        THREE.MathUtils.lerp(0.62, 1.08, UnfoldProgress) * ShipPresentationScale,
        THREE.MathUtils.lerp(0.82, 1, UnfoldProgress) * ShipPresentationScale,
        ShipPresentationScale,
      );
    } else if (!ShowParkedShip) {
      ShipVisualGroup.scale.set(
        1.08 * ShipPresentationScale,
        ShipPresentationScale,
        ShipPresentationScale,
      );
    }
    for (const ArmMesh of RunnerArmMeshes) {
      ArmMesh.rotation.z = THREE.MathUtils.lerp(
        ArmMesh.rotation.z,
        ArmMesh.userData.side * -RunnerPose.armAngle,
        PoseBlend,
      );
    }
    for (const LegMesh of RunnerLegMeshes) {
      LegMesh.rotation.z = THREE.MathUtils.lerp(
        LegMesh.rotation.z,
        LegMesh.userData.side * -RunnerPose.legAngle,
        PoseBlend,
      );
    }
    RunnerThrusterGroup.visible = RunnerPose.thrusterVisible;
    if (RunnerPose.thrusterVisible) {
      const Speed = Math.hypot(host.SeedPhysicsState.velocity.x, host.SeedPhysicsState.velocity.y);
      const ThrusterScale = 0.76 + Math.min(0.55, Speed * 0.024)
        + (host.PrefersReducedMotion ? 0 : Math.sin(ElapsedTimeSeconds * 32) * 0.08);
      RunnerThrusterGroup.scale.set(1, ThrusterScale, 1);
    }

    if (host.GamePhase === 'flying') {
      ShipVisualGroup.position.set(0, 0, 0);
      ShipVisualGroup.quaternion.identity();
      const FlightAngle = Math.atan2(
        host.SeedPhysicsState.velocity.y,
        host.SeedPhysicsState.velocity.x,
      );
      RunnerVisualGroup.rotation.z = FlightAngle - (Math.PI * 0.5);
      ShipVisualGroup.rotation.z = FlightAngle - (Math.PI * 0.5);
      ShipVisualGroup.rotation.y = host.PrefersReducedMotion
        ? 0
        : Math.sin(ElapsedTimeSeconds * 3.2) * 0.08;
      RunnerVisualGroup.rotation.y += DeltaTimeSeconds * 1.8;
      RunnerVisualGroup.rotation.x = THREE.MathUtils.lerp(
        RunnerVisualGroup.rotation.x,
        0,
        PoseBlend,
      );
    } else {
      const AttachedBody = getWorldDefinition(host.CurrentWorldIdentifier)
        ?? TacticalBodyDefinitions.find(
          (BodyDefinition) => BodyDefinition.id === host.CurrentWorldIdentifier,
        );
      let HasSurfaceNormal = false;
      if (AttachedBody?.position) {
        SurfaceStandTo.set(
          host.SeedPhysicsState.position.x - AttachedBody.position.x,
          host.SeedPhysicsState.position.y - AttachedBody.position.y,
          (host.SeedPhysicsState.position.z ?? 0) - (AttachedBody.position.z ?? 0),
        );
        if (SurfaceStandTo.lengthSq() > 1e-8) {
          SurfaceStandTo.normalize();
          HasSurfaceNormal = true;
          RunnerVisualGroup.quaternion.setFromUnitVectors(SurfaceStandFrom, SurfaceStandTo);
        }
      }
      const ParkedShip = getParkedShipPresentation(
        HasSurfaceNormal
          ? {
            surfaceNormalX: SurfaceStandTo.x,
            surfaceNormalY: SurfaceStandTo.y,
            surfaceNormalZ: SurfaceStandTo.z,
          }
          : {},
      );
      ParkedShipStarboard.set(
        ParkedShip.starboard.x,
        ParkedShip.starboard.y,
        ParkedShip.starboard.z,
      );
      ParkedShipNose.set(ParkedShip.nose.x, ParkedShip.nose.y, ParkedShip.nose.z);
      ParkedShipDorsal.set(ParkedShip.dorsal.x, ParkedShip.dorsal.y, ParkedShip.dorsal.z);
      ParkedShipBasis.makeBasis(ParkedShipStarboard, ParkedShipNose, ParkedShipDorsal);
      ShipVisualGroup.quaternion.setFromRotationMatrix(ParkedShipBasis);
      ShipVisualGroup.position.set(
        ParkedShip.offset.x,
        ParkedShip.offset.y,
        ParkedShip.offset.z,
      );
      ShipVisualGroup.scale.set(
        ParkedShip.scaleX * ShipPresentationScale,
        ParkedShip.scaleY * ShipPresentationScale,
        ParkedShip.scaleZ * ShipPresentationScale,
      );
    }
    const CanvasClassList = GameCanvas.classList;
    const HasCanvasClass = (Name) => (
      typeof CanvasClassList?.contains === 'function' && CanvasClassList.contains(Name)
    );
    const IsChargingLaunch = host.IsPointerAiming || host.IsKeyboardAiming;
    const VerbHighlight = getLandedVerbHighlight({
      gamePhase: host.GamePhase,
      hasWalkedOnce: host.HasWalkedOnce === true,
      hasGrabbedShipOnce: host.HasGrabbedShipOnce === true,
      hasLaunchedOnce: host.HasLaunchedOnce === true,
      isGrabReady: HasCanvasClass('is-grab-ready'),
      isShipArmed: HasCanvasClass('is-ship-armed'),
      isAiming: IsChargingLaunch,
      isWalkReady: HasCanvasClass('is-walk-ready'),
      isWalking: host.PointerGestureMode === SurfaceGestureModes.walk
        || host.IsPointerWalking === true,
    });
    const ShowShipCue = VerbHighlight.shipHaloCharge === true
      || RunnerAnimationState === 'recovering';
    SeedHaloMesh.visible = ShowShipCue;
    if (ShowShipCue) {
      SeedHaloMesh.position.copy(ShipVisualGroup.position);
      SeedHaloMesh.lookAt(Camera.position);
      SeedHaloMesh.scale.setScalar(
        1 + (Math.sin(ElapsedTimeSeconds * (VerbHighlight.shipHaloCharge ? 7.4 : 4.2)) * 0.04),
      );
      if (RunnerAnimationState === 'recovering') {
        SeedHaloMaterial.color.setHex(0xff766d);
      } else {
        SeedHaloMaterial.color.setHex(0xc4f7a6);
      }
      SeedHaloMaterial.opacity = 0.38
        + (Math.sin(ElapsedTimeSeconds * 4.2) * 0.05);
    } else {
      SeedHaloMaterial.opacity = 0;
    }

    if (WorldWalkHaloMesh) {
      WorldWalkHaloMesh.visible = false;
      WorldWalkHaloMaterial.opacity = 0;
    }
    if (WalkCursorMesh) {
      WalkCursorMesh.visible = false;
      WalkCursorMaterial.opacity = 0;
    }

    if (host.LiberationFlashLifeSeconds > 0) {
      host.LiberationFlashLifeSeconds = Math.max(
        0,
        host.LiberationFlashLifeSeconds - DeltaTimeSeconds,
      );
      LiberationFlashElement.style.opacity = String(getLiberationFlashOpacity(
        host.LiberationFlashLifeSeconds,
      ));
    } else {
      LiberationFlashElement.style.opacity = '0';
    }

    if (host.GamePhase === 'flying') {
      updateFlightPlanningPresentation();
      if (getPresentationQuality()?.trailUpdates !== false) {
        host.TrailEmissionAccumulatorSeconds += DeltaTimeSeconds;
        while (host.TrailEmissionAccumulatorSeconds >= 0.036) {
          emitTrailParticle();
          host.TrailEmissionAccumulatorSeconds -= 0.036;
        }
      }
    }

    updateTrailParticles(DeltaTimeSeconds);

    if (LandingMarkerMesh.visible) {
      LandingMarkerMesh.rotation.z += DeltaTimeSeconds * 1.7;
      const LandingPulseScale = 1 + (Math.sin(ElapsedTimeSeconds * 6) * 0.11);
      LandingMarkerMesh.scale.setScalar(LandingPulseScale);
    }

    if (host.LaunchPulseLifeSeconds > 0) {
      host.LaunchPulseLifeSeconds = Math.max(0, host.LaunchPulseLifeSeconds - DeltaTimeSeconds);
      const PulseDuration = host.LaunchPulseDurationSeconds > 0
        ? host.LaunchPulseDurationSeconds
        : 0.42;
      const LaunchProgress = 1 - (host.LaunchPulseLifeSeconds / PulseDuration);
      LaunchPulseMesh.scale.setScalar(1 + (LaunchProgress * 3.4));
      LaunchPulseMesh.material.opacity = (1 - LaunchProgress) * 0.68;
      LaunchPulseMesh.visible = host.LaunchPulseLifeSeconds > 0;
    }

    if (ShipThrusterMesh) {
      ShipThrusterMesh.visible = !ShowParkedShip;
      if (host.BreakerBurnFlareLifeSeconds > 0) {
        host.BreakerBurnFlareLifeSeconds = Math.max(
          0,
          host.BreakerBurnFlareLifeSeconds - DeltaTimeSeconds,
        );
      }
      const FlareLife = host.BreakerBurnFlareLifeSeconds ?? 0;
      const FlareScale = FlareLife > 0 ? 1 + ((FlareLife / 0.55) * 2.4) : 1;
      ShipThrusterMesh.scale.setScalar(FlareScale);
    }

    if (host.ImpactPulseLifeSeconds > 0) {
      host.ImpactPulseLifeSeconds = Math.max(0, host.ImpactPulseLifeSeconds - DeltaTimeSeconds);
      const ImpactProgress = 1 - (host.ImpactPulseLifeSeconds / 0.58);
      ImpactPulseMesh.scale.setScalar(1 + (ImpactProgress * 6.2));
      ImpactPulseMesh.material.opacity = (1 - ImpactProgress) * 0.9;
      ImpactPulseMesh.visible = host.ImpactPulseLifeSeconds > 0;
      SeedGroup.scale.setScalar(1 + (Math.sin(ImpactProgress * Math.PI) * 0.16));
    } else {
      SeedGroup.scale.setScalar(1);
    }

    const IsOpeningCoachVisible = host.GamePhase === 'attached'
      && host.CurrentWorldIdentifier === StartingWorldIdentifier
      && !host.HasLaunchedOnce
      && !host.IsOpeningBriefingActive;
    PullGuideLine.visible = false;
    PullGuideRibbon.mesh.visible = IsOpeningCoachVisible;
    updateTargetBeacons(ElapsedTimeSeconds);
    if (IsOpeningCoachVisible) {
      PullGuideMaterial.dashOffset -= DeltaTimeSeconds * 0.9;
    }
    if (CutGuideLine.visible) {
      CutGuideMaterial.dashOffset -= DeltaTimeSeconds * 1.4;
    }
    if (CircuitBeaconLine.visible) {
      CircuitBeaconMaterial.dashOffset -= DeltaTimeSeconds * 0.55;
    }
  }

  return {
    updateStardustVisuals,
    updateWorldBiomeMotion,
    updateSeedVisuals,
    updateTrailParticles,
  };
}
