/**
 * Haptics helper — Feature 2.
 * Uses the global Capacitor bridge (window.Capacitor.Plugins.Haptics) when
 * running native — no npm package import (a literal import('@capacitor/haptics')
 * fails Rolldown's static resolution in web-only builds even behind a guard).
 * navigator.vibrate([30,40,30]) on the web (Android Chrome); silently skipped
 * where unsupported (iOS Safari has no vibrate API).
 * Global on/off toggle in localStorage ('haptics-enabled', default on).
 */

export const isCapacitorNative = () =>
  typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());

const capacitorHaptics = () => {
  if (!isCapacitorNative()) return null;
  // Capacitor web plugin bridge:Plugins.Haptics.impact({style}) — same API
  // surface as the npm package, resolved at runtime (never bundled).
  return window.Capacitor?.Plugins?.Haptics ?? null;
};

/** Fire the creation haptic: impact(light) natively, [30,40,30] on web.
 * Returns true if a haptic actually fired. */
export async function hapticImpact() {
  if (typeof window === 'undefined') return false;
  try {
    const stored = window.localStorage.getItem('haptics-enabled');
    if (stored === 'false') return false; // user toggle off
  } catch { /* storage unavailable → default on */ }

  const cap = capacitorHaptics();
  if (cap) {
    try {
      await cap.impact({ style: 'LIGHT' });
      return true;
    } catch { /* fall through to web */ }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([30, 40, 30]);
    return true;
  }
  return false; // iOS Safari etc. — silently skipped
}
