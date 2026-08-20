import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import {
  generateWardenAuditions,
  saveSelectedWardenVoice,
  WardenAuditionText,
  WardenVoiceDescription,
} from '../scripts/audition-warden-voice.mjs';
import {
  buildWardenMasterFilter,
  parseMasterArguments,
  WardenMasterRevision,
} from '../scripts/master-warden-audio.mjs';

const PreviewBytes = Buffer.from('review-only-mp3-preview');

test('Warden Voice Design writes three review-only candidates and a manifest', async () => {
  const OutputRoot = await mkdtemp(resolve(tmpdir(), 'orbitbreak-warden-audition-'));
  const Calls = [];
  const FetchImpl = async (Url, Options) => {
    Calls.push({ url: String(Url), body: JSON.parse(Options.body) });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        text: WardenAuditionText,
        previews: [1, 2, 3].map((Candidate) => ({
          generated_voice_id: `generated-${Candidate}`,
          audio_base_64: PreviewBytes.toString('base64'),
          duration_secs: 12,
        })),
      }),
    };
  };
  try {
    const Manifest = await generateWardenAuditions({
      apiKey: 'test-not-a-secret',
      outputRoot: OutputRoot,
      fetchImpl: FetchImpl,
    });
    assert.equal(Calls.length, 1);
    assert.equal(Calls[0].url.includes('/v1/text-to-voice/design'), true);
    assert.equal(Calls[0].body.voice_description, WardenVoiceDescription);
    assert.equal(Calls[0].body.model_id, 'eleven_multilingual_ttv_v2');
    assert.equal(Manifest.candidates.length, 3);
    assert.equal((await readFile(resolve(OutputRoot, 'candidate-1.mp3'))).equals(PreviewBytes), true);
    assert.equal(JSON.parse(await readFile(resolve(OutputRoot, 'manifest.json'), 'utf8')).status, 'awaiting-user-selection');
  } finally {
    await rm(OutputRoot, { recursive: true, force: true });
  }
});

test('only a candidate recorded in the audition manifest can be saved', async () => {
  const OutputRoot = await mkdtemp(resolve(tmpdir(), 'orbitbreak-warden-selection-'));
  const Manifest = {
    candidates: [
      { candidate: 1, generatedVoiceId: 'generated-1' },
      { candidate: 2, generatedVoiceId: 'generated-2' },
      { candidate: 3, generatedVoiceId: 'generated-3' },
    ],
  };
  await writeFile(resolve(OutputRoot, 'manifest.json'), JSON.stringify(Manifest));
  const FetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ voice_id: 'selected-voice-id', name: 'ORBITBREAK Warden' }),
  });
  try {
    await assert.rejects(() => saveSelectedWardenVoice({
      apiKey: 'test-not-a-secret',
      generatedVoiceId: 'not-reviewed',
      outputRoot: OutputRoot,
      fetchImpl: FetchImpl,
    }), /not present/);
    const Selection = await saveSelectedWardenVoice({
      apiKey: 'test-not-a-secret',
      generatedVoiceId: 'generated-2',
      outputRoot: OutputRoot,
      fetchImpl: FetchImpl,
    });
    assert.equal(Selection.candidate, 2);
    assert.equal(Selection.voiceId, 'selected-voice-id');
  } finally {
    await rm(OutputRoot, { recursive: true, force: true });
  }
});

test('Warden master is a mono radio chain with restrained robotic layering', () => {
  const Filter = buildWardenMasterFilter(6.5);
  assert.equal(WardenMasterRevision, 'warden-radio-v1');
  assert.match(Filter, /channel_layouts=mono/);
  assert.match(Filter, /highpass=f=220/);
  assert.match(Filter, /lowpass=f=4200/);
  assert.match(Filter, /asetrate=41013/);
  assert.match(Filter, /anoisesrc=color=pink/);
  assert.match(Filter, /loudnorm=I=-16:TP=-1\.5:LRA=7/);
  assert.deepEqual(parseMasterArguments(['--dry-run']).dryRun, true);
});
