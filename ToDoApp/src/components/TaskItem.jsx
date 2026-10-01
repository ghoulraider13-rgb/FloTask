import { useState, useCallback, useRef } from 'react';
import { formatDateTime } from '../utils/taskHelpers';
import { playMechanicalClick } from '../utils/audioHelpers';

const BADGE = {
  low:    { bg: 'bg-gray-700', text: 'text-gray-400', label: 'L' },
  medium: { bg: 'bg-gray-600', text: 'text-gray-300', label: 'M' },
  high:   { bg: 'bg-red-500', text: 'text-white', label: 'H' },
};

const DRAG_THRESHOLD = 56; // px of horizontal travel before reveal
const EDGE_RATIO = 0.55;   // reveal % beyond which release = delete

/**
 * Task row with mobile swipe-to-delete. On touch, dragging the row
 * left reveals a red DELETE zone; releasing past the threshold deletes,
 * releasing before springs back. Desktop keeps the exact existing
 * layout — the delete button (hover target) stays as-is there.
 *
 * `data-swipe-to-delete` marks this row so SwipeCarousel never claims
 * the horizontal gesture (the carousel's watchDrag checks the drag
 * target at pointer-down).
 */
export default function TaskItem({ task, onToggle, onDelete }) {
  const [isExiting, setIsExiting] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(null);
  const startYRef = useRef(null);
  const lockedRef = useRef(null); // 'x' | 'y' | null — axis lock

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
    setDragX(0);
    setTimeout(() => onDelete(task.id), 350);
  }, [task.id, onDelete]);

  // ── Swipe-to-delete (touch only) ─────────────────────────────────
  const onTouchStart = (e) => {
    if (task.completed) return;
    const t = e.touches[0];
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    lockedRef.current = null;
  };

  const onTouchMove = (e) => {
    if (task.completed || startXRef.current === null) return;
    const t = e.touches[0];
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;

    // Axis lock: first decide whether this gesture is horizontal or
    // vertical; vertical gestures scroll the screen (never revealed).
    if (lockedRef.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      lockedRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (lockedRef.current === 'x') setIsDragging(true);
    }
    if (lockedRef.current !== 'x') return;

    // Only leftward drag reveals (dx < 0); resist beyond the threshold.
    const raw = Math.min(0, dx);
    const resisted = raw < -DRAG_THRESHOLD
      ? -DRAG_THRESHOLD - (raw + DRAG_THRESHOLD) * 0.35
      : raw;
    setDragX(resisted);
  };

  const onTouchEnd = () => {
    if (lockedRef.current === 'x') {
      const reveal = -dragX;
      if (reveal > DRAG_THRESHOLD * EDGE_RATIO) {
        handleDelete();
      } else {
        setDragX(0);
      }
    }
    setIsDragging(false);
    startXRef.current = null;
    startYRef.current = null;
    lockedRef.current = null;
  };

  const badge = BADGE[task.intensity] || BADGE.low;
  const revealPx = Math.max(0, -dragX);

  return (
    <div className="relative overflow-hidden rounded-row">
      {/* Delete zone revealed behind the row (touch only) */}
      {revealPx > 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 bg-red-500 text-white"
          style={{ width: revealPx }}
          aria-hidden="true"
        >
          {revealPx > DRAG_THRESHOLD * EDGE_RATIO && (
            <span className="text-3xs font-bold tracking-caption uppercase">Delete</span>
          )}
        </div>
      )}

      <div
        data-swipe-to-delete
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={isDragging ? { transform: `translateX(${dragX}px)`, transition: 'none' } : undefined}
        className={`group flex items-center gap-3 px-4 py-3.5 rounded-row transition-all duration-300
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
            <span className="text-3xs text-gray-500 font-mono mt-0.5 block">
              {formatDateTime(task.reminderDateTime)}
            </span>
          )}
        </div>

        {/* Intensity badge — circular (desktop hover affordance) */}
        {!task.completed && (
          <div className="flex items-center gap-1.5">
            {/* Red dot for high intensity */}
            {task.intensity === 'high' && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-slow" />
            )}
            <span className={`w-7 h-7 rounded-full ${badge.bg} ${badge.text} text-3xs font-bold flex items-center justify-center`}>
              {badge.label}
            </span>
          </div>
        )}

        {/* Delete — always visible (mobile has no hover) */}
        <button
          onClick={handleDelete}
          className="p-1.5 -mr-1 text-gray-600 hover:text-red-400 transition-all duration-200"
          title="Delete"
          aria-label={`Delete "${task.title}"`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
