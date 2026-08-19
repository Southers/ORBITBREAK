/**
 * Warden vessel, forecast, event pulse and hostile crust cages.
 * Pursuit resolution stays in the playable shell / flight resolver.
 */

import {
  getHostileCagePresentationScale,
  getHostileCageRadialOffset,
  getPlantedCageWorldPlacement,
  LandedFarSideLifeDirectionZ,
} from './presentation.js?v=20260819-ob141';

export function createWardenVisuals(THREE, Scene, host) {
  const {
    WorldheartDefinition,
    GameCanvas,
    getWorldDefinition,
  } = host;
  const TemporaryThreeVector = new THREE.Vector3();

  /** Spread cage cells on a hostile rim. Tap a cage to tear it. */
  const HostilePylonGroup = new THREE.Group();
  const HostilePylonTemplateMaterial = new THREE.MeshStandardMaterial({
    color: 0xff2a22,
    emissive: 0xff1a12,
    emissiveIntensity: 0.72,
    roughness: 0.38,
    metalness: 0.55,
  });
  const ClampPostGeometry = new THREE.BoxGeometry(0.07, 0.42, 0.07);
  const ClampBarXGeometry = new THREE.BoxGeometry(0.32, 0.045, 0.05);
  const ClampBarZGeometry = new THREE.BoxGeometry(0.05, 0.045, 0.24);
  const ClampBaseGeometry = new THREE.BoxGeometry(0.34, 0.06, 0.26);
  const ClampLockGeometry = new THREE.OctahedronGeometry(0.055, 0);
  const ClampHoopGeometry = new THREE.TorusGeometry(0.16, 0.028, 8, 20);
  const ClampPostOffsets = [
    [-0.12, 0, -0.09],
    [0.12, 0, -0.09],
    [-0.12, 0, 0.09],
    [0.12, 0, 0.09],
  ];

  function createHostileClampCage(Material) {
    const Cage = new THREE.Group();
    for (const [OffsetX, OffsetY, OffsetZ] of ClampPostOffsets) {
      const Post = new THREE.Mesh(ClampPostGeometry, Material);
      Post.position.set(OffsetX, OffsetY, OffsetZ);
      Cage.add(Post);
    }
    for (const RingY of [0.16, 0.02, -0.12]) {
      const Front = new THREE.Mesh(ClampBarXGeometry, Material);
      Front.position.set(0, RingY, 0.09);
      const Back = new THREE.Mesh(ClampBarXGeometry, Material);
      Back.position.set(0, RingY, -0.09);
      const Left = new THREE.Mesh(ClampBarZGeometry, Material);
      Left.position.set(-0.12, RingY, 0);
      const Right = new THREE.Mesh(ClampBarZGeometry, Material);
      Right.position.set(0.12, RingY, 0);
      Cage.add(Front, Back, Left, Right);
    }
    const Base = new THREE.Mesh(ClampBaseGeometry, Material);
    Base.position.y = -0.2;
    const Lock = new THREE.Mesh(ClampLockGeometry, Material);
    Lock.position.y = 0.24;
    const Hoop = new THREE.Mesh(ClampHoopGeometry, Material);
    Hoop.position.y = 0.06;
    Cage.add(Base, Lock, Hoop);
    return Cage;
  }

  const SurfaceUp = new THREE.Vector3(0, 1, 0);
  const SurfaceNormal = new THREE.Vector3();
  const ClampHitGeometry = new THREE.SphereGeometry(0.55, 12, 8);
  const ClampHitMaterial = new THREE.MeshBasicMaterial({
    visible: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });

  const MaximumHostileClampCount = 5;
  for (let ClampIndex = 0; ClampIndex < MaximumHostileClampCount; ClampIndex += 1) {
    const ClampMesh = createHostileClampCage(HostilePylonTemplateMaterial.clone());
    ClampMesh.visible = false;
    ClampMesh.userData.clampId = ClampIndex;
    ClampMesh.userData.clampMaterial = ClampMesh.children[0]?.material;
    const HitTarget = new THREE.Mesh(ClampHitGeometry, ClampHitMaterial);
    HitTarget.userData.clampId = ClampIndex;
    HitTarget.userData.isCageHitTarget = true;
    ClampMesh.add(HitTarget);
    HostilePylonGroup.add(ClampMesh);
  }
  HostilePylonGroup.visible = false;
  HostilePylonGroup.renderOrder = 24;
  HostilePylonGroup.frustumCulled = false;
  Scene.add(HostilePylonGroup);

  const CutSlashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe7b0,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    toneMapped: false,
  });
  const CutSlashMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.18, 0.08),
    CutSlashMaterial,
  );
  CutSlashMesh.visible = false;
  CutSlashMesh.renderOrder = 22;
  CutSlashMesh.frustumCulled = false;
  Scene.add(CutSlashMesh);

  const HostileBreakGroup = new THREE.Group();
  HostileBreakGroup.frustumCulled = false;
  Scene.add(HostileBreakGroup);
  const ClampBreakShardCount = 18;
  const ClampBreakShardMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a1c24,
    emissive: 0xffd678,
    emissiveIntensity: 1.6,
    roughness: 0.4,
    metalness: 0.7,
    transparent: true,
    opacity: 1,
  });
  const ClampBreakShardMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.07, 0.045, 0.035),
    ClampBreakShardMaterial,
    ClampBreakShardCount,
  );
  ClampBreakShardMesh.count = 0;
  ClampBreakShardMesh.frustumCulled = false;
  ClampBreakShardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  HostileBreakGroup.add(ClampBreakShardMesh);
  const ClampBreakBurstMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe08a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const ClampBreakBurstMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    ClampBreakBurstMaterial,
  );
  ClampBreakBurstMesh.visible = false;
  HostileBreakGroup.add(ClampBreakBurstMesh);
  const ClampBreakShardTransform = new THREE.Object3D();
  const ClampBreakWorldPosition = new THREE.Vector3();
  const ActiveClampBreaks = [];

  function placeCutSlash(Origin, End, WillHit) {
    const DeltaX = End.x - Origin.x;
    const DeltaY = End.y - Origin.y;
    const Length = Math.hypot(DeltaX, DeltaY);
    if (!(Length > 0.04)) {
      CutSlashMesh.visible = false;
      return;
    }
    CutSlashMesh.position.set(
      (Origin.x + End.x) * 0.5,
      (Origin.y + End.y) * 0.5,
      0.3,
    );
    CutSlashMesh.rotation.set(0, 0, Math.atan2(DeltaY, DeltaX));
    CutSlashMesh.scale.set(Length, WillHit ? 1.15 : 0.85, 1);
    CutSlashMaterial.color.setHex(WillHit ? 0xffd678 : 0xffe7d2);
    CutSlashMaterial.opacity = WillHit ? 0.96 : 0.55;
    CutSlashMesh.visible = true;
  }

  function hideCutSlash() {
    CutSlashMesh.visible = false;
  }

  function startClampBreaks(WorldDefinition, ClampIds, EncounterState) {
    if (!WorldDefinition || !Array.isArray(ClampIds) || ClampIds.length < 1) {
      return;
    }
    const ClampIdSet = new Set(ClampIds);
    for (const Clamp of EncounterState?.clamps ?? []) {
      if (!ClampIdSet.has(Clamp.id)) continue;
      const ClampMesh = HostilePylonGroup.children[Clamp.id];
      if (ClampMesh) {
        ClampMesh.getWorldPosition(ClampBreakWorldPosition);
        ClampMesh.visible = false;
      } else {
        ClampBreakWorldPosition.set(
          WorldDefinition.position.x
            + (Math.cos(Clamp.longitude ?? Clamp.surfaceAngle) * (WorldDefinition.radius + 0.55)),
          WorldDefinition.position.y
            + (Math.sin(Clamp.longitude ?? Clamp.surfaceAngle) * (WorldDefinition.radius + 0.55)),
          WorldDefinition.position.z
            + (Math.sin(Clamp.latitude ?? 0) * (WorldDefinition.radius + 0.55)),
        );
      }
      const ReducedMotion = host.PrefersReducedMotion === true;
      ActiveClampBreaks.push({
        x: ClampBreakWorldPosition.x,
        y: ClampBreakWorldPosition.y,
        z: ClampBreakWorldPosition.z,
        age: 0,
        duration: ReducedMotion ? 0.28 : 0.52,
        reducedMotion: ReducedMotion,
        shards: Array.from({ length: 6 }, (_, ShardIndex) => {
          const Angle = Clamp.surfaceAngle + ((ShardIndex - 2.5) * 0.42);
          return {
            vx: Math.cos(Angle) * (ReducedMotion ? 0.4 : 1.35 + (ShardIndex % 3) * 0.28),
            vy: Math.sin(Angle) * (ReducedMotion ? 0.4 : 1.35 + (ShardIndex % 3) * 0.28),
            vz: ReducedMotion ? 0.12 : 0.55 - (ShardIndex * 0.12),
            spin: (ShardIndex % 2 === 0 ? 1 : -1) * (2.4 + ShardIndex * 0.35),
          };
        }),
      });
    }
  }

  function updateClampBreaks(DeltaTimeSeconds) {
    if (ActiveClampBreaks.length < 1) {
      ClampBreakShardMesh.count = 0;
      ClampBreakBurstMesh.visible = false;
      return;
    }
    let ShardSlot = 0;
    let BurstVisible = false;
    for (let BreakIndex = ActiveClampBreaks.length - 1; BreakIndex >= 0; BreakIndex -= 1) {
      const Break = ActiveClampBreaks[BreakIndex];
      Break.age += DeltaTimeSeconds;
      const Progress = Math.max(0, Math.min(1, Break.age / Break.duration));
      if (!BurstVisible) {
        ClampBreakBurstMesh.position.set(Break.x, Break.y, Break.z);
        ClampBreakBurstMesh.scale.setScalar(1 + (Progress * (Break.reducedMotion ? 1.6 : 3.4)));
        ClampBreakBurstMaterial.opacity = (1 - Progress) * 0.9;
        ClampBreakBurstMesh.visible = true;
        BurstVisible = true;
      }
      for (const Shard of Break.shards) {
        if (ShardSlot >= ClampBreakShardCount) break;
        const Travel = Break.reducedMotion ? Progress * 0.12 : Progress;
        ClampBreakShardTransform.position.set(
          Break.x + (Shard.vx * Travel),
          Break.y + (Shard.vy * Travel),
          Break.z + (Shard.vz * Travel),
        );
        ClampBreakShardTransform.rotation.set(
          Shard.spin * Progress,
          Shard.spin * Progress * 0.7,
          Shard.spin * Progress * 1.2,
        );
        const Scale = 1 - (Progress * 0.55);
        ClampBreakShardTransform.scale.setScalar(Math.max(0.15, Scale));
        ClampBreakShardTransform.updateMatrix();
        ClampBreakShardMesh.setMatrixAt(ShardSlot, ClampBreakShardTransform.matrix);
        ShardSlot += 1;
      }
      if (Progress >= 1) {
        ActiveClampBreaks.splice(BreakIndex, 1);
      }
    }
    ClampBreakShardMesh.count = ShardSlot;
    ClampBreakShardMesh.instanceMatrix.needsUpdate = true;
    ClampBreakShardMaterial.opacity = ActiveClampBreaks.length > 0
      ? 1 - (ActiveClampBreaks[0].age / ActiveClampBreaks[0].duration) * 0.35
      : 0;
    if (!BurstVisible) {
      ClampBreakBurstMesh.visible = false;
    }
  }

  HostilePylonGroup.userData.placeCutSlash = placeCutSlash;
  HostilePylonGroup.userData.hideCutSlash = hideCutSlash;
  HostilePylonGroup.userData.breakClamps = startClampBreaks;

  function positionHostilePylons(WorldDefinition, EncounterState, HighlightedIds = []) {
    const HighlightedIdSet = HighlightedIds instanceof Set
      ? HighlightedIds
      : new Set(HighlightedIds);
    if (!WorldDefinition || !EncounterState) {
      HostilePylonGroup.visible = false;
      if (HostilePylonGroup.parent !== Scene) {
        Scene.add(HostilePylonGroup);
      }
      HostilePylonGroup.position.set(0, 0, 0);
      HostilePylonGroup.quaternion.identity();
      return;
    }
    if (HostilePylonGroup.parent !== Scene) {
      Scene.add(HostilePylonGroup);
    }
    HostilePylonGroup.position.set(0, 0, 0);
    HostilePylonGroup.rotation.set(0, 0, 0);
    HostilePylonGroup.quaternion.identity();
    let AnyVisible = false;
    for (const ClampMesh of HostilePylonGroup.children) {
      ClampMesh.visible = false;
    }
    const WorldGroup = host.WorldRuntimeByIdentifier?.get(WorldDefinition.id)?.group;
    const CrustQuaternion = WorldGroup?.quaternion;
    const CageScale = getHostileCagePresentationScale(WorldDefinition.radius);
    const RadialOffset = getHostileCageRadialOffset(WorldDefinition.radius);
    const CrustSpinning = Boolean(
      CrustQuaternion
      && (
        Math.abs(CrustQuaternion.x) > 1e-5
        || Math.abs(CrustQuaternion.y) > 1e-5
        || Math.abs(CrustQuaternion.z) > 1e-5
      ),
    );
    for (const Clamp of EncounterState.clamps) {
      const ClampMesh = HostilePylonGroup.children[Clamp.id];
      if (!ClampMesh) continue;
      if (!Clamp.remaining) {
        ClampMesh.visible = false;
        continue;
      }
      const Placement = getPlantedCageWorldPlacement({
        worldX: WorldDefinition.position.x,
        worldY: WorldDefinition.position.y,
        worldZ: WorldDefinition.position.z ?? 0,
        worldRadius: WorldDefinition.radius,
        longitude: Number.isFinite(Clamp.longitude) ? Clamp.longitude : Clamp.surfaceAngle,
        latitude: Number.isFinite(Clamp.latitude) ? Clamp.latitude : 0,
        crustQX: CrustQuaternion?.x ?? 0,
        crustQY: CrustQuaternion?.y ?? 0,
        crustQZ: CrustQuaternion?.z ?? 0,
        crustQW: CrustQuaternion?.w ?? 1,
        radialOffset: RadialOffset,
      });
      if (CrustSpinning && Placement.directionZ < LandedFarSideLifeDirectionZ) {
        ClampMesh.visible = false;
        continue;
      }
      ClampMesh.position.set(Placement.x, Placement.y, Placement.z);
      SurfaceNormal.set(Placement.directionX, Placement.directionY, Placement.directionZ);
      if (SurfaceNormal.lengthSq() < 1e-8) {
        SurfaceNormal.set(0, 0, 1);
      } else {
        SurfaceNormal.normalize();
      }
      ClampMesh.quaternion.setFromUnitVectors(SurfaceUp, SurfaceNormal);
      ClampMesh.visible = true;
      ClampMesh.renderOrder = 24;
      AnyVisible = true;
      const IsHighlighted = HighlightedIdSet.has(Clamp.id);
      const ClampMaterial = ClampMesh.userData.clampMaterial;
      if (ClampMaterial) {
        ClampMaterial.color.setHex(IsHighlighted ? 0xffe7a8 : 0xff2a22);
        ClampMaterial.emissive.setHex(IsHighlighted ? 0xffd678 : 0xff1a12);
        ClampMaterial.emissiveIntensity = IsHighlighted ? 2.6 : 0.85;
      }
      ClampMesh.scale.setScalar(IsHighlighted ? CageScale * 1.12 : CageScale);
    }
    HostilePylonGroup.visible = AnyVisible;
  }

  /** The pursuing command vessel is a corrupted miniature world, not a timer overlay. */
  const WardenVisualGroup = new THREE.Group();
  const WardenCoreMaterial = new THREE.MeshStandardMaterial({
    color: 0x35191f,
    emissive: 0xff3b33,
    emissiveIntensity: 0.75,
    roughness: 0.7,
    metalness: 0.42,
  });
  const WardenCoreMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.05, 2),
    WardenCoreMaterial,
  );
  WardenVisualGroup.add(WardenCoreMesh);
  const WardenCrustMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1014,
    emissive: 0x5a1418,
    emissiveIntensity: 0.55,
    roughness: 0.48,
    metalness: 0.78,
  });
  const WardenCrustMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1.08, 0.055, 7, 36),
    WardenCrustMaterial,
  );
  WardenCrustMesh.rotation.x = Math.PI * 0.5;
  WardenVisualGroup.add(WardenCrustMesh);
  const WardenArmorMaterial = new THREE.MeshStandardMaterial({
    color: 0x160f18,
    emissive: 0x6e1018,
    emissiveIntensity: 0.38,
    roughness: 0.38,
    metalness: 0.86,
  });
  const WardenArmorPanelCount = 8;
  const WardenArmorMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.58, 0.16, 0.42),
    WardenArmorMaterial,
    WardenArmorPanelCount,
  );
  const WardenArmorTransform = new THREE.Object3D();
  WardenArmorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  WardenVisualGroup.add(WardenArmorMesh);

  const WardenCitadelGroup = new THREE.Group();
  const WardenCitadelMaterial = new THREE.MeshStandardMaterial({
    color: 0x25131b,
    emissive: 0xb51f25,
    emissiveIntensity: 0.54,
    roughness: 0.42,
    metalness: 0.8,
  });
  const WardenCitadelMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.38, 0.78, 6),
    WardenCitadelMaterial,
  );
  WardenCitadelMesh.position.y = 1.06;
  WardenCitadelGroup.add(WardenCitadelMesh);
  const WardenBeaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff5148 });
  const WardenBeaconMesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    WardenBeaconMaterial,
  );
  WardenBeaconMesh.position.y = 1.53;
  WardenCitadelGroup.add(WardenBeaconMesh);
  WardenVisualGroup.add(WardenCitadelGroup);

  const WardenShieldMoonMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a161d,
    emissive: 0xff4138,
    emissiveIntensity: 1.15,
    roughness: 0.5,
    metalness: 0.7,
  });
  const WardenShieldMoonMesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.24, 1),
    WardenShieldMoonMaterial,
    2,
  );
  const WardenShieldMoonTransform = new THREE.Object3D();
  WardenShieldMoonMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  WardenVisualGroup.add(WardenShieldMoonMesh);

  const WardenExposureLatticeGroup = new THREE.Group();
  const WardenExposureLatticeMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd678,
    transparent: true,
    opacity: 0.68,
    depthWrite: false,
  });
  for (const LatticeRotation of [0, Math.PI / 3, -Math.PI / 3]) {
    const LatticeArc = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.025, 6, 36),
      WardenExposureLatticeMaterial,
    );
    LatticeArc.rotation.y = LatticeRotation;
    WardenExposureLatticeGroup.add(LatticeArc);
  }
  WardenExposureLatticeGroup.visible = false;
  WardenVisualGroup.add(WardenExposureLatticeGroup);

  const WardenShieldRings = [];
  const WardenShieldRingMaterials = [];
  for (const RingRotation of [0, Math.PI * 0.5]) {
    const RingMaterial = new THREE.MeshBasicMaterial({
      color: 0xff675f,
      transparent: true,
      opacity: 0.82,
    });
    const Ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.38, 0.06, 8, 40),
      RingMaterial,
    );
    Ring.rotation.x = RingRotation;
    WardenVisualGroup.add(Ring);
    WardenShieldRings.push(Ring);
    WardenShieldRingMaterials.push(RingMaterial);
  }
  WardenVisualGroup.visible = false;
  Scene.add(WardenVisualGroup);

  const WardenEventPulseMaterial = new THREE.MeshBasicMaterial({
    color: 0xff5148,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const WardenEventPulseMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 0.9, 64),
    WardenEventPulseMaterial,
  );
  WardenEventPulseMesh.visible = false;
  Scene.add(WardenEventPulseMesh);
  let WardenEventPulseStartedAtSeconds = null;
  let CommandDefeatStartedAtSeconds = null;

  function startWardenEventPulse(Position, Color, Beat) {
    const {
      PrefersReducedMotion,
      WardenPursuitState,
      GameElapsedTimeSeconds,
    } = host;
    WardenEventPulseMesh.position.set(Position.x, Position.y, 0.42);
    WardenEventPulseMesh.scale.setScalar(1);
    WardenEventPulseMaterial.color.setHex(Color);
    WardenEventPulseMaterial.opacity = 0.88;
    WardenEventPulseMesh.visible = true;
    WardenEventPulseStartedAtSeconds = GameElapsedTimeSeconds;
    GameCanvas.dataset.wardenVisualBeat = Beat;
  }

  function clearWardenTargetTelegraph() {
    if (TelegraphTargetWorldIdentifier) {
      const PreviousRuntime = host.WorldRuntimeByIdentifier?.get(TelegraphTargetWorldIdentifier);
      if (PreviousRuntime?.stillnessCageMaterial) {
        PreviousRuntime.stillnessCageMaterial.color.setHex(0x82a8b4);
        PreviousRuntime.stillnessCageMaterial.opacity = TelegraphCageBaseOpacity;
      }
      if (PreviousRuntime?.atmosphereMaterial) {
        PreviousRuntime.atmosphereMaterial.opacity = TelegraphAtmosphereBaseOpacity;
      }
    }
    TelegraphTargetWorldIdentifier = '';
    WardenTargetRimMesh.visible = false;
    WardenTargetRimMaterial.opacity = 0;
  }

  function updateWardenTargetTelegraph(ElapsedTimeSeconds) {
    const { WardenPursuitState, PrefersReducedMotion } = host;
    const TargetWorld = getWorldDefinition(WardenPursuitState.targetWorldIdentifier);
    const ShouldTelegraph = WardenPursuitState.status === 'pursuing' && Boolean(TargetWorld);
    if (!ShouldTelegraph) {
      clearWardenTargetTelegraph();
      return;
    }
    if (TelegraphTargetWorldIdentifier !== TargetWorld.id) {
      clearWardenTargetTelegraph();
      const WorldRuntime = host.WorldRuntimeByIdentifier?.get(TargetWorld.id);
      TelegraphTargetWorldIdentifier = TargetWorld.id;
      TelegraphCageBaseOpacity = WorldRuntime?.stillnessCageMaterial?.opacity ?? 0.22;
      TelegraphAtmosphereBaseOpacity = WorldRuntime?.atmosphereMaterial?.opacity ?? 0.11;
    }
    const Pulse = PrefersReducedMotion
      ? 1
      : 0.62 + ((Math.sin(ElapsedTimeSeconds * 5.4) * 0.5 + 0.5) * 0.38);
    const WorldRuntime = host.WorldRuntimeByIdentifier?.get(TargetWorld.id);
    if (WorldRuntime?.stillnessCageMaterial) {
      WorldRuntime.stillnessCageMaterial.color.setHex(0xff5148);
      WorldRuntime.stillnessCageMaterial.opacity = Math.min(
        0.82,
        TelegraphCageBaseOpacity + (0.28 * Pulse),
      );
    }
    if (WorldRuntime?.atmosphereMaterial) {
      WorldRuntime.atmosphereMaterial.opacity = Math.min(
        0.42,
        TelegraphAtmosphereBaseOpacity + (0.16 * Pulse),
      );
    }
    WardenTargetRimMesh.position.set(TargetWorld.position.x, TargetWorld.position.y, 0.22);
    WardenTargetRimMesh.scale.setScalar(TargetWorld.radius * 1.22);
    WardenTargetRimMaterial.opacity = 0.22 + (Pulse * 0.5);
    WardenTargetRimMesh.visible = true;
  }

  const WardenForecastPositions = new Float32Array(6);
  const WardenForecastGeometry = new THREE.BufferGeometry();
  const WardenForecastAttribute = new THREE.BufferAttribute(WardenForecastPositions, 3);
  WardenForecastAttribute.setUsage(THREE.DynamicDrawUsage);
  WardenForecastGeometry.setAttribute('position', WardenForecastAttribute);
  const WardenForecastMaterial = new THREE.LineDashedMaterial({
    color: 0xff675f,
    transparent: true,
    opacity: 0.58,
    dashSize: 0.45,
    gapSize: 0.3,
    depthWrite: false,
  });
  const WardenForecastLine = new THREE.Line(WardenForecastGeometry, WardenForecastMaterial);
  WardenForecastLine.visible = false;
  WardenForecastLine.frustumCulled = false;
  Scene.add(WardenForecastLine);

  const WardenTargetRimMaterial = new THREE.MeshBasicMaterial({
    color: 0xff5148,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const WardenTargetRimMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.045, 8, 64),
    WardenTargetRimMaterial,
  );
  WardenTargetRimMesh.rotation.x = Math.PI * 0.5;
  WardenTargetRimMesh.visible = false;
  Scene.add(WardenTargetRimMesh);
  let TelegraphTargetWorldIdentifier = '';
  let TelegraphCageBaseOpacity = 0.22;
  let TelegraphAtmosphereBaseOpacity = 0.11;
  const WardenEntryPosition = new THREE.Vector3(
    WorldheartDefinition.position.x + 8,
    WorldheartDefinition.position.y + 6,
    0.35,
  );
  const WardenApproachStartPosition = WardenEntryPosition.clone();
  WardenVisualGroup.position.copy(WardenEntryPosition);

  function updateWardenEventPulse(ElapsedTimeSeconds) {
    const {
      PrefersReducedMotion,
      WardenPursuitState,
      GameElapsedTimeSeconds,
    } = host;
    if (WardenEventPulseStartedAtSeconds === null) return;
    const PulseDurationSeconds = PrefersReducedMotion ? 0.7 : 1.15;
    const PulseProgress = THREE.MathUtils.clamp(
      (ElapsedTimeSeconds - WardenEventPulseStartedAtSeconds) / PulseDurationSeconds,
      0,
      1,
    );
    const MaximumPulseScale = PrefersReducedMotion ? 1.7 : 3.6;
    WardenEventPulseMesh.scale.setScalar(
      THREE.MathUtils.lerp(1, MaximumPulseScale, PulseProgress),
    );
    WardenEventPulseMaterial.opacity = (1 - PulseProgress) * 0.88;
    if (PulseProgress >= 1) {
      WardenEventPulseMesh.visible = false;
      WardenEventPulseStartedAtSeconds = null;
      GameCanvas.dataset.wardenVisualBeat = '';
    }
  }

  function updateWardenVisuals(DeltaTimeSeconds, ElapsedTimeSeconds) {
    const {
      PrefersReducedMotion,
      WardenPursuitState,
      GameElapsedTimeSeconds,
    } = host;
    updateClampBreaks(DeltaTimeSeconds);
    updateWardenEventPulse(ElapsedTimeSeconds);
    updateWardenTargetTelegraph(ElapsedTimeSeconds);
    if (WardenPursuitState.status === 'hidden') return;
    const TargetWorld = getWorldDefinition(WardenPursuitState.targetWorldIdentifier);
    const IsCommandExposed = WardenPursuitState.status === 'exposed';
    if (!TargetWorld && !IsCommandExposed) return;
    const ApproachProgress = 1 - (
      WardenPursuitState.distance / WardenPursuitState.maximumDistance
    );
    if (IsCommandExposed) {
      TemporaryThreeVector.set(
        WorldheartDefinition.position.x,
        WorldheartDefinition.position.y,
        0.35,
      );
    } else {
      TemporaryThreeVector.set(
        THREE.MathUtils.lerp(
          WardenApproachStartPosition.x,
          TargetWorld.position.x,
          ApproachProgress,
        ),
        THREE.MathUtils.lerp(
          WardenApproachStartPosition.y,
          TargetWorld.position.y,
          ApproachProgress,
        ),
        0.35,
      );
    }
    if (IsCommandExposed) {
      WardenVisualGroup.position.copy(TemporaryThreeVector);
    } else {
      WardenVisualGroup.position.lerp(
        TemporaryThreeVector,
        1 - Math.exp(-DeltaTimeSeconds * 2.8),
      );
    }
    WardenVisualGroup.rotation.y += DeltaTimeSeconds * 0.32;
    WardenVisualGroup.rotation.z = Math.sin(ElapsedTimeSeconds * 0.7) * 0.08;
    const IsCommandDefeated = CommandDefeatStartedAtSeconds !== null;
    const DefeatProgress = IsCommandDefeated
      ? THREE.MathUtils.clamp((ElapsedTimeSeconds - CommandDefeatStartedAtSeconds) / 1.1, 0, 1)
      : 0;
    const ArmorRadius = IsCommandDefeated
      ? THREE.MathUtils.lerp(1.38, 1.82, DefeatProgress)
      : (IsCommandExposed ? 1.38 : 1.08);
    for (let PanelIndex = 0; PanelIndex < WardenArmorPanelCount; PanelIndex += 1) {
      const PanelAngle = (PanelIndex / WardenArmorPanelCount) * Math.PI * 2;
      WardenArmorTransform.position.set(
        Math.cos(PanelAngle) * ArmorRadius,
        Math.sin(PanelAngle) * ArmorRadius,
        (PanelIndex % 2 === 0 ? 0.22 : -0.22),
      );
      WardenArmorTransform.rotation.set(
        0,
        DefeatProgress * (PanelIndex % 2 === 0 ? 0.8 : -0.8),
        PanelAngle + (Math.PI * 0.5) + (DefeatProgress * 0.55),
      );
      WardenArmorTransform.scale.setScalar(
        IsCommandExposed ? THREE.MathUtils.lerp(0.88, 0.62, DefeatProgress) : 1,
      );
      WardenArmorTransform.updateMatrix();
      WardenArmorMesh.setMatrixAt(PanelIndex, WardenArmorTransform.matrix);
    }
    WardenArmorMesh.instanceMatrix.needsUpdate = true;

    for (let MoonIndex = 0; MoonIndex < WardenShieldMoonMesh.count; MoonIndex += 1) {
      const MoonDirection = MoonIndex === 0 ? 1 : -1;
      const MoonAngle = (ElapsedTimeSeconds * (0.82 + (MoonIndex * 0.18)) * MoonDirection)
        + (MoonIndex * Math.PI);
      WardenShieldMoonTransform.position.set(
        Math.cos(MoonAngle) * 1.82,
        Math.sin(MoonAngle) * 1.42,
        Math.sin(MoonAngle * 1.7) * 0.52,
      );
      WardenShieldMoonTransform.rotation.set(MoonAngle, MoonAngle * 0.7, 0);
      WardenShieldMoonTransform.scale.setScalar(0.92 + (Math.sin(MoonAngle * 2) * 0.08));
      WardenShieldMoonTransform.updateMatrix();
      WardenShieldMoonMesh.setMatrixAt(MoonIndex, WardenShieldMoonTransform.matrix);
    }
    if (WardenShieldMoonMesh.count > 0) {
      WardenShieldMoonMesh.instanceMatrix.needsUpdate = true;
    }
    for (let RingIndex = 0; RingIndex < WardenShieldRings.length; RingIndex += 1) {
      WardenShieldRings[RingIndex].rotation.z += DeltaTimeSeconds * (RingIndex === 0 ? 0.34 : -0.27);
      WardenShieldRingMaterials[RingIndex].opacity = 0.7
        + (Math.sin((ElapsedTimeSeconds * 3.2) + RingIndex) * 0.16);
    }
    WardenExposureLatticeGroup.rotation.y += DeltaTimeSeconds * 0.46;
    WardenExposureLatticeGroup.rotation.z -= DeltaTimeSeconds * 0.22;
    WardenBeaconMesh.scale.setScalar(0.86 + (Math.sin(ElapsedTimeSeconds * 5.2) * 0.16));
    WardenCoreMaterial.emissiveIntensity = IsCommandDefeated
      ? THREE.MathUtils.lerp(2.4, 0.28, DefeatProgress)
      : 0.72 + (Math.sin(ElapsedTimeSeconds * 4) * 0.16);
    if (IsCommandDefeated) {
      WardenCoreMaterial.color.setHex(0x17363a);
      WardenCoreMaterial.emissive.setHex(0x72d9ff);
      WardenArmorMaterial.emissive.setHex(0x17363a);
      WardenCitadelMaterial.emissive.setHex(0x72d9ff);
      WardenBeaconMaterial.color.setHex(0xc6f4ff);
      WardenExposureLatticeMaterial.opacity = (1 - DefeatProgress) * 0.68;
      WardenVisualGroup.scale.setScalar(THREE.MathUtils.lerp(1, 0.9, DefeatProgress));
    }
    if (TargetWorld) {
      WardenForecastPositions.set([
        WardenVisualGroup.position.x, WardenVisualGroup.position.y, 0.18,
        TargetWorld.position.x, TargetWorld.position.y, 0.18,
      ]);
      WardenForecastAttribute.needsUpdate = true;
      WardenForecastLine.computeLineDistances();
    }
  }

  function beginCommandDefeat(ElapsedTimeSeconds) {
    CommandDefeatStartedAtSeconds = ElapsedTimeSeconds;
  }

  function resetWardenVisuals() {
    WardenEventPulseStartedAtSeconds = null;
    CommandDefeatStartedAtSeconds = null;
    WardenEventPulseMesh.visible = false;
    WardenEventPulseMaterial.opacity = 0;
    GameCanvas.dataset.wardenVisualBeat = '';
    WardenVisualGroup.position.copy(WardenEntryPosition);
    WardenVisualGroup.rotation.set(0, 0, 0);
    WardenShieldRings.forEach((Ring, RingIndex) => {
      Ring.rotation.x = RingIndex === 0 ? 0 : Math.PI * 0.5;
      Ring.rotation.y = 0;
      Ring.rotation.z = 0;
    });
    WardenApproachStartPosition.copy(WardenEntryPosition);
    HostilePylonGroup.visible = false;
    hideCutSlash();
    ActiveClampBreaks.length = 0;
    ClampBreakShardMesh.count = 0;
    ClampBreakBurstMesh.visible = false;
    clearWardenTargetTelegraph();
  }

  return {
    HostilePylonGroup,
    positionHostilePylons,
    WardenVisualGroup,
    WardenCoreMaterial,
    WardenArmorMaterial,
    WardenCitadelMaterial,
    WardenBeaconMaterial,
    WardenShieldRings,
    WardenShieldMoonMesh,
    WardenExposureLatticeGroup,
    WardenExposureLatticeMaterial,
    WardenForecastLine,
    WardenTargetRimMesh,
    WardenEntryPosition,
    WardenApproachStartPosition,
    WardenEventPulseMesh,
    WardenEventPulseMaterial,
    startWardenEventPulse,
    updateWardenVisuals,
    beginCommandDefeat,
    resetWardenVisuals,
  };
}
