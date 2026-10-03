/**
 * AlarmBottomSheet — vaul drawer: scroll-wheel time picker (hour/minute),
 * label, repeat days, optional date, intensity. Replaces the inline form +
 * mini calendar on mobile (the calendar was clipped by the tab bar).
 * The tab carousel cannot drag inside the sheet: vaul owns pointer/touch
 * gestures while open, and Embla's watchDrag guard ignores nothing here —
 * the sheet renders in a portal OUTSIDE the carousel viewport.
 */
import { useState, useMemo } from 'react';
import { Drawer } from 'vaul';
import WheelPicker from './WheelPicker';
import IntensitySelector from './IntensitySelector';
import { createAlarm, toLocalInputValue } from '../utils/taskHelpers';
import { playMechanicalClick } from '../utils/audioHelpers';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const AMPM = ['AM', 'PM'];
const DAYS = [
  { key: 'sun', label: 'S' }, { key: 'mon', label: 'M' }, { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' }, { key: 'thu', label: 'T' }, { key: 'fri', label: 'F' }, { key: 'sat', label: 'S' },
];

export default function AlarmBottomSheet({ open, onOpenChange, onAdd }) {
  const [hour, setHour] = useState('06');
  const [minute, setMinute] = useState('00');
  const [ampm, setAmpm] = useState('AM');
  const [label, setLabel] = useState('');
  const [repeatDays, setRepeatDays] = useState([]);
  const [useDate, setUseDate] = useState(false);
  const [date, setDate] = useState('');
  const [intensity, setIntensity] = useState('medium');

  const dateMin = useMemo(() => toLocalInputValue(new Date()), []);

  const toggleDay = (key) => {
    playMechanicalClick();
    setRepeatDays((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));
  };

  const to24h = () => {
    let h = parseInt(hour, 10) % 12;
    if (ampm === 'PM') h += 12;
    return String(h).padStart(2, '0');
  };

  const handleSet = () => {
    playMechanicalClick();
    const h24 = to24h();
    let iso;
    if (useDate && date) {
      const d = new Date(date);
      d.setHours(parseInt(h24, 10), parseInt(minute, 10), 0, 0);
      iso = d.toISOString();
    } else {
      // Recurring alarm: next occurrence of this wall-clock time.
      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h24, 10), parseInt(minute, 10), 0, 0);
      if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1); // past → tomorrow
      iso = d.toISOString();
    }
    onAdd(createAlarm(label, iso, intensity));
    onOpenChange(false);
    setLabel('');
    setRepeatDays([]);
    setUseDate(false);
    setDate('');
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/70 z-[60]" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-[70] bg-surface-1 border-t border-surface-5 rounded-t-2xl outline-none"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-surface-5" />
          </div>

          <div className="px-5 pb-6 max-w-xl mx-auto w-full">
            <Drawer.Title className="text-sm font-bold text-gray-500 tracking-[0.3em] uppercase">
              NEW ALARM
            </Drawer.Title>

            {/* Wheel pickers */}
            <div className="flex gap-2 mt-3">
              <WheelPicker items={HOURS} value={hour} onChange={setHour} label="HOUR" />
              <WheelPicker items={MINUTES} value={minute} onChange={setMinute} label="MIN" />
              <WheelPicker items={AMPM} value={ampm} onChange={setAmpm} label="" />
            </div>

            {/* Label */}
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Walk dog)"
              className="nothing-input mt-3"
              autoComplete="off"
            />

            {/* Repeat days */}
            <div className="flex items-center justify-between mt-4">
              <span className="text-[11px] font-bold text-gray-500 tracking-[0.2em] uppercase">REPEAT</span>
              <div className="flex gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={`toolbar-btn w-9 h-9 rounded-full text-[11px] font-bold font-mono transition-all border ${
                      repeatDays.includes(d.key)
                        ? 'bg-white text-black border-white'
                        : 'bg-transparent text-gray-500 border-surface-5'
                    }`}
                    aria-pressed={repeatDays.includes(d.key)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional date (one-time alarm on a specific day) */}
            <div className="flex items-center justify-between mt-4 gap-3">
              <button
                type="button"
                onClick={() => { playMechanicalClick(); setUseDate((v) => !v); }}
                className={`toggle-switch ${useDate ? 'active' : ''}`}
                aria-pressed={useDate}
                aria-label="Use a specific date"
              />
              <span className="text-[11px] text-gray-500 font-mono uppercase tracking-wider flex-1">
                Specific date
              </span>
              {useDate && (
                <input
                  type="date"
                  value={date}
                  min={dateMin.slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  className="nothing-input-bordered flex-1"
                />
              )}
            </div>

            {/* Intensity */}
            <div className="flex items-center justify-between mt-4">
              <span className="text-[11px] font-bold text-gray-500 tracking-[0.2em] uppercase">INTENSITY</span>
              <IntensitySelector value={intensity} onChange={setIntensity} compact />
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="btn-pill flex-1 justify-center"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleSet}
                className="btn-pill-primary flex-1 justify-center"
              >
                SET ALARM
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
