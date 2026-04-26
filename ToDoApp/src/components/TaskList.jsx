import { useMemo } from 'react';
import AddTaskForm from './AddTaskForm';
import TaskItem from './TaskItem';
import { partitionTasks } from '../utils/taskHelpers';

export default function TaskList({ tasks, onAddTask, onToggleTask, onDeleteTask, onSetReminder }) {
  const { active, done } = useMemo(() => partitionTasks(tasks), [tasks]);

  return (
    <div className="nothing-card p-6 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold text-gray-500 tracking-[0.3em] uppercase">TASKS</h3>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-gray-600 font-mono">{active.length} active</span>
          {done.length > 0 && (
            <span className="text-[10px] text-gray-500 font-mono">{done.length} done</span>
          )}
        </div>
      </div>

      {/* Add Task */}
      <AddTaskForm onAddTask={onAddTask} />

      {/* Active Tasks */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {active.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full border border-gray-700 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs text-gray-500 font-mono tracking-wider uppercase">All clear</p>
            <p className="text-[10px] text-gray-700 mt-1">Add a task to get started</p>
          </div>
        )}
        {active.map((task) => (
          <TaskItem
            key={task.id} task={task}
            onToggle={onToggleTask} onDelete={onDeleteTask}
          />
        ))}
      </div>

      {/* Done Section */}
      {done.length > 0 && (
        <div className="border-t border-gray-800 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-3 h-3 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">Completed</span>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {done.map((task) => (
              <TaskItem
                key={task.id} task={task}
                onToggle={onToggleTask} onDelete={onDeleteTask}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
