/**
 * Offline gravity-design report.
 *
 * Sweeps deterministic launches from every world of an authored sector through
 * the shared prediction sim and classifies each origin -> destination route:
 *
 * - DIRECT: at least one full-power launch lands without entering another
 *   world's slingshot band on the way.
 * - ASSIST: reachable, but every found solution bends through at least one
 *   intermediate slingshot band (gravity is mandatory).
 * - none: no sampled launch reaches the destination at all (multi-hop only).
 *
 * Usage: node tools/reachability-report.mjs [sector-id] [--json]
 */

import { createAuthoredSystemRuntime, getAuthoredSystemDefinition } from '../src/content.js';
import { MaximumLaunchSpeed, createVector, predictTrajectory } from '../src/physics.js';
import { getSlingshotBand } from '../src/scoring.js';
import { FixedPhysicsStepSeconds, RunnerRadius, SurfaceRestLift } from '../src/sim-constants.js';

const SectorIdentifier = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : 'breaker-reach';
const EmitJson = process.argv.includes('--json');

const SurfaceAngleSampleCount = 36;
const AimOffsetSampleCount = 23;
const MaximumAimOffsetRadians = 1.75;
const SpeedFractions = [1, 0.85, 0.7, 0.55];
const MaximumPredictionSteps = 7200;

const Runtime = createAuthoredSystemRuntime(
  getAuthoredSystemDefinition(SectorIdentifier),
  { createVector },
);
const Worldheart = Runtime.tacticalBodies.find((Body) => Body.kind === 'worldheart');
const CollisionBodies = Runtime.tacticalBodies.filter(
  (Body) => Body.kind === 'hazard' || Body.kind === 'worldheart',
);

function classifyTrajectory(Points, OriginIdentifier, TargetIdentifier) {
  for (const World of Runtime.worlds) {
    if (World.id === OriginIdentifier || World.id === TargetIdentifier) {
      continue;
    }
    const Band = getSlingshotBand(World);
    const BandDistance = World.radius + RunnerRadius + Band.outerClearance;
    const BandDistanceSquared = BandDistance * BandDistance;
    for (const Point of Points) {
      const DeltaX = Point.x - World.position.x;
      const DeltaY = Point.y - World.position.y;
      if ((DeltaX * DeltaX) + (DeltaY * DeltaY) <= BandDistanceSquared) {
        return 'assist';
      }
    }
  }
  return 'direct';
}

const Report = [];
for (const Origin of Runtime.worlds) {
  const RouteOutcomes = new Map();
  const SurfaceDistance = Origin.radius + RunnerRadius + SurfaceRestLift;
  for (let AngleIndex = 0; AngleIndex < SurfaceAngleSampleCount; AngleIndex += 1) {
    const SurfaceAngle = (AngleIndex / SurfaceAngleSampleCount) * Math.PI * 2;
    const StartPosition = createVector(
      Origin.position.x + (Math.cos(SurfaceAngle) * SurfaceDistance),
      Origin.position.y + (Math.sin(SurfaceAngle) * SurfaceDistance),
      0,
    );
    for (let OffsetIndex = 0; OffsetIndex < AimOffsetSampleCount; OffsetIndex += 1) {
      const AimOffset = ((OffsetIndex / (AimOffsetSampleCount - 1)) * 2 - 1)
        * MaximumAimOffsetRadians;
      const AimAngle = SurfaceAngle + AimOffset;
      for (const SpeedFraction of SpeedFractions) {
        const Speed = MaximumLaunchSpeed * SpeedFraction;
        const Prediction = predictTrajectory(
          StartPosition,
          createVector(Math.cos(AimAngle) * Speed, Math.sin(AimAngle) * Speed, 0),
          Runtime.worlds,
          {
            seedRadius: RunnerRadius,
            fixedStepSeconds: FixedPhysicsStepSeconds,
            maximumSteps: MaximumPredictionSteps,
            ignoredWorldIdentifier: Origin.id,
            collisionBodyDefinitions: CollisionBodies,
            startTimeSeconds: 0,
          },
        );
        const TargetIdentifier = Prediction.collisionKind === 'worldheart'
          ? Worldheart.id
          : Prediction.collisionWorldIdentifier;
        if (!TargetIdentifier || TargetIdentifier === Origin.id) {
          continue;
        }
        const Kind = classifyTrajectory(Prediction.points, Origin.id, TargetIdentifier);
        const Outcome = RouteOutcomes.get(TargetIdentifier)
          ?? { direct: 0, assist: 0, minSpeedFraction: 1 };
        Outcome[Kind] += 1;
        Outcome.minSpeedFraction = Math.min(Outcome.minSpeedFraction, SpeedFraction);
        RouteOutcomes.set(TargetIdentifier, Outcome);
      }
    }
  }
  Report.push({ origin: Origin.id, routes: Object.fromEntries(RouteOutcomes) });
}

if (EmitJson) {
  console.log(JSON.stringify(Report, null, 2));
} else {
  const TargetIdentifiers = [
    ...Runtime.worlds.map((World) => World.id),
    Worldheart.id,
  ];
  console.log(`Sector: ${Runtime.id} (${Runtime.contentVersion})`);
  console.log(`Launch cap ${MaximumLaunchSpeed}; ${SurfaceAngleSampleCount}x${AimOffsetSampleCount} sweep, speeds ${SpeedFractions.join('/')}\n`);
  const Header = ['origin\\target', ...TargetIdentifiers.map((Id) => Id.slice(0, 8))];
  console.log(Header.map((Cell) => Cell.padEnd(10)).join(''));
  for (const Row of Report) {
    const Cells = [Row.origin.slice(0, 9)];
    for (const TargetIdentifier of TargetIdentifiers) {
      if (TargetIdentifier === Row.origin) {
        Cells.push('-');
        continue;
      }
      const Outcome = Row.routes[TargetIdentifier];
      if (!Outcome) {
        Cells.push('.');
      } else if (Outcome.direct > 0) {
        Cells.push(`D${Outcome.direct}`);
      } else {
        Cells.push(`A${Outcome.assist}`);
      }
    }
    console.log(Cells.map((Cell) => Cell.padEnd(10)).join(''));
  }
  console.log('\nD = direct solutions, A = assisted-only, . = unreachable in sweep');
}
