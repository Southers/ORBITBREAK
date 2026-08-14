/**
 * Pure run-pressure state for ORBITBREAK.
 *
 * Releasing a valid shot spends a launch immediately. The last shot is allowed to finish:
 * settlement decides whether it reached the Command World or exhausted the run elsewhere.
 */

export function createRunState(MaximumLaunches) {
  if (!Number.isInteger(MaximumLaunches) || MaximumLaunches < 1) {
    throw new Error('Run launch budget must be a positive integer.');
  }

  return {
    maximumLaunches: MaximumLaunches,
    remainingLaunches: MaximumLaunches,
    launchesUsed: 0,
    flightInProgress: false,
    status: 'active',
  };
}

export function releaseRunLaunch(RunState) {
  if (RunState.status !== 'active' || RunState.flightInProgress) {
    throw new Error('Only an attached active Runner can launch.');
  }
  if (RunState.remainingLaunches < 1) {
    throw new Error('No launches remain.');
  }

  return {
    ...RunState,
    remainingLaunches: RunState.remainingLaunches - 1,
    launchesUsed: RunState.launchesUsed + 1,
    flightInProgress: true,
  };
}

export function settleRunFlight(RunState, { reachedCommandWorld = false } = {}) {
  if (RunState.status !== 'active' || !RunState.flightInProgress) {
    throw new Error('Only an active flight can be settled.');
  }

  return {
    ...RunState,
    flightInProgress: false,
    status: reachedCommandWorld
      ? 'complete'
      : RunState.remainingLaunches === 0
        ? 'failed'
        : 'active',
  };
}

