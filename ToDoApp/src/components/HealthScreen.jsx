import { useState } from 'react';
import HydrationTracker from './HydrationTracker';
import SleepTracker from './SleepTracker';

/**
 * HealthScreen — Mobile combined Hydration + Sleep with segmented control.
 * Matches the requirement: "Health (Hydration + Sleep as a segmented control)"
 */
const SEGMENTS = [
  { id: 'hydration', label: 'HYDRATION', icon: 'M12 2.66l.66.66c2.34 2.3 6.34 5.87 6.34 8.68 0 3.32-2.68 6-6 6s-6-2.68-6-6c0-2.81 4-6.38 6-8.68l.66-.66z' },
  { id: 'sleep', label: 'SLEEP', icon: 'M20.354 7.354A9 9 0 0116.646 3.354 9.003 9.003 0 0012 21a9 9 0 008.354-5.646z' },
];

const icon = (path) => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

export default function HealthScreen() {
  const [activeSegment, setActiveSegment] = useState('hydration');

  return (
    <div className="flex flex-col h-full">
      {/* Segmented Control Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-900 bg-black/50 backdrop-blur-sm">
        <h2 className="text-xs font-bold tracking-widest uppercase text-gray-500 font-mono">
          HEALTH
        </h2>
        <div
          className="flex items-center gap-1 p-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          role="tablist"
          aria-label="Health modules"
        >
          {SEGMENTS.map((segment) => (
            <button
              key={segment.id}
              type="button"
              role="tab"
              aria-selected={activeSegment === segment.id}
              onClick={() => setActiveSegment(segment.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold tracking-wider uppercase font-mono transition-all duration-200 ${
                activeSegment === segment.id
                  ? 'text-black bg-white shadow-sm'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {icon(segment.icon)}
              <span>{segment.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Panels */}
      <div className="flex-1 overflow-y-auto">
        {activeSegment === 'hydration' && <HydrationTracker />}
        {activeSegment === 'sleep' && <SleepTracker />}
      </div>
    </div>
  );
}