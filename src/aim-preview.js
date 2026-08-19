/**
 * Launch aim preview. Must keep running inside the fixed physics step while aiming.
 * Trajectory colour and relay-port beacons encode lock, dock and hazard; there is no aim meter.
 */

import { evaluateRelayPortLanding } from './flight-resolver.js?v=20260819-ob141';
import { getBodySurfaceMarkerPosition } from './physics.js?v=20260819-ob141';

export function createAimPreview(THREE, host) {
  /**
   * Updates launch strength and trajectory from the current pointer position.
   *
   * @param {THREE.Vector3} CurrentPointerWorldPosition - Current pointer position in orbital space.
   */
  function updateAimPreview(CurrentPointerWorldPosition) {
    host.AimDragVector.set(
      host.SeedPhysicsState.position.x - CurrentPointerWorldPosition.x,
      host.SeedPhysicsState.position.y - CurrentPointerWorldPosition.y,
      0,
    );

    if (host.AimDragVector.length() > host.MaximumDragDistance) {
      host.AimDragVector.setLength(host.MaximumDragDistance);
    }

    const PowerRatio = THREE.MathUtils.clamp(host.AimDragVector.length() / host.MaximumDragDistance, 0, 1);
    host.AimLaunchVelocity.copy(host.AimDragVector).multiplyScalar(host.LaunchVelocityPerDragUnit);
    const WillCancel = host.shouldCancelAimedLaunch({
      pointerDistanceFromShip: host.AimDragVector.length(),
      cancelRadius: host.LaunchCancelRadius,
      screenDistancePixels: host.LastAimScreenDistancePixels,
      planningCameraCommitted: host.HasCommittedAimCamera === true,
    });
    host.GameCanvas.dataset.aimCancel = String(WillCancel);
    host.GameCanvas.dataset.aimPower = WillCancel ? '0' : String(Math.round(PowerRatio * 100));

    if (WillCancel) {
      host.clearTrajectoryPreview();
      if (host.HasCommittedAimCamera) {
        host.applySectorPlanningCamera();
      }
      host.WorldseedSound.updateAim(PowerRatio, false);
      return;
    }

    host.commitAimPlanningCamera();
    const TrajectoryPrediction = host.predictCurrentLaunchTrajectory(host.AimLaunchVelocity);
    const VisiblePredictionPoints = TrajectoryPrediction.points;
    const IsOutcomeVisible = TrajectoryPrediction.collisionKind !== null;
    host.GameCanvas.dataset.lastPredictionVisiblePoints = String(VisiblePredictionPoints.length);
    host.GameCanvas.dataset.lastPredictionTotalPoints = String(TrajectoryPrediction.points.length);
    host.GameCanvas.dataset.lastPredictionOutcomeVisible = String(IsOutcomeVisible);
    host.rememberPlanningPath(TrajectoryPrediction);
    host.applySectorPlanningCamera();
    const PredictedSlingshotEvents = host.predictSlingshotEvents(
      TrajectoryPrediction.points,
      host.WorldDefinitions,
      {
        runnerRadius: host.SeedRadius,
        ignoredBodyIdentifier: host.getWorldDefinition(host.CurrentWorldIdentifier)
          ? host.CurrentWorldIdentifier
          : null,
      },
    );
    host.PredictedStardustIdentifiers.clear();
    for (const StardustIdentifier of host.getTrajectoryPickupIdentifiers(
      VisiblePredictionPoints,
      host.StardustDefinitions,
      host.StardustCollectionRadius,
    )) {
      host.PredictedStardustIdentifiers.add(StardustIdentifier);
    }

    host.renderTrajectoryLine(VisiblePredictionPoints);

    const FinalPredictionPoint = TrajectoryPrediction.points[TrajectoryPrediction.points.length - 1];

    if (IsOutcomeVisible && TrajectoryPrediction.collisionKind === 'hazard') {
      host.TrajectoryMaterial.color.set(0xff766d);
      host.TrajectoryMaterial.opacity = 0.88;
      host.LandingMarkerMaterial.color.set(0xff766d);
      host.LandingMarkerMesh.position.set(FinalPredictionPoint.x, FinalPredictionPoint.y, 0.2);
      host.LandingMarkerMesh.visible = true;
    } else if (IsOutcomeVisible && TrajectoryPrediction.collisionKind === 'seedstone') {
      const SeedstonePosition = host.calculateBodyPositionAtTime(
        host.SeedstoneDefinition,
        TrajectoryPrediction.collisionTimeSeconds,
      );
      host.TrajectoryMaterial.color.set(0x72d9ff);
      host.TrajectoryMaterial.opacity = 0.86;
      host.LandingMarkerMaterial.color.set(0x72d9ff);
      const LandingDirection = host.TemporaryThreeVector.set(
        FinalPredictionPoint.x - SeedstonePosition.x,
        FinalPredictionPoint.y - SeedstonePosition.y,
        0,
      ).normalize();
      host.LandingMarkerMesh.position.set(
        SeedstonePosition.x + (LandingDirection.x * (host.SeedstoneDefinition.radius + 0.08)),
        SeedstonePosition.y + (LandingDirection.y * (host.SeedstoneDefinition.radius + 0.08)),
        0.2,
      );
      host.LandingMarkerMesh.visible = true;
    } else if (IsOutcomeVisible && TrajectoryPrediction.collisionKind === 'worldheart') {
      host.TrajectoryMaterial.color.set(0xffd678);
      host.TrajectoryMaterial.opacity = 0.9;
      host.LandingMarkerMaterial.color.set(0xffd678);
      const CommandCollisionTime = Number.isFinite(TrajectoryPrediction.collisionTimeSeconds)
        ? TrajectoryPrediction.collisionTimeSeconds
        : host.PhysicsElapsedTimeSeconds;
      const CommandMarker = getBodySurfaceMarkerPosition(
        host.WorldheartDefinition,
        FinalPredictionPoint,
        CommandCollisionTime,
      );
      host.LandingMarkerMesh.position.set(CommandMarker.x, CommandMarker.y, CommandMarker.z);
      host.LandingMarkerMesh.visible = true;
    } else if (IsOutcomeVisible && TrajectoryPrediction.collisionWorldIdentifier) {
      const LandingWorldDefinition = host.getWorldDefinition(TrajectoryPrediction.collisionWorldIdentifier);
      const IsNewWorldLanding = !LandingWorldDefinition.restored;
      const PortLanding = IsNewWorldLanding
        ? evaluateRelayPortLanding(
          LandingWorldDefinition,
          FinalPredictionPoint,
          LandingWorldDefinition.position,
        )
        : null;
      const MissesPort = PortLanding !== null && !PortLanding.insidePort;
      const IsBullseye = PortLanding?.precisionTier === 'bullseye';
      const PreviewColor = MissesPort ? 0x8fb7d9 : (IsNewWorldLanding ? 0xffd98a : 0xbceca8);
      host.TrajectoryMaterial.color.set(PreviewColor);
      host.TrajectoryMaterial.opacity = 0.82;
      host.LandingMarkerMaterial.color.set(IsBullseye ? 0xfff3cd : PreviewColor);
      if (MissesPort) {
        host.showInstruction(
          `Dock only at ${LandingWorldDefinition.label}`,
          'The gold beacon arc is the liberation landing. This line still docks and links the relay.',
          'missed-port',
        );
      }
      const LandingDirection = host.TemporaryThreeVector.set(
        FinalPredictionPoint.x - LandingWorldDefinition.position.x,
        FinalPredictionPoint.y - LandingWorldDefinition.position.y,
        0,
      ).normalize();
      host.LandingMarkerMesh.position.set(
        LandingWorldDefinition.position.x + (LandingDirection.x * (LandingWorldDefinition.radius + 0.08)),
        LandingWorldDefinition.position.y + (LandingDirection.y * (LandingWorldDefinition.radius + 0.08)),
        0.2,
      );
      host.LandingMarkerMesh.visible = true;
    } else if (!IsOutcomeVisible) {
      host.TrajectoryMaterial.color.set(0x9db8c6);
      host.TrajectoryMaterial.opacity = 0.48;
      host.LandingMarkerMesh.visible = false;
    } else {
      host.TrajectoryMaterial.color.set(0x9db8c6);
      host.TrajectoryMaterial.opacity = 0.48;
      host.LandingMarkerMesh.visible = false;
    }
    host.PredictedSlingshotWorldIdentifiers.clear();
    for (const SlingshotEvent of PredictedSlingshotEvents) {
      host.PredictedSlingshotWorldIdentifiers.add(SlingshotEvent.bodyIdentifier);
    }
    if (PredictedSlingshotEvents.length > 0) {
      const ChainPreview = host.getSlingshotPreviewPresentation(PredictedSlingshotEvents.length);
      if (ChainPreview && TrajectoryPrediction.collisionKind !== 'hazard') {
        if (!IsOutcomeVisible || TrajectoryPrediction.collisionKind === null) {
          host.TrajectoryMaterial.color.setHex(ChainPreview.color);
          host.TrajectoryMaterial.opacity = ChainPreview.opacity;
        }
      }
    }
    host.WorldseedSound.updateAim(
      PowerRatio,
      IsOutcomeVisible
        && TrajectoryPrediction.collisionKind !== null
        && TrajectoryPrediction.collisionKind !== 'hazard',
    );
  }

  /** Rebuilds the virtual pull point used by keyboard aiming through the pointer preview path. */
  function updateKeyboardAimPreview() {
    const DragVector = host.getKeyboardAimDragVector(host.KeyboardAimState, host.MaximumDragDistance);
    host.LastAimPointerWorldPosition.set(
      host.SeedPhysicsState.position.x - DragVector.x,
      host.SeedPhysicsState.position.y - DragVector.y,
      0,
    );
    updateAimPreview(host.LastAimPointerWorldPosition);
    host.GameCanvas.dataset.keyboardAimAngle = String(Math.round(
      THREE.MathUtils.radToDeg(host.KeyboardAimState.angleRadians) * 10,
    ) / 10);
    host.GameCanvas.dataset.keyboardAimPower = String(Math.round(host.KeyboardAimState.powerRatio * 100));
  }

  return {
    updateAimPreview,
    updateKeyboardAimPreview,
  };
}
