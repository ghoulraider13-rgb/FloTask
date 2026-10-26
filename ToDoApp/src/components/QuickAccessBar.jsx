import { useState, useEffect, useRef } from 'react';

/**
 * QuickAccessBar — Desktop-only sticky top bar with section navigation.
 * Sections: Tasks, Notes, Focus, Alarms, Hydration, Sleep
 * Features:
 * - Smooth scroll to sections (honors prefers-reduced-motion)
 * - Scroll-spy highlights active section (IntersectionObserver)
 * - Dropdown/sheet on narrow screens
 * - NOT rendered on mobile (handled by MobileShell bottom tabs)
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
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

export default function QuickAccessBar({ activeSection, onSectionClick }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const barRef = useRef(null);

  // Scroll-spy: detect active section via IntersectionObserver
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onSectionClick(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0.1 }
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [onSectionClick]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSectionClick = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    }
    onSectionClick(id);
    setIsDropdownOpen(false);
  };

  // Don't render on mobile (handled by MobileShell)
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
  if (isMobile) return null;

  return (
    <>
      <header
        ref={barRef}
        className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-gray-900"
        style={{ height: '56px' }}
        role="navigation"
        aria-label="Quick access"
      >
        <div className="flex items-center justify-between h-full px-4 sm:px-6 lg:px-8 max-w-[1480px] mx-auto">
          {/* FLOTASK Wordmark */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-[0.35em] text-white uppercase font-mono">
              FLOTASK
            </span>
          </div>

          {/* Quick Access Menu — Desktop */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Section navigation">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => handleSectionClick(section.id)}
                aria-current={activeSection === section.id ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-[0.2em] uppercase font-mono transition-all duration-200 ${
                  activeSection === section.id
                    ? 'text-white bg-white/10'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                {icon(section.icon)}
                <span>{section.label}</span>
              </button>
            ))}
          </nav>

          {/* Mobile Dropdown Trigger (tablet breakpoint) */}
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              aria-expanded={isDropdownOpen}
              aria-haspopup="listbox"
              className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Dropdown Sheet */}
            {isDropdownOpen && (
              <div
                ref={dropdownRef}
                className="absolute right-4 top-full mt-2 w-48 bg-black/95 backdrop-blur-xl border border-gray-800 rounded-xl shadow-2xl py-2 z-50 animate-fade-in"
                role="listbox"
              >
                {SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSectionClick(section.id)}
                    aria-selected={activeSection === section.id}
                    role="option"
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-mono transition-colors ${
                      activeSection === section.id
                        ? 'text-white bg-white/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center">{icon(section.icon)}</span>
                    <span className="uppercase tracking-wide">{section.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Spacer to offset fixed header */}
      <div className="h-14 md:h-0" aria-hidden="true" />
    </>
  );
}