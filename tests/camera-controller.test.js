import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from '../vendor/three.module.min.js';
import { createCameraController } from '../src/camera-controller.js';

const FrameSeconds = 1 / 60;

function createNullElement() {
  return {
    hidden: false,
    textContent: '',
    setAttribute() {},
    focus() {},
  };
}

function createHarness({ prefersReducedMotion = false } = {}) {
  const HomeWorld = { id: 'haven', label: 'HAVEN', position: { x: 0, y: 0, z: 0 }, radius: 3 };
  const FarWorld = { id: 'ember', label: 'EMBER', position: { x: 14, y: 0, z: 0 }, radius: 2.4 };
  const Worlds = [HomeWorld, FarWorld];
  const host = {
    Camera: new THREE.PerspectiveCamera(42, 1, 0.1, 480),
    GameCanvas: { dataset: {}, classList: { add() {}, remove() {}, toggle() {} } },
    Scene: { fog: { density: 0.0016 } },
    Renderer: { toneMappingExposure: 1.05 },
    CameraLookTarget: new THREE.Vector3(),
    DesiredCameraLookTarget: new THREE.Vector3(),
    PlanningCameraLookTarget: new THREE.Vector3(),
    CameraPanOffset: new THREE.Vector3(),
    ScoutCameraTarget: new THREE.Vector3(),
    PanOffsetStart: new THREE.Vector3(),
    ScoutZoomOutButtonElement: createNullElement(),
    ScoutZoomInButtonElement: createNullElement(),
    ScoutZoomStatusElement: createNullElement(),
    ScoutButtonElement: createNullElement(),
    WorldDefinitions: Worlds,
    WorldheartDefinition: {
      id: 'worldheart', position: { x: 40, y: 0, z: 0 }, radius: 2, routeAvailable: false,
    },
    SeedstoneDefinition: null,
    PredictedSlingshotWorldIdentifiers: [],
    TrajectoryMaterial: { color: { set() {} }, opacity: 1 },
    MinimumScoutZoomScale: 0.5,
    isLiveInnerCluster: () => false,
    getSectorClusterRules: () => ({
      innerClusterWorldIdentifiers: ['haven', 'ember'],
      furtherReachWorldIdentifiers: [],
      commandWorldIdentifier: 'worldheart',
    }),
    calculateBodyPositionAtTime: (Body) => Body.position,
    getWorldDefinition: (Identifier) => Worlds.find((World) => World.id === Identifier) ?? null,
    getActiveMaximumScoutZoomScale: () => 2.4,
    renderTrajectoryLine() {},
    predictCurrentLaunchTrajectory: () => ({ points: [] }),
    updatePersonalBestGhostVisibility() {},
    resizeRenderer() {},
    updateScannerInterface() {},
    getActiveElement: () => null,
    ActiveSystem: {
      camera: { followPlayer: true, viewportWorldWidth: 20, viewportWorldHeight: 24 },
      environment: { fogDensity: 0.0016, toneMappingExposure: 1.05 },
      routeSuggestions: {},
    },
    GamePhase: 'attached',
    CurrentWorldIdentifier: 'haven',
    SeedPhysicsState: { position: { x: 0, y: -3, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
    BaseCameraDistance: 42,
    CameraDistanceScale: 0.5,
    PlanningCameraScale: 1,
    CameraZoomScale: 1,
    AimZoomScale: 1,
    ScoutZoomScale: 1,
    IsScoutMode: false,
    IsPointerAiming: false,
    IsKeyboardAiming: false,
    IsPointerScouting: false,
    HasCommittedAimCamera: false,
    AimInteractionCamera: null,
    RelayRevealLookTarget: null,
    PrefersReducedMotion: prefersReducedMotion,
    CameraImpactLifeSeconds: 0,
    GameElapsedTimeSeconds: 0,
    PhysicsElapsedTimeSeconds: 0,
    FlightElapsedSeconds: 0,
    IsOpeningBriefingActive: false,
    StoryLookFocus: null,
    ReplayPlaybackState: null,
    CommittedPredictionPoints: null,
    LastPredictedBodyIdentifier: '',
    LastPlanningPathPoints: [],
    RelayNetworkState: {
      links: new Map(),
      suppressedWorldIdentifiers: new Set(),
      worldStates: new Map(),
    },
  };
  const controller = createCameraController(THREE, host);
  return { host, controller };
}

/**
 * Steps the camera one frame and returns how far the camera moved and how far
 * its up vector rotated, so tests can assert pose continuity.
 */
function stepFrame(host, controller) {
  const PreviousPosition = host.Camera.position.clone();
  const PreviousUp = host.Camera.up.clone();
  host.GameElapsedTimeSeconds += FrameSeconds;
  controller.updateCamera(FrameSeconds);
  return {
    positionDelta: host.Camera.position.distanceTo(PreviousPosition),
    upAngleDelta: PreviousUp.angleTo(host.Camera.up),
  };
}

function settle(host, controller, frames = 300) {
  for (let FrameIndex = 0; FrameIndex < frames; FrameIndex += 1) {
    stepFrame(host, controller);
  }
}

test('landing never snaps: camera pose stays continuous from flight through landing', () => {
  const { host, controller } = createHarness();
  controller.centerLandedCamera({ snap: true });
  settle(host, controller, 120);

  host.GamePhase = 'flying';
  host.CurrentWorldIdentifier = 'haven';
  const FlightFrames = 80;
  for (let FrameIndex = 0; FrameIndex < FlightFrames; FrameIndex += 1) {
    const Progress = FrameIndex / FlightFrames;
    host.SeedPhysicsState.position = { x: 3 + (Progress * 8.6), y: -3 + (Progress * 3), z: 0 };
    stepFrame(host, controller);
  }

  host.GamePhase = 'attached';
  host.CurrentWorldIdentifier = 'ember';
  host.SeedPhysicsState.position = { x: 11.6, y: 0, z: 0 };
  host.CameraImpactLifeSeconds = 0.24;
  controller.centerLandedCamera({ snap: false });

  let LargestPositionDelta = 0;
  let LargestUpAngleDelta = 0;
  for (let FrameIndex = 0; FrameIndex < 240; FrameIndex += 1) {
    const Deltas = stepFrame(host, controller);
    LargestPositionDelta = Math.max(LargestPositionDelta, Deltas.positionDelta);
    LargestUpAngleDelta = Math.max(LargestUpAngleDelta, Deltas.upAngleDelta);
  }
  assert.ok(
    LargestPositionDelta < 2.5,
    `landing moved the camera ${LargestPositionDelta.toFixed(2)} units in one frame`,
  );
  assert.ok(
    LargestUpAngleDelta < 0.2,
    `landing rotated the camera up ${LargestUpAngleDelta.toFixed(3)} radians in one frame`,
  );
});

test('landing converges onto the landed surface pose instead of drifting forever', () => {
  const { host, controller } = createHarness();
  host.GamePhase = 'flying';
  host.SeedPhysicsState.position = { x: 8, y: 0, z: 0 };
  settle(host, controller, 60);

  host.GamePhase = 'attached';
  host.CurrentWorldIdentifier = 'ember';
  host.SeedPhysicsState.position = { x: 11.6, y: 0, z: 0 };
  controller.centerLandedCamera({ snap: false });
  settle(host, controller, 360);

  const SettledPosition = host.Camera.position.clone();
  stepFrame(host, controller);
  assert.ok(
    host.Camera.position.distanceTo(SettledPosition) < 0.01,
    'camera should be at rest once the landing move completes',
  );
  assert.equal(host.GameCanvas.dataset.landedFacingCamera, 'false');
  assert.equal(host.GameCanvas.dataset.cameraUp, 'world-z');
  assert.ok(Math.abs(host.Camera.up.z - 1) < 1e-6);
  assert.ok(Math.abs(host.Camera.up.x) < 1e-6);
  assert.ok(Math.abs(host.Camera.up.y) < 1e-6);
});

test('aim commit eases to the planning frame without a hard jump', () => {
  const { host, controller } = createHarness();
  controller.centerLandedCamera({ snap: true });
  settle(host, controller, 300);

  host.IsPointerAiming = true;
  controller.commitAimPlanningCamera();
  assert.equal(host.HasCommittedAimCamera, true);
  assert.equal(host.GameCanvas.dataset.aimCamera, 'planning');

  let LargestPositionDelta = 0;
  let LargestUpAngleDelta = 0;
  for (let FrameIndex = 0; FrameIndex < 240; FrameIndex += 1) {
    const Deltas = stepFrame(host, controller);
    LargestPositionDelta = Math.max(LargestPositionDelta, Deltas.positionDelta);
    LargestUpAngleDelta = Math.max(LargestUpAngleDelta, Deltas.upAngleDelta);
  }
  assert.ok(
    LargestPositionDelta < 2.5,
    `aim commit moved the camera ${LargestPositionDelta.toFixed(2)} units in one frame`,
  );
  assert.ok(
    LargestUpAngleDelta < 0.2,
    `aim commit rotated the camera up ${LargestUpAngleDelta.toFixed(3)} radians in one frame`,
  );
  assert.ok(
    Math.abs(host.Camera.up.z - 1) < 0.01,
    'planning view should settle into the top-down rig',
  );
});

test('relay reveal waits for the liberation wave before panning the look target', () => {
  const { host, controller } = createHarness();
  controller.centerLandedCamera({ snap: true });
  settle(host, controller, 120);

  host.GamePhase = 'restoring';
  host.RelayRevealLookTarget = { x: 7, y: 0 };
  stepFrame(host, controller);
  assert.ok(
    Math.abs(host.DesiredCameraLookTarget.x - 7) > 1,
    'reveal pan must not begin while the liberation wave is playing',
  );

  host.GamePhase = 'attached';
  stepFrame(host, controller);
  assert.equal(host.DesiredCameraLookTarget.x, 7);
  assert.equal(host.DesiredCameraLookTarget.y, 0);
});

test('Scout pullback is a camera move, not a HUD widget', () => {
  const { host, controller } = createHarness();
  controller.centerLandedCamera({ snap: true });
  settle(host, controller, 120);
  const LandedScale = host.CameraDistanceScale;
  controller.setScoutMode(true);
  assert.ok(host.ScoutZoomScale >= 1.6, 'Scout must pull back past the landed globe');
  settle(host, controller, 90);
  assert.ok(
    host.CameraDistanceScale > LandedScale + 0.4,
    'Scout camera distance must change enough to read as a pullback',
  );
  controller.setScoutMode(false, { snapToRunner: true });
  assert.equal(host.ScoutZoomScale, 1);
});

test('reduced motion keeps instant cuts for accessibility', () => {
  const { host, controller } = createHarness({ prefersReducedMotion: true });
  controller.centerLandedCamera({ snap: true });
  stepFrame(host, controller);

  host.GamePhase = 'flying';
  host.SeedPhysicsState.position = { x: 8, y: 2, z: 0 };
  stepFrame(host, controller);
  assert.ok(
    Math.abs(host.Camera.position.x - host.CameraLookTarget.x) < 0.001,
    'reduced motion should track the look target exactly',
  );
});

test('walking around Haven keeps world +Z up and does not orbit the globe', () => {
  const { host, controller } = createHarness();
  controller.centerLandedCamera({ snap: true });
  settle(host, controller, 180);
  const World = host.WorldDefinitions[0];
  const SettledCamera = host.Camera.position.clone();
  let LargestUpAngleDelta = 0;
  const WalkSamples = [
    { x: 3, y: 0, z: 0 },
    { x: 0, y: 3, z: 0 },
    { x: -3, y: 0, z: 0 },
    { x: 0, y: -3, z: 0 },
    { x: 0, y: 0, z: 3 },
    { x: 0, y: 0, z: -3 },
    { x: 2.1, y: 2.1, z: 0 },
  ];
  for (const Sample of WalkSamples) {
    host.SeedPhysicsState.position = Sample;
    for (let FrameIndex = 0; FrameIndex < 12; FrameIndex += 1) {
      const Deltas = stepFrame(host, controller);
      LargestUpAngleDelta = Math.max(LargestUpAngleDelta, Deltas.upAngleDelta);
    }
    assert.ok(Math.abs(host.Camera.up.z - 1) < 1e-6, 'walking must keep Camera.up on world +Z');
    assert.ok(
      Math.hypot(host.Camera.position.x - World.position.x, host.Camera.position.y - World.position.y)
        < World.radius,
      'landed camera must stay over the planet instead of orbiting with the Runner',
    );
  }
  assert.ok(
    LargestUpAngleDelta < 0.02,
    `walking rotated the camera up ${LargestUpAngleDelta.toFixed(3)} radians`,
  );
  assert.ok(
    host.Camera.position.distanceTo(SettledCamera) < 0.2,
    'walking should not bounce the landed camera to a second pose',
  );
});

test('Scout and aim share the same +Z up without bouncing between poses', () => {
  const { host, controller } = createHarness();
  controller.centerLandedCamera({ snap: true });
  settle(host, controller, 180);
  assert.ok(Math.abs(host.Camera.up.z - 1) < 1e-6);

  controller.setScoutMode(true);
  let LargestPositionDelta = 0;
  let LargestUpAngleDelta = 0;
  for (let FrameIndex = 0; FrameIndex < 180; FrameIndex += 1) {
    const Deltas = stepFrame(host, controller);
    LargestPositionDelta = Math.max(LargestPositionDelta, Deltas.positionDelta);
    LargestUpAngleDelta = Math.max(LargestUpAngleDelta, Deltas.upAngleDelta);
    assert.ok(Math.abs(host.Camera.up.z - 1) < 1e-6);
  }
  assert.ok(
    LargestUpAngleDelta < 0.02,
    `Scout rotated the camera up ${LargestUpAngleDelta.toFixed(3)} radians`,
  );
  assert.ok(
    LargestPositionDelta < 2.5,
    `Scout moved the camera ${LargestPositionDelta.toFixed(2)} units in one frame`,
  );

  controller.setScoutMode(false, { snapToRunner: true });
  settle(host, controller, 90);
  host.IsPointerAiming = true;
  controller.commitAimPlanningCamera();
  LargestPositionDelta = 0;
  LargestUpAngleDelta = 0;
  for (let FrameIndex = 0; FrameIndex < 180; FrameIndex += 1) {
    const Deltas = stepFrame(host, controller);
    LargestPositionDelta = Math.max(LargestPositionDelta, Deltas.positionDelta);
    LargestUpAngleDelta = Math.max(LargestUpAngleDelta, Deltas.upAngleDelta);
    assert.ok(Math.abs(host.Camera.up.z - 1) < 1e-6);
  }
  assert.ok(
    LargestUpAngleDelta < 0.02,
    `aim commit rotated the camera up ${LargestUpAngleDelta.toFixed(3)} radians`,
  );
  assert.ok(
    LargestPositionDelta < 2.5,
    `aim commit moved the camera ${LargestPositionDelta.toFixed(2)} units in one frame`,
  );
});
