import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLiberationFlashOpacity,
  getRunnerAnimationState,
  getRunnerPose,
  getStillnessPresentation,
} from '../src/presentation.js';

test('Runner state prioritises recovery, liberation, flight and aim', () => {
  assert.equal(getRunnerAnimationState('runFailed', true), 'recovering');
  assert.equal(getRunnerAnimationState('restoring', false), 'liberating');
  assert.equal(getRunnerAnimationState('flying', true), 'flying');
  assert.equal(getRunnerAnimationState('attached', true), 'aiming');
  assert.equal(getRunnerAnimationState('attached', false), 'ready');
});

test('Runner poses expose thruster only during flight', () => {
  assert.equal(getRunnerPose('flying').thrusterVisible, true);
  assert.equal(getRunnerPose('aiming').thrusterVisible, false);
  assert.ok(getRunnerPose('liberating').armAngle > getRunnerPose('ready').armAngle);
});

test('Stillness cage visibly expands and vanishes through liberation', () => {
  assert.deepEqual(getStillnessPresentation(false), {
    visible: true,
    opacity: 0.22,
    scale: 1,
  });
  const Halfway = getStillnessPresentation(true, 0.5);
  assert.equal(Halfway.visible, true);
  assert.ok(Halfway.opacity > 0 && Halfway.opacity < 0.22);
  assert.equal(Halfway.scale, 1.11);
  assert.deepEqual(getStillnessPresentation(true, 1), {
    visible: false,
    opacity: 0,
    scale: 1.22,
  });
});

test('liberation flash remains bounded and reaches zero', () => {
  assert.equal(getLiberationFlashOpacity(0), 0);
  assert.equal(getLiberationFlashOpacity(-1), 0);
  assert.ok(getLiberationFlashOpacity(0.36) > 0);
  assert.ok(getLiberationFlashOpacity(0.72) <= 1);
});
