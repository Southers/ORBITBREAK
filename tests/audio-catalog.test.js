import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AuthoredCampaignSystemIdentifiers,
  AuthoredSystemDefinitions,
} from '../src/content.js';
import {
  HowToPlayLines,
  FirstRunCoachBodies,
} from '../src/presentation.js';
import {
  SfxDefinitions,
  TaughtCaptionLines,
  countCatalogStats,
  getClipById,
  getHowToPlayClipIds,
  getStoryVoiceClipId,
  listGenerateJobs,
  listVoiceClips,
  normalizeSpokenText,
} from '../src/audio-catalog.js';

const Root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readRepo(RelativePath) {
  return readFileSync(resolve(Root, RelativePath), 'utf8');
}

test('catalog voices every campaign story board, how-to card, coach and win line', () => {
  const Clips = listVoiceClips();
  const Ids = new Set(Clips.map((Clip) => Clip.id));
  for (const SystemId of AuthoredCampaignSystemIdentifiers) {
    const System = AuthoredSystemDefinitions[SystemId];
    (System.openingBriefing ?? []).forEach((_, PageIndex) => {
      assert.ok(Ids.has(getStoryVoiceClipId(SystemId, 'opening', PageIndex)));
    });
    for (const [BoardId, Board] of Object.entries(System.storyBoards ?? {})) {
      (Board.pages ?? []).forEach((_, PageIndex) => {
        assert.ok(Ids.has(getStoryVoiceClipId(SystemId, BoardId, PageIndex)), `${SystemId}/${BoardId}/${PageIndex}`);
      });
    }
    assert.ok(Ids.has(`broadcast/${SystemId}/opening`));
    assert.ok(Ids.has(`broadcast/${SystemId}/arrival`));
    assert.ok(Ids.has(`win/${SystemId}/standard`));
    assert.ok(Ids.has(`win/${SystemId}/perfect`));
    for (const World of System.worlds) {
      if (typeof World.memory === 'string' && World.memory.trim() !== '') {
        assert.ok(Ids.has(`memory/${SystemId}/${World.id}`));
      }
    }
  }
  for (const ClipId of getHowToPlayClipIds()) {
    assert.ok(Ids.has(ClipId));
  }
  assert.equal(HowToPlayLines.length + 1, getHowToPlayClipIds().length);
  assert.ok(Ids.has('coach/walk'));
  assert.ok(Ids.has('coach/aim'));
  assert.ok(Ids.has('coach/break'));
  assert.ok(Ids.has('coach/missed-port'));
  assert.equal(getClipById('coach/walk').text.includes(FirstRunCoachBodies.walk), true);
  assert.equal(getClipById('coach/break').text.includes(normalizeSpokenText(TaughtCaptionLines.break.title)), true);
  const Stats = countCatalogStats();
  assert.ok(Stats.voiceLines >= 80);
  assert.ok(Stats.uniqueVoiceFiles <= Stats.voiceLines);
  assert.equal(Stats.sfx, 5);
  assert.equal(Stats.music, 2);
});

test('spoken catalog text has no em dashes and uses only the two stock voices', () => {
  for (const Clip of listVoiceClips()) {
    assert.equal(Clip.text.includes('\u2014'), false, Clip.id);
    assert.ok(Clip.voice === 'warden' || Clip.voice === 'runner', Clip.id);
    assert.ok(Clip.file.startsWith(`voice/${Clip.voice}-`));
  }
});

test('generate jobs share files for identical spoken lines', () => {
  const Jobs = listGenerateJobs();
  const Files = Jobs.voices.map((Clip) => Clip.file);
  assert.equal(new Set(Files).size, Files.length);
});

test('SFX durations stay toy-scale and meet ElevenLabs sound-generation limits', () => {
  const Generator = readRepo('scripts/generate-elevenlabs-audio.mjs');
  assert.equal(Generator.includes('clampSfxDurationSeconds'), true);
  for (const Clip of SfxDefinitions) {
    assert.ok(Clip.durationSeconds >= 0.5, Clip.id);
    assert.ok(Clip.durationSeconds <= 0.7, Clip.id);
  }
  assert.equal(getClipById('sfx/ui-continue').durationSeconds, 0.5);
});

test('playable sources never call ElevenLabs and the workflow never echoes the secret', () => {
  const AudioSource = readRepo('src/audio.js');
  const CatalogSource = readRepo('src/audio-catalog.js');
  const MainSource = readRepo('src/main.js');
  const Workflow = readRepo('.github/workflows/generate-elevenlabs-audio.yml');
  const Generator = readRepo('scripts/generate-elevenlabs-audio.mjs');
  const Credits = readRepo('CREDITS.md');
  const Readme = readRepo('README.md');
  for (const Source of [AudioSource, CatalogSource, MainSource]) {
    assert.equal(Source.includes('api.elevenlabs.io'), false);
    assert.equal(Source.includes('xi-api-key'), false);
  }
  assert.equal(AudioSource.includes("from './audio-catalog.js"), true);
  assert.equal(AudioSource.includes('playStoryVoice'), true);
  assert.equal(AudioSource.includes('ensureStarted()'), true);
  assert.equal(Workflow.includes('secrets.ELEVENLABS_API_KEY'), true);
  assert.equal(Workflow.includes('workflow_dispatch'), true);
  assert.equal(Workflow.includes('echo "$ELEVENLABS_API_KEY"'), false);
  assert.equal(Workflow.includes('echo $ELEVENLABS_API_KEY'), false);
  assert.equal(Generator.includes('process.env.ELEVENLABS_API_KEY'), true);
  assert.equal(Generator.includes('console.log(ApiKey)'), false);
  assert.equal(Generator.includes('const Error = new Error'), false);
  assert.equal(Credits.includes('ElevenLabs'), true);
  assert.equal(Readme.includes('ElevenLabs'), true);
  const InputSource = readRepo('src/input-controller.js');
  const LandingSource = readRepo('src/landing-director.js');
  assert.equal(InputSource.includes(TaughtCaptionLines.break.title), true);
  assert.equal(LandingSource.includes(TaughtCaptionLines['missed-port'].body), true);
});
