export const ReplaySchemaVersion = 2;
export const PhysicsModelVersion = 'orbitbreak-fixed-step-v1';
const LegacyReplaySchemaVersion = 1;

function assertIdentifier(Value, Label) {
  if (typeof Value !== 'string' || Value.length < 1 || Value.length > 96) {
    throw new Error(`${Label} must be a non-empty identifier.`);
  }
}

function assertFiniteVelocity(Value) {
  if (!Number.isFinite(Value) || Math.abs(Value) > 100) {
    throw new Error('Replay launch velocity is invalid.');
  }
}

function assertFiniteOrigin(Value) {
  if (!Number.isFinite(Value) || Math.abs(Value) > 1000) {
    throw new Error('Replay launch origin is invalid.');
  }
}

export function createReplayRecorder({
  systemIdentifier,
  contentVersion,
  fixedStepHz,
  physicsVersion = PhysicsModelVersion,
  schemaVersion = ReplaySchemaVersion,
}) {
  assertIdentifier(systemIdentifier, 'Replay system');
  assertIdentifier(contentVersion, 'Replay content version');
  assertIdentifier(physicsVersion, 'Replay physics version');
  if (!Number.isInteger(fixedStepHz) || fixedStepHz < 1 || fixedStepHz > 1000) {
    throw new Error('Replay fixed-step frequency is invalid.');
  }
  if (schemaVersion !== LegacyReplaySchemaVersion && schemaVersion !== ReplaySchemaVersion) {
    throw new Error('Replay schema is unsupported.');
  }
  return {
    schemaVersion,
    systemIdentifier,
    contentVersion,
    physicsVersion,
    fixedStepHz,
    launches: [],
    outcome: 'recording',
  };
}

/** Records only authoritative launch input and timing, never a client-claimed score. */
export function recordReplayLaunch(Replay, {
  stepIndex,
  originIdentifier,
  originX,
  originY,
  velocityX,
  velocityY,
}) {
  if (Replay.outcome !== 'recording') {
    throw new Error('A finished replay cannot accept another launch.');
  }
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > 10000000) {
    throw new Error('Replay launch step is invalid.');
  }
  const PreviousLaunch = Replay.launches[Replay.launches.length - 1];
  if (PreviousLaunch && stepIndex <= PreviousLaunch.stepIndex) {
    throw new Error('Replay launch steps must increase.');
  }
  if (Replay.launches.length >= 64) {
    throw new Error('Replay exceeds the launch safety limit.');
  }
  assertIdentifier(originIdentifier, 'Replay origin');
  assertFiniteVelocity(velocityX);
  assertFiniteVelocity(velocityY);
  if (Replay.schemaVersion >= 2) {
    assertFiniteOrigin(originX);
    assertFiniteOrigin(originY);
  }
  const Launch = Replay.schemaVersion >= 2
    ? {
      stepIndex,
      originIdentifier,
      originX,
      originY,
      velocityX,
      velocityY,
      burnStepIndex: null,
    }
    : { stepIndex, originIdentifier, velocityX, velocityY };
  return {
    ...Replay,
    launches: [
      ...Replay.launches,
      Launch,
    ],
  };
}

/** Records the sole fixed-step Breaker Burn for the current flight. */
export function recordReplayBurn(Replay, { stepIndex }) {
  if (Replay.outcome !== 'recording') {
    throw new Error('A finished replay cannot accept a Burn.');
  }
  if (Replay.schemaVersion < 2) {
    throw new Error('Legacy replay schema cannot record a Burn.');
  }
  const LaunchIndex = Replay.launches.length - 1;
  const Launch = Replay.launches[LaunchIndex];
  if (!Launch) {
    throw new Error('A Burn requires an active launch.');
  }
  if (!Number.isInteger(stepIndex) || stepIndex <= Launch.stepIndex || stepIndex > 10000000) {
    throw new Error('Replay Burn step is invalid.');
  }
  if (Launch.burnStepIndex !== null) {
    throw new Error('A flight can record only one Burn.');
  }
  return {
    ...Replay,
    launches: Replay.launches.map((ReplayLaunch, ReplayLaunchIndex) => (
      ReplayLaunchIndex === LaunchIndex
        ? { ...ReplayLaunch, burnStepIndex: stepIndex }
        : ReplayLaunch
    )),
  };
}

export function finishReplay(Replay, Outcome) {
  if (Replay.outcome !== 'recording') {
    return Replay;
  }
  if (Outcome !== 'complete' && Outcome !== 'failed') {
    throw new Error('Replay outcome is invalid.');
  }
  return { ...Replay, outcome: Outcome };
}

/** Compact wire format kept stable for storage, sharing and later server validation. */
export function serializeReplay(Replay) {
  if (Replay.outcome === 'recording') {
    throw new Error('An unfinished replay cannot be serialized.');
  }
  return JSON.stringify({
    v: Replay.schemaVersion,
    s: Replay.systemIdentifier,
    c: Replay.contentVersion,
    p: Replay.physicsVersion,
    h: Replay.fixedStepHz,
    o: Replay.outcome === 'complete' ? 1 : 0,
    l: Replay.launches.map((Launch) => Replay.schemaVersion >= 2
      ? [
        Launch.stepIndex,
        Launch.originIdentifier,
        Launch.originX,
        Launch.originY,
        Launch.velocityX,
        Launch.velocityY,
        Launch.burnStepIndex,
      ]
      : [
        Launch.stepIndex,
        Launch.originIdentifier,
        Launch.velocityX,
        Launch.velocityY,
      ]),
  });
}

export function parseReplay(SerializedReplay) {
  if (typeof SerializedReplay !== 'string' || SerializedReplay.length > 8192) {
    throw new Error('Replay payload is invalid.');
  }
  let WireReplay;
  try {
    WireReplay = JSON.parse(SerializedReplay);
  } catch {
    throw new Error('Replay payload is not valid JSON.');
  }
  if (
    !WireReplay
    || (WireReplay.v !== LegacyReplaySchemaVersion && WireReplay.v !== ReplaySchemaVersion)
    || (WireReplay.o !== 0 && WireReplay.o !== 1)
    || !Array.isArray(WireReplay.l)
  ) {
    throw new Error('Replay schema is unsupported.');
  }
  let Replay = createReplayRecorder({
    systemIdentifier: WireReplay.s,
    contentVersion: WireReplay.c,
    physicsVersion: WireReplay.p,
    fixedStepHz: WireReplay.h,
    schemaVersion: WireReplay.v,
  });
  for (const Launch of WireReplay.l) {
    const ExpectedLength = WireReplay.v >= 2 ? 7 : 4;
    if (!Array.isArray(Launch) || Launch.length !== ExpectedLength) {
      throw new Error('Replay launch payload is invalid.');
    }
    Replay = recordReplayLaunch(Replay, {
      stepIndex: Launch[0],
      originIdentifier: Launch[1],
      originX: WireReplay.v >= 2 ? Launch[2] : undefined,
      originY: WireReplay.v >= 2 ? Launch[3] : undefined,
      velocityX: WireReplay.v >= 2 ? Launch[4] : Launch[2],
      velocityY: WireReplay.v >= 2 ? Launch[5] : Launch[3],
    });
    if (WireReplay.v >= 2 && Launch[6] !== null) {
      Replay = recordReplayBurn(Replay, { stepIndex: Launch[6] });
    }
  }
  return finishReplay(Replay, WireReplay.o === 1 ? 'complete' : 'failed');
}

export function getReplayStorageKey(SystemIdentifier, ContentVersion) {
  assertIdentifier(SystemIdentifier, 'Replay system');
  assertIdentifier(ContentVersion, 'Replay content version');
  return `orbitbreak.last-replay.${SystemIdentifier}.${ContentVersion}`;
}

export function getPersonalBestGhostStorageKey(SystemIdentifier, ContentVersion) {
  assertIdentifier(SystemIdentifier, 'Ghost system');
  assertIdentifier(ContentVersion, 'Ghost content version');
  return `orbitbreak.best-ghost.${SystemIdentifier}.${ContentVersion}`;
}
