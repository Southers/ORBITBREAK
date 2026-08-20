import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditReleaseReadiness,
  computeCspHash,
  normalizeRepositoryText,
} from '../server/release-audit.js';

test('repository text normalization makes integrity checks platform-independent', () => {
  assert.equal(normalizeRepositoryText('one\r\ntwo\rthree\n'), 'one\ntwo\nthree\n');
  assert.equal(computeCspHash('one\r\ntwo\r\n'), computeCspHash('one\ntwo\n'));
});

test('release audit proves campaign, metadata, credits and local asset integrity', () => {
  const Audit = auditReleaseReadiness();

  assert.deepEqual(Audit.failures, []);
  assert.equal(Audit.build, '20260819-ob142');
  assert.equal(Audit.campaignSystems, 3);
  assert.equal(Audit.license, 'MIT');
  assert.ok(Audit.checkedLocalAssets >= 4);
});
