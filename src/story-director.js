/**
 * Opening briefing and queued story boards.
 * Relay-reveal-hold still flushes from the playable shell after the look target clears.
 */

import { getStoryVoiceClipId } from './audio-catalog.js?v=20260819-ob137';
import {
  getStoryBoardPresentation,
  isCampaignStoryBoardReadyToPresent,
  isCriticalStoryBoard,
  getStoryBoardCameraFocus,
  shouldPlayOpeningBriefing,
} from './presentation.js?v=20260819-ob137';
import { getRouteChoices } from './campaign.js?v=20260819-ob137';

export function createStoryDirector(host) {
  const {
    ActiveSystem,
    GameCanvas,
    WorldseedSound,
    CampaignNodeDefinitions,
    StartingWorldIdentifier,
    OpeningBriefingElement,
    BriefingKickerElement,
    BriefingSpeakerElement,
    BriefingTitleElement,
    BriefingBodyElement,
    BriefingProgressElement,
    BriefingContinueButtonElement,
    BriefingSkipButtonElement,
    BriefingPortraitElement,
    showInstruction,
    showStatusToast,
    resetGame,
    revealVictoryPanel,
    showHostileEncounterInstruction,
    showRouteChoiceInstruction,
  } = host;

  function hideStoryBoardOverlay() {
    host.IsOpeningBriefingActive = false;
    host.ActiveStoryBoardId = null;
    host.ActiveStoryBoardTokens = {};
    host.StoryLookFocus = null;
    OpeningBriefingElement.hidden = true;
    GameCanvas.dataset.openingBriefing = 'closed';
    host.updatePauseChrome?.();
    OpeningBriefingElement.classList.remove(
      'is-warden',
      'is-haven',
      'is-courier',
      'is-runner',
      'is-ember',
      'is-grove',
      'is-tide',
      'is-frost',
      'is-bastion',
      'is-command',
    );
    WorldseedSound.stopSampledVoice();
    WorldseedSound.setStoryPaused(false);
  }

  function hideOpeningBriefing() {
    host.StoryBoardQueue = [];
    host.PendingRunResetAfterStoryBoard = false;
    host.PendingVictoryAfterStoryBoard = false;
    hideStoryBoardOverlay();
    host.hideHowToPlay?.();
  }

  function getActiveStoryBoardDefinition() {
    if (host.ActiveStoryBoardId === 'opening') {
      return {
        skipLabel: 'Skip intro',
        continueLabel: 'Take the Orbitbreaker',
        pages: ActiveSystem.openingBriefing ?? [],
      };
    }
    return ActiveSystem.storyBoards?.[host.ActiveStoryBoardId] ?? null;
  }

  function presentStoryBoardPage(PageIndex, { playVoice = false } = {}) {
    const Board = getActiveStoryBoardDefinition();
    const Presentation = getStoryBoardPresentation(Board.pages, PageIndex, {
      lastContinueLabel: Board.continueLabel,
      tokens: host.ActiveStoryBoardTokens,
    });
    host.OpeningBriefingPageIndex = PageIndex;
    host.IsOpeningBriefingActive = true;
    BriefingKickerElement.textContent = Presentation.kicker;
    BriefingSpeakerElement.textContent = Presentation.speaker;
    BriefingTitleElement.textContent = Presentation.title;
    BriefingBodyElement.textContent = Presentation.body;
    BriefingProgressElement.textContent = Presentation.progressLabel;
    BriefingContinueButtonElement.textContent = Presentation.continueLabel;
    BriefingSkipButtonElement.textContent = Board.skipLabel;
    BriefingPortraitElement.src = `${Presentation.portraitSrc}?v=20260818-ob123`;
    BriefingPortraitElement.alt = Presentation.speaker;
    OpeningBriefingElement.classList.remove(
      'is-warden',
      'is-haven',
      'is-courier',
      'is-runner',
      'is-ember',
      'is-grove',
      'is-tide',
      'is-frost',
      'is-bastion',
      'is-command',
    );
    OpeningBriefingElement.classList.add(`is-${Presentation.tone}`);
    OpeningBriefingElement.hidden = false;
    GameCanvas.dataset.openingBriefing = `${host.ActiveStoryBoardId}:${Presentation.progressLabel}`;
    host.updatePauseChrome?.();
    host.StoryLookFocus = getStoryBoardCameraFocus({
      boardId: host.ActiveStoryBoardId === 'opening' ? 'opening' : host.ActiveStoryBoardId,
      portrait: Board.pages[PageIndex]?.portrait ?? '',
      focusWorldId: Board.pages[PageIndex]?.focusWorldId ?? '',
    });
    WorldseedSound.setStoryPaused(true);
    if (playVoice) {
      WorldseedSound.playUiContinue();
      const ClipId = getStoryVoiceClipId(
        ActiveSystem.id,
        host.ActiveStoryBoardId,
        PageIndex,
      );
      if (!WorldseedSound.playStoryVoice(ClipId)) {
        WorldseedSound.briefingVoice(Presentation.speaker);
      }
    }
    BriefingContinueButtonElement.focus({ preventScroll: true });
  }

  function beginStoryBoard(BoardId, tokens = {}) {
    if (host.ReplayPlaybackState !== null) {
      return false;
    }
    const Board = BoardId === 'opening'
      ? {
        skipLabel: 'Skip intro',
        continueLabel: 'Take the Orbitbreaker',
        pages: ActiveSystem.openingBriefing ?? [],
      }
      : ActiveSystem.storyBoards?.[BoardId];
    if (!Board?.pages?.length) {
      return false;
    }
    host.ActiveStoryBoardId = BoardId;
    host.ActiveStoryBoardTokens = { ...tokens };
    presentStoryBoardPage(0, { playVoice: Boolean(WorldseedSound.context) });
    return true;
  }

  function returnFocusToPlay() {
    if (host.GamePhase === 'attached' || host.GamePhase === 'restoring') {
      if (!showHostileEncounterInstruction()) showRouteChoiceInstruction();
      GameCanvas.focus({ preventScroll: true });
    }
  }

  function presentNextQueuedStoryBoard({ allowFlavourBoard = true } = {}) {
    if (host.PendingRunResetAfterStoryBoard || host.PendingVictoryAfterStoryBoard) {
      // A resolved run outcome supersedes any flavour beats still waiting.
      host.StoryBoardQueue = host.StoryBoardQueue.filter(
        (QueueEntry) => isCriticalStoryBoard(QueueEntry.id),
      );
    }
    const HeadEntry = host.StoryBoardQueue[0];
    if (HeadEntry && allowFlavourBoard === false && !isCriticalStoryBoard(HeadEntry.id)) {
      // Spaced delivery: hold the flavour beat until the next landing flush.
      hideStoryBoardOverlay();
      returnFocusToPlay();
      return;
    }
    const NextBoard = host.StoryBoardQueue.shift();
    if (!NextBoard) {
      const ShouldReset = host.PendingRunResetAfterStoryBoard;
      const ShouldVictory = host.PendingVictoryAfterStoryBoard;
      host.PendingRunResetAfterStoryBoard = false;
      host.PendingVictoryAfterStoryBoard = false;
      hideStoryBoardOverlay();
      if (ShouldReset) {
        resetGame();
        return;
      }
      if (ShouldVictory) {
        revealVictoryPanel();
        host.GamePhase = 'victory';
        WorldseedSound.victory();
        return;
      }
      returnFocusToPlay();
      return;
    }
    beginStoryBoard(NextBoard.id, NextBoard.tokens);
  }

  function enqueueCampaignStoryBoards(BoardIds, tokens = {}) {
    if (host.ReplayPlaybackState !== null || !Array.isArray(BoardIds) || BoardIds.length < 1) {
      return false;
    }
    let QueuedCount = 0;
    for (const BoardId of BoardIds) {
      if (host.ShownStoryBoardIds.has(BoardId)) {
        continue;
      }
      if (!ActiveSystem.storyBoards?.[BoardId]?.pages?.length) {
        continue;
      }
      host.ShownStoryBoardIds.add(BoardId);
      host.StoryBoardQueue.push({ id: BoardId, tokens });
      QueuedCount += 1;
    }
    if (QueuedCount > 0) {
      // Rule beats present before any flavour beats still waiting their turn.
      host.StoryBoardQueue.sort((FirstEntry, SecondEntry) => (
        Number(isCriticalStoryBoard(SecondEntry.id)) - Number(isCriticalStoryBoard(FirstEntry.id))
      ));
      flushQueuedStoryBoardsIfReady();
    }
    return QueuedCount > 0;
  }

  function flushQueuedStoryBoardsIfReady() {
    if (host.StoryBoardQueue.length < 1 || host.IsOpeningBriefingActive) {
      return false;
    }
    const NextBoardId = host.StoryBoardQueue[0]?.id ?? '';
    if (!isCampaignStoryBoardReadyToPresent({
      briefingActive: host.IsOpeningBriefingActive,
      replayActive: host.ReplayPlaybackState !== null,
      gamePhase: host.GamePhase,
      relayRevealActive: Boolean(
        host.RelayRevealLookTarget
        && host.RelayRevealHoldUntilSeconds > host.GameElapsedTimeSeconds
      ),
      liberationCelebrateActive: host.LiberationCelebrateUntilSeconds > host.GameElapsedTimeSeconds,
      hostileEncounterActive: host.ActiveHostileEncounterState !== null,
      boardId: NextBoardId,
    })) {
      return false;
    }
    presentNextQueuedStoryBoard();
    return true;
  }

  function beginOpeningBriefing() {
    host.StoryBoardQueue = [];
    host.ShownStoryBoardIds.clear();
    host.PendingRunResetAfterStoryBoard = false;
    host.PendingVictoryAfterStoryBoard = false;
    if (
      (ActiveSystem.openingBriefing ?? []).length < 1
      || !shouldPlayOpeningBriefing({
        hasCompletedOpeningBriefing: host.HasCompletedOpeningBriefing === true,
        replayActive: host.ReplayPlaybackState !== null,
      })
    ) {
      hideOpeningBriefing();
      return false;
    }
    return beginStoryBoard('opening');
  }

  function advanceOpeningBriefing() {
    if (!host.IsOpeningBriefingActive) {
      return;
    }
    WorldseedSound.ensureStarted();
    const Board = getActiveStoryBoardDefinition();
    if (!Board?.pages?.length || host.OpeningBriefingPageIndex >= Board.pages.length - 1) {
      finishOpeningBriefing();
      return;
    }
    presentStoryBoardPage(host.OpeningBriefingPageIndex + 1, { playVoice: true });
  }

  function finishOpeningBriefing() {
    if (!host.IsOpeningBriefingActive && OpeningBriefingElement.hidden) {
      return;
    }
    WorldseedSound.ensureStarted();
    WorldseedSound.stopTransients();
    if (host.ActiveStoryBoardId === 'opening') {
      host.HasCompletedOpeningBriefing = true;
      hideStoryBoardOverlay();
      if (host.presentHowToPlayAfterOpening?.()) {
        host.frameStartWorldCamera?.();
        return;
      }
      const OpeningRouteChoices = getRouteChoices(
        CampaignNodeDefinitions,
        StartingWorldIdentifier,
        2,
        ActiveSystem.routeSuggestions[StartingWorldIdentifier] ?? [],
      );
      showInstruction(
        'Choose ' + OpeningRouteChoices[0].label + ' or ' + OpeningRouteChoices[1].label,
        ActiveSystem.openingBody,
      );
      if (ActiveSystem.openingBroadcast) {
        showStatusToast(ActiveSystem.openingBroadcast, 2200, 'warden');
      }
      host.frameStartWorldCamera?.();
      GameCanvas.focus({ preventScroll: true });
      return;
    }
    if (host.ActiveStoryBoardId === 'runLost') {
      host.PendingRunResetAfterStoryBoard = true;
    }
    presentNextQueuedStoryBoard({ allowFlavourBoard: false });
  }

  /** Skip dismisses the whole queued conversation, not just the current board. */
  function skipStoryBoards() {
    if (!host.IsOpeningBriefingActive) {
      return;
    }
    if (host.ActiveStoryBoardId === 'opening') {
      finishOpeningBriefing();
      return;
    }
    WorldseedSound.ensureStarted();
    WorldseedSound.stopTransients();
    if (host.ActiveStoryBoardId === 'runLost') {
      host.PendingRunResetAfterStoryBoard = true;
    }
    host.StoryBoardQueue = [];
    presentNextQueuedStoryBoard();
  }

  return {
    hideStoryBoardOverlay,
    hideOpeningBriefing,
    getActiveStoryBoardDefinition,
    presentStoryBoardPage,
    beginStoryBoard,
    presentNextQueuedStoryBoard,
    enqueueCampaignStoryBoards,
    flushQueuedStoryBoardsIfReady,
    beginOpeningBriefing,
    advanceOpeningBriefing,
    finishOpeningBriefing,
    skipStoryBoards,
  };
}
