/**
 * LOCAL MEGA §14-16 + EK-26/27 — kilitli ürün kuralları.
 * EK-26 supersede haritası kazanır; EK-27 donma iptali + rulo + 3 M-tipi.
 */
import LOCAL_CONFIG from '../config/localConfig.js';
import { normalizeWeeklyHours } from './venueRoleService.js';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function megaDoorSets() {
  return {
    user: [...(LOCAL_CONFIG.ritual.DOOR_SET_USER || ['PUBLIC', 'APPROVAL', 'FRIENDS', 'SOLO'])],
    business: [...(LOCAL_CONFIG.ritual.DOOR_SET_BUSINESS || ['PUBLIC', 'APPROVAL'])],
  };
}

/**
 * EK-15b kapı seti → legacy ritual_entry_type.
 * PUBLIC→open · APPROVAL→request · FRIENDS→reference · SOLO→open (+ door=SOLO)
 */
export function normalizeDoorAndEntry(raw, { accountType = 'user' } = {}) {
  const sets = megaDoorSets();
  const allowed = accountType === 'business' ? sets.business : sets.user;
  const token = String(raw || LOCAL_CONFIG.ritual.DOOR_DEFAULT || 'PUBLIC')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');
  const aliases = {
    OPEN: 'PUBLIC',
    PUBLIC: 'PUBLIC',
    APPROVAL: 'APPROVAL',
    REQUEST: 'APPROVAL',
    REQUEST_SEAT: 'APPROVAL',
    FRIENDS: 'FRIENDS',
    FRIENDS_ONLY: 'FRIENDS',
    INVITE_ONLY: 'FRIENDS',
    REFERENCE: 'FRIENDS',
    SOLO: 'SOLO',
  };
  let door = aliases[token] || aliases[String(raw || '').trim().toLowerCase().replace(/-/g, '_').toUpperCase()];
  if (!door) {
    const low = String(raw || '').toLowerCase();
    if (low === 'open') door = 'PUBLIC';
    else if (low === 'request' || low === 'request_seat') door = 'APPROVAL';
    else if (low === 'invite_only' || low === 'reference') door = 'FRIENDS';
    else door = 'PUBLIC';
  }
  if (!allowed.includes(door)) {
    return {
      ok: false,
      error:
        accountType === 'business'
          ? 'Business kapı seti: PUBLIC / APPROVAL'
          : 'Kapı seti: PUBLIC / APPROVAL / FRIENDS / SOLO',
      code: 'DOOR_NOT_ALLOWED',
      door,
    };
  }
  const entry_type =
    door === 'APPROVAL' ? 'request' : door === 'FRIENDS' ? 'reference' : 'open';
  return { ok: true, door, entry_type, solo: door === 'SOLO' };
}

export function resolveRegularMinSeals(venueOverride) {
  const floor = Number(
    LOCAL_CONFIG.regular?.MIN_SEALS ?? LOCAL_CONFIG.regular?.N ?? LOCAL_CONFIG.regular?.THRESHOLD ?? 5
  );
  const raw = Number(venueOverride);
  if (!Number.isFinite(raw)) return floor;
  if (LOCAL_CONFIG.regular?.VENUE_MAY_RAISE_ONLY !== false) {
    return Math.max(floor, Math.round(raw));
  }
  return Math.round(raw);
}

export function canonicalPackageName(tierId) {
  const t = String(tierId || 'free').toLowerCase();
  if (t === 'operator' || t === 'pro') return 'OPERATOR';
  if (t === 'hakim' || t === 'landmark' || t === 'city_partner' || t === 'partner') return 'LANDMARK';
  return 'OPEN';
}

export function isPaidCommerceTier(tierId) {
  const name = canonicalPackageName(tierId);
  return name === 'OPERATOR' || name === 'LANDMARK';
}

/**
 * EK-26 PARALI-R: venue zemininde para yalnız OPERATOR+.
 * Walk-in asla paralı. C/Z (venue yok) seller serbest.
 */
export function assertPaidRAllowed({ fee, origin, venueTier, venueId } = {}) {
  if (!fee || Number(fee.amount) <= 0) return { ok: true };
  const originU = String(origin || '').toUpperCase();
  if (originU === 'WALK_IN' || LOCAL_CONFIG.ritual.WALK_IN_NEVER_PAID) {
    if (originU === 'WALK_IN') {
      return { ok: false, error: 'Walk-in asla paralı olamaz', code: 'WALK_IN_NEVER_PAID' };
    }
  }
  if (!venueId) return { ok: true, reason: 'custom_or_zone' };
  if (!isPaidCommerceTier(venueTier || 'free')) {
    return {
      ok: false,
      error: 'ücretli masa için mekanın ticaret-katmanı gerekli',
      code: 'PAID_R_REQUIRES_OPERATOR',
    };
  }
  return { ok: true };
}

export function parseHmToMinutes(hm) {
  const m = String(hm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * EK-2: self-rez ufku = mekanın çalışma günü (kapanışa dek; gece-yarısı reset yok).
 * EK-3: son istek = kapanış − SELFREZ_BUFFER (default 30dk).
 */
export function venueWorkingDayBounds(weeklyHours, now = new Date()) {
  const hours = normalizeWeeklyHours(weeklyHours || {});
  const jsDay = now.getDay();
  const todayKey = DAYS[(jsDay + 6) % 7];
  const yestKey = DAYS[(jsDay + 5) % 7];
  const today = hours[todayKey];
  const yest = hours[yestKey];

  const startOfLocalDay = new Date(now);
  startOfLocalDay.setHours(0, 0, 0, 0);

  const apply = (dayRow, dayStart) => {
    if (!dayRow || dayRow.closed) return null;
    const openM = parseHmToMinutes(dayRow.open);
    const closeM = parseHmToMinutes(dayRow.close);
    if (openM == null || closeM == null) return null;
    const openAt = new Date(dayStart.getTime() + openM * 60000);
    let closeAt;
    if (closeM === 0 || closeM <= openM) {
      closeAt = new Date(dayStart.getTime() + (closeM + 24 * 60) * 60000);
    } else {
      closeAt = new Date(dayStart.getTime() + closeM * 60000);
    }
    return { openAt, closeAt, day: dayRow };
  };

  const yestStart = new Date(startOfLocalDay);
  yestStart.setDate(yestStart.getDate() - 1);
  const yestBounds = apply(yest, yestStart);
  if (yestBounds && now >= yestBounds.openAt && now < yestBounds.closeAt) {
    return { ok: true, ...yestBounds, overnight: true };
  }
  const todayBounds = apply(today, startOfLocalDay);
  if (!todayBounds) {
    return { ok: false, error: 'Mekan bugün kapalı', code: 'VENUE_CLOSED' };
  }
  return { ok: true, ...todayBounds, overnight: false };
}

export function assertSelfRezWorkingDay({ weeklyHours, now = new Date(), bufferMin } = {}) {
  const bounds = venueWorkingDayBounds(weeklyHours, now);
  if (!bounds.ok) return bounds;
  const buffer = Number(
    bufferMin ?? LOCAL_CONFIG.ritual.SELF_REZ_BUFFER_MIN ?? 30
  );
  const lastAt = new Date(bounds.closeAt.getTime() - Math.max(0, buffer) * 60000);
  if (now < bounds.openAt) {
    return { ok: false, error: 'Self-rez çalışma saati dışında', code: 'SELFREZ_OUTSIDE_HOURS' };
  }
  if (now > lastAt) {
    return {
      ok: false,
      error: `Self-rez kapanıştan ${buffer} dk önce kesilir`,
      code: 'SELFREZ_BUFFER',
      last_at: lastAt.toISOString(),
      close_at: bounds.closeAt.toISOString(),
    };
  }
  return {
    ok: true,
    open_at: bounds.openAt.toISOString(),
    close_at: bounds.closeAt.toISOString(),
    last_at: lastAt.toISOString(),
  };
}

/** Forward-date raf-isteği hep APPROVAL (⏳). Same-day may be INSTANT. */
export function resolveSelfRezModeForStart({ startDate, requestedMode, now = new Date() } = {}) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const sameCalendarDay =
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate();
  if (!sameCalendarDay) return 'APPROVAL';
  const mode = String(requestedMode || 'INSTANT').toUpperCase();
  return mode === 'INSTANT' ? 'INSTANT' : 'APPROVAL';
}

export function isHostOrCreator(ritual, userId) {
  if (!ritual || !userId) return false;
  const uid = String(userId);
  return (
    (ritual.host_id && String(ritual.host_id) === uid) ||
    (ritual.creator_id && String(ritual.creator_id) === uid) ||
    (ritual.created_by && String(ritual.created_by) === uid)
  );
}

export function windowToolAllowed(type, { isVenEvent = false } = {}) {
  const t = String(type || '').toLowerCase();
  const allowed = (LOCAL_CONFIG.window_tools?.TYPES || ['photo', 'video', 'quote', 'music']).map((x) =>
    String(x).toLowerCase()
  );
  const aliases = { playlist: 'music', song: 'music', media: 'photo' };
  const mapped = aliases[t] || t;
  const reject = (LOCAL_CONFIG.window_tools?.REJECT_OUTSIDE_EVENT || ['poll', 'quiz', 'file', 'survey']).map(
    (x) => String(x).toLowerCase()
  );
  if (reject.includes(mapped) || reject.includes(t)) {
    if (!isVenEvent) {
      return { ok: false, error: 'Anket/quiz/dosya yalnız VEN-EVENT ortak-an', code: 'WINDOW_TOOL_EVENT_ONLY' };
    }
    return { ok: true, type: t };
  }
  if (t === 'voice') {
    return { ok: false, error: 'Window araçları: foto/video · quote · müzik', code: 'WINDOW_TOOL_FORBIDDEN' };
  }
  if (!allowed.includes(mapped) && t !== 'text' && t !== 'user' && t !== 'quote') {
    if (t === 'photo' || t === 'video' || t === 'music' || t === 'playlist') return { ok: true, type: mapped };
  }
  return { ok: true, type: mapped };
}

export function remoteWalkInCta({ doorPolicy, eventWalkInClosed } = {}) {
  if (eventWalkInClosed) {
    return {
      enabled: false,
      label: 'Şimdi Masa Aç',
      copy: 'Bu gece kapı event’in',
      code: 'EVENT_WALKIN_CLOSED',
    };
  }
  if (String(doorPolicy || '').toUpperCase() === 'SHELF_ONLY') {
    return {
      enabled: false,
      label: 'Şimdi Masa Aç',
      copy: 'Bu mekân yalnız raf ile açılır',
      code: 'SHELF_ONLY',
    };
  }
  return {
    enabled: false,
    label: 'Şimdi Masa Aç',
    copy: 'Mekandayken figürü okut — bu kapı fiziksel.',
    code: 'REMOTE_WALKIN_DISABLED',
  };
}

/** EK-27: foto/video çekimi önce RULO; window’a yalnız Rulo’dan yayın. */
export function assertCameraRollFirst({ type, status } = {}) {
  if (LOCAL_CONFIG.window_tools?.CAMERA_ROLL_FIRST === false) return { ok: true };
  const st = String(status || 'published').toLowerCase();
  if (st === 'draft') return { ok: true };
  const t = String(type || '').toLowerCase();
  if (t === 'photo' || t === 'video' || t === 'media') {
    return {
      ok: false,
      error: 'Çekim önce Rulo’ya iner — window’a Rulo’dan seçerek gönder',
      code: 'CAMERA_ROLL_FIRST',
    };
  }
  return { ok: true };
}
