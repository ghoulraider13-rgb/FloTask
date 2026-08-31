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
  title: String(title).trim(),
  completed: false,
  createdAt: new Date().toISOString(),
  reminderDateTime: options.reminderDateTime ?? null,   // full ISO string
  intensity: options.intensity ?? 'low',                // 'low' | 'medium' | 'high'
  priority: options.priority ?? 'normal',
  category: options.category ?? 'general',
  isAgentCreated: options.isAgentCreated ?? false,
});

/**
 * Create a standalone alarm.
 */
export const createAlarm = (label, dateTime, intensity = 'medium', isAgentCreated = false) => ({
  id: crypto.randomUUID(),
  label: String(label).trim() || 'Alarm',
  dateTime,           // ISO string
  intensity,
  fired: false,
  createdAt: new Date().toISOString(),
  isAgentCreated,
});

/**
 * Convert a naive local wall-clock string ("2026-09-01T18:00:00" — what the
 * NLM returns, and what <input type="datetime-local"> produces) into a full
 * timezone-aware ISO string. Treating it as UTC (the old bug) shifted every
 * reminder by the user's UTC offset.
 */
export const parseLocalDateTime = (naive) => {
  if (!naive) return null;
  const m = String(naive).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), 0, 0
  );
  return isNaN(d.getTime()) ? null : d.toISOString();
};

/**
 * Date → value for <input type="datetime-local"> in the user's LOCAL time.
 * (toISOString().slice(0,16) is UTC and makes the "min" attribute wrong by
 * the UTC offset — e.g. unusable for the first 5.5 hours of the day in IST.)
 */
export const toLocalInputValue = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Convert one NLM action into a task or alarm object (or null if invalid).
 * The NLM speaks local wall-clock times; parseLocalDateTime anchors them
 * to the user's timezone.
 */
export const actionToTaskOrAlarm = (action) => {
  if (!action?.title) return null;
  const due = parseLocalDateTime(action.dueDateTime);
  if (action.type === 'alarm') {
    // An explicitly requested alarm must ring audibly — floor at medium.
    const intensity = action.intensity === 'high' ? 'high' : 'medium';
    return {
      kind: 'alarm',
      alarm: createAlarm(action.title, due || new Date(Date.now() + 3600000).toISOString(), intensity, true),
    };
  }
  // A task with a due time implies at least a standard alarm too.
  let intensity = action.intensity || 'low';
  if (due && intensity === 'low') intensity = 'medium';
  return {
    kind: 'task',
    task: createTask(action.title, {
      reminderDateTime: due,
      intensity,
      priority: (action.priority || 'normal').toLowerCase(),
      isAgentCreated: true,
    }),
  };
};

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
