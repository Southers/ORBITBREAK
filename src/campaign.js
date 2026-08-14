/**
 * Pure campaign helpers shared by browser gameplay and deterministic tests.
 * Rendering state deliberately stays out of this module.
 */

/** Returns worlds that count toward system restoration. */
export function getRestorableWorlds(WorldDefinitions) {
  return WorldDefinitions.filter((WorldDefinition) => (
    !WorldDefinition.isStartingWorld
    && WorldDefinition.countsTowardRestoration !== false
  ));
}

/** Counts restored objective worlds without counting the initial launch platform. */
export function countRestoredWorlds(WorldDefinitions) {
  return getRestorableWorlds(WorldDefinitions).filter(
    (WorldDefinition) => WorldDefinition.restored,
  ).length;
}

/** Reports whether every objective world in the current system is awake. */
export function isSystemRestored(WorldDefinitions) {
  const RestorableWorlds = getRestorableWorlds(WorldDefinitions);
  return RestorableWorlds.length > 0 && RestorableWorlds.every(
    (WorldDefinition) => WorldDefinition.restored,
  );
}

/** Reports whether enough objective worlds are awake to expose the system exit. */
export function isWorldheartUnlocked(WorldDefinitions, UnlockThreshold) {
  return countRestoredWorlds(WorldDefinitions) >= UnlockThreshold;
}

/** Returns the three compact completion emblems shown at a Worldheart exit. */
export function getSystemEmblems(
  WorldDefinitions,
  CollectedStardustCount,
  TotalStardustCount,
  HasReachedWorldheart,
) {
  return {
    heart: HasReachedWorldheart,
    bloom: isSystemRestored(WorldDefinitions),
    arc: TotalStardustCount > 0 && CollectedStardustCount === TotalStardustCount,
  };
}

/**
 * Selects the most meaningful concise accolade earned by a completed shot.
 *
 * Close asteroid passes take priority because they are the highest-risk event. Passing
 * another world before landing elsewhere communicates a gravity assist, while returning
 * cleanly to an already restored node still receives a small acknowledgement.
 */
export function getLandingAccolade({
  hadAsteroidClosePass = false,
  closePassWorldIdentifiers = [],
  landingWorldIdentifier = null,
  isNewWorldLanding = false,
} = {}) {
  if (hadAsteroidClosePass) {
    return 'CLOSE PASS';
  }

  if ([...closePassWorldIdentifiers].some(
    (WorldIdentifier) => WorldIdentifier !== landingWorldIdentifier,
  )) {
    return 'GRAVITY ASSIST';
  }

  return isNewWorldLanding ? null : 'CLEAN LANDING';
}

/**
 * Suggests authored unrestored destinations, then falls back to spatial proximity.
 *
 * This does not restrict physics or force a target. Optional authoring order makes route
 * purpose legible while every world remains a valid deterministic collision body.
 */
export function getRouteChoices(
  WorldDefinitions,
  CurrentWorldIdentifier,
  MaximumChoiceCount = 2,
  PreferredDestinationIdentifiers = [],
) {
  const CurrentWorldDefinition = WorldDefinitions.find(
    (WorldDefinition) => WorldDefinition.id === CurrentWorldIdentifier,
  );
  if (!CurrentWorldDefinition || MaximumChoiceCount <= 0) {
    return [];
  }

  return WorldDefinitions
    .filter((WorldDefinition) => (
      !WorldDefinition.isStartingWorld
      && !WorldDefinition.restored
      && WorldDefinition.routeAvailable !== false
      && (
        WorldDefinition.countsTowardRestoration !== false
        || WorldDefinition.isRouteDestination === true
      )
    ))
    .map((WorldDefinition, DefinitionIndex) => {
      const DifferenceX = WorldDefinition.position.x - CurrentWorldDefinition.position.x;
      const DifferenceY = WorldDefinition.position.y - CurrentWorldDefinition.position.y;
      const DifferenceZ = WorldDefinition.position.z - CurrentWorldDefinition.position.z;
      return {
        definition: WorldDefinition,
        definitionIndex: DefinitionIndex,
        preferenceIndex: PreferredDestinationIdentifiers.indexOf(WorldDefinition.id),
        distanceSquared: (
          (DifferenceX * DifferenceX)
          + (DifferenceY * DifferenceY)
          + (DifferenceZ * DifferenceZ)
        ),
      };
    })
    .sort((FirstChoice, SecondChoice) => (
      (
        (FirstChoice.preferenceIndex < 0 ? Infinity : FirstChoice.preferenceIndex)
        - (SecondChoice.preferenceIndex < 0 ? Infinity : SecondChoice.preferenceIndex)
      )
      ||
      (FirstChoice.distanceSquared - SecondChoice.distanceSquared)
      || (FirstChoice.definitionIndex - SecondChoice.definitionIndex)
    ))
    .slice(0, MaximumChoiceCount)
    .map((Choice) => Choice.definition);
}

/**
 * Returns optional pickups intersected by a deterministic predicted path.
 *
 * Each pickup is reported at most once even when several fixed-step samples cross it.
 */
export function getTrajectoryPickupIdentifiers(
  TrajectoryPoints,
  PickupDefinitions,
  CollectorRadius,
) {
  const RemainingPickupDefinitions = PickupDefinitions.filter(
    (PickupDefinition) => !PickupDefinition.collected,
  );
  const CollectedPickupIdentifiers = [];
  const CollectionDistanceSquared = CollectorRadius * CollectorRadius;

  for (const TrajectoryPoint of TrajectoryPoints) {
    for (
      let PickupIndex = RemainingPickupDefinitions.length - 1;
      PickupIndex >= 0;
      PickupIndex -= 1
    ) {
      const PickupDefinition = RemainingPickupDefinitions[PickupIndex];
      const DifferenceX = PickupDefinition.position.x - TrajectoryPoint.x;
      const DifferenceY = PickupDefinition.position.y - TrajectoryPoint.y;
      const DifferenceZ = PickupDefinition.position.z - TrajectoryPoint.z;
      if (
        ((DifferenceX * DifferenceX) + (DifferenceY * DifferenceY) + (DifferenceZ * DifferenceZ))
        <= CollectionDistanceSquared
      ) {
        CollectedPickupIdentifiers.push(PickupDefinition.id);
        RemainingPickupDefinitions.splice(PickupIndex, 1);
      }
    }
  }

  return CollectedPickupIdentifiers;
}

/** Rolls back only pickups touched during a failed shot, preserving earlier banked mastery. */
export function rollbackFlightPickups(PickupDefinitions, FlightPickupIdentifiers) {
  let RestoredPickupCount = 0;
  for (const PickupDefinition of PickupDefinitions) {
    if (FlightPickupIdentifiers.has(PickupDefinition.id) && PickupDefinition.collected) {
      PickupDefinition.collected = false;
      RestoredPickupCount += 1;
    }
  }
  return RestoredPickupCount;
}
