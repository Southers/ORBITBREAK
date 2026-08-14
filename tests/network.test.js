import assert from 'node:assert/strict';
import test from 'node:test';

import {
  connectRelayWorlds,
  createRelayNetworkState,
  getRelayLinkIdentifier,
  listRelayLinks,
} from '../src/network.js';

test('a resolved traversal activates its destination and creates one canonical relay link', () => {
  const Network = createRelayNetworkState('haven');
  const Connection = connectRelayWorlds(Network, 'haven', 'ember');

  assert.equal(Connection.created, true);
  assert.equal(Connection.destinationActivated, true);
  assert.equal(Connection.link.id, 'ember::haven');
  assert.deepEqual([...Network.activeWorldIdentifiers].sort(), ['ember', 'haven']);
  assert.deepEqual(listRelayLinks(Network), [Connection.link]);
});

test('reverse and repeated traversal preserve one permanent non-farmable link', () => {
  const Network = createRelayNetworkState('haven');
  const FirstConnection = connectRelayWorlds(Network, 'haven', 'ember');
  const ReturnConnection = connectRelayWorlds(Network, 'ember', 'haven');

  assert.equal(ReturnConnection.created, false);
  assert.equal(ReturnConnection.destinationActivated, false);
  assert.equal(ReturnConnection.link, FirstConnection.link);
  assert.equal(Network.links.size, 1);
  assert.equal(getRelayLinkIdentifier('haven', 'ember'), 'ember::haven');
  assert.throws(() => getRelayLinkIdentifier('haven', 'haven'), /distinct worlds/);
});
