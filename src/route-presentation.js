/**
 * Route choice suggestion, target beacons, route/tactical HUD labels and
 * deterministic tactical-body presentation. Route choices only emphasise
 * authored suggestions; every physical destination stays valid.
 */

import { getRouteChoices, isSystemRestored } from './campaign.js';
import { countLiveRelayWorlds, wouldCloseRelayCircuit } from './network.js';
import { calculateBodyPositionAtTime } from './physics.js';
import {
  getHiddenWardenRouteCoach,
  getPlayfieldLabelVerticalBounds,
  getPursuitRouteCoach,
  getTacticalLabelHorizontalMargin,
  getRouteLabelHorizontalMargin,
  isProjectedLabelInsideWorldDisc,
  collapsePlayfieldLabelBox,
  revealPlayfieldLabelBox,
  separateOverlappingRouteLabels,
  separateOverlappingTacticalLabels,
  separateRouteLabelsFromTacticalLabels,
  shouldShowPlayfieldWorldLabels,
} from './presentation.js';

export function createRoutePresentation(THREE, host) {
  const {
    Camera,
    StatusToastElement,
    RouteLabelElements,
    TacticalLabelElements,
    TacticalLabelScreenPositions,
    RouteLabelProjection,
    TargetBeaconMesh,
    TargetBeaconMaterial,
    TargetBeaconTransform,
    TacticalBodyMesh,
    TacticalBodyTransform,
    AsteroidOrbitLine,
    AsteroidOrbitMaterial,
    SeedstoneOrbitLine,
    SeedstoneOrbitMaterial,
    WorldheartOpenColor,
    WorldheartLockedColor,
    SeedstoneDefinition,
    AsteroidDefinition,
    WorldheartDefinition,
    WorldDefinitions,
    CampaignNodeDefinitions,
    TacticalBodyDefinitions,
    ActiveSystem,
    showInstruction,
    isLiveInnerCluster,
    getWorldDefinition,
    synchronizeSeedstonePosition,
    synchronizeWorldheartPosition,
  } = host;

  /** Returns the collision bodies that are active at the current campaign state. */
  function getActiveTacticalBodyDefinitions() {
    return TacticalBodyDefinitions.filter((BodyDefinition) => (
      BodyDefinition.kind === 'hazard'
      || (BodyDefinition.kind === 'seedstone' && host.SeedstoneUsesRemaining > 0)
      || (BodyDefinition.kind === 'worldheart' && WorldheartDefinition.routeAvailable)
    ));
  }

  /** Applies authored route emphasis while leaving every physical destination valid. */
  function getCurrentRouteChoices(MaximumChoiceCount = 2) {
    const ExpansionChoices = getRouteChoices(
      CampaignNodeDefinitions,
      host.CurrentWorldIdentifier,
      MaximumChoiceCount,
      ActiveSystem.routeSuggestions[host.CurrentWorldIdentifier] ?? [],
    );
    if (
      WorldheartDefinition.routeAvailable
      && !WorldheartDefinition.restored
      && host.CurrentWorldIdentifier !== WorldheartDefinition.id
    ) {
      return [
        WorldheartDefinition,
        ...ExpansionChoices.filter((Choice) => Choice.id !== WorldheartDefinition.id),
      ].slice(0, MaximumChoiceCount);
    }
    if (host.WardenPursuitState.status === 'hidden') {
      return ExpansionChoices;
    }
    const CircuitChoices = WorldDefinitions
      .filter((WorldDefinition) => (
        WorldDefinition.id !== host.CurrentWorldIdentifier
        && WorldDefinition.restored
        && wouldCloseRelayCircuit(
          host.RelayNetworkState,
          host.CurrentWorldIdentifier,
          WorldDefinition.id,
        )
      ))
      .sort((FirstWorld, SecondWorld) => {
        const CurrentWorld = getWorldDefinition(host.CurrentWorldIdentifier);
        const FirstDistance = Math.hypot(
          FirstWorld.position.x - CurrentWorld.position.x,
          FirstWorld.position.y - CurrentWorld.position.y,
        );
        const SecondDistance = Math.hypot(
          SecondWorld.position.x - CurrentWorld.position.x,
          SecondWorld.position.y - CurrentWorld.position.y,
        );
        return FirstDistance - SecondDistance || FirstWorld.id.localeCompare(SecondWorld.id);
      });
    return [...CircuitChoices, ...ExpansionChoices]
      .filter((Choice, ChoiceIndex, Choices) => (
        Choices.findIndex((Candidate) => Candidate.id === Choice.id) === ChoiceIndex
      ))
      .slice(0, MaximumChoiceCount);
  }

  /** Reveals the nearest useful routes while leaving every physical destination valid. */
  function showRouteChoiceInstruction() {
    if (host.WardenPursuitState.status === 'hidden') {
      const RouteChoices = getCurrentRouteChoices(2);
      const Coach = getHiddenWardenRouteCoach({
        liveRelayCount: countLiveRelayWorlds(host.RelayNetworkState),
        routeLabels: RouteChoices.map((RouteChoice) => RouteChoice.label),
        openingBody: ActiveSystem.openingBody,
        rangeUnlockLine: ActiveSystem.rangeUnlockLine,
        innerClusterLive: isLiveInnerCluster(),
      });
      showInstruction(Coach.title, Coach.body);
      return;
    }
    const RouteChoices = getCurrentRouteChoices(2);
    const CircuitChoices = RouteChoices.filter((RouteChoice) => (
      wouldCloseRelayCircuit(
        host.RelayNetworkState,
        host.CurrentWorldIdentifier,
        RouteChoice.id,
      )
    ));
    const CircuitChoice = CircuitChoices[0] ?? null;
    const ExpansionChoice = RouteChoices.find((RouteChoice) => (
      RouteChoice !== CircuitChoice && !CircuitChoices.includes(RouteChoice)
    )) ?? null;
    const AlternateCircuitChoice = CircuitChoices[1] ?? null;
    const AuthoredGuidance = CircuitChoice
      ? ActiveSystem.routeGuidance?.[host.CurrentWorldIdentifier]?.[CircuitChoice.id]
      : '';
    const Coach = getPursuitRouteCoach({
      circuitLabels: AlternateCircuitChoice
        ? [CircuitChoice.label, AlternateCircuitChoice.label]
        : (CircuitChoice ? [CircuitChoice.label] : []),
      expansionLabel: ExpansionChoice?.label ?? '',
      commandAvailable: WorldheartDefinition.routeAvailable === true
        && !WorldheartDefinition.restored,
      allWorldsRestored: isSystemRestored(WorldDefinitions),
      uniqueCircuitCount: host.RelayNetworkState.circuits.size,
      remainingBonusFuel: host.RunState?.remainingLaunches ?? 0,
      wardenDistance: host.WardenPursuitState.distance,
      wardenTargetLabel: getWorldDefinition(
        host.WardenPursuitState.targetWorldIdentifier ?? '',
      )?.label ?? '',
      authoredGuidance: AuthoredGuidance ?? '',
    });
    showInstruction(Coach.title, Coach.body);
  }

  /** Updates the two suggested destination rings as a single draw call. */
  function updateTargetBeacons(ElapsedTimeSeconds) {
    const ShouldShowChoices = host.GamePhase === 'attached'
      && (
        host.IsPointerAiming === true
        || host.IsKeyboardAiming === true
        || host.IsScoutMode === true
      );
    const RouteChoices = ShouldShowChoices
      ? getCurrentRouteChoices(2)
      : [];
    const PulseScale = 1 + (Math.sin(ElapsedTimeSeconds * 3.4) * 0.025);

    TargetBeaconMesh.count = RouteChoices.length;
    TargetBeaconMesh.visible = RouteChoices.length > 0;
    TargetBeaconMaterial.opacity = 0.13 + (Math.sin(ElapsedTimeSeconds * 3.4) * 0.055);

    for (let ChoiceIndex = 0; ChoiceIndex < RouteChoices.length; ChoiceIndex += 1) {
      const WorldDefinition = RouteChoices[ChoiceIndex];
      const RingRadius = (WorldDefinition.radius + 0.55) * PulseScale;
      TargetBeaconTransform.position.set(
        WorldDefinition.position.x,
        WorldDefinition.position.y,
        0.08,
      );
      TargetBeaconTransform.rotation.set(0, 0, (
        (-ElapsedTimeSeconds * 0.35) + (ChoiceIndex * Math.PI * 0.18)
      ));
      TargetBeaconTransform.scale.setScalar(RingRadius);
      TargetBeaconTransform.updateMatrix();
      TargetBeaconMesh.setMatrixAt(ChoiceIndex, TargetBeaconTransform.matrix);
    }
    TargetBeaconMesh.instanceMatrix.needsUpdate = RouteChoices.length > 0;
  }

  /** Projects suggested world names into the HUD without spending WebGL draw calls. */
  function hidePlayfieldLabel(LabelElement) {
    collapsePlayfieldLabelBox(LabelElement);
  }

  function writePlayfieldLabel(LabelElement, Text) {
    const VisibleText = typeof Text === 'string' ? Text.trim() : '';
    if (VisibleText.length < 1) {
      hidePlayfieldLabel(LabelElement);
      return;
    }
    LabelElement.textContent = VisibleText;
    revealPlayfieldLabelBox(LabelElement);
  }

  function getCurrentWorldDiscProjection() {
    const CurrentWorld = host.GamePhase === 'attached'
      ? getWorldDefinition(host.CurrentWorldIdentifier)
      : null;
    if (!CurrentWorld) {
      return null;
    }
    RouteLabelProjection.set(
      CurrentWorld.position.x,
      CurrentWorld.position.y,
      0,
    ).project(Camera);
    const WorldNdcX = RouteLabelProjection.x;
    const WorldNdcY = RouteLabelProjection.y;
    RouteLabelProjection.set(
      CurrentWorld.position.x + CurrentWorld.radius,
      CurrentWorld.position.y,
      0,
    ).project(Camera);
    return {
      worldNdcX: WorldNdcX,
      worldNdcY: WorldNdcY,
      worldRimNdcX: RouteLabelProjection.x,
      worldRimNdcY: RouteLabelProjection.y,
    };
  }

  function updateRouteLabels(InstructionTop) {
    const LabelsActive = shouldShowPlayfieldWorldLabels({
      isPointerAiming: host.IsPointerAiming,
      isKeyboardAiming: host.IsKeyboardAiming,
      isScoutMode: host.IsScoutMode,
      toastVisible: StatusToastElement.classList.contains('is-visible'),
    }) && host.GamePhase === 'attached';
    const RouteLabelsLayer = RouteLabelElements[0]?.parentElement ?? null;
    RouteLabelsLayer?.classList.toggle('is-active', LabelsActive);
    if (RouteLabelsLayer) {
      RouteLabelsLayer.hidden = !LabelsActive;
    }
    if (!LabelsActive) {
      for (const RouteLabelElement of RouteLabelElements) {
        hidePlayfieldLabel(RouteLabelElement);
      }
      for (const TacticalLabelElement of TacticalLabelElements) {
        hidePlayfieldLabel(TacticalLabelElement);
      }
      return;
    }
    const RouteChoices = host.GamePhase === 'attached'
      ? getCurrentRouteChoices(RouteLabelElements.length)
      : [];
    const CurrentWorldDisc = getCurrentWorldDiscProjection();
    const IsCompactLayout = window.innerWidth <= 640;
    const IsShortLandscape = window.innerWidth >= window.innerHeight
      && window.innerHeight <= 520;
    const WardenVisible = StatusToastElement.classList.contains('is-visible')
      && StatusToastElement.classList.contains('is-warden');
    const LabelVerticalBounds = getPlayfieldLabelVerticalBounds({
      viewportHeight: window.innerHeight,
      instructionTop: InstructionTop,
      isCompact: IsCompactLayout,
      isShortLandscape: IsShortLandscape,
      wardenVisible: WardenVisible,
      isTactical: false,
    });
    const LabelPositions = [];
    const VisibleRouteLabelElements = [];

    for (let LabelIndex = 0; LabelIndex < RouteLabelElements.length; LabelIndex += 1) {
      const RouteLabelElement = RouteLabelElements[LabelIndex];
      const WorldDefinition = RouteChoices[LabelIndex];
      if (!WorldDefinition) {
        hidePlayfieldLabel(RouteLabelElement);
        continue;
      }
      if (
        WorldDefinition.id === WorldheartDefinition.id
        || WorldDefinition.kind === 'worldheart'
        || WorldDefinition.label === WorldheartDefinition.label
      ) {
        hidePlayfieldLabel(RouteLabelElement);
        continue;
      }

      RouteLabelProjection.set(
        WorldDefinition.position.x,
        WorldDefinition.position.y + WorldDefinition.radius + 0.72,
        0,
      ).project(Camera);
      if (
        CurrentWorldDisc
        && isProjectedLabelInsideWorldDisc({
          labelNdcX: RouteLabelProjection.x,
          labelNdcY: RouteLabelProjection.y,
          ...CurrentWorldDisc,
        })
      ) {
        hidePlayfieldLabel(RouteLabelElement);
        continue;
      }
      const IsOffscreen = Math.abs(RouteLabelProjection.x) > 0.92
        || Math.abs(RouteLabelProjection.y) > 0.86;
      let DirectionPrefix = '';
      if (IsOffscreen) {
        DirectionPrefix = Math.abs(RouteLabelProjection.x) > Math.abs(RouteLabelProjection.y)
          ? (RouteLabelProjection.x > 0 ? '→ ' : '← ')
          : (RouteLabelProjection.y > 0 ? '↑ ' : '↓ ');
      }
      const LabelText = DirectionPrefix + WorldDefinition.label;
      writePlayfieldLabel(RouteLabelElement, LabelText);
      const HorizontalMargin = getRouteLabelHorizontalMargin(LabelText);
      VisibleRouteLabelElements.push(RouteLabelElement);
      LabelPositions.push({
        x: Math.round(
          THREE.MathUtils.clamp(
            (RouteLabelProjection.x * 0.5 + 0.5) * window.innerWidth,
            HorizontalMargin,
            window.innerWidth - HorizontalMargin,
          ),
        ),
        y: Math.round(THREE.MathUtils.clamp(
          (-RouteLabelProjection.y * 0.5 + 0.5) * window.innerHeight,
          LabelVerticalBounds.minimumY,
          LabelVerticalBounds.maximumY,
        )),
      });
    }

    const RouteHorizontalMargin = Math.max(
      IsShortLandscape ? 80 : (IsCompactLayout ? 48 : 58),
      64,
    );
    const RouteLabelMinimumGap = IsShortLandscape ? 160 : 76;
    const ResolvedLabelPositions = separateOverlappingRouteLabels(LabelPositions, {
      minimumGap: RouteLabelMinimumGap,
      minimumX: RouteHorizontalMargin,
      // Never let a very narrow window collapse the bounds below the gap contract.
      maximumX: Math.max(
        window.innerWidth - RouteHorizontalMargin,
        RouteHorizontalMargin + RouteLabelMinimumGap,
      ),
    });
    const ClearedLabelPositions = separateRouteLabelsFromTacticalLabels(
      ResolvedLabelPositions,
      TacticalLabelScreenPositions,
      {
        horizontalClearance: IsShortLandscape ? 180 : 100,
        verticalClearance: IsShortLandscape ? 22 : 30,
        minimumY: LabelVerticalBounds.minimumY,
        maximumY: LabelVerticalBounds.maximumY,
      },
    );
    for (let LabelIndex = 0; LabelIndex < ClearedLabelPositions.length; LabelIndex += 1) {
      VisibleRouteLabelElements[LabelIndex].style.left = `${ClearedLabelPositions[LabelIndex].x}px`;
      VisibleRouteLabelElements[LabelIndex].style.top = `${ClearedLabelPositions[LabelIndex].y}px`;
    }
  }

  /** Updates deterministic tactical-body transforms and their world-space HUD labels. */
  function updateTacticalBodies(ElapsedTimeSeconds, InstructionTop) {
    const ShouldShowTacticalLayer = ![
      'restoring',
      'victoryPending',
      'victory',
    ].includes(host.GamePhase);
    const AsteroidPosition = calculateBodyPositionAtTime(
      AsteroidDefinition,
      host.PhysicsElapsedTimeSeconds,
    );
    const SeedstonePosition = synchronizeSeedstonePosition();
    const WorldheartPosition = synchronizeWorldheartPosition();
    const SeedstoneScale = host.SeedstoneUsesRemaining > 0
      ? 1 + (Math.sin(ElapsedTimeSeconds * 4.4) * 0.045)
      : Math.max(
        0,
        1 - ((ElapsedTimeSeconds - (host.SeedstoneCrumbleStartedAtSeconds ?? 0)) / 0.55),
      );

    TacticalBodyTransform.position.set(
      SeedstonePosition.x,
      SeedstonePosition.y,
      0.08,
    );
    TacticalBodyTransform.rotation.set(
      ElapsedTimeSeconds * 0.18,
      ElapsedTimeSeconds * 0.31,
      ElapsedTimeSeconds * 0.12,
    );
    TacticalBodyTransform.scale.setScalar(SeedstoneScale);
    TacticalBodyTransform.updateMatrix();
    TacticalBodyMesh.setMatrixAt(0, TacticalBodyTransform.matrix);

    TacticalBodyTransform.position.set(AsteroidPosition.x, AsteroidPosition.y, 0.1);
    TacticalBodyTransform.rotation.set(
      ElapsedTimeSeconds * 0.72,
      ElapsedTimeSeconds * 0.94,
      ElapsedTimeSeconds * 0.48,
    );
    TacticalBodyTransform.scale.setScalar(AsteroidDefinition.radius / SeedstoneDefinition.radius);
    TacticalBodyTransform.updateMatrix();
    TacticalBodyMesh.setMatrixAt(1, TacticalBodyTransform.matrix);

    const WorldheartPulseScale = WorldheartDefinition.routeAvailable
      ? 1 + (Math.sin(ElapsedTimeSeconds * 3.2) * 0.1)
      : 0.36 + (Math.sin(ElapsedTimeSeconds * 1.4) * 0.018);
    TacticalBodyTransform.position.set(
      WorldheartPosition.x,
      WorldheartPosition.y,
      0.1,
    );
    TacticalBodyTransform.rotation.set(
      ElapsedTimeSeconds * 0.42,
      ElapsedTimeSeconds * 0.58,
      ElapsedTimeSeconds * 0.35,
    );
    TacticalBodyTransform.scale.setScalar(
      (WorldheartDefinition.radius / SeedstoneDefinition.radius) * WorldheartPulseScale,
    );
    TacticalBodyTransform.updateMatrix();
    TacticalBodyMesh.setMatrixAt(2, TacticalBodyTransform.matrix);
    TacticalBodyMesh.setColorAt(
      2,
      isLiveInnerCluster()
        ? (WorldheartDefinition.routeAvailable ? WorldheartOpenColor : WorldheartLockedColor)
        : WorldheartLockedColor,
    );
    TacticalBodyMesh.instanceMatrix.needsUpdate = true;
    TacticalBodyMesh.instanceColor.needsUpdate = true;
    TacticalBodyMesh.visible = ShouldShowTacticalLayer;
    AsteroidOrbitLine.visible = ShouldShowTacticalLayer;
    AsteroidOrbitMaterial.opacity = 0.14 + (Math.sin(ElapsedTimeSeconds * 1.8) * 0.035);
    SeedstoneOrbitLine.visible = ShouldShowTacticalLayer && Boolean(SeedstoneDefinition.orbit);
    SeedstoneOrbitMaterial.opacity = 0.11 + (Math.sin(ElapsedTimeSeconds * 1.5) * 0.025);

    const IsCompactLayout = window.innerWidth <= 640;
    const IsShortLandscape = window.innerWidth >= window.innerHeight
      && window.innerHeight <= 520;
    const TacticalLabelDefinitions = [
      host.SeedstoneUsesRemaining > 0
        ? {
          definition: SeedstoneDefinition,
          position: SeedstonePosition,
          text: SeedstoneDefinition.orbit
            ? window.innerWidth <= 520
              ? `${SeedstoneDefinition.label} · 1 USE`
              : `${SeedstoneDefinition.label} · MOVING · 1 USE`
            : `${SeedstoneDefinition.label} · 1 USE`,
        }
        : null,
      {
        definition: AsteroidDefinition,
        position: AsteroidPosition,
        text: `${AsteroidDefinition.label} · MOVING`,
      },
      WorldheartDefinition.routeAvailable && !IsShortLandscape
        ? {
          definition: WorldheartDefinition,
          position: WorldheartPosition,
          text: WorldheartDefinition.orbit
            ? `${WorldheartDefinition.label} · EXPOSED · MOVING`
            : `${WorldheartDefinition.label} · EXPOSED`,
        }
        : null,
    ];
    TacticalLabelScreenPositions.length = 0;
    const ProjectedTacticalLabelPositions = [];
    const VisibleTacticalLabelElements = [];
    for (let LabelIndex = 0; LabelIndex < TacticalLabelElements.length; LabelIndex += 1) {
      const TacticalLabelElement = TacticalLabelElements[LabelIndex];
      const TacticalLabelDefinition = TacticalLabelDefinitions[LabelIndex];
      if (
        !ShouldShowTacticalLayer
        || !TacticalLabelDefinition
        || host.GamePhase !== 'attached'
        || !(host.IsPointerAiming || host.IsKeyboardAiming || host.IsScoutMode)
        || StatusToastElement.classList.contains('is-visible')
      ) {
        hidePlayfieldLabel(TacticalLabelElement);
        continue;
      }
      if (TacticalLabelDefinition.definition.kind === 'hazard') {
        const OverlapsWorld = WorldDefinitions.some((WorldDefinition) => {
          const Distance = Math.hypot(
            WorldDefinition.position.x - TacticalLabelDefinition.position.x,
            WorldDefinition.position.y - TacticalLabelDefinition.position.y,
          );
          return Distance < WorldDefinition.radius + 3.2;
        });
        if (OverlapsWorld) {
          hidePlayfieldLabel(TacticalLabelElement);
          continue;
        }
      }

      RouteLabelProjection.set(
        TacticalLabelDefinition.position.x,
        TacticalLabelDefinition.position.y + TacticalLabelDefinition.definition.radius + 0.55,
        0,
      ).project(Camera);
      writePlayfieldLabel(TacticalLabelElement, TacticalLabelDefinition.text);
      const ProjectedLabelX = (
        (RouteLabelProjection.x * 0.5 + 0.5) * window.innerWidth
      );
      const HorizontalLabelMargin = getTacticalLabelHorizontalMargin(
        TacticalLabelDefinition.text,
      );
      const ProjectedLabelLeft = Math.round(
        THREE.MathUtils.clamp(
          ProjectedLabelX,
          HorizontalLabelMargin,
          window.innerWidth - HorizontalLabelMargin,
        ),
      );
      const ProjectedLabelTop = Math.round(
        (-RouteLabelProjection.y * 0.5 + 0.5) * window.innerHeight,
      );
      ProjectedTacticalLabelPositions.push({
        x: ProjectedLabelLeft,
        y: ProjectedLabelTop,
      });
      VisibleTacticalLabelElements.push(TacticalLabelElement);
    }
    const LabelVerticalBounds = getPlayfieldLabelVerticalBounds({
      viewportHeight: window.innerHeight,
      instructionTop: InstructionTop,
      isCompact: IsCompactLayout,
      isShortLandscape: IsShortLandscape,
      wardenVisible: StatusToastElement.classList.contains('is-visible')
        && StatusToastElement.classList.contains('is-warden'),
      isTactical: true,
    });
    const ResolvedTacticalLabelPositions = separateOverlappingTacticalLabels(
      ProjectedTacticalLabelPositions,
      {
        horizontalClearance: 160,
        verticalClearance: 28,
        minimumY: LabelVerticalBounds.minimumY,
        maximumY: LabelVerticalBounds.maximumY,
      },
    );
    TacticalLabelScreenPositions.push(...ResolvedTacticalLabelPositions);
    for (
      let LabelIndex = 0;
      LabelIndex < ResolvedTacticalLabelPositions.length;
      LabelIndex += 1
    ) {
      VisibleTacticalLabelElements[LabelIndex].style.left = (
        `${ResolvedTacticalLabelPositions[LabelIndex].x}px`
      );
      VisibleTacticalLabelElements[LabelIndex].style.top = (
        `${ResolvedTacticalLabelPositions[LabelIndex].y}px`
      );
    }
  }

  return {
    getActiveTacticalBodyDefinitions,
    getCurrentRouteChoices,
    showRouteChoiceInstruction,
    updateTargetBeacons,
    updateRouteLabels,
    updateTacticalBodies,
  };
}
