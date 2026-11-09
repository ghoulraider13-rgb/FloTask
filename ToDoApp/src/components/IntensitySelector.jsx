import { INTENSITY_LEVELS } from '../utils/taskHelpers';

const LABELS = { low: 'L', medium: 'M', high: 'H' };
const COLORS_ACTIVE = {
  low: 'bg-surface-4 text-white border-surface-5',
  medium: 'bg-surface-5 text-white border-ink-soft',
  high: 'bg-accent-red text-white border-accent-red',
};

export default function IntensitySelector({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {INTENSITY_LEVELS.map((level) => {
        const active = value === level;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={`
              w-7 h-7 rounded-full text-2xs font-bold transition-all duration-200 border
              flex items-center justify-center
              ${active
                ? COLORS_ACTIVE[level]
                : 'bg-transparent text-ink-faint border-surface-4 hover:border-surface-5 hover:text-ink-tertiary'
              }
            `}
            title={level === 'high' ? 'The Enforcer – requires CAPTCHA to dismiss' : level}
          >
            {LABELS[level]}
          </button>
        );
      })}
    </div>
  );
}
