export const ReplaySchemaVersion = 1;
export const PhysicsModelVersion = 'orbitbreak-fixed-step-v1';

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

export function createReplayRecorder({
  systemIdentifier,
  contentVersion,
  fixedStepHz,
  physicsVersion = PhysicsModelVersion,
}) {
  assertIdentifier(systemIdentifier, 'Replay system');
  assertIdentifier(contentVersion, 'Replay content version');
  assertIdentifier(physicsVersion, 'Replay physics version');
  if (!Number.isInteger(fixedStepHz) || fixedStepHz < 1 || fixedStepHz > 1000) {
    throw new Error('Replay fixed-step frequency is invalid.');
  }
  return {
    schemaVersion: ReplaySchemaVersion,
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
  return {
    ...Replay,
    launches: [
      ...Replay.launches,
      { stepIndex, originIdentifier, velocityX, velocityY },
    ],
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
    l: Replay.launches.map((Launch) => [
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
    || WireReplay.v !== ReplaySchemaVersion
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
  });
  for (const Launch of WireReplay.l) {
    if (!Array.isArray(Launch) || Launch.length !== 4) {
      throw new Error('Replay launch payload is invalid.');
    }
    Replay = recordReplayLaunch(Replay, {
      stepIndex: Launch[0],
      originIdentifier: Launch[1],
      velocityX: Launch[2],
      velocityY: Launch[3],
    });
  }
  return finishReplay(Replay, WireReplay.o === 1 ? 'complete' : 'failed');
}

export function getReplayStorageKey(SystemIdentifier, ContentVersion) {
  assertIdentifier(SystemIdentifier, 'Replay system');
  assertIdentifier(ContentVersion, 'Replay content version');
  return `orbitbreak.last-replay.${SystemIdentifier}.${ContentVersion}`;
}
