/**
 * Opening briefing and queued story boards.
 * Relay-reveal-hold still flushes from the playable shell after the look target clears.
 */

import {
  getStoryBoardPresentation,
  isCampaignStoryBoardReadyToPresent,
  getStoryBoardCameraFocus,
} from './presentation.js';
import { getRouteChoices } from './campaign.js';

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
    InstructionPanelElement,
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
    WorldseedSound.setStoryPaused(false);
  }

  function hideOpeningBriefing() {
    host.StoryBoardQueue = [];
    host.PendingRunResetAfterStoryBoard = false;
    host.PendingVictoryAfterStoryBoard = false;
    hideStoryBoardOverlay();
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
    BriefingPortraitElement.src = `${Presentation.portraitSrc}?v=20260815-ob87`;
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
    InstructionPanelElement.classList.add('is-hidden');
    InstructionPanelElement.setAttribute('aria-hidden', 'true');
    GameCanvas.dataset.openingBriefing = `${host.ActiveStoryBoardId}:${Presentation.progressLabel}`;
    host.StoryLookFocus = getStoryBoardCameraFocus({
      boardId: host.ActiveStoryBoardId === 'opening' ? 'opening' : host.ActiveStoryBoardId,
      portrait: Board.pages[PageIndex]?.portrait ?? '',
    });
    WorldseedSound.setStoryPaused(true);
    if (playVoice) {
      WorldseedSound.briefingVoice(Presentation.speaker);
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

  function presentNextQueuedStoryBoard() {
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
      if (host.GamePhase === 'attached' || host.GamePhase === 'restoring') {
        if (!showHostileEncounterInstruction()) showRouteChoiceInstruction();
        GameCanvas.focus({ preventScroll: true });
      }
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
    if ((ActiveSystem.openingBriefing ?? []).length < 1 || host.ReplayPlaybackState !== null) {
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
      hideStoryBoardOverlay();
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
      GameCanvas.focus({ preventScroll: true });
      return;
    }
    if (host.ActiveStoryBoardId === 'runLost') {
      host.PendingRunResetAfterStoryBoard = true;
    }
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
  };
}
