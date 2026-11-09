/**
 * Lightweight RRULE-compatible recurrence utility for FloTask.
 * Supports DAILY, WEEKDAYS, WEEKLY, and MONTHLY recurrences
 * with wall-clock time preservation.
 */

export const RECURRENCE_PRESETS = [
  { id: '', label: 'NONE' },
  { id: 'FREQ=DAILY', label: 'DAILY' },
  { id: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', label: 'WEEKDAYS' },
  { id: 'FREQ=WEEKLY', label: 'WEEKLY' },
  { id: 'FREQ=MONTHLY', label: 'MONTHLY' },
];

/**
 * Returns a concise human-readable badge label for an RRULE string.
 */
export function formatRecurrenceBadge(rrule) {
  if (!rrule) return null;
  if (rrule.includes('MO,TU,WE,TH,FR')) return 'WEEKDAYS';
  if (rrule.includes('FREQ=DAILY')) return 'DAILY';
  if (rrule.includes('FREQ=WEEKLY')) return 'WEEKLY';
  if (rrule.includes('FREQ=MONTHLY')) return 'MONTHLY';
  return 'REPEAT';
}

/**
 * Calculate the next occurrence date (ISO string) following the specified RRULE.
 * Preserves local hours and minutes of the original date.
 */
export function getNextOccurrence(baseDateInput, rrule) {
  if (!rrule) return null;

  const base = baseDateInput ? new Date(baseDateInput) : new Date();
  if (isNaN(base.getTime())) return null;

  const next = new Date(base.getTime());

  if (rrule.includes('MO,TU,WE,TH,FR')) {
    // Weekdays only
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || next.getDay() === 6); // Skip Sun (0) & Sat (6)
  } else if (rrule.includes('FREQ=DAILY')) {
    next.setDate(next.getDate() + 1);
  } else if (rrule.includes('FREQ=WEEKLY')) {
    next.setDate(next.getDate() + 7);
  } else if (rrule.includes('FREQ=MONTHLY')) {
    next.setMonth(next.getMonth() + 1);
  } else {
    // Default fallback: 1 day
    next.setDate(next.getDate() + 1);
  }

  // If next is still in the past compared to now, bump until in future
  const now = Date.now();
  if (next.getTime() <= now) {
    if (rrule.includes('FREQ=DAILY')) {
      const diffDays = Math.ceil((now - next.getTime()) / (24 * 3600 * 1000));
      next.setDate(next.getDate() + Math.max(1, diffDays));
    } else if (rrule.includes('MO,TU,WE,TH,FR')) {
      while (next.getTime() <= now || next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
    } else if (rrule.includes('FREQ=WEEKLY')) {
      const diffWeeks = Math.ceil((now - next.getTime()) / (7 * 24 * 3600 * 1000));
      next.setDate(next.getDate() + Math.max(1, diffWeeks) * 7);
    } else if (rrule.includes('FREQ=MONTHLY')) {
      while (next.getTime() <= now) {
        next.setMonth(next.getMonth() + 1);
      }
    }
  }

  return next.toISOString();
}
