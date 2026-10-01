import { useState, useEffect } from 'react';

const QUERY = '(max-width: 640px)';

/**
 * True at phone widths (≤640px) — switches App between the mobile shell
 * (bottom tab bar + swipe carousel) and the desktop layout. The SAME
 * components render in both; this only changes the container, so the UI
 * is never forked. Tablet/desktop widths (≥641px) keep the existing
 * three-column layout untouched.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
