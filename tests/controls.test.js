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
  classifyLandedPointerStart,
  LandedPointerTargets,
  SeedScreenGrabRadiusPixels,
  SeedOnGlobeGrabRadiusPixels,
  SeedOnGlobeGrabMinRadiusPixels,
  SeedOnGlobeGrabWorldRadiusScale,
  getLandedShipGrabRadiusPixels,
  CageScreenGrabRadiusPixels,
  getLandedCageGrabRadiusPixels,
  doLandedCageAndShipHalosOverlap,
  clampLandedCameraPanOffset,
  createSurfacePose,
  flattenSurfacePoseToEquator,
  getSphereSurfacePosition,
  getSurfaceDirection,
  getGreatCircleAngle,
  getSurfacePoseFromDirection,
  getSurfaceWalkArcLimit,
  getSurfaceWalkPointerArcLimit,
  hasLeftSurfaceWalkDeadzone,
  SurfaceWalkTapRadians,
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
  KeyboardAimCoarseDegrees,
  KeyboardAimFineDegrees,
  KeyboardAimRepeatDegrees,
  isLaunchKeyboardEvent,
  isSpaceKeyboardEvent,
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

test('keyboard aim starts at mid power so W and S both change the throw', () => {
  const AimState = createKeyboardAimState({ directionX: 0, directionY: 4 });
  const DragVector = getKeyboardAimDragVector(AimState, 6.25);

  assert.ok(Math.abs(AimState.angleRadians - (Math.PI / 2)) < 1e-12);
  assert.equal(AimState.powerRatio, 0.62);
  assert.ok(Math.abs(DragVector.x) < 1e-12);
  assert.ok(Math.abs(DragVector.y - (6.25 * 0.62)) < 1e-12);
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
    FineState.angleRadians - ((Math.PI * 2) - ((KeyboardAimCoarseDegrees - KeyboardAimFineDegrees) * Math.PI / 180)),
  ) < 1e-12);
});

test('keyboard A/D stays free and does not snap back toward a neighbour bearing', () => {
  const NeighbourAngle = Math.PI / 2;
  let AimState = createKeyboardAimState({ directionX: 1, directionY: 0, powerRatio: 0.62 });
  for (let Step = 0; Step < 40; Step += 1) {
    AimState = adjustKeyboardAimState(AimState, { rotationDirection: 1 });
  }
  const Expected = (40 * KeyboardAimCoarseDegrees * Math.PI / 180) % (Math.PI * 2);
  assert.ok(Math.abs(AimState.angleRadians - Expected) < 1e-12);
  assert.ok(Math.abs(AimState.angleRadians - NeighbourAngle) > 0.2);
});

test('held keyboard steering uses a larger repeat step than a tap', () => {
  const Start = createKeyboardAimState({ directionX: 1, directionY: 0 });
  const Tap = adjustKeyboardAimState(Start, { rotationDirection: 1 });
  const Held = adjustKeyboardAimState(Start, { rotationDirection: 1, repeat: true });
  const TapDelta = Math.abs(Tap.angleRadians - Start.angleRadians);
  const HeldDelta = Math.abs(Held.angleRadians - Start.angleRadians);
  assert.ok(Math.abs(TapDelta - (KeyboardAimCoarseDegrees * Math.PI / 180)) < 1e-12);
  assert.ok(Math.abs(HeldDelta - (KeyboardAimRepeatDegrees * Math.PI / 180)) < 1e-12);
  assert.ok(HeldDelta > TapDelta);
});

test('Enter, Numpad Enter and Space are launch keys', () => {
  assert.equal(isLaunchKeyboardEvent({ key: 'Enter', code: 'Enter' }), true);
  assert.equal(isLaunchKeyboardEvent({ key: 'Enter', code: 'NumpadEnter' }), true);
  assert.equal(isLaunchKeyboardEvent({ key: ' ', code: 'Space' }), true);
  assert.equal(isLaunchKeyboardEvent({ key: 'Unidentified', code: 'Enter' }), true);
  assert.equal(isLaunchKeyboardEvent({ key: 'a', code: 'KeyA' }), false);
  assert.equal(isSpaceKeyboardEvent({ key: ' ', code: 'Space' }), true);
  assert.equal(isSpaceKeyboardEvent({ key: 'Enter', code: 'Enter' }), false);
});

test('keyboard W/S from mid power changes drag length in both directions', () => {
  const Start = createKeyboardAimState({ directionX: 1, directionY: 0 });
  const Stronger = adjustKeyboardAimState(Start, { powerDirection: 1 });
  const Weaker = adjustKeyboardAimState(Start, { powerDirection: -1 });
  assert.ok(Stronger.powerRatio > Start.powerRatio);
  assert.ok(Weaker.powerRatio < Start.powerRatio);
  assert.ok(
    getKeyboardAimDragVector(Stronger, 6.25).x > getKeyboardAimDragVector(Start, 6.25).x,
  );
  assert.ok(
    getKeyboardAimDragVector(Weaker, 6.25).x < getKeyboardAimDragVector(Start, 6.25).x,
  );
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

test('visible-face sphere hits ignore the far side and origin-inside rays', () => {
  const World = { x: 0, y: 0, z: 0 };
  const Front = intersectRaySphere(
    { x: 0, y: 0, z: 4 },
    { x: 0, y: 0, z: -1 },
    World,
    2,
    { nearOnly: true },
  );
  assert.ok(Front);
  assert.ok(Math.abs(Front.z - 2) < 1e-9);
  const Inside = intersectRaySphere(
    { x: 0, y: 0, z: 0.2 },
    { x: 0, y: 0, z: -1 },
    World,
    2,
    { nearOnly: true },
  );
  assert.equal(Inside, null);
  const Miss = intersectRaySphere(
    { x: 4, y: 0, z: 4 },
    { x: 1, y: 0, z: 0 },
    World,
    2,
    { nearOnly: true },
  );
  assert.equal(Miss, null);
});

test('pointer walk ramps from a dead-zone so a flick cannot sling around the globe', () => {
  const Start = createSurfacePose({ longitude: 0, latitude: 0 });
  const Far = createSurfacePose({ longitude: Math.PI, latitude: 0 });
  assert.equal(hasLeftSurfaceWalkDeadzone(Start, Start), false);
  assert.equal(hasLeftSurfaceWalkDeadzone(Start, Far), true);
  assert.equal(getSurfaceWalkPointerArcLimit(1 / 60, 0), 0);
  const Early = getSurfaceWalkPointerArcLimit(1 / 60, 0.05);
  const Cruise = getSurfaceWalkPointerArcLimit(1 / 60, 1);
  assert.ok(Early < Cruise);
  assert.ok(Cruise <= getSurfaceWalkArcLimit(1 / 60) + 1e-12);
  const FlickTravel = getSurfaceWalkPointerArcLimit(0.05, 0.08);
  assert.ok(FlickTravel < 0.04);
});

test('keyboard walk can share the pointer cruise step size', () => {
  const Start = createSurfacePose({ longitude: 0, latitude: 0 });
  const Tapped = adjustSurfacePose(Start, { east: 1 });
  assert.ok(Math.abs(Tapped.longitude - SurfaceWalkTapRadians) < 1e-12);
  const Held = adjustSurfacePose(Start, { east: 1, stepRadians: getSurfaceWalkArcLimit(1 / 60) });
  assert.ok(Math.abs(Held.longitude - getSurfaceWalkArcLimit(1 / 60)) < 1e-12);
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

test('landed pointer-down locks ship, world or space before the drag moves', () => {
  assert.equal(classifyLandedPointerStart({
    isOverShip: true,
    isOverWorld: true,
  }), LandedPointerTargets.ship);
  assert.equal(classifyLandedPointerStart({
    isOverShip: false,
    isOverWorld: true,
  }), LandedPointerTargets.world);
  assert.equal(classifyLandedPointerStart({
    isOverShip: false,
    isOverWorld: false,
  }), LandedPointerTargets.space);
  assert.equal(classifyLandedPointerStart({
    isOverShip: false,
    isOverCage: true,
    isOverWorld: true,
  }), LandedPointerTargets.cage);
  assert.equal(classifyLandedPointerStart({
    isOverShip: true,
    isOverCage: true,
    isOverWorld: true,
  }), LandedPointerTargets.cage);
  assert.equal(classifyLandedPointerStart({
    isOverShip: true,
    isOverShipMesh: true,
    isOverCage: true,
    isOverWorld: true,
  }), LandedPointerTargets.ship);
  assert.ok(SeedScreenGrabRadiusPixels > 44);
});

test('landed ship grab stays small on the visible crust so planet drags can walk', () => {
  assert.equal(getLandedShipGrabRadiusPixels({ isOverWorld: false }), SeedScreenGrabRadiusPixels);
  const OnGlobe = getLandedShipGrabRadiusPixels({
    isOverWorld: true,
    worldScreenRadiusPixels: 220,
  });
  assert.equal(
    OnGlobe,
    Math.min(
      SeedOnGlobeGrabRadiusPixels,
      Math.max(SeedOnGlobeGrabMinRadiusPixels, 220 * SeedOnGlobeGrabWorldRadiusScale),
    ),
  );
  assert.ok(OnGlobe <= SeedOnGlobeGrabRadiusPixels);
  assert.ok(OnGlobe < SeedScreenGrabRadiusPixels);
  const TightDisc = getLandedShipGrabRadiusPixels({
    isOverWorld: true,
    worldScreenRadiusPixels: 48,
  });
  assert.equal(TightDisc, SeedOnGlobeGrabMinRadiusPixels);
  assert.ok(TightDisc < 48 * 0.7);
  assert.equal(classifyLandedPointerStart({
    isOverShip: false,
    isOverWorld: true,
  }), LandedPointerTargets.world);
});

test('a filling phone globe grabs the parked hull, not a fraction of the world disc', () => {
  assert.equal(SeedOnGlobeGrabRadiusPixels, 48);
  assert.equal(SeedOnGlobeGrabMinRadiusPixels, 28);
  assert.equal(SeedOnGlobeGrabWorldRadiusScale, 0.22);
  const FillingRadius = 195;
  const Hull = getLandedShipGrabRadiusPixels({
    isOverWorld: true,
    worldScreenRadiusPixels: FillingRadius,
  });
  assert.equal(
    Hull,
    Math.min(
      SeedOnGlobeGrabRadiusPixels,
      Math.max(SeedOnGlobeGrabMinRadiusPixels, FillingRadius * SeedOnGlobeGrabWorldRadiusScale),
    ),
  );
  assert.ok(Hull <= SeedOnGlobeGrabRadiusPixels);
  assert.ok(Hull < FillingRadius * 0.25);
  const InVoidBesideGlobe = getLandedShipGrabRadiusPixels({
    isOverWorld: false,
    worldScreenRadiusPixels: FillingRadius,
  });
  assert.equal(InVoidBesideGlobe, Hull);
  const Occupancy = (Math.PI * Hull * Hull) / (390 * 844);
  assert.ok(Occupancy < 0.02);
  const SmallScout = getLandedShipGrabRadiusPixels({
    isOverWorld: false,
    worldScreenRadiusPixels: 40,
  });
  assert.equal(SmallScout, SeedScreenGrabRadiusPixels);
});

test('a cage under the finger beats the ship halo, and leftover cages sit outside that halo', () => {
  assert.equal(CageScreenGrabRadiusPixels, 88);
  const PhoneGlobe = getLandedCageGrabRadiusPixels({
    worldScreenRadiusPixels: 140,
  });
  assert.equal(PhoneGlobe, 88);
  const ShipHalo = getLandedShipGrabRadiusPixels({
    isOverWorld: true,
    worldScreenRadiusPixels: 140,
  });
  assert.ok(PhoneGlobe > ShipHalo);
  assert.equal(doLandedCageAndShipHalosOverlap({
    angularSeparationRadians: 0.4,
    worldScreenRadiusPixels: 140,
  }), true);
  assert.equal(doLandedCageAndShipHalosOverlap({
    angularSeparationRadians: 1.5,
    worldScreenRadiusPixels: 140,
  }), false);
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

test('landed empty-space pans stay inside the current world so the courier cannot leave the frame', () => {
  assert.deepEqual(clampLandedCameraPanOffset({ x: 0.2, y: 0 }, 4), { x: 0.2, y: 0 });
  const Clamped = clampLandedCameraPanOffset({ x: 10, y: 0 }, 4);
  assert.ok(Math.abs(Clamped.x - 1.68) < 1e-12);
  assert.equal(Clamped.y, 0);
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
