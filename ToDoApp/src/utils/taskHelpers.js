/**
 * Task & timer utility helpers.
 * Task factory includes priority, category, intensity, and full datetime reminder.
 */

export const INTENSITY_LEVELS = ['low', 'medium', 'high'];
export const INTENSITY_LABELS = { low: 'Low', medium: 'Medium', high: 'The Enforcer' };
export const INTENSITY_COLORS = {
  low: { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', dot: 'bg-emerald-400' },
  medium: { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', dot: 'bg-amber-400' },
  high: { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30', dot: 'bg-red-400' },
};

/**
 * Create a new task — extensible with priority / category.
 */
export const createTask = (title, options = {}) => ({
  id: crypto.randomUUID(),
  title: title.trim(),
  completed: false,
  createdAt: new Date().toISOString(),
  reminderDateTime: options.reminderDateTime ?? null,   // full ISO string
  intensity: options.intensity ?? 'low',                // 'low' | 'medium' | 'high'
  priority: options.priority ?? 'normal',
  category: options.category ?? 'general',
});

/**
 * Create a standalone alarm.
 */
export const createAlarm = (label, dateTime, intensity = 'medium') => ({
  id: crypto.randomUUID(),
  label: label.trim() || 'Alarm',
  dateTime,           // ISO string
  intensity,
  fired: false,
  createdAt: new Date().toISOString(),
});

/**
 * Partition tasks into active and completed.
 */
export const partitionTasks = (tasks) => ({
  active: tasks.filter((t) => !t.completed),
  done: tasks.filter((t) => t.completed),
});

/**
 * Format seconds → MM:SS.
 */
export const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Format seconds → HH:MM:SS (for regular timer).
 */
export const formatTimeLong = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/**
 * Format a date-time ISO string for display.
 */
export const formatDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

/**
 * Check if a datetime string is in the past (within 60s window).
 */
export const isTimeReached = (iso) => {
  if (!iso) return false;
  const target = new Date(iso).getTime();
  const now = Date.now();
  return now >= target && now - target < 60000;
};
