import assert from 'node:assert/strict';
import test from 'node:test';

import { getReplayGhostWaypoints } from '../src/ghost.js';

test('a completed schema-v2 replay exposes route waypoints without launch velocity', () => {
  const Waypoints = getReplayGhostWaypoints({
    schemaVersion: 2,
    outcome: 'complete',
    launches: [
      { originIdentifier: 'haven', originX: -2, originY: 1, velocityX: 18, velocityY: 0 },
      { originIdentifier: 'ember', originX: 4, originY: 2, velocityX: 12, velocityY: 9 },
    ],
  });
  assert.deepEqual(Waypoints, [
    { originIdentifier: 'haven', x: -2, y: 1, z: 0 },
    { originIdentifier: 'ember', x: 4, y: 2, z: 0 },
  ]);
  assert.equal('velocityX' in Waypoints[0], false);
});

test('legacy, unfinished and duplicate route points do not produce misleading ghosts', () => {
  assert.deepEqual(getReplayGhostWaypoints({ schemaVersion: 1, outcome: 'complete' }), []);
  assert.deepEqual(getReplayGhostWaypoints({ schemaVersion: 2, outcome: 'recording' }), []);
  assert.deepEqual(getReplayGhostWaypoints({
    schemaVersion: 2,
    outcome: 'complete',
    launches: [
      { originIdentifier: 'haven', originX: 1, originY: 2 },
      { originIdentifier: 'haven', originX: 1.001, originY: 2.001 },
    ],
  }), [{ originIdentifier: 'haven', x: 1, y: 2, z: 0 }]);
});
