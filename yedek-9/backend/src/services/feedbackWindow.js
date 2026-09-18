/**
 * Feedback window — 24 Ağu v-final §11
 * opens = duration_end; closes = duration_end + FEEDBACK_FLOOR (12h SABİT 🔒)
 * Live-window uzunluğu deadline'ı uzatmaz.
 */
import LOCAL_CONFIG from '../config/localConfig.js';
import { getDurationEndDate } from './ritualState.js';

export function getFeedbackOpensAt(ritual) {
  return getDurationEndDate(ritual);
}

export function getFeedbackClosesAt(ritual) {
  const durationEnd = getDurationEndDate(ritual);
  const floorMs = LOCAL_CONFIG.ritual.FEEDBACK_FLOOR_HOURS * 3600000;
  return new Date(durationEnd.getTime() + floorMs);
}

export function getFeedbackWindowInfo(ritual, now = new Date()) {
  const opensAt = getFeedbackOpensAt(ritual);
  const closesAt = getFeedbackClosesAt(ritual);
  const nowMs = now.getTime();
  const open = nowMs >= opensAt.getTime() && nowMs <= closesAt.getTime();
  const msRemaining = Math.max(0, closesAt.getTime() - nowMs);
  return {
    open,
    opens_at: opensAt.toISOString(),
    closes_at: closesAt.toISOString(),
    floor_hours: LOCAL_CONFIG.ritual.FEEDBACK_FLOOR_HOURS,
    ms_remaining: open ? msRemaining : 0,
    minutes_remaining: open ? Math.ceil(msRemaining / 60000) : 0,
  };
}

export function isFeedbackWindowOpen(ritual, now = new Date()) {
  return getFeedbackWindowInfo(ritual, now).open;
}
