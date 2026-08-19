/**
 * Living-world presentation: slingshot wells, occupation scars, prosperity,
 * inhabitants, relay links and trade hulls. Never enters ranked simulation.
 */

import {
  getCourierDockWorldRole,
  getExtractionFreighterTravelProgress,
  getInhabitantSilhouette,
  getInhabitantSurfaceSite,
  getLiveLinkShipCount,
  getProsperityBuildingFamily,
  getProsperityBuildingKind,
  getProsperityBuildingProfile,
  getProsperityPresence,
  getProsperityStage,
  getRelayCourierTravelProgress,
  getRelayLinkOpacity,
  getRunUnlockState,
  getSlingshotBandVisualState,
  getSphereLifePlacement,
  shouldHideLandedOrbitalOverlays,
  shouldShowProsperityWindows,
  getTradeHullColor,
  getTradeHullFamily,
  getTradeHullKind,
  getTradeHullScale,
  getTyrantOccupationStrength,
  getWorldLifeStage,
  getToyDioramaScale,
  listOccupationSites,
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
import { getSlingshotBandRadii, addDiscoveryBonus } from './scoring.js';
import {
  consumePendingDiscoveryBank,
  getLiveDiscoveryState,
  isDiscoveryCollected,
  listWorldDiscoveries,
  resetLiveDiscoveryState,
} from './discoveries.js?v=20260818-ob123';

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

  const SurfaceUp = new THREE.Vector3(0, 1, 0);
  const SurfaceNormal = new THREE.Vector3();
  const CrustOffset = new THREE.Vector3();
  const CrustDirection = new THREE.Vector3();

  function applySphereInstance(Transform, Placement, ScaleX, ScaleY, ScaleZ, YawRadians = 0) {
    SurfaceNormal.set(Placement.directionX, Placement.directionY, Placement.directionZ);
    if (SurfaceNormal.lengthSq() < 1e-8) {
      SurfaceNormal.set(0, 0, 1);
    } else {
      SurfaceNormal.normalize();
    }
    Transform.position.set(Placement.x, Placement.y, Placement.z);
    Transform.quaternion.setFromUnitVectors(SurfaceUp, SurfaceNormal);
    if (YawRadians !== 0) {
      Transform.rotateY(YawRadians);
    }
    Transform.scale.set(ScaleX, ScaleY, ScaleZ);
    Transform.updateMatrix();
  }

  function shouldSkipStridedPresentation() {
    if (host.GamePhase === 'attached' || host.GamePhase === 'restoring') {
      return false;
    }
    const QualitySettings = host.AdaptivePresentationSettings;
    const Stride = QualitySettings?.instanceStride ?? 1;
    if (Stride <= 1) {
      return false;
    }
    return (host.PresentationFrameIndex ?? 0) % Stride !== 0;
  }

  /**
   * Merges primitive parts into one instanced silhouette. Keeps draw count
   * unchanged while giving people and buildings readable toy shapes.
   */
  function mergePrimitiveParts(Parts) {
    const PositionValues = [];
    const NormalValues = [];
    const ColorValues = [];
    const PartTransform = new THREE.Object3D();
    const PartColor = new THREE.Color();
    for (const Part of Parts) {
      const SourceGeometry = Part.geometry.index
        ? Part.geometry.toNonIndexed()
        : Part.geometry.clone();
      PartTransform.position.set(
        Part.position?.[0] ?? 0,
        Part.position?.[1] ?? 0,
        Part.position?.[2] ?? 0,
      );
      PartTransform.rotation.set(
        Part.rotation?.[0] ?? 0,
        Part.rotation?.[1] ?? 0,
        Part.rotation?.[2] ?? 0,
      );
      PartTransform.scale.set(
        Part.scale?.[0] ?? 1,
        Part.scale?.[1] ?? 1,
        Part.scale?.[2] ?? 1,
      );
      PartTransform.updateMatrix();
      SourceGeometry.applyMatrix4(PartTransform.matrix);
      const Positions = SourceGeometry.getAttribute('position').array;
      const Normals = SourceGeometry.getAttribute('normal')?.array;
      PartColor.setHex(Part.color ?? 0xffffff);
      for (let VertexIndex = 0; VertexIndex < Positions.length / 3; VertexIndex += 1) {
        PositionValues.push(
          Positions[VertexIndex * 3],
          Positions[(VertexIndex * 3) + 1],
          Positions[(VertexIndex * 3) + 2],
        );
        NormalValues.push(
          Normals ? Normals[VertexIndex * 3] : 0,
          Normals ? Normals[(VertexIndex * 3) + 1] : 0,
          Normals ? Normals[(VertexIndex * 3) + 2] : 0,
        );
        ColorValues.push(PartColor.r, PartColor.g, PartColor.b);
      }
      SourceGeometry.dispose();
      Part.geometry.dispose();
    }
    const MergedGeometry = new THREE.BufferGeometry();
    MergedGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(PositionValues, 3),
    );
    MergedGeometry.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(NormalValues, 3),
    );
    MergedGeometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(ColorValues, 3),
    );
    MergedGeometry.computeBoundingSphere();
    return MergedGeometry;
  }

  /** Helmeted toy person: head, visor, torso, backpack, arms and legs. */
  function createWalkerPersonGeometry() {
    return mergePrimitiveParts([
      { geometry: new THREE.CylinderGeometry(0.06, 0.07, 0.26, 6), position: [-0.09, 0.13, 0], color: 0xd7e6ea },
      { geometry: new THREE.CylinderGeometry(0.06, 0.07, 0.26, 6), position: [0.09, 0.13, 0], color: 0xd7e6ea },
      { geometry: new THREE.BoxGeometry(0.28, 0.3, 0.2), position: [0, 0.4, 0], color: 0xeef6f8 },
      { geometry: new THREE.BoxGeometry(0.2, 0.18, 0.1), position: [0, 0.42, -0.14], color: 0x1d3c4a },
      { geometry: new THREE.CylinderGeometry(0.05, 0.055, 0.24, 6), position: [-0.2, 0.38, 0], rotation: [0, 0, 0.42], color: 0xd7e6ea },
      { geometry: new THREE.CylinderGeometry(0.05, 0.055, 0.24, 6), position: [0.2, 0.38, 0], rotation: [0, 0, -0.42], color: 0xd7e6ea },
      { geometry: new THREE.SphereGeometry(0.16, 10, 8), position: [0, 0.68, 0], color: 0xf4fbff },
      { geometry: new THREE.SphereGeometry(0.11, 8, 6), position: [0, 0.67, 0.12], scale: [1, 0.7, 0.4], color: 0xffb45a },
    ]);
  }

  /** Four-legged pack beast with a saddle load so the second silhouette is an animal. */
  function createPackBeastGeometry() {
    return mergePrimitiveParts([
      { geometry: new THREE.SphereGeometry(0.16, 8, 6), position: [0, 0.22, 0], scale: [0.85, 0.72, 1.45], color: 0xc48a58 },
      { geometry: new THREE.CylinderGeometry(0.035, 0.045, 0.2, 5), position: [-0.08, 0.1, 0.12], color: 0x8a5a38 },
      { geometry: new THREE.CylinderGeometry(0.035, 0.045, 0.2, 5), position: [0.08, 0.1, 0.12], color: 0x8a5a38 },
      { geometry: new THREE.CylinderGeometry(0.035, 0.045, 0.2, 5), position: [-0.08, 0.1, -0.12], color: 0x8a5a38 },
      { geometry: new THREE.CylinderGeometry(0.035, 0.045, 0.2, 5), position: [0.08, 0.1, -0.12], color: 0x8a5a38 },
      { geometry: new THREE.SphereGeometry(0.09, 8, 6), position: [0, 0.3, 0.22], color: 0xd4a06a },
      { geometry: new THREE.ConeGeometry(0.04, 0.1, 4), position: [-0.05, 0.4, 0.22], color: 0xc48a58 },
      { geometry: new THREE.ConeGeometry(0.04, 0.1, 4), position: [0.05, 0.4, 0.22], color: 0xc48a58 },
      { geometry: new THREE.BoxGeometry(0.16, 0.12, 0.14), position: [0, 0.36, -0.02], color: 0x3d5c48 },
    ]);
  }

  /** Cottage: walls, pitched roof, chimney and a door that reads from orbit. */
  function createCottageBuildingGeometry() {
    return mergePrimitiveParts([
      { geometry: new THREE.BoxGeometry(0.72, 0.42, 0.58), position: [0, 0.21, 0], color: 0xe4c49a },
      { geometry: new THREE.ConeGeometry(0.58, 0.38, 4), position: [0, 0.58, 0], rotation: [0, Math.PI * 0.25, 0], color: 0xb24a3a },
      { geometry: new THREE.BoxGeometry(0.12, 0.22, 0.12), position: [0.18, 0.7, -0.08], color: 0x7a5344 },
      { geometry: new THREE.BoxGeometry(0.16, 0.26, 0.05), position: [0, 0.16, 0.3], color: 0x4a2e24 },
    ]);
  }

  /** Furnace: kiln body, stack and a mouth so workshops read as industry. */
  function createFurnaceBuildingGeometry() {
    return mergePrimitiveParts([
      { geometry: new THREE.CylinderGeometry(0.22, 0.26, 0.38, 8), position: [0, 0.19, 0], color: 0xb76545 },
      { geometry: new THREE.CylinderGeometry(0.1, 0.12, 0.52, 6), position: [0, 0.62, 0], color: 0x5a3a32 },
      { geometry: new THREE.BoxGeometry(0.16, 0.14, 0.08), position: [0, 0.18, 0.24], color: 0xff7b32 },
      { geometry: new THREE.BoxGeometry(0.36, 0.08, 0.36), position: [0, 0.04, 0], color: 0x4a2c24 },
    ]);
  }

  /** Canopy hall: trunk plus two leaf masses, a tree-building not a lathe blob. */
  function createCanopyBuildingGeometry() {
    return mergePrimitiveParts([
      { geometry: new THREE.CylinderGeometry(0.08, 0.11, 0.36, 6), position: [0, 0.18, 0], color: 0x6a4a36 },
      { geometry: new THREE.SphereGeometry(0.28, 8, 6), position: [0, 0.42, 0], color: 0x4e7a44 },
      { geometry: new THREE.ConeGeometry(0.32, 0.34, 6), position: [0, 0.68, 0], color: 0x3d6a38 },
    ]);
  }

  /** Jetty: deck, pilings and a bollard so docks read as harbour, not a plank. */
  function createJettyBuildingGeometry() {
    return mergePrimitiveParts([
      { geometry: new THREE.BoxGeometry(0.32, 0.06, 0.14), position: [0, 0.08, 0], color: 0x8a6a48 },
      { geometry: new THREE.CylinderGeometry(0.02, 0.024, 0.1, 6), position: [-0.12, 0.04, 0.05], color: 0x5a4030 },
      { geometry: new THREE.CylinderGeometry(0.02, 0.024, 0.1, 6), position: [0.12, 0.04, 0.05], color: 0x5a4030 },
      { geometry: new THREE.CylinderGeometry(0.02, 0.024, 0.1, 6), position: [-0.12, 0.04, -0.05], color: 0x5a4030 },
      { geometry: new THREE.CylinderGeometry(0.02, 0.024, 0.1, 6), position: [0.12, 0.04, -0.05], color: 0x5a4030 },
      { geometry: new THREE.CylinderGeometry(0.016, 0.02, 0.08, 6), position: [0.12, 0.14, 0], color: 0xc9a078 },
    ]);
  }

  function getDisplayedProsperityPresence(stage) {
    return getProsperityPresence(stage);
  }

  function getDisplayedBuildingKind(stage, patternIndex, satelliteIndex = 0) {
    const NetworkKind = getProsperityBuildingKind(stage, patternIndex);
    if (NetworkKind) {
      return satelliteIndex === 0 ? NetworkKind : 'house';
    }
    if (stage === 'isolated') {
      return satelliteIndex === 1 ? 'dock' : 'house';
    }
    if (stage === 'tyrant') {
      return satelliteIndex === 0 ? 'workshop' : 'house';
    }
    return null;
  }

  function shouldShowDisplayedInhabitant(lifeStage, prosperityStage, slotIndex) {
    if (lifeStage === 'tyrant') {
      return slotIndex < 10;
    }
    if (lifeStage === 'isolated') {
      return slotIndex < 8;
    }
    return shouldShowInhabitantSlot({
      lifeStage,
      prosperityStage,
      slotIndex,
    });
  }

  function hideInstance(Transform, Mesh, InstanceIndex) {
    Transform.position.set(0, 0, -8);
    Transform.rotation.set(0, 0, 0);
    Transform.quaternion.identity();
    Transform.scale.set(0, 0, 0);
    Transform.updateMatrix();
    Mesh.setMatrixAt(InstanceIndex, Transform.matrix);
  }

  function isLandedCloseUpView() {
    return shouldHideLandedOrbitalOverlays({
      gamePhase: host.GamePhase,
      isAiming: host.IsPointerAiming === true || host.IsKeyboardAiming === true,
    });
  }

  function getWorldLifePlacement(WorldDefinition, Site, RadialOffset) {
    const LocalPlacement = getSphereLifePlacement({
      worldX: 0,
      worldY: 0,
      worldZ: 0,
      worldRadius: WorldDefinition.radius,
      longitude: Site.longitude,
      latitude: Site.latitude,
      radialOffset: RadialOffset,
    });
    const WorldGroup = WorldRuntimeByIdentifier.get(WorldDefinition.id)?.group;
    if (!WorldGroup) {
      return getSphereLifePlacement({
        worldX: WorldDefinition.position.x,
        worldY: WorldDefinition.position.y,
        worldZ: WorldDefinition.position.z ?? 0,
        worldRadius: WorldDefinition.radius,
        longitude: Site.longitude,
        latitude: Site.latitude,
        radialOffset: RadialOffset,
      });
    }
    WorldGroup.updateWorldMatrix(true, false);
    CrustOffset.set(LocalPlacement.x, LocalPlacement.y, LocalPlacement.z);
    CrustOffset.applyMatrix4(WorldGroup.matrixWorld);
    CrustDirection.set(
      LocalPlacement.directionX,
      LocalPlacement.directionY,
      LocalPlacement.directionZ,
    );
    CrustDirection.transformDirection(WorldGroup.matrixWorld);
    return {
      ...LocalPlacement,
      x: CrustOffset.x,
      y: CrustOffset.y,
      z: CrustOffset.z,
      directionX: CrustDirection.x,
      directionY: CrustDirection.y,
      directionZ: CrustDirection.z,
    };
  }

  function shouldHideFarSideLife(WorldDefinition, Placement) {
    return isLandedCloseUpView()
      && WorldDefinition.id === host.CurrentWorldIdentifier
      && Placement.directionZ < 0.22;
  }

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

  // A soft additive glow sized by each body's gravitational parameter, so the
  // heavy anchor worlds visibly read as deeper wells than the asteroid shards.
  const WellGlowCanvas = document.createElement('canvas');
  WellGlowCanvas.width = 128;
  WellGlowCanvas.height = 128;
  const WellGlowContext = WellGlowCanvas.getContext('2d');
  const WellGlowGradient = WellGlowContext.createRadialGradient(64, 64, 8, 64, 64, 64);
  WellGlowGradient.addColorStop(0, 'rgba(255,255,255,0.75)');
  WellGlowGradient.addColorStop(0.45, 'rgba(255,255,255,0.24)');
  WellGlowGradient.addColorStop(1, 'rgba(255,255,255,0)');
  WellGlowContext.fillStyle = WellGlowGradient;
  WellGlowContext.fillRect(0, 0, 128, 128);
  const GravityWellTexture = new THREE.CanvasTexture(WellGlowCanvas);
  const GravityWellMaterial = new THREE.MeshBasicMaterial({
    map: GravityWellTexture,
    color: 0x3f7fb4,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const GravityWellMesh = new THREE.InstancedMesh(
    new THREE.RingGeometry(0.58, 1, 64),
    GravityWellMaterial,
    WorldDefinitions.length,
  );
  const GravityWellColor = new THREE.Color();
  GravityWellMesh.frustumCulled = false;
  GravityWellMesh.renderOrder = 7;
  GravityWellMesh.visible = false;
  Scene.add(GravityWellMesh);

  // Beacon-lit relay-port arcs: landing lights along each unliberated world's
  // authored port band, with a pulsing beacon at the arc centre. Landing inside
  // liberates; the brighter inner third grades BULLSEYE.
  const RelayPortWorlds = WorldDefinitions.filter(
    (WorldDefinition) => WorldDefinition.relayPort,
  );
  const RelayPortDotsPerWorld = 15;
  const RelayPortDotMesh = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.085, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
    Math.max(1, RelayPortWorlds.length * RelayPortDotsPerWorld),
  );
  const RelayPortBeaconMesh = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.2, 14),
    new THREE.MeshBasicMaterial({
      color: 0xffd27a,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    }),
    Math.max(1, RelayPortWorlds.length),
  );
  const RelayPortTransform = new THREE.Object3D();
  const RelayPortDotColor = new THREE.Color();
  RelayPortDotMesh.frustumCulled = false;
  RelayPortBeaconMesh.frustumCulled = false;
  RelayPortDotMesh.renderOrder = 10;
  RelayPortBeaconMesh.renderOrder = 11;
  RelayPortDotMesh.visible = RelayPortWorlds.length > 0;
  RelayPortBeaconMesh.visible = RelayPortWorlds.length > 0;
  Scene.add(RelayPortDotMesh);
  Scene.add(RelayPortBeaconMesh);

  function updateRelayPortVisuals(ElapsedTimeSeconds) {
    if (RelayPortWorlds.length === 0) {
      return;
    }
    const ShowPorts = !isLandedCloseUpView();
    RelayPortDotMesh.visible = ShowPorts;
    RelayPortBeaconMesh.visible = ShowPorts;
    if (!ShowPorts) {
      return;
    }
    const Pulse = host.PrefersReducedMotion
      ? 1
      : 1 + (Math.sin(ElapsedTimeSeconds * 3.1) * 0.18);
    for (let PortIndex = 0; PortIndex < RelayPortWorlds.length; PortIndex += 1) {
      const WorldDefinition = RelayPortWorlds[PortIndex];
      const Port = WorldDefinition.relayPort;
      const IsTarget = !WorldDefinition.restored;
      const ArcRadius = WorldDefinition.radius + 0.24;
      for (let DotIndex = 0; DotIndex < RelayPortDotsPerWorld; DotIndex += 1) {
        const InstanceIndex = (PortIndex * RelayPortDotsPerWorld) + DotIndex;
        if (!IsTarget) {
          hideInstance(RelayPortTransform, RelayPortDotMesh, InstanceIndex);
          continue;
        }
        const ArcFraction = (DotIndex / (RelayPortDotsPerWorld - 1)) * 2 - 1;
        const DotAngle = Port.angleRadians + (ArcFraction * Port.halfWidthRadians);
        RelayPortTransform.position.set(
          WorldDefinition.position.x + (Math.cos(DotAngle) * ArcRadius),
          WorldDefinition.position.y + (Math.sin(DotAngle) * ArcRadius),
          0.12,
        );
        RelayPortTransform.rotation.set(0, 0, 0);
        RelayPortTransform.quaternion.identity();
        RelayPortTransform.scale.setScalar(Math.abs(ArcFraction) <= 1 / 3 ? 0.95 : 0.7);
        RelayPortTransform.updateMatrix();
        RelayPortDotMesh.setMatrixAt(InstanceIndex, RelayPortTransform.matrix);
        RelayPortDotColor.setHex(Math.abs(ArcFraction) <= 1 / 3 ? 0xffedbe : 0xd9a94f);
        RelayPortDotMesh.setColorAt(InstanceIndex, RelayPortDotColor);
      }
      if (!IsTarget) {
        hideInstance(RelayPortTransform, RelayPortBeaconMesh, PortIndex);
        continue;
      }
      RelayPortTransform.position.set(
        WorldDefinition.position.x + (Math.cos(Port.angleRadians) * (ArcRadius + 0.18)),
        WorldDefinition.position.y + (Math.sin(Port.angleRadians) * (ArcRadius + 0.18)),
        0.13,
      );
      RelayPortTransform.rotation.set(0, 0, 0);
      RelayPortTransform.quaternion.identity();
      RelayPortTransform.scale.setScalar(Pulse);
      RelayPortTransform.updateMatrix();
      RelayPortBeaconMesh.setMatrixAt(PortIndex, RelayPortTransform.matrix);
    }
    RelayPortDotMesh.instanceMatrix.needsUpdate = true;
    RelayPortBeaconMesh.instanceMatrix.needsUpdate = true;
    if (RelayPortDotMesh.instanceColor) RelayPortDotMesh.instanceColor.needsUpdate = true;
  }

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
    const ShowBands = VisualState.visible && !isLandedCloseUpView();
    SlingshotAssistMesh.visible = ShowBands;
    SlingshotRazorMesh.visible = ShowBands;
    GravityWellMesh.visible = ShowBands;
    if (!ShowBands) {
      return;
    }

    SlingshotAssistMaterial.opacity = VisualState.assistOpacity;
    SlingshotRazorMaterial.opacity = VisualState.razorOpacity;
    const ZoomFade = THREE.MathUtils.clamp(
      THREE.MathUtils.smoothstep(0.72, 1.18, host.CameraDistanceScale ?? 1),
      0,
      1,
    );
    GravityWellMesh.visible = ZoomFade > 0.04;
    GravityWellMaterial.opacity = VisualState.wellOpacity * (0.22 + (ZoomFade * 0.78));
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

      const WellRadius = WorldDefinition.radius
        + (Math.sqrt(WorldDefinition.gravitationalParameter) * 0.22);
      SlingshotBandTransform.rotation.set(0, 0, 0);
      SlingshotBandTransform.position.set(
        WorldDefinition.position.x,
        WorldDefinition.position.y,
        0.05,
      );
      SlingshotBandTransform.scale.set(WellRadius, WellRadius, 1);
      SlingshotBandTransform.updateMatrix();
      GravityWellMesh.setMatrixAt(WorldIndex, SlingshotBandTransform.matrix);
      GravityWellColor.setHex(IsActive || IsPredicted ? 0x9fd8ff : 0x39678f);
      GravityWellMesh.setColorAt(WorldIndex, GravityWellColor);
    }
    SlingshotAssistMesh.instanceMatrix.needsUpdate = true;
    SlingshotRazorMesh.instanceMatrix.needsUpdate = true;
    GravityWellMesh.instanceMatrix.needsUpdate = true;
    if (SlingshotAssistMesh.instanceColor) SlingshotAssistMesh.instanceColor.needsUpdate = true;
    if (SlingshotRazorMesh.instanceColor) SlingshotRazorMesh.instanceColor.needsUpdate = true;
    if (GravityWellMesh.instanceColor) GravityWellMesh.instanceColor.needsUpdate = true;
  }

  /** Instanced mines, clamps, fumes and haulers make Warden-owned worlds look eaten, not merely clamped. */
  // Toy-diorama occupation kit: pylons stay readable at Scout, mines stay smaller than the globe.
  const OccupationScarProfiles = {
    meadow: { height: 0.16, width: 0.24, depth: 0.24 },
    ember: { height: 0.23, width: 0.22, depth: 0.26 },
    grove: { height: 0.15, width: 0.3, depth: 0.22 },
    tide: { height: 0.16, width: 0.33, depth: 0.2 },
    frost: { height: 0.2, width: 0.22, depth: 0.26 },
    vault: { height: 0.24, width: 0.23, depth: 0.27 },
    loom: { height: 0.16, width: 0.28, depth: 0.22 },
    kiln: { height: 0.22, width: 0.23, depth: 0.26 },
    shard: { height: 0.2, width: 0.22, depth: 0.27 },
    relay: { height: 0.16, width: 0.24, depth: 0.24 },
    drift: { height: 0.16, width: 0.33, depth: 0.2 },
    bower: { height: 0.16, width: 0.24, depth: 0.24 },
    lantern: { height: 0.22, width: 0.23, depth: 0.26 },
    canopy: { height: 0.15, width: 0.3, depth: 0.22 },
    crown: { height: 0.24, width: 0.23, depth: 0.27 },
    dew: { height: 0.16, width: 0.33, depth: 0.2 },
    nest: { height: 0.2, width: 0.22, depth: 0.26 },
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
    relay: new THREE.Color(0x8a6a40),
    drift: new THREE.Color(0x4a5a48),
    bower: new THREE.Color(0x6a5a38),
    lantern: new THREE.Color(0xff5a24),
    canopy: new THREE.Color(0x6a5a38),
    crown: new THREE.Color(0x6a2030),
    dew: new THREE.Color(0x4a5a48),
    nest: new THREE.Color(0x6a5a38),
  };
  const OccupationScarInstances = WorldDefinitions.flatMap((WorldDefinition) => (
    listOccupationSites(WorldDefinition).map((Site, PatternIndex) => ({
      worldDefinition: WorldDefinition,
      site: Site,
      patternIndex: PatternIndex,
      buildingFamily: getProsperityBuildingFamily(WorldDefinition.visualKey),
      profile: OccupationScarProfiles[WorldDefinition.visualKey]
        ?? { height: 0.18, width: 0.23, depth: 0.23 },
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
    new THREE.CylinderGeometry(0.036, 0.048, 0.28, 6),
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
    new THREE.ConeGeometry(0.11, 0.52, 6, 1, true),
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
    (WorldDefinition) => listOccupationSites(WorldDefinition).length > 0,
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
    if (shouldSkipStridedPresentation()) {
      return;
    }
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
      if (ScarStrength <= 0.01) {
        hideInstance(OccupationScarTransform, OccupationMineMesh, ScarIndex);
        hideInstance(OccupationScarTransform, OccupationClampMesh, ScarIndex);
        hideInstance(OccupationScarTransform, OccupationFumeMesh, ScarIndex);
        continue;
      }
      const Height = Scar.profile.height * (1 + ((Scar.patternIndex % 2) * 0.12));
      const ScarPlacement = getWorldLifePlacement(Scar.worldDefinition, Scar.site, Height * 0.12);
      if (shouldHideFarSideLife(Scar.worldDefinition, ScarPlacement)) {
        hideInstance(OccupationScarTransform, OccupationMineMesh, ScarIndex);
        hideInstance(OccupationScarTransform, OccupationClampMesh, ScarIndex);
        hideInstance(OccupationScarTransform, OccupationFumeMesh, ScarIndex);
        continue;
      }
      applySphereInstance(
        OccupationScarTransform,
        ScarPlacement,
        Scar.profile.depth * ScarStrength,
        Height * ScarStrength,
        Scar.profile.depth * ScarStrength,
      );
      OccupationMineMesh.setMatrixAt(ScarIndex, OccupationScarTransform.matrix);

      applySphereInstance(
        OccupationScarTransform,
        getWorldLifePlacement(Scar.worldDefinition, Scar.site, Height * 0.58),
        Scar.profile.width * ScarStrength,
        Scar.profile.depth * ScarStrength,
        Scar.profile.depth * ScarStrength,
      );
      OccupationClampMesh.setMatrixAt(ScarIndex, OccupationScarTransform.matrix);

      const FumePulse = PrefersReducedMotion
        ? 1
        : 1 + (Math.sin((ElapsedTimeSeconds * 1.7) + Scar.patternIndex) * 0.18);
      applySphereInstance(
        OccupationScarTransform,
        getWorldLifePlacement(Scar.worldDefinition, Scar.site, Height * 0.55),
        ScarStrength * 0.42 * FumePulse,
        ScarStrength * 0.5 * (1.05 + ((Scar.patternIndex % 2) * 0.18)) * FumePulse,
        ScarStrength * 0.42 * FumePulse,
      );
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
      const OriginPlacement = getWorldLifePlacement(WorldDefinition, {
        longitude: (FreighterIndex * 0.9) + (WorldDefinition.relayPort?.angleRadians ?? 0),
        latitude: 0.12,
      }, 0.18);
      const OriginX = OriginPlacement.x;
      const OriginY = OriginPlacement.y;
      const TravelX = THREE.MathUtils.lerp(OriginX, ExtractionSink.x, Haul.travelProgress);
      const TravelY = THREE.MathUtils.lerp(OriginY, ExtractionSink.y, Haul.travelProgress);
      const OffsetX = OriginY - ExtractionSink.y;
      const OffsetY = ExtractionSink.x - OriginX;
      const OffsetLength = Math.hypot(OffsetX, OffsetY) || 1;
      const LaneOffset = Math.sin(Haul.travelProgress * Math.PI) * 1.6;
      const CraftScale = Visibility * 0.22 * getToyDioramaScale(WorldDefinition.radius);
      ExtractionFreighterTransform.position.set(
        TravelX + ((OffsetX / OffsetLength) * LaneOffset),
        TravelY + ((OffsetY / OffsetLength) * LaneOffset),
        OriginPlacement.z + (Math.sin(Haul.travelProgress * Math.PI) * 0.35),
      );
      ExtractionFreighterTransform.rotation.set(
        0,
        0,
        Math.atan2(ExtractionSink.y - OriginY, ExtractionSink.x - OriginX) - (Math.PI * 0.5),
      );
      ExtractionFreighterTransform.scale.setScalar(CraftScale);
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

  const ProsperityBuildingGeometries = {
    cottage: createCottageBuildingGeometry(),
    furnace: createFurnaceBuildingGeometry(),
    canopy: createCanopyBuildingGeometry(),
    jetty: createJettyBuildingGeometry(),
  };
  const ProsperityBuildingMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9a078,
    emissive: 0xffc878,
    emissiveIntensity: 0.42,
    roughness: 0.62,
    metalness: 0.08,
    vertexColors: true,
  });
  const ProsperityFamilyCounts = { cottage: 0, furnace: 0, canopy: 0, jetty: 0 };
  const ProsperityBuildingInstances = OccupationScarInstances.flatMap((Scar) => {
    const Satellites = [
      { site: Scar.site, satelliteIndex: 0 },
      {
        site: {
          longitude: Scar.site.longitude + 0.22,
          latitude: Math.max(-1.15, Math.min(1.15, Scar.site.latitude + 0.16)),
        },
        satelliteIndex: 1,
      },
      {
        site: {
          longitude: Scar.site.longitude - 0.18,
          latitude: Math.max(-1.15, Math.min(1.15, Scar.site.latitude - 0.14)),
        },
        satelliteIndex: 2,
      },
    ];
    return Satellites.map((Satellite) => ({
      ...Scar,
      site: Satellite.site,
      satelliteIndex: Satellite.satelliteIndex,
    }));
  });
  for (const Building of ProsperityBuildingInstances) {
    Building.familyIndex = ProsperityFamilyCounts[Building.buildingFamily];
    ProsperityFamilyCounts[Building.buildingFamily] += 1;
  }
  function createProsperityFamilyMesh(Geometry, FamilyCount) {
    const FamilyMesh = new THREE.InstancedMesh(
      Geometry,
      ProsperityBuildingMaterial,
      Math.max(1, FamilyCount),
    );
    FamilyMesh.count = FamilyCount;
    FamilyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    FamilyMesh.frustumCulled = false;
    FamilyMesh.castShadow = true;
    Scene.add(FamilyMesh);
    return FamilyMesh;
  }
  const ProsperityBuildingMesh = createProsperityFamilyMesh(
    ProsperityBuildingGeometries.cottage,
    ProsperityFamilyCounts.cottage,
  );
  const ProsperityFurnaceMesh = createProsperityFamilyMesh(
    ProsperityBuildingGeometries.furnace,
    ProsperityFamilyCounts.furnace,
  );
  const ProsperityCanopyMesh = createProsperityFamilyMesh(
    ProsperityBuildingGeometries.canopy,
    ProsperityFamilyCounts.canopy,
  );
  const ProsperityJettyMesh = createProsperityFamilyMesh(
    ProsperityBuildingGeometries.jetty,
    ProsperityFamilyCounts.jetty,
  );
  const ProsperityBuildingMeshes = {
    cottage: ProsperityBuildingMesh,
    furnace: ProsperityFurnaceMesh,
    canopy: ProsperityCanopyMesh,
    jetty: ProsperityJettyMesh,
  };
  const ProsperityBuildingTransform = new THREE.Object3D();
  const ProsperityBuildingColor = new THREE.Color();
  const ProsperityCircuitWarmColor = new THREE.Color(0xffe7b0);
  const ProsperityDockLitColor = new THREE.Color(0xfff4c8);
  const ProsperityTyrantColor = new THREE.Color(0x6a3a32);
  const ProsperityWindowCapacity = Math.max(1, ProsperityBuildingInstances.length);
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
  // Window lights only. Street and town-glow used stretched untextured boxes
  // that read as blank plaques; those instances are no longer allocated.
  ProsperityWindowMesh.count = 0;
  ProsperityWindowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ProsperityWindowMesh.frustumCulled = false;
  Scene.add(ProsperityWindowMesh);
  const ProsperityWindowTransform = new THREE.Object3D();
  const ProsperityWindowColor = new THREE.Color();
  let VisibleProsperityBuildingCount = -1;
  const DockedWorldIdentifiers = new Set();
  const DockGatherSiteByWorldId = new Map();
  let LastPublishedDockedWorlds = null;
  GameCanvas.dataset.prosperityBuildingCount = String(ProsperityBuildingInstances.length);

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
    DockGatherSiteByWorldId.clear();
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
        const DockSites = listOccupationSites(DockWorld);
        const GatherSite = DockSites.find((Site, PatternIndex) => (
          getProsperityBuildingKind(
            getProsperityStage({
              restored: DockWorld.restored,
              liveLinkCount: getRelayDegree(RelayNetworkState, DockWorld.id),
              inLiveCircuit: isWorldInLiveCircuit(DockWorld.id),
            }),
            PatternIndex,
          ) === 'dock'
        )) ?? DockSites[0] ?? { longitude: 0, latitude: 0 };
        DockGatherSiteByWorldId.set(DockWorld.id, GatherSite);
      }
    }
    const DockedWorldsValue = [...DockedWorldIdentifiers].sort().join(',');
    if (DockedWorldsValue !== LastPublishedDockedWorlds) {
      LastPublishedDockedWorlds = DockedWorldsValue;
      GameCanvas.dataset.dockedWorlds = DockedWorldsValue;
    }
  }

  function updateProsperityBuildingVisuals(ElapsedTimeSeconds) {
    if (shouldSkipStridedPresentation()) {
      return;
    }
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
    const BuildingFamilies = [];
    bankPendingDiscoveries();
    updateDiscoveryMarkerVisuals(ElapsedTimeSeconds);
    updateLocalCraftVisuals(ElapsedTimeSeconds);
    for (let BuildingIndex = 0; BuildingIndex < ProsperityBuildingInstances.length; BuildingIndex += 1) {
      const Building = ProsperityBuildingInstances[BuildingIndex];
      const FamilyMesh = ProsperityBuildingMeshes[Building.buildingFamily];
      const LiveLinkCount = getRelayDegree(RelayNetworkState, Building.worldDefinition.id);
      const ProsperityStage = getProsperityStage({
        restored: Building.worldDefinition.restored,
        liveLinkCount: LiveLinkCount,
        inLiveCircuit: isWorldInLiveCircuit(Building.worldDefinition.id),
      });
      const Presence = getDisplayedProsperityPresence(ProsperityStage)
        * (Building.satelliteIndex === 0 ? 1 : 0.82);
      const BuildingKind = getDisplayedBuildingKind(
        ProsperityStage,
        Building.patternIndex,
        Building.satelliteIndex,
      );
      const BuildingProfile = getProsperityBuildingProfile(BuildingKind);
      if (Building.patternIndex === 0 && Building.satelliteIndex === 0) {
        ProsperityKinds.push(`${Building.worldDefinition.id}:${ProsperityStage}:${BuildingKind ?? 'none'}`);
        BuildingFamilies.push(`${Building.worldDefinition.id}:${Building.buildingFamily}`);
      }
      const HideBuilding = Presence <= 0.04 || !BuildingProfile;
      if (HideBuilding) {
        hideInstance(ProsperityBuildingTransform, FamilyMesh, Building.familyIndex);
        continue;
      }
      NextVisibleProsperityBuildingCount += 1;
      const ToyScale = getToyDioramaScale(Building.worldDefinition.radius);
      const StanceScale = ToyScale;
      const Height = BuildingProfile.height
        * Presence
        * StanceScale
        * (1 + ((Building.patternIndex % 3) * 0.08));
      const IsDockLit = BuildingKind === 'dock'
        && DockedWorldIdentifiers.has(Building.worldDefinition.id);
      const Placement = getWorldLifePlacement(Building.worldDefinition, Building.site, Height * 0.02);
      if (shouldHideFarSideLife(Building.worldDefinition, Placement)) {
        hideInstance(ProsperityBuildingTransform, FamilyMesh, Building.familyIndex);
        continue;
      }
      applySphereInstance(
        ProsperityBuildingTransform,
        Placement,
        BuildingProfile.width * Presence * StanceScale,
        Height,
        BuildingProfile.depth * Presence * StanceScale,
      );
      FamilyMesh.setMatrixAt(Building.familyIndex, ProsperityBuildingTransform.matrix);
      ProsperityBuildingColor.set(Building.worldDefinition.restoration.waveColor);
      if (ProsperityStage === 'circuit') {
        ProsperityBuildingColor.lerp(ProsperityCircuitWarmColor, 0.35);
      }
      if (ProsperityStage === 'tyrant') {
        ProsperityBuildingColor.lerp(ProsperityTyrantColor, 0.45);
      }
      if (IsDockLit) {
        ProsperityBuildingColor.lerp(ProsperityDockLitColor, 0.55);
      }
      FamilyMesh.setColorAt(Building.familyIndex, ProsperityBuildingColor);

      if (BuildingProfile.hasWindow && shouldShowProsperityWindows(ProsperityStage)) {
        applySphereInstance(
          ProsperityWindowTransform,
          getWorldLifePlacement(Building.worldDefinition, Building.site, Height * 0.42),
          Presence * 0.58,
          Presence * 0.48 * (IsDockLit ? 1.25 : 1),
          Presence * 0.4,
        );
        ProsperityWindowMesh.setMatrixAt(NextVisibleWindowCount, ProsperityWindowTransform.matrix);
        ProsperityWindowColor.setHex(
          ProsperityStage === 'circuit'
            ? 0xfff0c4
            : ProsperityStage === 'tyrant'
              ? 0xff7a38
              : 0xffd27a,
        );
        ProsperityWindowMesh.setColorAt(NextVisibleWindowCount, ProsperityWindowColor);
        NextVisibleWindowCount += 1;
      }
    }
    for (const FamilyMesh of Object.values(ProsperityBuildingMeshes)) {
      if (FamilyMesh.count > 0) {
        FamilyMesh.instanceMatrix.needsUpdate = true;
        if (FamilyMesh.instanceColor) {
          FamilyMesh.instanceColor.needsUpdate = true;
        }
      }
    }
    if (ProsperityBuildingInstances.length > 0) {
      ProsperityWindowMesh.instanceMatrix.needsUpdate = true;
      if (ProsperityWindowMesh.instanceColor) {
        ProsperityWindowMesh.instanceColor.needsUpdate = true;
      }
    }
    ProsperityWindowMesh.count = NextVisibleWindowCount;
    ProsperityWindowMesh.visible = NextVisibleWindowCount > 0;
    const HasLiveCircuit = getFrameLiveRelayCircuits().length > 0;
    ProsperityBuildingMaterial.emissiveIntensity = 0.05;
    ProsperityWindowMaterial.opacity = PrefersReducedMotion
      ? 0.72
      : 0.64 + (Math.sin(ElapsedTimeSeconds * (HasLiveCircuit ? 5.1 : 2.8)) * 0.18);
    if (VisibleProsperityBuildingCount !== NextVisibleProsperityBuildingCount) {
      VisibleProsperityBuildingCount = NextVisibleProsperityBuildingCount;
      GameCanvas.dataset.visibleProsperityBuildingCount = String(VisibleProsperityBuildingCount);
    }
    GameCanvas.dataset.visibleProsperityWindowCount = String(NextVisibleWindowCount);
    GameCanvas.dataset.prosperityStages = ProsperityKinds.join(',');
    GameCanvas.dataset.prosperityBuildingFamilies = BuildingFamilies.join(',');
  }


  /** Walkers and packs share two draws: helmeted people and pack beasts. */
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
    relay: { speed: 0.42, stride: 0.11 },
    drift: { speed: 0.88, stride: 0.095 },
    bower: { speed: 0.42, stride: 0.11 },
    lantern: { speed: 0.72, stride: 0.075 },
    canopy: { speed: 0.34, stride: 0.14 },
    crown: { speed: 0.24, stride: 0.055 },
    dew: { speed: 0.88, stride: 0.095 },
    nest: { speed: 0.3, stride: 0.065 },
  };
  const InhabitantGuardColor = new THREE.Color(0x6a1c22);
  const InhabitantPrisonerColor = new THREE.Color(0x6e5a52);
  const InhabitantFreeColor = new THREE.Color();
  const InhabitantChildTintColor = new THREE.Color(0xffffff);
  const InhabitantInstances = WorldDefinitions.flatMap((WorldDefinition, WorldIndex) => {
    const Sites = listOccupationSites(WorldDefinition);
    if (Sites.length === 0) {
      return [];
    }
    return Array.from({ length: 16 }, (_, InhabitantIndex) => {
      const Silhouette = getInhabitantSilhouette(InhabitantIndex);
      return {
        worldDefinition: WorldDefinition,
        slotIndex: InhabitantIndex,
        role: InhabitantIndex < 2 ? 'guard' : 'civilian',
        homeSite: Sites[InhabitantIndex % Sites.length],
        silhouetteKind: Silhouette.kind,
        phase: (WorldIndex * 0.73) + (InhabitantIndex * 1.91),
        profile: InhabitantProfiles[WorldDefinition.visualKey]
          ?? { speed: 0.4, stride: 0.08 },
      };
    });
  });
  const InhabitantWalkerCount = InhabitantInstances.filter(
    (Inhabitant) => Inhabitant.silhouetteKind !== 'pack',
  ).length;
  const InhabitantPackCount = InhabitantInstances.filter(
    (Inhabitant) => Inhabitant.silhouetteKind === 'pack',
  ).length;
  let WalkerFamilyIndex = 0;
  let PackFamilyIndex = 0;
  for (const Inhabitant of InhabitantInstances) {
    if (Inhabitant.silhouetteKind === 'pack') {
      Inhabitant.familyIndex = PackFamilyIndex;
      PackFamilyIndex += 1;
    } else {
      Inhabitant.familyIndex = WalkerFamilyIndex;
      WalkerFamilyIndex += 1;
    }
  }
  const InhabitantMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  const InhabitantGeometry = createWalkerPersonGeometry();
  const InhabitantPackGeometry = createPackBeastGeometry();
  function createInhabitantFamilyMesh(Geometry, FamilyCount) {
    const FamilyMesh = new THREE.InstancedMesh(
      Geometry,
      InhabitantMaterial,
      Math.max(1, FamilyCount),
    );
    FamilyMesh.count = FamilyCount;
    FamilyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    FamilyMesh.frustumCulled = false;
    FamilyMesh.castShadow = true;
    Scene.add(FamilyMesh);
    return FamilyMesh;
  }
  const InhabitantMesh = createInhabitantFamilyMesh(InhabitantGeometry, InhabitantWalkerCount);
  const InhabitantPackMesh = createInhabitantFamilyMesh(InhabitantPackGeometry, InhabitantPackCount);
  const InhabitantTransform = new THREE.Object3D();
  let VisibleInhabitantCount = -1;
  let VisiblePrisonerCount = -1;
  let VisibleGuardCount = -1;
  GameCanvas.dataset.inhabitantCount = String(InhabitantInstances.length);

  function updateInhabitantVisuals(ElapsedTimeSeconds) {
    if (shouldSkipStridedPresentation()) {
      return;
    }
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
      const FamilyMesh = Inhabitant.silhouetteKind === 'pack' ? InhabitantPackMesh : InhabitantMesh;
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
      const IsolatedVisible = shouldShowDisplayedInhabitant(
        LifeStage,
        getProsperityStage({
          restored: Inhabitant.worldDefinition.restored,
          liveLinkCount: LiveLinkCount,
          inLiveCircuit: isWorldInLiveCircuit(Inhabitant.worldDefinition.id),
        }),
        Inhabitant.slotIndex,
      );
      const FreeEmergence = Inhabitant.worldDefinition.restored && IsolatedVisible
        ? THREE.MathUtils.smoothstep(Math.max(0, RestorationProgress), 0.54, 0.96)
        : 0;
      const Presence = IsolatedVisible ? Math.max(TyrantStrength, FreeEmergence) : 0;
      if (Presence <= 0.08) {
        hideInstance(InhabitantTransform, FamilyMesh, Inhabitant.familyIndex);
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
      const GatherSite = DockGatherSiteByWorldId.get(Inhabitant.worldDefinition.id);
      const GatherBlend = GatherSite === undefined || IsGuard || TyrantStrength > 0.35
        ? 0
        : 0.72;
      const SurfaceSite = getInhabitantSurfaceSite({
        homeSite: Inhabitant.homeSite,
        slotIndex: Inhabitant.slotIndex,
        isGuard: IsGuard,
        freedom: Freedom,
        walkingOffset: WalkingOffset,
        gatherSite: GatherSite,
        gatherBlend: GatherBlend,
      });
      const LifePlacement = getWorldLifePlacement(Inhabitant.worldDefinition, SurfaceSite, 0.02);
      if (shouldHideFarSideLife(Inhabitant.worldDefinition, LifePlacement)) {
        hideInstance(InhabitantTransform, FamilyMesh, Inhabitant.familyIndex);
        continue;
      }
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
      const FacingYaw = Inhabitant.phase + (WalkingOffset * 14);
      const InhabitantReadableScale = 1.4;
      applySphereInstance(
        InhabitantTransform,
        LifePlacement,
        Presence * Silhouette.scale.x * InhabitantReadableScale,
        Presence * HeightScale * Silhouette.scale.y * InhabitantReadableScale,
        Presence * Silhouette.scale.z * InhabitantReadableScale,
        FacingYaw,
      );
      FamilyMesh.setMatrixAt(Inhabitant.familyIndex, InhabitantTransform.matrix);
      InhabitantFreeColor.setHex(0xffffff);
      InhabitantFreeColor.lerp(Inhabitant.worldDefinition.restoration.waveColor, 0.22);
      if (Silhouette.kind === 'child') {
        InhabitantFreeColor.lerp(InhabitantChildTintColor, 0.08);
      } else if (Silhouette.kind === 'pack') {
        InhabitantFreeColor.offsetHSL(0.03, 0.06, -0.04);
      }
      const HeldColor = IsGuard ? InhabitantGuardColor : InhabitantPrisonerColor;
      FamilyMesh.setColorAt(
        Inhabitant.familyIndex,
        InhabitantFreeColor.lerp(HeldColor, TyrantStrength),
      );
    }
    for (const FamilyMesh of [InhabitantMesh, InhabitantPackMesh]) {
      if (FamilyMesh.count > 0) {
        FamilyMesh.instanceMatrix.needsUpdate = true;
        if (FamilyMesh.instanceColor) FamilyMesh.instanceColor.needsUpdate = true;
      }
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
    color: new THREE.Color(0x72e8ff).multiplyScalar(1.55),
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const RelayLinkMesh = new THREE.LineSegments(RelayLinkGeometry, RelayLinkMaterial);
  RelayLinkMesh.frustumCulled = false;
  Scene.add(RelayLinkMesh);

  const TradeShipMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    toneMapped: false,
  });
  const TradeShipCapacity = Math.max(1, MaximumRelayLinkCount * 2);
  function createTradeHullMesh(Geometry) {
    const HullMesh = new THREE.InstancedMesh(Geometry, TradeShipMaterial, TradeShipCapacity);
    HullMesh.count = 0;
    HullMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    HullMesh.frustumCulled = false;
    Scene.add(HullMesh);
    return HullMesh;
  }
  const TradeShipMesh = createTradeHullMesh(new THREE.BoxGeometry(0.42, 0.1, 0.18));
  const TradeSailMesh = createTradeHullMesh(new THREE.ConeGeometry(0.08, 0.42, 5));
  const TradeSledMesh = createTradeHullMesh(new THREE.CapsuleGeometry(0.06, 0.28, 3, 6));
  const TradeShipMeshes = {
    barge: TradeShipMesh,
    sail: TradeSailMesh,
    sled: TradeSledMesh,
  };
  const TradeShipTransform = new THREE.Object3D();
  const TradeShipColor = new THREE.Color();
  const TradeShipDockTintColor = new THREE.Color(0xfff4c8);

  const LocalCraftWorlds = WorldDefinitions.filter(
    (WorldDefinition) => listOccupationSites(WorldDefinition).length > 0,
  );
  const LocalCraftCapacity = Math.max(1, LocalCraftWorlds.length * 2);
  const LocalCraftMesh = createTradeHullMesh(new THREE.CapsuleGeometry(0.05, 0.22, 3, 6));
  LocalCraftMesh.count = LocalCraftCapacity;
  const LocalCraftTransform = new THREE.Object3D();
  const LocalCraftColor = new THREE.Color();

  const DiscoveryMarkerInstances = WorldDefinitions.flatMap((WorldDefinition) => (
    listWorldDiscoveries(WorldDefinition.id).map((Discovery) => ({
      worldDefinition: WorldDefinition,
      discovery: Discovery,
    }))
  ));
  const DiscoveryMarkerGeometry = mergePrimitiveParts([
    { geometry: new THREE.CylinderGeometry(0.045, 0.06, 0.12, 6), position: [0, 0.06, 0], color: 0xd8c4a0 },
    { geometry: new THREE.SphereGeometry(0.055, 8, 6), position: [0, 0.16, 0], color: 0xffe29a },
  ]);
  const DiscoveryMarkerMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffd27a,
    emissiveIntensity: 0.7,
    roughness: 0.45,
    metalness: 0.08,
    vertexColors: true,
  });
  const DiscoveryMarkerMesh = new THREE.InstancedMesh(
    DiscoveryMarkerGeometry,
    DiscoveryMarkerMaterial,
    Math.max(1, DiscoveryMarkerInstances.length),
  );
  DiscoveryMarkerMesh.count = DiscoveryMarkerInstances.length;
  DiscoveryMarkerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  DiscoveryMarkerMesh.frustumCulled = false;
  DiscoveryMarkerMesh.renderOrder = 12;
  Scene.add(DiscoveryMarkerMesh);
  const DiscoveryMarkerTransform = new THREE.Object3D();
  const DiscoveryMarkerColor = new THREE.Color();
  const DiscoveryCollectedColor = new THREE.Color(0x8aa0a8);
  GameCanvas.dataset.discoveryMarkerCount = String(DiscoveryMarkerInstances.length);

  function bankPendingDiscoveries() {
    const Pending = consumePendingDiscoveryBank();
    if (Pending.length === 0) {
      return;
    }
    for (const Event of Pending) {
      addDiscoveryBonus(host.ScoreState, Event.points);
    }
    GameCanvas.dataset.discoveryScore = String(host.ScoreState.discoveryScore);
    GameCanvas.dataset.score = String(
      host.ScoreState.bankedScore + host.ScoreState.discoveryScore,
    );
    const Progress = WorldDefinitions.map((WorldDefinition) => {
      const WorldDiscoveries = listWorldDiscoveries(WorldDefinition.id);
      if (WorldDiscoveries.length === 0) {
        return null;
      }
      const FoundCount = WorldDiscoveries.filter((Discovery) => (
        isDiscoveryCollected(WorldDefinition.id, Discovery.id)
      )).length;
      return `${WorldDefinition.id}:${FoundCount}/${WorldDiscoveries.length}`;
    }).filter(Boolean);
    GameCanvas.dataset.discoveries = Progress.join(',');
  }

  function updateDiscoveryMarkerVisuals(ElapsedTimeSeconds) {
    const CollectedIds = getLiveDiscoveryState().collectedIds;
    const Pulse = host.PrefersReducedMotion
      ? 1
      : 1 + (Math.sin(ElapsedTimeSeconds * 2.6) * 0.12);
    for (let MarkerIndex = 0; MarkerIndex < DiscoveryMarkerInstances.length; MarkerIndex += 1) {
      const Marker = DiscoveryMarkerInstances[MarkerIndex];
      const Collected = CollectedIds.has(
        `${Marker.worldDefinition.id}:${Marker.discovery.id}`,
      );
      applySphereInstance(
        DiscoveryMarkerTransform,
        getWorldLifePlacement(Marker.worldDefinition, Marker.discovery, Collected ? 0.04 : 0.08),
        Collected ? 1.45 : 2.35 * Pulse,
        Collected ? 1.2 : 2.55 * Pulse,
        Collected ? 1.45 : 2.35 * Pulse,
      );
      DiscoveryMarkerMesh.setMatrixAt(MarkerIndex, DiscoveryMarkerTransform.matrix);
      if (Collected) {
        DiscoveryMarkerColor.copy(DiscoveryCollectedColor);
      } else {
        DiscoveryMarkerColor.set(Marker.worldDefinition.restoration.waveColor);
      }
      DiscoveryMarkerMesh.setColorAt(MarkerIndex, DiscoveryMarkerColor);
    }
    if (DiscoveryMarkerInstances.length > 0) {
      DiscoveryMarkerMesh.instanceMatrix.needsUpdate = true;
      if (DiscoveryMarkerMesh.instanceColor) {
        DiscoveryMarkerMesh.instanceColor.needsUpdate = true;
      }
    }
    DiscoveryMarkerMaterial.emissiveIntensity = host.PrefersReducedMotion ? 0.42 : 0.62 + (Math.sin(ElapsedTimeSeconds * 3.1) * 0.18);
  }

  function updateLocalCraftVisuals(ElapsedTimeSeconds) {
    const PulseTime = host.PrefersReducedMotion ? 0 : ElapsedTimeSeconds;
    let VisibleLocalCraftCount = 0;
    for (let WorldIndex = 0; WorldIndex < LocalCraftWorlds.length; WorldIndex += 1) {
      const WorldDefinition = LocalCraftWorlds[WorldIndex];
      const Sites = listOccupationSites(WorldDefinition);
      const ToyScale = getToyDioramaScale(WorldDefinition.radius);
      const ShowCrafts = WorldDefinition.restored === true;
      for (let CraftSlot = 0; CraftSlot < 2; CraftSlot += 1) {
        const InstanceIndex = (WorldIndex * 2) + CraftSlot;
        if (!ShowCrafts || Sites.length < 1) {
          hideInstance(LocalCraftTransform, LocalCraftMesh, InstanceIndex);
          continue;
        }
        const Site = Sites[CraftSlot % Sites.length];
        const Phase = PulseTime * 1.5 + WorldIndex + (CraftSlot * 2.1);
        const Placement = getWorldLifePlacement(WorldDefinition, {
          longitude: Site.longitude + (CraftSlot === 0 ? 0.28 : -0.32),
          latitude: Site.latitude * 0.42,
        }, 0.05 + (Math.sin(Phase) * 0.012));
        if (shouldHideFarSideLife(WorldDefinition, Placement)) {
          hideInstance(LocalCraftTransform, LocalCraftMesh, InstanceIndex);
          continue;
        }
        VisibleLocalCraftCount += 1;
        applySphereInstance(
          LocalCraftTransform,
          Placement,
          0.28 * ToyScale,
          0.14 * ToyScale,
          0.16 * ToyScale,
          Site.longitude + (CraftSlot * 0.8),
        );
        LocalCraftMesh.setMatrixAt(InstanceIndex, LocalCraftTransform.matrix);
        LocalCraftColor.setHex(
          WorldDefinition.visualKey === 'ember' || WorldDefinition.visualKey === 'kiln'
            ? 0xff8a3a
            : WorldDefinition.visualKey === 'grove' || WorldDefinition.visualKey === 'canopy'
              ? 0x7dcc74
              : WorldDefinition.visualKey === 'frost'
                ? 0xe7f6ff
                : WorldDefinition.visualKey === 'tide'
                  ? 0x5fb8c9
                  : WorldDefinition.visualKey === 'vault'
                    ? 0xc9a0ff
                    : 0xffd98a,
        );
        LocalCraftMesh.setColorAt(InstanceIndex, LocalCraftColor);
      }
    }
    if (LocalCraftWorlds.length > 0) {
      LocalCraftMesh.count = LocalCraftCapacity;
      LocalCraftMesh.instanceMatrix.needsUpdate = true;
      if (LocalCraftMesh.instanceColor) {
        LocalCraftMesh.instanceColor.needsUpdate = true;
      }
    }
    GameCanvas.dataset.localCraftCount = String(VisibleLocalCraftCount);
  }

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
    const HullFamilies = [];
    const FamilyCounts = { barge: 0, sail: 0, sled: 0 };
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
      const HullFamily = getTradeHullFamily(HullKind);
      const HullScale = getTradeHullScale(HullKind);
      const FamilyMesh = TradeShipMeshes[HullFamily];
      HullKinds.push(HullKind);
      HullFamilies.push(HullFamily);
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
        const FamilyIndex = FamilyCounts[HullFamily];
        FamilyMesh.setMatrixAt(FamilyIndex, TradeShipTransform.matrix);
        TradeShipColor.setHex(getTradeHullColor(HullKind, InLiveCircuit));
        if (CourierTravel.isDocked) {
          TradeShipColor.lerp(TradeShipDockTintColor, 0.4);
        }
        FamilyMesh.setColorAt(FamilyIndex, TradeShipColor);
        FamilyCounts[HullFamily] += 1;
        ShipIndex += 1;
      }
    }
    for (const [FamilyName, FamilyMesh] of Object.entries(TradeShipMeshes)) {
      const VisibleCount = FamilyCounts[FamilyName];
      for (let HiddenShipIndex = VisibleCount; HiddenShipIndex < FamilyMesh.count; HiddenShipIndex += 1) {
        hideInstance(TradeShipTransform, FamilyMesh, HiddenShipIndex);
      }
      FamilyMesh.count = VisibleCount;
      if (VisibleCount > 0) {
        FamilyMesh.instanceMatrix.needsUpdate = true;
        if (FamilyMesh.instanceColor) FamilyMesh.instanceColor.needsUpdate = true;
      }
    }
    GameCanvas.dataset.tradeShipCount = String(ShipIndex);
    GameCanvas.dataset.tradeHullKinds = HullKinds.join(',');
    GameCanvas.dataset.tradeHullFamilies = HullFamilies.join(',');
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
    DockGatherSiteByWorldId.clear();
    resetLiveDiscoveryState();
    GameCanvas.dataset.discoveryScore = '0';
    GameCanvas.dataset.discoveries = '';
  }

  function updateLivingWorldVisuals(ElapsedTimeSeconds) {
    updateOccupationScarVisuals(ElapsedTimeSeconds);
    refreshDockedTradeState(ElapsedTimeSeconds);
    updateProsperityBuildingVisuals(ElapsedTimeSeconds);
    updateExtractionFreighterVisuals(ElapsedTimeSeconds);
    updateInhabitantVisuals(ElapsedTimeSeconds);
    updateRelayNetworkVisuals(ElapsedTimeSeconds);
    updateSlingshotBandVisuals(ElapsedTimeSeconds);
    updateRelayPortVisuals(ElapsedTimeSeconds);
  }

  return {
    updateSlingshotBandVisuals,
    updateRelayPortVisuals,
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
