import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  getControlModePresentation,
  getLiberationFlashOpacity,
  getLeaderboardActionLabel,
  getPersonalBestStatus,
  getPlayfieldLabelTopMargin,
  getPlayfieldLabelVerticalBounds,
  getPublishedWardenState,
  getRelayCourierTravelProgress,
  getCourierDockWorldRole,
  getRelayLinkOpacity,
  getPlanningAtmosphere,
  getPlanningFocusWorldIdentifiers,
  getRelayRevealHoldDurationSeconds,
  getRelayRevealLookTarget,
  getRunUnlockState,
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
  getProsperityStage,
  getTradeHullKind,
  getLiveLinkShipCount,
  getTradeHullScale,
  getTradeHullColor,
  getProsperityPresence,
  getProsperityBuildingKind,
  getProsperityBuildingProfile,
  getProsperityBuildingFamily,
  getDerivedOccupationLatitude,
  resolveOccupationSite,
  listOccupationSites,
  getSphereLifePlacement,
  getInhabitantSurfaceSite,
  getTradeHullFamily,
  getLivingInhabitantSlotCount,
  shouldShowInhabitantSlot,
  getInhabitantSilhouette,
  getWorldLifeAudioMix,
  getStoryMusicStage,
  isInnerClusterLive,
  isFurtherReachLive,
  getRangeVeilStrength,
  getTyrantOccupationStrength,
  getExtractionFreighterTravelProgress,
  getLandedCameraScale,
  getLandedSurfaceCameraPose,
  getActiveViewZoomMinimumScale,
  LandedMinimumZoomScale,
  ScoutMinimumZoomScale,
  getFlightCameraScale,
  getFlightFollowFrame,
  getOccupiedAtmosphereOpacity,
  getWorldSurfaceFinish,
  shouldShowPlayfieldWorldLabels,
  collapsePlayfieldLabelBox,
  isPlayfieldLabelBoxCollapsed,
  isProjectedLabelInsideWorldDisc,
  getTacticalLabelHorizontalMargin,
  getRouteLabelHorizontalMargin,
  shouldPlayOpeningBriefing,
  getWorldLandingAimLabel,
  getLaunchFacingPresentation,
  getFirstRunCoachPresentation,
  getLandedVerbHighlight,
  getLoopObjectivePresentation,
  getHiddenWardenRouteCoach,
  getPursuitRouteCoach,
  getWardenApproachCopy,
  getWardenTrackPips,
  getStoryBoardCameraFocus,
  getOpeningBriefingPresentation,
  getStoryBoardPresentation,
  formatStoryBoardCopy,
  getTriggeredCampaignStoryBoardIds,
  isCampaignStoryBoardReadyToPresent,
  isCriticalStoryBoard,
  getCloseViewPresentation,
  getCageClearPulseDurationSeconds,
  StoryBoardsAllowedDuringEncounter,
  shouldAssistCommandLock,
  shouldHoldCommittedPrediction,
  separateOverlappingTacticalLabels,
  separateOverlappingRouteLabels,
  separateRouteLabelsFromTacticalLabels,
} from '../src/presentation.js';
import { BreakerReachSystemDefinition } from '../src/content.js';

const BreakerReachCluster = {
  innerClusterWorldIdentifiers: BreakerReachSystemDefinition.innerClusterWorldIdentifiers,
  furtherReachWorldIdentifiers: BreakerReachSystemDefinition.furtherReachWorldIdentifiers,
  commandWorldIdentifier: 'worldheart',
};

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

test('loop objective teaches the neighbourhood before circuits and Command', () => {
  assert.deepEqual(getLoopObjectivePresentation({
    liveRelayCount: 1,
    uniqueCircuitCount: 0,
    wardenStatus: 'hidden',
  }), {
    label: 'NEIGHBOURHOOD',
    state: 'QUIET',
    filledPips: 0,
    pipCount: 0,
    open: false,
  });
  assert.equal(getLoopObjectivePresentation({
    liveRelayCount: 2,
    uniqueCircuitCount: 0,
    wardenStatus: 'hidden',
  }).state, 'WAKING');
  assert.equal(getLoopObjectivePresentation({
    liveRelayCount: 3,
    uniqueCircuitCount: 0,
    wardenStatus: 'hidden',
  }).state, 'TALKING');
  assert.deepEqual(getLoopObjectivePresentation({
    liveRelayCount: 3,
    uniqueCircuitCount: 0,
    wardenStatus: 'pursuing',
  }), {
    label: 'CLOSE LOOPS',
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
    isDocked: false,
  });
  assert.ok(Math.abs(getRelayCourierTravelProgress(1 / 0.11).travelProgress - 1) < 1e-12);
  assert.equal(getRelayCourierTravelProgress(1 / 0.11).isReturning, false);
  assert.equal(getRelayCourierTravelProgress(0.5 / 0.11).travelProgress, 0.5);
  assert.equal(getRelayCourierTravelProgress(1.25 / 0.11).isReturning, true);
  const DockedArrival = getRelayCourierTravelProgress(1 / 0.11, { dwellRatio: 0.12 });
  assert.equal(DockedArrival.isDocked, true);
  assert.equal(DockedArrival.travelProgress, 1);
  assert.equal(getCourierDockWorldRole(DockedArrival), 'destination');
  const DockedOrigin = getRelayCourierTravelProgress(0, { dwellRatio: 0.12 });
  assert.equal(DockedOrigin.isDocked, true);
  assert.equal(getCourierDockWorldRole(DockedOrigin), 'origin');
  assert.equal(getCourierDockWorldRole({ travelProgress: 1, isDocked: false }), null);
  assert.throws(() => getRelayCourierTravelProgress(-1), /non-negative age/);
});

test('opening briefing names the Runner, the Reach and the charge', () => {
  const Pages = [
    {
      speaker: 'THE WARDEN',
      kicker: 'SECTOR BROADCAST',
      portrait: 'warden',
      title: 'Travel is forbidden.',
      body: 'Silence keeps you safe.',
    },
    {
      speaker: 'THE RUNNER',
      kicker: 'STOLEN COURIER',
      portrait: 'runner',
      title: 'I stole the last ship.',
      body: 'This is the Orbitbreaker.',
    },
  ];
  const First = getOpeningBriefingPresentation(Pages, 0);
  assert.equal(First.speaker, 'THE WARDEN');
  assert.equal(First.tone, 'warden');
  assert.equal(First.continueLabel, 'Continue');
  assert.equal(First.progressLabel, '1 / 2');
  assert.match(First.portraitSrc, /warden-portrait/);
  const Last = getOpeningBriefingPresentation(Pages, 1);
  assert.equal(Last.isLast, true);
  assert.equal(Last.continueLabel, 'Take the Orbitbreaker');
  assert.throws(() => getOpeningBriefingPresentation([], 0), /at least one/);
});

test('campaign story boards queue hope, then hunt, then Command', () => {
  assert.equal(formatStoryBoardCopy('They took {world}.', { world: 'Frost' }), 'They took Frost.');
  assert.equal(formatStoryBoardCopy('They took {world}.'), 'They took {world}.');
  const EmberPage = getStoryBoardPresentation([
    {
      speaker: 'EMBER',
      kicker: 'FIRST ANSWER',
      portrait: 'ember',
      title: 'Is someone there?',
      body: 'The furnaces remember.',
    },
  ], 0, { lastContinueLabel: 'Carry the word' });
  assert.equal(EmberPage.tone, 'ember');
  assert.equal(EmberPage.continueLabel, 'Carry the word');
  assert.match(EmberPage.portraitSrc, /ember-portrait/);
  assert.deepEqual(getTriggeredCampaignStoryBoardIds({
    linkCreated: true,
    createdLinkCount: 1,
  }), ['firstAnswer']);
  assert.deepEqual(getTriggeredCampaignStoryBoardIds({
    linkCreated: true,
    createdLinkCount: 3,
    linkedWorldIdentifier: 'tide',
  }), ['firstTide']);
  assert.deepEqual(getTriggeredCampaignStoryBoardIds({
    linkCreated: true,
    createdLinkCount: 4,
    linkedWorldIdentifier: 'spindle',
  }), ['firstSpindle']);
  assert.deepEqual(getTriggeredCampaignStoryBoardIds({
    linkCreated: true,
    createdLinkCount: 4,
    linkedWorldIdentifier: 'shard',
  }), ['firstShard']);
  assert.deepEqual(getTriggeredCampaignStoryBoardIds({
    linkCreated: true,
    createdLinkCount: 5,
    linkedWorldIdentifier: 'nest',
  }), ['firstNest']);
  assert.deepEqual(getTriggeredCampaignStoryBoardIds({
    neighbourhoodJustAwake: true,
    wardenJustRevealed: true,
  }), ['neighbourhood', 'wardenArrival']);
  assert.deepEqual(getTriggeredCampaignStoryBoardIds({
    circuitJustClosed: true,
    commandJustExposed: true,
  }), ['commandExposed']);
  assert.deepEqual(getTriggeredCampaignStoryBoardIds({
    shownIds: ['wardenArrival'],
    wardenJustRevealed: true,
    worldJustSuppressed: true,
  }), ['suppression']);
  assert.equal(isCampaignStoryBoardReadyToPresent({
    gamePhase: 'restoring',
  }), false);
  assert.equal(isCampaignStoryBoardReadyToPresent({
    gamePhase: 'attached',
    relayRevealActive: true,
  }), false);
  assert.equal(isCampaignStoryBoardReadyToPresent({
    gamePhase: 'attached',
  }), true);
  assert.equal(isCampaignStoryBoardReadyToPresent({
    gamePhase: 'attached',
    hostileEncounterActive: true,
    boardId: 'firstAnswer',
  }), false);
  assert.equal(isCampaignStoryBoardReadyToPresent({
    gamePhase: 'attached',
    hostileEncounterActive: true,
    boardId: 'commandApproach',
  }), true);
  assert.equal(isCampaignStoryBoardReadyToPresent({
    gamePhase: 'attached',
    hostileEncounterActive: true,
    boardId: 'firstVault',
  }), true);
  assert.equal(isCampaignStoryBoardReadyToPresent({
    gamePhase: 'attached',
    hostileEncounterActive: true,
    boardId: 'firstNest',
  }), true);
  assert.equal(isCampaignStoryBoardReadyToPresent({
    gamePhase: 'attached',
    liberationCelebrateActive: true,
    boardId: 'firstAnswer',
  }), false);
  assert.equal(isCampaignStoryBoardReadyToPresent({
    gamePhase: 'attached',
    hostileEncounterActive: true,
    boardId: 'firstAnswer',
  }), false);
  assert.equal(isCampaignStoryBoardReadyToPresent({
    gamePhase: 'victoryPending',
  }), true);
});

test('close-up cameras cap nebula and bloom so space stays dark', () => {
  const LandedView = getCloseViewPresentation(0.5);
  const ScoutView = getCloseViewPresentation(3.85);
  assert.ok(LandedView.closeFade > ScoutView.closeFade);
  assert.ok(LandedView.nebulaIntensity < ScoutView.nebulaIntensity);
  assert.ok(LandedView.bloomStrength < ScoutView.bloomStrength);
  assert.ok(LandedView.bloomThreshold > ScoutView.bloomThreshold);
  assert.ok(LandedView.dustOpacityScale < ScoutView.dustOpacityScale);
  assert.throws(() => getCloseViewPresentation(0), /positive camera scale/);
  assert.throws(() => getCloseViewPresentation(Number.NaN), /positive camera scale/);
});

test('cage-clear wrap holds the story board until the live planet has bloomed', () => {
  assert.equal(getCageClearPulseDurationSeconds({}), 1.08);
  assert.equal(getCageClearPulseDurationSeconds({ prefersReducedMotion: true }), 0.18);
  assert.equal(StoryBoardsAllowedDuringEncounter.includes('firstAnswer'), false);
});

test('critical rule beats jump the queue while flavour beats space out one per landing', () => {
  for (const CriticalBoardId of [
    'wardenArrival',
    'circuitClosed',
    'suppression',
    'recapture',
    'commandExposed',
    'commandApproach',
    'reachAnswers',
    'runLost',
  ]) {
    assert.equal(isCriticalStoryBoard(CriticalBoardId), true);
  }
  for (const FlavourBoardId of [
    'firstAnswer',
    'secondAnswer',
    'rangeUnlock',
    'firstTide',
    'firstFrost',
    'firstBastion',
    'neighbourhood',
    'opening',
    '',
  ]) {
    assert.equal(isCriticalStoryBoard(FlavourBoardId), false);
  }
});

test('run-local unlocks hold prediction, gate Command lock, and wait for the first link', () => {
  assert.equal(getRelayRevealHoldDurationSeconds({
    liveRelayCount: 1,
    prefersReducedMotion: false,
  }), 0.85);
  assert.equal(getRelayRevealHoldDurationSeconds({
    liveRelayCount: 2,
    prefersReducedMotion: false,
  }), 1.7);
  assert.equal(getRelayRevealHoldDurationSeconds({
    liveRelayCount: 2,
    prefersReducedMotion: true,
  }), 0);
  assert.equal(shouldHoldCommittedPrediction({
    liveRelayCount: 2,
    flightElapsedSeconds: 0.4,
    committedPointCount: 12,
  }), true);
  assert.equal(shouldHoldCommittedPrediction({
    liveRelayCount: 2,
    flightElapsedSeconds: 1.8,
    committedPointCount: 12,
  }), false);
  assert.equal(shouldAssistCommandLock({
    wardenStatus: 'pursuing',
    routeAvailable: false,
  }), false);
  assert.equal(shouldAssistCommandLock({
    wardenStatus: 'exposed',
    routeAvailable: true,
  }), true);
  assert.deepEqual(getRunUnlockState({
    liveRelayCount: 1,
    uniqueCircuitCount: 0,
    wardenStatus: 'hidden',
  }), {
    predictionHold: false,
    leftoverCut: false,
    circuitBeacon: false,
    commandLock: false,
    recaptureCut: false,
  });
  assert.deepEqual(getRunUnlockState({
    liveRelayCount: 3,
    uniqueCircuitCount: 1,
    wardenStatus: 'exposed',
    recaptureCutAvailable: true,
  }), {
    predictionHold: true,
    leftoverCut: true,
    circuitBeacon: true,
    commandLock: true,
    recaptureCut: true,
  });
});

test('hidden Warden coach teaches purpose, then waking, then range', () => {
  assert.deepEqual(getHiddenWardenRouteCoach({
    liveRelayCount: 1,
    routeLabels: ['EMBER', 'FROST'],
    openingBody: 'They are still out there. Carry the first word.',
  }), {
    title: 'Choose EMBER or FROST',
    body: 'They are still out there. Carry the first word.',
  });
  assert.deepEqual(getHiddenWardenRouteCoach({
    liveRelayCount: 2,
    routeLabels: ['GROVE', 'FROST'],
  }), {
    title: 'Choose GROVE or FROST',
    body: 'The next world hides behind gravity. Bend the aim line through a gold slingshot ring to reach it.',
  });
  assert.deepEqual(getHiddenWardenRouteCoach({
    liveRelayCount: 3,
    routeLabels: ['TIDE', 'FROST'],
    rangeUnlockLine: 'The dark is not as wide as they said.',
    innerClusterLive: true,
  }), {
    title: 'Choose TIDE or FROST',
    body: 'The dark is not as wide as they said.',
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
  }), 72);
  assert.equal(getPlayfieldLabelTopMargin({
    isCompact: true,
    wardenVisible: true,
    isTactical: true,
  }), 152);
  assert.equal(getPlayfieldLabelTopMargin({
    isCompact: false,
    wardenVisible: true,
    isTactical: false,
  }), 152);
  assert.equal(getPlayfieldLabelTopMargin({
    isCompact: true,
    isShortLandscape: true,
    wardenVisible: true,
    isTactical: true,
  }), 128);
  assert.equal(getPlayfieldLabelTopMargin({
    isCompact: true,
    isShortLandscape: true,
    wardenVisible: false,
    isTactical: true,
  }), 56);
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
  assert.equal(getRouteLabelHorizontalMargin('GROVE'), 64);
  assert.equal(getRouteLabelHorizontalMargin('→ GROVE'), 64);
  assert.throws(() => getTacticalLabelHorizontalMargin(' '), /requires visible text/);
  assert.deepEqual(getPlayfieldLabelVerticalBounds({
    viewportHeight: 320,
    instructionTop: 320,
    isCompact: true,
    isShortLandscape: true,
    wardenVisible: true,
    isTactical: true,
  }), { minimumY: 128, maximumY: 224 });
  assert.deepEqual(getPlayfieldLabelVerticalBounds({
    viewportHeight: 844,
    instructionTop: 844,
    isCompact: true,
    isShortLandscape: false,
    wardenVisible: true,
    isTactical: true,
  }), { minimumY: 152, maximumY: 748 });
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

test('default planning focus stays on the neighbourhood until the outer Reach is unveiled', () => {
  assert.deepEqual(getPlanningFocusWorldIdentifiers({
    innerClusterLive: false,
    commandRouteAvailable: false,
    currentWorldIdentifier: 'meadow',
    ...BreakerReachCluster,
  }).sort(), ['ember', 'grove', 'meadow']);
  assert.deepEqual(getPlanningFocusWorldIdentifiers({
    innerClusterLive: true,
    commandRouteAvailable: false,
    currentWorldIdentifier: 'grove',
    nearbyWorldIdentifiers: ['tide', 'bastion'],
    ...BreakerReachCluster,
  }).sort(), ['bastion', 'grove', 'tide']);
  assert.equal(getPlanningFocusWorldIdentifiers({
    innerClusterLive: true,
    commandRouteAvailable: false,
    currentWorldIdentifier: 'grove',
    ...BreakerReachCluster,
  }).includes('tide'), false);
  assert.ok(getPlanningFocusWorldIdentifiers({
    innerClusterLive: true,
    commandRouteAvailable: true,
    predictedBodyIdentifiers: ['worldheart'],
    nearbyWorldIdentifiers: ['tide'],
    ...BreakerReachCluster,
  }).includes('worldheart'));
  const NeighbourhoodCamera = getSectorPlanningCamera({
    runner: { x: -22, y: -8 },
    focusPoints: [
      { x: -22, y: -8 },
      { x: -8, y: -13 },
      { x: 6, y: -4 },
    ],
    viewportWorldWidth: 20,
    viewportWorldHeight: 24,
  });
  assert.ok(NeighbourhoodCamera.scale < 2);
  assert.ok(NeighbourhoodCamera.scale > 1);
  const PathCamera = getSectorPlanningCamera({
    runner: { x: -22, y: -8 },
    focusPoints: [{ x: -22, y: -8 }],
    pathPoints: [{ x: 6, y: -4 }],
    viewportWorldWidth: 20,
    viewportWorldHeight: 24,
  });
  assert.ok(PathCamera.scale < NeighbourhoodCamera.scale + 0.2);
});

test('planning atmosphere lifts fog instead of darkening the aim map', () => {
  const Rest = getPlanningAtmosphere({
    isPlanning: false,
    fogDensity: 0.007,
    toneMappingExposure: 1.22,
  });
  const Aiming = getPlanningAtmosphere({
    isPlanning: true,
    fogDensity: 0.007,
    toneMappingExposure: 1.22,
  });
  assert.equal(Rest.fogDensity, 0.007);
  assert.ok(Aiming.fogDensity < Rest.fogDensity);
  assert.ok(Aiming.toneMappingExposure > Rest.toneMappingExposure);
  assert.throws(
    () => getPlanningAtmosphere({ isPlanning: true, fogDensity: 0.2, toneMappingExposure: 1 }),
    /bounded fog/,
  );
});

test('world landing aim copy names a new destination without calling it imprisoned', () => {
  assert.equal(getWorldLandingAimLabel('Ember', true), 'Ember TARGET');
  assert.equal(getWorldLandingAimLabel('Ember', false), 'SAFE LANDING');
  assert.throws(() => getWorldLandingAimLabel(' ', true), /requires a destination/);
});

test('the launch face names the neighbour this longitude looks toward', () => {
  const Facing = getLaunchFacingPresentation({
    originX: 0,
    originY: 0,
    longitude: 0,
    candidates: [
      { id: 'ember', label: 'Ember', x: 8, y: 0 },
      { id: 'grove', label: 'Grove', x: -8, y: 0 },
    ],
  });
  assert.equal(Facing.worldId, 'ember');
  assert.equal(Facing.isFacing, true);
  const FarSide = getLaunchFacingPresentation({
    originX: 0,
    originY: 0,
    longitude: Math.PI,
    candidates: [
      { id: 'ember', label: 'Ember', x: 8, y: 0 },
      { id: 'grove', label: 'Grove', x: -8, y: 0 },
    ],
  });
  assert.equal(FarSide.worldId, 'grove');
  assert.equal(FarSide.isFacing, true);
  assert.deepEqual(getLaunchFacingPresentation({
    originX: 0,
    originY: 0,
    longitude: 0,
    candidates: [],
  }), {
    worldId: null,
    label: '',
    alignment: 0,
    isFacing: false,
  });
});

test('first-run captions stay until walk, then until launch, then silence', () => {
  const Opening = getFirstRunCoachPresentation({
    gamePhase: 'attached',
    hasWalkedOnce: false,
    hasLaunchedOnce: false,
  });
  assert.equal(Opening.visible, true);
  assert.equal(Opening.title, 'Drag the planet to walk');
  const AfterWalk = getFirstRunCoachPresentation({
    gamePhase: 'attached',
    hasWalkedOnce: true,
    hasLaunchedOnce: false,
  });
  assert.equal(AfterWalk.title, 'Pull the ship, then let go');
  const AfterLaunch = getFirstRunCoachPresentation({
    gamePhase: 'attached',
    hasWalkedOnce: true,
    hasLaunchedOnce: true,
  });
  assert.equal(AfterLaunch.visible, false);
  assert.equal(getFirstRunCoachPresentation({
    gamePhase: 'flying',
    hasWalkedOnce: false,
    hasLaunchedOnce: false,
  }).visible, false);
  const IdleHighlight = getLandedVerbHighlight({
    gamePhase: 'attached',
    hasWalkedOnce: false,
    hasLaunchedOnce: false,
  });
  assert.equal(IdleHighlight.shipHalo, true);
  assert.equal(IdleHighlight.worldWalkHalo, true);
  assert.equal(IdleHighlight.pullHint, false);
  const ReadyToLaunch = getLandedVerbHighlight({
    gamePhase: 'attached',
    hasWalkedOnce: true,
    hasLaunchedOnce: false,
  });
  assert.equal(ReadyToLaunch.pullHint, true);
  assert.equal(ReadyToLaunch.worldWalkHalo, false);
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
    wellOpacity: 0.14,
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

test('prosperity densifies from a first link to busy routes and circuits', () => {
  assert.equal(getProsperityStage({ restored: false, liveLinkCount: 2 }), 'tyrant');
  assert.equal(getProsperityStage({ restored: true, liveLinkCount: 0 }), 'isolated');
  assert.equal(getProsperityStage({ restored: true, liveLinkCount: 1 }), 'linked');
  assert.equal(getProsperityStage({ restored: true, liveLinkCount: 2 }), 'busy');
  assert.equal(getProsperityStage({
    restored: true,
    liveLinkCount: 1,
    inLiveCircuit: true,
  }), 'circuit');
  assert.equal(getTradeHullKind('ember', 'meadow'), 'barge');
  assert.equal(getTradeHullKind('grove', 'tide'), 'sail');
  assert.equal(getTradeHullKind('frost', 'bastion'), 'sled');
  assert.equal(getTradeHullKind('lantern', 'bower'), 'barge');
  assert.equal(getTradeHullKind('canopy', 'dew'), 'sail');
  assert.equal(getTradeHullKind('nest', 'relay'), 'spine');
  assert.equal(getLiveLinkShipCount({
    originDegree: 1,
    destinationDegree: 1,
    inLiveCircuit: false,
  }), 1);
  assert.equal(getLiveLinkShipCount({
    originDegree: 2,
    destinationDegree: 1,
    inLiveCircuit: false,
  }), 2);
  assert.equal(getLiveLinkShipCount({
    originDegree: 1,
    destinationDegree: 1,
    inLiveCircuit: true,
  }), 2);
  assert.equal(getTradeHullScale('sail').y > getTradeHullScale('barge').y, true);
  assert.equal(getTradeHullColor('barge'), 0xff8a3a);
  assert.equal(getTradeHullColor('sail', true), 0xffe7b8);
  assert.equal(getProsperityPresence('isolated'), 0);
  assert.equal(getProsperityPresence('linked'), 0.78);
  assert.equal(getProsperityPresence('busy'), 1);
  assert.equal(getProsperityPresence('circuit'), 1.12);
  assert.equal(getProsperityBuildingKind('linked', 2), 'house');
  assert.equal(getProsperityBuildingKind('busy', 0), 'house');
  assert.equal(getProsperityBuildingKind('busy', 1), 'workshop');
  assert.equal(getProsperityBuildingKind('circuit', 2), 'dock');
  assert.equal(getProsperityBuildingKind('isolated', 0), null);
  assert.equal(getProsperityBuildingProfile('dock').height < getProsperityBuildingProfile('house').height, true);
  assert.ok(getProsperityBuildingProfile('workshop').height > getProsperityBuildingProfile('house').height);
  assert.ok(getProsperityBuildingProfile('house').height < 0.3);
  assert.ok(getProsperityBuildingProfile('workshop').height < 0.4);
  assert.ok(getInhabitantSilhouette(0).scale.y < getProsperityBuildingProfile('house').height);
  assert.ok(getInhabitantSilhouette(2).scale.y < getProsperityBuildingProfile('house').height);
  assert.ok(getTradeHullScale('barge').x < 0.5);
  assert.equal(getProsperityBuildingFamily('ember'), 'furnace');
  assert.equal(getProsperityBuildingFamily('grove'), 'canopy');
  assert.equal(getProsperityBuildingFamily('meadow'), 'cottage');
  assert.equal(getProsperityBuildingFamily('tide'), 'jetty');
  assert.equal(getTradeHullFamily('barge'), 'barge');
  assert.equal(getTradeHullFamily('sail'), 'sail');
  assert.equal(getTradeHullFamily('spine'), 'sled');
  assert.deepEqual(resolveOccupationSite(-2.62), { longitude: -2.62, latitude: 0 });
  assert.equal(getDerivedOccupationLatitude(0), 0.35);
  assert.equal(getDerivedOccupationLatitude(2), 0.7);
  const FallbackSites = listOccupationSites({ occupationScarAngles: [-2.62, -2.42, -2.22] });
  assert.equal(FallbackSites[0].longitude, -2.62);
  assert.equal(FallbackSites[0].latitude, getDerivedOccupationLatitude(0));
  assert.deepEqual(listOccupationSites({
    occupationSites: [{ longitude: 0.85, latitude: -0.42 }, { longitude: 1.2, latitude: 0.95 }],
    occupationScarAngles: [0.85, 1.2],
  })[0], { longitude: 0.85, latitude: -0.42 });
  const PolarPlacement = getSphereLifePlacement({
    worldX: 0,
    worldY: 0,
    worldZ: 0,
    worldRadius: 2.5,
    longitude: 0,
    latitude: 1.2,
  });
  assert.ok(Math.abs(PolarPlacement.z) > 2);
  assert.ok(Math.abs(PolarPlacement.x) < Math.abs(PolarPlacement.z));
  const EquatorPlacement = getSphereLifePlacement({
    worldX: 10,
    worldY: 4,
    worldZ: 0,
    worldRadius: 2,
    longitude: 0,
    latitude: 0,
  });
  assert.equal(EquatorPlacement.z, 0);
  assert.equal(EquatorPlacement.x, 12);
  const PatrolSite = getInhabitantSurfaceSite({
    homeSite: { longitude: 1, latitude: 0.4 },
    slotIndex: 2,
    freedom: 1,
    walkingOffset: 0,
  });
  assert.ok(Math.abs(PatrolSite.latitude - 0.4) < 0.2);
  assert.equal(getLivingInhabitantSlotCount('isolated'), 3);
  assert.equal(getLivingInhabitantSlotCount('linked'), 6);
  assert.equal(getLivingInhabitantSlotCount('busy'), 9);
  assert.equal(getLivingInhabitantSlotCount('circuit'), 12);
  assert.equal(shouldShowInhabitantSlot({
    lifeStage: 'tyrant',
    prosperityStage: 'tyrant',
    slotIndex: 5,
  }), true);
  assert.equal(shouldShowInhabitantSlot({
    lifeStage: 'tyrant',
    prosperityStage: 'tyrant',
    slotIndex: 6,
  }), false);
  assert.equal(shouldShowInhabitantSlot({
    lifeStage: 'living',
    prosperityStage: 'circuit',
    slotIndex: 11,
  }), true);
  assert.equal(getInhabitantSilhouette(0).kind, 'worker');
  assert.equal(getInhabitantSilhouette(1).kind, 'child');
  assert.equal(getInhabitantSilhouette(2).kind, 'pack');
  assert.ok(getInhabitantSilhouette(1).scale.y < getInhabitantSilhouette(0).scale.y);
  assert.deepEqual(getWorldLifeAudioMix({
    tyrantWorldCount: 3,
    isolatedWorldCount: 1,
    livingWorldCount: 0,
  }), {
    rumble: 0.75,
    garden: 0.25,
    dock: 0,
  });
  assert.equal(getStoryMusicStage({ innerClusterLive: false, wardenStatus: 'hidden' }), 'quiet');
  assert.equal(getStoryMusicStage({ innerClusterLive: true, wardenStatus: 'hidden' }), 'hope');
  assert.equal(getStoryMusicStage({ innerClusterLive: true, wardenStatus: 'pursuing' }), 'hunt');
  assert.equal(getStoryMusicStage({ innerClusterLive: true, wardenStatus: 'exposed' }), 'crown');
});

test('range veil lifts only after Haven, Ember and Grove are live', () => {
  assert.equal(isInnerClusterLive(['meadow', 'ember'], BreakerReachCluster.innerClusterWorldIdentifiers), false);
  assert.equal(isInnerClusterLive(['meadow', 'ember', 'grove'], BreakerReachCluster.innerClusterWorldIdentifiers), true);
  assert.equal(isFurtherReachLive(['meadow', 'ember', 'grove'], BreakerReachCluster.furtherReachWorldIdentifiers), false);
  assert.equal(isFurtherReachLive(['meadow', 'ember', 'grove', 'tide'], BreakerReachCluster.furtherReachWorldIdentifiers), true);
  assert.equal(getRangeVeilStrength('frost', false, BreakerReachCluster), 1);
  assert.equal(getRangeVeilStrength('frost', true, BreakerReachCluster), 0);
  assert.equal(getRangeVeilStrength('ember', false, BreakerReachCluster), 0);
  assert.equal(getRangeVeilStrength('worldheart', false, BreakerReachCluster), 1);
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
  assert.ok(EmberScale >= 0.32 && EmberScale <= 0.46);
  assert.ok(EmberScale < 0.42);
  const TinyScale = getLandedCameraScale({ worldRadius: 2.15, viewportWorldHeight: 24 });
  assert.equal(TinyScale, 0.32);
});

test('landed close-up may zoom one extra notch while Scout stays a sector view', () => {
  assert.equal(ScoutMinimumZoomScale, 0.38);
  assert.equal(LandedMinimumZoomScale, 0.28);
  assert.equal(getActiveViewZoomMinimumScale({ isScoutMode: true }), ScoutMinimumZoomScale);
  assert.equal(getActiveViewZoomMinimumScale({ isPlanningCamera: true }), ScoutMinimumZoomScale);
  assert.equal(getActiveViewZoomMinimumScale({}), LandedMinimumZoomScale);
});

test('landed facing camera keeps the Runner on the near face and reduced motion stays overhead', () => {
  const World = { x: 4, y: -2, radius: 3.2 };
  const Runner = {
    x: World.x + World.radius,
    y: World.y,
  };
  const Facing = getLandedSurfaceCameraPose({
    worldX: World.x,
    worldY: World.y,
    worldRadius: World.radius,
    runnerX: Runner.x,
    runnerY: Runner.y,
    cameraScale: 0.5,
    baseCameraDistance: 42,
  });
  assert.ok(Facing.cameraX > Runner.x);
  assert.ok(Facing.lookAtX < Runner.x);
  assert.ok(Facing.cameraZ > 1);
  const CloseDistance = Math.hypot(
    Facing.cameraX - World.x,
    Facing.cameraY - World.y,
    Facing.cameraZ,
  );
  assert.ok(CloseDistance > World.radius * 4);
  const Far = getLandedSurfaceCameraPose({
    worldX: World.x,
    worldY: World.y,
    worldRadius: World.radius,
    runnerX: Runner.x,
    runnerY: Runner.y,
    cameraScale: 1.2,
    baseCameraDistance: 42,
  });
  const FarDistance = Math.hypot(
    Far.cameraX - World.x,
    Far.cameraY - World.y,
    Far.cameraZ,
  );
  assert.ok(FarDistance > CloseDistance + 8);
  const Pole = getLandedSurfaceCameraPose({
    worldX: World.x,
    worldY: World.y,
    worldZ: 0,
    worldRadius: World.radius,
    runnerX: World.x,
    runnerY: World.y,
    runnerZ: World.radius,
    cameraScale: 0.5,
    baseCameraDistance: 42,
  });
  assert.ok(Pole.cameraZ > World.radius);
  assert.ok(Math.abs(Pole.cameraX - World.x) < 0.01);
  const Overhead = getLandedSurfaceCameraPose({
    worldX: World.x,
    worldY: World.y,
    worldRadius: World.radius,
    runnerX: Runner.x,
    runnerY: Runner.y,
    cameraScale: 0.5,
    baseCameraDistance: 42,
    reducedMotion: true,
  });
  assert.equal(Overhead.cameraX, Runner.x);
  assert.equal(Overhead.cameraY, Runner.y);
  assert.equal(Overhead.lookAtX, Runner.x);
});

test('flight camera follows wider than a landing but tighter than the planning map', () => {
  const FlightScale = getFlightCameraScale({ worldRadius: 3.2, viewportWorldHeight: 24 });
  const LandedScale = getLandedCameraScale({ worldRadius: 3.2, viewportWorldHeight: 24 });
  assert.ok(FlightScale > LandedScale);
  assert.ok(FlightScale < 1);
  assert.equal(getFlightCameraScale({ worldRadius: 2.15, viewportWorldHeight: 24 }), 0.62);
});

test('flight follow looks ahead of the ship and keeps Ember distinct from origin', () => {
  const Resting = getFlightFollowFrame({
    shipX: 2,
    shipY: -3,
    worldRadius: 3.2,
    viewportWorldHeight: 24,
  });
  assert.equal(Resting.lookX, 2);
  assert.equal(Resting.lookY, -3);
  const Breaking = getFlightFollowFrame({
    shipX: 2,
    shipY: -3,
    velocityX: 10,
    velocityY: 0,
    targetX: 14,
    targetY: 0,
    worldRadius: 3.2,
    viewportWorldHeight: 24,
  });
  assert.ok(Breaking.lookX > Resting.lookX);
  assert.ok(Breaking.lookX < 14);
  assert.ok(Breaking.scale >= Resting.scale);
});

test('occupied atmospheres and surface finishes keep Ember, Grove and Frost distinct', () => {
  assert.ok(getOccupiedAtmosphereOpacity(0.18) > getOccupiedAtmosphereOpacity(0.14));
  assert.ok(getOccupiedAtmosphereOpacity(0) >= 0.08);
  const EmberFinish = getWorldSurfaceFinish('ember');
  const FrostFinish = getWorldSurfaceFinish('frost');
  const GroveFinish = getWorldSurfaceFinish('grove');
  assert.ok(FrostFinish.roughness < EmberFinish.roughness);
  assert.ok(EmberFinish.roughness < GroveFinish.roughness);
  assert.equal(shouldShowPlayfieldWorldLabels({ isPointerAiming: true }), true);
  assert.equal(shouldShowPlayfieldWorldLabels({
    isPointerAiming: true,
    toastVisible: true,
  }), false);
  assert.equal(shouldShowPlayfieldWorldLabels({}), false);
  assert.equal(isProjectedLabelInsideWorldDisc({
    labelNdcX: 0.02,
    labelNdcY: 0.01,
    worldNdcX: 0,
    worldNdcY: 0,
    worldRimNdcX: 0.4,
    worldRimNdcY: 0,
  }), true);
  assert.equal(isProjectedLabelInsideWorldDisc({
    labelNdcX: 0.8,
    labelNdcY: 0.1,
    worldNdcX: 0,
    worldNdcY: 0,
    worldRimNdcX: 0.4,
    worldRimNdcY: 0,
  }), false);
  assert.equal(shouldPlayOpeningBriefing({}), true);
  assert.equal(shouldPlayOpeningBriefing({ hasCompletedOpeningBriefing: true }), false);
  assert.equal(shouldPlayOpeningBriefing({ replayActive: true }), false);
});

test('empty playfield labels have zero box and no background', () => {
  const LabelElement = {
    textContent: 'Grove',
    hidden: false,
    dataset: { visible: 'true' },
    style: {
      display: 'block',
      width: '120px',
      height: '24px',
      background: 'rgba(5, 12, 20, 0.7)',
      overflow: 'visible',
    },
  };
  collapsePlayfieldLabelBox(LabelElement);
  assert.equal(isPlayfieldLabelBoxCollapsed(LabelElement), true);
  assert.equal(LabelElement.textContent, '');
  assert.equal(LabelElement.style.background, 'none');
  assert.equal(LabelElement.style.width, '0');
  assert.equal(LabelElement.style.height, '0');
  assert.equal(LabelElement.style.display, 'none');

  const StyleSheet = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(
    StyleSheet,
    /\.route-label:empty[\s\S]*?width:\s*0 !important;[\s\S]*?height:\s*0 !important;/,
  );
  assert.match(
    StyleSheet,
    /\.score-burst\[hidden\][\s\S]*?width:\s*0 !important;/,
  );
  assert.match(
    StyleSheet,
    /\.status-toast:not\(\.is-visible\)[\s\S]*?background:\s*none !important;/,
  );
});

test('pursuit coach treats a launch as the turn and a return flight as the loop', () => {
  assert.deepEqual(getPursuitRouteCoach({
    circuitLabels: ['TIDE'],
    wardenDistance: 4,
    remainingBonusFuel: 2,
  }), {
    title: 'Close a loop via TIDE',
    body: 'Fly back to TIDE. Visiting new worlds is not enough. Each launch is one Warden step (4 left).',
  });
  assert.match(getPursuitRouteCoach({
    allWorldsRestored: true,
    uniqueCircuitCount: 0,
    remainingBonusFuel: 0,
    wardenDistance: 3,
  }).body, /Bonus fuel is spent/);
  assert.match(getPursuitRouteCoach({
    circuitLabels: ['TIDE'],
    wardenDistance: 2,
    remainingBonusFuel: 2,
    wardenTargetLabel: 'FROST',
  }).body, /2 left before it silences FROST/);
  assert.equal(getPursuitRouteCoach({
    commandAvailable: true,
    allWorldsRestored: true,
  }).title, 'The COMMAND WORLD route is open');
});

test('Warden HUD counts remaining flights, not a separate clock', () => {
  assert.deepEqual(getWardenApproachCopy({ distance: 4, targetLabel: 'EMBER' }), {
    state: 'WARDEN INBOUND',
    distance: '4 FLIGHTS AWAY',
    target: 'NEXT: EMBER',
  });
  assert.equal(getWardenApproachCopy({ distance: 0, targetLabel: 'HAVEN' }).distance, 'ARRIVING THIS LANDING');
  assert.equal(getWardenApproachCopy({ exposed: true }).distance, 'LAND ON COMMAND');
  assert.equal(getWardenApproachCopy({ defeated: true }).state, 'WARDEN DEFEATED');
});

test('Warden pursuit track fills taken ground and hides when out of range', () => {
  assert.deepEqual(
    getWardenTrackPips({ distance: 4, maximumDistance: 4 }),
    ['remaining', 'remaining', 'remaining', 'remaining'],
  );
  assert.deepEqual(
    getWardenTrackPips({ distance: 2, maximumDistance: 4 }),
    ['taken', 'taken', 'remaining', 'remaining'],
  );
  assert.deepEqual(
    getWardenTrackPips({ distance: 0, maximumDistance: 4 }),
    ['taken', 'taken', 'taken', 'taken'],
  );
  assert.deepEqual(getWardenTrackPips({ distance: 2, maximumDistance: 4, visible: false }), []);
  assert.deepEqual(getWardenTrackPips({ distance: 5, maximumDistance: 4 }), []);
  assert.deepEqual(getWardenTrackPips({ distance: 1, maximumDistance: 0 }), []);
});

test('story boards look at the speaker, the Warden, or the neighbourhood', () => {
  assert.deepEqual(getStoryBoardCameraFocus({
    boardId: 'firstAnswer',
    portrait: 'ember',
  }), { kind: 'world', worldId: 'ember', scale: 0.62 });
  assert.deepEqual(getStoryBoardCameraFocus({
    boardId: 'firstAnswer',
    portrait: 'ember',
    focusWorldId: 'kiln',
  }), { kind: 'world', worldId: 'kiln', scale: 0.62 });
  assert.equal(getStoryBoardCameraFocus({
    boardId: 'wardenArrival',
    portrait: 'warden',
  }).kind, 'warden');
  assert.equal(getStoryBoardCameraFocus({
    boardId: 'rangeUnlock',
    portrait: 'orbitbreaker',
  }).kind, 'neighbourhood');
  assert.equal(getStoryBoardCameraFocus({
    boardId: 'firstAnswer',
    portrait: 'runner',
  }).kind, 'runner');
});

test('liberation flash remains bounded and reaches zero', () => {
  assert.equal(getLiberationFlashOpacity(0), 0);
  assert.equal(getLiberationFlashOpacity(-1), 0);
  assert.ok(getLiberationFlashOpacity(0.36) > 0);
  assert.ok(getLiberationFlashOpacity(0.72) <= 1);
});

test('control mode chip names the active gesture mode without guessing', () => {
  assert.deepEqual(
    getControlModePresentation({ gamePhase: 'attached' }),
    {
      mode: 'explore',
      label: 'EXPLORE',
      hint: 'Trace the globe to walk · pull the ship to launch',
      visible: true,
    },
  );
  assert.equal(getControlModePresentation({ gamePhase: 'attached', isAiming: true }).mode, 'launch');
  assert.equal(getControlModePresentation({ gamePhase: 'attached', isWalking: true }).mode, 'walk');
  assert.equal(getControlModePresentation({ gamePhase: 'attached', isScoutMode: true }).mode, 'scout');
  assert.equal(getControlModePresentation({ gamePhase: 'restoring' }).mode, 'explore');
  assert.equal(getControlModePresentation({ gamePhase: 'recovering' }).mode, 'recover');
});

test('control mode chip explains the Break during flight and hides in menus', () => {
  const BreakReady = getControlModePresentation({ gamePhase: 'flying', isBreakAvailable: true });
  assert.equal(BreakReady.mode, 'flight');
  assert.match(BreakReady.hint, /Break/);
  const BreakSpent = getControlModePresentation({ gamePhase: 'flying', isBreakAvailable: false });
  assert.doesNotMatch(BreakSpent.hint, /Break/);
  assert.equal(getControlModePresentation({ gamePhase: 'flying', isBurnAiming: true }).label, 'BREAK');
  assert.equal(getControlModePresentation({ gamePhase: 'victory' }).visible, false);
  assert.equal(getControlModePresentation({ gamePhase: 'attached', replayActive: true }).visible, false);
  assert.equal(getControlModePresentation({ gamePhase: 'attached', briefingActive: true }).visible, false);
  assert.throws(() => getControlModePresentation({ gamePhase: '' }));
});
