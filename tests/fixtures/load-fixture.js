import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FixtureDirectory = dirname(fileURLToPath(import.meta.url));

/** Loads a JSON replay or result fixture from tests/fixtures. */
export function loadReplayFixture(FileName) {
  return JSON.parse(readFileSync(resolve(FixtureDirectory, FileName), 'utf8'));
}

/** Returns the compact serialized replay payload used by the validator and leaderboard. */
export function loadSerializedReplayFixture(FileName) {
  return JSON.stringify(loadReplayFixture(FileName));
}
