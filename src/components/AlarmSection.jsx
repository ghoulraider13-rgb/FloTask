import { useState } from 'react';
import IntensitySelector from './IntensitySelector';
import { createAlarm } from '../utils/taskHelpers';
import { playMechanicalClick } from '../utils/audioHelpers';

export default function AlarmsHub({ alarms, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
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
    setShowCalendar(false);
  };

  const toggleAddPanel = () => {
    playMechanicalClick();
    if (showForm) {
      // Cancel — hide everything
      setShowForm(false);
      setShowCalendar(false);
    } else {
      // Show calendar + form
      setShowCalendar(true);
      setShowForm(true);
    }
  };

  const minDateTime = new Date(Date.now() - 60000).toISOString().slice(0, 16);
  const activeAlarms = alarms.filter((a) => !a.fired);

  const formatAlarmTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatAlarmDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const intensityColor = {
    low: 'border-gray-700',
    medium: 'border-gray-600',
    high: 'border-red-500/50',
  };

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handleDateSelect = (day) => {
    playMechanicalClick();
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    d.setHours(9, 0, 0, 0);
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d - offset)).toISOString().slice(0, 16);
    setDateTime(localISOTime);
    // Auto-close calendar, keep form open for label/intensity
    setShowCalendar(false);
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
        className={`w-6 h-6 flex items-center justify-center text-[10px] rounded-full transition-all font-dotmatrix hover:bg-gray-800 ${
          isToday ? 'bg-white text-black font-bold' : 'text-gray-400'
        }`}
      >
        {d}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 h-full">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-gray-500 tracking-[0.3em] uppercase self-start font-dotmatrix">ALARMS</h3>
      </div>

      {/* Alarm pills list — LCD style */}
      <div className="flex flex-col gap-2 pb-1 w-full lg:max-w-[280px]">
        {activeAlarms.map((alarm) => (
          <div
            key={alarm.id}
            className={`flex items-center gap-3 px-4 py-2 rounded-full bg-surface-3 border ${intensityColor[alarm.intensity]} flex-shrink-0 group ${alarm.isAgentCreated ? 'animate-agent-pulse' : ''}`}
          >
            {/* Intensity dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              alarm.intensity === 'high' ? 'bg-red-500 animate-pulse-slow' :
              alarm.intensity === 'medium' ? 'bg-gray-400' : 'bg-gray-600'
            }`} />

            {/* LCD-style readout */}
            <div className="flex-1 flex items-center gap-1 min-w-0 font-dotmatrix">
              <span className="text-[10px] text-gray-400 uppercase truncate max-w-[80px]">
                {alarm.label && alarm.label !== 'Alarm' ? alarm.label : ''}
              </span>
              <span className="flex-1 border-b border-dotted border-gray-700 min-w-[8px]" />
              <span className="text-[11px] font-bold text-white tracking-[0.1em]">
                [{formatAlarmTime(alarm.dateTime)}]
              </span>
              <span className="text-[10px] opacity-50 font-mono tracking-wider">
                [{formatAlarmDate(alarm.dateTime)}]
              </span>
            </div>

            {/* Toggle Symbol */}
            <span className="text-white text-[10px] tracking-widest pl-1 font-dotmatrix">⏽</span>

            {/* Delete */}
            <button
              onClick={() => { playMechanicalClick(); onDelete(alarm.id); }}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-all ml-1"
              title="Remove"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-1">
        {/* Add button — toggles calendar visibility */}
        <button
          onClick={toggleAddPanel}
          className={`px-4 py-2 text-xs font-dotmatrix tracking-wider rounded-full border border-gray-700 flex items-center gap-2 transition-all duration-200 ${
            showForm
              ? 'bg-white text-black border-white'
              : 'bg-transparent text-white hover:border-gray-500 hover:bg-gray-900'
          }`}
          title="Add alarm"
        >
          {showForm ? 'CANCEL' : '+ ADD'}
        </button>
      </div>

      {/* Inline add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-center gap-3 animate-fade-in">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className="nothing-input-bordered flex-1 min-w-[100px] font-mono"
          />
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            min={minDateTime}
            className="nothing-input-bordered font-mono"
            required
          />
          <IntensitySelector value={intensity} onChange={setIntensity} compact />
          <button
            type="submit"
            disabled={!dateTime}
            className="btn-pill-primary px-6 py-2 text-[10px] disabled:opacity-30 disabled:cursor-not-allowed font-dotmatrix"
          >
            SET
          </button>
        </form>
      )}

      {/* Mini Calendar — hidden until + ADD is clicked, glass-morph fade */}
      {showCalendar && (
        <div className="mt-3 border border-gray-800/60 rounded-md p-4 bg-[rgba(5,5,5,0.7)] backdrop-blur-md lg:max-w-[280px] animate-calendar-glass">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-white uppercase tracking-widest font-dotmatrix">
              {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="text-gray-500 hover:text-white font-mono">◀</button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="text-gray-500 hover:text-white font-mono">▶</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <span key={i} className="text-[9px] text-gray-600 font-dotmatrix tracking-widest">{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 place-items-center">
            {calendarDays}
          </div>
        </div>
      )}
    </div>
  );
}
