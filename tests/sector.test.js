import test from 'node:test';
import assert from 'node:assert/strict';

import { BreakerReachSystemDefinition } from '../src/content.js';
import {
  getRangeVeilStrength,
  getSectorWardenRevealFlag,
  isFurtherReachLive,
  isInnerClusterLive,
} from '../src/sector.js';

const InnerCluster = BreakerReachSystemDefinition.innerClusterWorldIdentifiers;
const FurtherReach = BreakerReachSystemDefinition.furtherReachWorldIdentifiers;

test('inner cluster is live only when every neighbourhood world holds a relay', () => {
  assert.equal(isInnerClusterLive(['meadow', 'ember'], InnerCluster), false);
  assert.equal(isInnerClusterLive(['meadow', 'ember', 'grove'], InnerCluster), true);
  assert.equal(isInnerClusterLive(['meadow', 'ember', 'grove'], []), false);
});

test('further reach is live when any outer world holds a relay', () => {
  assert.equal(isFurtherReachLive(['meadow', 'ember', 'grove'], FurtherReach), false);
  assert.equal(isFurtherReachLive(['meadow', 'ember', 'grove', 'tide'], FurtherReach), true);
});

test('range veil covers Command and the further Reach until the neighbourhood is live', () => {
  assert.equal(getRangeVeilStrength('frost', false, {
    furtherReachWorldIdentifiers: FurtherReach,
    commandWorldIdentifier: 'worldheart',
  }), 1);
  assert.equal(getRangeVeilStrength('frost', true, {
    furtherReachWorldIdentifiers: FurtherReach,
    commandWorldIdentifier: 'worldheart',
  }), 0);
  assert.equal(getRangeVeilStrength('ember', false, {
    furtherReachWorldIdentifiers: FurtherReach,
    commandWorldIdentifier: 'worldheart',
  }), 0);
  assert.equal(getRangeVeilStrength('worldheart', false, {
    furtherReachWorldIdentifiers: FurtherReach,
    commandWorldIdentifier: 'worldheart',
  }), 1);
});

test('Warden reveal requires both a live neighbourhood and a further landing', () => {
  assert.equal(
    getSectorWardenRevealFlag(['meadow', 'ember', 'grove'], InnerCluster, FurtherReach),
    false,
  );
  assert.equal(
    getSectorWardenRevealFlag(
      ['meadow', 'ember', 'grove', 'tide'],
      InnerCluster,
      FurtherReach,
    ),
    true,
  );
});
