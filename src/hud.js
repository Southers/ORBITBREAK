/**
 * Diegetic play chrome: fuel lights, first-run captions, toasts and live region.
 * GameCanvas.dataset diagnostic writes stay on the same canvas contract.
 */

import { countRestoredWorlds } from './campaign.js?v=20260819-ob142';
import { countLiveRelayWorlds, listRelayCircuits } from './network.js?v=20260819-ob142';
import { getCoachClipId } from './audio-catalog.js?v=20260819-ob142';
import {
  FirstRunCoachBodies,
  getFirstRunCoachPresentation,
  getLoopObjectivePresentation,
} from './presentation.js?v=20260819-ob142';

const TaughtCaptionStorageKey = 'orbitbreak.taughtCaptions';
const FirstRunCaptionKinds = new Set(['break', 'missed-port']);

function loadTaughtCaptions() {
  try {
    const Stored = JSON.parse(window.localStorage.getItem(TaughtCaptionStorageKey));
    if (Stored && typeof Stored === 'object') {
      return {
        break: Stored.break === true,
        'missed-port': Stored['missed-port'] === true,
      };
    }
  } catch {
    // Ignore quota / private-mode failures and start untaught.
  }
  return {
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
  let ScoreBurstTimeoutIdentifier = null;

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
  function hideScoreBurst() {
    if (ScoreBurstTimeoutIdentifier !== null) {
      host.clearTimeout(ScoreBurstTimeoutIdentifier);
      ScoreBurstTimeoutIdentifier = null;
    }
    ScoreBurstElement.removeEventListener('animationend', hideScoreBurst);
    ScoreBurstElement.classList.remove('is-live');
    ScoreBurstElement.classList.remove('is-circuit');
    ScoreBurstElement.textContent = '';
    ScoreBurstElement.hidden = true;
    ScoreBurstElement.style.removeProperty('--burst-x');
    ScoreBurstElement.style.removeProperty('--burst-y');
  }

  function showScoreBurst(WorldPosition, Text, Tone = 'bank') {
    hideScoreBurst();
    const VisibleText = typeof Text === 'string' ? Text.trim() : '';
    if (host.PrefersReducedMotion || VisibleText.length < 1) {
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
    ScoreBurstElement.textContent = VisibleText;
    ScoreBurstElement.classList.toggle('is-circuit', Tone === 'circuit');
    ScoreBurstElement.hidden = false;
    ScoreBurstElement.classList.remove('is-live');
    void ScoreBurstElement.offsetWidth;
    ScoreBurstElement.classList.add('is-live');
    ScoreBurstElement.addEventListener('animationend', hideScoreBurst);
    ScoreBurstTimeoutIdentifier = host.setTimeout(() => {
      ScoreBurstTimeoutIdentifier = null;
      hideScoreBurst();
    }, 1450);
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
  function hideStatusToast() {
    if (host.StatusToastTimeoutIdentifier !== null) {
      host.clearTimeout(host.StatusToastTimeoutIdentifier);
      host.StatusToastTimeoutIdentifier = null;
    }
    StatusToastElement.classList.remove('is-visible');
    StatusToastElement.classList.remove('is-memory');
    StatusToastElement.classList.remove('is-warden');
    StatusToastElement.textContent = '';
    StatusToastElement.hidden = true;
  }

  function showStatusToast(Message, VisibleDurationMilliseconds = 900, Tone = 'status') {
    const VisibleMessage = typeof Message === 'string' ? Message.trim() : '';
    if (VisibleMessage.length < 1) {
      hideStatusToast();
      return;
    }
    if (host.StatusToastTimeoutIdentifier !== null) {
      host.clearTimeout(host.StatusToastTimeoutIdentifier);
    }

    StatusToastElement.textContent = VisibleMessage;
    StatusToastElement.classList.toggle('is-memory', Tone === 'memory');
    StatusToastElement.classList.toggle('is-warden', Tone === 'warden');
    StatusToastElement.classList.add('is-visible');
    StatusToastElement.hidden = false;
    announceLive(VisibleMessage);
    host.WorldseedSound?.playSpokenText(VisibleMessage);

    host.StatusToastTimeoutIdentifier = host.setTimeout(() => {
      host.StatusToastTimeoutIdentifier = null;
      hideStatusToast();
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
    delete PlayCaptionElement.dataset.coachKind;
  }

  /**
   * First-run fading captions for later verbs. Walk and launch stay on the sticky coach.
   *
   * @param {string} Title - Strong instruction line.
   * @param {string} Body - Supporting instruction line.
   * @param {string} [CaptionKind] - One of break, missed-port.
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
    const CoachId = getCoachClipId(Kind);
    if (CoachId) {
      host.WorldseedSound?.playStoryVoice(CoachId);
    }
    if (PlayCaptionTimeoutIdentifier !== null) {
      host.clearTimeout(PlayCaptionTimeoutIdentifier);
    }
    PlayCaptionTimeoutIdentifier = host.setTimeout(() => {
      PlayCaptionTimeoutIdentifier = null;
      hideInstruction();
    }, host.PrefersReducedMotion ? 4200 : 3200);
  }

  /** Walk names walking. Aim names fly, then smash. Titles stay in presentation.js. */
  function updateFirstRunCoach() {
    const Coach = getFirstRunCoachPresentation({
      gamePhase: host.GamePhase,
      hasGrabbedShipOnce: host.HasGrabbedShipOnce === true,
      hasLaunchedOnce: host.HasLaunchedOnce === true,
      isOpeningBriefingActive: host.IsOpeningBriefingActive === true,
      isHowToPlayOpen: host.IsHowToPlayOpen === true,
      runStatus: host.RunState?.status ?? 'active',
    });
    if (!Coach.visible) {
      if (PlayCaptionElement.dataset.coachKind) {
        delete PlayCaptionElement.dataset.coachKind;
        if (!PlayCaptionElement.classList.contains('is-fading')) {
          hideInstruction();
        }
      }
      return;
    }
    const CoachBody = Coach.body
      || (Coach.kind === 'walk'
        ? FirstRunCoachBodies.walk
        : Coach.kind === 'aim'
          ? FirstRunCoachBodies.aim
          : '');
    const SameCaption = PlayCaptionElement.dataset.coachKind === Coach.kind
      && PlayCaptionTitleElement.textContent === Coach.title
      && PlayCaptionBodyElement.textContent === CoachBody
      && PlayCaptionElement.hidden === false;
    if (SameCaption) {
      return;
    }
    if (PlayCaptionTimeoutIdentifier !== null) {
      host.clearTimeout(PlayCaptionTimeoutIdentifier);
      PlayCaptionTimeoutIdentifier = null;
    }
    PlayCaptionTitleElement.textContent = Coach.title;
    PlayCaptionBodyElement.textContent = CoachBody;
    PlayCaptionElement.hidden = false;
    PlayCaptionElement.classList.remove('is-fading');
    PlayCaptionElement.dataset.coachKind = Coach.kind;
    announceLive(CoachBody ? `${Coach.title}. ${CoachBody}` : Coach.title);
    const CoachId = getCoachClipId(Coach.kind);
    if (CoachId) {
      host.WorldseedSound?.playStoryVoice(CoachId);
    }
  }

  function announceWarden(Message) {
    if (Message) {
      announceLive(Message);
    }
  }

  function resetHud() {
    hideStatusToast();
    hideScoreBurst();
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
    updateFirstRunCoach,
    announceWarden,
    resetHud,
  };
}
