import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRunState,
  releaseRunLaunch,
  settleRunFlight,
} from '../src/run.js';

test('a run begins with its complete authored launch budget', () => {
  assert.deepEqual(createRunState(8), {
    maximumLaunches: 8,
    remainingLaunches: 8,
    launchesUsed: 0,
    flightInProgress: false,
    status: 'active',
  });
});

test('every released flight spends exactly one launch', () => {
  const InFlight = releaseRunLaunch(createRunState(8));

  assert.equal(InFlight.remainingLaunches, 7);
  assert.equal(InFlight.launchesUsed, 1);
  assert.equal(InFlight.flightInProgress, true);

  const Landed = settleRunFlight(InFlight);
  assert.equal(Landed.status, 'active');
  assert.equal(Landed.remainingLaunches, 7);
  assert.equal(Landed.flightInProgress, false);
});

test('the final launch fails only after landing or missing away from the Command World', () => {
  const LastFlight = releaseRunLaunch(createRunState(1));

  assert.equal(LastFlight.remainingLaunches, 0);
  assert.equal(LastFlight.status, 'active');
  assert.equal(settleRunFlight(LastFlight).status, 'failed');
});

test('reaching the Command World on the final launch completes the run', () => {
  const LastFlight = releaseRunLaunch(createRunState(1));
  const Completed = settleRunFlight(LastFlight, { reachedCommandWorld: true });

  assert.equal(Completed.status, 'complete');
  assert.equal(Completed.remainingLaunches, 0);
  assert.equal(Completed.launchesUsed, 1);
});

test('invalid budgets and impossible double launches fail closed', () => {
  assert.throws(() => createRunState(0), /positive integer/);
  assert.throws(() => releaseRunLaunch(releaseRunLaunch(createRunState(2))), /attached active/);
});

