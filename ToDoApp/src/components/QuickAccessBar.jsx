import { useEffect, useRef } from 'react';

/**
 * QuickAccessBar — sticky top navigation at EVERY width (phone → desktop).
 * Sections: Tasks, Notes, Focus, Alarms, Hydration, Sleep
 *
 * - One component, responsive via breakpoints only (no mobile fork):
 *     < md  → wordmark row + horizontally scrollable pill strip
 *     ≥ md  → wordmark and pills share a single row
 * - Smooth scroll to sections (honors prefers-reduced-motion)
 * - Scroll-spy highlights the section in view (IntersectionObserver).
 *   Scroll-spy is not motion, so it stays on under reduced motion.
 * - Respects env(safe-area-inset-top) for notched phones.
 */
const SECTIONS = [
  { id: 'tasks', label: 'TASKS', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'notes', label: 'NOTES', icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.65 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125' },
  { id: 'focus', label: 'FOCUS', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'alarms', label: 'ALARMS', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' },
  { id: 'hydration', label: 'HYDRATION', icon: 'M12 2.66l.66.66c2.34 2.3 6.34 5.87 6.34 8.68 0 3.32-2.68 6-6 6s-6-2.68-6-6c0-2.81 4-6.38 6-8.68l.66-.66z' },
  { id: 'sleep', label: 'SLEEP', icon: 'M20.354 7.354A9 9 0 0116.646 3.354 9.003 9.003 0 0012 21a9 9 0 008.354-5.646z' },
];

const icon = (path) => (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

export default function QuickAccessBar({ activeSection, onSectionClick }) {
  // Scroll-spy: the section crossing the upper band of the viewport wins.
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) onSectionClick(entry.target.id);
        });
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [onSectionClick]);

  // Keep the active pill visible inside the horizontal strip on phones.
  // Scrolls only the strip (never scrollIntoView, which would cancel an
  // in-flight smooth page scroll in Chromium).
  const stripRef = useRef(null);
  useEffect(() => {
    const strip = stripRef.current;
    const pill = strip?.querySelector(`[data-nav-pill="${activeSection}"]`);
    if (!strip || !pill || strip.scrollWidth <= strip.clientWidth) return;
    const target = pill.offsetLeft - (strip.clientWidth - pill.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, target) });
  }, [activeSection]);

  const handleSectionClick = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    }
    onSectionClick(id);
  };

  return (
    <header
      className="quick-access-bar sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-surface-5"
      role="navigation"
      aria-label="Quick access"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between md:h-14 px-4 sm:px-6 lg:px-8 max-w-shell mx-auto">
        {/* FLOTASK Wordmark */}
        <div className="flex items-center justify-center md:justify-start h-12 md:h-auto">
          <span className="text-xl md:text-2xl font-bold tracking-hero text-ink-primary uppercase font-mono">
            FLOTASK
          </span>
        </div>

        {/* Section pills — scrollable strip on phones, inline row on desktop */}
        <nav
          ref={stripRef}
          className="nav-strip relative flex items-center gap-1 overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 pb-2 md:mx-0 md:px-0 md:pb-0 md:overflow-visible"
          aria-label="Section navigation"
        >
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              data-nav-pill={section.id}
              onClick={() => handleSectionClick(section.id)}
              aria-current={activeSection === section.id ? 'true' : undefined}
              className={`flex shrink-0 items-center gap-1.5 px-3 min-h-[44px] md:min-h-0 md:py-1.5 rounded-full text-2xs font-bold tracking-caption uppercase font-mono transition-all duration-200 ${
                activeSection === section.id
                  ? 'text-ink-primary bg-white/10'
                  : 'text-ink-soft hover:text-ink-primary hover:bg-white/5'
              }`}
            >
              {icon(section.icon)}
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}