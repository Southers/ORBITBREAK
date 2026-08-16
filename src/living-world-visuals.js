/**
 * Living-world presentation: slingshot wells, occupation scars, prosperity,
 * inhabitants, relay links and trade hulls. Never enters ranked simulation.
 */

import {
  getCourierDockWorldRole,
  getExtractionFreighterTravelProgress,
  getInhabitantSilhouette,
  getLiveLinkShipCount,
  getProsperityBuildingKind,
  getProsperityBuildingProfile,
  getProsperityPresence,
  getProsperityStage,
  getRelayCourierTravelProgress,
  getRelayLinkOpacity,
  getRunUnlockState,
  getSlingshotBandVisualState,
  getTradeHullColor,
  getTradeHullKind,
  getTradeHullScale,
  getTyrantOccupationStrength,
  getWorldLifeStage,
  shouldShowInhabitantSlot,
} from './presentation.js';
import {
  countLiveRelayWorlds,
  findCircuitBeaconLink,
  getRelayDegree,
  listProtectedRelayWorlds,
  listRelayCircuits,
  listRelayLinks,
} from './network.js';
import { getSlingshotBandRadii } from './scoring.js';

export function createLivingWorldVisuals(THREE, Scene, host) {
  const {
    WorldDefinitions,
    SeedRadius,
    WorldRuntimeByIdentifier,
    GameCanvas,
    CourierStartTimesByLinkId,
    PredictedSlingshotWorldIdentifiers,
    WorldheartDefinition,
    LaunchBudget,
    getWorldDefinition,
    getFrameLiveRelayLinks,
    getFrameLiveRelayCircuits,
    isWorldInLiveCircuit,
  } = host;

  /** Equatorial scoring wells make slingshot chains readable while aiming and flying. */
  const SlingshotBandRingGeometry = new THREE.RingGeometry(0.96, 1.04, 72);
  const SlingshotAssistMaterial = new THREE.MeshBasicMaterial({
    color: 0x72e8ff,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const SlingshotRazorMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd98a,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const SlingshotAssistMesh = new THREE.InstancedMesh(
    SlingshotBandRingGeometry,
    SlingshotAssistMaterial,
    WorldDefinitions.length,
  );
  const SlingshotRazorMesh = new THREE.InstancedMesh(
    SlingshotBandRingGeometry,
    SlingshotRazorMaterial,
    WorldDefinitions.length,
  );
  const SlingshotBandTransform = new THREE.Object3D();
  const SlingshotAssistColor = new THREE.Color();
  const SlingshotRazorColor = new THREE.Color();
  SlingshotAssistMesh.frustumCulled = false;
  SlingshotRazorMesh.frustumCulled = false;
  SlingshotAssistMesh.renderOrder = 8;
  SlingshotRazorMesh.renderOrder = 9;
  SlingshotAssistMesh.visible = false;
  SlingshotRazorMesh.visible = false;
  Scene.add(SlingshotAssistMesh);
  Scene.add(SlingshotRazorMesh);

  function updateSlingshotBandVisuals(ElapsedTimeSeconds) {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    const VisualState = getSlingshotBandVisualState({
      isAiming: IsPointerAiming || IsKeyboardAiming,
      isFlying: GamePhase === 'flying',
    });
    SlingshotAssistMesh.visible = VisualState.visible;
    SlingshotRazorMesh.visible = VisualState.visible;
    if (!VisualState.visible) {
      return;
    }

    SlingshotAssistMaterial.opacity = VisualState.assistOpacity;
    SlingshotRazorMaterial.opacity = VisualState.razorOpacity;
    const BandRotation = PrefersReducedMotion ? 0 : ElapsedTimeSeconds * 0.14;
    for (let WorldIndex = 0; WorldIndex < WorldDefinitions.length; WorldIndex += 1) {
      const WorldDefinition = WorldDefinitions[WorldIndex];
      const Radii = getSlingshotBandRadii(WorldDefinition, SeedRadius);
      const IsPredicted = PredictedSlingshotWorldIdentifiers.has(WorldDefinition.id);
      const IsActive = ScoreState.activePasses.has(WorldDefinition.id);
      SlingshotBandTransform.position.set(WorldDefinition.position.x, WorldDefinition.position.y, 0.08);
      SlingshotBandTransform.rotation.set(0, 0, BandRotation);
      SlingshotBandTransform.scale.set(Radii.assistRadius, Radii.assistRadius, 1);
      SlingshotBandTransform.updateMatrix();
      SlingshotAssistMesh.setMatrixAt(WorldIndex, SlingshotBandTransform.matrix);
      SlingshotAssistColor.setHex(IsActive || IsPredicted ? 0xb7f6ff : 0x4d8ea0);
      SlingshotAssistMesh.setColorAt(WorldIndex, SlingshotAssistColor);

      SlingshotBandTransform.scale.set(Radii.razorRadius, Radii.razorRadius, 1);
      SlingshotBandTransform.updateMatrix();
      SlingshotRazorMesh.setMatrixAt(WorldIndex, SlingshotBandTransform.matrix);
      SlingshotRazorColor.setHex(IsActive || IsPredicted ? 0xfff1c2 : 0xc9a45a);
      SlingshotRazorMesh.setColorAt(WorldIndex, SlingshotRazorColor);
    }
    SlingshotAssistMesh.instanceMatrix.needsUpdate = true;
    SlingshotRazorMesh.instanceMatrix.needsUpdate = true;
    if (SlingshotAssistMesh.instanceColor) SlingshotAssistMesh.instanceColor.needsUpdate = true;
    if (SlingshotRazorMesh.instanceColor) SlingshotRazorMesh.instanceColor.needsUpdate = true;
  }

  /** Instanced mines, clamps, fumes and haulers make Warden-owned worlds look eaten, not merely clamped. */
  const OccupationScarProfiles = {
    meadow: { height: 0.9, width: 0.82, depth: 0.82 },
    ember: { height: 1.42, width: 0.7, depth: 0.86 },
    grove: { height: 0.78, width: 1.18, depth: 0.72 },
    tide: { height: 0.92, width: 1.3, depth: 0.68 },
    frost: { height: 1.22, width: 0.72, depth: 0.88 },
    vault: { height: 1.48, width: 0.78, depth: 0.92 },
    loom: { height: 0.86, width: 1.12, depth: 0.7 },
    kiln: { height: 1.36, width: 0.74, depth: 0.88 },
    shard: { height: 1.28, width: 0.7, depth: 0.94 },
  };
  const OccupationFumeColors = {
    meadow: new THREE.Color(0x8a6a40),
    ember: new THREE.Color(0xff5a24),
    grove: new THREE.Color(0x6a5a38),
    tide: new THREE.Color(0x4a5a48),
    frost: new THREE.Color(0xb8c4cc),
    vault: new THREE.Color(0x6a2030),
    loom: new THREE.Color(0x5a6a40),
    kiln: new THREE.Color(0xff5a24),
    shard: new THREE.Color(0x8a9ab8),
  };
  const OccupationScarInstances = WorldDefinitions.flatMap((WorldDefinition) => (
    (WorldDefinition.occupationScarAngles ?? []).map((Angle, PatternIndex) => ({
      worldDefinition: WorldDefinition,
      angle: Angle,
      patternIndex: PatternIndex,
      profile: OccupationScarProfiles[WorldDefinition.visualKey]
        ?? { height: 0.85, width: 0.8, depth: 0.8 },
      fumeColor: OccupationFumeColors[WorldDefinition.visualKey] ?? OccupationFumeColors.vault,
    }))
  ));
  const OccupationScarCapacity = Math.max(1, OccupationScarInstances.length);
  const OccupationScarMaterial = new THREE.MeshStandardMaterial({
    color: 0x321019,
    emissive: 0xff342f,
    emissiveIntensity: 0.82,
    roughness: 0.4,
    metalness: 0.82,
  });
  const OccupationMineGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0.42, -0.1),
    new THREE.Vector2(0.36, 0.02),
    new THREE.Vector2(0.14, 0.08),
    new THREE.Vector2(0.11, 0.46),
    new THREE.Vector2(0.28, 0.52),
    new THREE.Vector2(0.08, 0.56),
    new THREE.Vector2(0.07, 0.92),
    new THREE.Vector2(0.13, 0.98),
    new THREE.Vector2(0.04, 1.08),
  ], 7);
  const OccupationMineMesh = new THREE.InstancedMesh(
    OccupationMineGeometry,
    OccupationScarMaterial,
    OccupationScarCapacity,
  );
  const OccupationClampMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.68, 0.1, 0.16),
    OccupationScarMaterial,
    OccupationScarCapacity,
  );
  const OccupationFumeMaterial = new THREE.MeshBasicMaterial({
    color: 0xff6a32,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    toneMapped: false,
  });
  const OccupationFumeMesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.16, 0.72, 6, 1, true),
    OccupationFumeMaterial,
    OccupationScarCapacity,
  );
  OccupationMineMesh.count = OccupationScarInstances.length;
  OccupationClampMesh.count = OccupationScarInstances.length;
  OccupationFumeMesh.count = OccupationScarInstances.length;
  OccupationMineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  OccupationClampMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  OccupationFumeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  OccupationMineMesh.frustumCulled = false;
  OccupationClampMesh.frustumCulled = false;
  OccupationFumeMesh.frustumCulled = false;
  Scene.add(OccupationMineMesh, OccupationClampMesh, OccupationFumeMesh);
  const OccupationScarTransform = new THREE.Object3D();
  const OccupationFumeColor = new THREE.Color();
  let VisibleOccupationScarCount = -1;
  GameCanvas.dataset.occupationScarCount = String(OccupationScarInstances.length);

  const ExtractionFreighterInstances = WorldDefinitions.filter(
    (WorldDefinition) => Array.isArray(WorldDefinition.occupationScarAngles),
  );
  const ExtractionFreighterCapacity = Math.max(1, ExtractionFreighterInstances.length);
  const ExtractionFreighterMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a1418,
    emissive: 0x8a2418,
    emissiveIntensity: 0.7,
    roughness: 0.46,
    metalness: 0.72,
  });
  const ExtractionFreighterMesh = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.08, 0.42, 3, 6),
    ExtractionFreighterMaterial,
    ExtractionFreighterCapacity,
  );
  ExtractionFreighterMesh.count = ExtractionFreighterInstances.length;
  ExtractionFreighterMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ExtractionFreighterMesh.frustumCulled = false;
  Scene.add(ExtractionFreighterMesh);
  const ExtractionFreighterTransform = new THREE.Object3D();
  let VisibleExtractionFreighterCount = -1;

  function updateOccupationScarVisuals(ElapsedTimeSeconds) {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    let NextVisibleOccupationScarCount = 0;
    for (let ScarIndex = 0; ScarIndex < OccupationScarInstances.length; ScarIndex += 1) {
      const Scar = OccupationScarInstances[ScarIndex];
      const WorldRuntime = WorldRuntimeByIdentifier.get(Scar.worldDefinition.id);
      const RestorationProgress = WorldRuntime.restorationUniforms.restorationProgress.value;
      const ScarStrength = getTyrantOccupationStrength(
        Scar.worldDefinition.restored,
        RestorationProgress,
      );
      if (ScarStrength > 0.01) NextVisibleOccupationScarCount += 1;
      const RadialX = Math.cos(Scar.angle);
      const RadialY = Math.sin(Scar.angle);
      const Height = Scar.profile.height * (1 + ((Scar.patternIndex % 2) * 0.12));
      OccupationScarTransform.position.set(
        Scar.worldDefinition.position.x
          + (RadialX * (Scar.worldDefinition.radius + (Height * 0.12))),
        Scar.worldDefinition.position.y
          + (RadialY * (Scar.worldDefinition.radius + (Height * 0.12))),
        0.28 + ((Scar.patternIndex % 2) * 0.05),
      );
      OccupationScarTransform.rotation.set(0, 0, Scar.angle - (Math.PI * 0.5));
      OccupationScarTransform.scale.set(
        Scar.profile.depth * ScarStrength,
        Height * ScarStrength,
        Scar.profile.depth * ScarStrength,
      );
      OccupationScarTransform.updateMatrix();
      OccupationMineMesh.setMatrixAt(ScarIndex, OccupationScarTransform.matrix);

      OccupationScarTransform.position.set(
        Scar.worldDefinition.position.x
          + (RadialX * (Scar.worldDefinition.radius + (Height * 0.58))),
        Scar.worldDefinition.position.y
          + (RadialY * (Scar.worldDefinition.radius + (Height * 0.58))),
        0.36 + ((Scar.patternIndex % 2) * 0.05),
      );
      OccupationScarTransform.rotation.set(0, 0, Scar.angle);
      OccupationScarTransform.scale.set(
        Scar.profile.width * ScarStrength,
        Scar.profile.depth * ScarStrength,
        Scar.profile.depth * ScarStrength,
      );
      OccupationScarTransform.updateMatrix();
      OccupationClampMesh.setMatrixAt(ScarIndex, OccupationScarTransform.matrix);

      const FumePulse = PrefersReducedMotion
        ? 1
        : 1 + (Math.sin((ElapsedTimeSeconds * 1.7) + Scar.patternIndex) * 0.18);
      OccupationScarTransform.position.set(
        Scar.worldDefinition.position.x
          + (RadialX * (Scar.worldDefinition.radius + (Height * 0.92))),
        Scar.worldDefinition.position.y
          + (RadialY * (Scar.worldDefinition.radius + (Height * 0.92))),
        0.48,
      );
      OccupationScarTransform.rotation.set(0, 0, Scar.angle - (Math.PI * 0.5));
      OccupationScarTransform.scale.set(
        ScarStrength * FumePulse,
        ScarStrength * (1.15 + ((Scar.patternIndex % 2) * 0.25)) * FumePulse,
        ScarStrength * FumePulse,
      );
      OccupationScarTransform.updateMatrix();
      OccupationFumeMesh.setMatrixAt(ScarIndex, OccupationScarTransform.matrix);
      OccupationFumeColor.copy(Scar.fumeColor);
      OccupationFumeMesh.setColorAt(ScarIndex, OccupationFumeColor);
    }
    if (OccupationScarInstances.length > 0) {
      OccupationMineMesh.instanceMatrix.needsUpdate = true;
      OccupationClampMesh.instanceMatrix.needsUpdate = true;
      OccupationFumeMesh.instanceMatrix.needsUpdate = true;
      if (OccupationFumeMesh.instanceColor) OccupationFumeMesh.instanceColor.needsUpdate = true;
    }
    OccupationScarMaterial.emissiveIntensity = 0.72
      + (Math.sin(ElapsedTimeSeconds * 3.4) * 0.16);
    OccupationFumeMaterial.opacity = PrefersReducedMotion
      ? 0.34
      : 0.28 + (Math.sin(ElapsedTimeSeconds * 2.1) * 0.1);
    if (VisibleOccupationScarCount !== NextVisibleOccupationScarCount) {
      VisibleOccupationScarCount = NextVisibleOccupationScarCount;
      GameCanvas.dataset.visibleOccupationScarCount = String(VisibleOccupationScarCount);
    }
  }

  function updateExtractionFreighterVisuals(ElapsedTimeSeconds) {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    const ExtractionSink = WorldheartDefinition?.position ?? { x: 36, y: 8, z: 0 };
    let NextVisibleExtractionFreighterCount = 0;
    for (let FreighterIndex = 0; FreighterIndex < ExtractionFreighterInstances.length; FreighterIndex += 1) {
      const WorldDefinition = ExtractionFreighterInstances[FreighterIndex];
      const WorldRuntime = WorldRuntimeByIdentifier.get(WorldDefinition.id);
      const RestorationProgress = WorldRuntime.restorationUniforms.restorationProgress.value;
      const OccupationStrength = getTyrantOccupationStrength(
        WorldDefinition.restored,
        RestorationProgress,
      );
      const Haul = getExtractionFreighterTravelProgress(
        ElapsedTimeSeconds + (FreighterIndex * 1.7),
      );
      const Visibility = OccupationStrength * Haul.opacity;
      if (Visibility > 0.05) NextVisibleExtractionFreighterCount += 1;
      const OriginX = WorldDefinition.position.x;
      const OriginY = WorldDefinition.position.y;
      const TravelX = THREE.MathUtils.lerp(OriginX, ExtractionSink.x, Haul.travelProgress);
      const TravelY = THREE.MathUtils.lerp(OriginY, ExtractionSink.y, Haul.travelProgress);
      const OffsetX = OriginY - ExtractionSink.y;
      const OffsetY = ExtractionSink.x - OriginX;
      const OffsetLength = Math.hypot(OffsetX, OffsetY) || 1;
      const LaneOffset = Math.sin(Haul.travelProgress * Math.PI) * 1.6;
      ExtractionFreighterTransform.position.set(
        TravelX + ((OffsetX / OffsetLength) * LaneOffset),
        TravelY + ((OffsetY / OffsetLength) * LaneOffset),
        0.42 + (Math.sin(Haul.travelProgress * Math.PI) * 0.55),
      );
      ExtractionFreighterTransform.rotation.set(
        0,
        0,
        Math.atan2(ExtractionSink.y - OriginY, ExtractionSink.x - OriginX) - (Math.PI * 0.5),
      );
      ExtractionFreighterTransform.scale.setScalar(Visibility);
      ExtractionFreighterTransform.updateMatrix();
      ExtractionFreighterMesh.setMatrixAt(FreighterIndex, ExtractionFreighterTransform.matrix);
    }
    if (ExtractionFreighterInstances.length > 0) {
      ExtractionFreighterMesh.instanceMatrix.needsUpdate = true;
    }
    if (VisibleExtractionFreighterCount !== NextVisibleExtractionFreighterCount) {
      VisibleExtractionFreighterCount = NextVisibleExtractionFreighterCount;
      GameCanvas.dataset.extractionFreighterCount = String(VisibleExtractionFreighterCount);
    }
  }

  const ProsperityBuildingGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0.18, 0),
    new THREE.Vector2(0.22, 0.16),
    new THREE.Vector2(0.08, 0.2),
    new THREE.Vector2(0.26, 0.24),
    new THREE.Vector2(0.04, 0.42),
  ], 6);
  const ProsperityBuildingMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9a078,
    emissive: 0xffc878,
    emissiveIntensity: 0.42,
    roughness: 0.62,
    metalness: 0.08,
    vertexColors: true,
  });
  const ProsperityBuildingMesh = new THREE.InstancedMesh(
    ProsperityBuildingGeometry,
    ProsperityBuildingMaterial,
    OccupationScarCapacity,
  );
  ProsperityBuildingMesh.count = OccupationScarInstances.length;
  ProsperityBuildingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ProsperityBuildingMesh.frustumCulled = false;
  Scene.add(ProsperityBuildingMesh);
  const ProsperityBuildingTransform = new THREE.Object3D();
  const ProsperityBuildingColor = new THREE.Color();
  const ProsperityCircuitWarmColor = new THREE.Color(0xffe7b0);
  const ProsperityDockLitColor = new THREE.Color(0xfff4c8);
  const ProsperityWindowCapacity = Math.max(1, OccupationScarCapacity * 2);
  const ProsperityWindowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe29a,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    toneMapped: false,
  });
  const ProsperityWindowMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.12, 0.1, 0.06),
    ProsperityWindowMaterial,
    ProsperityWindowCapacity,
  );
  ProsperityWindowMesh.count = 0;
  ProsperityWindowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ProsperityWindowMesh.frustumCulled = false;
  Scene.add(ProsperityWindowMesh);
  const ProsperityWindowTransform = new THREE.Object3D();
  const ProsperityWindowColor = new THREE.Color();
  let VisibleProsperityBuildingCount = -1;
  const DockedWorldIdentifiers = new Set();
  const DockGatherAngleByWorldId = new Map();
  let LastPublishedDockedWorlds = null;
  GameCanvas.dataset.prosperityBuildingCount = String(OccupationScarInstances.length);

  function getTradeCourierDwellRatio() {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    return PrefersReducedMotion ? 0 : 0.12;
  }

  function refreshDockedTradeState(ElapsedTimeSeconds) {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    DockedWorldIdentifiers.clear();
    DockGatherAngleByWorldId.clear();
    const Links = getFrameLiveRelayLinks();
    const LiveCircuitLinkIdentifiers = new Set(
      getFrameLiveRelayCircuits().flatMap((Circuit) => Circuit.linkIdentifiers),
    );
    for (const Link of Links) {
      const Origin = getWorldDefinition(Link.originWorldIdentifier);
      const Destination = getWorldDefinition(Link.destinationWorldIdentifier);
      const InLiveCircuit = LiveCircuitLinkIdentifiers.has(Link.id);
      const ShipCount = getLiveLinkShipCount({
        originDegree: getRelayDegree(RelayNetworkState, Link.originWorldIdentifier),
        destinationDegree: getRelayDegree(RelayNetworkState, Link.destinationWorldIdentifier),
        inLiveCircuit: InLiveCircuit,
      });
      for (let ShipSlot = 0; ShipSlot < ShipCount; ShipSlot += 1) {
        const CourierAgeSeconds = (
          CourierStartTimesByLinkId.has(Link.id)
            ? Math.max(0, ElapsedTimeSeconds - CourierStartTimesByLinkId.get(Link.id))
            : ((ElapsedTimeSeconds * 0.11) + (Link.sequenceIndex * 0.37)) / 0.11
        ) + (ShipSlot * 4.2);
        const CourierTravel = getRelayCourierTravelProgress(CourierAgeSeconds, {
          dwellRatio: getTradeCourierDwellRatio(),
        });
        const DockRole = getCourierDockWorldRole(CourierTravel);
        if (!DockRole) {
          continue;
        }
        const DockWorld = DockRole === 'destination' ? Destination : Origin;
        DockedWorldIdentifiers.add(DockWorld.id);
        const DockAngles = DockWorld.occupationScarAngles ?? [];
        const GatherAngle = DockAngles.find((Angle, PatternIndex) => (
          getProsperityBuildingKind(
            getProsperityStage({
              restored: DockWorld.restored,
              liveLinkCount: getRelayDegree(RelayNetworkState, DockWorld.id),
              inLiveCircuit: isWorldInLiveCircuit(DockWorld.id),
            }),
            PatternIndex,
          ) === 'dock'
        )) ?? DockAngles[0] ?? 0;
        DockGatherAngleByWorldId.set(DockWorld.id, GatherAngle);
      }
    }
    const DockedWorldsValue = [...DockedWorldIdentifiers].sort().join(',');
    if (DockedWorldsValue !== LastPublishedDockedWorlds) {
      LastPublishedDockedWorlds = DockedWorldsValue;
      GameCanvas.dataset.dockedWorlds = DockedWorldsValue;
    }
  }

  function updateProsperityBuildingVisuals(ElapsedTimeSeconds) {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    let NextVisibleProsperityBuildingCount = 0;
    let NextVisibleWindowCount = 0;
    const ProsperityKinds = [];
    for (let ScarIndex = 0; ScarIndex < OccupationScarInstances.length; ScarIndex += 1) {
      const Scar = OccupationScarInstances[ScarIndex];
      const LiveLinkCount = getRelayDegree(RelayNetworkState, Scar.worldDefinition.id);
      const ProsperityStage = getProsperityStage({
        restored: Scar.worldDefinition.restored,
        liveLinkCount: LiveLinkCount,
        inLiveCircuit: isWorldInLiveCircuit(Scar.worldDefinition.id),
      });
      const Presence = getProsperityPresence(ProsperityStage);
      const BuildingKind = getProsperityBuildingKind(ProsperityStage, Scar.patternIndex);
      const BuildingProfile = getProsperityBuildingProfile(BuildingKind);
      if (Scar.patternIndex === 0) {
        ProsperityKinds.push(`${Scar.worldDefinition.id}:${ProsperityStage}:${BuildingKind ?? 'none'}`);
      }
      const HideBuilding = Presence <= 0.04 || !BuildingProfile;
      if (HideBuilding) {
        ProsperityBuildingTransform.scale.set(0, 0, 0);
        ProsperityBuildingTransform.position.set(0, 0, -8);
        ProsperityBuildingTransform.updateMatrix();
        ProsperityBuildingMesh.setMatrixAt(ScarIndex, ProsperityBuildingTransform.matrix);
      } else {
        NextVisibleProsperityBuildingCount += 1;
        const RadialX = Math.cos(Scar.angle);
        const RadialY = Math.sin(Scar.angle);
        const Height = BuildingProfile.height
          * Presence
          * (1 + ((Scar.patternIndex % 3) * 0.08));
        const IsDockLit = BuildingKind === 'dock'
          && DockedWorldIdentifiers.has(Scar.worldDefinition.id);
        ProsperityBuildingTransform.position.set(
          Scar.worldDefinition.position.x
            + (RadialX * (Scar.worldDefinition.radius + (Height * 0.08))),
          Scar.worldDefinition.position.y
            + (RadialY * (Scar.worldDefinition.radius + (Height * 0.08))),
          0.32 + ((Scar.patternIndex % 2) * 0.04),
        );
        ProsperityBuildingTransform.rotation.set(0, 0, Scar.angle - (Math.PI * 0.5));
        ProsperityBuildingTransform.scale.set(
          BuildingProfile.width * Presence,
          Height,
          BuildingProfile.depth * Presence,
        );
        ProsperityBuildingTransform.updateMatrix();
        ProsperityBuildingMesh.setMatrixAt(ScarIndex, ProsperityBuildingTransform.matrix);
        ProsperityBuildingColor.set(Scar.worldDefinition.restoration.waveColor);
        if (ProsperityStage === 'circuit') {
          ProsperityBuildingColor.lerp(ProsperityCircuitWarmColor, 0.35);
        }
        if (IsDockLit) {
          ProsperityBuildingColor.lerp(ProsperityDockLitColor, 0.55);
        }
        ProsperityBuildingMesh.setColorAt(ScarIndex, ProsperityBuildingColor);

        const WindowSlot = ScarIndex * 2;
        const StreetSlot = WindowSlot + 1;
        if (BuildingProfile.hasWindow) {
          ProsperityWindowTransform.position.set(
            Scar.worldDefinition.position.x
              + (RadialX * (Scar.worldDefinition.radius + (Height * 0.42))),
            Scar.worldDefinition.position.y
              + (RadialY * (Scar.worldDefinition.radius + (Height * 0.42))),
            0.38 + (Height * 0.22),
          );
          ProsperityWindowTransform.rotation.set(0, 0, Scar.angle - (Math.PI * 0.5));
          ProsperityWindowTransform.scale.set(Presence, Presence * (IsDockLit ? 1.25 : 1), Presence);
          ProsperityWindowTransform.updateMatrix();
          ProsperityWindowMesh.setMatrixAt(WindowSlot, ProsperityWindowTransform.matrix);
          ProsperityWindowColor.setHex(ProsperityStage === 'circuit' ? 0xfff0c4 : 0xffd27a);
          ProsperityWindowMesh.setColorAt(WindowSlot, ProsperityWindowColor);
          NextVisibleWindowCount += 1;
        } else {
          ProsperityWindowTransform.scale.set(0, 0, 0);
          ProsperityWindowTransform.position.set(0, 0, -8);
          ProsperityWindowTransform.updateMatrix();
          ProsperityWindowMesh.setMatrixAt(WindowSlot, ProsperityWindowTransform.matrix);
        }
        if (BuildingProfile.hasStreet) {
          ProsperityWindowTransform.position.set(
            Scar.worldDefinition.position.x
              + (RadialX * (Scar.worldDefinition.radius + 0.02)),
            Scar.worldDefinition.position.y
              + (RadialY * (Scar.worldDefinition.radius + 0.02)),
            0.18,
          );
          ProsperityWindowTransform.rotation.set(0, 0, Scar.angle - (Math.PI * 0.5));
          ProsperityWindowTransform.scale.set(2.4 * Presence, 0.18 * Presence, 0.7 * Presence);
          ProsperityWindowTransform.updateMatrix();
          ProsperityWindowMesh.setMatrixAt(StreetSlot, ProsperityWindowTransform.matrix);
          ProsperityWindowColor.setHex(0x6a5a48);
          ProsperityWindowMesh.setColorAt(StreetSlot, ProsperityWindowColor);
          NextVisibleWindowCount += 1;
        } else {
          ProsperityWindowTransform.scale.set(0, 0, 0);
          ProsperityWindowTransform.position.set(0, 0, -8);
          ProsperityWindowTransform.updateMatrix();
          ProsperityWindowMesh.setMatrixAt(StreetSlot, ProsperityWindowTransform.matrix);
        }
        continue;
      }
      const WindowSlot = ScarIndex * 2;
      ProsperityWindowTransform.scale.set(0, 0, 0);
      ProsperityWindowTransform.position.set(0, 0, -8);
      ProsperityWindowTransform.updateMatrix();
      ProsperityWindowMesh.setMatrixAt(WindowSlot, ProsperityWindowTransform.matrix);
      ProsperityWindowMesh.setMatrixAt(WindowSlot + 1, ProsperityWindowTransform.matrix);
    }
    if (OccupationScarInstances.length > 0) {
      ProsperityBuildingMesh.instanceMatrix.needsUpdate = true;
      if (ProsperityBuildingMesh.instanceColor) {
        ProsperityBuildingMesh.instanceColor.needsUpdate = true;
      }
      ProsperityWindowMesh.instanceMatrix.needsUpdate = true;
      if (ProsperityWindowMesh.instanceColor) {
        ProsperityWindowMesh.instanceColor.needsUpdate = true;
      }
    }
    ProsperityWindowMesh.count = OccupationScarInstances.length * 2;
    const HasLiveCircuit = getFrameLiveRelayCircuits().length > 0;
    const WindowPulse = PrefersReducedMotion
      ? 0.38
      : 0.28 + (Math.sin(ElapsedTimeSeconds * (HasLiveCircuit ? 4.2 : 2.4)) * 0.16);
    ProsperityBuildingMaterial.emissiveIntensity = WindowPulse;
    ProsperityWindowMaterial.opacity = PrefersReducedMotion
      ? 0.72
      : 0.64 + (Math.sin(ElapsedTimeSeconds * (HasLiveCircuit ? 5.1 : 2.8)) * 0.18);
    if (VisibleProsperityBuildingCount !== NextVisibleProsperityBuildingCount) {
      VisibleProsperityBuildingCount = NextVisibleProsperityBuildingCount;
      GameCanvas.dataset.visibleProsperityBuildingCount = String(VisibleProsperityBuildingCount);
    }
    GameCanvas.dataset.visibleProsperityWindowCount = String(NextVisibleWindowCount);
    GameCanvas.dataset.prosperityStages = ProsperityKinds.join(',');
  }

  /** Inhabitants share one draw call: guards and prisoners on tyrant worlds, free walkers once isolated or living. */
  const InhabitantProfiles = {
    meadow: { speed: 0.42, stride: 0.11 },
    ember: { speed: 0.72, stride: 0.075 },
    grove: { speed: 0.34, stride: 0.14 },
    tide: { speed: 0.88, stride: 0.095 },
    frost: { speed: 0.3, stride: 0.065 },
    vault: { speed: 0.24, stride: 0.055 },
    loom: { speed: 0.38, stride: 0.12 },
    kiln: { speed: 0.64, stride: 0.08 },
    shard: { speed: 0.28, stride: 0.07 },
  };
  const InhabitantGuardColor = new THREE.Color(0x6a1c22);
  const InhabitantPrisonerColor = new THREE.Color(0x6e5a52);
  const InhabitantFreeColor = new THREE.Color();
  const InhabitantChildTintColor = new THREE.Color(0xffffff);
  const InhabitantInstances = WorldDefinitions.flatMap((WorldDefinition, WorldIndex) => {
    const MineAngles = WorldDefinition.occupationScarAngles;
    if (!MineAngles) {
      return [];
    }
    return Array.from({ length: 12 }, (_, InhabitantIndex) => ({
      worldDefinition: WorldDefinition,
      slotIndex: InhabitantIndex,
      role: InhabitantIndex < 2 ? 'guard' : 'civilian',
      mineAngle: MineAngles[InhabitantIndex % MineAngles.length]
        + ((InhabitantIndex % 3) * 0.11)
        - 0.08,
      baseAngle: (1.1 + (WorldIndex * 1.37) + (InhabitantIndex * 0.42)) % (Math.PI * 2),
      phase: (WorldIndex * 0.73) + (InhabitantIndex * 1.91),
      profile: InhabitantProfiles[WorldDefinition.visualKey]
        ?? { speed: 0.4, stride: 0.08 },
    }));
  });
  const InhabitantCapacity = Math.max(1, InhabitantInstances.length);
  const InhabitantMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  const InhabitantGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0.025, -0.22),
    new THREE.Vector2(0.085, -0.17),
    new THREE.Vector2(0.09, 0.1),
    new THREE.Vector2(0.05, 0.16),
    new THREE.Vector2(0.075, 0.2),
    new THREE.Vector2(0.105, 0.27),
    new THREE.Vector2(0.08, 0.34),
    new THREE.Vector2(0.02, 0.38),
  ], 6);
  const InhabitantMesh = new THREE.InstancedMesh(
    InhabitantGeometry,
    InhabitantMaterial,
    InhabitantCapacity,
  );
  InhabitantMesh.count = InhabitantInstances.length;
  InhabitantMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  InhabitantMesh.frustumCulled = false;
  Scene.add(InhabitantMesh);
  const InhabitantTransform = new THREE.Object3D();
  let VisibleInhabitantCount = -1;
  let VisiblePrisonerCount = -1;
  let VisibleGuardCount = -1;
  GameCanvas.dataset.inhabitantCount = String(InhabitantInstances.length);

  function updateInhabitantVisuals(ElapsedTimeSeconds) {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    let NextVisibleInhabitantCount = 0;
    let NextVisiblePrisonerCount = 0;
    let NextVisibleGuardCount = 0;
    const LifeStages = [];
    const IsCollectiveResponseActive = FinaleRestorationStartedAtSeconds !== null
      && GamePhase === 'victoryPending';
    for (let InhabitantIndex = 0; InhabitantIndex < InhabitantInstances.length; InhabitantIndex += 1) {
      const Inhabitant = InhabitantInstances[InhabitantIndex];
      const WorldRuntime = WorldRuntimeByIdentifier.get(Inhabitant.worldDefinition.id);
      const RestorationProgress = WorldRuntime.restorationUniforms.restorationProgress.value;
      const LiveLinkCount = getRelayDegree(RelayNetworkState, Inhabitant.worldDefinition.id);
      const LifeStage = getWorldLifeStage({
        restored: Inhabitant.worldDefinition.restored,
        liveLinkCount: LiveLinkCount,
      });
      if (Inhabitant.slotIndex === 0) {
        LifeStages.push(`${Inhabitant.worldDefinition.id}:${LifeStage}`);
      }
      const TyrantStrength = getTyrantOccupationStrength(
        Inhabitant.worldDefinition.restored,
        RestorationProgress,
      );
      const IsolatedVisible = shouldShowInhabitantSlot({
        lifeStage: LifeStage,
        prosperityStage: getProsperityStage({
          restored: Inhabitant.worldDefinition.restored,
          liveLinkCount: LiveLinkCount,
          inLiveCircuit: isWorldInLiveCircuit(Inhabitant.worldDefinition.id),
        }),
        slotIndex: Inhabitant.slotIndex,
      });
      const FreeEmergence = Inhabitant.worldDefinition.restored && IsolatedVisible
        ? THREE.MathUtils.smoothstep(Math.max(0, RestorationProgress), 0.54, 0.96)
        : 0;
      const Presence = IsolatedVisible ? Math.max(TyrantStrength, FreeEmergence) : 0;
      if (Presence <= 0.08) {
        InhabitantTransform.scale.set(0, 0, 0);
        InhabitantTransform.position.set(0, 0, -8);
        InhabitantTransform.updateMatrix();
        InhabitantMesh.setMatrixAt(InhabitantIndex, InhabitantTransform.matrix);
        continue;
      }
      NextVisibleInhabitantCount += 1;
      const Freedom = 1 - TyrantStrength;
      const IsGuard = Inhabitant.role === 'guard';
      if (TyrantStrength > 0.35) {
        if (IsGuard) NextVisibleGuardCount += 1;
        else NextVisiblePrisonerCount += 1;
      }
      const WalkingOffset = PrefersReducedMotion
        ? 0
        : Math.sin(
          (ElapsedTimeSeconds * Inhabitant.profile.speed) + Inhabitant.phase,
        ) * Inhabitant.profile.stride * THREE.MathUtils.lerp(0.35, 1, Freedom);
      const HeldAngle = Inhabitant.mineAngle + (IsGuard ? 0.1 : -0.14);
      const GatherAngle = DockGatherAngleByWorldId.get(Inhabitant.worldDefinition.id);
      const GatherBlend = GatherAngle === undefined || IsGuard || TyrantStrength > 0.35
        ? 0
        : 0.72;
      const FreeAngle = GatherBlend > 0
        ? THREE.MathUtils.lerp(
          Inhabitant.baseAngle + WalkingOffset,
          GatherAngle,
          GatherBlend,
        )
        : Inhabitant.baseAngle + WalkingOffset;
      const SurfaceAngle = THREE.MathUtils.lerp(HeldAngle, FreeAngle, Freedom);
      const RadialX = Math.cos(SurfaceAngle);
      const RadialY = Math.sin(SurfaceAngle);
      InhabitantTransform.position.set(
        Inhabitant.worldDefinition.position.x
          + (RadialX * (Inhabitant.worldDefinition.radius + 0.16)),
        Inhabitant.worldDefinition.position.y
          + (RadialY * (Inhabitant.worldDefinition.radius + 0.16)),
        0.5 + ((InhabitantIndex % 2) * 0.035),
      );
      InhabitantTransform.rotation.set(0, 0, SurfaceAngle - (Math.PI * 0.5));
      const HeldHeight = IsGuard ? 1.08 : 0.58;
      const BobScale = PrefersReducedMotion
        ? 1
        : 1 + (
          Math.sin(
            (ElapsedTimeSeconds * (IsCollectiveResponseActive ? 6.4 : 3.2))
              + Inhabitant.phase,
          ) * (IsCollectiveResponseActive ? 0.2 : 0.08)
        );
      const HeightScale = THREE.MathUtils.lerp(HeldHeight, 1, Freedom) * BobScale;
      const Silhouette = getInhabitantSilhouette(Inhabitant.slotIndex);
      const SilhouetteMix = Freedom;
      InhabitantTransform.scale.set(
        Presence * THREE.MathUtils.lerp(1, Silhouette.scale.x, SilhouetteMix),
        Presence * HeightScale * THREE.MathUtils.lerp(1, Silhouette.scale.y, SilhouetteMix),
        Presence * THREE.MathUtils.lerp(1, Silhouette.scale.z, SilhouetteMix),
      );
      InhabitantTransform.updateMatrix();
      InhabitantMesh.setMatrixAt(InhabitantIndex, InhabitantTransform.matrix);
      InhabitantFreeColor.set(Inhabitant.worldDefinition.restoration.waveColor);
      if (Silhouette.kind === 'child') {
        InhabitantFreeColor.lerp(InhabitantChildTintColor, 0.18);
      } else if (Silhouette.kind === 'pack') {
        InhabitantFreeColor.offsetHSL(0.04, 0.08, -0.08);
      }
      const HeldColor = IsGuard ? InhabitantGuardColor : InhabitantPrisonerColor;
      InhabitantMesh.setColorAt(
        InhabitantIndex,
        InhabitantFreeColor.lerp(HeldColor, TyrantStrength),
      );
    }
    if (InhabitantInstances.length > 0) {
      InhabitantMesh.instanceMatrix.needsUpdate = true;
      if (InhabitantMesh.instanceColor) InhabitantMesh.instanceColor.needsUpdate = true;
    }
    if (VisibleInhabitantCount !== NextVisibleInhabitantCount) {
      VisibleInhabitantCount = NextVisibleInhabitantCount;
      GameCanvas.dataset.visibleInhabitantCount = String(VisibleInhabitantCount);
    }
    if (VisiblePrisonerCount !== NextVisiblePrisonerCount) {
      VisiblePrisonerCount = NextVisiblePrisonerCount;
      GameCanvas.dataset.visiblePrisonerCount = String(VisiblePrisonerCount);
    }
    if (VisibleGuardCount !== NextVisibleGuardCount) {
      VisibleGuardCount = NextVisibleGuardCount;
      GameCanvas.dataset.visibleGuardCount = String(VisibleGuardCount);
    }
    GameCanvas.dataset.worldLifeStages = LifeStages.join(',');
  }

  /** A pooled line network and tiny courier fleet make every new connection persist visibly. */
  const MaximumRelayLinkCount = LaunchBudget;
  const RelayLinkPositionValues = new Float32Array(MaximumRelayLinkCount * 6);
  const RelayLinkGeometry = new THREE.BufferGeometry();
  const RelayLinkPositionAttribute = new THREE.BufferAttribute(RelayLinkPositionValues, 3);
  RelayLinkPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  RelayLinkGeometry.setAttribute('position', RelayLinkPositionAttribute);
  RelayLinkGeometry.setDrawRange(0, 0);
  const RelayLinkMaterial = new THREE.LineBasicMaterial({
    color: 0x72e8ff,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const RelayLinkMesh = new THREE.LineSegments(RelayLinkGeometry, RelayLinkMaterial);
  RelayLinkMesh.frustumCulled = false;
  Scene.add(RelayLinkMesh);

  const TradeShipGeometry = new THREE.ConeGeometry(0.13, 0.38, 6);
  const TradeShipMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    toneMapped: false,
  });
  const TradeShipCapacity = Math.max(1, MaximumRelayLinkCount * 2);
  const TradeShipMesh = new THREE.InstancedMesh(
    TradeShipGeometry,
    TradeShipMaterial,
    TradeShipCapacity,
  );
  const TradeShipTransform = new THREE.Object3D();
  const TradeShipColor = new THREE.Color();
  const TradeShipDockTintColor = new THREE.Color(0xfff4c8);
  TradeShipMesh.count = 0;
  TradeShipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  TradeShipMesh.frustumCulled = false;
  Scene.add(TradeShipMesh);

  function publishRelayNetworkState() {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    const Links = listRelayLinks(RelayNetworkState);
    const LiveLinks = getFrameLiveRelayLinks();
    const LiveCircuits = getFrameLiveRelayCircuits();
    GameCanvas.dataset.relayLinkCount = String(Links.length);
    GameCanvas.dataset.relayLinks = Links.map((Link) => Link.id).join(',');
    GameCanvas.dataset.relayLiveLinkCount = String(LiveLinks.length);
    GameCanvas.dataset.relayLiveLinks = LiveLinks.map((Link) => Link.id).join(',');
    GameCanvas.dataset.relaySuppressedWorlds = [
      ...RelayNetworkState.suppressedWorldIdentifiers,
    ].sort().join(',');
    GameCanvas.dataset.relayCircuitCount = String(RelayNetworkState.circuits.size);
    GameCanvas.dataset.relayLiveCircuitCount = String(LiveCircuits.length);
    GameCanvas.dataset.relayProtectedWorlds = listProtectedRelayWorlds(
      RelayNetworkState,
    ).join(',');
    GameCanvas.dataset.relayActiveWorlds = [...RelayNetworkState.activeWorldIdentifiers]
      .sort()
      .join(',');
    publishRunUnlockState();
  }

  function publishRunUnlockState() {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    const UnlockState = getRunUnlockState({
      liveRelayCount: countLiveRelayWorlds(RelayNetworkState),
      uniqueCircuitCount: listRelayCircuits(RelayNetworkState).length,
      wardenStatus: WardenPursuitState.status,
      recaptureCutAvailable: RecaptureCutGiftAvailable,
      prefersReducedMotion: PrefersReducedMotion,
    });
    GameCanvas.dataset.predictionHold = String(UnlockState.predictionHold);
    GameCanvas.dataset.leftoverCut = String(UnlockState.leftoverCut);
    GameCanvas.dataset.circuitBeacon = UnlockState.circuitBeacon
      ? (GameCanvas.dataset.circuitBeaconLink || 'ready')
      : '';
    GameCanvas.dataset.commandLockGift = String(UnlockState.commandLock);
    GameCanvas.dataset.recaptureCutGift = String(UnlockState.recaptureCut);
  }

  function synchronizeCircuitBeacon() {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    const Beacon = findCircuitBeaconLink(RelayNetworkState, CurrentWorldIdentifier);
    if (!Beacon) {
      CircuitBeaconLine.visible = false;
      GameCanvas.dataset.circuitBeaconLink = '';
      return;
    }
    const Origin = getWorldDefinition(Beacon.originWorldIdentifier);
    const Destination = getWorldDefinition(Beacon.destinationWorldIdentifier);
    if (!Origin || !Destination) {
      CircuitBeaconLine.visible = false;
      GameCanvas.dataset.circuitBeaconLink = '';
      return;
    }
    CircuitBeaconGeometry.setFromPoints([
      new THREE.Vector3(Origin.position.x, Origin.position.y, 0.18),
      new THREE.Vector3(Destination.position.x, Destination.position.y, 0.18),
    ]);
    CircuitBeaconLine.computeLineDistances();
    CircuitBeaconLine.visible = true;
    GameCanvas.dataset.circuitBeaconLink = Beacon.id;
  }

  function synchronizeRelayNetworkVisuals() {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    const Links = getFrameLiveRelayLinks();
    const HasLiveCircuit = getFrameLiveRelayCircuits().length > 0;
    RelayLinkMaterial.color.setHex(HasLiveCircuit ? 0xffd98a : 0x72e8ff);
    for (let LinkIndex = 0; LinkIndex < Links.length; LinkIndex += 1) {
      const Link = Links[LinkIndex];
      const Origin = getWorldDefinition(Link.originWorldIdentifier);
      const Destination = getWorldDefinition(Link.destinationWorldIdentifier);
      const ValueOffset = LinkIndex * 6;
      RelayLinkPositionValues[ValueOffset] = Origin.position.x;
      RelayLinkPositionValues[ValueOffset + 1] = Origin.position.y;
      RelayLinkPositionValues[ValueOffset + 2] = 0.16;
      RelayLinkPositionValues[ValueOffset + 3] = Destination.position.x;
      RelayLinkPositionValues[ValueOffset + 4] = Destination.position.y;
      RelayLinkPositionValues[ValueOffset + 5] = 0.16;
    }
    RelayLinkGeometry.setDrawRange(0, Links.length * 2);
    RelayLinkPositionAttribute.needsUpdate = true;
    synchronizeCircuitBeacon();
    publishRelayNetworkState();
  }

  function updateRelayNetworkVisuals(ElapsedTimeSeconds) {
    const {
      IsPointerAiming,
      IsKeyboardAiming,
      GamePhase,
      PrefersReducedMotion,
      ScoreState,
      RelayNetworkState,
      WardenPursuitState,
      RecaptureCutGiftAvailable,
      CurrentWorldIdentifier,
      FinaleRestorationStartedAtSeconds,
    } = host;
    const Links = getFrameLiveRelayLinks();
    const LiveCircuitLinkIdentifiers = new Set(
      getFrameLiveRelayCircuits().flatMap((Circuit) => Circuit.linkIdentifiers),
    );
    RelayLinkMaterial.opacity = getRelayLinkOpacity(ElapsedTimeSeconds, {
      reducedMotion: PrefersReducedMotion,
    });
    let ShipIndex = 0;
    const HullKinds = [];
    for (let LinkIndex = 0; LinkIndex < Links.length; LinkIndex += 1) {
      const Link = Links[LinkIndex];
      const Origin = getWorldDefinition(Link.originWorldIdentifier);
      const Destination = getWorldDefinition(Link.destinationWorldIdentifier);
      const InLiveCircuit = LiveCircuitLinkIdentifiers.has(Link.id);
      const ShipCount = getLiveLinkShipCount({
        originDegree: getRelayDegree(RelayNetworkState, Link.originWorldIdentifier),
        destinationDegree: getRelayDegree(RelayNetworkState, Link.destinationWorldIdentifier),
        inLiveCircuit: InLiveCircuit,
      });
      const HullKind = getTradeHullKind(Origin.visualKey, Destination.visualKey);
      const HullScale = getTradeHullScale(HullKind);
      HullKinds.push(HullKind);
      const LaneX = Destination.position.x - Origin.position.x;
      const LaneY = Destination.position.y - Origin.position.y;
      const LaneLength = Math.hypot(LaneX, LaneY) || 1;
      const NormalX = -LaneY / LaneLength;
      const NormalY = LaneX / LaneLength;
      for (let ShipSlot = 0; ShipSlot < ShipCount && ShipIndex < TradeShipCapacity; ShipSlot += 1) {
        const CourierAgeSeconds = (
          CourierStartTimesByLinkId.has(Link.id)
            ? Math.max(0, ElapsedTimeSeconds - CourierStartTimesByLinkId.get(Link.id))
            : ((ElapsedTimeSeconds * 0.11) + (Link.sequenceIndex * 0.37)) / 0.11
        ) + (ShipSlot * 4.2);
        const CourierTravel = getRelayCourierTravelProgress(CourierAgeSeconds, {
          dwellRatio: getTradeCourierDwellRatio(),
        });
        const LaneOffset = CourierTravel.isDocked
          ? 0
          : (ShipSlot === 0 ? 0.55 : -0.72)
            * Math.sin(CourierTravel.travelProgress * Math.PI);
        const FlightHeight = CourierTravel.isDocked
          ? 0.22
          : 0.3 + (Math.sin(CourierTravel.travelProgress * Math.PI) * 0.75);
        TradeShipTransform.position.set(
          THREE.MathUtils.lerp(
            Origin.position.x,
            Destination.position.x,
            CourierTravel.travelProgress,
          ) + (NormalX * LaneOffset),
          THREE.MathUtils.lerp(
            Origin.position.y,
            Destination.position.y,
            CourierTravel.travelProgress,
          ) + (NormalY * LaneOffset),
          FlightHeight,
        );
        TradeShipTransform.rotation.set(
          0,
          0,
          Math.atan2(
            Destination.position.y - Origin.position.y,
            Destination.position.x - Origin.position.x,
          ) - (Math.PI * 0.5) + (CourierTravel.isReturning ? Math.PI : 0),
        );
        TradeShipTransform.scale.set(HullScale.x, HullScale.y, HullScale.z);
        TradeShipTransform.updateMatrix();
        TradeShipMesh.setMatrixAt(ShipIndex, TradeShipTransform.matrix);
        TradeShipColor.setHex(getTradeHullColor(HullKind, InLiveCircuit));
        if (CourierTravel.isDocked) {
          TradeShipColor.lerp(TradeShipDockTintColor, 0.4);
        }
        TradeShipMesh.setColorAt(ShipIndex, TradeShipColor);
        ShipIndex += 1;
      }
    }
    for (let HiddenShipIndex = ShipIndex; HiddenShipIndex < TradeShipMesh.count; HiddenShipIndex += 1) {
      TradeShipTransform.scale.set(0, 0, 0);
      TradeShipTransform.position.set(0, 0, -8);
      TradeShipTransform.updateMatrix();
      TradeShipMesh.setMatrixAt(HiddenShipIndex, TradeShipTransform.matrix);
    }
    TradeShipMesh.count = ShipIndex;
    if (ShipIndex > 0) {
      TradeShipMesh.instanceMatrix.needsUpdate = true;
      if (TradeShipMesh.instanceColor) TradeShipMesh.instanceColor.needsUpdate = true;
    }
    GameCanvas.dataset.tradeShipCount = String(ShipIndex);
    GameCanvas.dataset.tradeHullKinds = HullKinds.join(',');
  }

  const CircuitBeaconGeometry = new THREE.BufferGeometry();
  const CircuitBeaconMaterial = new THREE.LineDashedMaterial({
    color: 0xffd98a,
    transparent: true,
    opacity: 0.78,
    dashSize: 0.55,
    gapSize: 0.28,
    depthWrite: false,
    depthTest: false,
  });
  const CircuitBeaconLine = new THREE.Line(CircuitBeaconGeometry, CircuitBeaconMaterial);
  CircuitBeaconLine.visible = false;
  CircuitBeaconLine.renderOrder = 18;
  CircuitBeaconLine.frustumCulled = false;
  Scene.add(CircuitBeaconLine);

  function resetLivingWorldVisuals() {
    CircuitBeaconLine.visible = false;
    GameCanvas.dataset.circuitBeaconLink = '';
    DockedWorldIdentifiers.clear();
    DockGatherAngleByWorldId.clear();
  }

  function updateLivingWorldVisuals(ElapsedTimeSeconds) {
    updateOccupationScarVisuals(ElapsedTimeSeconds);
    refreshDockedTradeState(ElapsedTimeSeconds);
    updateProsperityBuildingVisuals(ElapsedTimeSeconds);
    updateExtractionFreighterVisuals(ElapsedTimeSeconds);
    updateInhabitantVisuals(ElapsedTimeSeconds);
    updateRelayNetworkVisuals(ElapsedTimeSeconds);
    updateSlingshotBandVisuals(ElapsedTimeSeconds);
  }

  return {
    updateSlingshotBandVisuals,
    updateOccupationScarVisuals,
    updateExtractionFreighterVisuals,
    refreshDockedTradeState,
    updateProsperityBuildingVisuals,
    updateInhabitantVisuals,
    publishRelayNetworkState,
    publishRunUnlockState,
    synchronizeCircuitBeacon,
    synchronizeRelayNetworkVisuals,
    updateRelayNetworkVisuals,
    updateLivingWorldVisuals,
    resetLivingWorldVisuals,
    circuitBeaconLine: CircuitBeaconLine,
    circuitBeaconMaterial: CircuitBeaconMaterial,
  };
}
