/**
 * Records, replay and rankings UI: personal-best persistence, the route ghost,
 * the verified completion summary, the online leaderboard panel and verified
 * replay watching. Validation stays in replay-validator.js; this module only
 * presents honest results and never pretends a local score is online.
 */

import { getSystemEmblems } from './campaign.js?v=20260819-ob137';
import { getReplayGhostWaypoints } from './ghost.js?v=20260819-ob137';
import {
  getPersonalBestStatus,
  getRunResourceSummary,
} from './presentation.js?v=20260819-ob137';
import {
  createRunResult,
  loadPersonalBest,
  savePersonalBest,
} from './records.js?v=20260819-ob137';
import {
  finishReplay,
  getPersonalBestGhostStorageKey,
  getReplayStorageKey,
  parseReplay,
  serializeReplay,
} from './replay.js?v=20260819-ob137';
import { createReplayPlaybackState } from './replay-playback.js?v=20260819-ob137';
import { validateSerializedReplay } from './replay-validator.js?v=20260819-ob137';

export function createRecordsUi(THREE, host) {
  const {
    GameCanvas,
    ActiveSystem,
    WorldheartDefinition,
    StardustDefinitions,
    WorldDefinitions,
    LeaderboardClient,
    PersonalBestGhostLine,
    PersonalBestGhostGeometry,
    GhostButtonElement,
    VictoryPanelElement,
    VictoryTitleElement,
    VictoryBodyElement,
    WatchReplayButtonElement,
    ReplayIndicatorElement,
    PersonalBestLabelElement,
    ResultSlingshotScoreElement,
    ResultLiberationScoreElement,
    ResultCompletionBonusElement,
    ResultFlightTimeElement,
    EmblemElements,
    LeaderboardStatusElement,
    LeaderboardListElement,
    LeaderboardPanelElement,
    LeaderboardFormElement,
    LeaderboardButtonElement,
    CallsignInputElement,
    CloseLeaderboardButtonElement,
    SubmitScoreButtonElement,
    getWorldDefinition,
    showInstruction,
    showStatusToast,
    resetGame,
    hideOpeningBriefing,
  } = host;

  function formatFlightTime(FlightTimeMilliseconds) {
    return `${(FlightTimeMilliseconds / 1000).toFixed(1)}s`;
  }

  function updateStoredPersonalBest(RunResult) {
    try {
      return savePersonalBest(window.localStorage, RunResult);
    } catch {
      return null;
    }
  }

  /** Finalizes the input-only replay and exposes its versioned compact payload. */
  function publishFinishedReplay(Outcome) {
    host.ReplayState = finishReplay(host.ReplayState, Outcome);
    const SerializedReplay = serializeReplay(host.ReplayState);
    GameCanvas.dataset.replayOutcome = Outcome;
    GameCanvas.dataset.replayPayload = SerializedReplay;
    GameCanvas.dataset.replayBytes = String(SerializedReplay.length);
    if (Outcome === 'complete') {
      try {
        window.localStorage.setItem(
          getReplayStorageKey(ActiveSystem.id, ActiveSystem.contentVersion),
          SerializedReplay,
        );
      } catch {
        // Completion remains valid when private browsing or quota blocks local persistence.
      }
    }
  }

  function updatePersonalBestGhostVisibility() {
    const ShouldShowGhost = host.HasPersonalBestGhost
      && host.IsPersonalBestGhostEnabled
      && host.ReplayPlaybackState === null
      && (host.IsScoutMode || host.GamePhase === 'flying');
    if (
      PersonalBestGhostLine.visible === ShouldShowGhost
      && GameCanvas.dataset.ghostVisible === String(ShouldShowGhost)
    ) return;
    PersonalBestGhostLine.visible = ShouldShowGhost;
    GameCanvas.dataset.ghostVisible = String(ShouldShowGhost);
  }

  function configurePersonalBestGhost(SerializedReplay) {
    let Replay = null;
    try {
      Replay = SerializedReplay ? parseReplay(SerializedReplay) : null;
    } catch {
      Replay = null;
    }
    const MatchesActiveSystem = Replay?.systemIdentifier === ActiveSystem.id
      && Replay?.contentVersion === ActiveSystem.contentVersion;
    const Waypoints = MatchesActiveSystem ? getReplayGhostWaypoints(Replay) : [];
    host.HasPersonalBestGhost = Waypoints.length >= 2;

    if (host.HasPersonalBestGhost) {
      const Positions = new Float32Array(Waypoints.length * 3);
      Waypoints.forEach((Waypoint, WaypointIndex) => {
        Positions[WaypointIndex * 3] = Waypoint.x;
        Positions[(WaypointIndex * 3) + 1] = Waypoint.y;
        Positions[(WaypointIndex * 3) + 2] = 0.16;
      });
      PersonalBestGhostGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(Positions, 3),
      );
      PersonalBestGhostGeometry.computeBoundingSphere();
      PersonalBestGhostLine.computeLineDistances();
    } else {
      host.IsPersonalBestGhostEnabled = false;
    }

    GhostButtonElement.hidden = !host.HasPersonalBestGhost;
    GhostButtonElement.setAttribute('aria-pressed', String(host.IsPersonalBestGhostEnabled));
    GhostButtonElement.setAttribute(
      'aria-label',
      `Personal-best route ghost ${host.IsPersonalBestGhostEnabled ? 'on' : 'off'}`,
    );
    GameCanvas.dataset.ghostAvailable = String(host.HasPersonalBestGhost);
    GameCanvas.dataset.ghostEnabled = String(host.IsPersonalBestGhostEnabled);
    GameCanvas.dataset.ghostWaypointCount = String(
      host.HasPersonalBestGhost ? Waypoints.length : 0,
    );
    updatePersonalBestGhostVisibility();
  }

  function replayMatchesStoredPersonalBest(SerializedReplay) {
    const Validation = validateSerializedReplay(SerializedReplay);
    const PersonalBest = loadPersonalBest(
      window.localStorage,
      ActiveSystem.id,
      ActiveSystem.contentVersion,
    );
    return Validation.valid
      && PersonalBest !== null
      && Validation.result.systemIdentifier === PersonalBest.systemIdentifier
      && Validation.result.contentVersion === PersonalBest.contentVersion
      && Validation.result.score === PersonalBest.score
      && Validation.result.launchesUsed === PersonalBest.launchesUsed
      && Validation.result.flightTimeMilliseconds === PersonalBest.flightTimeMilliseconds;
  }

  function loadPersonalBestGhost() {
    let SerializedGhost = null;
    try {
      const GhostStorageKey = getPersonalBestGhostStorageKey(
        ActiveSystem.id,
        ActiveSystem.contentVersion,
      );
      const StoredGhost = window.localStorage.getItem(GhostStorageKey);
      if (StoredGhost && replayMatchesStoredPersonalBest(StoredGhost)) {
        SerializedGhost = StoredGhost;
      } else {
        const LastReplay = window.localStorage.getItem(
          getReplayStorageKey(ActiveSystem.id, ActiveSystem.contentVersion),
        );
        if (LastReplay && replayMatchesStoredPersonalBest(LastReplay)) {
          SerializedGhost = LastReplay;
          window.localStorage.setItem(GhostStorageKey, LastReplay);
        }
      }
    } catch {
      // The game remains fully playable when private browsing blocks local persistence.
    }
    configurePersonalBestGhost(SerializedGhost);
  }

  function savePersonalBestGhost(SerializedReplay) {
    try {
      window.localStorage.setItem(
        getPersonalBestGhostStorageKey(ActiveSystem.id, ActiveSystem.contentVersion),
        SerializedReplay,
      );
    } catch {
      // A verified best still counts when local persistence is unavailable.
    }
    configurePersonalBestGhost(SerializedReplay);
  }

  function setPersonalBestGhostEnabled(Enabled, { announce = false } = {}) {
    host.IsPersonalBestGhostEnabled = Enabled && host.HasPersonalBestGhost;
    GhostButtonElement.setAttribute('aria-pressed', String(host.IsPersonalBestGhostEnabled));
    GhostButtonElement.setAttribute(
      'aria-label',
      `Personal-best route ghost ${host.IsPersonalBestGhostEnabled ? 'on' : 'off'}`,
    );
    GameCanvas.dataset.ghostEnabled = String(host.IsPersonalBestGhostEnabled);
    updatePersonalBestGhostVisibility();
    if (announce && host.HasPersonalBestGhost) {
      showStatusToast(
        `PERSONAL BEST GHOST ${host.IsPersonalBestGhostEnabled ? 'ON' : 'OFF'}`,
        900,
      );
    }
  }

  /** Populates the non-blocking completion summary from the actual run state. */
  function updateVictorySummary() {
    publishFinishedReplay('complete');
    const CollectedStardustCount = StardustDefinitions.filter(
      (StardustDefinition) => StardustDefinition.collected,
    ).length;
    const Emblems = getSystemEmblems(
      WorldDefinitions,
      CollectedStardustCount,
      StardustDefinitions.length,
      true,
    );
    const EarnedEmblemCount = Object.values(Emblems).filter(Boolean).length;

    VictoryTitleElement.textContent = EarnedEmblemCount === 3
      ? ActiveSystem.completion.perfectTitle
      : ActiveSystem.completion.title;
    const CompletionBody = EarnedEmblemCount === 3
      ? ActiveSystem.completion.perfectBody
      : ActiveSystem.completion.body;
    const RunResult = createRunResult({
      systemIdentifier: ActiveSystem.id,
      contentVersion: ActiveSystem.contentVersion,
      score: host.ScoreState.bankedScore,
      launchesUsed: host.RunState.launchesUsed,
      flightTimeMilliseconds: Math.round(host.RunFlightTimeSeconds * 1000),
    });
    const ReplayValidation = validateSerializedReplay(GameCanvas.dataset.replayPayload);
    const IsReplayVerified = ReplayValidation.valid
      && ReplayValidation.result.score === RunResult.score
      && ReplayValidation.result.launchesUsed === RunResult.launchesUsed
      && ReplayValidation.result.flightTimeMilliseconds === RunResult.flightTimeMilliseconds
      && ReplayValidation.result.slingshotScore === host.ScoreState.bankedSlingshotScore
      && ReplayValidation.result.networkScore === host.ScoreState.networkScore
      && ReplayValidation.result.circuitScore === host.ScoreState.circuitScore
      && ReplayValidation.result.victoryScore === host.ScoreState.victoryScore;
    WatchReplayButtonElement.hidden = !IsReplayVerified;
    if (host.ReplayPlaybackState) {
      host.ReplayPlaybackState = { ...host.ReplayPlaybackState, status: 'complete' };
      ReplayIndicatorElement.hidden = true;
      GameCanvas.dataset.replayMode = 'complete';
    }
    GameCanvas.dataset.replayValidation = IsReplayVerified ? 'verified' : 'rejected';
    GameCanvas.dataset.replayValidatedScore = ReplayValidation.valid
      ? String(ReplayValidation.result.score)
      : '';
    const PersonalBestUpdate = IsReplayVerified ? updateStoredPersonalBest(RunResult) : null;
    if (PersonalBestUpdate?.isNewPersonalBest) {
      savePersonalBestGhost(GameCanvas.dataset.replayPayload);
    }
    const PersonalBestScore = PersonalBestUpdate?.personalBest.score ?? RunResult.score;
    PersonalBestLabelElement.textContent = getPersonalBestStatus({
      isReplayVerified: IsReplayVerified,
      runScore: RunResult.score,
      personalBestScore: PersonalBestUpdate?.personalBest.score ?? null,
      isNewPersonalBest: PersonalBestUpdate?.isNewPersonalBest === true,
    });
    ResultSlingshotScoreElement.textContent = (
      host.ScoreState.bankedSlingshotScore.toLocaleString('en-GB')
    );
    ResultLiberationScoreElement.textContent = host.ScoreState.networkScore.toLocaleString('en-GB');
    ResultCompletionBonusElement.textContent = host.ScoreState.victoryScore.toLocaleString('en-GB');
    ResultFlightTimeElement.textContent = formatFlightTime(RunResult.flightTimeMilliseconds);
    const EndingReveal = ActiveSystem.completion.endingReveal
      ? ` ${ActiveSystem.completion.endingReveal}`
      : '';
    VictoryBodyElement.textContent = `${CompletionBody}${EndingReveal} ${getRunResourceSummary(
      host.RunState,
    )} · ${formatFlightTime(RunResult.flightTimeMilliseconds)} flight time.`;
    host.WorldseedSound?.playStoryVoice(
      EarnedEmblemCount === 3
        ? `win/${ActiveSystem.id}/perfect`
        : `win/${ActiveSystem.id}/standard`,
    );
    GameCanvas.dataset.personalBest = String(PersonalBestScore);
    GameCanvas.dataset.isNewPersonalBest = String(PersonalBestUpdate?.isNewPersonalBest === true);
    GameCanvas.dataset.flightTimeMilliseconds = String(RunResult.flightTimeMilliseconds);
    GameCanvas.dataset.contentVersion = ActiveSystem.contentVersion;
    GameCanvas.dataset.assistState = IsReplayVerified ? RunResult.assistState : 'unverified';

    for (const EmblemElement of EmblemElements) {
      const IsEarned = Emblems[EmblemElement.dataset.emblem] === true;
      EmblemElement.classList.toggle('is-earned', IsEarned);
      EmblemElement.setAttribute('aria-label', `${EmblemElement.dataset.emblem} ${IsEarned ? 'earned' : 'not earned'}`);
    }

    for (const ConstellationNodeElement of host.ConstellationNodeElements) {
      const WorldIdentifier = ConstellationNodeElement.dataset.worldId;
      const IsAwake = WorldIdentifier === WorldheartDefinition.id
        || getWorldDefinition(WorldIdentifier)?.restored === true;
      ConstellationNodeElement.classList.toggle('is-awake', IsAwake);
    }
  }

  function setLeaderboardStatus(Message) {
    LeaderboardStatusElement.textContent = Message;
  }

  function renderLeaderboardEntries(Entries) {
    LeaderboardListElement.replaceChildren();
    if (Entries.length === 0) {
      const EmptyElement = document.createElement('li');
      EmptyElement.className = 'leaderboard-list__empty';
      EmptyElement.textContent = 'No verified routes yet. The first clean run takes the board.';
      LeaderboardListElement.append(EmptyElement);
      return;
    }
    Entries.forEach((Entry, EntryIndex) => {
      const RowElement = document.createElement('li');
      const RankElement = document.createElement('span');
      RankElement.className = 'leaderboard-list__rank';
      RankElement.textContent = `#${EntryIndex + 1}`;

      const RunnerElement = document.createElement('span');
      RunnerElement.className = 'leaderboard-list__runner';
      const CallsignElement = document.createElement('strong');
      CallsignElement.textContent = typeof Entry.callsign === 'string' ? Entry.callsign : 'RUNNER';
      const DetailElement = document.createElement('small');
      const LaunchesUsed = Number.isInteger(Entry.launchesUsed) ? Entry.launchesUsed : '—';
      const FlightTime = Number.isInteger(Entry.flightTimeMilliseconds)
        ? formatFlightTime(Entry.flightTimeMilliseconds)
        : '—';
      DetailElement.textContent = `${LaunchesUsed} launches · ${FlightTime}`;
      RunnerElement.append(CallsignElement, DetailElement);

      const ScoreElement = document.createElement('strong');
      ScoreElement.className = 'leaderboard-list__score';
      ScoreElement.textContent = Number.isInteger(Entry.score)
        ? Entry.score.toLocaleString('en-GB')
        : '—';

      const WatchButtonElement = document.createElement('button');
      WatchButtonElement.type = 'button';
      WatchButtonElement.textContent = 'Watch';
      WatchButtonElement.disabled = typeof Entry.id !== 'string';
      WatchButtonElement.addEventListener('click', async () => {
        WatchButtonElement.disabled = true;
        setLeaderboardStatus(`Loading ${CallsignElement.textContent}'s verified route…`);
        const LoadSequence = host.LeaderboardLoadSequence;
        try {
          const ReplayRecord = await LeaderboardClient.getReplay(Entry.id);
          if (LoadSequence !== host.LeaderboardLoadSequence || LeaderboardPanelElement.hidden) {
            return;
          }
          if (!watchSerializedReplay(
            ReplayRecord.replay,
            `${ReplayRecord.callsign ?? CallsignElement.textContent}'s verified route`,
          )) {
            throw new Error('Remote replay did not validate for this system.');
          }
        } catch (CaughtError) {
          if (LoadSequence !== host.LeaderboardLoadSequence || LeaderboardPanelElement.hidden) {
            return;
          }
          setLeaderboardStatus(CaughtError instanceof Error
            ? CaughtError.message
            : 'Replay could not load.');
          WatchButtonElement.disabled = false;
        }
      });
      RowElement.append(RankElement, RunnerElement, ScoreElement, WatchButtonElement);
      LeaderboardListElement.append(RowElement);
    });
  }

  async function refreshLeaderboard(LoadSequence) {
    try {
      const Entries = await LeaderboardClient.list({
        systemIdentifier: ActiveSystem.id,
        contentVersion: ActiveSystem.contentVersion,
        limit: 10,
      });
      if (LoadSequence !== host.LeaderboardLoadSequence || LeaderboardPanelElement.hidden) {
        return;
      }
      renderLeaderboardEntries(Entries);
      setLeaderboardStatus(`${Entries.length} verified route${Entries.length === 1 ? '' : 's'} · score, launches, flight time`);
    } catch (CaughtError) {
      if (LoadSequence !== host.LeaderboardLoadSequence || LeaderboardPanelElement.hidden) {
        return;
      }
      renderLeaderboardEntries([]);
      setLeaderboardStatus(CaughtError instanceof Error
        ? CaughtError.message
        : 'Leaderboard could not load.');
    }
  }

  function openLeaderboardPanel() {
    host.LeaderboardLoadSequence += 1;
    const LoadSequence = host.LeaderboardLoadSequence;
    LeaderboardPanelElement.hidden = false;
    VictoryPanelElement.inert = true;
    VictoryPanelElement.setAttribute('inert', '');
    VictoryPanelElement.setAttribute('aria-hidden', 'true');
    const HasVerifiedRun = GameCanvas.dataset.replayValidation === 'verified'
      && GameCanvas.dataset.replayPayload !== ''
      && GameCanvas.dataset.replayMode !== 'complete'
      && GameCanvas.dataset.onlineSubmission !== 'banked';
    LeaderboardFormElement.hidden = !LeaderboardClient.configured || !HasVerifiedRun;
    LeaderboardListElement.replaceChildren();
    try {
      CallsignInputElement.value = window.localStorage.getItem('orbitbreak.callsign') ?? '';
    } catch {
      CallsignInputElement.value = '';
    }
    if (!LeaderboardClient.configured) {
      setLeaderboardStatus('Online board is not connected in this build. Your verified local best is safe.');
      const OfflineElement = document.createElement('li');
      OfflineElement.className = 'leaderboard-list__empty';
      OfflineElement.textContent = 'No endpoint is configured. The game never pretends a local score is online.';
      LeaderboardListElement.append(OfflineElement);
    } else {
      setLeaderboardStatus('Loading verified routes…');
      void refreshLeaderboard(LoadSequence);
    }
    (LeaderboardFormElement.hidden ? CloseLeaderboardButtonElement : CallsignInputElement)
      .focus({ preventScroll: true });
  }

  function closeLeaderboardPanel(RestoreFocus = true) {
    host.LeaderboardLoadSequence += 1;
    LeaderboardPanelElement.hidden = true;
    VictoryPanelElement.inert = false;
    VictoryPanelElement.removeAttribute('inert');
    VictoryPanelElement.removeAttribute('aria-hidden');
    if (RestoreFocus && !VictoryPanelElement.hidden) {
      LeaderboardButtonElement.focus({ preventScroll: true });
    }
  }

  async function submitVerifiedScore(SubmitEvent) {
    SubmitEvent.preventDefault();
    if (
      !LeaderboardClient.configured
      || GameCanvas.dataset.replayValidation !== 'verified'
      || GameCanvas.dataset.replayMode === 'complete'
      || GameCanvas.dataset.onlineSubmission === 'banked'
    ) {
      setLeaderboardStatus('Only a verified completed route can be banked online.');
      return;
    }
    SubmitScoreButtonElement.disabled = true;
    setLeaderboardStatus('Re-simulating route on the leaderboard…');
    const LoadSequence = host.LeaderboardLoadSequence;
    const ReplayPayload = GameCanvas.dataset.replayPayload;
    const Callsign = CallsignInputElement.value;
    try {
      const Submission = await LeaderboardClient.submit({
        callsign: Callsign,
        replay: ReplayPayload,
      });
      if (LoadSequence !== host.LeaderboardLoadSequence) {
        return;
      }
      try {
        window.localStorage.setItem('orbitbreak.callsign', Submission.entry.callsign);
      } catch {
        // The online result remains valid if callsign convenience storage is unavailable.
      }
      GameCanvas.dataset.onlineSubmission = 'banked';
      LeaderboardFormElement.hidden = true;
      const SuccessMessage = Submission.rank
        ? `Verified and banked at rank #${Submission.rank}.`
        : 'Verified and banked online.';
      setLeaderboardStatus(SuccessMessage);
      const RefreshSequence = ++host.LeaderboardLoadSequence;
      await refreshLeaderboard(RefreshSequence);
      if (RefreshSequence === host.LeaderboardLoadSequence && !LeaderboardPanelElement.hidden) {
        setLeaderboardStatus(SuccessMessage);
        (LeaderboardListElement.querySelector('button') ?? CloseLeaderboardButtonElement)
          .focus({ preventScroll: true });
      }
    } catch (CaughtError) {
      if (LoadSequence !== host.LeaderboardLoadSequence) {
        return;
      }
      setLeaderboardStatus(CaughtError instanceof Error
        ? CaughtError.message
        : 'Score could not be submitted.');
      SubmitScoreButtonElement.disabled = false;
      CallsignInputElement.focus({ preventScroll: true });
    }
  }

  /** Resets the system, then replays a server- or locally-verified input stream. */
  function watchSerializedReplay(SerializedReplay, ReplayLabel) {
    const Validation = validateSerializedReplay(SerializedReplay);
    if (
      !Validation.valid
      || Validation.result.systemIdentifier !== ActiveSystem.id
      || Validation.result.contentVersion !== ActiveSystem.contentVersion
    ) {
      return false;
    }
    let CompletedReplay;
    try {
      CompletedReplay = parseReplay(SerializedReplay);
    } catch {
      return false;
    }
    closeLeaderboardPanel(false);
    resetGame();
    hideOpeningBriefing();
    host.ReplayState = CompletedReplay;
    host.ReplayPlaybackState = createReplayPlaybackState(CompletedReplay);
    GameCanvas.dataset.replayPayload = SerializedReplay;
    GameCanvas.dataset.replayLaunchCount = String(CompletedReplay.launches.length);
    GameCanvas.dataset.replayOutcome = 'playback';
    GameCanvas.dataset.replayMode = 'playing';
    ReplayIndicatorElement.textContent = (
      `WATCHING VERIFIED REPLAY · 0 / ${CompletedReplay.launches.length}`
    );
    ReplayIndicatorElement.hidden = false;
    showInstruction(ReplayLabel, 'Reset at any time to take control.');
    return true;
  }

  function watchCompletedReplay() {
    if (!watchSerializedReplay(GameCanvas.dataset.replayPayload, 'Verified route replay')) {
      showStatusToast('REPLAY IS NOT VERIFIED', 1200);
    }
  }

  return {
    formatFlightTime,
    publishFinishedReplay,
    updatePersonalBestGhostVisibility,
    configurePersonalBestGhost,
    loadPersonalBestGhost,
    savePersonalBestGhost,
    setPersonalBestGhostEnabled,
    updateVictorySummary,
    setLeaderboardStatus,
    openLeaderboardPanel,
    closeLeaderboardPanel,
    submitVerifiedScore,
    watchSerializedReplay,
    watchCompletedReplay,
  };
}
