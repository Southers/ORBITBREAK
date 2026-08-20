import test from 'node:test';
import assert from 'node:assert/strict';

import { AuthoredSystemDefinitions } from '../src/content.js';
import { getStoryVoiceClipId } from '../src/audio-catalog.js';
import { createStoryDirector } from '../src/story-director.js';

function createClassList() {
  const Values = new Set();
  return {
    add(...Names) {
      Names.forEach((Name) => Values.add(Name));
    },
    remove(...Names) {
      Names.forEach((Name) => Values.delete(Name));
    },
    contains(Name) {
      return Values.has(Name);
    },
  };
}

function createElement() {
  return {
    alt: '',
    classList: createClassList(),
    dataset: {},
    hidden: true,
    src: '',
    textContent: '',
    focusCount: 0,
    focus() {
      this.focusCount += 1;
    },
  };
}

function createSound({ context = null, sampledVoiceResult = true } = {}) {
  return {
    context,
    ensureStartedCount: 0,
    playUiContinueCount: 0,
    playedClipIds: [],
    fallbackSpeakers: [],
    stopSampledVoiceCount: 0,
    storyPaused: false,
    ensureStarted() {
      this.ensureStartedCount += 1;
      this.context ??= { state: 'running' };
      return true;
    },
    playUiContinue() {
      this.playUiContinueCount += 1;
      return true;
    },
    playStoryVoice(ClipId) {
      this.playedClipIds.push(ClipId);
      return sampledVoiceResult;
    },
    briefingVoice(Speaker) {
      this.fallbackSpeakers.push(Speaker);
    },
    stopSampledVoice() {
      this.stopSampledVoiceCount += 1;
    },
    stopTransients() {},
    setStoryPaused(IsPaused) {
      this.storyPaused = IsPaused === true;
    },
  };
}

function createFixture(SoundOptions = {}) {
  const ActiveSystem = AuthoredSystemDefinitions['breaker-reach'];
  const WorldseedSound = createSound(SoundOptions);
  const GameCanvas = createElement();
  const OpeningBriefingElement = createElement();
  const BriefingKickerElement = createElement();
  const BriefingSpeakerElement = createElement();
  const BriefingTitleElement = createElement();
  const BriefingBodyElement = createElement();
  const BriefingProgressElement = createElement();
  const BriefingContinueButtonElement = createElement();
  const BriefingSkipButtonElement = createElement();
  const BriefingPortraitElement = createElement();
  const Host = {
    ActiveSystem,
    GameCanvas,
    WorldseedSound,
    CampaignNodeDefinitions: {},
    StartingWorldIdentifier: ActiveSystem.startingWorldIdentifier,
    OpeningBriefingElement,
    BriefingKickerElement,
    BriefingSpeakerElement,
    BriefingTitleElement,
    BriefingBodyElement,
    BriefingProgressElement,
    BriefingContinueButtonElement,
    BriefingSkipButtonElement,
    BriefingPortraitElement,
    OpeningBriefingPageIndex: 0,
    IsOpeningBriefingActive: false,
    ActiveStoryBoardId: null,
    ActiveStoryBoardTokens: {},
    StoryLookFocus: null,
    StoryBoardQueue: [],
    ShownStoryBoardIds: new Set(),
    PendingRunResetAfterStoryBoard: false,
    PendingVictoryAfterStoryBoard: false,
    ReplayPlaybackState: null,
    GamePhase: 'attached',
    RelayRevealLookTarget: null,
    RelayRevealHoldUntilSeconds: 0,
    LiberationCelebrateUntilSeconds: 0,
    GameElapsedTimeSeconds: 0,
    ActiveHostileEncounterState: null,
    HasCompletedOpeningBriefing: false,
    showInstruction() {},
    showStatusToast() {},
    resetGame() {},
    revealVictoryPanel() {},
    showHostileEncounterInstruction() { return false; },
    showRouteChoiceInstruction() {},
    presentHowToPlayAfterOpening() { return true; },
    hideHowToPlay() {},
  };
  return {
    ActiveSystem,
    BriefingBodyElement,
    BriefingContinueButtonElement,
    BriefingProgressElement,
    BriefingSpeakerElement,
    BriefingTitleElement,
    GameCanvas,
    Host,
    OpeningBriefingElement,
    WorldseedSound,
    Director: createStoryDirector(Host),
  };
}

test('fresh opening waits at a transmission gate and speaks page one after the first gesture', () => {
  const Fixture = createFixture();
  assert.equal(Fixture.Director.beginOpeningBriefing(), true);
  assert.equal(Fixture.GameCanvas.dataset.openingTransmission, 'awaiting-gesture');
  assert.equal(Fixture.BriefingContinueButtonElement.textContent, 'Receive Warden transmission');
  assert.equal(Fixture.BriefingProgressElement.textContent, 'SIGNAL LOCKED');
  assert.equal(Fixture.WorldseedSound.ensureStartedCount, 0);
  assert.deepEqual(Fixture.WorldseedSound.playedClipIds, []);

  Fixture.Director.advanceOpeningBriefing();

  assert.equal(Fixture.WorldseedSound.ensureStartedCount, 1);
  assert.equal(Fixture.GameCanvas.dataset.openingTransmission, 'received');
  assert.equal(Fixture.Host.OpeningBriefingPageIndex, 0);
  assert.equal(Fixture.BriefingSpeakerElement.textContent, 'THE WARDEN');
  assert.equal(Fixture.BriefingTitleElement.textContent, 'Travel is forbidden.');
  assert.deepEqual(Fixture.WorldseedSound.playedClipIds, [
    getStoryVoiceClipId(Fixture.ActiveSystem.id, 'opening', 0),
  ]);
});

test('Continue advances from the received Warden line to the Runner without overlap', () => {
  const Fixture = createFixture();
  Fixture.Director.beginOpeningBriefing();
  Fixture.Director.advanceOpeningBriefing();
  Fixture.Director.advanceOpeningBriefing();

  assert.equal(Fixture.Host.OpeningBriefingPageIndex, 1);
  assert.equal(Fixture.BriefingSpeakerElement.textContent, 'THE RUNNER');
  assert.equal(Fixture.WorldseedSound.playUiContinueCount, 2);
  assert.deepEqual(Fixture.WorldseedSound.playedClipIds, [
    getStoryVoiceClipId(Fixture.ActiveSystem.id, 'opening', 0),
    getStoryVoiceClipId(Fixture.ActiveSystem.id, 'opening', 1),
  ]);
});

test('an already-unlocked context presents and speaks page one immediately', () => {
  const Fixture = createFixture({ context: { state: 'running' } });
  assert.equal(Fixture.Director.beginOpeningBriefing(), true);
  assert.equal(Fixture.BriefingTitleElement.textContent, 'Travel is forbidden.');
  assert.deepEqual(Fixture.WorldseedSound.playedClipIds, [
    getStoryVoiceClipId(Fixture.ActiveSystem.id, 'opening', 0),
  ]);
});

test('sample failure falls back to the procedural Warden voice', () => {
  const Fixture = createFixture({ sampledVoiceResult: false });
  Fixture.Director.beginOpeningBriefing();
  Fixture.Director.advanceOpeningBriefing();
  assert.deepEqual(Fixture.WorldseedSound.fallbackSpeakers, ['THE WARDEN']);
});

test('Skip dismisses a locked transmission and stops story audio', () => {
  const Fixture = createFixture();
  Fixture.Director.beginOpeningBriefing();
  Fixture.Director.skipStoryBoards();
  assert.equal(Fixture.Host.HasCompletedOpeningBriefing, true);
  assert.equal(Fixture.Host.IsOpeningBriefingActive, false);
  assert.equal(Fixture.OpeningBriefingElement.hidden, true);
  assert.equal(Fixture.WorldseedSound.stopSampledVoiceCount, 1);
});
