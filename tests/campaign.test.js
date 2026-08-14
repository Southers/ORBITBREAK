import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countRestoredWorlds,
  getLandingAccolade,
  getRouteChoices,
  getSystemEmblems,
  getTrajectoryPickupIdentifiers,
  isSystemRestored,
  isWorldheartUnlocked,
  rollbackFlightPickups,
} from '../src/campaign.js';

function createFirstLightDefinitions() {
  return [
    {
      id: 'meadow',
      label: 'MEADOW',
      position: { x: -8, y: -6.4, z: 0 },
      restored: true,
      isStartingWorld: true,
    },
    {
      id: 'ember',
      label: 'EMBER',
      position: { x: 7.8, y: -3.3, z: 0 },
      restored: false,
      isStartingWorld: false,
    },
    {
      id: 'grove',
      label: 'GROVE',
      position: { x: -8.8, y: 3, z: 0 },
      restored: false,
      isStartingWorld: false,
    },
    {
      id: 'frost',
      label: 'FROST',
      position: { x: 0.7, y: 8, z: 0 },
      restored: false,
      isStartingWorld: false,
    },
    {
      id: 'tide',
      label: 'TIDE',
      position: { x: 9.7, y: 6, z: 0 },
      restored: false,
      isStartingWorld: false,
    },
  ];
}

test('First Light opens with two spatially distinct route choices', () => {
  const WorldDefinitions = createFirstLightDefinitions();
  assert.deepEqual(
    getRouteChoices(WorldDefinitions, 'meadow').map((WorldDefinition) => WorldDefinition.id),
    ['grove', 'ember'],
  );
});

test('landing order changes the next suggested route geometry', () => {
  const GroveFirstDefinitions = createFirstLightDefinitions();
  GroveFirstDefinitions.find((WorldDefinition) => WorldDefinition.id === 'grove').restored = true;
  assert.deepEqual(
    getRouteChoices(GroveFirstDefinitions, 'grove').map(
      (WorldDefinition) => WorldDefinition.id,
    ),
    ['frost', 'ember'],
  );

  const EmberFirstDefinitions = createFirstLightDefinitions();
  EmberFirstDefinitions.find((WorldDefinition) => WorldDefinition.id === 'ember').restored = true;
  assert.deepEqual(
    getRouteChoices(EmberFirstDefinitions, 'ember').map(
      (WorldDefinition) => WorldDefinition.id,
    ),
    ['tide', 'frost'],
  );
});

test('system completion counts only objective worlds', () => {
  const WorldDefinitions = createFirstLightDefinitions();
  WorldDefinitions.push({
    id: 'seedstone',
    label: 'SEEDSTONE',
    position: { x: 0, y: -0.5, z: 0 },
    restored: true,
    countsTowardRestoration: false,
  });
  assert.equal(countRestoredWorlds(WorldDefinitions), 0);
  assert.equal(isSystemRestored(WorldDefinitions), false);

  for (const WorldDefinition of WorldDefinitions) {
    WorldDefinition.restored = true;
  }
  assert.equal(countRestoredWorlds(WorldDefinitions), 4);
  assert.equal(isSystemRestored(WorldDefinitions), true);
});

test('Worldheart opens at the authored threshold without requiring full Bloom', () => {
  const WorldDefinitions = createFirstLightDefinitions();
  const ObjectiveWorlds = WorldDefinitions.filter((WorldDefinition) => !WorldDefinition.isStartingWorld);
  ObjectiveWorlds.slice(0, 2).forEach((WorldDefinition) => {
    WorldDefinition.restored = true;
  });
  assert.equal(isWorldheartUnlocked(WorldDefinitions, 3), false);

  ObjectiveWorlds[2].restored = true;
  assert.equal(isWorldheartUnlocked(WorldDefinitions, 3), true);
  assert.equal(isSystemRestored(WorldDefinitions), false);
});

test('route choices expose only an unlocked Worldheart destination', () => {
  const WorldDefinitions = createFirstLightDefinitions();
  const WorldheartDefinition = {
    id: 'worldheart',
    label: 'WORLDHEART',
    position: { x: -4, y: 8, z: 0 },
    restored: false,
    countsTowardRestoration: false,
    isRouteDestination: true,
    routeAvailable: false,
  };
  WorldDefinitions.push(WorldheartDefinition);
  assert.equal(
    getRouteChoices(WorldDefinitions, 'frost', 5).some(
      (WorldDefinition) => WorldDefinition.id === 'worldheart',
    ),
    false,
  );

  WorldheartDefinition.routeAvailable = true;
  assert.equal(
    getRouteChoices(WorldDefinitions, 'frost', 5).some(
      (WorldDefinition) => WorldDefinition.id === 'worldheart',
    ),
    true,
  );
});

test('system emblems separate basic completion from optional mastery', () => {
  const WorldDefinitions = createFirstLightDefinitions();
  WorldDefinitions.filter((WorldDefinition) => !WorldDefinition.isStartingWorld).slice(0, 3)
    .forEach((WorldDefinition) => {
      WorldDefinition.restored = true;
    });

  assert.deepEqual(getSystemEmblems(WorldDefinitions, 3, 3, true), {
    heart: true,
    bloom: false,
    arc: true,
  });

  WorldDefinitions.find((WorldDefinition) => !WorldDefinition.restored).restored = true;
  assert.deepEqual(getSystemEmblems(WorldDefinitions, 3, 3, true), {
    heart: true,
    bloom: true,
    arc: true,
  });
});

test('landing accolades prioritise risk, then gravity routing, then clean recovery', () => {
  assert.equal(getLandingAccolade({
    hadAsteroidClosePass: true,
    closePassWorldIdentifiers: ['grove'],
    landingWorldIdentifier: 'frost',
    isNewWorldLanding: true,
  }), 'CLOSE PASS');

  assert.equal(getLandingAccolade({
    closePassWorldIdentifiers: new Set(['tide', 'frost']),
    landingWorldIdentifier: 'frost',
    isNewWorldLanding: true,
  }), 'GRAVITY ASSIST');

  assert.equal(getLandingAccolade({
    closePassWorldIdentifiers: ['frost'],
    landingWorldIdentifier: 'frost',
    isNewWorldLanding: true,
  }), null);
  assert.equal(getLandingAccolade({
    landingWorldIdentifier: 'ember',
    isNewWorldLanding: false,
  }), 'CLEAN LANDING');
});

test('trajectory pickup prediction reports each uncollected mote once', () => {
  const PickupDefinitions = [
    { id: 'arc-1', position: { x: 1, y: 0, z: 0 }, collected: false },
    { id: 'arc-2', position: { x: 2, y: 0, z: 0 }, collected: true },
    { id: 'arc-3', position: { x: 3, y: 0, z: 0 }, collected: false },
  ];
  const TrajectoryPoints = [
    { x: 0, y: 0, z: 0 },
    { x: 0.9, y: 0, z: 0 },
    { x: 1.1, y: 0, z: 0 },
    { x: 3.05, y: 0, z: 0 },
  ];

  assert.deepEqual(
    getTrajectoryPickupIdentifiers(TrajectoryPoints, PickupDefinitions, 0.2).sort(),
    ['arc-1', 'arc-3'],
  );
});

test('failed-flight rollback preserves earlier banked stardust', () => {
  const PickupDefinitions = [
    { id: 'banked', collected: true },
    { id: 'flight-1', collected: true },
    { id: 'flight-2', collected: true },
  ];

  assert.equal(
    rollbackFlightPickups(PickupDefinitions, new Set(['flight-1', 'flight-2'])),
    2,
  );
  assert.deepEqual(
    PickupDefinitions.map((PickupDefinition) => PickupDefinition.collected),
    [true, false, false],
  );
});
