/**
 * Diegetic play chrome: fuel lights, first-run captions, toasts and live region.
 * GameCanvas.dataset diagnostic writes stay on the same canvas contract.
 */

import { countRestoredWorlds } from './campaign.js';
import { countLiveRelayWorlds, listRelayCircuits } from './network.js';
import { getLoopObjectivePresentation } from './presentation.js';

const TaughtCaptionStorageKey = 'orbitbreak.taughtCaptions';
const FirstRunCaptionKinds = new Set(['walk', 'aim', 'break', 'missed-port']);

function loadTaughtCaptions() {
  try {
    const Stored = JSON.parse(window.localStorage.getItem(TaughtCaptionStorageKey));
    if (Stored && typeof Stored === 'object') {
      return {
        walk: Stored.walk === true,
        aim: Stored.aim === true,
        break: Stored.break === true,
        'missed-port': Stored['missed-port'] === true,
      };
    }
  } catch {
    // Ignore quota / private-mode failures and start untaught.
  }
  return {
    walk: false,
    aim: false,
    break: false,
    'missed-port': false,
  };
}

function persistTaughtCaptions(TaughtCaptions) {
  try {
    window.localStorage.setItem(TaughtCaptionStorageKey, JSON.stringify(TaughtCaptions));
  } catch {
    // Caption memory is presentation-only.
  }
}

export function createHud(host) {
  const {
    PlayCaptionElement,
    PlayCaptionTitleElement,
    PlayCaptionBodyElement,
    PlayLiveRegionElement,
    StatusToastElement,
    ScoreBurstElement,
    Camera,
    ScoreBurstProjection,
    GameCanvas,
    WorldDefinitions,
    RestorableWorldCount,
    StardustDefinitions,
    WorldheartDefinition,
  } = host;
  const TaughtCaptions = loadTaughtCaptions();
  let LastLiveRegionText = '';
  let LastObjectiveAnnouncement = '';
  let PlayCaptionTimeoutIdentifier = null;

  function announceLive(Message) {
    if (!PlayLiveRegionElement || !Message) {
      return;
    }
    if (Message === LastLiveRegionText) {
      return;
    }
    LastLiveRegionText = Message;
    PlayLiveRegionElement.textContent = Message;
  }

  function refreshPlayfieldLabelBounds() {
    host.CachedInstructionPanelTop = PlayCaptionElement.hidden
      ? window.innerHeight
      : Math.min(window.innerHeight, PlayCaptionElement.getBoundingClientRect().top);
  }

  /** Updates the optional Arc mastery counter. */
  function updateStardustCounter() {
    const CollectedStardustCount = StardustDefinitions.filter(
      (StardustDefinition) => StardustDefinition.collected,
    ).length;
    GameCanvas.dataset.stardustCollected = String(CollectedStardustCount);
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
    GameCanvas.dataset.objectiveLabel = Presentation.label;
    GameCanvas.dataset.objectiveState = Presentation.state;
    const Announcement = `${Presentation.label}. ${Presentation.state}`;
    if (Announcement !== LastObjectiveAnnouncement) {
      LastObjectiveAnnouncement = Announcement;
      announceLive(Announcement);
    }
  }

  /**
   * Updates restorable-world progress for diagnostics. The starting world is already alive
   * so it acts as the player's launch platform rather than as an objective.
   */
  function updateWorldCounter() {
    const RestoredWorldCount = countRestoredWorlds(WorldDefinitions);
    GameCanvas.dataset.worldsRestored = String(RestoredWorldCount);
    GameCanvas.dataset.worldsRestorable = String(RestorableWorldCount);
  }

  /** Keeps remaining launches on the ship lights and the canvas diagnostic contract. */
  function updateFuelLights() {
    const Remaining = host.RunState.remainingLaunches;
    const Maximum = host.RunState.maximumLaunches;
    GameCanvas.dataset.launchesRemaining = String(Remaining);
    GameCanvas.dataset.launchesUsed = String(host.RunState.launchesUsed);
    GameCanvas.dataset.runStatus = host.RunState.status;
    host.updateFuelLightVisuals?.(Remaining, Maximum);
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

  /** Keeps banked points machine-readable. The visible number lives on the victory card. */
  function updateScoreInterface() {
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
    announceLive(Message);

    host.StatusToastTimeoutIdentifier = host.setTimeout(() => {
      StatusToastElement.classList.remove('is-visible');
      host.StatusToastTimeoutIdentifier = null;
    }, VisibleDurationMilliseconds);
  }

  function hideInstruction() {
    if (PlayCaptionTimeoutIdentifier !== null) {
      host.clearTimeout(PlayCaptionTimeoutIdentifier);
      PlayCaptionTimeoutIdentifier = null;
    }
    PlayCaptionElement.hidden = true;
    PlayCaptionElement.classList.remove('is-fading');
    PlayCaptionTitleElement.textContent = '';
    PlayCaptionBodyElement.textContent = '';
  }

  /**
   * First-run fading captions only. Later play calls no-op; toasts still fire separately.
   *
   * @param {string} Title - Strong instruction line.
   * @param {string} Body - Supporting instruction line.
   * @param {string} [CaptionKind] - One of walk, aim, break, missed-port.
   */
  function showInstruction(Title, Body, CaptionKind = '') {
    const Kind = FirstRunCaptionKinds.has(CaptionKind) ? CaptionKind : '';
    if (!Kind || TaughtCaptions[Kind]) {
      return;
    }
    TaughtCaptions[Kind] = true;
    persistTaughtCaptions(TaughtCaptions);
    PlayCaptionTitleElement.textContent = Title;
    PlayCaptionBodyElement.textContent = Body;
    PlayCaptionElement.hidden = false;
    PlayCaptionElement.classList.remove('is-fading');
    void PlayCaptionElement.offsetWidth;
    if (!host.PrefersReducedMotion) {
      PlayCaptionElement.classList.add('is-fading');
    }
    announceLive(`${Title}. ${Body}`);
    if (PlayCaptionTimeoutIdentifier !== null) {
      host.clearTimeout(PlayCaptionTimeoutIdentifier);
    }
    PlayCaptionTimeoutIdentifier = host.setTimeout(() => {
      PlayCaptionTimeoutIdentifier = null;
      hideInstruction();
    }, host.PrefersReducedMotion ? 4200 : 3200);
  }

  function announceWarden(Message) {
    if (Message) {
      announceLive(Message);
    }
  }

  function resetHud() {
    if (host.StatusToastTimeoutIdentifier !== null) {
      host.clearTimeout(host.StatusToastTimeoutIdentifier);
      host.StatusToastTimeoutIdentifier = null;
    }
    StatusToastElement.classList.remove('is-visible');
    ScoreBurstElement.classList.remove('is-live');
    ScoreBurstElement.hidden = true;
    LastObjectiveAnnouncement = '';
    hideInstruction();
  }

  return {
    refreshPlayfieldLabelBounds,
    refreshInstructionPanelBounds: refreshPlayfieldLabelBounds,
    updateStardustCounter,
    updateWorldheartObjective,
    updateWorldCounter,
    updateFuelLights,
    updateLaunchCounter: updateFuelLights,
    updateScoreInterface,
    showScoreBurst,
    showStatusToast,
    showInstruction,
    hideInstruction,
    announceWarden,
    resetHud,
  };
}
