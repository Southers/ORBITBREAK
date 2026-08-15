import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLiberationFlashOpacity,
  getLeaderboardActionLabel,
  getPersonalBestStatus,
  getPlayfieldLabelTopMargin,
  getPublishedWardenState,
  getRelayLinkOpacity,
  getRunResourceSummary,
  getRunnerAnimationState,
  getRunnerForm,
  getRunnerPose,
  getScannerAccessibleLabel,
  getStillnessPresentation,
  getTacticalLabelHorizontalMargin,
  getWorldLandingAimLabel,
  separateOverlappingTacticalLabels,
  separateOverlappingRouteLabels,
  separateRouteLabelsFromTacticalLabels,
} from '../src/presentation.js';

test('published Warden state distinguishes exposure from final defeat', () => {
  assert.deepEqual(getPublishedWardenState('hidden'), {
    status: 'hidden',
    landmark: 'hidden',
  });
  assert.deepEqual(getPublishedWardenState('exposed'), {
    status: 'exposed',
    landmark: 'command-world-exposed',
  });
  assert.deepEqual(getPublishedWardenState('exposed', true), {
    status: 'defeated',
    landmark: 'command-world-disabled',
  });
  assert.throws(() => getPublishedWardenState(''), /requires a pursuit status/);
  assert.equal(
    getScannerAccessibleLabel({
      runnerLocation: 'at Meadow',
      activeWorldCount: 1,
      worldCount: 5,
      wardenStatus: 'hidden',
      wardenDistance: 4,
    }),
    'System scanner. Runner at Meadow. 1 of 5 relay worlds active. Warden hidden. Moving bodies tracked.',
  );
  assert.equal(
    getScannerAccessibleLabel({
      runnerLocation: 'in flight',
      activeWorldCount: 3,
      worldCount: 5,
      wardenStatus: 'pursuing',
      wardenDistance: 1,
      wardenTargetLabel: 'Frost',
    }),
    'System scanner. Runner in flight. 3 of 5 relay worlds active. Warden 1 flight away, targeting Frost. Moving bodies tracked.',
  );
  assert.throws(
    () => getScannerAccessibleLabel({
      runnerLocation: '',
      activeWorldCount: 0,
      worldCount: 5,
      wardenStatus: 'hidden',
      wardenDistance: 4,
    }),
    /requires valid runner, relay and Warden state/,
  );
});

test('rankings action discloses offline state before opening the board', () => {
  assert.equal(getLeaderboardActionLabel(true), 'Rankings');
  assert.equal(getLeaderboardActionLabel(false), 'Rankings offline');
  assert.throws(() => getLeaderboardActionLabel('false'), /requires configured state/);
});

test('nearby route labels separate without changing distant or edge-clamped layouts', () => {
  assert.deepEqual(
    separateOverlappingRouteLabels([
      { x: 160, y: 90 },
      { x: 300, y: 96 },
    ], { minimumX: 58, maximumX: 786 }),
    [{ x: 160, y: 90 }, { x: 300, y: 96 }],
  );
  assert.deepEqual(
    separateOverlappingRouteLabels([
      { x: 618, y: 91 },
      { x: 663, y: 78 },
    ], { minimumX: 58, maximumX: 786 }),
    [{ x: 602.5, y: 91 }, { x: 678.5, y: 78 }],
  );
  assert.deepEqual(
    separateOverlappingRouteLabels([
      { x: 60, y: 80 },
      { x: 64, y: 82 },
    ], { minimumX: 58, maximumX: 786 }),
    [{ x: 58, y: 80 }, { x: 134, y: 82 }],
  );
  assert.throws(
    () => separateOverlappingRouteLabels([{ x: Number.NaN, y: 4 }]),
    /requires finite positions and bounds/,
  );
});

test('route labels clear nearby tactical annotations without leaving HUD bounds', () => {
  assert.equal(getPlayfieldLabelTopMargin({
    isCompact: true,
    wardenVisible: false,
    isTactical: false,
  }), 172);
  assert.equal(getPlayfieldLabelTopMargin({
    isCompact: true,
    wardenVisible: true,
    isTactical: true,
  }), 246);
  assert.equal(getPlayfieldLabelTopMargin({
    isCompact: false,
    wardenVisible: true,
    isTactical: false,
  }), 212);
  assert.throws(
    () => getPlayfieldLabelTopMargin({
      isCompact: 'true',
      wardenVisible: false,
      isTactical: false,
    }),
    /requires boolean layout state/,
  );
  assert.equal(getTacticalLabelHorizontalMargin('SEEDSTONE · 1 USE'), 72);
  assert.equal(getTacticalLabelHorizontalMargin('SEEDSTONE · MOVING · 1 USE'), 108);
  assert.throws(() => getTacticalLabelHorizontalMargin(' '), /requires visible text/);
  assert.deepEqual(
    separateRouteLabelsFromTacticalLabels(
      [{ x: 100, y: -20 }],
      [],
      { minimumY: 70, maximumY: 638 },
    ),
    [{ x: 100, y: 70 }],
  );
  assert.deepEqual(
    separateRouteLabelsFromTacticalLabels(
      [{ x: 342, y: 172 }, { x: 100, y: 300 }],
      [{ x: 328, y: 159 }],
      { minimumY: 172, maximumY: 732 },
    ),
    [{ x: 342, y: 189 }, { x: 100, y: 300 }],
  );
  assert.deepEqual(
    separateRouteLabelsFromTacticalLabels(
      [{ x: 200, y: 190 }],
      [{ x: 205, y: 180 }, { x: 195, y: 210 }],
      { minimumY: 140, maximumY: 500 },
    ),
    [{ x: 200, y: 150 }],
  );
  assert.deepEqual(
    separateOverlappingTacticalLabels(
      [{ x: 328, y: 159 }, { x: 316, y: 150 }, { x: 80, y: 152 }],
      {
        horizontalClearance: 160,
        verticalClearance: 28,
        minimumY: 116,
        maximumY: 732,
      },
    ),
    [{ x: 328, y: 159 }, { x: 316, y: 131 }, { x: 80, y: 152 }],
  );
  assert.throws(
    () => separateRouteLabelsFromTacticalLabels([{ x: 1, y: 2 }], [{ x: 3, y: Infinity }]),
    /requires finite positions and bounds/,
  );
});

test('relay links retain a bright bounded pulse for system-scale readability', () => {
  assert.equal(getRelayLinkOpacity(0), 0.8);
  assert.ok(Math.abs(getRelayLinkOpacity(Math.PI / 4.8) - 0.9) < 1e-12);
  assert.ok(Math.abs(getRelayLinkOpacity(3 * Math.PI / 4.8) - 0.7) < 1e-12);
  assert.equal(getRelayLinkOpacity(4, { reducedMotion: true }), 0.8);
  assert.equal(getRelayLinkOpacity(40, { reducedMotion: true }), 0.8);
  assert.throws(() => getRelayLinkOpacity(Number.NaN), /finite time/);
});

test('world landing aim copy names a new destination without calling it imprisoned', () => {
  assert.equal(getWorldLandingAimLabel('Ember', true), 'Ember TARGET');
  assert.equal(getWorldLandingAimLabel('Ember', false), 'SAFE LANDING');
  assert.throws(() => getWorldLandingAimLabel(' ', true), /requires a destination/);
});

test('result status distinguishes the current verified run from an older personal best', () => {
  assert.equal(getPersonalBestStatus({
    isReplayVerified: true,
    runScore: 11250,
    personalBestScore: 12250,
  }), 'VERIFIED · RUN 11,250 · PERSONAL BEST 12,250');
  assert.equal(getPersonalBestStatus({
    isReplayVerified: true,
    runScore: 12250,
    personalBestScore: 12250,
    isNewPersonalBest: true,
  }), 'VERIFIED · NEW PERSONAL BEST · 12,250');
  assert.equal(getPersonalBestStatus({
    isReplayVerified: false,
    runScore: 0,
  }), 'UNVERIFIED REPLAY · LOCAL BEST NOT UPDATED');
  assert.equal(getPersonalBestStatus({
    isReplayVerified: true,
    runScore: 0,
  }), 'RANKED · LOCAL BEST UNAVAILABLE');
});

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
