import { INTENSITY_LEVELS } from '../utils/taskHelpers';

const LABELS = { low: 'L', medium: 'M', high: 'H' };
const COLORS_ACTIVE = {
  low: 'bg-gray-600 text-white border-gray-500',
  medium: 'bg-gray-500 text-white border-gray-400',
  high: 'bg-red-500 text-white border-red-400',
};

export default function IntensitySelector({ value, onChange, compact = false }) {
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
              w-7 h-7 rounded-full text-[11px] font-bold transition-all duration-200 border
              flex items-center justify-center
              ${active
                ? COLORS_ACTIVE[level]
                : 'bg-transparent text-gray-600 border-gray-700 hover:border-gray-500 hover:text-gray-400'
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
