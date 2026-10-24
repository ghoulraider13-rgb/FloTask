/**
 * WheelPicker — iOS/stock-clock style scroll-wheel column.
 * Pure CSS scroll-snap (no library): items snap to center, the selected
 * item is read from the snapped index on scroll-settle.
 * Transform/opacity only in the visual effect (60fps, reduced-motion safe).
 */
import { useEffect, useRef, useState } from 'react';

const ITEM_H = 40; // px per row — matches .wheel-item

export default function WheelPicker({ items, value, onChange, label }) {
  const scrollerRef = useRef(null);
  const settleRef = useRef(null);
  const [activeIdx, setActive] = useState(() => Math.max(0, items.indexOf(value)));

  // External value changes (e.g. sheet re-open) re-sync the wheel
  useEffect(() => {
    const idx = Math.max(0, items.indexOf(value));
    setActive(idx);
    const el = scrollerRef.current;
    if (el && el.scrollTop !== idx * ITEM_H) {
      el.scrollTop = idx * ITEM_H;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => {
      const idx = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      if (idx !== activeIdx) {
        setActive(idx);
        onChange?.(items[idx]);
      }
    }, 90); // settle window after the wheel stops
  };

  return (
    <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
      {label && (
        <span className="text-[11px] font-bold text-gray-500 tracking-[0.2em] uppercase">{label}</span>
      )}
      <div className="relative w-full">
        {/* Selection band — the clock app's highlighted row */}
        <div
          className="absolute left-2 right-2 pointer-events-none rounded-lg bg-surface-4/70 border border-surface-5"
          style={{ top: (Math.floor(ITEM_H * 2 / ITEM_H) - 1) * 0 + 2 * ITEM_H, height: ITEM_H }}
        />
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="wheel-scroller overflow-y-auto snap-y snap-mandatory no-scrollbar"
          style={{ height: ITEM_H * 5 }}
        >
          {/* 2 spacer rows so the first/last items can reach the center */}
          <div style={{ height: ITEM_H * 2 }} />
          {items.map((item, i) => (
            <button
              key={`${item}-${i}`}
              type="button"
              onClick={() => {
                const el = scrollerRef.current;
                if (el) el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
                setActive(i);
                onChange?.(item);
              }}
              className={`wheel-item snap-center w-full flex items-center justify-center font-dotmatrix transition-all duration-150 ${
                i === activeIdx
                  ? 'text-white text-xl font-bold'
                  : 'text-gray-600 text-lg'
              }`}
              style={{ height: ITEM_H }}
            >
              {item}
            </button>
          ))}
          <div style={{ height: ITEM_H * 2 }} />
        </div>
      </div>
    </div>
  );
}
