import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLiberationFlashOpacity,
  getLeaderboardActionLabel,
  getPersonalBestStatus,
  getPlayfieldLabelTopMargin,
  getPlayfieldLabelVerticalBounds,
  getPublishedWardenState,
  getRelayCourierTravelProgress,
  getRelayLinkOpacity,
  getRelayRevealLookTarget,
  getSectorPlanningCamera,
  getRunResourceSummary,
  getRunnerAnimationState,
  getRunnerForm,
  getRunnerPose,
  getScannerAccessibleLabel,
  getSlingshotBandVisualState,
  getSlingshotPreviewPresentation,
  getStillnessPresentation,
  getWorldLifeStage,
  getTyrantOccupationStrength,
  getExtractionFreighterTravelProgress,
  getLandedCameraScale,
  getTacticalLabelHorizontalMargin,
  getWorldLandingAimLabel,
  getLoopObjectivePresentation,
  getHiddenWardenRouteCoach,
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

test('loop objective teaches relays, then circuits, then Command', () => {
  assert.deepEqual(getLoopObjectivePresentation({
    liveRelayCount: 1,
    uniqueCircuitCount: 0,
    wardenStatus: 'hidden',
  }), {
    label: 'RELAYS',
    state: '1 / 3',
    filledPips: 1,
    pipCount: 3,
    open: false,
  });
  assert.deepEqual(getLoopObjectivePresentation({
    liveRelayCount: 2,
    uniqueCircuitCount: 0,
    wardenStatus: 'hidden',
  }).state, '2 / 3');
  assert.deepEqual(getLoopObjectivePresentation({
    liveRelayCount: 3,
    uniqueCircuitCount: 0,
    wardenStatus: 'pursuing',
  }), {
    label: 'CIRCUITS',
    state: '0 / 2',
    filledPips: 0,
    pipCount: 2,
    open: false,
  });
  assert.deepEqual(getLoopObjectivePresentation({
    liveRelayCount: 4,
    uniqueCircuitCount: 1,
    wardenStatus: 'pursuing',
  }).state, '1 / 2');
  assert.equal(getLoopObjectivePresentation({
    liveRelayCount: 5,
    uniqueCircuitCount: 2,
    wardenStatus: 'exposed',
  }).state, 'COMMAND EXPOSED');
  assert.equal(getLoopObjectivePresentation({
    liveRelayCount: 5,
    uniqueCircuitCount: 2,
    wardenStatus: 'exposed',
    isOnCommandCore: true,
  }).state, 'CORE LOCKED');
  assert.equal(getLoopObjectivePresentation({
    liveRelayCount: 5,
    uniqueCircuitCount: 2,
    wardenStatus: 'exposed',
    isCommandLiberated: true,
  }).state, 'LIBERATED');
  assert.throws(
    () => getLoopObjectivePresentation({ liveRelayCount: 1 }),
    /requires relay, circuit and Warden state/,
  );
});

test('relay reveal camera frames the new link without losing the Runner', () => {
  assert.deepEqual(getRelayRevealLookTarget({
    origin: { x: -24, y: -10 },
    destination: { x: -10, y: -9 },
    runner: { x: -13, y: -9 },
    viewportWorldWidth: 20,
    viewportWorldHeight: 24,
  }), { x: -17, y: -9.5 });
  assert.deepEqual(getRelayRevealLookTarget({
    origin: { x: 0, y: 0 },
    destination: { x: 40, y: 0 },
    runner: { x: 40, y: 0 },
    viewportWorldWidth: 20,
    viewportWorldHeight: 24,
  }), { x: 32.4, y: 0 });
  assert.throws(
    () => getRelayRevealLookTarget({
      origin: { x: 0, y: 0 },
      destination: { x: 1, y: 1 },
      runner: { x: 0, y: 0 },
      viewportWorldWidth: 0,
      viewportWorldHeight: 24,
    }),
    /positive viewport/,
  );
});

test('new relay couriers depart from the origin of the live link', () => {
  assert.deepEqual(getRelayCourierTravelProgress(0), {
    travelProgress: 0,
    isReturning: false,
  });
  assert.ok(Math.abs(getRelayCourierTravelProgress(1 / 0.11).travelProgress - 1) < 1e-12);
  assert.equal(getRelayCourierTravelProgress(1 / 0.11).isReturning, false);
  assert.equal(getRelayCourierTravelProgress(0.5 / 0.11).travelProgress, 0.5);
  assert.equal(getRelayCourierTravelProgress(1.25 / 0.11).isReturning, true);
  assert.throws(() => getRelayCourierTravelProgress(-1), /non-negative age/);
});

test('hidden Warden coach teaches the first shot then the triangulation beat', () => {
  assert.deepEqual(getHiddenWardenRouteCoach({
    liveRelayCount: 1,
    routeLabels: ['EMBER', 'FROST'],
    openingBody: 'Pull back from the Runner and release toward Ember.',
  }), {
    title: 'Choose EMBER or FROST',
    body: 'Pull back from the Runner and release toward Ember.',
  });
  assert.deepEqual(getHiddenWardenRouteCoach({
    liveRelayCount: 2,
    routeLabels: ['GROVE', 'FROST'],
  }), {
    title: 'Choose GROVE or FROST',
    body: 'One more live world and the Warden notices. Landing leaves another relay.',
  });
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
  assert.equal(getPlayfieldLabelTopMargin({
    isCompact: true,
    isShortLandscape: true,
    wardenVisible: true,
    isTactical: true,
  }), 140);
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
  assert.deepEqual(getPlayfieldLabelVerticalBounds({
    viewportHeight: 320,
    instructionTop: 203.2,
    isCompact: true,
    isShortLandscape: true,
    wardenVisible: true,
    isTactical: true,
  }), { minimumY: 140, maximumY: 187.2 });
  assert.deepEqual(getPlayfieldLabelVerticalBounds({
    viewportHeight: 844,
    instructionTop: 689.2,
    isCompact: true,
    isShortLandscape: false,
    wardenVisible: true,
    isTactical: true,
  }), { minimumY: 246, maximumY: 732 });
  assert.throws(() => getPlayfieldLabelVerticalBounds({
    viewportHeight: Number.NaN,
    instructionTop: 100,
    isCompact: true,
    isShortLandscape: true,
    wardenVisible: true,
    isTactical: true,
  }), /require a finite viewport and instruction edge/);
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

test('sector planning camera frames the whole Reach while keeping the Runner in view', () => {
  const PlanningCamera = getSectorPlanningCamera({
    runner: { x: -22, y: -8 },
    focusPoints: [
      { x: -22, y: -8 },
      { x: 18, y: 2 },
      { x: 12, y: 14 },
      { x: 24, y: 8 },
    ],
    viewportWorldWidth: 20,
    viewportWorldHeight: 24,
  });
  assert.ok(PlanningCamera.scale > 2);
  assert.ok(Math.abs(PlanningCamera.lookX - (-22)) < PlanningCamera.scale * 20 * 0.42 + 1e-9);
  assert.throws(
    () => getSectorPlanningCamera({ runner: { x: 0, y: 0 }, viewportWorldWidth: 0, viewportWorldHeight: 24 }),
    /positive viewport/,
  );
});

test('world landing aim copy names a new destination without calling it imprisoned', () => {
  assert.equal(getWorldLandingAimLabel('Ember', true), 'Ember TARGET');
  assert.equal(getWorldLandingAimLabel('Ember', false), 'SAFE LANDING');
  assert.throws(() => getWorldLandingAimLabel(' ', true), /requires a destination/);
});

test('slingshot preview names a chain only after two distinct wells', () => {
  assert.equal(getSlingshotPreviewPresentation(0), null);
  assert.deepEqual(getSlingshotPreviewPresentation(1), {
    color: 0x9be7ff,
    opacity: 0.84,
    label: 'ASSIST',
  });
  assert.equal(getSlingshotPreviewPresentation(2).label, 'CHAIN ×2');
  assert.equal(getSlingshotPreviewPresentation(5).label, 'CHAIN ×4');
  assert.throws(() => getSlingshotPreviewPresentation(-1), /scored event count/);
});

test('slingshot rings appear only while the shot can still change', () => {
  assert.deepEqual(getSlingshotBandVisualState({ isAiming: true }), {
    visible: true,
    assistOpacity: 0.22,
    razorOpacity: 0.3,
  });
  assert.equal(getSlingshotBandVisualState({ isFlying: true }).visible, true);
  assert.equal(getSlingshotBandVisualState({}).visible, false);
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
  assert.equal(getRunnerAnimationState('attached', false, true), 'walking');
});

test('Runner poses expose thruster only during flight', () => {
  assert.equal(getRunnerPose('flying').thrusterVisible, true);
  assert.equal(getRunnerPose('aiming').thrusterVisible, false);
  assert.ok(getRunnerPose('liberating').armAngle > getRunnerPose('ready').armAngle);
  assert.equal(getRunnerPose('walking', 0).thrusterVisible, false);
  assert.ok(getRunnerPose('walking', Math.PI / 2).armAngle > getRunnerPose('walking', 0).armAngle);
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

test('world life stages distinguish tyrant, isolated and living art', () => {
  assert.equal(getWorldLifeStage({ restored: false, liveLinkCount: 0 }), 'tyrant');
  assert.equal(getWorldLifeStage({ restored: false, liveLinkCount: 3 }), 'tyrant');
  assert.equal(getWorldLifeStage({ restored: true, liveLinkCount: 0 }), 'isolated');
  assert.equal(getWorldLifeStage({ restored: true, liveLinkCount: 1 }), 'living');
  assert.throws(() => getWorldLifeStage({ restored: 'yes' }), /restored flag/);
});

test('tyrant occupation collapses through the liberation wave and never returns a haul', () => {
  assert.equal(getTyrantOccupationStrength(false), 1);
  assert.equal(getTyrantOccupationStrength(true, 0), 1);
  assert.equal(getTyrantOccupationStrength(true, 0.34), 0.5);
  assert.equal(getTyrantOccupationStrength(true, 0.68), 0);
  assert.equal(getTyrantOccupationStrength(true, 1.2), 0);
  const Haul = getExtractionFreighterTravelProgress(0);
  assert.equal(Haul.isReturning, false);
  assert.equal(Haul.travelProgress, 0);
  assert.equal(Haul.opacity, 0);
  const MidHaul = getExtractionFreighterTravelProgress(1 / 0.075 / 2);
  assert.ok(MidHaul.travelProgress > 0.45 && MidHaul.travelProgress < 0.55);
  assert.equal(MidHaul.opacity, 1);
  assert.equal(MidHaul.isReturning, false);
});

test('landed camera frames one world tightly enough for surface art to read', () => {
  const EmberScale = getLandedCameraScale({ worldRadius: 3.2, viewportWorldHeight: 24 });
  assert.ok(EmberScale >= 0.42 && EmberScale <= 0.58);
  assert.ok(EmberScale < 1);
  const TinyScale = getLandedCameraScale({ worldRadius: 2.15, viewportWorldHeight: 24 });
  assert.equal(TinyScale, 0.42);
});

test('liberation flash remains bounded and reaches zero', () => {
  assert.equal(getLiberationFlashOpacity(0), 0);
  assert.equal(getLiberationFlashOpacity(-1), 0);
  assert.ok(getLiberationFlashOpacity(0.36) > 0);
  assert.ok(getLiberationFlashOpacity(0.72) <= 1);
});
