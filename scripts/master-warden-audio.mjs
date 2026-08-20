#!/usr/bin/env node
/** Masters clean Warden TTS into restrained robotic radio broadcasts. */

import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listGenerateJobs } from '../src/audio-catalog.js';

const ScriptDirectory = dirname(fileURLToPath(import.meta.url));
const RepositoryRoot = resolve(ScriptDirectory, '..');
const DefaultAudioRoot = resolve(RepositoryRoot, 'assets/audio');
export const WardenMasterRevision = 'warden-radio-v1';

export function parseMasterArguments(ArgumentsList = process.argv.slice(2)) {
  const Options = { audioRoot: DefaultAudioRoot, dryRun: false };
  for (const Argument of ArgumentsList) {
    if (Argument.startsWith('--audio-root=')) {
      Options.audioRoot = resolve(Argument.slice('--audio-root='.length).trim());
    } else if (Argument === '--dry-run') {
      Options.dryRun = true;
    } else if (Argument !== '') {
      throw new Error(`Unknown Warden mastering option ${Argument}.`);
    }
  }
  return Options;
}

function runTool(Command, ArgumentsList) {
  const Result = spawnSync(Command, ArgumentsList, { encoding: 'utf8', windowsHide: true });
  if (Result.error) throw Result.error;
  if (Result.status !== 0) {
    throw new Error(`${Command} failed: ${(Result.stderr || Result.stdout).trim()}`);
  }
  return Result.stdout.trim();
}

export function buildWardenMasterFilter(DurationSeconds) {
  const EndSquelchStart = Math.max(0.12, DurationSeconds - 0.14).toFixed(3);
  const NoiseVolume = `if(lt(t\\,0.10)\\,0.30\\,if(gt(t\\,${EndSquelchStart})\\,0.24\\,0.025))`;
  return [
    '[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=mono,'
      + 'highpass=f=220,lowpass=f=4200,'
      + 'acompressor=threshold=0.18:ratio=3:attack=5:release=90,'
      + 'asoftclip=type=tanh:threshold=0.92,asplit=2[main][robot]',
    '[robot]asetrate=41013,aresample=44100,atempo=1.07527,volume=0.11,adelay=32[robotbed]',
    `anoisesrc=color=pink:amplitude=0.012:r=44100:d=${DurationSeconds.toFixed(3)},`
      + `highpass=f=650,lowpass=f=5000,volume='${NoiseVolume}':eval=frame[radio]`,
    '[main][robotbed][radio]amix=inputs=3:duration=first:normalize=0,'
      + 'alimiter=limit=0.95,loudnorm=I=-16:TP=-1.5:LRA=7[out]',
  ].join(';');
}

async function fileIsUsable(Path) {
  try {
    const Info = await stat(Path);
    return Info.isFile() && Info.size > 64;
  } catch {
    return false;
  }
}

export async function masterWardenClip({ input, output } = {}) {
  if (!await fileIsUsable(input)) {
    throw new Error(`Clean Warden source is missing: ${input}`);
  }
  const Duration = Number(runTool('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    input,
  ]));
  if (!Number.isFinite(Duration) || Duration <= 0) {
    throw new Error(`Could not measure clean Warden source: ${input}`);
  }
  const TemporaryOutput = `${output}.tmp.mp3`;
  await mkdir(dirname(output), { recursive: true });
  await rm(TemporaryOutput, { force: true });
  runTool('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-filter_complex', buildWardenMasterFilter(Duration),
    '-map', '[out]',
    '-ar', '44100', '-ac', '1', '-b:a', '128k',
    TemporaryOutput,
  ]);
  if (!await fileIsUsable(TemporaryOutput)) {
    throw new Error(`Warden master was empty: ${TemporaryOutput}`);
  }
  await rename(TemporaryOutput, output);
}

export async function masterWardenAudio({
  audioRoot = DefaultAudioRoot,
  dryRun = false,
  log = console.log,
} = {}) {
  const Files = [...new Set(
    listGenerateJobs().voices
      .filter((Clip) => Clip.voice === 'warden')
      .map((Clip) => basename(Clip.file)),
  )];
  if (dryRun) {
    Files.forEach((File) => log(`would master voice-clean/${File} -> voice/${File}`));
    return { mastered: 0, planned: Files.length };
  }
  runTool('ffmpeg', ['-version']);
  runTool('ffprobe', ['-version']);
  let Mastered = 0;
  for (const File of Files) {
    const Input = resolve(audioRoot, 'voice-clean', File);
    const Output = resolve(audioRoot, 'voice', File);
    await masterWardenClip({ input: Input, output: Output });
    Mastered += 1;
    log(`mastered voice/${File}`);
  }
  return { mastered: Mastered, planned: Files.length };
}

async function main() {
  const Options = parseMasterArguments();
  const Result = await masterWardenAudio(Options);
  console.log(
    Options.dryRun
      ? `Warden mastering dry run: ${Result.planned} files.`
      : `Warden mastering finished: ${Result.mastered} files (${WardenMasterRevision}).`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main().catch((Caught) => {
    console.error(Caught.message);
    process.exitCode = 1;
  });
}
