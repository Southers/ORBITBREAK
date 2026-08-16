/**
 * HUD counters, toasts, instructions and loop-objective copy.
 * GameCanvas.dataset diagnostic writes stay on the same canvas contract.
 */

import { countRestoredWorlds } from './campaign.js';
import { countLiveRelayWorlds, listRelayCircuits } from './network.js';
import { getLoopObjectivePresentation } from './presentation.js';

export function createHud(host) {
  const {
    InstructionPanelElement,
    InstructionTitleElement,
    InstructionBodyElement,
    WorldCounterElement,
    LaunchCounterElement,
    CounterElement,
    ScoreCounterElement,
    FlightScoreValueElement,
    ChainValueElement,
    FlightScoreElement,
    StatusToastElement,
    StardustCounterElement,
    ObjectiveLabelElement,
    ObjectiveStateElement,
    ObjectivePanelElement,
    ObjectivePipsElement,
    ScoreBurstElement,
    Camera,
    ScoreBurstProjection,
    GameCanvas,
    WorldDefinitions,
    RestorableWorldCount,
    StardustDefinitions,
    WorldheartDefinition,
  } = host;
  const ObjectivePipElements = host.ObjectivePipElements;
  let LastCelebratedBankedScore = 0;


  function refreshInstructionPanelBounds() {
    host.CachedInstructionPanelTop = InstructionPanelElement.getBoundingClientRect().top;
  }
  /** Updates the optional Arc mastery counter. */
  function updateStardustCounter() {
    const CollectedStardustCount = StardustDefinitions.filter(
      (StardustDefinition) => StardustDefinition.collected,
    ).length;
    StardustCounterElement.textContent = `${CollectedStardustCount} / ${StardustDefinitions.length}`;
    StardustCounterElement.closest('.counter__mastery')?.classList.toggle(
      'is-complete',
      CollectedStardustCount === StardustDefinitions.length,
    );
  }
  /** Keeps the live loop objective on relays, then circuits, then Command. */
  function updateWorldheartObjective() {
    const Presentation = getLoopObjectivePresentation({
      liveRelayCount: countLiveRelayWorlds(host.RelayNetworkState),
      uniqueCircuitCount: listRelayCircuits(host.RelayNetworkState).length,
      wardenStatus: host.WardenPursuitState.status,
      isOnCommandCore: host.CurrentWorldIdentifier === WorldheartDefinition.id
        && Boolean(host.ActiveHostileEncounterState),
      isCommandLiberated: WorldheartDefinition.restored,
    });
    ObjectiveLabelElement.textContent = Presentation.label;
    ObjectiveStateElement.textContent = Presentation.state;
    ObjectivePanelElement.classList.toggle('is-open', Presentation.open);
    ObjectivePipsElement.classList.toggle('is-binary', Presentation.pipCount === 2);
    for (let PipIndex = 0; PipIndex < ObjectivePipElements.length; PipIndex += 1) {
      const PipElement = ObjectivePipElements[PipIndex];
      PipElement.hidden = PipIndex >= Presentation.pipCount;
      PipElement.classList.toggle('is-filled', PipIndex < Presentation.filledPips);
    }
  }
  /**
   * Updates the HUD counter using only restorable worlds. The starting world is already alive
   * so it acts as the player's launch platform rather than as an objective.
   */
  function updateWorldCounter() {
    const RestoredWorldCount = countRestoredWorlds(WorldDefinitions);
    WorldCounterElement.textContent = `${RestoredWorldCount} / ${RestorableWorldCount}`;
  }
  /** Keeps the optional remaining-launch victory bonus visible and machine-readable. */
  function updateLaunchCounter() {
    LaunchCounterElement.textContent = `${host.RunState.remainingLaunches} / ${host.RunState.maximumLaunches}`;
    CounterElement.classList.toggle(
      'is-low',
      host.RunState.remainingLaunches > 0 && host.RunState.remainingLaunches <= 2,
    );
    CounterElement.classList.toggle('is-empty', host.RunState.remainingLaunches === 0);
    GameCanvas.dataset.launchesRemaining = String(host.RunState.remainingLaunches);
    GameCanvas.dataset.launchesUsed = String(host.RunState.launchesUsed);
    GameCanvas.dataset.runStatus = host.RunState.status;
  }
  /**
   * Celebrates points at the world-space position where they were earned.
   *
   * @param {{x:number,y:number,z?:number}} WorldPosition - Landing or event position.
   * @param {string} Text - Short score line, e.g. "+2,400".
   * @param {string} [Tone] - 'bank' or 'circuit'.
   */
  function showScoreBurst(WorldPosition, Text, Tone = 'bank') {
    if (host.PrefersReducedMotion) {
      return;
    }
    ScoreBurstProjection.set(
      WorldPosition.x,
      WorldPosition.y,
      WorldPosition.z ?? 0,
    ).project(Camera);
    const ClampedX = Math.min(92, Math.max(8, (ScoreBurstProjection.x * 0.5 + 0.5) * 100));
    const ClampedY = Math.min(88, Math.max(10, (-ScoreBurstProjection.y * 0.5 + 0.5) * 100));
    ScoreBurstElement.style.setProperty('--burst-x', `${ClampedX}%`);
    ScoreBurstElement.style.setProperty('--burst-y', `${ClampedY}%`);
    ScoreBurstElement.textContent = Text;
    ScoreBurstElement.classList.toggle('is-circuit', Tone === 'circuit');
    ScoreBurstElement.hidden = false;
    ScoreBurstElement.classList.remove('is-live');
    void ScoreBurstElement.offsetWidth;
    ScoreBurstElement.classList.add('is-live');
  }
  /** Keeps banked points and the current at-risk chain visible throughout a run. */
  function updateScoreInterface() {
    ScoreCounterElement.textContent = host.ScoreState.bankedScore.toLocaleString('en-GB');
    if (host.ScoreState.bankedScore > LastCelebratedBankedScore && !host.PrefersReducedMotion) {
      const MasteryElement = ScoreCounterElement.closest('.counter__mastery');
      if (MasteryElement) {
        MasteryElement.classList.remove('is-banking');
        void MasteryElement.offsetWidth;
        MasteryElement.classList.add('is-banking');
      }
    }
    LastCelebratedBankedScore = host.ScoreState.bankedScore;
    FlightScoreValueElement.textContent = `+${host.ScoreState.flightScore.toLocaleString('en-GB')}`;
    ChainValueElement.textContent = `CHAIN ×${Math.max(1, Math.min(host.ScoreState.chainCount, 4))}`;
    FlightScoreElement.hidden = host.ScoreState.flightScore === 0;
    GameCanvas.dataset.score = String(host.ScoreState.bankedScore);
    GameCanvas.dataset.flightScore = String(host.ScoreState.flightScore);
    GameCanvas.dataset.chainCount = String(host.ScoreState.chainCount);
    GameCanvas.dataset.networkScore = String(host.ScoreState.networkScore);
    GameCanvas.dataset.victoryScore = String(host.ScoreState.victoryScore);
  }
  /**
   * Displays a short centre-screen status message without queueing old messages.
   *
   * @param {string} Message - Text shown to the player.
   * @param {number} VisibleDurationMilliseconds - Duration before the toast fades.
   */
  function showStatusToast(Message, VisibleDurationMilliseconds = 900, Tone = 'status') {
    if (host.StatusToastTimeoutIdentifier !== null) {
      host.clearTimeout(host.StatusToastTimeoutIdentifier);
    }

    StatusToastElement.textContent = Message;
    StatusToastElement.classList.toggle('is-memory', Tone === 'memory');
    StatusToastElement.classList.toggle('is-warden', Tone === 'warden');
    StatusToastElement.classList.add('is-visible');

    host.StatusToastTimeoutIdentifier = host.setTimeout(() => {
      StatusToastElement.classList.remove('is-visible');
      host.StatusToastTimeoutIdentifier = null;
    }, VisibleDurationMilliseconds);
  }
  /**
   * Sets instruction copy and reveals the helper panel.
   *
   * @param {string} Title - Strong instruction line.
   * @param {string} Body - Supporting instruction line.
   */
  function showInstruction(Title, Body) {
    InstructionTitleElement.textContent = Title;
    InstructionBodyElement.textContent = Body;
    InstructionPanelElement.classList.remove('is-hidden');
    InstructionPanelElement.setAttribute('aria-hidden', 'false');
    refreshInstructionPanelBounds();
  }
  /** Hides the helper once a launch is in progress. */
  function hideInstruction() {
    InstructionPanelElement.classList.add('is-hidden');
    InstructionPanelElement.setAttribute('aria-hidden', 'true');
    refreshInstructionPanelBounds();
  }

  function resetHud() {
    if (host.StatusToastTimeoutIdentifier !== null) {
      host.clearTimeout(host.StatusToastTimeoutIdentifier);
      host.StatusToastTimeoutIdentifier = null;
    }
    StatusToastElement.classList.remove('is-visible');
    ScoreBurstElement.classList.remove('is-live');
    ScoreBurstElement.hidden = true;
    LastCelebratedBankedScore = 0;
  }

  return {
    refreshInstructionPanelBounds,
    updateStardustCounter,
    updateWorldheartObjective,
    updateWorldCounter,
    updateLaunchCounter,
    updateScoreInterface,
    showScoreBurst,
    showStatusToast,
    showInstruction,
    hideInstruction,
    resetHud,
  };
}
