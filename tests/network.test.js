import assert from 'node:assert/strict';
import test from 'node:test';

import {
  connectRelayWorlds,
  countLiveRelayWorlds,
  createRelayNetworkState,
  findCircuitBeaconLink,
  getRelayDegree,
  getRelayLinkIdentifier,
  listRelayLinks,
  listLiveRelayLinks,
  listLiveRelayCircuits,
  listProtectedRelayWorlds,
  listVulnerableRelayWorlds,
  suppressRelayWorld,
  wouldCloseRelayCircuit,
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

test('only degree-zero and degree-one active relays are vulnerable frontier worlds', () => {
  const Network = createRelayNetworkState('haven');
  connectRelayWorlds(Network, 'haven', 'ember');
  connectRelayWorlds(Network, 'ember', 'grove');

  assert.equal(getRelayDegree(Network, 'ember'), 2);
  assert.deepEqual(listVulnerableRelayWorlds(Network).sort(), ['grove', 'haven']);
});

test('suppression stops live links and recapture restores the same non-farmable route', () => {
  const Network = createRelayNetworkState('haven');
  const Connection = connectRelayWorlds(Network, 'haven', 'ember');
  assert.equal(suppressRelayWorld(Network, 'ember'), true);
  assert.equal(countLiveRelayWorlds(Network), 1);
  assert.deepEqual(listLiveRelayLinks(Network), []);

  const Recapture = connectRelayWorlds(Network, 'haven', 'ember');
  assert.equal(Recapture.created, false);
  assert.equal(Recapture.destinationReactivated, true);
  assert.equal(Recapture.link, Connection.link);
  assert.equal(Network.links.size, 1);
  assert.equal(listLiveRelayLinks(Network).length, 1);
});

test('a unique circuit protects its worlds once and repairs without closing again', () => {
  const Network = createRelayNetworkState('haven');
  connectRelayWorlds(Network, 'haven', 'ember');
  connectRelayWorlds(Network, 'ember', 'grove');
  assert.equal(wouldCloseRelayCircuit(Network, 'grove', 'haven'), true);
  const Closure = connectRelayWorlds(Network, 'grove', 'haven');

  assert.equal(Closure.circuitClosed, true);
  assert.equal(wouldCloseRelayCircuit(Network, 'grove', 'haven'), false);
  assert.deepEqual(Closure.circuit.worldIdentifiers, ['ember', 'grove', 'haven']);
  assert.equal(listLiveRelayCircuits(Network).length, 1);
  assert.deepEqual(listProtectedRelayWorlds(Network), ['ember', 'grove', 'haven']);
  assert.deepEqual(listVulnerableRelayWorlds(Network), []);

  suppressRelayWorld(Network, 'grove');
  assert.equal(listLiveRelayCircuits(Network).length, 0);
  const Repair = connectRelayWorlds(Network, 'ember', 'grove');
  assert.equal(Repair.destinationReactivated, true);
  assert.equal(Repair.circuitClosed, false);
  assert.equal(listLiveRelayCircuits(Network).length, 1);
});

test('the circuit beacon names the next missing closing edge after the first loop', () => {
  const Network = createRelayNetworkState('haven');
  connectRelayWorlds(Network, 'haven', 'ember');
  connectRelayWorlds(Network, 'ember', 'grove');
  assert.equal(findCircuitBeaconLink(Network, 'grove'), null);
  connectRelayWorlds(Network, 'grove', 'haven');
  connectRelayWorlds(Network, 'haven', 'frost');
  const Beacon = findCircuitBeaconLink(Network, 'frost');
  assert.equal(Beacon.id, 'ember::frost');
  assert.equal(Beacon.originWorldIdentifier, 'frost');
  assert.equal(Beacon.destinationWorldIdentifier, 'ember');
});
