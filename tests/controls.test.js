import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adjustKeyboardAimState,
  createKeyboardAimState,
  getKeyboardAimDragVector,
} from '../src/controls.js';

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
