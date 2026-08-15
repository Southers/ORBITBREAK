/**
 * Scene lighting, background glow and the deterministic star field.
 * These are presentation-only and never enter ranked simulation.
 */

function createBackgroundGlow(THREE, Scene, Position, Scale, InnerRed, InnerGreen, InnerBlue, InnerAlpha) {
  const GlowCanvas = document.createElement('canvas');
  GlowCanvas.width = 128;
  GlowCanvas.height = 128;
  const GlowContext = GlowCanvas.getContext('2d');
  const GlowGradient = GlowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  GlowGradient.addColorStop(
    0,
    `rgba(${InnerRed}, ${InnerGreen}, ${InnerBlue}, ${InnerAlpha})`,
  );
  GlowGradient.addColorStop(
    0.45,
    `rgba(${InnerRed}, ${InnerGreen}, ${InnerBlue}, ${InnerAlpha * 0.36})`,
  );
  GlowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  GlowContext.fillStyle = GlowGradient;
  GlowContext.fillRect(0, 0, 128, 128);

  const GlowTexture = new THREE.CanvasTexture(GlowCanvas);
  GlowTexture.colorSpace = THREE.SRGBColorSpace;
  const GlowMaterial = new THREE.SpriteMaterial({
    map: GlowTexture,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const GlowSprite = new THREE.Sprite(GlowMaterial);
  GlowSprite.position.copy(Position);
  GlowSprite.scale.set(Scale.x, Scale.y, 1);
  Scene.add(GlowSprite);
}

function createLighting(THREE, Scene, EnvironmentDefinition) {
  const HemisphereLight = new THREE.HemisphereLight(
    EnvironmentDefinition.hemisphereSkyColor,
    EnvironmentDefinition.hemisphereGroundColor,
    1.55,
  );
  Scene.add(HemisphereLight);

  const KeyLight = new THREE.DirectionalLight(EnvironmentDefinition.keyLightColor, 3.2);
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

  const FillLight = new THREE.DirectionalLight(EnvironmentDefinition.fillLightColor, 1.0);
  FillLight.position.set(18, -10, 14);
  Scene.add(FillLight);

  const RimLight = new THREE.DirectionalLight(EnvironmentDefinition.rimLightColor, 1.15);
  RimLight.position.set(8, 12, -18);
  Scene.add(RimLight);

  return { keyLight: KeyLight };
}

function createStarField(THREE, Scene) {
  let RandomState = 732451;

  function nextRandomValue() {
    RandomState = (RandomState * 1664525 + 1013904223) % 4294967296;
    return RandomState / 4294967296;
  }

  const StarCount = 880;
  const StarPositions = new Float32Array(StarCount * 3);

  for (let StarIndex = 0; StarIndex < StarCount; StarIndex += 1) {
    const PositionOffset = StarIndex * 3;
    StarPositions[PositionOffset] = (nextRandomValue() - 0.5) * 168;
    StarPositions[PositionOffset + 1] = (nextRandomValue() - 0.5) * 124;
    StarPositions[PositionOffset + 2] = -8 - (nextRandomValue() * 42);
  }

  const StarGeometry = new THREE.BufferGeometry();
  StarGeometry.setAttribute('position', new THREE.BufferAttribute(StarPositions, 3));

  const StarMaterial = new THREE.PointsMaterial({
    color: 0xe4eef4,
    size: 0.1,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
  });

  Scene.add(new THREE.Points(StarGeometry, StarMaterial));

  createBackgroundGlow(
    THREE,
    Scene,
    new THREE.Vector3(-15, -9, -24),
    new THREE.Vector2(48, 36),
    58,
    148,
    168,
    0.28,
  );
  createBackgroundGlow(
    THREE,
    Scene,
    new THREE.Vector3(14, 10, -26),
    new THREE.Vector2(44, 34),
    78,
    118,
    188,
    0.24,
  );
}

/** Adds lighting, stars and background glow. Returns the key light for quality scaling. */
export function addEnvironment(THREE, Scene, EnvironmentDefinition) {
  const Lighting = createLighting(THREE, Scene, EnvironmentDefinition);
  createStarField(THREE, Scene);
  return Lighting;
}
