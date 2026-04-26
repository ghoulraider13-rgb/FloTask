import { useState } from 'react';
import IntensitySelector from './IntensitySelector';
import { playMechanicalClick } from '../utils/audioHelpers';

export default function AddTaskForm({ onAddTask }) {
  const [title, setTitle] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [reminderDateTime, setReminderDateTime] = useState('');
  const [intensity, setIntensity] = useState('low');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    playMechanicalClick();
    onAddTask(trimmed, {
      reminderDateTime: reminderDateTime ? new Date(reminderDateTime).toISOString() : null,
      intensity,
    });
    setTitle('');
    setReminderDateTime('');
    setIntensity('low');
    setShowOptions(false);
  };

  const minDateTime = new Date().toISOString().slice(0, 16);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1 flex items-center gap-2 border-b border-gray-800">
          <input
            id="add-task-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="nothing-input flex-1 border-none"
            autoComplete="off"
          />
          {/* Reminder toggle */}
          <button
            type="button"
            onClick={() => { playMechanicalClick(); setShowOptions(!showOptions); }}
            className={`p-2 rounded-full transition-all duration-200 flex-shrink-0 ${
              showOptions
                ? 'bg-white text-black'
                : 'text-gray-600 hover:text-gray-400'
            }`}
            title="Reminder options"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        <button
          id="add-task-button"
          type="submit"
          disabled={!title.trim()}
          className="btn-pill px-6 py-2.5 text-[11px] bg-white text-black font-bold hover:bg-gray-200 border-transparent disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + ADD
        </button>
      </div>

      {showOptions && (
        <div className="flex items-center gap-3 animate-fade-in">
          <input
            type="datetime-local"
            value={reminderDateTime}
            onChange={(e) => setReminderDateTime(e.target.value)}
            min={minDateTime}
            className="nothing-input-bordered flex-1 min-w-[160px] text-xs"
          />
          <IntensitySelector value={intensity} onChange={setIntensity} compact />
        </div>
      )}
    </form>
  );
}
