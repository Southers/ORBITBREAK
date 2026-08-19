#!/usr/bin/env node
/**
 * Generates committed sampled audio with the ElevenLabs HTTP API.
 *
 * Reads ELEVENLABS_API_KEY from the environment only. Never prints, writes, or
 * commits the key. The playable game never calls this API.
 *
 * Existing non-empty files under assets/audio/ are skipped so a catalog
 * cache-bust does not regenerate or spend quota. Set FORCE_REGENERATE=1 to
 * overwrite every clip.
 */

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ElevenLabsVoiceProfiles,
  listGenerateJobs,
} from '../src/audio-catalog.js';

const ScriptDirectory = dirname(fileURLToPath(import.meta.url));
const RepositoryRoot = resolve(ScriptDirectory, '..');
const DefaultAudioRoot = resolve(RepositoryRoot, 'assets/audio');
const ApiOrigin = 'https://api.elevenlabs.io';
const SfxDurationMinimumSeconds = 0.5;
const SfxDurationMaximumSeconds = 30;
export const ExistingAudioMinimumBytes = 64;

function clampSfxDurationSeconds(DurationSeconds) {
  const Duration = Number(DurationSeconds);
  if (!Number.isFinite(Duration)) {
    return SfxDurationMinimumSeconds;
  }
  return Math.min(
    SfxDurationMaximumSeconds,
    Math.max(SfxDurationMinimumSeconds, Duration),
  );
}

export function isForceRegenerateEnabled() {
  return String(process.env.FORCE_REGENERATE ?? '').trim() === '1';
}

function readApiKey() {
  const Key = typeof process.env.ELEVENLABS_API_KEY === 'string'
    ? process.env.ELEVENLABS_API_KEY.trim()
    : '';
  return Key;
}

function elevenHeaders(ApiKey) {
  return {
    'xi-api-key': ApiKey,
    Accept: 'audio/mpeg',
    'Content-Type': 'application/json',
  };
}

export async function existingClipIsReusable(AbsolutePath) {
  try {
    const Info = await stat(AbsolutePath);
    return Info.isFile() && Info.size > ExistingAudioMinimumBytes;
  } catch {
    return false;
  }
}

async function writeAudioFile(AudioRoot, RelativeFile, Bytes) {
  const AbsolutePath = resolve(AudioRoot, RelativeFile);
  await mkdir(dirname(AbsolutePath), { recursive: true });
  await writeFile(AbsolutePath, Bytes);
}

async function postAudio(FetchImpl, ApiKey, Path, Body) {
  const Response = await FetchImpl(`${ApiOrigin}${Path}`, {
    method: 'POST',
    headers: elevenHeaders(ApiKey),
    body: JSON.stringify(Body),
  });
  if (!Response.ok) {
    const Detail = await Response.text();
    const SafeDetail = Detail.slice(0, 400).replace(/sk_[a-zA-Z0-9]+/g, '[redacted]');
    const RequestError = new Error(`ElevenLabs ${Path} failed (${Response.status}): ${SafeDetail}`);
    RequestError.status = Response.status;
    throw RequestError;
  }
  const BufferData = Buffer.from(await Response.arrayBuffer());
  if (BufferData.length < ExistingAudioMinimumBytes) {
    throw new Error(`ElevenLabs ${Path} returned an empty audio body.`);
  }
  return BufferData;
}

async function generateVoiceClip(Context, Clip) {
  const Profile = ElevenLabsVoiceProfiles[Clip.voice];
  if (!Profile) {
    throw new Error(`Unknown voice profile ${Clip.voice} for ${Clip.id}.`);
  }
  const Bytes = await postAudio(
    Context.fetchImpl,
    Context.apiKey,
    `/v1/text-to-speech/${Profile.voiceId}?output_format=mp3_44100_128`,
    {
      text: Clip.text,
      model_id: Profile.modelId,
      voice_settings: Profile.settings,
    },
  );
  await writeAudioFile(Context.audioRoot, Clip.file, Bytes);
  return true;
}

async function generateSfxClip(Context, Clip) {
  const Bytes = await postAudio(Context.fetchImpl, Context.apiKey, '/v1/sound-generation', {
    text: Clip.prompt,
    duration_seconds: clampSfxDurationSeconds(Clip.durationSeconds),
    prompt_influence: 0.35,
  });
  await writeAudioFile(Context.audioRoot, Clip.file, Bytes);
  return true;
}

async function generateMusicClip(Context, Clip) {
  const MusicBodies = [
    {
      path: '/v1/music',
      body: {
        prompt: Clip.prompt,
        music_length_ms: Clip.optional ? 2500 : 28000,
      },
    },
    {
      path: '/v1/music/compose',
      body: {
        prompt: Clip.prompt,
        music_length_ms: Clip.optional ? 2500 : 28000,
      },
    },
  ];
  let LastError = null;
  for (const Attempt of MusicBodies) {
    try {
      const Bytes = await postAudio(Context.fetchImpl, Context.apiKey, Attempt.path, Attempt.body);
      await writeAudioFile(Context.audioRoot, Clip.file, Bytes);
      return true;
    } catch (Caught) {
      LastError = Caught;
      if (Caught.status === 404 || Caught.status === 405 || Caught.status === 422) {
        continue;
      }
      if (Clip.optional) {
        return false;
      }
      throw Caught;
    }
  }
  if (Clip.optional || LastError?.status === 404 || LastError?.status === 405) {
    return false;
  }
  throw LastError ?? new Error('Music generation failed.');
}

function sleep(Milliseconds) {
  if (!Milliseconds) {
    return Promise.resolve();
  }
  return new Promise((Resolve) => {
    setTimeout(Resolve, Milliseconds);
  });
}

async function processClip(Context, Clip, Kind, GenerateFn) {
  const AbsolutePath = resolve(Context.audioRoot, Clip.file);
  if (!Context.forceRegenerate && await existingClipIsReusable(AbsolutePath)) {
    Context.log(`skip existing ${Clip.id}`);
    Context.skipped += 1;
    return;
  }
  if (!Context.apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set.');
  }
  const Generated = await GenerateFn();
  if (Generated) {
    Context.log(`${Kind} ${Clip.id}`);
    Context.generated += 1;
  } else {
    Context.log(`${Kind} skipped ${Clip.id}`);
  }
  await sleep(Context.sleepMs);
}

export async function generateCatalogAudio({
  apiKey = '',
  audioRoot = DefaultAudioRoot,
  jobs = listGenerateJobs(),
  forceRegenerate = isForceRegenerateEnabled(),
  fetchImpl = globalThis.fetch,
  log = console.log,
  sleepMs = 120,
} = {}) {
  const Context = {
    apiKey,
    audioRoot,
    forceRegenerate,
    fetchImpl,
    log,
    sleepMs,
    generated: 0,
    skipped: 0,
  };

  log(
    `Generating ${jobs.voices.length} unique voice files, ${jobs.sfx.length} SFX, ${jobs.music.length} music clips.`,
  );

  for (const Clip of jobs.voices) {
    await processClip(Context, Clip, 'voice', () => generateVoiceClip(Context, Clip));
  }
  for (const Clip of jobs.sfx) {
    await processClip(Context, Clip, 'sfx', () => generateSfxClip(Context, Clip));
  }
  for (const Clip of jobs.music) {
    await processClip(Context, Clip, 'music', () => generateMusicClip(Context, Clip));
  }

  if (Context.generated === 0) {
    log('ElevenLabs generation finished. No new audio files.');
  } else {
    log(`ElevenLabs generation finished. Generated ${Context.generated}, skipped ${Context.skipped}.`);
  }
  return { generated: Context.generated, skipped: Context.skipped };
}

async function main() {
  const ApiKey = readApiKey();
  if (!ApiKey) {
    console.log('ELEVENLABS_API_KEY is not set. Skipping generation.');
    console.log('Add the GitHub Actions secret and re-run workflow_dispatch.');
    return;
  }

  await generateCatalogAudio({ apiKey: ApiKey });
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((Caught) => {
    console.error(Caught.message);
    process.exitCode = 1;
  });
}
