#!/usr/bin/env node
/**
 * Generates committed sampled audio with the ElevenLabs HTTP API.
 *
 * Reads ELEVENLABS_API_KEY from the environment only. Never prints, writes, or
 * commits the key. The playable game never calls this API.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ElevenLabsVoiceProfiles,
  listGenerateJobs,
} from '../src/audio-catalog.js';

const ScriptDirectory = dirname(fileURLToPath(import.meta.url));
const RepositoryRoot = resolve(ScriptDirectory, '..');
const AudioRoot = resolve(RepositoryRoot, 'assets/audio');
const ApiOrigin = 'https://api.elevenlabs.io';
const SfxDurationMinimumSeconds = 0.5;
const SfxDurationMaximumSeconds = 30;

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

async function writeAudioFile(RelativeFile, Bytes) {
  const AbsolutePath = resolve(AudioRoot, RelativeFile);
  await mkdir(dirname(AbsolutePath), { recursive: true });
  await writeFile(AbsolutePath, Bytes);
}

async function postAudio(ApiKey, Path, Body) {
  const Response = await fetch(`${ApiOrigin}${Path}`, {
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
  if (BufferData.length < 64) {
    throw new Error(`ElevenLabs ${Path} returned an empty audio body.`);
  }
  return BufferData;
}

async function generateVoiceClip(ApiKey, Clip) {
  const Profile = ElevenLabsVoiceProfiles[Clip.voice];
  if (!Profile) {
    throw new Error(`Unknown voice profile ${Clip.voice} for ${Clip.id}.`);
  }
  const Bytes = await postAudio(
    ApiKey,
    `/v1/text-to-speech/${Profile.voiceId}?output_format=mp3_44100_128`,
    {
      text: Clip.text,
      model_id: Profile.modelId,
      voice_settings: Profile.settings,
    },
  );
  await writeAudioFile(Clip.file, Bytes);
}

async function generateSfxClip(ApiKey, Clip) {
  const Bytes = await postAudio(ApiKey, '/v1/sound-generation', {
    text: Clip.prompt,
    duration_seconds: clampSfxDurationSeconds(Clip.durationSeconds),
    prompt_influence: 0.35,
  });
  await writeAudioFile(Clip.file, Bytes);
}

async function generateMusicClip(ApiKey, Clip) {
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
      const Bytes = await postAudio(ApiKey, Attempt.path, Attempt.body);
      await writeAudioFile(Clip.file, Bytes);
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
  return new Promise((Resolve) => {
    setTimeout(Resolve, Milliseconds);
  });
}

async function main() {
  const ApiKey = readApiKey();
  if (!ApiKey) {
    console.log('ELEVENLABS_API_KEY is not set. Skipping generation.');
    console.log('Add the GitHub Actions secret and re-run workflow_dispatch.');
    return;
  }

  const Jobs = listGenerateJobs();
  console.log(
    `Generating ${Jobs.voices.length} unique voice files, ${Jobs.sfx.length} SFX, ${Jobs.music.length} music clips.`,
  );

  for (const Clip of Jobs.voices) {
    await generateVoiceClip(ApiKey, Clip);
    console.log(`voice ${Clip.id}`);
    await sleep(120);
  }
  for (const Clip of Jobs.sfx) {
    await generateSfxClip(ApiKey, Clip);
    console.log(`sfx ${Clip.id}`);
    await sleep(120);
  }
  for (const Clip of Jobs.music) {
    const Generated = await generateMusicClip(ApiKey, Clip);
    console.log(Generated ? `music ${Clip.id}` : `music skipped ${Clip.id}`);
    await sleep(120);
  }
  console.log('ElevenLabs generation finished.');
}

main().catch((Caught) => {
  console.error(Caught.message);
  process.exitCode = 1;
});
