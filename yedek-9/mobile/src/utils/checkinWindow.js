/**
 * Check-in door timing — mirrors backend getCheckinWindowInfo (v2 §2)
 */

export function getKapiMinutes(durationMin) {
  const dur = Number(durationMin) || 60;
  const raw = dur * 0.2;
  return Math.max(10, Math.min(60, Math.round(raw)));
}

export function getCheckinWindowInfo(ritual, nowMs = Date.now()) {
  const apiWindow = ritual?.checkin_window;
  if (apiWindow && typeof apiWindow === 'object') {
    return {
      ritual_started: !!apiWindow.ritual_started,
      early_window: !!apiWindow.early_window,
      early_open_at: apiWindow.early_open_at || null,
      door_open: !!apiWindow.door_open,
      door_closes_at: apiWindow.door_closes_at || null,
      kapi_minutes: apiWindow.kapi_minutes ?? null,
      minutes_until_door_close: apiWindow.minutes_until_door_close ?? 0,
      minutes_late: apiWindow.minutes_late ?? 0,
      seconds_until_start: apiWindow.seconds_until_start ?? 0,
      code_entry_active: !!apiWindow.code_entry_active,
      table_open: !!apiWindow.table_open,
      can_first_seal: !!apiWindow.can_first_seal,
      code_banned: !!apiWindow.code_banned,
    };
  }

  if (!ritual?.start_time) {
    return {
      ritual_started: false,
      early_window: false,
      early_open_at: null,
      door_open: false,
      door_closes_at: null,
      kapi_minutes: null,
      minutes_until_door_close: 0,
      minutes_late: 0,
      seconds_until_start: 0,
      code_entry_active: false,
    };
  }

  const startMs = new Date(ritual.start_time).getTime();
  const durationMin = Number(ritual.duration) || 60;
  const kapi = getKapiMinutes(durationMin);
  const doorCloseMs = startMs + kapi * 60000;
  const earlyMin = 15;
  const earlyOpenMs = startMs - earlyMin * 60000;
  const ritualStarted = nowMs >= startMs;
  const earlyWindow = nowMs >= earlyOpenMs && !ritualStarted;
  const doorOpen = nowMs >= earlyOpenMs && nowMs <= doorCloseMs;
  const minutesLate = ritualStarted ? Math.max(0, Math.round((nowMs - startMs) / 60000)) : 0;
  const tableOpen = Boolean(ritual?.checkin_keyword || ritual?.first_sealed_at);
  const codeBanned = Boolean(ritual?.first_sealed_at) && !ritual?.checkin_keyword;

  return {
    ritual_started: ritualStarted,
    early_window: earlyWindow,
    early_open_at: new Date(earlyOpenMs).toISOString(),
    door_open: doorOpen,
    door_closes_at: new Date(doorCloseMs).toISOString(),
    kapi_minutes: kapi,
    minutes_until_door_close: doorOpen ? Math.max(0, Math.ceil((doorCloseMs - nowMs) / 60000)) : 0,
    minutes_late: minutesLate,
    seconds_until_start: ritualStarted ? 0 : Math.max(0, Math.ceil((startMs - nowMs) / 1000)),
    code_entry_active: doorOpen && tableOpen && !codeBanned,
    table_open: tableOpen,
    can_first_seal: doorOpen && !tableOpen,
    warmup: earlyWindow,
    code_banned: codeBanned,
  };
}

export function isViewerCheckedIn(ritual) {
  if (ritual?.viewer_checkin?.checked_in === true) return true;
  const self = ritual?.participants?.find(
    (p) =>
      String(p.id || p.user_id) === String(ritual?.viewer_id || '') ||
      p.is_self === true
  );
  if (self?.checkin_at) return true;
  return false;
}

export function getViewerCheckedIn(ritual, currentUserId) {
  if (ritual?.viewer_checkin?.checked_in === true) return true;
  if (!currentUserId || !Array.isArray(ritual?.participants)) return false;
  const me = ritual.participants.find(
    (p) => String(p.id || p.user_id) === String(currentUserId)
  );
  return !!me?.checkin_at;
}

export function formatSecondsCountdown(totalSec) {
  const s = Math.max(0, Number(totalSec) || 0);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export function formatCheckinStatusLabel(ritual, nowMs = Date.now()) {
  const window = getCheckinWindowInfo(ritual, nowMs);
  if (window.early_window && !window.ritual_started) {
    return window.can_first_seal || window.table_open
      ? `Warm-up · firstSeal acik · baslamaya ${formatSecondsCountdown(window.seconds_until_start)}`
      : `Erken check-in · baslamaya ${formatSecondsCountdown(window.seconds_until_start)}`;
  }
  if (!window.ritual_started) {
    const startMs = new Date(ritual.start_time).getTime();
    const diffSec = Math.max(0, Math.ceil((startMs - nowMs) / 1000));
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    return m > 0 ? `Canli basliyor · ${m} dk ${String(s).padStart(2, '0')} sn` : 'Canli basliyor · simdi';
  }
  if (!window.door_open) {
    return 'Giris kapisi kapandi (no-show)';
  }
  const late = window.minutes_late;
  const left = window.minutes_until_door_close;
  const latePart = late > 0 ? `${late} dk gec · ` : '';
  return `Canli · ${latePart}kapi ${left} dk`;
}
