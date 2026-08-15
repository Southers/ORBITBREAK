import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MotionPreferences,
  cycleMotionPreference,
  getAudioPreferencePresentation,
  getMotionPreferencePresentation,
  parseMotionPreference,
  resolveReducedMotion,
} from '../src/preferences.js';

test('motion preference fails closed to the operating-system setting', () => {
  assert.equal(parseMotionPreference(null), MotionPreferences.system);
  assert.equal(parseMotionPreference('unexpected'), MotionPreferences.system);
  assert.equal(resolveReducedMotion(MotionPreferences.system, true), true);
  assert.equal(resolveReducedMotion(MotionPreferences.system, false), false);
});

test('explicit reduced and full motion override the system without affecting other state', () => {
  assert.equal(resolveReducedMotion(MotionPreferences.reduced, false), true);
  assert.equal(resolveReducedMotion(MotionPreferences.full, true), false);
  assert.deepEqual(
    getMotionPreferencePresentation(MotionPreferences.reduced, true),
    { label: 'Motion reduced [P]', ariaPressed: 'true' },
  );
});

test('motion control cycles back to the recoverable system preference', () => {
  assert.equal(cycleMotionPreference(MotionPreferences.system), MotionPreferences.reduced);
  assert.equal(cycleMotionPreference(MotionPreferences.reduced), MotionPreferences.full);
  assert.equal(cycleMotionPreference(MotionPreferences.full), MotionPreferences.system);
  assert.deepEqual(
    getMotionPreferencePresentation(MotionPreferences.system, true),
    { label: 'Motion system · reduced [P]', ariaPressed: 'mixed' },
  );
});

test('audio preference presents the same state to button and shortcut users', () => {
  assert.deepEqual(getAudioPreferencePresentation(true), {
    label: 'Audio off [M]',
    ariaPressed: 'true',
    status: 'AUDIO OFF',
  });
  assert.deepEqual(getAudioPreferencePresentation(false), {
    label: 'Audio on [M]',
    ariaPressed: 'false',
    status: 'AUDIO ON',
  });
  assert.throws(() => getAudioPreferencePresentation('false'), /requires muted state/);
});
