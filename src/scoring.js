const TierDefinitions = [
  { id: 'razor', label: 'RAZOR ASSIST', multiplier: 3 },
  { id: 'deep', label: 'DEEP ASSIST', multiplier: 2 },
  { id: 'assist', label: 'GRAVITY ASSIST', multiplier: 1 },
];

export function getDefaultSlingshotValue(BodyDefinition) {
  const RawValue = (BodyDefinition.gravitationalParameter * 4)
    + (BodyDefinition.radius * 60);
  return Math.max(250, Math.round(RawValue / 50) * 50);
}

export function getSlingshotBand(BodyDefinition) {
  return {
    outerClearance: Math.max(1.25, BodyDefinition.radius * 0.78),
    deepClearance: Math.max(0.58, BodyDefinition.radius * 0.34),
    razorClearance: Math.max(0.2, BodyDefinition.radius * 0.14),
  };
}

export function createScoreState() {
  return {
    bankedScore: 0,
    flightScore: 0,
    chainCount: 0,
    activePasses: new Map(),
    scoredBodyIdentifiers: new Set(),
  };
}

function resetFlightState(ScoreState) {
  ScoreState.flightScore = 0;
  ScoreState.chainCount = 0;
  ScoreState.activePasses.clear();
  ScoreState.scoredBodyIdentifiers.clear();
}

function getPassTier(MinimumClearance, Band) {
  if (MinimumClearance <= Band.razorClearance) {
    return TierDefinitions[0];
  }
  if (MinimumClearance <= Band.deepClearance) {
    return TierDefinitions[1];
  }
  return TierDefinitions[2];
}

/**
 * Samples one fixed-step position and returns completed flyby events.
 * A pass scores only after leaving the influence band, never merely for entering it.
 */
export function sampleSlingshotBodies(
  ScoreState,
  RunnerPosition,
  BodyDefinitions,
  { runnerRadius, ignoredBodyIdentifier = null },
) {
  const Events = [];

  for (const BodyDefinition of BodyDefinitions) {
    if (
      BodyDefinition.id === ignoredBodyIdentifier
      || ScoreState.scoredBodyIdentifiers.has(BodyDefinition.id)
    ) {
      continue;
    }

    const DeltaX = RunnerPosition.x - BodyDefinition.position.x;
    const DeltaY = RunnerPosition.y - BodyDefinition.position.y;
    const SurfaceClearance = Math.hypot(DeltaX, DeltaY)
      - BodyDefinition.radius
      - runnerRadius;
    const Band = getSlingshotBand(BodyDefinition);
    const ActivePass = ScoreState.activePasses.get(BodyDefinition.id);

    if (SurfaceClearance <= Band.outerClearance) {
      if (SurfaceClearance > 0) {
        if (ActivePass) {
          ActivePass.minimumClearance = Math.min(
            ActivePass.minimumClearance,
            SurfaceClearance,
          );
        } else {
          ScoreState.activePasses.set(BodyDefinition.id, {
            minimumClearance: SurfaceClearance,
          });
        }
      }
      continue;
    }

    if (!ActivePass) {
      continue;
    }

    const Tier = getPassTier(ActivePass.minimumClearance, Band);
    ScoreState.activePasses.delete(BodyDefinition.id);
    ScoreState.scoredBodyIdentifiers.add(BodyDefinition.id);
    ScoreState.chainCount += 1;
    const ChainMultiplier = Math.min(ScoreState.chainCount, 4);
    const BaseValue = BodyDefinition.slingshotValue
      ?? getDefaultSlingshotValue(BodyDefinition);
    const Points = BaseValue * Tier.multiplier * ChainMultiplier;
    ScoreState.flightScore += Points;
    Events.push({
      bodyIdentifier: BodyDefinition.id,
      bodyLabel: BodyDefinition.label,
      tier: Tier.id,
      tierLabel: Tier.label,
      tierMultiplier: Tier.multiplier,
      chainCount: ScoreState.chainCount,
      chainMultiplier: ChainMultiplier,
      minimumClearance: ActivePass.minimumClearance,
      points: Points,
      flightScore: ScoreState.flightScore,
    });
  }

  return Events;
}

export function bankFlightScore(ScoreState, { landingBonus = 0 } = {}) {
  const FlightPoints = ScoreState.flightScore;
  const BankedPoints = FlightPoints + landingBonus;
  ScoreState.bankedScore += BankedPoints;
  resetFlightState(ScoreState);
  return {
    flightPoints: FlightPoints,
    landingBonus,
    bankedPoints: BankedPoints,
    totalScore: ScoreState.bankedScore,
  };
}

export function rollbackFlightScore(ScoreState) {
  const LostPoints = ScoreState.flightScore;
  resetFlightState(ScoreState);
  return LostPoints;
}

export function addCompletionBonus(ScoreState, RemainingLaunches, ValuePerLaunch = 1000) {
  const Bonus = Math.max(0, RemainingLaunches) * ValuePerLaunch;
  ScoreState.bankedScore += Bonus;
  return Bonus;
}

export function predictSlingshotEvents(
  TrajectoryPoints,
  BodyDefinitions,
  Settings,
) {
  const PredictionScoreState = createScoreState();
  const Events = [];
  for (const TrajectoryPoint of TrajectoryPoints) {
    Events.push(...sampleSlingshotBodies(
      PredictionScoreState,
      TrajectoryPoint,
      BodyDefinitions,
      Settings,
    ));
  }
  return Events;
}

