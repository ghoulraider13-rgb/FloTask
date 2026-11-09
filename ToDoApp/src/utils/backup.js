/**
 * Backup & Restore Utility for FloTask.
 * Exports and imports tasks, alarms, scratchpad, notes, hydration, sleep, and focus history.
 */

const STORAGE_KEYS = [
  'todo-tasks',
  'todo-alarms',
  'scratchpad-rich',
  'saved-notes',
  'hydration-intake',
  'hydration-goal',
  'sleep-session-history',
  'focus-history',
];

/**
 * Gather full application state from localStorage and trigger a JSON file download.
 */
export function exportBackup() {
  if (typeof window === 'undefined') return;

  const backupData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: {},
  };

  STORAGE_KEYS.forEach((key) => {
    try {
      const raw = window.localStorage.getItem(key);
      backupData.data[key] = raw ? JSON.parse(raw) : null;
    } catch {
      backupData.data[key] = window.localStorage.getItem(key);
    }
  });

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `flotask-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validate and restore JSON backup data into localStorage.
 * Returns { success: boolean, count: number, error?: string }.
 */
export function restoreBackup(jsonString) {
  if (typeof window === 'undefined') return { success: false, count: 0, error: 'No browser context' };

  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, count: 0, error: 'Invalid backup file structure' };
    }

    const data = parsed.data || parsed;
    let restoredCount = 0;

    STORAGE_KEYS.forEach((key) => {
      if (key in data && data[key] !== undefined && data[key] !== null) {
        const val = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
        window.localStorage.setItem(key, val);
        restoredCount++;
      }
    });

    if (restoredCount === 0) {
      return { success: false, count: 0, error: 'No recognizable FloTask data found in file' };
    }

    // Dispatch storage event so all hooks/components re-sync immediately
    window.dispatchEvent(new Event('storage'));

    return { success: true, count: restoredCount };
  } catch (err) {
    return { success: false, count: 0, error: err?.message || 'Failed to parse JSON file' };
  }
}
