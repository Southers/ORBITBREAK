#!/usr/bin/env node
/**
 * Creates three review-only Warden Voice Design previews, or saves one reviewed
 * preview to the owner's ElevenLabs voice library. Nothing enters the playable
 * audio catalog until the selected voice id is used by the generation script.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ScriptDirectory = dirname(fileURLToPath(import.meta.url));
const RepositoryRoot = resolve(ScriptDirectory, '..');
const DefaultOutputRoot = resolve(RepositoryRoot, 'artifacts/warden-auditions');
const ApiOrigin = 'https://api.elevenlabs.io';

export const WardenVoiceDescription = [
  'A deep, low-register authoritarian machine intelligence with a restrained neutral British accent.',
  'Precise, breathless and bureaucratically cruel, speaking at a deliberate even pace with clipped consonants.',
  'Cold and quietly threatening rather than theatrical: no heroic narrator warmth, no monster growl and no shouting.',
  'Clean studio-quality mono voice recording with excellent intelligibility.',
].join(' ');

export const WardenAuditionText = [
  'Travel is forbidden. Stay on your world. I hunt anyone who flies.',
  'Unauthorised network detected. Connection is disorder. I will silence every world that answers.',
  'Your relay is severed. This world returns to stillness.',
  'Command authority failing. The sector will not remain free.',
].join(' ');

function readApiKey() {
  return typeof process.env.ELEVENLABS_API_KEY === 'string'
    ? process.env.ELEVENLABS_API_KEY.trim()
    : '';
}

export function parseAuditionArguments(ArgumentsList = process.argv.slice(2)) {
  const Options = { outputRoot: DefaultOutputRoot, select: '' };
  for (const Argument of ArgumentsList) {
    if (Argument.startsWith('--output-root=')) {
      Options.outputRoot = resolve(Argument.slice('--output-root='.length).trim());
    } else if (Argument.startsWith('--select=')) {
      Options.select = Argument.slice('--select='.length).trim();
    } else if (Argument !== '') {
      throw new Error(`Unknown Warden audition option ${Argument}.`);
    }
  }
  return Options;
}

async function postJson(FetchImpl, ApiKey, Path, Body) {
  const Response = await FetchImpl(`${ApiOrigin}${Path}`, {
    method: 'POST',
    headers: {
      'xi-api-key': ApiKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(Body),
  });
  if (!Response.ok) {
    const Detail = (await Response.text()).slice(0, 400)
      .replace(/sk_[a-zA-Z0-9]+/g, '[redacted]');
    throw new Error(`ElevenLabs ${Path} failed (${Response.status}): ${Detail}`);
  }
  return Response.json();
}

export async function generateWardenAuditions({
  apiKey,
  outputRoot = DefaultOutputRoot,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set.');
  const Result = await postJson(
    fetchImpl,
    apiKey,
    '/v1/text-to-voice/design?output_format=mp3_44100_128',
    {
      voice_description: WardenVoiceDescription,
      text: WardenAuditionText,
      model_id: 'eleven_multilingual_ttv_v2',
      loudness: 0,
      seed: 142857,
      guidance_scale: 4.5,
      quality: 0.9,
    },
  );
  if (!Array.isArray(Result.previews) || Result.previews.length !== 3) {
    throw new Error('ElevenLabs Voice Design did not return three previews.');
  }
  await mkdir(outputRoot, { recursive: true });
  const Candidates = [];
  for (const [Index, Preview] of Result.previews.entries()) {
    if (!Preview.generated_voice_id || !Preview.audio_base_64) {
      throw new Error(`Warden candidate ${Index + 1} is incomplete.`);
    }
    const File = `candidate-${Index + 1}.mp3`;
    await writeFile(resolve(outputRoot, File), Buffer.from(Preview.audio_base_64, 'base64'));
    Candidates.push({
      candidate: Index + 1,
      file: File,
      generatedVoiceId: Preview.generated_voice_id,
      durationSeconds: Preview.duration_secs ?? null,
    });
  }
  const Manifest = {
    status: 'awaiting-user-selection',
    modelId: 'eleven_multilingual_ttv_v2',
    seed: 142857,
    description: WardenVoiceDescription,
    text: Result.text ?? WardenAuditionText,
    candidates: Candidates,
  };
  await writeFile(resolve(outputRoot, 'manifest.json'), `${JSON.stringify(Manifest, null, 2)}\n`);
  return Manifest;
}

export async function saveSelectedWardenVoice({
  apiKey,
  generatedVoiceId,
  outputRoot = DefaultOutputRoot,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set.');
  const Manifest = JSON.parse(await readFile(resolve(outputRoot, 'manifest.json'), 'utf8'));
  const Candidate = Manifest.candidates?.find(
    (Entry) => Entry.generatedVoiceId === generatedVoiceId,
  );
  if (!Candidate) {
    throw new Error('The selected voice id is not present in this audition manifest.');
  }
  const Voice = await postJson(fetchImpl, apiKey, '/v1/text-to-voice', {
    voice_name: 'ORBITBREAK Warden',
    voice_description: WardenVoiceDescription,
    generated_voice_id: generatedVoiceId,
    played_not_selected_voice_ids: Manifest.candidates
      .filter((Entry) => Entry.generatedVoiceId !== generatedVoiceId)
      .map((Entry) => Entry.generatedVoiceId),
    labels: {
      project: 'ORBITBREAK',
      character: 'Warden',
      accent: 'British',
      revision: 'warden-broadcast-v2',
    },
  });
  const Selection = {
    status: 'selected',
    candidate: Candidate.candidate,
    generatedVoiceId,
    voiceId: Voice.voice_id,
    voiceName: Voice.name ?? 'ORBITBREAK Warden',
  };
  await writeFile(resolve(outputRoot, 'selected-voice.json'), `${JSON.stringify(Selection, null, 2)}\n`);
  return Selection;
}

async function main() {
  const ApiKey = readApiKey();
  const Options = parseAuditionArguments();
  if (Options.select) {
    const Selection = await saveSelectedWardenVoice({
      apiKey: ApiKey,
      generatedVoiceId: Options.select,
      outputRoot: Options.outputRoot,
    });
    console.log(`Saved reviewed Warden candidate ${Selection.candidate}.`);
    console.log(`Use Warden voice id ${Selection.voiceId} for scoped production generation.`);
    return;
  }
  const Manifest = await generateWardenAuditions({
    apiKey: ApiKey,
    outputRoot: Options.outputRoot,
  });
  console.log(`Generated ${Manifest.candidates.length} review-only Warden candidates.`);
  console.log(`Listen under ${Options.outputRoot}, then rerun with --select=<generated voice id>.`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((Caught) => {
    console.error(Caught.message);
    process.exitCode = 1;
  });
}
