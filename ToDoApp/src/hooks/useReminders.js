import { useEffect, useRef, useCallback } from 'react';
import { isTimeReached } from '../utils/taskHelpers';

/**
 * Monitors tasks and standalone alarms for due reminders.
 * Calls onAlert(item, source) with the triggering item and its source type.
 * source = 'task' | 'alarm'
 */
export function useReminders(tasks, alarms, onAlert) {
  const firedRef = useRef(new Set());

  const check = useCallback(() => {
    // Check task reminders
    tasks.forEach((task) => {
      if (
        task.reminderDateTime &&
        !task.completed &&
        !firedRef.current.has(task.id) &&
        isTimeReached(task.reminderDateTime)
      ) {
        firedRef.current.add(task.id);
        onAlert(task, 'task');
      }
    });

    // Check standalone alarms
    alarms.forEach((alarm) => {
      if (
        !alarm.fired &&
        !firedRef.current.has(alarm.id) &&
        isTimeReached(alarm.dateTime)
      ) {
        firedRef.current.add(alarm.id);
        onAlert(alarm, 'alarm');
      }
    });
  }, [tasks, alarms, onAlert]);

  useEffect(() => {
    const interval = setInterval(check, 5000); // check every 5s
    check(); // immediate check on mount
    return () => clearInterval(interval);
  }, [check]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
}

/** Fire a browser notification (low intensity fallback). */
export function fireBrowserNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(title, { body, icon: '/vite.svg' });
    setTimeout(() => n.close(), 8000);
  }
}
