import test from 'node:test';
import assert from 'node:assert/strict';

import {
  consumeDueReplayLaunch,
  consumeDueReplayBurn,
  createReplayPlaybackState,
} from '../src/replay-playback.js';

const Replay = {
  outcome: 'complete',
  launches: [
    { stepIndex: 10, originIdentifier: 'meadow', velocityX: 8, velocityY: 0, burnStepIndex: 18 },
    { stepIndex: 30, originIdentifier: 'ember', velocityX: 9, velocityY: 1, burnStepIndex: null },
  ],
};

test('playback waits for fixed-step timing then consumes launches in order', () => {
  let Playback = createReplayPlaybackState(Replay);
  let Update = consumeDueReplayLaunch(Playback, 9, 'meadow');
  assert.equal(Update.launch, null);

  Update = consumeDueReplayLaunch(Update.playbackState, 10, 'meadow');
  assert.equal(Update.launch, Replay.launches[0]);
  assert.equal(Update.playbackState.nextLaunchIndex, 1);

  let BurnUpdate = consumeDueReplayBurn(Update.playbackState, 17);
  assert.equal(BurnUpdate.burn, false);
  BurnUpdate = consumeDueReplayBurn(BurnUpdate.playbackState, 18);
  assert.equal(BurnUpdate.burn, true);
  assert.equal(consumeDueReplayBurn(BurnUpdate.playbackState, 19).burn, false);

  Update = consumeDueReplayLaunch(BurnUpdate.playbackState, 31, 'ember');
  assert.equal(Update.launch, Replay.launches[1]);
  assert.equal(Update.playbackState.status, 'settling');
});

test('playback rejects an origin that live simulation did not reach', () => {
  const Playback = createReplayPlaybackState(Replay);
  assert.throws(
    () => consumeDueReplayLaunch(Playback, 10, 'frost'),
    /impossible launch origin/,
  );
});

test('playback requires a completed non-empty replay', () => {
  assert.throws(
    () => createReplayPlaybackState({ outcome: 'recording', launches: [] }),
    /completed replay/,
  );
});
