export function createReplayPlaybackState(Replay) {
  if (!Replay || Replay.outcome !== 'complete' || Replay.launches.length < 1) {
    throw new Error('Only a completed replay can be watched.');
  }
  return { replay: Replay, nextLaunchIndex: 0, status: 'playing' };
}

/** Returns the next due launch while preserving authored input order and origin. */
export function consumeDueReplayLaunch(PlaybackState, CurrentStepIndex, CurrentNodeIdentifier) {
  if (PlaybackState.status !== 'playing') {
    return { playbackState: PlaybackState, launch: null };
  }
  const Launch = PlaybackState.replay.launches[PlaybackState.nextLaunchIndex];
  if (!Launch || CurrentStepIndex < Launch.stepIndex) {
    return { playbackState: PlaybackState, launch: null };
  }
  if (Launch.originIdentifier !== CurrentNodeIdentifier) {
    throw new Error('Replay playback reached an impossible launch origin.');
  }
  const NextLaunchIndex = PlaybackState.nextLaunchIndex + 1;
  return {
    playbackState: {
      ...PlaybackState,
      nextLaunchIndex: NextLaunchIndex,
      status: NextLaunchIndex === PlaybackState.replay.launches.length
        ? 'settling'
        : 'playing',
    },
    launch: Launch,
  };
}
