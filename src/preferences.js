export const MotionPreferences = Object.freeze({
  system: 'system',
  reduced: 'reduced',
  full: 'full',
});

/** Fails closed to the operating-system preference when stored data is unknown. */
export function parseMotionPreference(StoredPreference) {
  return Object.values(MotionPreferences).includes(StoredPreference)
    ? StoredPreference
    : MotionPreferences.system;
}

/** Resolves the effective animation mode without changing simulation or scoring. */
export function resolveReducedMotion(MotionPreference, SystemPrefersReducedMotion) {
  if (MotionPreference === MotionPreferences.reduced) return true;
  if (MotionPreference === MotionPreferences.full) return false;
  return Boolean(SystemPrefersReducedMotion);
}

/** Cycles System → Reduced → Full so the OS default remains recoverable. */
export function cycleMotionPreference(MotionPreference) {
  if (MotionPreference === MotionPreferences.system) return MotionPreferences.reduced;
  if (MotionPreference === MotionPreferences.reduced) return MotionPreferences.full;
  return MotionPreferences.system;
}

/** Produces concise visible and assistive copy for the three-state control. */
export function getMotionPreferencePresentation(MotionPreference, EffectiveReducedMotion) {
  if (MotionPreference === MotionPreferences.reduced) {
    return { label: 'Motion reduced [P]', ariaPressed: 'true' };
  }
  if (MotionPreference === MotionPreferences.full) {
    return { label: 'Motion full [P]', ariaPressed: 'false' };
  }
  return {
    label: `Motion system${EffectiveReducedMotion ? ' · reduced' : ''} [P]`,
    ariaPressed: 'mixed',
  };
}
