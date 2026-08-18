/**
 * World mesh factory. Presentation-only; never enters ranked simulation.
 */

import { getWorldSurfaceFinish } from './presentation.js';

export function createWorldVisuals(THREE, Scene, {
  worldDefinitions: WorldDefinitions,
  worldRuntimeByIdentifier: WorldRuntimeByIdentifier,
  worldRuntimesByVisualKey: WorldRuntimesByVisualKey,
}) {
  const DeadWorldColor = new THREE.Color(0x3f3532);
  const DarkWorldColor = new THREE.Color(0x2c3337);
  const TemporaryThreeVector = new THREE.Vector3();

  /** Deterministic per-world random stream so scatter layouts never shift between runs. */
  function createSeededRandom(SeedText) {
    let RandomState = 2166136261;
    for (let CharIndex = 0; CharIndex < SeedText.length; CharIndex += 1) {
      RandomState = Math.imul(RandomState ^ SeedText.charCodeAt(CharIndex), 16777619) >>> 0;
    }
    return function nextRandomValue() {
      RandomState = (Math.imul(RandomState, 1664525) + 1013904223) >>> 0;
      return RandomState / 4294967296;
    };
  }

  /**
   * Fresnel atmosphere shell shared by every world. The rim brightens as the
   * world restores; restoration-visuals keeps driving the same `color` and
   * `opacity` contract the old basic-material shell exposed.
   */
  function createAtmosphereRimShell(WorldDefinition) {
    const ShellUniforms = {
      uColor: { value: WorldDefinition.atmosphereColor.clone() },
      uOpacity: { value: WorldDefinition.restored ? 0.1 : 0.025 },
    };
    const ShellMaterial = new THREE.ShaderMaterial({
      uniforms: ShellUniforms,
      vertexShader: `
        varying vec3 vViewNormal;
        varying vec3 vViewDirection;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vViewNormal = normalize(normalMatrix * normal);
          vViewDirection = normalize(-viewPosition.xyz);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vViewNormal;
        varying vec3 vViewDirection;
        uniform vec3 uColor;
        uniform float uOpacity;
        void main() {
          float fresnel = pow(
            1.0 - max(dot(normalize(vViewNormal), normalize(vViewDirection)), 0.0),
            4.4
          );
          gl_FragColor = vec4(uColor * (1.0 + (fresnel * 1.85)), fresnel * uOpacity * 2.45);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    ShellMaterial.opacity = ShellUniforms.uOpacity.value;
    ShellMaterial.color = ShellUniforms.uColor.value;
    const ShellMesh = new THREE.Mesh(
      new THREE.SphereGeometry(WorldDefinition.radius * 1.08, 24, 16),
      ShellMaterial,
    );
    ShellMesh.onBeforeRender = () => {
      ShellUniforms.uOpacity.value = ShellMaterial.opacity;
    };
    ShellMesh.renderOrder = 4;
    return { mesh: ShellMesh, material: ShellMaterial };
  }

  /**
   * Injects the spherical restoration wave into a scatter material so growth
   * and dead-to-alive colour run fully on the GPU from the shared uniforms.
   */
  function applyScatterRestorationShader(Material, RestorationUniforms, CacheKey) {
    Material.onBeforeCompile = (Shader) => {
      Shader.uniforms.restorationOrigin = RestorationUniforms.restorationOrigin;
      Shader.uniforms.restorationProgress = RestorationUniforms.restorationProgress;
      Shader.uniforms.scatterDeadColor = {
        value: Material.userData.scatterDeadColor?.clone?.() ?? DarkWorldColor.clone(),
      };
      Shader.vertexShader = Shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec3 restorationOrigin;
          uniform float restorationProgress;
          attribute vec3 scatterDirection;
          varying float vScatterGrowth;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float scatterDistance = acos(clamp(dot(
            normalize(scatterDirection),
            normalize(restorationOrigin)
          ), -1.0, 1.0)) / PI;
          vScatterGrowth = smoothstep(scatterDistance, scatterDistance + 0.16, restorationProgress);
          transformed *= vScatterGrowth;`,
        );
      Shader.fragmentShader = Shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec3 scatterDeadColor;
          varying float vScatterGrowth;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          diffuseColor.rgb = mix(scatterDeadColor, diffuseColor.rgb, vScatterGrowth);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance *= vScatterGrowth;`,
        );
    };
    Material.customProgramCacheKey = () => CacheKey;
  }

  function createScatterInstances(Geometry, Material, WorldDefinition, {
    count,
    nextRandomValue,
    minimumScale,
    maximumScale,
    surfaceInset = 0.005,
  }) {
    const ScatterMesh = new THREE.InstancedMesh(Geometry, Material, count);
    const ScatterDirections = new Float32Array(count * 3);
    const InstanceMatrix = new THREE.Matrix4();
    const InstanceQuaternion = new THREE.Quaternion();
    const InstancePosition = new THREE.Vector3();
    const InstanceScale = new THREE.Vector3();
    const UpAxis = new THREE.Vector3(0, 1, 0);
    for (let InstanceIndex = 0; InstanceIndex < count; InstanceIndex += 1) {
      const PoleOffset = (nextRandomValue() * 2) - 1;
      const RingAngle = nextRandomValue() * Math.PI * 2;
      const RingRadius = Math.sqrt(Math.max(0, 1 - (PoleOffset * PoleOffset)));
      TemporaryThreeVector.set(
        RingRadius * Math.cos(RingAngle),
        RingRadius * Math.sin(RingAngle),
        PoleOffset,
      ).normalize();
      ScatterDirections[InstanceIndex * 3] = TemporaryThreeVector.x;
      ScatterDirections[(InstanceIndex * 3) + 1] = TemporaryThreeVector.y;
      ScatterDirections[(InstanceIndex * 3) + 2] = TemporaryThreeVector.z;
      InstancePosition.copy(TemporaryThreeVector)
        .multiplyScalar(WorldDefinition.radius * (1 - surfaceInset));
      InstanceQuaternion.setFromUnitVectors(UpAxis, TemporaryThreeVector);
      const ScatterScale = minimumScale + (nextRandomValue() * (maximumScale - minimumScale));
      InstanceScale.setScalar(ScatterScale);
      InstanceMatrix.compose(InstancePosition, InstanceQuaternion, InstanceScale);
      ScatterMesh.setMatrixAt(InstanceIndex, InstanceMatrix);
    }
    Geometry.setAttribute(
      'scatterDirection',
      new THREE.InstancedBufferAttribute(ScatterDirections, 3),
    );
    ScatterMesh.instanceMatrix.needsUpdate = true;
    ScatterMesh.frustumCulled = false;
    ScatterMesh.receiveShadow = true;
    return ScatterMesh;
  }

  /** Merges primitive parts so one scatter instance can be a tree, cactus or lantern. */
  function mergeScatterParts(Parts) {
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
      PartTransform.rotation.set(0, 0, 0);
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

  function createScatterFloraGeometry(VisualKey) {
    if (VisualKey === 'meadow' || VisualKey === 'bower') {
      return mergeScatterParts([
        { geometry: new THREE.ConeGeometry(0.04, 0.18, 4), position: [-0.04, 0.09, 0], color: 0x7bb85a },
        { geometry: new THREE.ConeGeometry(0.035, 0.22, 4), position: [0.02, 0.11, 0.02], color: 0x8fd06a },
        { geometry: new THREE.ConeGeometry(0.03, 0.14, 4), position: [0.05, 0.07, -0.03], color: 0x5e9a48 },
      ]);
    }
    if (VisualKey === 'ember' || VisualKey === 'kiln' || VisualKey === 'lantern' || VisualKey === 'vault') {
      return mergeScatterParts([
        { geometry: new THREE.CylinderGeometry(0.04, 0.07, 0.22, 6), position: [0, 0.11, 0], color: 0x4a3438 },
        { geometry: new THREE.OctahedronGeometry(0.07, 0), position: [0, 0.26, 0], scale: [0.7, 1.55, 0.7], color: 0x5a3a3c },
        { geometry: new THREE.SphereGeometry(0.042, 6, 5), position: [0.02, 0.2, 0.03], color: 0xff7a38 },
      ]);
    }
    if (VisualKey === 'grove' || VisualKey === 'canopy') {
      return mergeScatterParts([
        { geometry: new THREE.CylinderGeometry(0.02, 0.03, 0.14, 5), position: [0, 0.07, 0], color: 0x6a4630 },
        { geometry: new THREE.SphereGeometry(0.09, 7, 6), position: [0, 0.18, 0], scale: [1.15, 0.7, 1.15], color: 0x6fb85a },
        { geometry: new THREE.SphereGeometry(0.055, 6, 5), position: [0.06, 0.16, 0.02], color: 0x8fd06a },
      ]);
    }
    if (VisualKey === 'frost' || VisualKey === 'nest' || VisualKey === 'shard') {
      return mergeScatterParts([
        { geometry: new THREE.OctahedronGeometry(0.1, 0), position: [0, 0.18, 0], scale: [0.7, 2.2, 0.7], color: 0xd8f4ff },
        { geometry: new THREE.OctahedronGeometry(0.06, 0), position: [0.06, 0.11, 0], scale: [0.55, 1.4, 0.55], color: 0xb7e4f2 },
      ]);
    }
    if (VisualKey === 'tide' || VisualKey === 'drift' || VisualKey === 'dew') {
      return mergeScatterParts([
        { geometry: new THREE.ConeGeometry(0.032, 0.32, 4), position: [-0.04, 0.16, 0], color: 0x3f8a58 },
        { geometry: new THREE.ConeGeometry(0.03, 0.4, 4), position: [0.02, 0.2, 0.02], color: 0x4ea05f },
        { geometry: new THREE.ConeGeometry(0.026, 0.24, 4), position: [0.05, 0.12, -0.03], color: 0x36784c },
      ]);
    }
    return mergeScatterParts([
      { geometry: new THREE.CylinderGeometry(0.032, 0.048, 0.2, 5), position: [0, 0.1, 0], color: 0x6a4630 },
      { geometry: new THREE.ConeGeometry(0.16, 0.32, 7), position: [0, 0.32, 0], color: 0x4f9a4a },
    ]);
  }

  function createScatterLanternGeometry() {
    return mergeScatterParts([
      { geometry: new THREE.CylinderGeometry(0.018, 0.022, 0.12, 5), position: [0, 0.06, 0] },
      { geometry: new THREE.SphereGeometry(0.045, 7, 6), position: [0, 0.14, 0] },
    ]);
  }

  /**
   * Dense instanced ground cover for every restorable world: flora sprouts in
   * the world's alive palette plus emissive settlement lights that bloom once
   * the liberation wave reaches them. Two draw calls per world.
   */
  function createLifeScatter(WorldDefinition, RestorationUniforms) {
    const ScatterGroup = new THREE.Group();
    const nextRandomValue = createSeededRandom(`${WorldDefinition.id}-life-scatter`);
    const SurfaceAreaScale = WorldDefinition.radius * WorldDefinition.radius;
    const FloraCount = Math.round(THREE.MathUtils.clamp(SurfaceAreaScale * 6, 16, 42));
    const GlowCount = Math.round(THREE.MathUtils.clamp(SurfaceAreaScale * 3, 8, 20));

    const FloraGeometry = createScatterFloraGeometry(WorldDefinition.visualKey);
    const FloraMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.04,
      vertexColors: true,
    });
    FloraMaterial.userData.scatterDeadColor = DarkWorldColor.clone().lerp(
      WorldDefinition.aliveColor,
      0.22,
    );
    applyScatterRestorationShader(
      FloraMaterial,
      RestorationUniforms,
      'orbitbreak-life-scatter-flora-v3',
    );
    const IsGroundCover = WorldDefinition.visualKey === 'meadow'
      || WorldDefinition.visualKey === 'bower'
      || WorldDefinition.visualKey === 'grove'
      || WorldDefinition.visualKey === 'canopy'
      || WorldDefinition.visualKey === 'tide'
      || WorldDefinition.visualKey === 'drift'
      || WorldDefinition.visualKey === 'dew';
    ScatterGroup.add(createScatterInstances(FloraGeometry, FloraMaterial, WorldDefinition, {
      count: FloraCount,
      nextRandomValue,
      minimumScale: IsGroundCover ? 0.22 : 0.34,
      maximumScale: IsGroundCover ? 0.38 : 0.56,
    }));

    const GlowGeometry = createScatterLanternGeometry();
    const GlowColor = (WorldDefinition.accentColor ?? WorldDefinition.aliveColor
      ?? DeadWorldColor).clone();
    const GlowMaterial = new THREE.MeshStandardMaterial({
      color: 0x141a1e,
      roughness: 0.5,
      metalness: 0,
      emissive: GlowColor,
      emissiveIntensity: 2.3,
    });
    applyScatterRestorationShader(
      GlowMaterial,
      RestorationUniforms,
      'orbitbreak-life-scatter-glow-v1',
    );
    ScatterGroup.add(createScatterInstances(GlowGeometry, GlowMaterial, WorldDefinition, {
      count: GlowCount,
      nextRandomValue,
      minimumScale: 0.28,
      maximumScale: 0.42,
    }));

    return ScatterGroup;
  }

  /**
   * Creates simple contour rings around a world. These are placeholder composition tools,
   * but they already make each sphere read as a self-contained miniature object rather than
   * as an arbitrary collision primitive.
   *
   * @param {number} WorldRadius - Radius of the world being decorated.
   * @param {THREE.Color} RingColor - Accent colour for restored-state rings.
   * @returns {THREE.Group} Group containing the ring meshes.
   */
  function createWorldContourRings(WorldRadius, RingColor) {
    const RingGroup = new THREE.Group();
    const RingGeometries = [];

    for (let RingIndex = 0; RingIndex < 2; RingIndex += 1) {
      const RingSourceGeometry = new THREE.TorusGeometry(
        WorldRadius * (1.01 + (RingIndex * 0.008)),
        0.015,
        4,
        96,
      );
      const RingGeometry = RingSourceGeometry.index
        ? RingSourceGeometry.toNonIndexed()
        : RingSourceGeometry.clone();
      RingSourceGeometry.dispose();
      RingGeometry.rotateX(Math.PI * (0.42 + (RingIndex * 0.19)));
      RingGeometry.rotateY(Math.PI * (0.12 + (RingIndex * 0.17)));
      addRestorationGeometryAttributes(RingGeometry, null, 1);
      RingGeometries.push(RingGeometry);
    }

    const RingMaterial = new THREE.MeshBasicMaterial({
      color: RingColor,
      transparent: true,
      opacity: 0.095,
      depthWrite: false,
    });
    RingGroup.add(new THREE.Mesh(
      mergeRestorationGeometries(RingGeometries),
      RingMaterial,
    ));

    return RingGroup;
  }

  /** Wraps an occupied world in a rigid, readable Stillness control field. */
  function createStillnessCage(WorldDefinition) {
    const CageGroup = new THREE.Group();
    const CageMaterial = new THREE.MeshBasicMaterial({
      color: 0xc5f3ff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const CageRadius = WorldDefinition.radius * 1.14;
    const Rotations = [
      [Math.PI * 0.5, 0, 0],
      [Math.PI * 0.22, Math.PI * 0.34, Math.PI * 0.08],
      [Math.PI * 0.72, Math.PI * -0.2, Math.PI * 0.38],
    ];
    for (const [RotationX, RotationY, RotationZ] of Rotations) {
      const CageRing = new THREE.Mesh(
        new THREE.TorusGeometry(CageRadius, 0.042, 6, 72),
        CageMaterial,
      );
      CageRing.rotation.set(RotationX, RotationY, RotationZ);
      CageGroup.add(CageRing);
    }
    CageGroup.visible = !WorldDefinition.restored;
    return { group: CageGroup, material: CageMaterial };
  }

  /**
   * Extends a standard lit material with the spherical dead-to-alive colour wave.
   *
   * @param {object} WorldDefinition - Gameplay and visual definition for the world.
   * @returns {{material:THREE.MeshStandardMaterial, uniforms:object}} Material and live uniforms.
   */
  function createRestorationSurfaceMaterial(WorldDefinition) {
    const RestorationUniforms = {
      restorationOrigin: { value: new THREE.Vector3(1, 0, 0) },
      restorationProgress: { value: WorldDefinition.restored ? 1.2 : -0.1 },
      restorationWaveWidth: { value: WorldDefinition.restoration.waveWidth },
      deadColor: { value: DeadWorldColor.clone() },
      aliveColor: { value: WorldDefinition.aliveColor.clone() },
      waveColor: { value: WorldDefinition.restoration.waveColor.clone() },
      surfaceVariation: { value: WorldDefinition.restoration.surfaceVariation },
      accentColor: { value: (WorldDefinition.accentColor ?? WorldDefinition.aliveColor).clone() },
      biomeStyle: { value: WorldDefinition.biomeStyle ?? 0 },
      biomeTime: { value: 0 },
    };
    const SurfaceFinish = getWorldSurfaceFinish(WorldDefinition.visualKey);
    const SurfaceMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: SurfaceFinish.roughness,
      metalness: SurfaceFinish.metalness,
      flatShading: false,
    });

    SurfaceMaterial.onBeforeCompile = (Shader) => {
      Object.assign(Shader.uniforms, RestorationUniforms);
      Shader.vertexShader = Shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float restorationProgress;
          attribute vec3 restorationDirection;
          attribute float landmarkMask;
          varying vec3 vRestorationDirection;
          varying float vLandmarkMask;`,
        )
        .replace(
          '#include <beginnormal_vertex>',
          `#include <beginnormal_vertex>
          vRestorationDirection = normalize(restorationDirection);
          vLandmarkMask = landmarkMask;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float landmarkGrowth = smoothstep(-0.02, 0.72, restorationProgress);
          transformed *= mix(1.0, 0.28 + (landmarkGrowth * 0.72), landmarkMask);`,
        );
      Shader.fragmentShader = Shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vRestorationDirection;
          varying float vLandmarkMask;
          uniform vec3 restorationOrigin;
          uniform float restorationProgress;
          uniform float restorationWaveWidth;
          uniform vec3 deadColor;
          uniform vec3 aliveColor;
          uniform vec3 waveColor;
          uniform float surfaceVariation;
          uniform vec3 accentColor;
          uniform float biomeStyle;
          uniform float biomeTime;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float restorationDistance = acos(clamp(dot(
            normalize(vRestorationDirection),
            normalize(restorationOrigin)
          ), -1.0, 1.0)) / PI;
          float restoredSurface = 1.0 - smoothstep(
            restorationProgress - restorationWaveWidth,
            restorationProgress + restorationWaveWidth,
            restorationDistance
          );
          float activeRestorationWave = 1.0 - step(1.001, restorationProgress);
          float restorationBand = 1.0 - smoothstep(
            restorationWaveWidth * 0.35,
            restorationWaveWidth * 2.2,
            abs(restorationDistance - restorationProgress)
          );
          float surfacePattern = sin(vRestorationDirection.x * 17.0)
            * sin(vRestorationDirection.y * 23.0)
            * sin(vRestorationDirection.z * 19.0);
          vec3 variedAliveColor = aliveColor * (1.0 + (surfacePattern * surfaceVariation));
          if (biomeStyle > 0.5 && biomeStyle < 1.5) {
            float rootVeins = 0.5 + (0.5 * sin(
              (vRestorationDirection.x * 11.0)
              + (vRestorationDirection.y * 7.0)
              + (vRestorationDirection.z * 13.0)
              + (biomeTime * 0.18)
            ));
            float canopyMottling = 0.5 + (0.5 * sin(
              (vRestorationDirection.z * 9.0)
              - (vRestorationDirection.x * 8.0)
              + (vRestorationDirection.y * 6.0)
            ));
            variedAliveColor = mix(
              variedAliveColor,
              accentColor,
              (rootVeins * 0.22) + (canopyMottling * 0.16)
            );
          } else if (biomeStyle > 1.5) {
            float tideBands = 0.5 + (0.5 * sin(
              (vRestorationDirection.y * 9.0)
              + (vRestorationDirection.x * 5.0)
              + (biomeTime * 0.9)
            ));
            float tideRipple = 0.5 + (0.5 * sin(
              (vRestorationDirection.x * 12.0)
              - (vRestorationDirection.z * 10.0)
            ));
            variedAliveColor = mix(
              variedAliveColor,
              accentColor,
              (tideBands * 0.28) + (tideRipple * 0.18)
            );
          }
          variedAliveColor = mix(variedAliveColor, accentColor, vLandmarkMask * 0.82);
          float controlLatitude = abs(sin(vRestorationDirection.y * 9.0));
          float controlLongitude = abs(sin(
            atan(vRestorationDirection.z, vRestorationDirection.x) * 6.0
          ));
          float controlGrid = smoothstep(0.94, 0.995, max(
            controlLatitude,
            controlLongitude
          ));
          vec3 occupiedBase = mix(deadColor * 0.48, aliveColor * 0.62, 0.78);
          vec3 occupiedColor = occupiedBase * (0.92 + (surfacePattern * 0.05));
          occupiedColor += vec3(0.1, 0.16, 0.2) * controlGrid;
          float scarSeed = sin(vRestorationDirection.x * 41.0)
            * sin(vRestorationDirection.y * 37.0)
            * sin(vRestorationDirection.z * 43.0);
          float scarGlow = smoothstep(0.955, 0.995, scarSeed)
            * (0.62 + (0.38 * sin((vRestorationDirection.x * 30.0) + (biomeTime * 1.7))));
          vec3 scarColor = vec3(0.58, 0.19, 0.05);
          if (biomeStyle > 0.5 && biomeStyle < 1.5) {
            scarColor = vec3(0.2, 0.4, 0.14);
          } else if (biomeStyle > 1.5) {
            scarColor = vec3(0.14, 0.4, 0.5);
          }
          occupiedColor += scarColor * scarGlow;
          diffuseColor.rgb = mix(occupiedColor, variedAliveColor, restoredSurface);
          diffuseColor.rgb += waveColor * restorationBand * activeRestorationWave * 1.35;`,
        );
    };
    SurfaceMaterial.customProgramCacheKey = () => 'orbitbreak-restoration-surface-v6';

    return { material: SurfaceMaterial, uniforms: RestorationUniforms };
  }

  /**
   * Creates a transparent additive shell that blooms along the active wavefront.
   *
   * @param {object} WorldDefinition - Gameplay and visual definition for the world.
   * @param {object} RestorationUniforms - Uniforms shared with the surface material.
   * @returns {{mesh:THREE.Mesh, material:THREE.ShaderMaterial}} Shell render components.
   */
  function createRestorationWaveShell(WorldDefinition, RestorationUniforms) {
    const WaveMaterial = new THREE.ShaderMaterial({
      uniforms: {
        restorationOrigin: RestorationUniforms.restorationOrigin,
        restorationProgress: RestorationUniforms.restorationProgress,
        restorationWaveWidth: RestorationUniforms.restorationWaveWidth,
        waveColor: RestorationUniforms.waveColor,
      },
      vertexShader: `
        varying vec3 vSurfaceNormal;
        varying vec3 vViewNormal;
        varying vec3 vViewDirection;

        void main() {
          vSurfaceNormal = normalize(normal);
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vViewNormal = normalize(normalMatrix * normal);
          vViewDirection = normalize(-viewPosition.xyz);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vSurfaceNormal;
        varying vec3 vViewNormal;
        varying vec3 vViewDirection;
        uniform vec3 restorationOrigin;
        uniform float restorationProgress;
        uniform float restorationWaveWidth;
        uniform vec3 waveColor;

        void main() {
          float restorationDistance = acos(clamp(dot(
            normalize(vSurfaceNormal),
            normalize(restorationOrigin)
          ), -1.0, 1.0)) / 3.141592653589793;
          float waveBand = 1.0 - smoothstep(
            restorationWaveWidth * 0.85,
            restorationWaveWidth * 3.4,
            abs(restorationDistance - restorationProgress)
          );
          float trailingGlow = 1.0 - smoothstep(
            0.0,
            restorationWaveWidth * 6.5,
            restorationProgress - restorationDistance
          );
          float fresnel = pow(1.0 - max(dot(vViewNormal, vViewDirection), 0.0), 1.65);
          float activeWave = step(-0.001, restorationProgress)
            * (1.0 - step(1.08, restorationProgress));
          float alpha = max(waveBand, trailingGlow * 0.42) * (0.92 + (fresnel * 0.95)) * activeWave;
          gl_FragColor = vec4(waveColor * 1.55, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const WaveGeometry = new THREE.SphereGeometry(
      WorldDefinition.radius * 1.046,
      usesMergedSurfaceLandmarks(WorldDefinition) ? 32 : 64,
      usesMergedSurfaceLandmarks(WorldDefinition) ? 20 : 40,
    );
    const WaveMesh = new THREE.Mesh(WaveGeometry, WaveMaterial);
    WaveMesh.visible = false;
    WaveMesh.renderOrder = 5;

    return { mesh: WaveMesh, material: WaveMaterial };
  }

  /** Records a prop material's authored colour so the restoration wave can reveal it. */
  function registerRestorableMaterial(PropObject, Material, AliveColor = Material.color) {
    if (!PropObject.userData.restorationMaterials) {
      PropObject.userData.restorationMaterials = [];
    }
    PropObject.userData.restorationMaterials.push({
      material: Material,
      aliveColor: AliveColor.clone(),
      aliveEmissive: Material.emissive ? Material.emissive.clone() : null,
      aliveEmissiveIntensity: Material.emissiveIntensity ?? 0,
    });
  }

  /** Applies dead-to-alive colour to every material owned by a surface prop. */
  function setSurfacePropRestorationProgress(PropObject, RestorationProgress) {
    const RestorationMaterials = PropObject.userData.restorationMaterials ?? [];
    for (const RestorationMaterial of RestorationMaterials) {
      RestorationMaterial.material.color.copy(DarkWorldColor).lerp(
        RestorationMaterial.aliveColor,
        RestorationProgress,
      );
      if (RestorationMaterial.aliveEmissive && RestorationMaterial.material.emissive) {
        RestorationMaterial.material.emissive.set(0x000000).lerp(
          RestorationMaterial.aliveEmissive,
          RestorationProgress,
        );
        RestorationMaterial.material.emissiveIntensity = (
          RestorationMaterial.aliveEmissiveIntensity * RestorationProgress
        );
      }
    }
  }

  /** Places a local-Y-up prop against a spherical surface and registers wave metadata. */
  const SurfacePropDioramaScale = 0.24;
  function placeSurfaceProp(
    PropObject,
    SurfaceDirection,
    WorldRadius,
    BaseScale = 1,
    SurfaceOffset = 0,
  ) {
    const NormalizedDirection = SurfaceDirection.clone().normalize();
    const PropScale = BaseScale * SurfacePropDioramaScale;
    PropObject.position.copy(NormalizedDirection).multiplyScalar(WorldRadius + SurfaceOffset);
    PropObject.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), NormalizedDirection);
    PropObject.userData.baseQuaternion = PropObject.quaternion.clone();
    PropObject.scale.setScalar(PropScale);
    PropObject.userData.surfaceDirection = NormalizedDirection;
    PropObject.userData.baseScale = PropScale;
    PropObject.userData.restorationDistance = 1;
    return PropObject;
  }

  /** Creates a compact placeholder prop set for worlds awaiting their authored art pass. */
  function createPlaceholderSurfaceProps(WorldDefinition) {
    const SurfacePropGroup = new THREE.Group();
    const WallColor = WorldDefinition.aliveColor.clone().offsetHSL(0, -0.12, 0.18);
    const RoofColor = WorldDefinition.accentColor.clone();
    const LeafColor = WorldDefinition.aliveColor.clone().offsetHSL(0.08, 0.1, 0.04);

    for (let MarkerIndex = 0; MarkerIndex < 6; MarkerIndex += 1) {
      const MarkerAngle = (MarkerIndex / 6) * Math.PI * 2;
      const MarkerLatitudeOffset = Math.sin(MarkerIndex * 1.7) * 0.38;
      const SurfaceDirection = new THREE.Vector3(
        Math.cos(MarkerAngle) * Math.cos(MarkerLatitudeOffset),
        Math.sin(MarkerAngle) * Math.cos(MarkerLatitudeOffset),
        Math.sin(MarkerLatitudeOffset),
      );
      if (MarkerIndex % 2 === 0) {
        const House = new THREE.Group();
        const WallMaterial = new THREE.MeshStandardMaterial({ color: WallColor, roughness: 0.88 });
        const RoofMaterial = new THREE.MeshStandardMaterial({ color: RoofColor, roughness: 0.8 });
        const Walls = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.36), WallMaterial);
        Walls.position.y = 0.18;
        House.add(Walls);
        const Roof = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.28, 4), RoofMaterial);
        Roof.position.y = 0.46;
        Roof.rotation.y = Math.PI * 0.25;
        House.add(Roof);
        placeSurfaceProp(House, SurfaceDirection, WorldDefinition.radius, 1.15 + ((MarkerIndex % 3) * 0.12), 0.02);
        registerRestorableMaterial(House, WallMaterial);
        registerRestorableMaterial(House, RoofMaterial);
        House.userData.kind = 'cottage';
        SurfacePropGroup.add(House);
      } else {
        const Tree = new THREE.Group();
        const TrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6a4a36, roughness: 0.94 });
        const LeafMaterial = new THREE.MeshStandardMaterial({ color: LeafColor, roughness: 0.86 });
        const Trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.34, 5), TrunkMaterial);
        Trunk.position.y = 0.17;
        Tree.add(Trunk);
        const Canopy = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 6), LeafMaterial);
        Canopy.position.y = 0.46;
        Tree.add(Canopy);
        placeSurfaceProp(Tree, SurfaceDirection, WorldDefinition.radius, 1.2, 0.02);
        registerRestorableMaterial(Tree, TrunkMaterial);
        registerRestorableMaterial(Tree, LeafMaterial);
        Tree.userData.kind = 'tree';
        SurfacePropGroup.add(Tree);
      }
    }

    return SurfacePropGroup;
  }

  /** Adds the custom attributes shared by the restoration and landmark-growth shaders. */
  function addRestorationGeometryAttributes(
    Geometry,
    FixedRestorationDirection = null,
    LandmarkMaskValue = 0,
  ) {
    const PositionAttribute = Geometry.getAttribute('position');
    const RestorationDirections = new Float32Array(PositionAttribute.count * 3);
    const LandmarkMasks = new Float32Array(PositionAttribute.count);

    for (let VertexIndex = 0; VertexIndex < PositionAttribute.count; VertexIndex += 1) {
      const AttributeOffset = VertexIndex * 3;
      if (FixedRestorationDirection) {
        RestorationDirections[AttributeOffset] = FixedRestorationDirection.x;
        RestorationDirections[AttributeOffset + 1] = FixedRestorationDirection.y;
        RestorationDirections[AttributeOffset + 2] = FixedRestorationDirection.z;
      } else {
        TemporaryThreeVector.set(
          PositionAttribute.getX(VertexIndex),
          PositionAttribute.getY(VertexIndex),
          PositionAttribute.getZ(VertexIndex),
        ).normalize();
        RestorationDirections[AttributeOffset] = TemporaryThreeVector.x;
        RestorationDirections[AttributeOffset + 1] = TemporaryThreeVector.y;
        RestorationDirections[AttributeOffset + 2] = TemporaryThreeVector.z;
      }
      LandmarkMasks[VertexIndex] = LandmarkMaskValue;
    }

    Geometry.setAttribute(
      'restorationDirection',
      new THREE.BufferAttribute(RestorationDirections, 3),
    );
    Geometry.setAttribute('landmarkMask', new THREE.BufferAttribute(LandmarkMasks, 1));
    return Geometry;
  }

  /** Places one geometry on a spherical surface before it enters a merged one-call landmark. */
  const MergedLandmarkDioramaScale = 0.26;
  function createPlacedLandmarkGeometry(
    SourceGeometry,
    SurfaceDirection,
    WorldRadius,
    Scale = 1,
    TangentRotationRadians = 0,
  ) {
    const LandmarkGeometry = SourceGeometry.index
      ? SourceGeometry.toNonIndexed()
      : SourceGeometry.clone();
    const NormalizedDirection = SurfaceDirection.clone().normalize();
    const Placement = new THREE.Object3D();
    Placement.position.copy(NormalizedDirection).multiplyScalar(WorldRadius);
    Placement.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), NormalizedDirection);
    Placement.rotateY(TangentRotationRadians);
    Placement.scale.setScalar(Scale * MergedLandmarkDioramaScale);
    Placement.updateMatrix();
    LandmarkGeometry.applyMatrix4(Placement.matrix);
    addRestorationGeometryAttributes(LandmarkGeometry, NormalizedDirection, 1);
    return LandmarkGeometry;
  }

  /** Places a readable front-facing silhouette into the rotating one-call surface mesh. */
  function createFrontLandmarkGeometry(
    SourceGeometry,
    WorldRadius,
    OffsetX = 0,
    OffsetY = 0,
    Scale = 1,
    RotationRadians = 0,
    SurfaceYawRadians = 0,
  ) {
    const LandmarkGeometry = SourceGeometry.index
      ? SourceGeometry.toNonIndexed()
      : SourceGeometry.clone();
    const Placement = new THREE.Object3D();
    Placement.position.set(OffsetX, OffsetY, WorldRadius);
    Placement.rotation.z = RotationRadians;
    Placement.scale.setScalar(Scale * MergedLandmarkDioramaScale);
    Placement.updateMatrix();
    LandmarkGeometry.applyMatrix4(Placement.matrix);
    LandmarkGeometry.rotateY(SurfaceYawRadians);
    addRestorationGeometryAttributes(
      LandmarkGeometry,
      new THREE.Vector3(Math.sin(SurfaceYawRadians), 0, Math.cos(SurfaceYawRadians)),
      1,
    );
    return LandmarkGeometry;
  }

  /** Merges compatible non-indexed geometries into one surface draw call. */
  function mergeRestorationGeometries(Geometries) {
    const AttributeNames = ['position', 'normal', 'restorationDirection', 'landmarkMask'];
    const MergedGeometry = new THREE.BufferGeometry();

    for (const AttributeName of AttributeNames) {
      const ItemSize = Geometries[0].getAttribute(AttributeName).itemSize;
      const TotalValueCount = Geometries.reduce(
        (ValueCount, Geometry) => ValueCount + Geometry.getAttribute(AttributeName).array.length,
        0,
      );
      const MergedValues = new Float32Array(TotalValueCount);
      let ValueOffset = 0;
      for (const Geometry of Geometries) {
        const SourceValues = Geometry.getAttribute(AttributeName).array;
        MergedValues.set(SourceValues, ValueOffset);
        ValueOffset += SourceValues.length;
      }
      MergedGeometry.setAttribute(AttributeName, new THREE.BufferAttribute(MergedValues, ItemSize));
    }

    MergedGeometry.computeBoundingSphere();
    for (const Geometry of Geometries) {
      Geometry.dispose();
    }
    return MergedGeometry;
  }

  /** Starts one lightweight authored world with a faceted restorable sphere. */
  function createMergedWorldSurfaceBase(WorldDefinition) {
    const BaseSourceGeometry = new THREE.IcosahedronGeometry(WorldDefinition.radius, 4);
    const BaseGeometry = BaseSourceGeometry.index
      ? BaseSourceGeometry.toNonIndexed()
      : BaseSourceGeometry.clone();
    BaseSourceGeometry.dispose();
    addRestorationGeometryAttributes(BaseGeometry);
    return [BaseGeometry];
  }

  /** Builds Relay's three fractured signal rings into its surface draw call. */
  function createRelaySurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const RingSource = new THREE.TorusGeometry(
      WorldDefinition.radius * 1.06,
      0.095,
      5,
      42,
    );
    const RingRotations = [
      { x: 0.08, y: 0.18 },
      { x: 1.03, y: -0.34 },
      { x: -0.82, y: 0.7 },
    ];
    for (const RingRotation of RingRotations) {
      const RingGeometry = RingSource.index
        ? RingSource.toNonIndexed()
        : RingSource.clone();
      RingGeometry.rotateX(RingRotation.x);
      RingGeometry.rotateY(RingRotation.y);
      addRestorationGeometryAttributes(RingGeometry, null, 1);
      Geometries.push(RingGeometry);
    }
    RingSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Kiln's crown of dormant exhaust stacks into its surface draw call. */
  function createKilnSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const VentSource = new THREE.ConeGeometry(0.28, 1.15, 6, 1, true);
    VentSource.translate(0, 0.575, 0);
    const VentDirections = [
      new THREE.Vector3(-0.58, 0.2, 0.82),
      new THREE.Vector3(-0.18, 0.54, 0.84),
      new THREE.Vector3(0.28, 0.48, 0.86),
      new THREE.Vector3(0.62, 0.08, 0.8),
      new THREE.Vector3(0.12, -0.46, 0.9),
    ];
    VentDirections.forEach((VentDirection, VentIndex) => {
      Geometries.push(createPlacedLandmarkGeometry(
        VentSource,
        VentDirection,
        WorldDefinition.radius - 0.04,
        0.85 + ((VentIndex % 3) * 0.13),
        VentIndex * 0.53,
      ));
    });
    VentSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Loom's linked route arches around the world in one draw call. */
  function createLoomSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const ArchSource = new THREE.TorusGeometry(0.7, 0.11, 5, 20, Math.PI);
    const ArchYaws = [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5];
    for (const ArchYaw of ArchYaws) {
      Geometries.push(createFrontLandmarkGeometry(
        ArchSource,
        WorldDefinition.radius + 0.08,
        -0.26,
        -0.04,
        0.92,
        -0.12,
        ArchYaw,
      ));
      Geometries.push(createFrontLandmarkGeometry(
        ArchSource,
        WorldDefinition.radius + 0.08,
        0.26,
        -0.04,
        0.92,
        0.12,
        ArchYaw,
      ));
    }
    ArchSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Shard's asymmetric crystal crown into its surface draw call. */
  function createShardSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const CrystalSource = new THREE.ConeGeometry(0.34, 1.45, 5);
    CrystalSource.translate(0, 0.725, 0);
    const CrystalDirections = [
      new THREE.Vector3(-0.5, 0.42, 0.82),
      new THREE.Vector3(-0.1, 0.68, 0.76),
      new THREE.Vector3(0.32, 0.52, 0.82),
      new THREE.Vector3(0.58, 0.05, 0.84),
      new THREE.Vector3(-0.18, -0.42, 0.9),
      new THREE.Vector3(0.38, -0.35, 0.88),
    ];
    CrystalDirections.forEach((CrystalDirection, CrystalIndex) => {
      Geometries.push(createPlacedLandmarkGeometry(
        CrystalSource,
        CrystalDirection,
        WorldDefinition.radius - 0.06,
        0.72 + ((CrystalIndex % 4) * 0.18),
        CrystalIndex * 0.64,
      ));
    });
    CrystalSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Vault's protective ribs around its memory core in one draw call. */
  function createVaultSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const RibSource = new THREE.TorusGeometry(0.82, 0.1, 5, 24, Math.PI);
    const RibYaws = [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5];
    RibYaws.forEach((RibYaw, RibIndex) => {
      Geometries.push(createFrontLandmarkGeometry(
        RibSource,
        WorldDefinition.radius + 0.1,
        0,
        -0.08,
        0.92 + ((RibIndex % 2) * 0.08),
        (RibIndex % 2 === 0 ? -1 : 1) * 0.14,
        RibYaw,
      ));
    });
    RibSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Grove's joined-root arch, moss mounds and clustered saplings into its surface call. */
  function createGroveSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);

    const RootArchSource = new THREE.TorusGeometry(0.92, 0.14, 5, 20, Math.PI);
    Geometries.push(createFrontLandmarkGeometry(
      RootArchSource,
      WorldDefinition.radius - 0.04,
      0,
      -0.12,
      1,
      -0.08,
    ));

    const MossSource = new THREE.SphereGeometry(0.28, 7, 5);
    const MossDirections = [
      new THREE.Vector3(-0.82, 0.22, 0.52),
      new THREE.Vector3(0.76, -0.18, 0.62),
      new THREE.Vector3(0.12, 0.74, -0.66),
      new THREE.Vector3(-0.28, -0.62, -0.72),
    ];
    MossDirections.forEach((SurfaceDirection, MossIndex) => {
      Geometries.push(createPlacedLandmarkGeometry(
        MossSource,
        SurfaceDirection,
        WorldDefinition.radius - 0.06,
        0.72 + (MossIndex * 0.08),
        MossIndex * 0.4,
      ));
    });

    const TrunkSource = new THREE.CylinderGeometry(0.085, 0.13, 0.68, 6);
    TrunkSource.translate(0, 0.34, 0);
    const CanopySource = new THREE.IcosahedronGeometry(0.34, 1);
    CanopySource.translate(0, 0.82, 0);
    const SaplingDirections = [
      new THREE.Vector3(-0.45, 0.1, 0.9),
      new THREE.Vector3(0.42, 0.16, 0.9),
      new THREE.Vector3(0, -0.38, 0.92),
      new THREE.Vector3(-0.38, 0.22, -0.9),
      new THREE.Vector3(0.48, -0.12, -0.86),
    ];
    SaplingDirections.forEach((SurfaceDirection, SaplingIndex) => {
      const SaplingScale = 0.82 + (SaplingIndex * 0.09);
      Geometries.push(createPlacedLandmarkGeometry(
        TrunkSource,
        SurfaceDirection,
        WorldDefinition.radius,
        SaplingScale,
        SaplingIndex * 0.7,
      ));
      Geometries.push(createPlacedLandmarkGeometry(
        CanopySource,
        SurfaceDirection,
        WorldDefinition.radius,
        SaplingScale,
        SaplingIndex * 0.7,
      ));
    });

    RootArchSource.dispose();
    MossSource.dispose();
    TrunkSource.dispose();
    CanopySource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Tide's three repeating wave crests into its existing surface call. */
  function createTideSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const WaveCrestSource = new THREE.TorusGeometry(0.75, 0.16, 5, 18, Math.PI);
    const WaveCrestRows = [
      { y: 0.52, scale: 0.7, rotation: 0.08 },
      { y: 0, scale: 0.86, rotation: 0 },
      { y: -0.52, scale: 0.72, rotation: -0.08 },
    ];
    const WaveClusterYaws = [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5];
    WaveClusterYaws.forEach((WaveClusterYaw) => {
      WaveCrestRows.forEach((WaveCrestRow) => {
        Geometries.push(createFrontLandmarkGeometry(
          WaveCrestSource,
          WorldDefinition.radius + 0.18,
          0,
          WaveCrestRow.y,
          WaveCrestRow.scale,
          WaveCrestRow.rotation,
          WaveClusterYaw,
        ));
      });
    });
    WaveCrestSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Bower's sheltering vine arches into one restorable silhouette. */
  function createBowerSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const ArchSource = new THREE.TorusGeometry(0.92, 0.13, 5, 20, Math.PI);
    [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5].forEach((ArchYaw, ArchIndex) => {
      Geometries.push(createFrontLandmarkGeometry(
        ArchSource,
        WorldDefinition.radius + 0.08,
        0,
        -0.18,
        0.92 + ((ArchIndex % 2) * 0.12),
        ArchIndex % 2 === 0 ? -0.12 : 0.12,
        ArchYaw,
      ));
    });
    ArchSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Lantern's upward flower lamps into its existing surface call. */
  function createLanternSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const LampSource = new THREE.ConeGeometry(0.4, 1.25, 7, 1, true);
    LampSource.translate(0, 0.625, 0);
    const LampDirections = [
      new THREE.Vector3(-0.52, 0.26, 0.84),
      new THREE.Vector3(-0.12, 0.58, 0.82),
      new THREE.Vector3(0.34, 0.48, 0.84),
      new THREE.Vector3(0.6, 0.04, 0.82),
      new THREE.Vector3(0.08, -0.48, 0.9),
    ];
    LampDirections.forEach((LampDirection, LampIndex) => {
      Geometries.push(createPlacedLandmarkGeometry(
        LampSource,
        LampDirection,
        WorldDefinition.radius - 0.06,
        0.78 + ((LampIndex % 3) * 0.13),
        LampIndex * 0.72,
      ));
    });
    LampSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Canopy's clustered treetops as a single low-cost world mesh. */
  function createCanopySurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const TrunkSource = new THREE.CylinderGeometry(0.08, 0.15, 0.72, 6);
    TrunkSource.translate(0, 0.36, 0);
    const CrownSource = new THREE.IcosahedronGeometry(0.42, 1);
    CrownSource.translate(0, 0.86, 0);
    const TreeDirections = [
      new THREE.Vector3(-0.52, 0.24, 0.84),
      new THREE.Vector3(-0.08, 0.62, 0.8),
      new THREE.Vector3(0.44, 0.38, 0.84),
      new THREE.Vector3(0.28, -0.38, 0.9),
      new THREE.Vector3(-0.36, -0.34, 0.88),
    ];
    TreeDirections.forEach((TreeDirection, TreeIndex) => {
      const TreeScale = 0.82 + ((TreeIndex % 3) * 0.13);
      Geometries.push(createPlacedLandmarkGeometry(
        TrunkSource, TreeDirection, WorldDefinition.radius, TreeScale, TreeIndex * 0.6,
      ));
      Geometries.push(createPlacedLandmarkGeometry(
        CrownSource, TreeDirection, WorldDefinition.radius, TreeScale, TreeIndex * 0.6,
      ));
    });
    TrunkSource.dispose();
    CrownSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Crown's ring of oversized petals around a dark central bloom. */
  function createCrownSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const PetalSource = new THREE.IcosahedronGeometry(0.48, 1);
    PetalSource.scale(0.62, 1.45, 0.8);
    PetalSource.translate(0, 0.62, 0);
    const PetalDirections = [
      new THREE.Vector3(-0.58, 0.3, 0.8),
      new THREE.Vector3(-0.18, 0.64, 0.78),
      new THREE.Vector3(0.28, 0.58, 0.8),
      new THREE.Vector3(0.62, 0.16, 0.8),
      new THREE.Vector3(0.42, -0.38, 0.84),
      new THREE.Vector3(-0.12, -0.52, 0.88),
      new THREE.Vector3(-0.54, -0.22, 0.84),
    ];
    PetalDirections.forEach((PetalDirection, PetalIndex) => {
      Geometries.push(createPlacedLandmarkGeometry(
        PetalSource,
        PetalDirection,
        WorldDefinition.radius - 0.08,
        0.8 + ((PetalIndex % 2) * 0.12),
        PetalIndex * 0.84,
      ));
    });
    PetalSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Dew's crystalline droplets into a clean, cool silhouette. */
  function createDewSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const DropSource = new THREE.ConeGeometry(0.3, 1.05, 7);
    DropSource.translate(0, 0.525, 0);
    const DropDirections = [
      new THREE.Vector3(-0.5, 0.4, 0.82),
      new THREE.Vector3(0, 0.68, 0.76),
      new THREE.Vector3(0.48, 0.38, 0.82),
      new THREE.Vector3(0.5, -0.28, 0.84),
      new THREE.Vector3(-0.12, -0.5, 0.88),
    ];
    DropDirections.forEach((DropDirection, DropIndex) => {
      Geometries.push(createPlacedLandmarkGeometry(
        DropSource,
        DropDirection,
        WorldDefinition.radius - 0.04,
        0.72 + ((DropIndex % 3) * 0.16),
        DropIndex * 0.66,
      ));
    });
    DropSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Nest's woven protective ribs around its small resting place. */
  function createNestSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const RibSource = new THREE.TorusGeometry(0.78, 0.09, 5, 22, Math.PI * 1.25);
    [0, 0.74, 1.48, 2.22].forEach((RibRotation, RibIndex) => {
      Geometries.push(createFrontLandmarkGeometry(
        RibSource,
        WorldDefinition.radius + 0.1,
        0,
        -0.12,
        0.9 + ((RibIndex % 2) * 0.1),
        RibRotation * 0.16,
        RibRotation,
      ));
    });
    RibSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Vigil's ring of stubborn watchtowers into one restorable surface. */
  function createVigilSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const TowerSource = new THREE.CylinderGeometry(0.18, 0.28, 0.92, 6);
    TowerSource.translate(0, 0.46, 0);
    const FlameSource = new THREE.ConeGeometry(0.18, 0.48, 6);
    FlameSource.translate(0, 1.03, 0);
    const TowerDirections = [
      new THREE.Vector3(-0.56, 0.3, 0.8),
      new THREE.Vector3(-0.12, 0.62, 0.8),
      new THREE.Vector3(0.42, 0.46, 0.82),
      new THREE.Vector3(0.58, -0.12, 0.84),
      new THREE.Vector3(0.08, -0.5, 0.88),
      new THREE.Vector3(-0.44, -0.3, 0.88),
    ];
    TowerDirections.forEach((TowerDirection, TowerIndex) => {
      const TowerScale = 0.82 + ((TowerIndex % 3) * 0.12);
      Geometries.push(createPlacedLandmarkGeometry(
        TowerSource, TowerDirection, WorldDefinition.radius, TowerScale, TowerIndex * 0.58,
      ));
      Geometries.push(createPlacedLandmarkGeometry(
        FlameSource, TowerDirection, WorldDefinition.radius, TowerScale, TowerIndex * 0.58,
      ));
    });
    TowerSource.dispose();
    FlameSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Pyre's swept flame crown as a single low-cost silhouette. */
  function createPyreSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const FlameSource = new THREE.ConeGeometry(0.34, 1.42, 6);
    FlameSource.translate(0, 0.71, 0);
    FlameSource.rotateZ(-0.14);
    const FlameDirections = [
      new THREE.Vector3(-0.52, 0.36, 0.82),
      new THREE.Vector3(-0.12, 0.66, 0.78),
      new THREE.Vector3(0.34, 0.54, 0.8),
      new THREE.Vector3(0.62, 0.08, 0.82),
      new THREE.Vector3(0.3, -0.42, 0.88),
      new THREE.Vector3(-0.3, -0.42, 0.88),
    ];
    FlameDirections.forEach((FlameDirection, FlameIndex) => {
      Geometries.push(createPlacedLandmarkGeometry(
        FlameSource,
        FlameDirection,
        WorldDefinition.radius - 0.05,
        0.76 + ((FlameIndex % 3) * 0.16),
        FlameIndex * 0.7,
      ));
    });
    FlameSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Hollow's empty bell arches around its quiet surface. */
  function createHollowSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const BellSource = new THREE.ConeGeometry(0.42, 0.68, 8, 1, true);
    BellSource.translate(0, 0.4, 0);
    const ArchSource = new THREE.TorusGeometry(0.62, 0.09, 5, 18, Math.PI);
    const BellYaws = [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5];
    BellYaws.forEach((BellYaw, BellIndex) => {
      Geometries.push(createFrontLandmarkGeometry(
        ArchSource,
        WorldDefinition.radius + 0.06,
        0,
        -0.12,
        0.88,
        BellIndex % 2 === 0 ? -0.08 : 0.08,
        BellYaw,
      ));
      Geometries.push(createFrontLandmarkGeometry(
        BellSource,
        WorldDefinition.radius + 0.08,
        0,
        0.18,
        0.82,
        Math.PI,
        BellYaw,
      ));
    });
    BellSource.dispose();
    ArchSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Beacon's radial star fins into its planet-wrapping restoration surface. */
  function createBeaconSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const RaySource = new THREE.ConeGeometry(0.24, 1.62, 5);
    RaySource.translate(0, 0.81, 0);
    const RayDirections = [
      new THREE.Vector3(-0.62, 0.22, 0.78),
      new THREE.Vector3(-0.32, 0.58, 0.78),
      new THREE.Vector3(0.12, 0.68, 0.76),
      new THREE.Vector3(0.5, 0.42, 0.8),
      new THREE.Vector3(0.64, -0.06, 0.8),
      new THREE.Vector3(0.34, -0.48, 0.84),
      new THREE.Vector3(-0.1, -0.56, 0.86),
      new THREE.Vector3(-0.52, -0.3, 0.82),
    ];
    RayDirections.forEach((RayDirection, RayIndex) => {
      Geometries.push(createPlacedLandmarkGeometry(
        RaySource,
        RayDirection,
        WorldDefinition.radius - 0.1,
        0.8 + ((RayIndex % 2) * 0.16),
        RayIndex * 0.72,
      ));
    });
    RaySource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Umbra's offset crescent ribs as a readable shadow-world silhouette. */
  function createUmbraSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const CrescentSource = new THREE.TorusGeometry(0.82, 0.12, 5, 22, Math.PI * 1.35);
    [0, Math.PI * 0.66, Math.PI * 1.32].forEach((CrescentYaw, CrescentIndex) => {
      Geometries.push(createFrontLandmarkGeometry(
        CrescentSource,
        WorldDefinition.radius + 0.1,
        -0.16,
        -0.08,
        0.94 + (CrescentIndex * 0.05),
        -0.34 + (CrescentIndex * 0.22),
        CrescentYaw,
      ));
    });
    CrescentSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Builds Lumen's compact star prism and protective halo in one draw call. */
  function createLumenSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const PrismSource = new THREE.OctahedronGeometry(0.58, 0);
    PrismSource.scale(0.72, 1.5, 0.72);
    PrismSource.translate(0, 0.72, 0);
    const HaloSource = new THREE.TorusGeometry(0.72, 0.08, 5, 22);
    const PrismDirections = [
      new THREE.Vector3(-0.42, 0.34, 0.88),
      new THREE.Vector3(0.38, 0.38, 0.88),
      new THREE.Vector3(0, -0.42, 0.92),
    ];
    PrismDirections.forEach((PrismDirection, PrismIndex) => {
      Geometries.push(createPlacedLandmarkGeometry(
        PrismSource,
        PrismDirection,
        WorldDefinition.radius - 0.04,
        0.78 + (PrismIndex * 0.1),
        PrismIndex * 0.8,
      ));
    });
    Geometries.push(createFrontLandmarkGeometry(
      HaloSource, WorldDefinition.radius + 0.16, 0, 0, 0.92, 0.18,
    ));
    PrismSource.dispose();
    HaloSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Braids restored route arches into the finale's starting confluence. */
  function createConfluenceSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const ArchSource = new THREE.TorusGeometry(0.88, 0.11, 5, 22, Math.PI * 1.35);
    [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].forEach((ArchYaw, ArchIndex) => {
      Geometries.push(createFrontLandmarkGeometry(
        ArchSource,
        WorldDefinition.radius + 0.1,
        ArchIndex % 2 === 0 ? -0.18 : 0.18,
        -0.06,
        0.92 + ((ArchIndex % 2) * 0.08),
        ArchIndex % 2 === 0 ? -0.22 : 0.22,
        ArchYaw,
      ));
    });
    ArchSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Encircles a familiar flame crown with the Belt's remembered signal ring. */
  function createKindleSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const FlameSource = new THREE.ConeGeometry(0.32, 1.36, 6);
    FlameSource.translate(0, 0.68, 0);
    const HaloSource = new THREE.TorusGeometry(WorldDefinition.radius * 1.06, 0.08, 5, 38);
    const FlameDirections = [
      new THREE.Vector3(-0.5, 0.34, 0.82), new THREE.Vector3(0, 0.66, 0.78),
      new THREE.Vector3(0.5, 0.34, 0.82), new THREE.Vector3(0.38, -0.38, 0.88),
      new THREE.Vector3(-0.38, -0.38, 0.88),
    ];
    FlameDirections.forEach((Direction, Index) => Geometries.push(
      createPlacedLandmarkGeometry(
        FlameSource, Direction, WorldDefinition.radius - 0.05, 0.8 + ((Index % 2) * 0.15), Index * 0.7,
      ),
    ));
    const HaloGeometry = HaloSource.index ? HaloSource.toNonIndexed() : HaloSource.clone();
    HaloGeometry.rotateX(0.82);
    addRestorationGeometryAttributes(HaloGeometry, null, 1);
    Geometries.push(HaloGeometry);
    FlameSource.dispose();
    HaloSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Joins sheltering roots and bell arches into a world made from shared memories. */
  function createMemorySurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const ArchSource = new THREE.TorusGeometry(0.7, 0.1, 5, 20, Math.PI);
    const LeafSource = new THREE.IcosahedronGeometry(0.28, 1);
    LeafSource.scale(0.72, 1.45, 0.8);
    LeafSource.translate(0, 0.64, 0);
    [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5].forEach((Yaw, Index) => {
      Geometries.push(createFrontLandmarkGeometry(
        ArchSource, WorldDefinition.radius + 0.08, 0, -0.12, 0.9, Index % 2 ? 0.1 : -0.1, Yaw,
      ));
      Geometries.push(createFrontLandmarkGeometry(
        LeafSource, WorldDefinition.radius + 0.06, 0, 0.18, 0.78, Index * 0.45, Yaw,
      ));
    });
    ArchSource.dispose();
    LeafSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Wraps the finale's strongest gravity well in routes and radial star fins. */
  function createStarwellSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const RingSource = new THREE.TorusGeometry(WorldDefinition.radius * 1.055, 0.075, 5, 46);
    [
      { x: 0.2, y: 0.35 }, { x: 1.08, y: -0.28 }, { x: -0.84, y: 0.72 },
    ].forEach((Rotation) => {
      const RingGeometry = RingSource.index ? RingSource.toNonIndexed() : RingSource.clone();
      RingGeometry.rotateX(Rotation.x);
      RingGeometry.rotateY(Rotation.y);
      addRestorationGeometryAttributes(RingGeometry, null, 1);
      Geometries.push(RingGeometry);
    });
    const RaySource = new THREE.ConeGeometry(0.2, 1.45, 5);
    RaySource.translate(0, 0.725, 0);
    [
      new THREE.Vector3(-0.55, 0.42, 0.76), new THREE.Vector3(0, 0.68, 0.74),
      new THREE.Vector3(0.55, 0.42, 0.76), new THREE.Vector3(0.45, -0.38, 0.82),
      new THREE.Vector3(-0.45, -0.38, 0.82),
    ].forEach((Direction, Index) => Geometries.push(createPlacedLandmarkGeometry(
      RaySource, Direction, WorldDefinition.radius - 0.08, 0.82 + ((Index % 2) * 0.12), Index * 0.8,
    )));
    RingSource.dispose();
    RaySource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Opens flower petals into long dawn rays around the finale's far world. */
  function createDawnSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const PetalSource = new THREE.IcosahedronGeometry(0.4, 1);
    PetalSource.scale(0.58, 1.5, 0.76);
    PetalSource.translate(0, 0.58, 0);
    const Directions = [
      new THREE.Vector3(-0.6, 0.28, 0.78), new THREE.Vector3(-0.2, 0.64, 0.76),
      new THREE.Vector3(0.32, 0.56, 0.78), new THREE.Vector3(0.62, 0.08, 0.8),
      new THREE.Vector3(0.34, -0.44, 0.84), new THREE.Vector3(-0.28, -0.48, 0.84),
    ];
    Directions.forEach((Direction, Index) => Geometries.push(createPlacedLandmarkGeometry(
      PetalSource, Direction, WorldDefinition.radius - 0.06, 0.82 + ((Index % 2) * 0.16), Index * 0.74,
    )));
    PetalSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Suspends three memory prisms inside a single resonant halo. */
  function createChorusSurfaceGeometry(WorldDefinition) {
    const Geometries = createMergedWorldSurfaceBase(WorldDefinition);
    const PrismSource = new THREE.OctahedronGeometry(0.48, 0);
    PrismSource.scale(0.68, 1.45, 0.68);
    PrismSource.translate(0, 0.62, 0);
    const HaloSource = new THREE.TorusGeometry(0.76, 0.08, 5, 24);
    [
      new THREE.Vector3(-0.4, 0.32, 0.88),
      new THREE.Vector3(0.38, 0.36, 0.88),
      new THREE.Vector3(0, -0.42, 0.92),
    ].forEach((Direction, Index) => Geometries.push(createPlacedLandmarkGeometry(
      PrismSource, Direction, WorldDefinition.radius - 0.04, 0.82 + (Index * 0.08), Index * 0.82,
    )));
    Geometries.push(createFrontLandmarkGeometry(
      HaloSource, WorldDefinition.radius + 0.15, 0, 0, 0.95, -0.16,
    ));
    PrismSource.dispose();
    HaloSource.dispose();
    return mergeRestorationGeometries(Geometries);
  }

  /** Selects one-call authored geometry for lightweight route worlds. */
  function createMergedSurfaceGeometry(WorldDefinition) {
    const MergedGeometryFactories = {
      grove: createGroveSurfaceGeometry,
      tide: createTideSurfaceGeometry,
      relay: createRelaySurfaceGeometry,
      kiln: createKilnSurfaceGeometry,
      loom: createLoomSurfaceGeometry,
      shard: createShardSurfaceGeometry,
      drift: createTideSurfaceGeometry,
      vault: createVaultSurfaceGeometry,
      bower: createBowerSurfaceGeometry,
      lantern: createLanternSurfaceGeometry,
      canopy: createCanopySurfaceGeometry,
      crown: createCrownSurfaceGeometry,
      dew: createDewSurfaceGeometry,
      nest: createNestSurfaceGeometry,
      vigil: createVigilSurfaceGeometry,
      pyre: createPyreSurfaceGeometry,
      hollow: createHollowSurfaceGeometry,
      beacon: createBeaconSurfaceGeometry,
      umbra: createUmbraSurfaceGeometry,
      lumen: createLumenSurfaceGeometry,
      confluence: createConfluenceSurfaceGeometry,
      kindle: createKindleSurfaceGeometry,
      memory: createMemorySurfaceGeometry,
      starwell: createStarwellSurfaceGeometry,
      dawn: createDawnSurfaceGeometry,
      chorus: createChorusSurfaceGeometry,
    };
    return (
      MergedGeometryFactories[WorldDefinition.visualKey]
      ?? ((Definition) => addRestorationGeometryAttributes(
        new THREE.IcosahedronGeometry(Definition.radius, 4),
      ))
    )(WorldDefinition);
  }

  /** Distinguishes low-cost merged landmark worlds from full multi-mesh dioramas. */
  function usesMergedSurfaceLandmarks(WorldDefinition) {
    return WorldDefinition.usesMergedSurfaceLandmarks === true
      || WorldDefinition.isPrototypeWorld === true;
  }

  /** Creates Meadow's authored low-poly cottage landmark. */
  function createMeadowCottage(WorldDefinition, SurfaceDirection) {
    const Cottage = new THREE.Group();
    const WallMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2dfad,
      roughness: 0.9,
    });
    const RoofMaterial = new THREE.MeshStandardMaterial({
      color: 0xb65446,
      roughness: 0.86,
    });
    const DoorMaterial = new THREE.MeshStandardMaterial({
      color: 0x503a31,
      roughness: 0.94,
    });
    const WindowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe9a3,
      emissive: 0xffbd62,
      emissiveIntensity: 0.75,
      roughness: 0.4,
    });

    const Walls = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.62, 0.72), WallMaterial);
    Walls.position.y = 0.37;
    Cottage.add(Walls);

    const Roof = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.52, 4), RoofMaterial);
    Roof.position.y = 0.92;
    Roof.rotation.y = Math.PI * 0.25;
    Cottage.add(Roof);

    const Chimney = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), DoorMaterial);
    Chimney.position.set(0.22, 1.02, -0.08);
    Cottage.add(Chimney);

    const Door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.38, 0.05), DoorMaterial);
    Door.position.set(0, 0.24, 0.38);
    Cottage.add(Door);

    const WindowGeometry = new THREE.BoxGeometry(0.2, 0.18, 0.04);
    const WindowPlacements = [
      [-0.26, 0.46, 0.385],
      [0.26, 0.46, 0.385],
      [-0.26, 0.46, -0.385],
      [0.26, 0.46, -0.385],
    ];
    for (const [WindowX, WindowY, WindowZ] of WindowPlacements) {
      const WindowMesh = new THREE.Mesh(WindowGeometry, WindowMaterial);
      WindowMesh.position.set(WindowX, WindowY, WindowZ);
      Cottage.add(WindowMesh);
    }
    const SideWindowGeometry = new THREE.BoxGeometry(0.04, 0.18, 0.18);
    for (const Side of [-1, 1]) {
      const SideWindow = new THREE.Mesh(SideWindowGeometry, WindowMaterial);
      SideWindow.position.set(Side * 0.45, 0.46, 0);
      Cottage.add(SideWindow);
    }

    const Porch = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.18), DoorMaterial);
    Porch.position.set(0, 0.05, 0.42);
    Cottage.add(Porch);

    placeSurfaceProp(Cottage, SurfaceDirection, WorldDefinition.radius, 1.12, 0.02);
    registerRestorableMaterial(Cottage, WallMaterial);
    registerRestorableMaterial(Cottage, RoofMaterial);
    registerRestorableMaterial(Cottage, DoorMaterial);
    registerRestorableMaterial(Cottage, WindowMaterial);
    Cottage.userData.kind = 'cottage';
    Cottage.userData.windowMaterial = WindowMaterial;
    return Cottage;
  }

  /** Creates one rounded toy-like Meadow tree. */
  function createMeadowTree(WorldDefinition, SurfaceDirection, Scale, Phase) {
    const Tree = new THREE.Group();
    const TrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x765139, roughness: 0.96 });
    const LeafMaterial = new THREE.MeshStandardMaterial({ color: 0x76b85d, roughness: 0.88 });
    const Trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.72, 6), TrunkMaterial);
    Trunk.position.y = 0.36;
    Tree.add(Trunk);

    const LowerCanopy = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.48, 7), LeafMaterial);
    LowerCanopy.position.y = 0.78;
    Tree.add(LowerCanopy);
    const UpperCanopy = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.36, 7), LeafMaterial);
    UpperCanopy.position.y = 1.08;
    Tree.add(UpperCanopy);

    placeSurfaceProp(Tree, SurfaceDirection, WorldDefinition.radius, Scale, 0.02);
    registerRestorableMaterial(Tree, TrunkMaterial);
    registerRestorableMaterial(Tree, LeafMaterial);
    Tree.userData.kind = 'tree';
    Tree.userData.swayPhase = Phase;
    Tree.userData.swayAmount = 0.035;
    return Tree;
  }

  /** Creates a small readable cluster of flowers. */
  function createMeadowFlowers(WorldDefinition, SurfaceDirection, FlowerColor, Phase) {
    const FlowerCluster = new THREE.Group();
    const StemMaterial = new THREE.MeshStandardMaterial({ color: 0x528f4c, roughness: 0.95 });
    const PetalMaterial = new THREE.MeshStandardMaterial({ color: FlowerColor, roughness: 0.8 });
    const CentreMaterial = new THREE.MeshStandardMaterial({
      color: 0xffda68,
      emissive: 0x7a4b12,
      emissiveIntensity: 0.28,
      roughness: 0.82,
    });

    for (let FlowerIndex = 0; FlowerIndex < 3; FlowerIndex += 1) {
      const FlowerX = (FlowerIndex - 1) * 0.15;
      const FlowerHeight = 0.25 + ((FlowerIndex % 2) * 0.08);
      const Stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.025, FlowerHeight, 5),
        StemMaterial,
      );
      Stem.position.set(FlowerX, FlowerHeight * 0.5, (FlowerIndex % 2) * 0.05);
      FlowerCluster.add(Stem);

      const FlowerHead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 1), PetalMaterial);
      FlowerHead.position.set(FlowerX, FlowerHeight, (FlowerIndex % 2) * 0.05);
      FlowerCluster.add(FlowerHead);

      const FlowerCentre = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), CentreMaterial);
      FlowerCentre.position.set(FlowerX, FlowerHeight + 0.012, 0.075 + ((FlowerIndex % 2) * 0.05));
      FlowerCluster.add(FlowerCentre);
    }

    placeSurfaceProp(FlowerCluster, SurfaceDirection, WorldDefinition.radius, 1, 0.025);
    registerRestorableMaterial(FlowerCluster, StemMaterial);
    registerRestorableMaterial(FlowerCluster, PetalMaterial);
    registerRestorableMaterial(FlowerCluster, CentreMaterial);
    FlowerCluster.userData.kind = 'flowers';
    FlowerCluster.userData.swayPhase = Phase;
    FlowerCluster.userData.swayAmount = 0.055;
    return FlowerCluster;
  }

  /** Creates a curved-surface grass tuft from three exaggerated blades. */
  function createMeadowGrass(WorldDefinition, SurfaceDirection, Scale, Phase) {
    const Grass = new THREE.Group();
    const GrassMaterial = new THREE.MeshStandardMaterial({ color: 0x9acc68, roughness: 0.96 });
    const BladeSourceGeometry = new THREE.ConeGeometry(0.045, 0.34, 4);
    const BladeGeometries = [];

    for (let BladeIndex = 0; BladeIndex < 3; BladeIndex += 1) {
      const BladeGeometry = BladeSourceGeometry.index
        ? BladeSourceGeometry.toNonIndexed()
        : BladeSourceGeometry.clone();
      const BladeTransform = new THREE.Object3D();
      BladeTransform.position.set((BladeIndex - 1) * 0.08, 0.17, 0);
      BladeTransform.rotation.z = (BladeIndex - 1) * -0.15;
      BladeTransform.updateMatrix();
      BladeGeometry.applyMatrix4(BladeTransform.matrix);
      addRestorationGeometryAttributes(BladeGeometry, null, 1);
      BladeGeometries.push(BladeGeometry);
    }
    BladeSourceGeometry.dispose();
    Grass.add(new THREE.Mesh(
      mergeRestorationGeometries(BladeGeometries),
      GrassMaterial,
    ));

    placeSurfaceProp(Grass, SurfaceDirection, WorldDefinition.radius, Scale, 0.02);
    registerRestorableMaterial(Grass, GrassMaterial);
    Grass.userData.kind = 'grass';
    Grass.userData.swayPhase = Phase;
    Grass.userData.swayAmount = 0.065;
    return Grass;
  }

  /** Creates Meadow's pond as a glossy tangent disc with a bright rim. */
  function createMeadowPond(WorldDefinition, SurfaceDirection) {
    const Pond = new THREE.Group();
    const WaterMaterial = new THREE.MeshStandardMaterial({
      color: 0x58b7b1,
      emissive: 0x123e48,
      emissiveIntensity: 0.45,
      roughness: 0.24,
      metalness: 0.05,
    });
    const RimMaterial = new THREE.MeshStandardMaterial({ color: 0xbee58d, roughness: 0.9 });
    const Water = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), WaterMaterial);
    Water.rotation.x = -Math.PI * 0.5;
    Water.scale.z = 0.62;
    Water.position.y = 0.025;
    Pond.add(Water);

    const Rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.055, 6, 32), RimMaterial);
    Rim.rotation.x = Math.PI * 0.5;
    Rim.scale.z = 0.62;
    Rim.position.y = 0.018;
    Pond.add(Rim);

    placeSurfaceProp(Pond, SurfaceDirection, WorldDefinition.radius, 1, 0.015);
    registerRestorableMaterial(Pond, WaterMaterial);
    registerRestorableMaterial(Pond, RimMaterial);
    Pond.userData.kind = 'pond';
    Pond.userData.waterMaterial = WaterMaterial;
    return Pond;
  }

  /** Builds Meadow's final procedural prop composition. */
  function createMeadowSurfaceProps(WorldDefinition) {
    const SurfacePropGroup = new THREE.Group();
    const TreeDefinitions = [
      [-0.64, 0.22, 0.74, 1.1],
      [0.43, 0.58, 0.69, 0.92],
      [-0.42, -0.48, 0.77, 0.82],
      [0.7, -0.14, 0.7, 0.72],
      [0.38, -0.52, -0.76, 0.88],
      [-0.55, 0.2, -0.81, 1.02],
    ];
    TreeDefinitions.forEach(([X, Y, Z, Scale], Index) => {
      SurfacePropGroup.add(createMeadowTree(
        WorldDefinition,
        new THREE.Vector3(X, Y, Z),
        Scale,
        Index * 1.7,
      ));
    });

    SurfacePropGroup.add(createMeadowCottage(
      WorldDefinition,
      new THREE.Vector3(-0.16, 0.7, 0.72),
    ));
    SurfacePropGroup.add(createMeadowCottage(
      WorldDefinition,
      new THREE.Vector3(0.22, -0.62, -0.75),
    ));
    SurfacePropGroup.add(createMeadowPond(
      WorldDefinition,
      new THREE.Vector3(0.2, -0.34, 0.93),
    ));
    SurfacePropGroup.add(createMeadowPond(
      WorldDefinition,
      new THREE.Vector3(-0.28, 0.4, -0.87),
    ));

    const FlowerDefinitions = [
      [-0.08, 0.1, 0.99, 0xf0a7c6],
      [0.48, 0.18, 0.87, 0xd8b0ff],
      [-0.52, -0.1, 0.85, 0xffd68a],
      [0.1, 0.55, 0.84, 0xf59cab],
      [0.12, -0.38, -0.92, 0xf0a7c6],
      [-0.44, 0.16, -0.88, 0xffd68a],
    ];
    FlowerDefinitions.forEach(([X, Y, Z, Color], Index) => {
      SurfacePropGroup.add(createMeadowFlowers(
        WorldDefinition,
        new THREE.Vector3(X, Y, Z),
        Color,
        0.7 + (Index * 1.2),
      ));
    });

    const GrassDirections = [
      [-0.8, 0.52, 0.3], [0.12, 0.84, 0.52], [0.73, 0.42, 0.54],
      [-0.76, -0.48, 0.45], [-0.18, -0.76, 0.63], [0.63, -0.58, 0.52],
      [-0.35, 0.34, 0.88], [0.42, -0.02, 0.91],
    ];
    GrassDirections.forEach(([X, Y, Z], Index) => {
      SurfacePropGroup.add(createMeadowGrass(
        WorldDefinition,
        new THREE.Vector3(X, Y, Z),
        0.78 + ((Index % 3) * 0.1),
        Index * 0.8,
      ));
    });

    const RockGeometry = new THREE.DodecahedronGeometry(0.16, 0);
    const RockDirections = [
      [-0.72, 0.68, 0.18], [0.55, 0.72, 0.42], [-0.66, -0.68, 0.3], [0.54, -0.7, 0.46],
    ];
    RockDirections.forEach(([X, Y, Z], Index) => {
      const RockMaterial = new THREE.MeshStandardMaterial({ color: 0xa5ad92, roughness: 1 });
      const Rock = new THREE.Mesh(RockGeometry, RockMaterial);
      Rock.scale.set(1.25, 0.8, 1);
      placeSurfaceProp(
        Rock,
        new THREE.Vector3(X, Y, Z),
        WorldDefinition.radius,
        0.82 + ((Index % 2) * 0.18),
        0.04,
      );
      registerRestorableMaterial(Rock, RockMaterial);
      Rock.userData.kind = 'rock';
      SurfacePropGroup.add(Rock);
    });

    return SurfacePropGroup;
  }

  /** Creates a cluster of rising basalt columns with a restrained inner heat glow. */
  function createEmberBasaltCluster(WorldDefinition, SurfaceDirection, Scale, Phase) {
    const BasaltCluster = new THREE.Group();
    const BasaltMaterial = new THREE.MeshStandardMaterial({
      color: 0x41353a,
      roughness: 0.82,
      metalness: 0.08,
    });
    const HeatMaterial = new THREE.MeshStandardMaterial({
      color: 0xff8a42,
      emissive: 0xff461f,
      emissiveIntensity: 1.35,
      roughness: 0.45,
    });
    const ColumnHeights = [0.56, 0.82, 0.43, 0.67, 0.36];
    const ColumnPositions = [
      [-0.18, 0], [0, 0.03], [0.18, 0.02], [-0.08, 0.18], [0.13, 0.17],
    ];

    ColumnHeights.forEach((ColumnHeight, Index) => {
      const Column = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.13, ColumnHeight, 6),
        BasaltMaterial,
      );
      Column.position.set(
        ColumnPositions[Index][0],
        ColumnHeight * 0.5,
        ColumnPositions[Index][1],
      );
      Column.rotation.y = (Index % 2) * 0.22;
      BasaltCluster.add(Column);

      if (Index < 2) {
        const HeatCap = new THREE.Mesh(new THREE.CircleGeometry(0.075, 6), HeatMaterial);
        HeatCap.rotation.x = -Math.PI * 0.5;
        HeatCap.position.set(
          ColumnPositions[Index][0],
          ColumnHeight + 0.003,
          ColumnPositions[Index][1],
        );
        BasaltCluster.add(HeatCap);
      }
    });

    placeSurfaceProp(BasaltCluster, SurfaceDirection, WorldDefinition.radius, Scale, 0.025);
    registerRestorableMaterial(BasaltCluster, BasaltMaterial);
    registerRestorableMaterial(BasaltCluster, HeatMaterial);
    BasaltCluster.userData.kind = 'basalt';
    BasaltCluster.userData.heatMaterial = HeatMaterial;
    BasaltCluster.userData.motionPhase = Phase;
    return BasaltCluster;
  }

  /** Creates Ember's volcanic landmark with a glowing caldera. */
  function createEmberCaldera(WorldDefinition, SurfaceDirection) {
    const Caldera = new THREE.Group();
    const CrustMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3432,
      roughness: 0.96,
    });
    const LavaMaterial = new THREE.MeshStandardMaterial({
      color: 0xffa33e,
      emissive: 0xff3c12,
      emissiveIntensity: 2.2,
      roughness: 0.28,
    });
    const Volcano = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.85, 7, 1, true), CrustMaterial);
    Volcano.position.y = 0.42;
    Caldera.add(Volcano);

    const LavaMouth = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), LavaMaterial);
    LavaMouth.rotation.x = -Math.PI * 0.5;
    LavaMouth.position.y = 0.84;
    Caldera.add(LavaMouth);

    const CraterRim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.085, 6, 22), CrustMaterial);
    CraterRim.rotation.x = Math.PI * 0.5;
    CraterRim.position.y = 0.845;
    Caldera.add(CraterRim);

    placeSurfaceProp(Caldera, SurfaceDirection, WorldDefinition.radius, 1.08, 0.015);
    registerRestorableMaterial(Caldera, CrustMaterial);
    registerRestorableMaterial(Caldera, LavaMaterial);
    Caldera.userData.kind = 'volcano';
    Caldera.userData.lavaMaterial = LavaMaterial;
    return Caldera;
  }

  /** Creates a small molten pool set into Ember's curved crust. */
  function createEmberLavaPool(WorldDefinition, SurfaceDirection) {
    const LavaPool = new THREE.Group();
    const LavaMaterial = new THREE.MeshStandardMaterial({
      color: 0xff9a38,
      emissive: 0xff3514,
      emissiveIntensity: 1.8,
      roughness: 0.25,
    });
    const RimMaterial = new THREE.MeshStandardMaterial({ color: 0x4e3735, roughness: 0.98 });
    const Lava = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), LavaMaterial);
    Lava.rotation.x = -Math.PI * 0.5;
    Lava.scale.z = 0.55;
    Lava.position.y = 0.026;
    LavaPool.add(Lava);
    const Rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 28), RimMaterial);
    Rim.rotation.x = Math.PI * 0.5;
    Rim.scale.z = 0.55;
    Rim.position.y = 0.02;
    LavaPool.add(Rim);

    placeSurfaceProp(LavaPool, SurfaceDirection, WorldDefinition.radius, 1, 0.015);
    registerRestorableMaterial(LavaPool, LavaMaterial);
    registerRestorableMaterial(LavaPool, RimMaterial);
    LavaPool.userData.kind = 'lavaPool';
    LavaPool.userData.lavaMaterial = LavaMaterial;
    return LavaPool;
  }

  /** Builds Ember's authored volcanic prop composition. */
  function createEmberSurfaceProps(WorldDefinition) {
    const SurfacePropGroup = new THREE.Group();
    SurfacePropGroup.add(createEmberCaldera(
      WorldDefinition,
      new THREE.Vector3(0.24, 0.58, 0.79),
    ));
    SurfacePropGroup.add(createEmberLavaPool(
      WorldDefinition,
      new THREE.Vector3(-0.08, -0.42, 0.91),
    ));

    const ClusterDefinitions = [
      [-0.64, 0.34, 0.7, 1.0], [0.62, 0.12, 0.78, 0.86],
      [-0.54, -0.48, 0.69, 0.72], [0.58, -0.55, 0.6, 0.68],
      [0.48, -0.22, -0.84, 0.9], [-0.36, 0.4, -0.84, 0.76],
    ];
    ClusterDefinitions.forEach(([X, Y, Z, Scale], Index) => {
      SurfacePropGroup.add(createEmberBasaltCluster(
        WorldDefinition,
        new THREE.Vector3(X, Y, Z),
        Scale,
        Index * 1.4,
      ));
    });

    const ShardGeometry = new THREE.TetrahedronGeometry(0.19, 0);
    const ShardDirections = [
      [-0.78, 0.58, 0.26], [0.72, 0.58, 0.38], [-0.72, -0.65, 0.25],
      [0.72, -0.62, 0.31], [0.05, 0.02, 1],
    ];
    ShardDirections.forEach(([X, Y, Z], Index) => {
      const ShardMaterial = new THREE.MeshStandardMaterial({
        color: Index % 2 === 0 ? 0x513a3a : 0x372f35,
        roughness: 0.88,
        metalness: 0.06,
      });
      const Shard = new THREE.Mesh(ShardGeometry, ShardMaterial);
      Shard.rotation.y = Index * 0.7;
      placeSurfaceProp(
        Shard,
        new THREE.Vector3(X, Y, Z),
        WorldDefinition.radius,
        0.8 + ((Index % 3) * 0.18),
        0.055,
      );
      registerRestorableMaterial(Shard, ShardMaterial);
      Shard.userData.kind = 'rock';
      SurfacePropGroup.add(Shard);
    });

    return SurfacePropGroup;
  }

  /** Creates one translucent-looking cluster of faceted Frost crystals. */
  function createFrostCrystalCluster(WorldDefinition, SurfaceDirection, Scale, Phase) {
    const CrystalCluster = new THREE.Group();
    const CrystalMaterial = new THREE.MeshStandardMaterial({
      color: 0xbdebf2,
      emissive: 0x4b9db4,
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0.08,
    });
    const CrystalGeometry = new THREE.OctahedronGeometry(0.28, 0);
    const CrystalDefinitions = [
      [-0.2, 0.5, 0, 1.45], [0.02, 0.7, 0.02, 1.9], [0.23, 0.42, -0.02, 1.15],
    ];
    CrystalDefinitions.forEach(([X, Y, Z, HeightScale], Index) => {
      const Crystal = new THREE.Mesh(CrystalGeometry, CrystalMaterial);
      Crystal.position.set(X, Y * 0.52, Z);
      Crystal.scale.set(0.72, HeightScale, 0.72);
      Crystal.rotation.y = Index * 0.42;
      CrystalCluster.add(Crystal);
    });

    placeSurfaceProp(CrystalCluster, SurfaceDirection, WorldDefinition.radius, Scale, 0.025);
    registerRestorableMaterial(CrystalCluster, CrystalMaterial);
    CrystalCluster.userData.kind = 'crystal';
    CrystalCluster.userData.crystalMaterial = CrystalMaterial;
    CrystalCluster.userData.motionPhase = Phase;
    return CrystalCluster;
  }

  /** Creates Frost's large ice arch landmark. */
  function createFrostIceArch(WorldDefinition, SurfaceDirection) {
    const IceArch = new THREE.Group();
    const IceMaterial = new THREE.MeshStandardMaterial({
      color: 0xd9f6f8,
      emissive: 0x5cabc1,
      emissiveIntensity: 0.62,
      roughness: 0.22,
      metalness: 0.06,
    });
    for (const PillarX of [-0.4, 0.4]) {
      const Pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.66, 6), IceMaterial);
      Pillar.position.set(PillarX, 0.33, 0);
      IceArch.add(Pillar);
    }
    const Arch = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.11, 6, 24, Math.PI), IceMaterial);
    Arch.position.y = 0.64;
    IceArch.add(Arch);

    placeSurfaceProp(IceArch, SurfaceDirection, WorldDefinition.radius, 1.15, 0.02);
    registerRestorableMaterial(IceArch, IceMaterial);
    IceArch.userData.kind = 'iceArch';
    IceArch.userData.crystalMaterial = IceMaterial;
    return IceArch;
  }

  /** Creates a luminous frozen lake on Frost. */
  function createFrostLake(WorldDefinition, SurfaceDirection) {
    const FrozenLake = new THREE.Group();
    const IceMaterial = new THREE.MeshStandardMaterial({
      color: 0x99dce8,
      emissive: 0x326f91,
      emissiveIntensity: 0.48,
      roughness: 0.16,
      metalness: 0.12,
    });
    const SnowMaterial = new THREE.MeshStandardMaterial({ color: 0xe8f5f2, roughness: 0.88 });
    const Ice = new THREE.Mesh(new THREE.CircleGeometry(0.58, 28), IceMaterial);
    Ice.rotation.x = -Math.PI * 0.5;
    Ice.scale.z = 0.62;
    Ice.position.y = 0.025;
    FrozenLake.add(Ice);
    const SnowRim = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.055, 6, 30), SnowMaterial);
    SnowRim.rotation.x = Math.PI * 0.5;
    SnowRim.scale.z = 0.62;
    SnowRim.position.y = 0.02;
    FrozenLake.add(SnowRim);

    placeSurfaceProp(FrozenLake, SurfaceDirection, WorldDefinition.radius, 1, 0.015);
    registerRestorableMaterial(FrozenLake, IceMaterial);
    registerRestorableMaterial(FrozenLake, SnowMaterial);
    FrozenLake.userData.kind = 'frozenLake';
    FrozenLake.userData.crystalMaterial = IceMaterial;
    return FrozenLake;
  }

  /** Builds Frost's authored crystalline prop composition. */
  function createFrostSurfaceProps(WorldDefinition) {
    const SurfacePropGroup = new THREE.Group();
    SurfacePropGroup.add(createFrostIceArch(
      WorldDefinition,
      new THREE.Vector3(-0.18, 0.68, 0.73),
    ));
    SurfacePropGroup.add(createFrostLake(
      WorldDefinition,
      new THREE.Vector3(0.22, -0.36, 0.91),
    ));

    const CrystalDefinitions = [
      [-0.64, 0.25, 0.73, 1.0], [0.55, 0.43, 0.71, 0.9],
      [-0.5, -0.53, 0.69, 0.78], [0.64, -0.45, 0.63, 0.72],
      [0.2, 0.15, 0.97, 0.64],
      [0.42, -0.28, -0.86, 0.82], [-0.38, 0.36, -0.85, 0.7],
    ];
    CrystalDefinitions.forEach(([X, Y, Z, Scale], Index) => {
      SurfacePropGroup.add(createFrostCrystalCluster(
        WorldDefinition,
        new THREE.Vector3(X, Y, Z),
        Scale,
        Index * 1.15,
      ));
    });

    const SnowGeometry = new THREE.IcosahedronGeometry(0.24, 1);
    const SnowDirections = [
      [-0.75, 0.6, 0.27], [0.7, 0.63, 0.34], [-0.72, -0.65, 0.27],
      [0.72, -0.62, 0.31], [-0.12, 0.04, 0.99],
    ];
    SnowDirections.forEach(([X, Y, Z], Index) => {
      const SnowMaterial = new THREE.MeshStandardMaterial({ color: 0xe5f1ee, roughness: 0.94 });
      const SnowMound = new THREE.Mesh(SnowGeometry, SnowMaterial);
      SnowMound.scale.set(1.2, 0.55, 1);
      placeSurfaceProp(
        SnowMound,
        new THREE.Vector3(X, Y, Z),
        WorldDefinition.radius,
        0.78 + ((Index % 2) * 0.18),
        0.035,
      );
      registerRestorableMaterial(SnowMound, SnowMaterial);
      SnowMound.userData.kind = 'snow';
      SurfacePropGroup.add(SnowMound);
    });

    return SurfacePropGroup;
  }

  /** Soft circular sprite so biome motes never read as hard gl_Point squares. */
  function createMoteSpriteTexture() {
    const MoteCanvas = document.createElement('canvas');
    MoteCanvas.width = 64;
    MoteCanvas.height = 64;
    const MoteContext = MoteCanvas.getContext('2d');
    MoteContext.clearRect(0, 0, 64, 64);
    const MoteGradient = MoteContext.createRadialGradient(32, 32, 0, 32, 32, 30);
    MoteGradient.addColorStop(0, 'rgba(255,255,255,1)');
    MoteGradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    MoteGradient.addColorStop(1, 'rgba(255,255,255,0)');
    MoteContext.fillStyle = MoteGradient;
    MoteContext.fillRect(0, 0, 64, 64);
    const MoteTexture = new THREE.CanvasTexture(MoteCanvas);
    MoteTexture.needsUpdate = true;
    return MoteTexture;
  }

  const MoteSpriteTexture = createMoteSpriteTexture();

  /** Creates a tiny deterministic halo of warm Meadow motes. */
  function createMeadowMotes(WorldDefinition) {
    const MoteCount = 24;
    const MotePositions = new Float32Array(MoteCount * 3);

    for (let MoteIndex = 0; MoteIndex < MoteCount; MoteIndex += 1) {
      const GoldenAngle = Math.PI * (3 - Math.sqrt(5));
      const Longitude = MoteIndex * GoldenAngle;
      const VerticalPosition = 1 - ((MoteIndex + 0.5) / MoteCount) * 2;
      const HorizontalRadius = Math.sqrt(1 - (VerticalPosition * VerticalPosition));
      const MoteRadius = WorldDefinition.radius + 0.62 + ((MoteIndex % 4) * 0.08);
      const PositionOffset = MoteIndex * 3;
      MotePositions[PositionOffset] = Math.cos(Longitude) * HorizontalRadius * MoteRadius;
      MotePositions[PositionOffset + 1] = VerticalPosition * MoteRadius;
      MotePositions[PositionOffset + 2] = Math.sin(Longitude) * HorizontalRadius * MoteRadius;
    }

    const MoteGeometry = new THREE.BufferGeometry();
    MoteGeometry.setAttribute('position', new THREE.BufferAttribute(MotePositions, 3));
    const MoteMaterial = new THREE.PointsMaterial({
      color: 0xffef9d,
      size: 0.16,
      map: MoteSpriteTexture,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      alphaTest: 0.02,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(MoteGeometry, MoteMaterial);
  }

  /** Creates a fixed-size deterministic particle halo for a restored biome. */
  function createBiomeMotes(WorldDefinition, MoteCount, Color, Size, BaseOpacity) {
    const MotePositions = new Float32Array(MoteCount * 3);

    for (let MoteIndex = 0; MoteIndex < MoteCount; MoteIndex += 1) {
      const GoldenAngle = Math.PI * (3 - Math.sqrt(5));
      const Longitude = MoteIndex * GoldenAngle;
      const VerticalPosition = 1 - ((MoteIndex + 0.5) / MoteCount) * 2;
      const HorizontalRadius = Math.sqrt(1 - (VerticalPosition * VerticalPosition));
      const RadiusVariation = ((MoteIndex * 7) % 5) * 0.09;
      const MoteRadius = WorldDefinition.radius + 0.48 + RadiusVariation;
      const PositionOffset = MoteIndex * 3;
      MotePositions[PositionOffset] = Math.cos(Longitude) * HorizontalRadius * MoteRadius;
      MotePositions[PositionOffset + 1] = VerticalPosition * MoteRadius;
      MotePositions[PositionOffset + 2] = Math.sin(Longitude) * HorizontalRadius * MoteRadius;
    }

    const MoteGeometry = new THREE.BufferGeometry();
    MoteGeometry.setAttribute('position', new THREE.BufferAttribute(MotePositions, 3));
    const MoteMaterial = new THREE.PointsMaterial({
      color: Color,
      size: Size * 1.7,
      map: MoteSpriteTexture,
      sizeAttenuation: true,
      transparent: true,
      opacity: WorldDefinition.restored ? BaseOpacity : 0,
      depthWrite: false,
      alphaTest: 0.02,
      blending: THREE.AdditiveBlending,
    });
    const MoteGroup = new THREE.Points(MoteGeometry, MoteMaterial);
    MoteGroup.userData.baseOpacity = BaseOpacity;
    return MoteGroup;
  }

  /**
   * Creates one world and records its render-time components by identifier.
   *
   * @param {object} WorldDefinition - Gameplay and visual definition for the world.
   */
  function createWorld(WorldDefinition) {
    const WorldGroup = new THREE.Group();
    WorldGroup.position.set(
      WorldDefinition.position.x,
      WorldDefinition.position.y,
      WorldDefinition.position.z,
    );

    const UsesMergedSurfaceLandmarks = usesMergedSurfaceLandmarks(WorldDefinition);
    const SurfaceGeometry = UsesMergedSurfaceLandmarks
      ? createMergedSurfaceGeometry(WorldDefinition)
      : addRestorationGeometryAttributes(new THREE.IcosahedronGeometry(
        WorldDefinition.radius,
        5,
      ));
    const SurfaceRestoration = createRestorationSurfaceMaterial(WorldDefinition);
    const SurfaceMaterial = SurfaceRestoration.material;
    const SurfaceMesh = new THREE.Mesh(SurfaceGeometry, SurfaceMaterial);
    SurfaceMesh.castShadow = !UsesMergedSurfaceLandmarks;
    SurfaceMesh.receiveShadow = true;
    WorldGroup.add(SurfaceMesh);

    const RestorationWaveShell = createRestorationWaveShell(
      WorldDefinition,
      SurfaceRestoration.uniforms,
    );
    WorldGroup.add(RestorationWaveShell.mesh);

    const AtmosphereRimShell = createAtmosphereRimShell(WorldDefinition);
    const AtmosphereMaterial = AtmosphereRimShell.material;
    const AtmosphereMesh = AtmosphereRimShell.mesh;
    WorldGroup.add(AtmosphereMesh);

    let ContourRingGroup;
    if (UsesMergedSurfaceLandmarks) {
      ContourRingGroup = new THREE.Group();
    } else {
      ContourRingGroup = createWorldContourRings(
        WorldDefinition.radius,
        WorldDefinition.atmosphereColor,
      );
      ContourRingGroup.visible = WorldDefinition.restored;
      WorldGroup.add(ContourRingGroup);
    }

    const LifeScatterGroup = createLifeScatter(WorldDefinition, SurfaceRestoration.uniforms);
    WorldGroup.add(LifeScatterGroup);

    const SurfacePropFactories = {
      meadow: createMeadowSurfaceProps,
      ember: createEmberSurfaceProps,
      frost: createFrostSurfaceProps,
    };
    const SurfaceMarkerGroup = UsesMergedSurfaceLandmarks
      ? new THREE.Group()
      : (
        SurfacePropFactories[WorldDefinition.visualKey] ?? createPlaceholderSurfaceProps
      )(WorldDefinition);

    for (const SurfacePropObject of SurfaceMarkerGroup.children) {
      const CastsUsefulShadow = [
        'cottage', 'tree', 'rock', 'basalt', 'volcano', 'crystal', 'iceArch',
      ].includes(
        SurfacePropObject.userData.kind,
      );
      SurfacePropObject.traverse((SurfaceObject) => {
        if (SurfaceObject.isMesh) {
          SurfaceObject.castShadow = CastsUsefulShadow;
          SurfaceObject.receiveShadow = true;
        }
      });
    }

    WorldGroup.add(SurfaceMarkerGroup);
    const AmbientMoteGroup = UsesMergedSurfaceLandmarks
      ? null
      : (
        WorldDefinition.visualKey === 'meadow'
          ? createMeadowMotes(WorldDefinition)
          : createBiomeMotes(
            WorldDefinition,
            WorldDefinition.visualKey === 'ember' ? 30 : 34,
            WorldDefinition.visualKey === 'ember' ? 0xff7b32 : 0xcdf8ff,
            WorldDefinition.visualKey === 'ember' ? 0.105 : 0.085,
            WorldDefinition.visualKey === 'ember' ? 0.78 : 0.64,
          )
      );
    if (AmbientMoteGroup) {
      AmbientMoteGroup.userData.baseOpacity ??= 0.72;
    }
    if (AmbientMoteGroup) {
      WorldGroup.add(AmbientMoteGroup);
    }
    const StillnessCage = createStillnessCage(WorldDefinition);
    WorldGroup.add(StillnessCage.group);
    Scene.add(WorldGroup);

    const WorldRuntime = {
      definition: WorldDefinition,
      group: WorldGroup,
      surfaceMesh: SurfaceMesh,
      surfaceMaterial: SurfaceMaterial,
      restorationUniforms: SurfaceRestoration.uniforms,
      restorationWaveMesh: RestorationWaveShell.mesh,
      atmosphereMaterial: AtmosphereMaterial,
      atmosphereMesh: AtmosphereMesh,
      contourRingGroup: ContourRingGroup,
      surfaceMarkerGroup: SurfaceMarkerGroup,
      ambientMoteGroup: AmbientMoteGroup,
      stillnessCageGroup: StillnessCage.group,
      stillnessCageMaterial: StillnessCage.material,
      restorationOriginLocal: new THREE.Vector3(1, 0, 0),
      restorationStartedAtSeconds: WorldDefinition.restored ? -Infinity : null,
      cageClearPulseStartedAtSeconds: null,
      suppressionStartedAtSeconds: null,
      restorationCompleted: WorldDefinition.restored,
    };
    WorldRuntimeByIdentifier.set(WorldDefinition.id, WorldRuntime);
    if (!WorldRuntimesByVisualKey.has(WorldDefinition.visualKey)) {
      WorldRuntimesByVisualKey.set(WorldDefinition.visualKey, []);
    }
    WorldRuntimesByVisualKey.get(WorldDefinition.visualKey).push(WorldRuntime);
  }

  for (const WorldDefinition of WorldDefinitions) {
    createWorld(WorldDefinition);
  }

  return {
    setSurfacePropRestorationProgress,
  };
}
