/**
 * Pure authored-system data and validation.
 *
 * Runtime factories inject vectors and colours so this module stays testable without WebGL.
 * Mutable play state is always cloned from these definitions.
 */

export {
  validateAuthoredSystemDefinition,
  assertValidAuthoredSystemDefinition,
} from './content/schema.js';
export { createAuthoredSystemRuntime } from './content/runtime.js';
export { FirstLightSystemDefinition } from './content/systems/first-light.js';
export { BreakerReachSystemDefinition } from './content/systems/breaker-reach.js';
export { BrokenBeltSystemDefinition } from './content/systems/broken-belt.js';
export { WanderingGardenSystemDefinition } from './content/systems/wandering-garden.js';
export { LongNightSystemDefinition } from './content/systems/long-night.js';
export { WorldheartSystemDefinition } from './content/systems/worldheart.js';

import { FirstLightSystemDefinition } from './content/systems/first-light.js';
import { BreakerReachSystemDefinition } from './content/systems/breaker-reach.js';
import { BrokenBeltSystemDefinition } from './content/systems/broken-belt.js';
import { WanderingGardenSystemDefinition } from './content/systems/wandering-garden.js';
import { LongNightSystemDefinition } from './content/systems/long-night.js';
import { WorldheartSystemDefinition } from './content/systems/worldheart.js';

export const DefaultAuthoredSystemIdentifier = BreakerReachSystemDefinition.id;

export const AuthoredSystemDefinitions = {
  [BreakerReachSystemDefinition.id]: BreakerReachSystemDefinition,
  [FirstLightSystemDefinition.id]: FirstLightSystemDefinition,
  [BrokenBeltSystemDefinition.id]: BrokenBeltSystemDefinition,
  [WanderingGardenSystemDefinition.id]: WanderingGardenSystemDefinition,
  [LongNightSystemDefinition.id]: LongNightSystemDefinition,
  [WorldheartSystemDefinition.id]: WorldheartSystemDefinition,
};

export const AuthoredCampaignSystemIdentifiers = [
  BreakerReachSystemDefinition.id,
  BrokenBeltSystemDefinition.id,
  WanderingGardenSystemDefinition.id,
];

/** Resolves a requested authored system and safely falls back to the campaign entry. */
export function getAuthoredSystemDefinition(SystemIdentifier) {
  return AuthoredSystemDefinitions[SystemIdentifier]
    ?? AuthoredSystemDefinitions[DefaultAuthoredSystemIdentifier];
}

/** Returns the next authored chapter, or null when the current campaign frontier is reached. */
export function getNextAuthoredSystemIdentifier(SystemIdentifier) {
  const CurrentSystemIndex = AuthoredCampaignSystemIdentifiers.indexOf(SystemIdentifier);
  return CurrentSystemIndex >= 0
    ? AuthoredCampaignSystemIdentifiers[CurrentSystemIndex + 1] ?? null
    : null;
}
