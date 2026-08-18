/**
 * Runner, Orbitbreaker, trails, pull/cut guides and launch/impact pulses.
 * Physics identity stays in the playable shell.
 */

function createPlanarRibbon(THREE, Scene, {
  maxPoints,
  color,
  opacity,
  renderOrder,
}) {
  const VertexCount = maxPoints * 2;
  const Positions = new Float32Array(VertexCount * 3);
  const Geometry = new THREE.BufferGeometry();
  const PositionAttribute = new THREE.BufferAttribute(Positions, 3);
  PositionAttribute.setUsage(THREE.DynamicDrawUsage);
  Geometry.setAttribute('position', PositionAttribute);
  const IndexValues = new Uint32Array(Math.max(0, (maxPoints - 1) * 6));
  let IndexOffset = 0;
  for (let PointIndex = 0; PointIndex < maxPoints - 1; PointIndex += 1) {
    const VertexIndex = PointIndex * 2;
    IndexValues[IndexOffset] = VertexIndex;
    IndexValues[IndexOffset + 1] = VertexIndex + 1;
    IndexValues[IndexOffset + 2] = VertexIndex + 2;
    IndexValues[IndexOffset + 3] = VertexIndex + 1;
    IndexValues[IndexOffset + 4] = VertexIndex + 3;
    IndexValues[IndexOffset + 5] = VertexIndex + 2;
    IndexOffset += 6;
  }
  Geometry.setIndex(new THREE.BufferAttribute(IndexValues, 1));
  const Material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const Mesh = new THREE.Mesh(Geometry, Material);
  Mesh.visible = false;
  Mesh.frustumCulled = false;
  Mesh.renderOrder = renderOrder;
  Scene.add(Mesh);
  return {
    mesh: Mesh,
    positions: Positions,
    positionAttribute: PositionAttribute,
    geometry: Geometry,
    maxPoints,
  };
}

function writePlanarRibbon(Ribbon, Points, HalfWidth) {
  if (!Ribbon || !Array.isArray(Points) || Points.length < 2) {
    if (Ribbon) {
      Ribbon.mesh.visible = false;
    }
    return;
  }
  const PointCount = Math.min(Points.length, Ribbon.maxPoints);
  for (let PointIndex = 0; PointIndex < PointCount; PointIndex += 1) {
    const Point = Points[PointIndex];
    const Previous = Points[Math.max(0, PointIndex - 1)];
    const Next = Points[Math.min(PointCount - 1, PointIndex + 1)];
    let TangentX = Next.x - Previous.x;
    let TangentY = Next.y - Previous.y;
    const TangentLength = Math.hypot(TangentX, TangentY) || 1;
    TangentX /= TangentLength;
    TangentY /= TangentLength;
    const NormalX = -TangentY;
    const NormalY = TangentX;
    const EndTaper = PointIndex === 0 || PointIndex === PointCount - 1 ? 0.28 : 1;
    const SpanTaper = 1 - (Math.abs((PointIndex / Math.max(1, PointCount - 1)) - 0.5) * 0.22);
    const Width = HalfWidth * EndTaper * SpanTaper;
    const VertexOffset = PointIndex * 6;
    Ribbon.positions[VertexOffset] = Point.x + (NormalX * Width);
    Ribbon.positions[VertexOffset + 1] = Point.y + (NormalY * Width);
    Ribbon.positions[VertexOffset + 2] = 0.13;
    Ribbon.positions[VertexOffset + 3] = Point.x - (NormalX * Width);
    Ribbon.positions[VertexOffset + 4] = Point.y - (NormalY * Width);
    Ribbon.positions[VertexOffset + 5] = 0.13;
  }
  Ribbon.positionAttribute.needsUpdate = true;
  Ribbon.geometry.setDrawRange(0, Math.max(0, (PointCount - 1) * 6));
  Ribbon.geometry.computeBoundingSphere();
  Ribbon.mesh.visible = PointCount > 1;
}

export function createPlayerVisuals(THREE, Scene, host) {
  const {
    SeedRadius,
    GameCanvas,
    MaximumTrajectoryPredictionSteps,
    TrajectoryPreviewSampleStride,
  } = host;

  /** A compact procedural Runner stays tiny on the world; collision radius is unchanged. */
  const SeedGroup = new THREE.Group();
  const RunnerVisualGroup = new THREE.Group();
  const RunnerPresentationScale = 0.26;
  const ShipPresentationScale = 0.3;
  RunnerVisualGroup.scale.setScalar(RunnerPresentationScale);
  GameCanvas.dataset.runnerVisualScale = String(RunnerPresentationScale);
  const RunnerSuitMaterial = new THREE.MeshStandardMaterial({
    color: 0xe9f2f4,
    emissive: 0x4f8fa0,
    emissiveIntensity: 0.4,
    roughness: 0.38,
    metalness: 0.08,
  });
  const RunnerDarkMaterial = new THREE.MeshStandardMaterial({
    color: 0x193646,
    emissive: 0x0d2633,
    emissiveIntensity: 0.4,
    roughness: 0.32,
    metalness: 0.28,
  });
  const RunnerVisorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffbf62,
    emissive: 0xff7a38,
    emissiveIntensity: 1.55,
    roughness: 0.2,
    metalness: 0.3,
  });

  const RunnerBackpackMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.38, 0.2),
    RunnerDarkMaterial,
  );
  RunnerBackpackMesh.position.set(0, -0.11, -0.13);
  RunnerVisualGroup.add(RunnerBackpackMesh);

  const RunnerTorsoMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 16, 12),
    RunnerSuitMaterial,
  );
  RunnerTorsoMesh.position.y = -0.12;
  RunnerTorsoMesh.scale.set(0.88, 1.08, 0.72);
  RunnerTorsoMesh.castShadow = true;
  RunnerVisualGroup.add(RunnerTorsoMesh);

  const RunnerHelmetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 20, 14),
    RunnerSuitMaterial,
  );
  RunnerHelmetMesh.position.y = 0.17;
  RunnerHelmetMesh.castShadow = true;
  RunnerVisualGroup.add(RunnerHelmetMesh);

  const RunnerVisorMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 16, 10),
    RunnerVisorMaterial,
  );
  RunnerVisorMesh.position.set(0, 0.18, 0.2);
  RunnerVisorMesh.scale.set(1, 0.7, 0.34);
  RunnerVisualGroup.add(RunnerVisorMesh);

  const RunnerLimbGeometry = new THREE.CylinderGeometry(0.052, 0.065, 0.24, 8);
  const RunnerArmMeshes = [];
  const RunnerLegMeshes = [];
  for (const Side of [-1, 1]) {
    const ArmMesh = new THREE.Mesh(RunnerLimbGeometry, RunnerSuitMaterial);
    ArmMesh.position.set(Side * 0.245, -0.12, 0);
    ArmMesh.rotation.z = Side * -0.22;
    ArmMesh.userData.side = Side;
    RunnerArmMeshes.push(ArmMesh);
    RunnerVisualGroup.add(ArmMesh);

    const LegMesh = new THREE.Mesh(RunnerLimbGeometry, RunnerSuitMaterial);
    LegMesh.position.set(Side * 0.095, -0.34, 0);
    LegMesh.rotation.z = Side * -0.08;
    LegMesh.userData.side = Side;
    RunnerLegMeshes.push(LegMesh);
    RunnerVisualGroup.add(LegMesh);
  }

  const RunnerThrusterMaterial = new THREE.MeshBasicMaterial({
    color: 0x7deaff,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const RunnerThrusterGroup = new THREE.Group();
  for (const Side of [-1, 1]) {
    const ThrusterFlame = new THREE.Mesh(
      new THREE.ConeGeometry(0.065, 0.3, 8),
      RunnerThrusterMaterial,
    );
    ThrusterFlame.position.set(Side * 0.09, -0.5, -0.07);
    ThrusterFlame.rotation.z = Math.PI;
    RunnerThrusterGroup.add(ThrusterFlame);
  }
  RunnerThrusterGroup.visible = false;
  RunnerVisualGroup.add(RunnerThrusterGroup);

  const RunnerAntennaStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6),
    RunnerDarkMaterial,
  );
  RunnerAntennaStem.position.set(0.16, 0.42, 0);
  RunnerAntennaStem.rotation.z = -0.22;
  RunnerVisualGroup.add(RunnerAntennaStem);
  const RunnerAntennaLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 8),
    RunnerVisorMaterial,
  );
  RunnerAntennaLight.position.set(0.18, 0.5, 0);
  RunnerVisualGroup.add(RunnerAntennaLight);
  SeedGroup.add(RunnerVisualGroup);

  /** The Orbitbreaker unfolds around the same physics body; only its silhouette changes. */
  const ShipVisualGroup = new THREE.Group();
  const ShipHullMaterial = new THREE.MeshStandardMaterial({
    color: 0xddecef,
    emissive: 0x2a7f99,
    emissiveIntensity: 0.62,
    roughness: 0.3,
    metalness: 0.46,
  });
  const ShipAccentMaterial = new THREE.MeshStandardMaterial({
    color: 0xffa85d,
    emissive: 0xff623b,
    emissiveIntensity: 1.1,
    roughness: 0.26,
    metalness: 0.34,
  });
  const ShipHullMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.44, 6, 12),
    ShipHullMaterial,
  );
  ShipHullMesh.scale.set(0.9, 1, 0.72);
  ShipHullMesh.castShadow = true;
  ShipVisualGroup.add(ShipHullMesh);
  const ShipNoseMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.3, 12),
    ShipAccentMaterial,
  );
  ShipNoseMesh.position.y = 0.5;
  ShipVisualGroup.add(ShipNoseMesh);
  for (const Side of [-1, 1]) {
    const WingMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.2, 0.055),
      ShipHullMaterial,
    );
    WingMesh.position.set(Side * 0.28, -0.15, 0);
    WingMesh.rotation.z = Side * -0.32;
    ShipVisualGroup.add(WingMesh);
  }
  const ShipWindowMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 8),
    RunnerVisorMaterial,
  );
  ShipWindowMesh.position.set(0, 0.16, 0.2);
  ShipWindowMesh.scale.set(1, 1.18, 0.38);
  ShipVisualGroup.add(ShipWindowMesh);
  const ShipTailMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.28, 0.16),
    ShipAccentMaterial,
  );
  ShipTailMesh.position.set(0, -0.28, -0.16);
  ShipVisualGroup.add(ShipTailMesh);
  const ShipThrusterMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.44, 10),
    RunnerThrusterMaterial,
  );
  ShipThrusterMesh.position.y = -0.56;
  ShipThrusterMesh.rotation.z = Math.PI;
  ShipVisualGroup.add(ShipThrusterMesh);
  ShipVisualGroup.visible = false;
  SeedGroup.add(ShipVisualGroup);

  const FuelPipLitColor = 0x7deaff;
  const FuelPipLitEmissive = 0x3ad2ff;
  const FuelPipWarnColor = 0xffb27d;
  const FuelPipWarnEmissive = 0xff7a38;
  const FuelPipDarkColor = 0x1a2a33;
  const FuelPipDarkEmissive = 0x071018;
  const MaximumFuelPipCount = 12;
  const ShipFuelPipGroup = new THREE.Group();
  const RunnerFuelPipGroup = new THREE.Group();
  const ShipFuelPips = [];
  const RunnerFuelPips = [];
  for (let PipIndex = 0; PipIndex < MaximumFuelPipCount; PipIndex += 1) {
    const ShipPipMaterial = new THREE.MeshStandardMaterial({
      color: FuelPipLitColor,
      emissive: FuelPipLitEmissive,
      emissiveIntensity: 1.15,
      roughness: 0.28,
      metalness: 0.22,
    });
    const ShipPip = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), ShipPipMaterial);
    ShipFuelPipGroup.add(ShipPip);
    ShipFuelPips.push(ShipPip);

    const RunnerPipMaterial = new THREE.MeshStandardMaterial({
      color: FuelPipLitColor,
      emissive: FuelPipLitEmissive,
      emissiveIntensity: 0.62,
      roughness: 0.34,
      metalness: 0.18,
    });
    const RunnerPip = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), RunnerPipMaterial);
    RunnerFuelPipGroup.add(RunnerPip);
    RunnerFuelPips.push(RunnerPip);
  }
  ShipFuelPipGroup.position.set(0, -0.28, 0.22);
  ShipVisualGroup.add(ShipFuelPipGroup);
  RunnerFuelPipGroup.position.set(0, 0.02, 0.12);
  RunnerBackpackMesh.add(RunnerFuelPipGroup);

  function layoutFuelPips(PipMeshes, VisibleCount, Spacing) {
    const RowWidth = Math.max(0, VisibleCount - 1) * Spacing;
    for (let PipIndex = 0; PipIndex < PipMeshes.length; PipIndex += 1) {
      const PipMesh = PipMeshes[PipIndex];
      PipMesh.visible = PipIndex < VisibleCount;
      PipMesh.position.set((PipIndex * Spacing) - (RowWidth * 0.5), 0, 0);
    }
  }

  function paintFuelPip(PipMesh, IsLit, IsWarning, IntensityScale) {
    PipMesh.material.color.setHex(IsLit ? (IsWarning ? FuelPipWarnColor : FuelPipLitColor) : FuelPipDarkColor);
    PipMesh.material.emissive.setHex(
      IsLit ? (IsWarning ? FuelPipWarnEmissive : FuelPipLitEmissive) : FuelPipDarkEmissive,
    );
    PipMesh.material.emissiveIntensity = IsLit
      ? (IsWarning ? 1.45 : 1.12) * IntensityScale
      : 0.12 * IntensityScale;
  }

  function updateFuelLightVisuals(RemainingLaunches, MaximumLaunches) {
    const VisibleCount = Math.max(0, Math.min(MaximumFuelPipCount, MaximumLaunches));
    const LitCount = Math.max(0, Math.min(VisibleCount, RemainingLaunches));
    const IsWarning = LitCount > 0 && LitCount <= 2;
    layoutFuelPips(ShipFuelPips, VisibleCount, 0.11);
    layoutFuelPips(RunnerFuelPips, VisibleCount, 0.072);
    for (let PipIndex = 0; PipIndex < VisibleCount; PipIndex += 1) {
      const IsLit = PipIndex < LitCount;
      paintFuelPip(ShipFuelPips[PipIndex], IsLit, IsLit && IsWarning, 1);
      paintFuelPip(RunnerFuelPips[PipIndex], IsLit, IsLit && IsWarning, 0.55);
    }
  }

  const SeedHaloGeometry = new THREE.SphereGeometry(SeedRadius * 1.65, 24, 16);
  const SeedHaloMaterial = new THREE.MeshBasicMaterial({
    color: 0x6de8ff,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const SeedHaloMesh = new THREE.Mesh(SeedHaloGeometry, SeedHaloMaterial);
  SeedGroup.add(SeedHaloMesh);

  const SeedPointLight = new THREE.PointLight(0x72dcff, 2.1, 6, 2);
  SeedGroup.add(SeedPointLight);
  Scene.add(SeedGroup);

  /**
   * An enlarged invisible sphere makes pointer acquisition forgiving on touchscreens.
   */
  const SeedPointerHitGeometry = new THREE.SphereGeometry(SeedRadius * 3.6, 12, 8);
  const SeedPointerHitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const SeedPointerHitMesh = new THREE.Mesh(SeedPointerHitGeometry, SeedPointerHitMaterial);
  SeedGroup.add(SeedPointerHitMesh);

  /**
   * Launch preview uses a single line plus a terminal landing marker. The final art pass can
   * convert this to a dotted shader or particle trail without touching trajectory logic.
   */
  const MaximumPreviewPointCount = Math.ceil(
    MaximumTrajectoryPredictionSteps / TrajectoryPreviewSampleStride,
  ) + 2;
  const TrajectoryPositionValues = new Float32Array(MaximumPreviewPointCount * 3);
  const TrajectoryGeometry = new THREE.BufferGeometry();
  const TrajectoryPositionAttribute = new THREE.BufferAttribute(TrajectoryPositionValues, 3);
  TrajectoryPositionAttribute.setUsage(THREE.DynamicDrawUsage);
  TrajectoryGeometry.setAttribute('position', TrajectoryPositionAttribute);
  TrajectoryGeometry.setDrawRange(0, 0);
  const TrajectoryMaterial = new THREE.LineBasicMaterial({
    color: 0xd9f6cc,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const TrajectoryLine = new THREE.Line(TrajectoryGeometry, TrajectoryMaterial);
  TrajectoryLine.visible = false;
  TrajectoryLine.frustumCulled = false;
  Scene.add(TrajectoryLine);
  const TrajectoryRibbon = createPlanarRibbon(THREE, Scene, {
    maxPoints: MaximumPreviewPointCount,
    color: 0xb8ffe0,
    opacity: 0.42,
    renderOrder: 18,
  });

  const LandingMarkerGeometry = new THREE.RingGeometry(0.42, 0.58, 32);
  const LandingMarkerMaterial = new THREE.MeshBasicMaterial({
    color: 0xd9f6cc,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const LandingMarkerMesh = new THREE.Mesh(LandingMarkerGeometry, LandingMarkerMaterial);
  LandingMarkerMesh.visible = false;
  LandingMarkerMesh.position.z = 0.18;
  Scene.add(LandingMarkerMesh);

  /** Reused rings provide launch snap and landing impact without allocating during play. */
  const FeedbackPulseGeometry = new THREE.RingGeometry(0.42, 0.55, 36);
  function createFeedbackPulse(Color) {
    const PulseMaterial = new THREE.MeshBasicMaterial({
      color: Color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const PulseMesh = new THREE.Mesh(FeedbackPulseGeometry, PulseMaterial);
    PulseMesh.visible = false;
    Scene.add(PulseMesh);
    return PulseMesh;
  }

  const LaunchPulseMesh = createFeedbackPulse(0xd9f6cc);
  const ImpactPulseMesh = createFeedbackPulse(0xfff2bc);

  /** A dotted pull guide points away from the first target before the first launch. */
  const PullGuideGeometry = new THREE.BufferGeometry();
  const PullGuideMaterial = new THREE.LineDashedMaterial({
    color: 0xd9f6cc,
    transparent: true,
    opacity: 0.42,
    dashSize: 0.22,
    gapSize: 0.14,
    depthWrite: false,
    depthTest: false,
  });
  const PullGuideLine = new THREE.Line(PullGuideGeometry, PullGuideMaterial);
  PullGuideLine.visible = false;
  PullGuideLine.renderOrder = 20;
  Scene.add(PullGuideLine);
  const PullGuideRibbon = createPlanarRibbon(THREE, Scene, {
    maxPoints: 2,
    color: 0xc8ffe0,
    opacity: 0.5,
    renderOrder: 19,
  });

  const CutGuideGeometry = new THREE.BufferGeometry();
  const CutGuideMaterial = new THREE.LineDashedMaterial({
    color: 0xffd678,
    transparent: true,
    opacity: 0.92,
    dashSize: 0.16,
    gapSize: 0.1,
    depthWrite: false,
    depthTest: false,
  });
  const CutGuideLine = new THREE.Line(CutGuideGeometry, CutGuideMaterial);
  CutGuideLine.visible = false;
  CutGuideLine.renderOrder = 21;
  Scene.add(CutGuideLine);


  /**
   * Creates a small trail behind the flying seed as one instanced draw call. Pooling avoids
   * allocation spikes and protects the restoration draw-call budget during flight.
   */
  const TrailParticlePool = [];
  const TrailParticleCount = 30;
  const TrailParticleGeometry = new THREE.SphereGeometry(0.11, 6, 4);
  const TrailParticleMaterial = new THREE.MeshBasicMaterial({
    color: 0xd9f8c8,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const TrailParticleMesh = new THREE.InstancedMesh(
    TrailParticleGeometry,
    TrailParticleMaterial,
    TrailParticleCount,
  );
  const TrailParticleTransform = new THREE.Object3D();
  TrailParticleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  TrailParticleMesh.frustumCulled = false;
  Scene.add(TrailParticleMesh);

  for (let TrailParticleIndex = 0; TrailParticleIndex < TrailParticleCount; TrailParticleIndex += 1) {
    const TrailParticle = {
      index: TrailParticleIndex,
      position: new THREE.Vector3(),
      lifeRemainingSeconds: 0,
      maximumLifeSeconds: 0.58,
    };
    TrailParticlePool.push(TrailParticle);
    updateTrailParticleInstance(TrailParticle, 0);
  }
  TrailParticleMesh.instanceMatrix.needsUpdate = true;

  /** Writes one pooled trail particle into the shared instanced mesh. */
  function updateTrailParticleInstance(TrailParticle, Scale) {
    TrailParticleTransform.position.copy(TrailParticle.position);
    TrailParticleTransform.scale.setScalar(Scale);
    TrailParticleTransform.updateMatrix();
    TrailParticleMesh.setMatrixAt(TrailParticle.index, TrailParticleTransform.matrix);
  }

  return {
    SeedGroup,
    RunnerVisualGroup,
    RunnerPresentationScale,
    ShipPresentationScale,
    RunnerSuitMaterial,
    RunnerDarkMaterial,
    RunnerVisorMaterial,
    RunnerBackpackMesh,
    RunnerTorsoMesh,
    RunnerHelmetMesh,
    RunnerVisorMesh,
    RunnerLimbGeometry,
    RunnerArmMeshes,
    RunnerLegMeshes,
    RunnerThrusterMaterial,
    RunnerThrusterGroup,
    RunnerAntennaStem,
    RunnerAntennaLight,
    ShipVisualGroup,
    ShipFuelPipGroup,
    RunnerFuelPipGroup,
    updateFuelLightVisuals,
    ShipHullMaterial,
    ShipAccentMaterial,
    ShipHullMesh,
    ShipNoseMesh,
    ShipWindowMesh,
    ShipThrusterMesh,
    SeedHaloGeometry,
    SeedHaloMaterial,
    SeedHaloMesh,
    SeedPointLight,
    SeedPointerHitGeometry,
    SeedPointerHitMaterial,
    SeedPointerHitMesh,
    MaximumPreviewPointCount,
    TrajectoryPositionValues,
    TrajectoryGeometry,
    TrajectoryPositionAttribute,
    TrajectoryMaterial,
    TrajectoryLine,
    TrajectoryRibbon,
    LandingMarkerGeometry,
    LandingMarkerMaterial,
    LandingMarkerMesh,
    FeedbackPulseGeometry,
    LaunchPulseMesh,
    ImpactPulseMesh,
    PullGuideGeometry,
    PullGuideMaterial,
    PullGuideLine,
    PullGuideRibbon,
    CutGuideGeometry,
    CutGuideMaterial,
    CutGuideLine,
    TrailParticlePool,
    TrailParticleCount,
    TrailParticleGeometry,
    TrailParticleMaterial,
    TrailParticleMesh,
    TrailParticleTransform,
    createFeedbackPulse,
    updateTrailParticleInstance,
    writePlanarRibbon,
  };
}
