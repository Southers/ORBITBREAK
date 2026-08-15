function assertWorldIdentifier(Value) {
  if (typeof Value !== 'string' || Value.length < 1 || Value.length > 96) {
    throw new Error('Relay world identifier is invalid.');
  }
}

export function getRelayLinkIdentifier(FirstWorldIdentifier, SecondWorldIdentifier) {
  assertWorldIdentifier(FirstWorldIdentifier);
  assertWorldIdentifier(SecondWorldIdentifier);
  if (FirstWorldIdentifier === SecondWorldIdentifier) {
    throw new Error('A relay link requires two distinct worlds.');
  }
  return [FirstWorldIdentifier, SecondWorldIdentifier].sort().join('::');
}

export function createRelayNetworkState(StartingWorldIdentifier) {
  assertWorldIdentifier(StartingWorldIdentifier);
  return {
    activeWorldIdentifiers: new Set([StartingWorldIdentifier]),
    suppressedWorldIdentifiers: new Set(),
    links: new Map(),
    circuits: new Map(),
  };
}

function findLiveRelayPath(NetworkState, OriginWorldIdentifier, DestinationWorldIdentifier) {
  const Queue = [[OriginWorldIdentifier]];
  const VisitedWorldIdentifiers = new Set([OriginWorldIdentifier]);
  const LiveLinks = listLiveRelayLinks(NetworkState).sort(
    (FirstLink, SecondLink) => FirstLink.id.localeCompare(SecondLink.id),
  );
  while (Queue.length > 0) {
    const Path = Queue.shift();
    const CurrentWorldIdentifier = Path.at(-1);
    if (CurrentWorldIdentifier === DestinationWorldIdentifier) return Path;
    for (const Link of LiveLinks) {
      const NeighborWorldIdentifier = Link.originWorldIdentifier === CurrentWorldIdentifier
        ? Link.destinationWorldIdentifier
        : Link.destinationWorldIdentifier === CurrentWorldIdentifier
          ? Link.originWorldIdentifier
          : null;
      if (!NeighborWorldIdentifier || VisitedWorldIdentifiers.has(NeighborWorldIdentifier)) {
        continue;
      }
      VisitedWorldIdentifiers.add(NeighborWorldIdentifier);
      Queue.push([...Path, NeighborWorldIdentifier]);
    }
  }
  return null;
}

export function wouldCloseRelayCircuit(
  NetworkState,
  OriginWorldIdentifier,
  DestinationWorldIdentifier,
) {
  const LinkIdentifier = getRelayLinkIdentifier(
    OriginWorldIdentifier,
    DestinationWorldIdentifier,
  );
  return !NetworkState.links.has(LinkIdentifier)
    && Boolean(findLiveRelayPath(
      NetworkState,
      OriginWorldIdentifier,
      DestinationWorldIdentifier,
    ));
}

/**
 * After the first unique loop, a gold ghost of the next missing edge that would
 * close another circuit. Prefers a closing flight from the current world.
 */
export function findCircuitBeaconLink(NetworkState, CurrentWorldIdentifier = null) {
  if (!NetworkState || NetworkState.circuits.size < 1) {
    return null;
  }
  const LiveWorldIdentifiers = [...NetworkState.activeWorldIdentifiers]
    .filter((WorldIdentifier) => isRelayWorldLive(NetworkState, WorldIdentifier))
    .sort();
  const OriginWorldIdentifiers = [];
  if (
    typeof CurrentWorldIdentifier === 'string'
    && LiveWorldIdentifiers.includes(CurrentWorldIdentifier)
  ) {
    OriginWorldIdentifiers.push(CurrentWorldIdentifier);
  }
  for (const WorldIdentifier of LiveWorldIdentifiers) {
    if (WorldIdentifier !== CurrentWorldIdentifier) {
      OriginWorldIdentifiers.push(WorldIdentifier);
    }
  }
  for (const OriginWorldIdentifier of OriginWorldIdentifiers) {
    for (const DestinationWorldIdentifier of LiveWorldIdentifiers) {
      if (DestinationWorldIdentifier === OriginWorldIdentifier) {
        continue;
      }
      if (wouldCloseRelayCircuit(
        NetworkState,
        OriginWorldIdentifier,
        DestinationWorldIdentifier,
      )) {
        return Object.freeze({
          id: getRelayLinkIdentifier(OriginWorldIdentifier, DestinationWorldIdentifier),
          originWorldIdentifier: OriginWorldIdentifier,
          destinationWorldIdentifier: DestinationWorldIdentifier,
        });
      }
    }
  }
  return null;
}

/** Derives permanent relay state only from a resolved world-to-world traversal. */
export function connectRelayWorlds(
  NetworkState,
  OriginWorldIdentifier,
  DestinationWorldIdentifier,
) {
  const LinkIdentifier = getRelayLinkIdentifier(
    OriginWorldIdentifier,
    DestinationWorldIdentifier,
  );
  const DestinationActivated = !NetworkState.activeWorldIdentifiers.has(
    DestinationWorldIdentifier,
  );
  const DestinationReactivated = NetworkState.suppressedWorldIdentifiers.delete(
    DestinationWorldIdentifier,
  );
  NetworkState.activeWorldIdentifiers.add(OriginWorldIdentifier);
  NetworkState.activeWorldIdentifiers.add(DestinationWorldIdentifier);
  const ExistingLink = NetworkState.links.get(LinkIdentifier);
  if (ExistingLink) {
    return {
      circuit: null,
      circuitClosed: false,
      created: false,
      destinationActivated: false,
      destinationReactivated: DestinationReactivated,
      link: ExistingLink,
    };
  }
  const ExistingPath = findLiveRelayPath(
    NetworkState,
    OriginWorldIdentifier,
    DestinationWorldIdentifier,
  );
  const Link = Object.freeze({
    id: LinkIdentifier,
    originWorldIdentifier: OriginWorldIdentifier,
    destinationWorldIdentifier: DestinationWorldIdentifier,
    sequenceIndex: NetworkState.links.size,
  });
  NetworkState.links.set(LinkIdentifier, Link);
  let Circuit = null;
  if (ExistingPath) {
    const CircuitLinkIdentifiers = [LinkIdentifier];
    for (let PathIndex = 1; PathIndex < ExistingPath.length; PathIndex += 1) {
      CircuitLinkIdentifiers.push(getRelayLinkIdentifier(
        ExistingPath[PathIndex - 1],
        ExistingPath[PathIndex],
      ));
    }
    CircuitLinkIdentifiers.sort();
    const CircuitIdentifier = CircuitLinkIdentifiers.join('|');
    Circuit = NetworkState.circuits.get(CircuitIdentifier) ?? Object.freeze({
      id: CircuitIdentifier,
      linkIdentifiers: Object.freeze(CircuitLinkIdentifiers),
      worldIdentifiers: Object.freeze([...new Set(ExistingPath)].sort()),
    });
    NetworkState.circuits.set(CircuitIdentifier, Circuit);
  }
  return {
    circuit: Circuit,
    circuitClosed: Boolean(Circuit),
    created: true,
    destinationActivated: DestinationActivated,
    destinationReactivated: DestinationReactivated,
    link: Link,
  };
}

export function listRelayLinks(NetworkState) {
  return [...NetworkState.links.values()];
}

export function listRelayCircuits(NetworkState) {
  return [...NetworkState.circuits.values()];
}

export function isRelayWorldLive(NetworkState, WorldIdentifier) {
  return NetworkState.activeWorldIdentifiers.has(WorldIdentifier)
    && !NetworkState.suppressedWorldIdentifiers.has(WorldIdentifier);
}

export function isRelayLinkLive(NetworkState, Link) {
  return isRelayWorldLive(NetworkState, Link.originWorldIdentifier)
    && isRelayWorldLive(NetworkState, Link.destinationWorldIdentifier);
}

export function listLiveRelayLinks(NetworkState) {
  return listRelayLinks(NetworkState).filter((Link) => isRelayLinkLive(NetworkState, Link));
}

export function listLiveRelayCircuits(NetworkState) {
  const LiveLinkIdentifiers = new Set(listLiveRelayLinks(NetworkState).map((Link) => Link.id));
  return listRelayCircuits(NetworkState).filter((Circuit) => (
    Circuit.linkIdentifiers.every((LinkIdentifier) => LiveLinkIdentifiers.has(LinkIdentifier))
  ));
}

export function listProtectedRelayWorlds(NetworkState) {
  return [...new Set(listLiveRelayCircuits(NetworkState).flatMap(
    (Circuit) => Circuit.worldIdentifiers,
  ))].sort();
}

export function suppressRelayWorld(NetworkState, WorldIdentifier) {
  if (!NetworkState.activeWorldIdentifiers.has(WorldIdentifier)) return false;
  const PreviousSize = NetworkState.suppressedWorldIdentifiers.size;
  NetworkState.suppressedWorldIdentifiers.add(WorldIdentifier);
  return NetworkState.suppressedWorldIdentifiers.size !== PreviousSize;
}

export function countLiveRelayWorlds(NetworkState) {
  return [...NetworkState.activeWorldIdentifiers].filter(
    (WorldIdentifier) => isRelayWorldLive(NetworkState, WorldIdentifier),
  ).length;
}

export function getRelayDegree(NetworkState, WorldIdentifier) {
  return listLiveRelayLinks(NetworkState).filter((Link) => (
    Link.originWorldIdentifier === WorldIdentifier
    || Link.destinationWorldIdentifier === WorldIdentifier
  )).length;
}

export function listVulnerableRelayWorlds(NetworkState) {
  return [...NetworkState.activeWorldIdentifiers].filter(
    (WorldIdentifier) => getRelayDegree(NetworkState, WorldIdentifier) <= 1,
  ).filter((WorldIdentifier) => isRelayWorldLive(NetworkState, WorldIdentifier));
}
