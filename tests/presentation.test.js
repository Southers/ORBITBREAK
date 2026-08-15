import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLiberationFlashOpacity,
  getRunResourceSummary,
  getRunnerAnimationState,
  getRunnerForm,
  getRunnerPose,
  getStillnessPresentation,
} from '../src/presentation.js';

test('run resource copy treats fuel as a bonus rather than a failure timer', () => {
  assert.equal(
    getRunResourceSummary({ launchesUsed: 1, remainingLaunches: 7 }),
    '1 launch · 7 bonus fuel left',
  );
  assert.equal(
    getRunResourceSummary({ launchesUsed: 7, remainingLaunches: 1 }),
    '7 launches · 1 bonus fuel left',
  );
  assert.equal(
    getRunResourceSummary({ launchesUsed: 10, remainingLaunches: 0 }),
    '10 launches · bonus fuel spent',
  );
  assert.throws(
    () => getRunResourceSummary({ launchesUsed: -1, remainingLaunches: 2 }),
    /valid run state/,
  );
});

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

test('Runner transformation changes silhouette without changing gameplay phase', () => {
  assert.equal(getRunnerForm('attached', 0), 'astronaut');
  assert.equal(getRunnerForm('flying', 0.1), 'launch-craft');
  assert.equal(getRunnerForm('flying', 0.3), 'ship');
  assert.equal(getRunnerForm('recovering', 4), 'astronaut');
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
