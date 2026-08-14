export const WardenPursuitEvents = Object.freeze({
  dormant: 'dormant',
  revealed: 'revealed',
  advanced: 'advanced',
  retreated: 'retreated',
  arrived: 'arrived',
  suppressed: 'suppressed',
});

export function createWardenPursuitState({ startingDistance = 4 } = {}) {
  if (!Number.isInteger(startingDistance) || startingDistance < 1) {
    throw new Error('Warden starting distance must be a positive integer.');
  }
  return {
    status: 'hidden',
    distance: startingDistance,
    maximumDistance: startingDistance,
    shieldLayers: 2,
    targetWorldIdentifier: null,
    resolvedFlightCount: 0,
    lastEvent: WardenPursuitEvents.dormant,
  };
}

/** Advances pursuit exactly once per resolved flight; scouting time never enters this contract. */
export function resolveWardenPursuit(State, {
  activeRelayCount,
  targetWorldIdentifier = State.targetWorldIdentifier,
  firstCircuitClosed = false,
}) {
  if (!Number.isInteger(activeRelayCount) || activeRelayCount < 1) {
    throw new Error('Warden pursuit requires an active relay count.');
  }
  const NextFlightCount = State.resolvedFlightCount + 1;
  if (State.status === 'hidden') {
    if (activeRelayCount < 3) {
      return { ...State, resolvedFlightCount: NextFlightCount };
    }
    return {
      ...State,
      status: 'pursuing',
      targetWorldIdentifier,
      resolvedFlightCount: NextFlightCount,
      lastEvent: WardenPursuitEvents.revealed,
    };
  }
  if (firstCircuitClosed) {
    return {
      ...State,
      distance: Math.min(State.maximumDistance, State.distance + 1),
      shieldLayers: Math.max(0, State.shieldLayers - 1),
      targetWorldIdentifier,
      resolvedFlightCount: NextFlightCount,
      lastEvent: WardenPursuitEvents.retreated,
    };
  }
  const NextDistance = Math.max(0, State.distance - 1);
  return {
    ...State,
    distance: NextDistance,
    targetWorldIdentifier,
    resolvedFlightCount: NextFlightCount,
    lastEvent: NextDistance === 0
      ? WardenPursuitEvents.arrived
      : WardenPursuitEvents.advanced,
  };
}

export function chooseWardenTarget(WorldDefinitions, VulnerableWorldIdentifiers) {
  const VulnerableIdentifiers = new Set(VulnerableWorldIdentifiers);
  return WorldDefinitions
    .filter((World) => VulnerableIdentifiers.has(World.id))
    .sort((First, Second) => (
      Second.position.x - First.position.x
      || First.id.localeCompare(Second.id)
    ))[0]?.id ?? null;
}

export function resetWardenAfterSuppression(State, NextTargetWorldIdentifier) {
  if (State.lastEvent !== WardenPursuitEvents.arrived) {
    throw new Error('Warden suppression reset requires an arrival.');
  }
  return {
    ...State,
    distance: State.maximumDistance,
    targetWorldIdentifier: NextTargetWorldIdentifier,
    lastEvent: WardenPursuitEvents.suppressed,
  };
}

export function shouldWardenCatchRunner(
  State,
  RunnerWorldIdentifier,
  ProtectedWorldIdentifiers = [],
) {
  return State.lastEvent === WardenPursuitEvents.arrived
    && State.targetWorldIdentifier === RunnerWorldIdentifier
    && !new Set(ProtectedWorldIdentifiers).has(RunnerWorldIdentifier);
}
