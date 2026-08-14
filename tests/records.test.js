import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareRunResults,
  createRunResult,
  getPersonalBestStorageKey,
  loadPersonalBest,
  savePersonalBest,
} from '../src/records.js';

class MemoryStorage {
  values = new Map();

  getItem(Key) {
    return this.values.get(Key) ?? null;
  }

  setItem(Key, Value) {
    this.values.set(Key, Value);
  }
}

function result(Overrides = {}) {
  return createRunResult({
    systemIdentifier: 'breaker-reach',
    contentVersion: 'breaker-reach-4',
    score: 7000,
    launchesUsed: 4,
    flightTimeMilliseconds: 3200,
    ...Overrides,
  });
}

test('personal-best ranking uses score, launches, then fixed-step flight time', () => {
  assert.ok(compareRunResults(result({ score: 7100 }), result()) > 0);
  assert.ok(compareRunResults(result({ launchesUsed: 3 }), result()) > 0);
  assert.ok(compareRunResults(result({ flightTimeMilliseconds: 3100 }), result()) > 0);
  assert.equal(compareRunResults(result(), result()), 0);
});

test('a worse run never replaces the stored personal best', () => {
  const Storage = new MemoryStorage();
  const FirstUpdate = savePersonalBest(Storage, result());
  const WorseUpdate = savePersonalBest(Storage, result({ score: 6500 }));

  assert.equal(FirstUpdate.isNewPersonalBest, true);
  assert.equal(WorseUpdate.isNewPersonalBest, false);
  assert.deepEqual(WorseUpdate.personalBest, result());
  assert.deepEqual(
    loadPersonalBest(Storage, 'breaker-reach', 'breaker-reach-4'),
    result(),
  );
});

test('personal bests are isolated by system content version and ignore corrupt data', () => {
  const Storage = new MemoryStorage();
  savePersonalBest(Storage, result());
  assert.equal(loadPersonalBest(Storage, 'breaker-reach', 'breaker-reach-1'), null);

  const CorruptKey = getPersonalBestStorageKey('broken-belt', 'migration-1');
  Storage.setItem(CorruptKey, '{not json');
  assert.equal(loadPersonalBest(Storage, 'broken-belt', 'migration-1'), null);
});
