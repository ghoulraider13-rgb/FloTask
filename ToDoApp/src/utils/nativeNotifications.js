/**
 * Native notification scheduling via @capacitor/local-notifications.
 *
 * Used ONLY when running inside a Capacitor native shell. The web fallback
 * (setInterval + WebAudio + browser Notification) lives in useReminders.js
 * and audioHelpers.js — it runs when isNativePlatform() === false.
 *
 * NOTE: The Enforcer/CAPTCHA modal and WebAudio alarm sounds only work
 * while the app is in the foreground. A native notification will wake the
 * user, but the full enforcer experience requires opening the app.
 */

import { isNativePlatform } from './platform.js';

let LocalNotifications = null;

/** Lazy-load the plugin — avoids import errors in web-only builds. */
async function getPlugin() {
  if (!isNativePlatform()) return null;
  if (!LocalNotifications) {
    const mod = await import('@capacitor/local-notifications');
    LocalNotifications = mod.LocalNotifications;
  }
  return LocalNotifications;
}

// ── Notification channel (Android) ──────────────────────────────────
// Created once on app startup. High importance = heads-up notification
// with sound, even when the phone is locked.
const CHANNEL_ID = 'flotask_alarms';

export async function createNotificationChannel() {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    await plugin.createChannel({
      id: CHANNEL_ID,
      name: 'FloTask Alarms',
      description: 'Alarm and reminder notifications',
      importance: 5,           // MAX — heads-up, sound, vibrate
      visibility: 1,           // PUBLIC — show on lock screen
      vibration: true,
      sound: 'default',        // uses the system alarm sound
      lights: true,
      lightColor: '#FF0000',
    });
  } catch (e) {
    console.warn('[nativeNotifications] channel creation failed:', e);
  }
}

// ── Permission handling ─────────────────────────────────────────────
export async function requestNotificationPermission() {
  const plugin = await getPlugin();
  if (!plugin) return false;
  try {
    let { display } = await plugin.checkPermissions();
    if (display === 'prompt' || display === 'prompt-with-rationale') {
      const result = await plugin.requestPermissions();
      display = result.display;
    }
    return display === 'granted';
  } catch (e) {
    console.warn('[nativeNotifications] permission error:', e);
    return false;
  }
}

/**
 * Check and request the Android 12+ SCHEDULE_EXACT_ALARM permission.
 * This is needed for alarms that must fire at an exact time.
 * Falls back gracefully — inexact alarms still work.
 */
export async function requestExactAlarmPermission() {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    // checkExactNotificationSetting is available in @capacitor/local-notifications ≥6
    if (typeof plugin.checkExactNotificationSetting === 'function') {
      const { value } = await plugin.checkExactNotificationSetting();
      if (value !== 'granted') {
        // Opens Android system settings for the user to grant exact alarms
        await plugin.requestExactNotificationSetting();
      }
    }
  } catch (e) {
    // Not fatal — inexact alarms still fire within a few minutes
    console.warn('[nativeNotifications] exact alarm permission:', e);
  }
}

// ── Notification ID mapping ─────────────────────────────────────────
// Capacitor notification IDs must be positive 32-bit ints.
// We hash the UUID-based task/alarm ID to a stable int.
function idToInt(id) {
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;   // must be > 0
}

// ── Schedule a notification ─────────────────────────────────────────
/**
 * Schedule a local notification for a task reminder or alarm.
 *
 * @param {object} item — task or alarm object
 * @param {'task'|'alarm'} source
 * @returns {Promise<boolean>} — true if scheduled successfully
 */
export async function scheduleNotification(item, source) {
  const plugin = await getPlugin();
  if (!plugin) return false;

  const dateTime = source === 'alarm' ? item.dateTime : item.reminderDateTime;
  if (!dateTime) return false;

  const at = new Date(dateTime);
  if (isNaN(at.getTime()) || at.getTime() <= Date.now()) return false;

  const title = source === 'alarm'
    ? `⏰ ${item.label || 'Alarm'}`
    : `📋 ${item.title || 'Task reminder'}`;
  const body = source === 'alarm'
    ? `Alarm: ${item.label || 'Time is up!'}`
    : `Reminder: ${item.title}`;

  const intensity = item.intensity || 'low';

  try {
    await plugin.schedule({
      notifications: [{
        id: idToInt(item.id),
        title,
        body,
        schedule: {
          at,
          allowWhileIdle: true,  // fire even in Doze mode
        },
        channelId: CHANNEL_ID,
        // Extra data passed to the action listener — used to open
        // the enforcer modal when the notification is tapped.
        extra: {
          itemId: item.id,
          source,
          intensity,
        },
        // Android: large icon, small icon configured in AndroidManifest
        smallIcon: 'ic_stat_flotask',
        iconColor: intensity === 'high' ? '#FF0000' : '#FFFFFF',
        // Sound
        sound: intensity === 'high' ? 'alarm_high.wav' : 'default',
        // Auto-cancel when tapped
        autoCancel: true,
      }],
    });
    return true;
  } catch (e) {
    console.warn('[nativeNotifications] schedule failed:', e);
    return false;
  }
}

// ── Cancel a notification ───────────────────────────────────────────
/** Cancel a previously scheduled notification (e.g. on task complete/delete). */
export async function cancelNotification(itemId) {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    await plugin.cancel({ notifications: [{ id: idToInt(itemId) }] });
  } catch (e) {
    console.warn('[nativeNotifications] cancel failed:', e);
  }
}

// ── Reschedule (edit) ───────────────────────────────────────────────
/** Cancel + re-schedule when a reminder time or alarm time changes. */
export async function rescheduleNotification(item, source) {
  await cancelNotification(item.id);
  return scheduleNotification(item, source);
}

// ── Notification action listener ────────────────────────────────────
/**
 * Register a handler for when the user taps a notification.
 * The handler receives { itemId, source, intensity } from the extra data.
 *
 * Call this once at app startup. The callback can navigate to the
 * enforcer modal if intensity === 'high'.
 */
export async function registerNotificationActionListener(callback) {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    await plugin.addListener('localNotificationActionPerformed', (event) => {
      const extra = event.notification?.extra || {};
      callback({
        itemId: extra.itemId,
        source: extra.source,
        intensity: extra.intensity,
      });
    });
  } catch (e) {
    console.warn('[nativeNotifications] listener registration failed:', e);
  }
}

// ── Bulk sync ───────────────────────────────────────────────────────
/**
 * Sync all current tasks + alarms with the notification system.
 * Called on app resume / after data changes to ensure consistency.
 */
export async function syncAllNotifications(tasks, alarms) {
  const plugin = await getPlugin();
  if (!plugin) return;

  try {
    // Get currently pending notifications
    const pending = await plugin.getPending();
    const pendingIds = new Set(pending.notifications.map(n => n.id));

    // Schedule missing task reminders
    for (const task of tasks) {
      if (task.reminderDateTime && !task.completed) {
        const nid = idToInt(task.id);
        if (!pendingIds.has(nid)) {
          const at = new Date(task.reminderDateTime);
          if (at.getTime() > Date.now()) {
            await scheduleNotification(task, 'task');
          }
        }
      }
    }

    // Schedule missing alarms
    for (const alarm of alarms) {
      if (!alarm.fired) {
        const nid = idToInt(alarm.id);
        if (!pendingIds.has(nid)) {
          const at = new Date(alarm.dateTime);
          if (at.getTime() > Date.now()) {
            await scheduleNotification(alarm, 'alarm');
          }
        }
      }
    }
  } catch (e) {
    console.warn('[nativeNotifications] sync failed:', e);
  }
}
