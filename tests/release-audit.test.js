import assert from 'node:assert/strict';
import test from 'node:test';

import { auditReleaseReadiness } from '../server/release-audit.js';

test('release audit proves campaign, metadata, credits and local asset integrity', () => {
  const Audit = auditReleaseReadiness();

  assert.deepEqual(Audit.failures, []);
  assert.equal(Audit.build, '20260819-ob131');
  assert.equal(Audit.campaignSystems, 3);
  assert.ok(Audit.checkedLocalAssets >= 4);
});
