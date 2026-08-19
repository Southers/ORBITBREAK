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
    return { label: 'Reduced motion on [P]', ariaPressed: 'true' };
  }
  if (MotionPreference === MotionPreferences.full) {
    return { label: 'Reduced motion off [P]', ariaPressed: 'false' };
  }
  return {
    label: `Reduced motion${EffectiveReducedMotion ? ' · system on' : ' · system off'} [P]`,
    ariaPressed: 'mixed',
  };
}

/** Produces one visible, pressed and announced state for audio button and shortcut use. */
export function getAudioPreferencePresentation(IsMuted) {
  if (typeof IsMuted !== 'boolean') {
    throw new Error('Audio preference presentation requires muted state.');
  }
  return {
    label: IsMuted ? 'Audio off [M]' : 'Audio on [M]',
    ariaPressed: String(IsMuted),
    status: IsMuted ? 'AUDIO OFF' : 'AUDIO ON',
  };
}
