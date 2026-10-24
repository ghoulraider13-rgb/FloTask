/**
 * Platform detection — thin wrapper around Capacitor.isNativePlatform().
 *
 * Import this instead of @capacitor/core directly so:
 *  1. The web build doesn't crash if Capacitor isn't loaded.
 *  2. There's a single place to mock in tests.
 */

let _isNative = null;

/** Returns true when running inside a Capacitor native shell (Android/iOS). */
export function isNativePlatform() {
  if (_isNative !== null) return _isNative;
  try {
    // Capacitor injects window.Capacitor at runtime in native shells.
    // eslint-disable-next-line no-undef
    _isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform());
  } catch {
    _isNative = false;
  }
  return _isNative;
}

/**
 * Returns the base URL for API calls.
 *
 * - Web (same origin):  '' → relative /api/chat works
 * - Capacitor native:   VITE_API_BASE env var (set at build time)
 *                        Defaults to 'https://flo-task.vercel.app'
 *
 * The VITE_API_BASE env is only needed when building for Capacitor, so the
 * web/Vercel deployment doesn't need it at all.
 */
export function getApiBase() {
  if (isNativePlatform()) {
    return import.meta.env.VITE_API_BASE || 'https://flo-task.vercel.app';
  }
  return '';  // same-origin
}
