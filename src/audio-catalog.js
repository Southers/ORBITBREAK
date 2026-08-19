/**
 * Player-facing sampled-audio inventory.
 *
 * The browser only plays committed files under assets/audio/. Generation happens
 * in GitHub Actions with secrets.ELEVENLABS_API_KEY and never from Pages.
 */

import {
  AuthoredCampaignSystemIdentifiers,
  AuthoredSystemDefinitions,
} from './content.js';
import {
  FirstRunCoachBodies,
  HowToPlayLines,
  formatStoryBoardCopy,
  getHowToPlayPresentation,
} from './presentation.js';

export const AudioAssetVersion = '20260819-ob130';
export const AudioAssetRoot = './assets/audio';

/** Stock ElevenLabs library voices. Do not clone a real person. */
export const ElevenLabsVoiceProfiles = Object.freeze({
  warden: Object.freeze({
    key: 'warden',
    voiceId: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    modelId: 'eleven_multilingual_v2',
    settings: Object.freeze({
      stability: 0.78,
      similarity_boost: 0.74,
      style: 0.04,
      use_speaker_boost: true,
    }),
  }),
  runner: Object.freeze({
    key: 'runner',
    voiceId: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie',
    modelId: 'eleven_multilingual_v2',
    settings: Object.freeze({
      stability: 0.4,
      similarity_boost: 0.62,
      style: 0.12,
      use_speaker_boost: false,
    }),
  }),
});

const WardenSpeakers = new Set(['THE WARDEN', 'COMMAND']);

export const TaughtCaptionLines = Object.freeze({
  break: Object.freeze({
    title: 'Break ready — one free correction',
    body: 'If the line drifts, drag from the ship (or press Space) to bend this flight once. Drag back onto the ship, or press Escape, to cancel.',
  }),
  'missed-port': Object.freeze({
    title: 'Docked.',
    body: 'The relay is linked, but the cage holds. Launch again and land inside the gold beacon arc to liberate this world.',
  }),
});

export const NarrativeToastLines = Object.freeze([
  Object.freeze({
    id: 'toast/tap-cage',
    voice: 'runner',
    text: 'Tap the cage to break it. Pull the ship to fly.',
  }),
  Object.freeze({
    id: 'toast/rim-clear',
    voice: 'runner',
    text: 'THE RIM IS CLEAR',
  }),
  Object.freeze({
    id: 'toast/break-course',
    voice: 'runner',
    text: 'BREAK · COURSE CHANGED',
  }),
  Object.freeze({
    id: 'toast/loop-closed',
    voice: 'runner',
    text: 'RELAY LOOP CLOSED · WORLDS ANSWER',
  }),
  Object.freeze({
    id: 'toast/command-landed',
    voice: 'runner',
    text: 'COMMAND LANDED · CORE LATTICE ACTIVE',
  }),
  Object.freeze({
    id: 'toast/command-locked',
    voice: 'runner',
    text: 'COMMAND WORLD LOCKED',
  }),
  Object.freeze({
    id: 'toast/worldheart-awakening',
    voice: 'runner',
    text: 'THE WORLDHEART IS AWAKENING',
  }),
  Object.freeze({
    id: 'toast/run-lost',
    voice: 'warden',
    text: 'RUN LOST · WARDEN ARRIVED',
  }),
  Object.freeze({
    id: 'toast/control-signal',
    voice: 'runner',
    text: 'Control signal breaking.',
  }),
]);

export const SfxDefinitions = Object.freeze([
  Object.freeze({
    id: 'sfx/cage-break',
    kind: 'sfx',
    file: 'sfx/cage-break.mp3',
    prompt: 'Short tiny toy metal cage snapping open. Miniature click-crack. Dry. No boom. No reverb.',
    durationSeconds: 0.7,
  }),
  Object.freeze({
    id: 'sfx/launch',
    kind: 'sfx',
    file: 'sfx/launch.mp3',
    prompt: 'Short tiny toy courier puff as a marble ship leaves a globe. Miniature whoosh. Cute. No explosion.',
    durationSeconds: 0.65,
  }),
  Object.freeze({
    id: 'sfx/land',
    kind: 'sfx',
    file: 'sfx/land.mp3',
    prompt: 'Short tiny toy ship settling onto a glass marble. Soft tap. Miniature. No crash.',
    durationSeconds: 0.6,
  }),
  Object.freeze({
    id: 'sfx/discover',
    kind: 'sfx',
    file: 'sfx/discover.mp3',
    prompt: 'Short tiny glass chime. Quiet sparkle of discovery on a miniature world. Soft. No fanfare.',
    durationSeconds: 0.55,
  }),
  Object.freeze({
    id: 'sfx/ui-continue',
    kind: 'sfx',
    file: 'sfx/ui-continue.mp3',
    prompt: 'Short tiny UI continue blip. Soft wooden click. Miniature and friendly.',
    durationSeconds: 0.5,
  }),
]);

export const MusicDefinitions = Object.freeze([
  Object.freeze({
    id: 'music/tiny-worlds',
    kind: 'music',
    file: 'music/tiny-worlds.mp3',
    prompt: 'Quiet looping ambient music for miniature toy planets. Soft hopeful pads, no drums, no vocals, very low energy, 28 seconds.',
    optional: false,
  }),
  Object.freeze({
    id: 'music/warden-sting',
    kind: 'music',
    file: 'music/warden-sting.mp3',
    prompt: 'Short cold two-note sting. Authoritarian but miniature. Dark, dry, 2 seconds. No choir.',
    optional: true,
  }),
]);

function hashText(Text) {
  let Hash = 2166136261;
  for (let Index = 0; Index < Text.length; Index += 1) {
    Hash ^= Text.charCodeAt(Index);
    Hash = Math.imul(Hash, 16777619);
  }
  return (Hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeSpokenText(Text) {
  if (typeof Text !== 'string') {
    return '';
  }
  return Text
    .replace(/\u2014/g, '. ')
    .replace(/\u2013/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function speakerVoiceKey(Speaker) {
  return WardenSpeakers.has(Speaker) ? 'warden' : 'runner';
}

function voiceFileName(VoiceKey, SpokenText) {
  return `voice/${VoiceKey}-${hashText(`${VoiceKey}:${SpokenText}`)}.mp3`;
}

function makeVoiceClip({
  id,
  voice,
  text,
  speaker = '',
  group = 'story',
}) {
  const SpokenText = normalizeSpokenText(text);
  if (!SpokenText) {
    throw new Error(`Voice clip ${id} needs spoken text.`);
  }
  return {
    id,
    kind: 'voice',
    voice,
    speaker,
    group,
    text: SpokenText,
    file: voiceFileName(voice, SpokenText),
  };
}

function pageSpokenText(Page, Tokens = { world: 'this world' }) {
  const Title = formatStoryBoardCopy(Page.title, Tokens);
  const Body = formatStoryBoardCopy(Page.body, Tokens);
  return `${Title} ${Body}`;
}

function collectStoryClips() {
  const Clips = [];
  for (const SystemId of AuthoredCampaignSystemIdentifiers) {
    const System = AuthoredSystemDefinitions[SystemId];
    const OpeningPages = System.openingBriefing ?? [];
    OpeningPages.forEach((Page, PageIndex) => {
      Clips.push(makeVoiceClip({
        id: `story/${SystemId}/opening/${PageIndex}`,
        voice: speakerVoiceKey(Page.speaker),
        speaker: Page.speaker,
        group: 'opening',
        text: pageSpokenText(Page),
      }));
    });
    for (const [BoardId, Board] of Object.entries(System.storyBoards ?? {})) {
      (Board.pages ?? []).forEach((Page, PageIndex) => {
        Clips.push(makeVoiceClip({
          id: `story/${SystemId}/${BoardId}/${PageIndex}`,
          voice: speakerVoiceKey(Page.speaker),
          speaker: Page.speaker,
          group: BoardId === 'runLost' ? 'lose' : 'story',
          text: pageSpokenText(Page),
        }));
      });
    }
    if (System.openingBroadcast) {
      Clips.push(makeVoiceClip({
        id: `broadcast/${SystemId}/opening`,
        voice: 'warden',
        speaker: 'THE WARDEN',
        group: 'broadcast',
        text: System.openingBroadcast,
      }));
    }
    if (System.wardenArrivalBroadcast) {
      Clips.push(makeVoiceClip({
        id: `broadcast/${SystemId}/arrival`,
        voice: 'warden',
        speaker: 'THE WARDEN',
        group: 'broadcast',
        text: System.wardenArrivalBroadcast,
      }));
    }
    for (const World of System.worlds ?? []) {
      if (typeof World.memory === 'string' && World.memory.trim() !== '') {
        Clips.push(makeVoiceClip({
          id: `memory/${SystemId}/${World.id}`,
          voice: 'runner',
          speaker: World.label ?? 'THE NETWORK',
          group: 'memory',
          text: World.memory,
        }));
      }
    }
    const Completion = System.completion ?? {};
    if (Completion.title && Completion.body) {
      Clips.push(makeVoiceClip({
        id: `win/${SystemId}/standard`,
        voice: 'runner',
        speaker: 'THE RUN',
        group: 'win',
        text: `${Completion.title} ${Completion.body} ${Completion.endingReveal ?? ''}`.trim(),
      }));
    }
    if (Completion.perfectTitle && Completion.perfectBody) {
      Clips.push(makeVoiceClip({
        id: `win/${SystemId}/perfect`,
        voice: 'runner',
        speaker: 'THE RUN',
        group: 'win',
        text: `${Completion.perfectTitle} ${Completion.perfectBody} ${Completion.endingReveal ?? ''}`.trim(),
      }));
    }
    if (Completion.expansionSting) {
      Clips.push(makeVoiceClip({
        id: `win/${SystemId}/sting`,
        voice: 'warden',
        speaker: 'THE WARDEN',
        group: 'win',
        text: Completion.expansionSting,
      }));
    }
  }
  return Clips;
}

function collectHowToClips() {
  const Presentation = getHowToPlayPresentation();
  const Clips = [
    makeVoiceClip({
      id: 'howto/title',
      voice: 'runner',
      speaker: 'THE RUNNER',
      group: 'howto',
      text: Presentation.title,
    }),
  ];
  HowToPlayLines.forEach((Line, LineIndex) => {
    Clips.push(makeVoiceClip({
      id: `howto/${LineIndex}`,
      voice: 'runner',
      speaker: 'THE RUNNER',
      group: 'howto',
      text: Line,
    }));
  });
  return Clips;
}

function collectCoachClips() {
  return [
    makeVoiceClip({
      id: 'coach/walk',
      voice: 'runner',
      speaker: 'THE RUNNER',
      group: 'coach',
      text: `Drag the planet to walk. ${FirstRunCoachBodies.walk}`,
    }),
    makeVoiceClip({
      id: 'coach/aim',
      voice: 'runner',
      speaker: 'THE RUNNER',
      group: 'coach',
      text: `Pull the ship, then let go. ${FirstRunCoachBodies.aim}`,
    }),
    makeVoiceClip({
      id: 'coach/break',
      voice: 'runner',
      speaker: 'THE RUNNER',
      group: 'coach',
      text: `${TaughtCaptionLines.break.title}. ${TaughtCaptionLines.break.body}`,
    }),
    makeVoiceClip({
      id: 'coach/missed-port',
      voice: 'runner',
      speaker: 'THE RUNNER',
      group: 'coach',
      text: `${TaughtCaptionLines['missed-port'].title} ${TaughtCaptionLines['missed-port'].body}`,
    }),
  ];
}

function collectToastClips() {
  return NarrativeToastLines.map((Line) => makeVoiceClip({
    id: Line.id,
    voice: Line.voice,
    speaker: Line.voice === 'warden' ? 'THE WARDEN' : 'THE RUNNER',
    group: 'toast',
    text: Line.text,
  }));
}

function freezeClips(Clips) {
  const ById = new Map();
  const ByText = new Map();
  for (const Clip of Clips) {
    if (ById.has(Clip.id)) {
      throw new Error(`Duplicate audio clip id ${Clip.id}.`);
    }
    ById.set(Clip.id, Object.freeze(Clip));
    const TextKey = `${Clip.voice}:${Clip.text}`;
    if (!ByText.has(TextKey)) {
      ByText.set(TextKey, Clip.id);
    }
  }
  return {
    clips: Object.freeze(Clips.map((Clip) => ById.get(Clip.id))),
    byId: ById,
    byText: ByText,
  };
}

const VoiceCatalog = freezeClips([
  ...collectStoryClips(),
  ...collectHowToClips(),
  ...collectCoachClips(),
  ...collectToastClips(),
]);

export const VoiceClips = VoiceCatalog.clips;

export function listVoiceClips() {
  return VoiceClips;
}

export function listSfxClips() {
  return SfxDefinitions;
}

export function listMusicClips() {
  return MusicDefinitions;
}

export function listGenerateJobs() {
  const UniqueVoiceFiles = new Map();
  for (const Clip of VoiceClips) {
    if (!UniqueVoiceFiles.has(Clip.file)) {
      UniqueVoiceFiles.set(Clip.file, Clip);
    }
  }
  return {
    voices: [...UniqueVoiceFiles.values()],
    sfx: [...SfxDefinitions],
    music: [...MusicDefinitions],
  };
}

export function getClipById(ClipId) {
  return VoiceCatalog.byId.get(ClipId)
    ?? SfxDefinitions.find((Clip) => Clip.id === ClipId)
    ?? MusicDefinitions.find((Clip) => Clip.id === ClipId)
    ?? null;
}

export function getStoryVoiceClipId(SystemId, BoardId, PageIndex) {
  return `story/${SystemId}/${BoardId}/${PageIndex}`;
}

export function getHowToPlayClipIds() {
  return ['howto/title', ...HowToPlayLines.map((_, LineIndex) => `howto/${LineIndex}`)];
}

export function getCoachClipId(Kind) {
  if (Kind === 'walk' || Kind === 'aim' || Kind === 'break' || Kind === 'missed-port') {
    return `coach/${Kind}`;
  }
  return '';
}

export function findVoiceClipByText(Text) {
  const Spoken = normalizeSpokenText(Text);
  if (!Spoken) {
    return null;
  }
  for (const VoiceKey of Object.keys(ElevenLabsVoiceProfiles)) {
    const ClipId = VoiceCatalog.byText.get(`${VoiceKey}:${Spoken}`);
    if (ClipId) {
      return VoiceCatalog.byId.get(ClipId) ?? null;
    }
  }
  const ControlSignal = VoiceCatalog.byId.get('toast/control-signal');
  if (Spoken.startsWith('CONTROL SIGNAL BREAKING') && ControlSignal) {
    return ControlSignal;
  }
  return null;
}

export function getAudioAssetUrl(RelativeFile) {
  return `${AudioAssetRoot}/${RelativeFile}?v=${AudioAssetVersion}`;
}

export function countCatalogStats() {
  const Jobs = listGenerateJobs();
  return {
    voiceLines: VoiceClips.length,
    uniqueVoiceFiles: Jobs.voices.length,
    sfx: Jobs.sfx.length,
    music: Jobs.music.length,
  };
}
