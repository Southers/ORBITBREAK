import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SurfaceGestureModes,
  adjustSurfaceAngle,
  adjustKeyboardAimState,
  classifySurfaceGesture,
  createKeyboardAimState,
  findNearestKeyboardAimAngle,
  getKeyboardAimDragVector,
  getScoutZoomPresentation,
  getSurfacePosition,
  adjustSurfacePose,
  classifySphereSurfaceGesture,
  classifyPendingShipGrab,
  createSurfacePose,
  flattenSurfacePoseToEquator,
  getSphereSurfacePosition,
  getSurfaceDirection,
  getGreatCircleAngle,
  getSurfacePoseFromDirection,
  getSurfaceWalkArcLimit,
  stepSurfacePoseToward,
  intersectRaySphere,
  clampCameraZoomScale,
  getPinchZoomScale,
  getPointerClientDistance,
  getAimCameraStage,
  AimCameraStages,
  isEditingTextField,
  ShipGrabAimDeadzonePixels,
  shouldCancelAimedLaunch,
} from '../src/controls.js';

test('keyboard lead search checks the direct route then nearest alternating offsets', () => {
  const VisitedDegrees = [];
  const Result = findNearestKeyboardAimAngle(0, (AngleRadians) => {
    const Degrees = Math.round(AngleRadians * 180 / Math.PI);
    VisitedDegrees.push(Degrees);
    return Degrees === 6;
  });
  assert.equal(Math.round(Result * 180 / Math.PI), 6);
  assert.deepEqual(VisitedDegrees, [0, 2, 358, 4, 356, 6]);

  const Fallback = findNearestKeyboardAimAngle(Math.PI / 3, () => false, {
    maximumOffsetRadians: 4 * (Math.PI / 180),
  });
  assert.ok(Math.abs(Fallback - (Math.PI / 3)) < 1e-12);
});

test('keyboard aim starts toward the suggested destination at full power', () => {
  const AimState = createKeyboardAimState({ directionX: 0, directionY: 4 });
  const DragVector = getKeyboardAimDragVector(AimState, 6.25);

  assert.ok(Math.abs(AimState.angleRadians - (Math.PI / 2)) < 1e-12);
  assert.equal(AimState.powerRatio, 1);
  assert.ok(Math.abs(DragVector.x) < 1e-12);
  assert.equal(DragVector.y, 6.25);
});

test('keyboard steering wraps angles and offers coarse and fine control', () => {
  const InitialState = createKeyboardAimState({ directionX: 1, directionY: 0 });
  const CoarseState = adjustKeyboardAimState(InitialState, { rotationDirection: -1 });
  const FineState = adjustKeyboardAimState(CoarseState, {
    rotationDirection: 1,
    fine: true,
  });

  assert.ok(CoarseState.angleRadians > Math.PI);
  assert.ok(FineState.angleRadians > CoarseState.angleRadians);
  assert.ok(Math.abs(
    FineState.angleRadians - ((Math.PI * 2) - (1.5 * Math.PI / 180)),
  ) < 1e-12);
});

test('keyboard power stays inside the launchable range', () => {
  let AimState = createKeyboardAimState({ powerRatio: 0.05 });
  for (let Step = 0; Step < 10; Step += 1) {
    AimState = adjustKeyboardAimState(AimState, { powerDirection: -1 });
  }
  assert.equal(AimState.powerRatio, 0.04);

  for (let Step = 0; Step < 100; Step += 1) {
    AimState = adjustKeyboardAimState(AimState, { powerDirection: 1 });
  }
  assert.equal(AimState.powerRatio, 1);
});

test('surface gestures distinguish rim walking from launch pulling', () => {
  const BaseGesture = {
    startPosition: { x: 3, y: 0 },
    bodyPosition: { x: 0, y: 0 },
  };
  assert.equal(classifySurfaceGesture({
    ...BaseGesture,
    currentPosition: { x: 3.05, y: 0.1 },
  }), SurfaceGestureModes.pending);
  assert.equal(classifySurfaceGesture({
    ...BaseGesture,
    currentPosition: { x: 3.08, y: 0.9 },
  }), SurfaceGestureModes.walk);
  assert.equal(classifySurfaceGesture({
    ...BaseGesture,
    currentPosition: { x: 2.1, y: 0.08 },
  }), SurfaceGestureModes.aim);
});

test('pointer and keyboard surface movement stay on one deterministic circumference', () => {
  const CoarseAngle = adjustSurfaceAngle(0, 1);
  const FineAngle = adjustSurfaceAngle(CoarseAngle, -1, { fine: true });
  assert.equal(Math.round(CoarseAngle * 180 / Math.PI), 2);
  assert.equal(Math.round(FineAngle * 180 / Math.PI), 1);
  assert.deepEqual(getSurfacePosition({ x: 4, y: -2 }, 3, Math.PI / 2), {
    x: 4,
    y: 1,
    z: 0,
  });
});

test('sphere walking crosses the poles and flattens back to the equator for launch', () => {
  const Equator = createSurfacePose({ longitude: 0, latitude: 0 });
  const North = adjustSurfacePose(Equator, { north: 1 });
  assert.ok(North.latitude > 0);
  let Pose = Equator;
  for (let Step = 0; Step < 90; Step += 1) {
    Pose = adjustSurfacePose(Pose, { north: 1 });
  }
  assert.ok(Math.abs(Pose.latitude) < 0.2);
  assert.ok(Math.abs(Math.abs(Pose.longitude) - Math.PI) < 0.2);
  for (let Step = 0; Step < 10; Step += 1) {
    Pose = adjustSurfacePose(Pose, { north: 1 });
  }
  assert.ok(Pose.latitude < 0);
  assert.ok(Pose.latitude > -Math.PI / 2);
  const Direction = getSurfaceDirection(Pose);
  assert.ok(Direction.x < 0);
  const SpherePoint = getSphereSurfacePosition({ x: 0, y: 0, z: 0 }, 2, Pose);
  assert.ok(Math.abs(Math.hypot(SpherePoint.x, SpherePoint.y, SpherePoint.z) - 2) < 1e-9);
  const Flattened = flattenSurfacePoseToEquator(Pose);
  assert.equal(Flattened.latitude, 0);
  assert.equal(Flattened.longitude, Pose.longitude);
  const FromDirection = getSurfacePoseFromDirection({ x: 0, y: 0, z: 1 });
  assert.ok(Math.abs(FromDirection.latitude - (Math.PI / 2)) < 1e-9);
});

test('sphere walking steps toward a far hit instead of snapping across the globe', () => {
  const Start = createSurfacePose({ longitude: 0, latitude: 0 });
  const Opposite = createSurfacePose({ longitude: Math.PI, latitude: 0 });
  const Limited = stepSurfacePoseToward(Start, Opposite, 0.2);
  assert.ok(getGreatCircleAngle(Start, Limited) < 0.21);
  assert.ok(getGreatCircleAngle(Limited, Opposite) > 2);
  const Arrived = stepSurfacePoseToward(Start, createSurfacePose({ longitude: 0.05, latitude: 0 }), 0.2);
  assert.ok(Math.abs(Arrived.longitude - 0.05) < 1e-9);
  assert.equal(getSurfaceWalkArcLimit(0), 0);
  assert.ok(getSurfaceWalkArcLimit(1) <= 0.12);
});

test('a ray hitting the globe walks and a pull into space aims', () => {
  const World = { x: 0, y: 0, z: 0 };
  const Hit = intersectRaySphere(
    { x: 4, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    World,
    2,
  );
  assert.ok(Hit);
  assert.ok(Math.abs(Hit.x - 2) < 1e-9);
  assert.equal(classifySphereSurfaceGesture({
    worldCenter: World,
    worldRadius: 2,
    startPosition: { x: 2, y: 0, z: 0 },
    sphereHit: { x: 0, y: 2, z: 0 },
    planePosition: { x: 0, y: 2 },
  }), SurfaceGestureModes.walk);
  assert.equal(classifySphereSurfaceGesture({
    worldCenter: World,
    worldRadius: 2,
    startPosition: { x: 2, y: 0, z: 0 },
    sphereHit: null,
    planePosition: { x: 3.2, y: 0 },
  }), SurfaceGestureModes.aim);
});

test('a ship grab aims from a screen pull even while the globe is still under the pointer', () => {
  assert.equal(classifyPendingShipGrab({
    screenDistanceFromShip: 10,
  }), SurfaceGestureModes.pending);
  assert.equal(classifyPendingShipGrab({
    screenDistanceFromShip: ShipGrabAimDeadzonePixels - 0.1,
  }), SurfaceGestureModes.pending);
  assert.equal(classifyPendingShipGrab({
    screenDistanceFromShip: ShipGrabAimDeadzonePixels,
  }), SurfaceGestureModes.aim);
  assert.equal(classifyPendingShipGrab({
    screenDistanceFromShip: 25,
  }), SurfaceGestureModes.aim);
  assert.notEqual(classifyPendingShipGrab({
    screenDistanceFromShip: 25,
  }), SurfaceGestureModes.walk);
  assert.throws(
    () => classifyPendingShipGrab({ screenDistanceFromShip: -1 }),
    /non-negative screen distance/,
  );
});

test('aim keeps the globe camera until the pull leaves cancel, then stays on the map', () => {
  assert.equal(getAimCameraStage({
    willCancel: true,
    hasCommitted: false,
  }), AimCameraStages.globe);
  assert.equal(getAimCameraStage({
    willCancel: false,
    hasCommitted: false,
  }), AimCameraStages.planning);
  assert.equal(getAimCameraStage({
    willCancel: true,
    hasCommitted: true,
  }), AimCameraStages.planning);
  assert.equal(getAimCameraStage({
    willCancel: true,
    hasCommitted: false,
    prefersReducedMotion: true,
  }), AimCameraStages.planning);
});

test('Scout zoom presentation announces percentage and marks only reached limits unavailable', () => {
  assert.deepEqual(getScoutZoomPresentation(1), {
    percentage: 100,
    status: 'Scout zoom 100%',
    zoomInLabel: 'Scout zoom in, currently 100%',
    zoomOutLabel: 'Scout zoom out, currently 100%',
    canZoomIn: true,
    canZoomOut: true,
  });
  assert.equal(getScoutZoomPresentation(0.38).percentage, 263);
  assert.equal(getScoutZoomPresentation(0.38).canZoomIn, false);
  assert.equal(getScoutZoomPresentation(1.95).percentage, 51);
  assert.equal(getScoutZoomPresentation(1.95).canZoomOut, false);
  assert.throws(() => getScoutZoomPresentation(0.2), /inside valid bounds/);
});

test('pinch zoom spreads to zoom in and pinches to zoom out', () => {
  assert.equal(clampCameraZoomScale(0.2), 0.38);
  assert.equal(clampCameraZoomScale(4), 1.95);
  assert.ok(getPinchZoomScale(100, 200, 1) < 1);
  assert.ok(getPinchZoomScale(100, 50, 1) > 1);
  assert.equal(getPointerClientDistance(
    { clientX: 0, clientY: 0 },
    { clientX: 3, clientY: 4 },
  ), 5);
});

test('returning the pull onto the ship cancels launch', () => {
  assert.equal(shouldCancelAimedLaunch({ pointerDistanceFromShip: 0.2 }), true);
  assert.equal(shouldCancelAimedLaunch({ pointerDistanceFromShip: 0.85 }), true);
  assert.equal(shouldCancelAimedLaunch({ pointerDistanceFromShip: 0.86 }), false);
  assert.throws(() => shouldCancelAimedLaunch({ pointerDistanceFromShip: -1 }), /non-negative/);
});

test('a zoomed-out aim still cancels inside a constant screen disk around the ship', () => {
  assert.equal(shouldCancelAimedLaunch({
    pointerDistanceFromShip: 2,
    screenDistancePixels: 40,
  }), true);
  assert.equal(shouldCancelAimedLaunch({
    pointerDistanceFromShip: 2,
    screenDistancePixels: 53,
  }), false);
  assert.throws(() => shouldCancelAimedLaunch({
    pointerDistanceFromShip: 2,
    screenDistancePixels: -1,
  }), /non-negative screen distance/);
});

test('game hotkeys yield to typing in callsign and other text fields', () => {
  assert.equal(isEditingTextField({ tagName: 'INPUT', type: 'text' }), true);
  assert.equal(isEditingTextField({ tagName: 'TEXTAREA' }), true);
  assert.equal(isEditingTextField({ tagName: 'SELECT' }), true);
  assert.equal(isEditingTextField({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isEditingTextField({ tagName: 'BUTTON' }), false);
  assert.equal(isEditingTextField({ tagName: 'CANVAS' }), false);
  assert.equal(isEditingTextField(null), false);
});
