/**
 * Feedback window — son-part.md §4.4
 * opens = duration end; closes = max(window_end, duration_end + FEEDBACK_FLOOR)
 */
import LOCAL_CONFIG from '../config/localConfig.js';
import { getDurationEndDate, getWindowEndDate } from './ritualState.js';

export function getFeedbackOpensAt(ritual) {
  return getDurationEndDate(ritual);
}

export function getFeedbackClosesAt(ritual) {
  const durationEnd = getDurationEndDate(ritual);
  const floorMs = LOCAL_CONFIG.ritual.FEEDBACK_FLOOR_HOURS * 3600000;
  const floorEnd = new Date(durationEnd.getTime() + floorMs);
  const windowEnd = getWindowEndDate(ritual);
  return floorEnd > windowEnd ? floorEnd : windowEnd;
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
