/**
 * Per-frame presentation that reads simulation state but never changes it:
 * stardust motes, restrained biome motion, the flight trail and the Runner /
 * launch-craft / flight-ship pose. All gameplay-visible transitions stay in
 * the fixed-step simulation and its directors.
 */

import { SurfaceGestureModes } from './controls.js';
import {
  getLiberationFlashOpacity,
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
    SeedHaloMesh,
    SeedHaloMaterial,
    LiberationFlashElement,
    LandingMarkerMesh,
    LaunchPulseMesh,
    ImpactPulseMesh,
    PullGuideLine,
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

  /** Animates uncollected motes and brightens those intersected by the current prediction. */
  function updateStardustVisuals(ElapsedTimeSeconds) {
    const ShouldShowStardust = ![
      'restoring',
      'victoryPending',
      'victory',
    ].includes(host.GamePhase);
    let HasVisibleStardust = false;

    for (let StardustIndex = 0; StardustIndex < StardustDefinitions.length; StardustIndex += 1) {
      const StardustDefinition = StardustDefinitions[StardustIndex];
      const IsPredictedPickup = host.PredictedStardustIdentifiers.has(StardustDefinition.id);
      const PulseScale = 0.9 + (Math.sin(
        (ElapsedTimeSeconds * 5.2) + (StardustIndex * 1.7),
      ) * 0.14);
      const StardustScale = StardustDefinition.collected
        ? 0
        : PulseScale * (IsPredictedPickup ? 1.55 : 1);
      HasVisibleStardust ||= !StardustDefinition.collected;

      StardustTransform.position.set(
        StardustDefinition.position.x,
        StardustDefinition.position.y,
        0.24,
      );
      StardustTransform.rotation.set(
        ElapsedTimeSeconds * (0.8 + (StardustIndex * 0.12)),
        ElapsedTimeSeconds * (1.1 + (StardustIndex * 0.09)),
        ElapsedTimeSeconds * 0.7,
      );
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
    for (const TrailParticle of TrailParticlePool) {
      if (TrailParticle.lifeRemainingSeconds <= 0) {
        continue;
      }

      TrailParticle.lifeRemainingSeconds -= DeltaTimeSeconds;

      if (TrailParticle.lifeRemainingSeconds <= 0) {
        updateTrailParticleInstance(TrailParticle, 0);
        continue;
      }

      const LifeRatio = TrailParticle.lifeRemainingSeconds / TrailParticle.maximumLifeSeconds;
      updateTrailParticleInstance(TrailParticle, 0.18 + (LifeRatio * 0.69));
    }
    TrailParticleMesh.instanceMatrix.needsUpdate = true;
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
    RunnerVisualGroup.visible = RunnerForm === 'astronaut';
    ShipVisualGroup.visible = RunnerForm !== 'astronaut';
    if (RunnerForm === 'launch-craft') {
      const UnfoldProgress = THREE.MathUtils.clamp(host.FlightElapsedSeconds / 0.28, 0, 1);
      ShipVisualGroup.scale.set(
        THREE.MathUtils.lerp(0.62, 1.08, UnfoldProgress) * ShipPresentationScale,
        THREE.MathUtils.lerp(0.82, 1, UnfoldProgress) * ShipPresentationScale,
        ShipPresentationScale,
      );
    } else {
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
      ShipVisualGroup.rotation.set(0, 0, 0);
      const AttachedBody = getWorldDefinition(host.CurrentWorldIdentifier)
        ?? TacticalBodyDefinitions.find(
          (BodyDefinition) => BodyDefinition.id === host.CurrentWorldIdentifier,
        );
      if (AttachedBody?.position) {
        SurfaceStandTo.set(
          host.SeedPhysicsState.position.x - AttachedBody.position.x,
          host.SeedPhysicsState.position.y - AttachedBody.position.y,
          (host.SeedPhysicsState.position.z ?? 0) - (AttachedBody.position.z ?? 0),
        );
        if (SurfaceStandTo.lengthSq() > 1e-8) {
          SurfaceStandTo.normalize();
          RunnerVisualGroup.quaternion.setFromUnitVectors(SurfaceStandFrom, SurfaceStandTo);
        }
      }
    }
    SeedHaloMesh.scale.setScalar(1 + (Math.sin(ElapsedTimeSeconds * 4.2) * 0.08));
    SeedHaloMaterial.color.setHex(
      RunnerAnimationState === 'recovering' ? 0xff766d : 0x6de8ff,
    );
    SeedHaloMaterial.opacity = (
      RunnerAnimationState === 'liberating' ? 0.2 : 0.105
    ) + (Math.sin(ElapsedTimeSeconds * 4.2) * 0.025);

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
      host.TrailEmissionAccumulatorSeconds += DeltaTimeSeconds;
      while (host.TrailEmissionAccumulatorSeconds >= 0.036) {
        emitTrailParticle();
        host.TrailEmissionAccumulatorSeconds -= 0.036;
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
      const LaunchProgress = 1 - (host.LaunchPulseLifeSeconds / 0.42);
      LaunchPulseMesh.scale.setScalar(1 + (LaunchProgress * 3.4));
      LaunchPulseMesh.material.opacity = (1 - LaunchProgress) * 0.68;
      LaunchPulseMesh.visible = host.LaunchPulseLifeSeconds > 0;
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
    PullGuideLine.visible = IsOpeningCoachVisible;
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
