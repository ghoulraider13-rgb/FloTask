import useBackButton from '../hooks/useBackButton';

/**
 * Bottom tab bar — the mobile primary navigation. Same visual language
 * as the desktop layout: Nothing-OS monochrome pills, active = white.
 * Full-height touch targets (48px+); safe-area-inset-bottom padding
 * keeps it above the iPhone home indicator / Android gesture bar.
 *
 * `disableBackGuard`: while an unclosable overlay (The Enforcer) is
 * open, the guard history entry must be preserved — the modal manages
 * it, so the tab bar hides instead of touching history.
 */
export default function BottomTabBar({ tabs, active, onChange, disabled = false }) {
  useBackButton(!disabled, null, { unclosable: true });

  if (disabled) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-surface-5 bg-surface-0/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-around px-1">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 flex-1 min-h-[52px] py-1.5 transition-all duration-200 ${
                isActive
                  ? 'text-ink-primary'
                  : 'text-ink-soft hover:text-ink-secondary'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-black'
                    : 'bg-transparent'
                }`}
                style={{ width: 32, height: 32, borderRadius: 10 }}
              >
                {tab.icon}
              </span>
              <span className="text-3xs font-bold tracking-caption uppercase">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
