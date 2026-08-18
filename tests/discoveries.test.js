import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectDiscovery,
  findNearbyDiscovery,
  formatDiscoveryToast,
  formatWorldDisplayName,
  getAngularDistanceRadians,
  getDiscoveryCollectKey,
  getWorldDiscoveryProgress,
  listWorldDiscoveries,
  resetLiveDiscoveryState,
  sampleLiveDiscoveries,
} from '../src/discoveries.js';
import { DiscoveryScoreValue } from '../src/sim-constants.js';

test('every inhabited Reach world authors a small discovery set', () => {
  for (const [WorldId, MinimumCount] of [
    ['meadow', 4],
    ['ember', 4],
    ['grove', 4],
    ['frost', 4],
    ['tide', 4],
    ['bastion', 4],
  ]) {
    const Discoveries = listWorldDiscoveries(WorldId);
    assert.equal(Discoveries.length >= MinimumCount, true, WorldId);
    assert.equal(new Set(Discoveries.map((Entry) => Entry.id)).size, Discoveries.length);
  }
  assert.deepEqual(listWorldDiscoveries('ledge'), []);
  assert.deepEqual(listWorldDiscoveries('cinder'), []);
  assert.deepEqual(listWorldDiscoveries('glasswing'), []);
});

test('walking near a crust landmark banks once with a quiet toast', () => {
  resetLiveDiscoveryState();
  const GardenRelay = listWorldDiscoveries('meadow')[0];
  const Direction = {
    x: Math.cos(GardenRelay.latitude) * Math.cos(GardenRelay.longitude),
    y: Math.cos(GardenRelay.latitude) * Math.sin(GardenRelay.longitude),
    z: Math.sin(GardenRelay.latitude),
  };
  const First = sampleLiveDiscoveries({
    gamePhase: 'attached',
    worldId: 'meadow',
    worldLabel: 'HAVEN',
    worldX: 0,
    worldY: 0,
    worldZ: 0,
    runnerX: Direction.x * 3.35,
    runnerY: Direction.y * 3.35,
    runnerZ: Direction.z * 3.35,
  });
  assert.equal(First.name, 'garden relay');
  assert.equal(First.points, DiscoveryScoreValue);
  assert.equal(First.toast, 'Haven 1/4 · garden relay');
  assert.equal(First.foundCount, 1);
  const Repeat = sampleLiveDiscoveries({
    gamePhase: 'attached',
    worldId: 'meadow',
    worldLabel: 'HAVEN',
    worldX: 0,
    worldY: 0,
    worldZ: 0,
    runnerX: Direction.x * 3.35,
    runnerY: Direction.y * 3.35,
    runnerZ: Direction.z * 3.35,
  });
  assert.equal(Repeat, null);
  assert.deepEqual(getWorldDiscoveryProgress('meadow'), { foundCount: 1, totalCount: 4 });
});

test('a far-face landmark is not collected from the landing pole', () => {
  const Collected = new Set();
  const Nearby = findNearbyDiscovery({
    worldId: 'meadow',
    worldX: 0,
    worldY: 0,
    worldZ: 0,
    runnerX: 3.35,
    runnerY: 0,
    runnerZ: 0,
    collectedIds: Collected,
  });
  const FarCottage = listWorldDiscoveries('meadow').find((Entry) => Entry.id === 'far-cottage');
  const FarDirection = {
    x: Math.cos(FarCottage.latitude) * Math.cos(FarCottage.longitude),
    y: Math.cos(FarCottage.latitude) * Math.sin(FarCottage.longitude),
    z: Math.sin(FarCottage.latitude),
  };
  const FarDistance = getAngularDistanceRadians(
    1,
    0,
    0,
    FarDirection.x,
    FarDirection.y,
    FarDirection.z,
  );
  assert.equal(FarDistance > 1, true);
  assert.equal(Nearby?.id === 'far-cottage', false);
});

test('discovery toasts stay quiet and use the live world name', () => {
  assert.equal(formatWorldDisplayName('HAVEN'), 'Haven');
  assert.equal(formatDiscoveryToast({
    worldLabel: 'EMBER',
    foundCount: 2,
    totalCount: 4,
    name: 'caldera forge',
  }), 'Ember 2/4 · caldera forge');
  const State = { collectedIds: new Set(), pendingToast: null, pendingBank: [] };
  const Event = collectDiscovery(State, {
    worldId: 'ember',
    worldLabel: 'EMBER',
    discovery: {
      ...listWorldDiscoveries('ember')[0],
      collectKey: getDiscoveryCollectKey('ember', 'caldera-forge'),
    },
  });
  assert.equal(Event.toast, 'Ember 1/4 · caldera forge');
  assert.equal(collectDiscovery(State, {
    worldId: 'ember',
    worldLabel: 'EMBER',
    discovery: Event,
  }), null);
});
