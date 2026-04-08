import { useState, useCallback } from 'react';
import { playMechanicalClick, playHeavyClunk } from '../utils/audioHelpers';

const BADGE = {
  low:    { bg: 'bg-gray-700', text: 'text-gray-400', label: 'L' },
  medium: { bg: 'bg-gray-600', text: 'text-gray-300', label: 'M' },
  high:   { bg: 'bg-red-500', text: 'text-white', label: 'H' },
};

const formatLCDTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatLCDDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export default function TaskItem({ task, onToggle, onDelete }) {
  const [isExiting, setIsExiting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleToggle = useCallback(() => {
    if (!task.completed) {
      // Haptic feedback: shake + heavy clunk
      playHeavyClunk();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);

      setIsExiting(true);
      setTimeout(() => { onToggle(task.id); setIsExiting(false); }, 400);
    } else {
      playMechanicalClick();
      onToggle(task.id);
    }
  }, [task.id, task.completed, onToggle]);

  const handleDelete = useCallback(() => {
    playMechanicalClick();
    setIsExiting(true);
    setTimeout(() => onDelete(task.id), 350);
  }, [task.id, onDelete]);

  const badge = BADGE[task.intensity] || BADGE.low;

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-3.5 rounded transition-all duration-300
        ${isShaking ? 'animate-haptic-shake' : ''}
        ${isExiting ? 'animate-fade-out' : 'animate-fade-in'}
        ${task.isAgentCreated ? 'animate-agent-pulse' : ''}
        ${task.completed
          ? 'bg-surface-2 opacity-40'
          : 'bg-surface-3 hover:bg-surface-4'
        }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={task.completed}
        onChange={handleToggle}
        className="task-checkbox"
        aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
      />

      {/* Task title + LCD reminder */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium font-mono block transition-all duration-300 ${
          task.completed ? 'task-done-text' : 'text-white'
        }`}>
          {task.title}
        </span>
        {task.reminderDateTime && !task.completed && (
          <div className="lcd-reminder mt-1">
            <span className="lcd-label">{task.title.length > 18 ? task.title.slice(0, 18) + '…' : task.title}</span>
            <span className="lcd-dots" />
            <span className="lcd-time">[{formatLCDTime(task.reminderDateTime)}]</span>
            <span className="lcd-date">[{formatLCDDate(task.reminderDateTime)}]</span>
          </div>
        )}
      </div>

      {/* Intensity badge — circular */}
      {!task.completed && (
        <div className="flex items-center gap-1.5">
          {/* Red dot for high intensity */}
          {task.intensity === 'high' && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-slow" />
          )}
          <span className={`w-7 h-7 rounded-full ${badge.bg} ${badge.text} text-[10px] font-bold flex items-center justify-center font-dotmatrix`}>
            {badge.label}
          </span>
        </div>
      )}

      {/* Delete on hover */}
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-all duration-200"
        title="Delete"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
