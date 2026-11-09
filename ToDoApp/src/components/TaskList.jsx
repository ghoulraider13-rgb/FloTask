import { useMemo } from 'react';
import AddTaskForm from './AddTaskForm';
import TaskItem from './TaskItem';
import { partitionTasks } from '../utils/taskHelpers';

export default function TaskList({ tasks, onAddTask, onToggleTask, onDeleteTask, onNlmText }) {
  const { active, done } = useMemo(() => partitionTasks(tasks), [tasks]);

  return (
    <div className="nothing-card p-5 sm:p-6 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xs font-bold text-ink-soft tracking-label uppercase">TASKS</h3>
        <div className="flex items-center gap-4">
          <span className="text-3xs text-ink-faint font-mono">{active.length} active</span>
          {done.length > 0 && (
            <span className="text-3xs text-ink-soft font-mono">{done.length} done</span>
          )}
        </div>
      </div>

      {/* Add Task (typed or spoken, parsed by the NLM) */}
      <AddTaskForm onAddTask={onAddTask} onNlmText={onNlmText} />

      {/* Active Tasks */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {active.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-12 h-12 rounded-full border border-surface-4 bg-surface-2/60 flex items-center justify-center mb-3.5">
              <svg className="w-5 h-5 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs text-ink-soft font-mono font-bold tracking-wider uppercase">ALL CLEAR // ZERO TASKS</p>
            <p className="text-3xs text-ink-line font-mono mt-1">Type or speak a task above to schedule</p>
          </div>
        )}
        {active.map((task, index) => (
          <TaskItem
            key={task.id} task={task}
            style={{ '--stagger-i': index }}
            onToggle={onToggleTask} onDelete={onDeleteTask}
          />
        ))}
      </div>

      {/* Done Section */}
      {done.length > 0 && (
        <div className="border-t border-surface-5 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-3 h-3 text-ink-soft" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            <span className="text-3xs font-bold text-ink-faint uppercase tracking-caption">Completed</span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {done.map((task, index) => (
              <TaskItem
                key={task.id} task={task}
                style={{ '--stagger-i': index }}
                onToggle={onToggleTask} onDelete={onDeleteTask}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
