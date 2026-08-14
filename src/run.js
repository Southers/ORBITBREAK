/**
 * Pure run-pressure state for ORBITBREAK.
 *
 * Releasing a valid shot spends remaining bonus fuel first. Exhausting that reserve never ends
 * the run; only the deterministic Warden pressure can do that.
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
  return {
    ...RunState,
    remainingLaunches: Math.max(0, RunState.remainingLaunches - 1),
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
    status: reachedCommandWorld ? 'complete' : 'active',
  };
}

export function failRunToWarden(RunState) {
  if (RunState.status !== 'active' || RunState.flightInProgress) {
    throw new Error('Only a settled active run can be caught by the Warden.');
  }
  return { ...RunState, status: 'failed' };
}

