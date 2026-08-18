/**
 * Scene lighting, the per-sector nebula skydome and the layered star field.
 * These are presentation-only and never enter ranked simulation.
 */

import { getCloseViewPresentation } from './presentation.js';

function createLighting(THREE, Scene, EnvironmentDefinition) {
  const HemisphereLight = new THREE.HemisphereLight(
    EnvironmentDefinition.hemisphereSkyColor,
    EnvironmentDefinition.hemisphereGroundColor,
    1.78,
  );
  Scene.add(HemisphereLight);

  const KeyLight = new THREE.DirectionalLight(EnvironmentDefinition.keyLightColor, 2.85);
  KeyLight.position.set(-12, 18, 24);
  KeyLight.castShadow = true;
  KeyLight.shadow.mapSize.set(1024, 1024);
  KeyLight.shadow.camera.left = -24;
  KeyLight.shadow.camera.right = 24;
  KeyLight.shadow.camera.top = 24;
  KeyLight.shadow.camera.bottom = -24;
  KeyLight.shadow.camera.near = 4;
  KeyLight.shadow.camera.far = 80;
  KeyLight.shadow.bias = -0.0004;
  KeyLight.shadow.normalBias = 0.035;
  Scene.add(KeyLight);

  const FillLight = new THREE.DirectionalLight(EnvironmentDefinition.fillLightColor, 1.42);
  FillLight.position.set(18, -8, 16);
  Scene.add(FillLight);

  const RimLight = new THREE.DirectionalLight(EnvironmentDefinition.rimLightColor, 1.38);
  RimLight.position.set(8, 12, -18);
  Scene.add(RimLight);

  return { keyLight: KeyLight };
}

const NebulaVertexShader = `
varying vec3 vDirection;
void main() {
  vDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const NebulaFragmentShader = `
varying vec3 vDirection;
uniform vec3 uBaseColor;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uTime;
uniform float uIntensity;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i);
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

float fbm(vec3 p) {
  float total = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 3; octave += 1) {
    total += valueNoise(p) * amplitude;
    p *= 2.15;
    amplitude *= 0.5;
  }
  return total;
}

void main() {
  vec3 direction = normalize(vDirection);
  float drift = uTime * 0.006;
  float bandA = fbm(direction * 2.3 + vec3(drift, 0.0, 17.0));
  float bandB = fbm(direction * 3.6 + vec3(31.0, -drift, 5.0));
  float bandC = fbm(direction * 1.7 + vec3(-9.0, 23.0, drift * 0.6));
  float wash = fbm(direction * 0.62 + vec3(drift * 0.35, 11.0, -4.0));
  vec3 color = uBaseColor;
  color += mix(uColorA, uColorC, wash) * (0.1 + (0.12 * uIntensity));
  color += uColorA * smoothstep(0.32, 0.94, bandA) * (0.28 * uIntensity);
  color += uColorB * smoothstep(0.38, 0.96, bandB) * (0.2 * uIntensity);
  color += uColorC * smoothstep(0.3, 0.93, bandC) * (0.22 * uIntensity);
  // Deepen the dome away from the orbital plane so the play field reads brightest.
  float planeGlow = 1.0 - smoothstep(0.12, 0.82, abs(direction.z));
  color += uColorA * planeGlow * (0.07 * uIntensity);
  color += uColorC * planeGlow * (0.04 * uIntensity);
  color = mix(uBaseColor, color, clamp(uIntensity, 0.0, 1.0));
  gl_FragColor = vec4(color, 1.0);
}
`;

function createNebulaDome(THREE, Scene, EnvironmentDefinition) {
  const ColorA = EnvironmentDefinition.hemisphereSkyColor.clone()
    .lerp(EnvironmentDefinition.backgroundColor, 0.08);
  const ColorB = EnvironmentDefinition.rimLightColor.clone()
    .lerp(EnvironmentDefinition.backgroundColor, 0.06);
  const ColorC = EnvironmentDefinition.keyLightColor.clone()
    .lerp(EnvironmentDefinition.backgroundColor, 0.18);
  const NebulaMaterial = new THREE.ShaderMaterial({
    vertexShader: NebulaVertexShader,
    fragmentShader: NebulaFragmentShader,
    uniforms: {
      uBaseColor: { value: EnvironmentDefinition.backgroundColor.clone() },
      uColorA: { value: ColorA },
      uColorB: { value: ColorB },
      uColorC: { value: ColorC },
      uTime: { value: 0 },
      uIntensity: { value: 0.62 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const DomeMesh = new THREE.Mesh(new THREE.SphereGeometry(360, 28, 18), NebulaMaterial);
  DomeMesh.renderOrder = -100;
  DomeMesh.frustumCulled = false;
  Scene.add(DomeMesh);
  return NebulaMaterial;
}

function createDeterministicRandom(Seed) {
  let RandomState = Seed;
  return function nextRandomValue() {
    RandomState = (RandomState * 1664525 + 1013904223) % 4294967296;
    return RandomState / 4294967296;
  };
}

function createStarSpriteTexture(THREE) {
  const StarCanvas = document.createElement('canvas');
  StarCanvas.width = 128;
  StarCanvas.height = 128;
  const StarContext = StarCanvas.getContext('2d');
  StarContext.clearRect(0, 0, 128, 128);
  const StarGradient = StarContext.createRadialGradient(64, 64, 0, 64, 64, 62);
  StarGradient.addColorStop(0, 'rgba(255,255,255,1)');
  StarGradient.addColorStop(0.12, 'rgba(255,255,255,0.92)');
  StarGradient.addColorStop(0.32, 'rgba(210,240,255,0.42)');
  StarGradient.addColorStop(0.58, 'rgba(170,220,255,0.12)');
  StarGradient.addColorStop(1, 'rgba(255,255,255,0)');
  StarContext.fillStyle = StarGradient;
  StarContext.fillRect(0, 0, 128, 128);
  const StarTexture = new THREE.CanvasTexture(StarCanvas);
  StarTexture.needsUpdate = true;
  return StarTexture;
}

function createStarLayer(THREE, Scene, nextRandomValue, {
  count,
  size,
  opacity,
  color,
  spreadX,
  spreadY,
  nearZ,
  farZ,
  additive = false,
  starMap,
}) {
  const StarPositions = new Float32Array(count * 3);
  for (let StarIndex = 0; StarIndex < count; StarIndex += 1) {
    const PositionOffset = StarIndex * 3;
    StarPositions[PositionOffset] = (nextRandomValue() - 0.5) * spreadX;
    StarPositions[PositionOffset + 1] = (nextRandomValue() - 0.5) * spreadY;
    StarPositions[PositionOffset + 2] = nearZ + (nextRandomValue() * (farZ - nearZ));
  }
  const StarGeometry = new THREE.BufferGeometry();
  StarGeometry.setAttribute('position', new THREE.BufferAttribute(StarPositions, 3));
  const StarMaterial = new THREE.PointsMaterial({
    color,
    size,
    map: starMap,
    sizeAttenuation: false,
    transparent: true,
    opacity,
    depthWrite: false,
    alphaTest: 0.02,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const StarPoints = new THREE.Points(StarGeometry, StarMaterial);
  Scene.add(StarPoints);
  return { material: StarMaterial, points: StarPoints, baseOpacity: opacity };
}

function createBackdrop(THREE, Scene, EnvironmentDefinition) {
  const NebulaMaterial = createNebulaDome(THREE, Scene, EnvironmentDefinition);
  const nextRandomValue = createDeterministicRandom(732451);
  const StarMap = createStarSpriteTexture(THREE);

  const FarLayer = createStarLayer(THREE, Scene, nextRandomValue, {
    count: 640,
    size: 1.15,
    opacity: 0.62,
    color: 0xd9e5ef,
    spreadX: 210,
    spreadY: 160,
    nearZ: -18,
    farZ: -52,
    starMap: StarMap,
  });
  const MidLayer = createStarLayer(THREE, Scene, nextRandomValue, {
    count: 340,
    size: 1.7,
    opacity: 0.84,
    color: 0xf3f7ff,
    spreadX: 185,
    spreadY: 140,
    nearZ: -12,
    farZ: -36,
    starMap: StarMap,
  });
  const BrightLayer = createStarLayer(THREE, Scene, nextRandomValue, {
    count: 76,
    size: 3.8,
    opacity: 0.88,
    color: 0xd7f4ff,
    spreadX: 170,
    spreadY: 125,
    nearZ: -9,
    farZ: -28,
    additive: true,
    starMap: StarMap,
  });
  const DustLayer = createStarLayer(THREE, Scene, nextRandomValue, {
    count: 160,
    size: 9,
    opacity: 0.16,
    color: EnvironmentDefinition.hemisphereSkyColor.getHex(),
    spreadX: 130,
    spreadY: 105,
    nearZ: 4,
    farZ: -6,
    additive: true,
    starMap: StarMap,
  });

  let BackdropElapsedSeconds = 0;

  /** Advances twinkle, dust drift and the nebula tint (which tracks the finale). */
  function updateBackdrop(DeltaTimeSeconds, CameraDistanceScale = 1) {
    BackdropElapsedSeconds += DeltaTimeSeconds;
    const CloseView = getCloseViewPresentation(CameraDistanceScale);
    NebulaMaterial.uniforms.uTime.value = BackdropElapsedSeconds;
    NebulaMaterial.uniforms.uIntensity.value = CloseView.nebulaIntensity;
    if (Scene.background && Scene.background.isColor) {
      NebulaMaterial.uniforms.uBaseColor.value.copy(Scene.background);
    }
    BrightLayer.material.opacity = BrightLayer.baseOpacity
      * (0.78 + (Math.sin(BackdropElapsedSeconds * 1.7) * 0.16));
    MidLayer.material.opacity = MidLayer.baseOpacity
      * (0.9 + (Math.sin((BackdropElapsedSeconds * 1.1) + 2.4) * 0.1));
    FarLayer.points.rotation.z = BackdropElapsedSeconds * 0.0016;
    DustLayer.points.rotation.z = BackdropElapsedSeconds * -0.0075;
    DustLayer.material.opacity = DustLayer.baseOpacity * CloseView.dustOpacityScale;
    return CloseView;
  }

  return updateBackdrop;
}

/** Adds lighting, the nebula dome and stars. Returns light + backdrop hooks. */
export function addEnvironment(THREE, Scene, EnvironmentDefinition) {
  const Lighting = createLighting(THREE, Scene, EnvironmentDefinition);
  const updateBackdrop = createBackdrop(THREE, Scene, EnvironmentDefinition);
  return { keyLight: Lighting.keyLight, updateBackdrop };
}
