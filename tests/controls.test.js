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
  assert.equal(Math.round(CoarseAngle * 180 / Math.PI), 4);
  assert.equal(Math.round(FineAngle * 180 / Math.PI), 3);
  assert.deepEqual(getSurfacePosition({ x: 4, y: -2 }, 3, Math.PI / 2), {
    x: 4,
    y: 1,
    z: 0,
  });
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
