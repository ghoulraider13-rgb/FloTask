import { useEffect, useRef } from 'react';

/**
 * Android back-button handling for full-screen overlays (alarm modal,
 * draw tool). While `active`, a history entry is pushed; pressing back
 * pops it and calls `close()` instead of leaving the app. Closing the
 * overlay via its own UI cleans the history entry up automatically.
 *
 * `close: null` + `unclosable: true` = the overlay cannot be dismissed
 * via back at all (The Enforcer: "SYSTEM LOCKED UNTIL SOLVED") — back
 * presses restore the guard instead of navigating away.
 *
 * Note: the app exit itself stays native by design — the web platform
 * does not allow suppressing it outright.
 */
export default function useBackButton(active, close, { unclosable = false } = {}) {
  const closeRef = useRef(close);
  closeRef.current = close;
  const activeRef = useRef(active);
  activeRef.current = active;
  const unclosableRef = useRef(unclosable);
  unclosableRef.current = unclosable;
  const pushedRef = useRef(false);

  useEffect(() => {
    const onPop = () => {
      if (activeRef.current && unclosableRef.current) {
        // Restore the guard so back cannot escape the locked overlay.
        history.pushState({ flotaskBackGuard: true }, '');
        return;
      }
      pushedRef.current = false;
      if (activeRef.current) closeRef.current?.();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (pushedRef.current) {
        pushedRef.current = false;
        history.back();
      }
    };
  }, []);

  useEffect(() => {
    if (active && !pushedRef.current) {
      history.pushState({ flotaskBackGuard: true }, '');
      pushedRef.current = true;
    } else if (!active && pushedRef.current) {
      pushedRef.current = false;
      history.back();
    }
  }, [active]);
}
