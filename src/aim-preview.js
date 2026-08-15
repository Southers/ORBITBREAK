/**
 * Launch aim preview. Must keep running inside the fixed physics step while aiming.
 */

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
    });
    host.AimPanelElement.classList.toggle('is-cancel', WillCancel);
    host.AimPowerFillElement.style.width = WillCancel ? '0%' : `${Math.round(PowerRatio * 100)}%`;
    host.AimPowerFillElement.style.transform = 'none';
    host.AimPowerValueElement.textContent = WillCancel ? 'CANCEL' : `${Math.round(PowerRatio * 100)}%`;

    if (WillCancel) {
      host.clearTrajectoryPreview();
      host.applySectorPlanningCamera();
      host.AimLabelElement.textContent = 'RELEASE TO CANCEL';
      host.WorldseedSound.updateAim(PowerRatio, false);
      return;
    }

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
    const PowerPercentage = Math.round(PowerRatio * 100);
    host.AimPowerFillElement.style.width = `${PowerPercentage}%`;
    host.AimPowerValueElement.textContent = `${PowerPercentage}%`;

    if (IsOutcomeVisible && TrajectoryPrediction.collisionKind === 'hazard') {
      host.TrajectoryMaterial.color.set(0xff766d);
      host.TrajectoryMaterial.opacity = 0.88;
      host.LandingMarkerMaterial.color.set(0xff766d);
      host.AimPanelElement.classList.remove('is-locked');
      host.AimLabelElement.textContent = `${host.AsteroidDefinition.label} COLLISION`;
      host.showInstruction(
        'Red means impact',
        'Wait for the asteroid to move or change the launch angle.',
      );
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
      host.AimPanelElement.classList.add('is-locked');
      host.AimLabelElement.textContent = `${host.SeedstoneDefinition.label} LOCKED`;
      host.showInstruction(
        'Release to land on the Seedstone',
        'Blue means a one-use tactical launchpad. It does not awaken a world.',
      );
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
      host.AimPanelElement.classList.add('is-locked');
      host.AimLabelElement.textContent = `${host.WorldheartDefinition.label} LOCKED`;
      host.showInstruction(
        host.IsCampaignFinale
          ? 'Release to reconnect the Worldheart'
          : 'Release to board the Command World',
        host.IsCampaignFinale
          ? host.isSystemRestored(host.WorldDefinitions)
            ? 'Heart, Bloom and Arc will record the journey you completed.'
            : 'You can leave now, or awaken every world first to earn Bloom.'
          : host.isSystemRestored(host.WorldDefinitions)
            ? 'Every world is free. Gold marks the moving command lock.'
            : 'Gold means the moving command is locked. Release before it leaves the line.',
      );
      const LandingDirection = host.TemporaryThreeVector.set(
        FinalPredictionPoint.x - host.WorldheartDefinition.position.x,
        FinalPredictionPoint.y - host.WorldheartDefinition.position.y,
        0,
      ).normalize();
      host.LandingMarkerMesh.position.set(
        host.WorldheartDefinition.position.x
          + (LandingDirection.x * (host.WorldheartDefinition.radius + 0.08)),
        host.WorldheartDefinition.position.y
          + (LandingDirection.y * (host.WorldheartDefinition.radius + 0.08)),
        0.2,
      );
      host.LandingMarkerMesh.visible = true;
    } else if (IsOutcomeVisible && TrajectoryPrediction.collisionWorldIdentifier) {
      const LandingWorldDefinition = host.getWorldDefinition(TrajectoryPrediction.collisionWorldIdentifier);
      const IsNewWorldLanding = !LandingWorldDefinition.restored;
      host.TrajectoryMaterial.color.set(IsNewWorldLanding ? 0xffd98a : 0xbceca8);
      host.TrajectoryMaterial.opacity = 0.82;
      host.LandingMarkerMaterial.color.set(IsNewWorldLanding ? 0xffd98a : 0xbceca8);
      host.AimPanelElement.classList.add('is-locked');
      host.AimLabelElement.textContent = host.getWorldLandingAimLabel(
        LandingWorldDefinition.label,
        IsNewWorldLanding,
      );
      host.showInstruction(
        (IsNewWorldLanding ? 'Release to awaken ' : 'Release to land on ')
          + LandingWorldDefinition.label,
        IsNewWorldLanding
          ? 'Gold means a new world. This landing becomes your next launch point.'
          : 'Green means a restored safe landing.',
      );
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
      host.AimPanelElement.classList.remove('is-locked');
      host.AimLabelElement.textContent = PredictedSlingshotEvents.length >= 2 ? 'CHAIN ARC' : 'OPEN ARC';
      host.showInstruction(
        PredictedSlingshotEvents.length >= 2
          ? 'This line chains multiple worlds'
          : 'No landing yet',
        PredictedSlingshotEvents.length >= 2
          ? 'A long chain is one Warden beat. Nudge the angle until a world locks gold or green.'
          : 'The whole shot is on the map. Bend it through gold rings to chain worlds in one flight.',
      );
    } else {
      host.TrajectoryMaterial.color.set(0x9db8c6);
      host.TrajectoryMaterial.opacity = 0.48;
      host.LandingMarkerMesh.visible = false;
      host.AimPanelElement.classList.remove('is-locked');
      host.AimLabelElement.textContent = 'PULL';
      host.showInstruction(
        'No landing yet',
        'The whole shot is on the map. Pull farther or change the angle until a world locks.',
      );
    }
    host.PredictedSlingshotWorldIdentifiers.clear();
    for (const SlingshotEvent of PredictedSlingshotEvents) {
      host.PredictedSlingshotWorldIdentifiers.add(SlingshotEvent.bodyIdentifier);
    }
    if (host.PredictedStardustIdentifiers.size > 0) {
      host.AimLabelElement.textContent += ` · ARC +${host.PredictedStardustIdentifiers.size}`;
    }
    if (PredictedSlingshotEvents.length > 0) {
      const PredictedPoints = PredictedSlingshotEvents.reduce(
        (Total, Event) => Total + Event.points,
        0,
      );
      const ChainPreview = host.getSlingshotPreviewPresentation(PredictedSlingshotEvents.length);
      if (ChainPreview && TrajectoryPrediction.collisionKind !== 'hazard') {
        if (!IsOutcomeVisible || TrajectoryPrediction.collisionKind === null) {
          host.TrajectoryMaterial.color.setHex(ChainPreview.color);
          host.TrajectoryMaterial.opacity = ChainPreview.opacity;
        }
      }
      host.AimLabelElement.textContent += ChainPreview
        ? ` · ${ChainPreview.label} +${PredictedPoints.toLocaleString('en-GB')}`
        : ` · ASSIST +${PredictedPoints.toLocaleString('en-GB')}`;
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
