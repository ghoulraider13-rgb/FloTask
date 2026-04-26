import { useState, useCallback } from 'react';
import { formatDateTime } from '../utils/taskHelpers';
import { playMechanicalClick } from '../utils/audioHelpers';

const BADGE = {
  low:    { bg: 'bg-gray-700', text: 'text-gray-400', label: 'L' },
  medium: { bg: 'bg-gray-600', text: 'text-gray-300', label: 'M' },
  high:   { bg: 'bg-red-500', text: 'text-white', label: 'H' },
};

export default function TaskItem({ task, onToggle, onDelete }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleToggle = useCallback(() => {
    playMechanicalClick();
    if (!task.completed) {
      setIsExiting(true);
      setTimeout(() => { onToggle(task.id); setIsExiting(false); }, 350);
    } else {
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
      className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300
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

      {/* Task title + reminder */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium block transition-all duration-300 ${
          task.completed ? 'task-done-text' : 'text-white'
        }`}>
          {task.title}
        </span>
        {task.reminderDateTime && !task.completed && (
          <span className="text-[10px] text-gray-500 font-mono mt-0.5 block">
            {formatDateTime(task.reminderDateTime)}
          </span>
        )}
      </div>

      {/* Intensity badge — circular */}
      {!task.completed && (
        <div className="flex items-center gap-1.5">
          {/* Red dot for high intensity */}
          {task.intensity === 'high' && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-slow" />
          )}
          <span className={`w-7 h-7 rounded-full ${badge.bg} ${badge.text} text-[10px] font-bold flex items-center justify-center`}>
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
