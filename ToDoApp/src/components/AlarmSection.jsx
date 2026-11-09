import { useState } from 'react';
import IntensitySelector from './IntensitySelector';
import { createAlarm, toLocalInputValue } from '../utils/taskHelpers';
import { playMechanicalClick } from '../utils/audioHelpers';

export default function AlarmsHub({ alarms, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [intensity, setIntensity] = useState('medium');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const handleAdd = (e) => {
    e.preventDefault();
    if (!dateTime) return;
    playMechanicalClick();
    onAdd(createAlarm(label, new Date(dateTime).toISOString(), intensity));
    setLabel('');
    setDateTime('');
    setIntensity('medium');
    setShowForm(false);
  };

  const minDateTime = toLocalInputValue(new Date(Date.now() - 60000));
  const activeAlarms = alarms.filter((a) => !a.fired);

  const formatAlarmTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
  };

  const formatAlarmDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const intensityColor = {
    low: 'border-surface-4',
    medium: 'border-surface-5',
    high: 'border-accent-red/50',
  };

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handleDateSelect = (day) => {
    playMechanicalClick();
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    d.setHours(9, 0, 0, 0);
    setDateTime(toLocalInputValue(d));
    if (!showForm) setShowForm(true);
  };

  const calendarDays = [];
  const startDay = getFirstDayOfMonth(currentMonth);
  const daysInMonth = getDaysInMonth(currentMonth);

  for (let i = 0; i < startDay; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="w-6 h-6" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d).toDateString();
    calendarDays.push(
      <button
        key={`day-${d}`}
        onClick={() => handleDateSelect(d)}
        className={`w-6 h-6 flex items-center justify-center text-3xs rounded-full transition-all font-mono hover:bg-surface-4 ${
          isToday ? 'bg-white text-black font-bold' : 'text-ink-muted'
        }`}
      >
        {d}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-2xs font-bold text-ink-soft tracking-label uppercase self-start">ALARMS</h3>
      </div>

      {/* Alarm pills list */}
      <div className="flex flex-col gap-3 pb-1 w-full lg:max-w-[280px]">
        {activeAlarms.map((alarm) => (
          <div
            key={alarm.id}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-full bg-surface-3 border ${intensityColor[alarm.intensity]} flex-shrink-0 group ${alarm.isAgentCreated ? 'animate-agent-pulse' : ''}`}
          >
            {/* Intensity dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              alarm.intensity === 'high' ? 'bg-accent-red animate-pulse-slow' :
              alarm.intensity === 'medium' ? 'bg-ink-muted' : 'bg-ink-faint'
            }`} />

            {/* Time */}
            <span className="text-sm font-bold text-white font-dotmatrix tracking-time">
              {formatAlarmTime(alarm.dateTime)}
            </span>

            {/* Label and Date */}
            <span className="text-3xs text-ink-soft font-dotmatrix uppercase truncate max-w-[150px] flex items-baseline ml-auto">
              {alarm.label && alarm.label !== 'Alarm' ? alarm.label : ''}
              <span className="text-3xs opacity-60 ml-2 font-mono tracking-widest">- {formatAlarmDate(alarm.dateTime)}</span>
            </span>

            {/* Custom Toggle Symbol */}
            <span className="text-white text-3xs tracking-widest pl-1.5 font-dotmatrix">⏽</span>

            {/* Delete — always visible (mobile has no hover) */}
            <button
              onClick={() => { playMechanicalClick(); onDelete(alarm.id); }}
              className="text-ink-faint hover:text-accent-red transition-all ml-1 p-1"
              title="Remove"
              aria-label="Remove alarm"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-1">
        {/* Add button */}
        <button
          onClick={() => { playMechanicalClick(); setShowForm(!showForm); }}
          className={`px-4 py-2 text-xs font-dotmatrix tracking-wider rounded-full border border-surface-4 flex items-center gap-2 transition-all duration-200 ${
            showForm
              ? 'bg-white text-black border-white'
              : 'bg-transparent text-white hover:border-surface-5 hover:bg-surface-2'
          }`}
          title="Add alarm"
        >
          {showForm ? 'CANCEL' : '+ ADD'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-center gap-3 animate-fade-in">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className="nothing-input-bordered flex-1 min-w-[100px]"
          />
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            min={minDateTime}
            className="nothing-input-bordered"
            required
          />
          <IntensitySelector value={intensity} onChange={setIntensity} compact />
          <button
            type="submit"
            disabled={!dateTime}
            className="btn-pill-primary px-6 py-2 text-3xs disabled:opacity-30 disabled:cursor-not-allowed"
          >
            SET
          </button>
        </form>
      )}

      {/* Mini Calendar */}
      <div className="mt-auto pt-4 border border-surface-5 rounded-xl p-4 bg-surface-deep lg:max-w-[280px]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-white uppercase tracking-widest font-mono">
            {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="text-ink-soft hover:text-white">◀</button>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="text-ink-soft hover:text-white">▶</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <span key={i} className="text-4xs text-ink-faint font-mono tracking-widest">{day}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 place-items-center">
          {calendarDays}
        </div>
      </div>
    </div>
  );
}
