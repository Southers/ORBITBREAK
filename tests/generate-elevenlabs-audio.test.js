import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

import { listGenerateJobs } from '../src/audio-catalog.js';
import {
  ExistingAudioMinimumBytes,
  generateCatalogAudio,
  isForceRegenerateEnabled,
} from '../scripts/generate-elevenlabs-audio.mjs';

const DummyAudio = Buffer.alloc(ExistingAudioMinimumBytes + 16, 7);
const PlaceholderKey = 'test-not-a-secret';

async function writeClipFile(AudioRoot, RelativeFile, Bytes = DummyAudio) {
  const AbsolutePath = resolve(AudioRoot, RelativeFile);
  await mkdir(dirname(AbsolutePath), { recursive: true });
  await writeFile(AbsolutePath, Bytes);
}

function createFetchRecorder() {
  const Calls = [];
  const FetchImpl = async (Url, Options) => {
    Calls.push({ url: String(Url), method: Options?.method ?? 'GET' });
    throw new Error('network should not be called');
  };
  return { Calls, FetchImpl };
}

function createOkFetch(Calls) {
  return async (Url, Options) => {
    Calls.push({ url: String(Url), method: Options?.method ?? 'GET' });
    return {
      ok: true,
      status: 200,
      text: async () => '',
      arrayBuffer: async () => new Uint8Array(DummyAudio).buffer,
    };
  };
}

test('generator skips existing files and does not call the network', async () => {
  const AudioRoot = await mkdtemp(resolve(tmpdir(), 'orbitbreak-audio-skip-'));
  const Logs = [];
  const { Calls, FetchImpl } = createFetchRecorder();
  try {
    const Jobs = listGenerateJobs();
    const AllClips = [...Jobs.voices, ...Jobs.sfx, ...Jobs.music];
    for (const Clip of AllClips) {
      await writeClipFile(AudioRoot, Clip.file);
    }

    const Result = await generateCatalogAudio({
      apiKey: PlaceholderKey,
      audioRoot: AudioRoot,
      jobs: Jobs,
      forceRegenerate: false,
      fetchImpl: FetchImpl,
      log: (Line) => Logs.push(Line),
      sleepMs: 0,
    });

    assert.equal(Calls.length, 0);
    assert.equal(Result.generated, 0);
    assert.equal(Result.skipped, AllClips.length);
    for (const Clip of AllClips) {
      assert.equal(Logs.includes(`skip existing ${Clip.id}`), true, Clip.id);
    }
    assert.equal(Logs.includes('ElevenLabs generation finished. No new audio files.'), true);
  } finally {
    await rm(AudioRoot, { recursive: true, force: true });
  }
});

test('generator leaves empty files for later generation and FORCE_REGENERATE overwrites', async () => {
  const AudioRoot = await mkdtemp(resolve(tmpdir(), 'orbitbreak-audio-force-'));
  const SkipLogs = [];
  const ForceLogs = [];
  const ForceCalls = [];
  try {
    const Jobs = {
      voices: [{
        id: 'story/test',
        voice: 'runner',
        file: 'voice/runner-test.mp3',
        text: 'Hello tiny worlds.',
      }],
      sfx: [{
        id: 'sfx/land',
        file: 'sfx/land.mp3',
        prompt: 'Soft tap.',
        durationSeconds: 0.6,
      }],
      music: [{
        id: 'music/tiny-worlds',
        file: 'music/tiny-worlds.mp3',
        prompt: 'Quiet pads.',
        optional: false,
      }],
    };

    await writeClipFile(AudioRoot, Jobs.voices[0].file, Buffer.alloc(8, 1));
    await writeClipFile(AudioRoot, Jobs.sfx[0].file);
    await writeClipFile(AudioRoot, Jobs.music[0].file);

    const EmptyCalls = [];
    const EmptyResult = await generateCatalogAudio({
      apiKey: PlaceholderKey,
      audioRoot: AudioRoot,
      jobs: { voices: [Jobs.voices[0]], sfx: [], music: [] },
      forceRegenerate: false,
      fetchImpl: createOkFetch(EmptyCalls),
      log: (Line) => SkipLogs.push(Line),
      sleepMs: 0,
    });
    assert.equal(EmptyResult.generated, 1);
    assert.equal(EmptyResult.skipped, 0);
    assert.equal(EmptyCalls.length, 1);
    assert.equal(SkipLogs.includes('skip existing story/test'), false);

    const ForceResult = await generateCatalogAudio({
      apiKey: PlaceholderKey,
      audioRoot: AudioRoot,
      jobs: Jobs,
      forceRegenerate: true,
      fetchImpl: createOkFetch(ForceCalls),
      log: (Line) => ForceLogs.push(Line),
      sleepMs: 0,
    });
    assert.equal(ForceResult.generated, 3);
    assert.equal(ForceResult.skipped, 0);
    assert.ok(ForceCalls.length >= 3);
    assert.equal(ForceLogs.includes('skip existing sfx/land'), false);
    const Overwritten = await readFile(resolve(AudioRoot, Jobs.sfx[0].file));
    assert.equal(Overwritten.equals(DummyAudio), true);
  } finally {
    await rm(AudioRoot, { recursive: true, force: true });
  }
});

test('FORCE_REGENERATE is enabled only by the string 1', () => {
  const Previous = process.env.FORCE_REGENERATE;
  try {
    delete process.env.FORCE_REGENERATE;
    assert.equal(isForceRegenerateEnabled(), false);
    process.env.FORCE_REGENERATE = '0';
    assert.equal(isForceRegenerateEnabled(), false);
    process.env.FORCE_REGENERATE = '1';
    assert.equal(isForceRegenerateEnabled(), true);
  } finally {
    if (Previous === undefined) {
      delete process.env.FORCE_REGENERATE;
    } else {
      process.env.FORCE_REGENERATE = Previous;
    }
  }
});
