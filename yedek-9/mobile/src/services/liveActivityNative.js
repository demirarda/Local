import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  isLiveActivitySupported,
  startLiveActivity,
  updateLiveActivity,
  endLiveActivity,
} from 'ritual-live-activity';

let activeNotificationId = null;
let iosActivityActive = false;

function formatRemaining(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}s ${m % 60}dk`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * son-part.md §8.4 — ActivityKit / Android Live Updates köprüsü.
 * Android v1: sticky ongoing notification (OS Live Updates API henüz yok — approx).
 * iOS: native ActivityKit modülü; yoksa in-app bar.
 */
export async function startNativeLiveActivity(payload = {}) {
  if (!payload?.active) return { ok: false, reason: 'inactive' };

  const title = payload.title || 'Ritual';
  const phase = payload.phase || 'live';
  const remaining = formatRemaining(payload.remaining_seconds);
  const body = `${phase} · ${remaining} kaldi`;

  if (Platform.OS === 'android') {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
      if (activeNotificationId) {
        await Notifications.dismissNotificationAsync(activeNotificationId).catch(() => {});
      }
      activeNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `L · ${title}`,
          body,
          sticky: true,
          data: { ritual_id: payload.ritual_id, live_activity: true },
        },
        trigger: null,
      });
      return { ok: true, platform: 'android_sticky_notification', note: 'v1 approx — not OS Live Updates API' };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  if (Platform.OS === 'ios' && isLiveActivitySupported()) {
    try {
      const result = iosActivityActive
        ? await updateLiveActivity(payload)
        : await startLiveActivity(payload);
      if (result?.ok) {
        iosActivityActive = true;
        return { ok: true, platform: 'ios_activitykit', activityId: result.activityId };
      }
      return { ok: false, reason: result?.reason || 'activitykit_failed' };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  return { ok: true, platform: 'ios_in_app', note: 'ActivityKit unavailable — in-app bar only' };
}

export async function endNativeLiveActivity() {
  if (activeNotificationId) {
    await Notifications.dismissNotificationAsync(activeNotificationId).catch(() => {});
    activeNotificationId = null;
  }
  if (Platform.OS === 'ios' && iosActivityActive) {
    await endLiveActivity().catch(() => {});
    iosActivityActive = false;
  }
  return { ok: true };
}

export async function updateNativeLiveActivity(payload = {}) {
  if (!payload?.active) {
    return endNativeLiveActivity();
  }
  return startNativeLiveActivity(payload);
}
