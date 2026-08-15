import test from 'node:test';
import assert from 'node:assert/strict';

import { getRouteChoices } from '../src/campaign.js';
import {
  DefaultAuthoredSystemIdentifier,
  BreakerReachSystemDefinition,
  BrokenBeltSystemDefinition,
  FirstLightSystemDefinition,
  LongNightSystemDefinition,
  WorldheartSystemDefinition,
  WanderingGardenSystemDefinition,
  AuthoredCampaignSystemIdentifiers,
  createAuthoredSystemRuntime,
  getAuthoredSystemDefinition,
  getNextAuthoredSystemIdentifier,
  validateAuthoredSystemDefinition,
} from '../src/content.js';

test('First Light satisfies the authored-system content contract', () => {
  assert.deepEqual(validateAuthoredSystemDefinition(FirstLightSystemDefinition), []);
  assert.equal(createAuthoredSystemRuntime(FirstLightSystemDefinition).launchBudget, 8);
  const FrostDefinition = FirstLightSystemDefinition.worlds.find(
    (WorldDefinition) => WorldDefinition.id === 'frost',
  );
  const GroveDefinition = FirstLightSystemDefinition.worlds.find(
    (WorldDefinition) => WorldDefinition.id === 'grove',
  );
  assert.ok(FrostDefinition.slingshotValue > GroveDefinition.slingshotValue);
});

test("Breaker\'s Reach is the large-system score-attack entry", () => {
  assert.deepEqual(validateAuthoredSystemDefinition(BreakerReachSystemDefinition), []);
  assert.equal(BreakerReachSystemDefinition.worlds.length, 6);
  assert.equal(BreakerReachSystemDefinition.camera.followPlayer, true);
  assert.equal(
    BreakerReachSystemDefinition.openingBroadcast,
    'WARDEN BROADCAST · TRAVEL IS FORBIDDEN · SILENCE KEEPS YOU SAFE',
  );
  assert.equal(
    BreakerReachSystemDefinition.commandApproachLine,
    'A network cannot be imprisoned.',
  );
  assert.equal(
    BreakerReachSystemDefinition.routeGuidance.grove.meadow,
    "Walk Grove's far rim, then aim back around Ember. Haven lies beyond preview—hold the long arc to close the gold loop.",
  );
  assert.equal(
    BreakerReachSystemDefinition.completion.endingReveal,
    'You did not save them alone. You reminded them they were never alone.',
  );
  assert.equal(
    BreakerReachSystemDefinition.completion.expansionSting,
    'WARDEN NODE DISCONNECTED · SECTOR WARDENS: 11',
  );
  const WorldXs = BreakerReachSystemDefinition.worlds.map(
    (WorldDefinition) => WorldDefinition.position.x,
  );
  assert.ok(Math.max(...WorldXs) - Math.min(...WorldXs) > 35);
  assert.deepEqual(
    BreakerReachSystemDefinition.routeSuggestions.meadow,
    ['ember', 'frost'],
  );
  const BastionDefinition = BreakerReachSystemDefinition.worlds.find(
    (WorldDefinition) => WorldDefinition.id === 'bastion',
  );
  assert.equal(BastionDefinition.disposition, 'hostile');
  assert.ok(BastionDefinition.hostileEncounter.pulseRangeRadians > 0);
  const CommandDefinition = BreakerReachSystemDefinition.tacticalBodies.find(
    (BodyDefinition) => BodyDefinition.kind === 'worldheart',
  );
  assert.equal(BreakerReachSystemDefinition.commandWorldRequiresShieldBreaks, true);
  assert.equal(BreakerReachSystemDefinition.circuitBonusValue, 1250);
  assert.equal(BreakerReachSystemDefinition.wardenVictoryValuePerStep, 1000);
  assert.deepEqual(BreakerReachSystemDefinition.completion.emblems, {
    heart: { title: 'COMMAND', subtitle: 'DEFEATED' },
    bloom: { title: 'SOLIDARITY', subtitle: 'ALL WORLDS' },
    arc: { title: 'WAYFINDER', subtitle: '3 STARDUST' },
  });
  assert.equal(BreakerReachSystemDefinition.completion.continueToNextSystem, false);
  assert.ok(CommandDefinition.orbit.angularSpeedRadiansPerSecond > 0);
  assert.ok(CommandDefinition.hostileEncounter.pulseRangeRadians > 0);
  assert.ok(BreakerReachSystemDefinition.worlds.every(
    (WorldDefinition) => WorldDefinition.occupationScarAngles.length >= 2,
  ));
  const Runtime = createAuthoredSystemRuntime(BreakerReachSystemDefinition);
  assert.notEqual(
    Runtime.worlds[0].occupationScarAngles,
    BreakerReachSystemDefinition.worlds[0].occupationScarAngles,
  );
  assert.notEqual(
    Runtime.completion.emblems.heart,
    BreakerReachSystemDefinition.completion.emblems.heart,
  );
});

test('authored opening broadcasts fail closed when present but empty', () => {
  const InvalidSystemDefinition = structuredClone(BreakerReachSystemDefinition);
  InvalidSystemDefinition.openingBroadcast = '   ';
  assert.ok(validateAuthoredSystemDefinition(InvalidSystemDefinition).includes(
    'Authored system openingBroadcast must be a non-empty string when present.',
  ));
});

test('authored final story anchors fail closed when present but empty', () => {
  const InvalidSystemDefinition = structuredClone(BreakerReachSystemDefinition);
  InvalidSystemDefinition.commandApproachLine = ' ';
  InvalidSystemDefinition.completion.endingReveal = '';
  InvalidSystemDefinition.completion.expansionSting = '   ';
  const Errors = validateAuthoredSystemDefinition(InvalidSystemDefinition);
  assert.ok(Errors.includes(
    'Authored system commandApproachLine must be a non-empty string when present.',
  ));
  assert.ok(Errors.includes(
    'Authored system completion.endingReveal must be a non-empty string when present.',
  ));
  assert.ok(Errors.includes(
    'Authored system completion.expansionSting must be a non-empty string when present.',
  ));
});

test('authored result emblems fail closed when their visible copy is incomplete', () => {
  const InvalidSystemDefinition = structuredClone(BreakerReachSystemDefinition);
  InvalidSystemDefinition.completion.emblems.arc.subtitle = '';
  assert.ok(validateAuthoredSystemDefinition(InvalidSystemDefinition).includes(
    'Authored system completion.emblems.arc requires title and subtitle.',
  ));
});

test('authored continuation policy fails closed when it is not boolean', () => {
  const InvalidSystemDefinition = structuredClone(BreakerReachSystemDefinition);
  InvalidSystemDefinition.completion.continueToNextSystem = 'later';
  assert.ok(validateAuthoredSystemDefinition(InvalidSystemDefinition).includes(
    'Authored system completion.continueToNextSystem must be boolean when present.',
  ));
});

test('authored systems fail closed without a positive launch budget', () => {
  const InvalidSystemDefinition = structuredClone(FirstLightSystemDefinition);
  InvalidSystemDefinition.launchBudget = 0;

  assert.ok(validateAuthoredSystemDefinition(InvalidSystemDefinition).includes(
    'Authored system requires a positive integer launchBudget.',
  ));
});

test('authored systems require a stable content version for local records', () => {
  const InvalidSystemDefinition = structuredClone(BreakerReachSystemDefinition);
  InvalidSystemDefinition.contentVersion = '';

  assert.ok(validateAuthoredSystemDefinition(InvalidSystemDefinition).includes(
    'Authored system requires a contentVersion.',
  ));
});

test('authored scoring values fail closed when present but invalid', () => {
  const InvalidSystemDefinition = structuredClone(FirstLightSystemDefinition);
  InvalidSystemDefinition.worlds[0].slingshotValue = 0;
  InvalidSystemDefinition.worlds[1].liberationValue = 2.5;
  InvalidSystemDefinition.circuitBonusValue = 0;

  const Errors = validateAuthoredSystemDefinition(InvalidSystemDefinition);
  assert.ok(Errors.includes('World meadow has an invalid slingshotValue.'));
  assert.ok(Errors.includes('World ember has an invalid liberationValue.'));
  assert.ok(Errors.includes(
    'Authored system circuitBonusValue must be a positive integer when present.',
  ));
});

test('hostile worlds fail closed without a bounded contextual encounter', () => {
  const InvalidSystemDefinition = structuredClone(BreakerReachSystemDefinition);
  const BastionDefinition = InvalidSystemDefinition.worlds.find(
    (WorldDefinition) => WorldDefinition.id === 'bastion',
  );
  BastionDefinition.hostileEncounter.pulseRangeRadians = 0;
  assert.ok(validateAuthoredSystemDefinition(InvalidSystemDefinition).includes(
    'World bastion has invalid hostile encounter data.',
  ));
});

test('occupation scar authoring stays finite and bounded', () => {
  const InvalidSystemDefinition = structuredClone(BreakerReachSystemDefinition);
  InvalidSystemDefinition.worlds[1].occupationScarAngles = [0];
  assert.ok(validateAuthoredSystemDefinition(InvalidSystemDefinition).includes(
    'World ember has invalid occupation scar angles.',
  ));
});

test('tactical surface encounters fail closed without a bounded Pulse range', () => {
  const InvalidSystemDefinition = structuredClone(BreakerReachSystemDefinition);
  const CommandDefinition = InvalidSystemDefinition.tacticalBodies.find(
    (BodyDefinition) => BodyDefinition.kind === 'worldheart',
  );
  CommandDefinition.hostileEncounter.pulseRangeRadians = 0;
  assert.ok(validateAuthoredSystemDefinition(InvalidSystemDefinition).includes(
    'Tactical body worldheart has invalid encounter data.',
  ));
});

test('Broken Belt satisfies the authored-system content contract', () => {
  assert.deepEqual(validateAuthoredSystemDefinition(BrokenBeltSystemDefinition), []);
  assert.equal(BrokenBeltSystemDefinition.worlds.length, 6);
  assert.equal(BrokenBeltSystemDefinition.contentVersion, 'broken-belt-1');
  assert.equal(BrokenBeltSystemDefinition.camera.followPlayer, true);
  const WorldXs = BrokenBeltSystemDefinition.worlds.map(
    (WorldDefinition) => WorldDefinition.position.x,
  );
  assert.ok(Math.max(...WorldXs) - Math.min(...WorldXs) > 45);
  const ShardDefinition = BrokenBeltSystemDefinition.worlds.find(
    (WorldDefinition) => WorldDefinition.id === 'shard',
  );
  assert.equal(ShardDefinition.slingshotValue, 1200);
});

test('Wandering Garden satisfies the moving-system content contract', () => {
  assert.deepEqual(validateAuthoredSystemDefinition(WanderingGardenSystemDefinition), []);
  assert.equal(WanderingGardenSystemDefinition.worlds.length, 6);
  assert.equal(WanderingGardenSystemDefinition.contentVersion, 'wandering-garden-1');
  assert.equal(WanderingGardenSystemDefinition.camera.followPlayer, true);
  const WorldXs = WanderingGardenSystemDefinition.worlds.map(
    (WorldDefinition) => WorldDefinition.position.x,
  );
  assert.ok(Math.max(...WorldXs) - Math.min(...WorldXs) >= 45);
  const PollenMoonDefinition = WanderingGardenSystemDefinition.tacticalBodies.find(
    (BodyDefinition) => BodyDefinition.id === 'pollen-moon',
  );
  assert.ok(PollenMoonDefinition.orbit);
  assert.ok(PollenMoonDefinition.orbit.angularSpeedRadiansPerSecond > 0);
});

test('Long Night satisfies the authored campaign and environment contract', () => {
  assert.deepEqual(validateAuthoredSystemDefinition(LongNightSystemDefinition), []);
  assert.equal(LongNightSystemDefinition.worlds.length, 6);
  assert.equal(LongNightSystemDefinition.contentVersion, 'long-night-1');
  assert.equal(LongNightSystemDefinition.worldheartUnlockThreshold, 3);
  assert.equal(LongNightSystemDefinition.camera.followPlayer, true);
  const WorldXs = LongNightSystemDefinition.worlds.map(
    (WorldDefinition) => WorldDefinition.position.x,
  );
  assert.ok(Math.max(...WorldXs) - Math.min(...WorldXs) > 45);
  const Runtime = createAuthoredSystemRuntime(LongNightSystemDefinition);
  assert.equal(Runtime.environment.backgroundColor, 0x02030b);
  assert.equal(Runtime.environment.toneMappingExposure, 1.08);
});

test('Worldheart satisfies the authored finale contract', () => {
  assert.deepEqual(validateAuthoredSystemDefinition(WorldheartSystemDefinition), []);
  assert.equal(WorldheartSystemDefinition.worlds.length, 6);
  assert.equal(WorldheartSystemDefinition.contentVersion, 'worldheart-1');
  assert.equal(WorldheartSystemDefinition.worldheartUnlockThreshold, 3);
  assert.equal(WorldheartSystemDefinition.camera.followPlayer, true);
  const WorldXs = WorldheartSystemDefinition.worlds.map(
    (WorldDefinition) => WorldDefinition.position.x,
  );
  assert.ok(Math.max(...WorldXs) - Math.min(...WorldXs) > 45);
  const Runtime = createAuthoredSystemRuntime(WorldheartSystemDefinition);
  assert.equal(Runtime.finale.isCampaignFinale, true);
  assert.equal(Runtime.finale.victoryDelaySeconds, 3.4);
  assert.equal(Runtime.finale.pulseColor, 0xffe0a0);
});

test('runtime creation isolates mutable play state from authored content', () => {
  const FirstRuntime = createAuthoredSystemRuntime(FirstLightSystemDefinition);
  const SecondRuntime = createAuthoredSystemRuntime(FirstLightSystemDefinition);

  FirstRuntime.worlds.find((WorldDefinition) => WorldDefinition.id === 'grove').restored = true;
  FirstRuntime.stardust[0].collected = true;
  FirstRuntime.routeSuggestions.meadow.reverse();
  FirstRuntime.constellation.nodes[0].x = 999;

  assert.equal(
    SecondRuntime.worlds.find((WorldDefinition) => WorldDefinition.id === 'grove').restored,
    false,
  );
  assert.equal(SecondRuntime.stardust[0].collected, false);
  assert.deepEqual(SecondRuntime.routeSuggestions.meadow, ['grove', 'ember']);
  assert.equal(SecondRuntime.constellation.nodes[0].x, 24);
  assert.equal(FirstLightSystemDefinition.worlds[2].initiallyRestored, false);
});

test('moving Seedstones preserve isolated deterministic orbit data', () => {
  const MovingSystemDefinition = structuredClone(FirstLightSystemDefinition);
  const AuthoredSeedstone = MovingSystemDefinition.tacticalBodies.find(
    (BodyDefinition) => BodyDefinition.kind === 'seedstone',
  );
  AuthoredSeedstone.orbit = {
    centre: { x: 0.7, y: 1.1, z: 0 },
    radius: 2.4,
    phaseRadians: -0.4,
    angularSpeedRadiansPerSecond: 0.22,
  };

  assert.deepEqual(validateAuthoredSystemDefinition(MovingSystemDefinition), []);
  const Runtime = createAuthoredSystemRuntime(MovingSystemDefinition);
  const RuntimeSeedstone = Runtime.tacticalBodies.find(
    (BodyDefinition) => BodyDefinition.kind === 'seedstone',
  );
  RuntimeSeedstone.orbit.centre.x = 999;

  assert.equal(AuthoredSeedstone.orbit.centre.x, 0.7);
});

test('content validation rejects malformed moving launch-node orbits', () => {
  const InvalidSystemDefinition = structuredClone(FirstLightSystemDefinition);
  const SeedstoneDefinition = InvalidSystemDefinition.tacticalBodies.find(
    (BodyDefinition) => BodyDefinition.kind === 'seedstone',
  );
  SeedstoneDefinition.orbit = {
    centre: { x: 0, y: 0, z: 0 },
    radius: 0,
    phaseRadians: 0,
    angularSpeedRadiansPerSecond: 0.2,
  };

  assert.ok(validateAuthoredSystemDefinition(InvalidSystemDefinition).includes(
    'Tactical body seedstone has an invalid deterministic orbit.',
  ));
});

test('content validation rejects malformed authored environment palettes', () => {
  const InvalidSystemDefinition = structuredClone(LongNightSystemDefinition);
  InvalidSystemDefinition.environment.rimLightColor = -1;
  InvalidSystemDefinition.environment.fogDensity = 0.2;

  const Errors = validateAuthoredSystemDefinition(InvalidSystemDefinition);
  assert.ok(Errors.includes(
    'Authored system environment.rimLightColor requires a colour integer.',
  ));
  assert.ok(Errors.includes('Authored system environment has invalid fog or exposure ranges.'));
});

test('system selection falls back to the authored campaign entry', () => {
  assert.equal(DefaultAuthoredSystemIdentifier, 'breaker-reach');
  assert.equal(getAuthoredSystemDefinition('first-light'), FirstLightSystemDefinition);
  assert.equal(getAuthoredSystemDefinition('broken-belt'), BrokenBeltSystemDefinition);
  assert.equal(
    getAuthoredSystemDefinition('wandering-garden'),
    WanderingGardenSystemDefinition,
  );
  assert.equal(getAuthoredSystemDefinition('long-night'), LongNightSystemDefinition);
  assert.equal(getAuthoredSystemDefinition('worldheart'), WorldheartSystemDefinition);
  assert.equal(getAuthoredSystemDefinition('missing-system'), BreakerReachSystemDefinition);
});

test('campaign order advances through Long Night into the Worldheart finale', () => {
  assert.deepEqual(
    AuthoredCampaignSystemIdentifiers,
    ['breaker-reach', 'broken-belt', 'wandering-garden', 'long-night', 'worldheart'],
  );
  assert.equal(getNextAuthoredSystemIdentifier('breaker-reach'), 'broken-belt');
  assert.equal(getNextAuthoredSystemIdentifier('broken-belt'), 'wandering-garden');
  assert.equal(getNextAuthoredSystemIdentifier('wandering-garden'), 'long-night');
  assert.equal(getNextAuthoredSystemIdentifier('long-night'), 'worldheart');
  assert.equal(getNextAuthoredSystemIdentifier('worldheart'), null);
  assert.equal(getNextAuthoredSystemIdentifier('missing-system'), null);
});

test('Worldheart opens with two commitments and keeps its moving moon optional', () => {
  const Runtime = createAuthoredSystemRuntime(WorldheartSystemDefinition);
  const CampaignNodes = [
    ...Runtime.worlds,
    ...Runtime.tacticalBodies.filter((BodyDefinition) => BodyDefinition.kind !== 'hazard'),
  ];

  assert.deepEqual(
    getRouteChoices(CampaignNodes, 'confluence', 2, Runtime.routeSuggestions.confluence)
      .map((WorldDefinition) => WorldDefinition.id),
    ['memory', 'kindle'],
  );
  Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'memory').restored = true;
  assert.deepEqual(
    getRouteChoices(CampaignNodes, 'memory', 2, Runtime.routeSuggestions.memory)
      .map((WorldDefinition) => WorldDefinition.id),
    ['memory-moon', 'chorus'],
  );
});

test('Long Night route order preserves a safe line and a higher-gravity commitment', () => {
  const Runtime = createAuthoredSystemRuntime(LongNightSystemDefinition);
  const CampaignNodes = [
    ...Runtime.worlds,
    ...Runtime.tacticalBodies.filter((BodyDefinition) => BodyDefinition.kind !== 'hazard'),
  ];

  assert.deepEqual(
    getRouteChoices(CampaignNodes, 'vigil', 2, Runtime.routeSuggestions.vigil)
      .map((WorldDefinition) => WorldDefinition.id),
    ['hollow', 'pyre'],
  );
  Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'hollow').restored = true;
  assert.deepEqual(
    getRouteChoices(CampaignNodes, 'hollow', 2, Runtime.routeSuggestions.hollow)
      .map((WorldDefinition) => WorldDefinition.id),
    ['umbra', 'beacon'],
  );
});

test('Wandering Garden makes its moving moon a genuine authored route choice', () => {
  const Runtime = createAuthoredSystemRuntime(WanderingGardenSystemDefinition);
  const CampaignNodes = [
    ...Runtime.worlds,
    ...Runtime.tacticalBodies.filter((BodyDefinition) => BodyDefinition.kind !== 'hazard'),
  ];
  Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'canopy').restored = true;

  assert.deepEqual(
    getRouteChoices(CampaignNodes, 'canopy', 2, Runtime.routeSuggestions.canopy)
      .map((WorldDefinition) => WorldDefinition.id),
    ['pollen-moon', 'crown'],
  );
  assert.deepEqual(
    getRouteChoices(CampaignNodes, 'pollen-moon', 2, Runtime.routeSuggestions['pollen-moon'])
      .map((WorldDefinition) => WorldDefinition.id),
    ['crown', 'dew'],
  );
});

test('Broken Belt landing order exposes distinct authored continuations', () => {
  const Runtime = createAuthoredSystemRuntime(BrokenBeltSystemDefinition);
  const CampaignNodes = [
    ...Runtime.worlds,
    ...Runtime.tacticalBodies.filter((BodyDefinition) => BodyDefinition.kind !== 'hazard'),
  ];

  assert.deepEqual(
    getRouteChoices(CampaignNodes, 'relay', 2, Runtime.routeSuggestions.relay)
      .map((WorldDefinition) => WorldDefinition.id),
    ['loom', 'kiln'],
  );
  Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'loom').restored = true;
  assert.deepEqual(
    getRouteChoices(CampaignNodes, 'loom', 2, Runtime.routeSuggestions.loom)
      .map((WorldDefinition) => WorldDefinition.id),
    ['drift', 'shard'],
  );

  const KilnFirstRuntime = createAuthoredSystemRuntime(BrokenBeltSystemDefinition);
  const KilnFirstNodes = [
    ...KilnFirstRuntime.worlds,
    ...KilnFirstRuntime.tacticalBodies.filter((BodyDefinition) => BodyDefinition.kind !== 'hazard'),
  ];
  KilnFirstRuntime.worlds.find((WorldDefinition) => WorldDefinition.id === 'kiln').restored = true;
  assert.deepEqual(
    getRouteChoices(KilnFirstNodes, 'kiln', 2, KilnFirstRuntime.routeSuggestions.kiln)
      .map((WorldDefinition) => WorldDefinition.id),
    ['drift', 'loom'],
  );
});

test('authored route suggestions preserve First Light choices and spatial fallback', () => {
  const Runtime = createAuthoredSystemRuntime(FirstLightSystemDefinition);
  const WorldheartDefinition = Runtime.tacticalBodies.find(
    (BodyDefinition) => BodyDefinition.kind === 'worldheart',
  );
  const CampaignNodes = [
    ...Runtime.worlds,
    ...Runtime.tacticalBodies.filter((BodyDefinition) => BodyDefinition.kind !== 'hazard'),
  ];

  assert.deepEqual(
    getRouteChoices(
      CampaignNodes,
      'meadow',
      2,
      Runtime.routeSuggestions.meadow,
    ).map((WorldDefinition) => WorldDefinition.id),
    ['grove', 'ember'],
  );

  Runtime.worlds.find((WorldDefinition) => WorldDefinition.id === 'grove').restored = true;
  assert.deepEqual(
    getRouteChoices(
      CampaignNodes,
      'grove',
      2,
      Runtime.routeSuggestions.grove,
    ).map((WorldDefinition) => WorldDefinition.id),
    ['frost', 'ember'],
  );

  WorldheartDefinition.routeAvailable = true;
  assert.equal(
    getRouteChoices(
      CampaignNodes,
      'frost',
      2,
      Runtime.routeSuggestions.frost,
    )[0].id,
    'worldheart',
  );
});

test('content validation rejects broken references and incomplete restoration data', () => {
  const InvalidSystemDefinition = structuredClone(FirstLightSystemDefinition);
  InvalidSystemDefinition.routeSuggestions.meadow[0] = 'missing-world';
  InvalidSystemDefinition.worlds[1].restoration.waveWidth = undefined;
  InvalidSystemDefinition.worlds[2].id = 'ember';
  InvalidSystemDefinition.constellation.nodes.push({
    ...InvalidSystemDefinition.constellation.nodes[0],
  });

  const Errors = validateAuthoredSystemDefinition(InvalidSystemDefinition);
  assert.ok(Errors.includes('Duplicate authored identifier: ember.'));
  assert.ok(Errors.includes('Route target missing-world does not exist.'));
  assert.ok(Errors.includes('World ember restoration.waveWidth is required.'));
  assert.ok(Errors.includes('Duplicate constellation node: meadow.'));
});

test('content validation rejects broken or empty route guidance', () => {
  const InvalidSystemDefinition = structuredClone(BreakerReachSystemDefinition);
  InvalidSystemDefinition.routeGuidance.grove['missing-world'] = 'Take the long arc.';
  InvalidSystemDefinition.routeGuidance.grove.meadow = '   ';
  InvalidSystemDefinition.routeGuidance.ember = {};
  const InvalidShapeSystemDefinition = structuredClone(BreakerReachSystemDefinition);
  InvalidShapeSystemDefinition.routeGuidance = [];

  const Errors = validateAuthoredSystemDefinition(InvalidSystemDefinition);
  assert.ok(Errors.includes('Route guidance target missing-world does not exist.'));
  assert.ok(Errors.includes('Route guidance grove to meadow requires non-empty copy.'));
  assert.ok(Errors.includes('Route guidance source ember requires target guidance.'));
  assert.ok(validateAuthoredSystemDefinition(InvalidShapeSystemDefinition).includes(
    'Authored routeGuidance must be an object when present.',
  ));
});

test('content validation fails closed on an unplayable opening or body set', () => {
  const InvalidSystemDefinition = structuredClone(FirstLightSystemDefinition);
  InvalidSystemDefinition.routeSuggestions.meadow = ['ember'];
  InvalidSystemDefinition.tacticalBodies = InvalidSystemDefinition.tacticalBodies.filter(
    (BodyDefinition) => BodyDefinition.kind !== 'hazard',
  );
  InvalidSystemDefinition.worlds[0].restoration.atmosphereOpacity = 1.2;
  InvalidSystemDefinition.constellation.nodes = InvalidSystemDefinition.constellation.nodes.filter(
    (NodeDefinition) => NodeDefinition.id !== 'ember',
  );

  const Errors = validateAuthoredSystemDefinition(InvalidSystemDefinition);
  assert.ok(Errors.includes('The starting world requires at least two authored route suggestions.'));
  assert.ok(Errors.includes(
    'Current authored-system runtime requires exactly one deterministic hazard.',
  ));
  assert.ok(Errors.includes('World meadow has invalid restoration ranges.'));
  assert.ok(Errors.includes('Constellation is missing node ember.'));
});
