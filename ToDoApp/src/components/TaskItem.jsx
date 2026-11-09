import { useState, useCallback, useRef } from 'react';
import { formatDateTime } from '../utils/taskHelpers';
import { playMechanicalClick } from '../utils/audioHelpers';
import { formatRecurrenceBadge } from '../utils/recurrence';

const BADGE = {
  low:    { bg: 'bg-surface-4', text: 'text-ink-tertiary', label: 'L' },
  medium: { bg: 'bg-surface-5', text: 'text-ink-secondary', label: 'M' },
  high:   { bg: 'bg-accent-red', text: 'text-white', label: 'H' },
};

const DRAG_THRESHOLD = 56; // px of horizontal travel before reveal
const EDGE_RATIO = 0.55;   // reveal % beyond which release = delete

/**
 * Task row with mobile swipe-to-delete, recurrence badges, and subtasks.
 */
export default function TaskItem({
  task,
  onToggle,
  onDelete,
  style,
  isSubtask = false,
  hasIncompleteSubtasks = false,
  onAddSubtask,
}) {
  const [isExiting, setIsExiting] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [blockedNotice, setBlockedNotice] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');

  const startXRef = useRef(null);
  const startYRef = useRef(null);
  const lockedRef = useRef(null); // 'x' | 'y' | null — axis lock

  const handleToggle = useCallback(() => {
    playMechanicalClick();
    if (!task.completed && hasIncompleteSubtasks) {
      setBlockedNotice(true);
      setTimeout(() => setBlockedNotice(false), 2000);
      return;
    }
    if (!task.completed) {
      setIsExiting(true);
      setTimeout(() => { onToggle(task.id); setIsExiting(false); }, 350);
    } else {
      onToggle(task.id);
    }
  }, [task.id, task.completed, hasIncompleteSubtasks, onToggle]);

  const handleDelete = useCallback(() => {
    playMechanicalClick();
    setIsExiting(true);
    setDragX(0);
    setTimeout(() => onDelete(task.id), 350);
  }, [task.id, onDelete]);

  const handleSubtaskSubmit = (e) => {
    e.preventDefault();
    const trimmed = subtaskTitle.trim();
    if (!trimmed || !onAddSubtask) return;
    playMechanicalClick();
    onAddSubtask(task.id, trimmed);
    setSubtaskTitle('');
    setIsAddingSubtask(false);
  };

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

    // Axis lock
    if (lockedRef.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      lockedRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (lockedRef.current === 'x') setIsDragging(true);
    }
    if (lockedRef.current !== 'x') return;

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
  const recurrenceLabel = formatRecurrenceBadge(task.recurrence);

  return (
    <div className={`relative overflow-hidden rounded-row ${isSubtask ? 'ml-5 sm:ml-8' : ''}`} style={style}>
      {/* Delete zone revealed behind the row (touch only) */}
      {revealPx > 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 bg-accent-red text-white"
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
        className={`group flex flex-col px-4 py-3 rounded-row transition-all duration-300
          ${isExiting ? 'animate-fade-out' : 'animate-fade-in'}
          ${task.isAgentCreated ? 'animate-agent-pulse' : ''}
          ${task.completed
            ? 'bg-surface-2 opacity-40'
            : isSubtask
              ? 'bg-surface-2 hover:bg-surface-3 border-l-2 border-surface-5'
              : 'bg-surface-3 hover:bg-surface-4'
          }`}
      >
        <div className="flex items-center gap-3 w-full">
          {/* Subtask branch connector */}
          {isSubtask && (
            <span className="text-ink-soft text-sm font-mono shrink-0 select-none" aria-hidden="true">
              ↳
            </span>
          )}

          {/* Checkbox */}
          <input
            type="checkbox"
            checked={task.completed}
            onChange={handleToggle}
            className="task-checkbox shrink-0"
            aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'complete'}`}
          />

          {/* Task title + metadata */}
          <div className="flex-1 min-w-0">
            <span className={`text-sm font-medium block transition-all duration-300 ${
              task.completed ? 'task-done-text' : 'text-white'
            }`}>
              {task.title}
            </span>

            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              {task.reminderDateTime && !task.completed && (
                <span className="text-3xs text-ink-soft font-mono">
                  {formatDateTime(task.reminderDateTime)}
                </span>
              )}

              {recurrenceLabel && !task.completed && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-surface-2 border border-surface-4 text-ink-secondary text-4xs font-dotmatrix tracking-wider"
                  title={`Repeats: ${task.recurrence}`}
                >
                  <span className="text-3xs">↻</span>
                  {recurrenceLabel}
                </span>
              )}

              {task.isAgentCreated && !task.completed && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-surface-2 border border-surface-4 text-4xs font-mono uppercase text-ink-muted"
                  title={`Agent confidence: ${(task.confidence || 'high').toUpperCase()}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      task.confidence === 'low'
                        ? 'bg-transparent border border-ink-faint'
                        : task.confidence === 'medium'
                          ? 'bg-ink-muted border border-ink-secondary'
                          : 'bg-ink-primary'
                    }`}
                  />
                  <span className="font-dotmatrix text-4xs">AI</span>
                </span>
              )}

              {blockedNotice && (
                <span className="text-4xs text-accent-red font-mono font-bold tracking-widest uppercase animate-pulse">
                  Blocked by subtasks
                </span>
              )}
            </div>
          </div>

          {/* Add Subtask affordance (for root tasks that aren't completed) */}
          {!isSubtask && !task.completed && onAddSubtask && (
            <button
              type="button"
              onClick={() => { playMechanicalClick(); setIsAddingSubtask(!isAddingSubtask); }}
              className="text-4xs font-dotmatrix text-ink-soft hover:text-ink-primary px-2 py-1 rounded bg-surface-2 hover:bg-surface-4 border border-surface-5 tracking-wider uppercase transition-colors shrink-0"
              title="Add subtask"
            >
              + SUBTASK
            </button>
          )}

          {/* Intensity badge — circular */}
          {!task.completed && (
            <div className="flex items-center gap-1.5 shrink-0">
              {task.intensity === 'high' && (
                <span className="w-2 h-2 rounded-full bg-accent-red animate-pulse-slow" />
              )}
              <span className={`w-7 h-7 rounded-full ${badge.bg} ${badge.text} text-3xs font-bold flex items-center justify-center`}>
                {badge.label}
              </span>
            </div>
          )}

          {/* Delete — always visible */}
          <button
            onClick={handleDelete}
            className="p-1.5 -mr-1 text-ink-faint hover:text-accent-red transition-all duration-200 shrink-0"
            title="Delete"
            aria-label={`Delete "${task.title}"`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Inline Subtask Creation Input */}
        {isAddingSubtask && (
          <form onSubmit={handleSubtaskSubmit} className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-5 animate-fade-in">
            <span className="text-ink-soft text-xs font-mono pl-1">↳</span>
            <input
              type="text"
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              placeholder="Subtask title…"
              className="nothing-input-bordered flex-1 py-1 text-xs"
              autoFocus
            />
            <button
              type="submit"
              disabled={!subtaskTitle.trim()}
              className="btn-pill px-3 py-1 text-4xs font-dotmatrix bg-white text-black hover:bg-ink-secondary disabled:opacity-30"
            >
              ADD
            </button>
            <button
              type="button"
              onClick={() => { setIsAddingSubtask(false); setSubtaskTitle(''); }}
              className="text-ink-faint hover:text-ink-primary text-3xs font-mono px-1.5"
            >
              ✕
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
