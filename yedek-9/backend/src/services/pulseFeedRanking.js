/**
 * Pulse / Local World feed ranking — Master §2D LW-Pulse ağırlıkları
 * yer .30 · mesafe .20 · kategori .20 · sosyal-eko .20 · pop .10 (tavanlı)
 */
import LOCAL_CONFIG from '../config/localConfig.js';

function toTs(value) {
  const t = new Date(value || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function getLwPulseWeights() {
  const w = LOCAL_CONFIG.pulse?.LW_WEIGHTS || {
    place: 0.3,
    distance: 0.2,
    category: 0.2,
    social: 0.2,
    pop: 0.1,
  };
  return {
    place: Number(w.place) || 0.3,
    distance: Number(w.distance) || 0.2,
    category: Number(w.category) || 0.2,
    social: Number(w.social) || 0.2,
    pop: Number(w.pop) || 0.1,
  };
}

/**
 * Weighted LW score from normalized 0–1 components.
 * @param {{ place?: number, distance?: number, category?: number, social?: number, pop?: number }} components
 */
export function scoreLwPulse(components = {}) {
  const w = getLwPulseWeights();
  const popCap = Number(LOCAL_CONFIG.pulse?.LW_POP_CAP ?? 1);
  const place = clamp01(components.place);
  const distance = clamp01(components.distance);
  const category = clamp01(components.category);
  const social = clamp01(components.social);
  const pop = Math.min(popCap, clamp01(components.pop));
  const raw =
    w.place * place +
    w.distance * distance +
    w.category * category +
    w.social * social +
    w.pop * pop;
  return Math.max(0, Math.min(1, raw));
}

/** Recency → 0–1 pop proxy (24h half-life-ish within fresh window). */
function recencyPop(ts, freshHours = 24) {
  const ageMs = Math.max(0, Date.now() - toTs(ts));
  const windowMs = Math.max(1, Number(freshHours) || 24) * 3600 * 1000;
  return clamp01(1 - ageMs / windowMs);
}

function sameCity(a, b) {
  if (!a || !b) return 0.5;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase() ? 1 : 0.35;
}

export function decodePulseCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(String(cursor), 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      score: Number(parsed.score) || 0,
      createdAt: String(parsed.createdAt || ''),
      id: String(parsed.id || ''),
    };
  } catch (_e) {
    return null;
  }
}

export function encodePulseCursor(item) {
  const payload = {
    score: Number(item?.ranking_score || 0),
    createdAt: String(item?.created_at || ''),
    id: String(item?.cursor_id || item?.id || ''),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function compareForSort(a, b) {
  const scoreDiff = Number(b.ranking_score || 0) - Number(a.ranking_score || 0);
  if (scoreDiff !== 0) return scoreDiff;
  const timeDiff = toTs(b.created_at) - toTs(a.created_at);
  if (timeDiff !== 0) return timeDiff;
  return String(b.cursor_id || b.id || '').localeCompare(String(a.cursor_id || a.id || ''));
}

export function applyCursorWindow(sortedItems, cursorObj) {
  if (!cursorObj) return sortedItems;
  const cursorScore = Number(cursorObj.score || 0);
  const cursorTs = toTs(cursorObj.createdAt);
  const cursorId = String(cursorObj.id || '');

  return sortedItems.filter((it) => {
    const score = Number(it.ranking_score || 0);
    const ts = toTs(it.created_at);
    const id = String(it.cursor_id || it.id || '');
    if (score < cursorScore) return true;
    if (score > cursorScore) return false;
    if (ts < cursorTs) return true;
    if (ts > cursorTs) return false;
    return id < cursorId;
  });
}

export function sortPulseCandidates(items = []) {
  return [...items].sort(compareForSort);
}

export function mixPulseItems(items = [], limit = 24, memoryRatio = 0.65) {
  const memories = items.filter((x) => x.kind === 'memory');
  const rituals = items.filter((x) => x.kind === 'ritual');
  const out = [];
  let mi = 0;
  let ri = 0;

  while (out.length < limit && (mi < memories.length || ri < rituals.length)) {
    const targetMemories = Math.ceil((out.length + 1) * memoryRatio);
    const canTakeMemory = mi < memories.length;
    const canTakeRitual = ri < rituals.length;
    const shouldTakeMemory = canTakeMemory && (!canTakeRitual || mi < targetMemories);

    if (shouldTakeMemory) {
      out.push(memories[mi++]);
    } else if (canTakeRitual) {
      out.push(rituals[ri++]);
    } else if (canTakeMemory) {
      out.push(memories[mi++]);
    }
  }

  return out;
}

export function getPulseMemoryRatio() {
  const fromEnv = Number(process.env.PULSE_MEMORY_RATIO || 0.68);
  if (!Number.isFinite(fromEnv)) return 0.68;
  return Math.min(0.9, Math.max(0.35, fromEnv));
}

/**
 * Master §2D LW-Pulse — memory candidate
 * @param {object} memory
 * @param {{ city?: string, viewerCity?: string, categoryMatch?: number, social?: number, distance?: number }} [ctx]
 */
export function scoreMemoryCandidate(memory, ctx = {}) {
  const freshHours = LOCAL_CONFIG.pulse?.FRESH_HOURS ?? 24;
  const place = sameCity(memory.author_city || memory.city || memory.host_city, ctx.city || ctx.viewerCity);
  const distance = ctx.distance != null ? clamp01(ctx.distance) : place >= 1 ? 0.85 : 0.4;
  const category = clamp01(ctx.categoryMatch ?? 0.5);
  const social = clamp01(ctx.social ?? (Number(memory.friends_here) > 0 ? 0.7 : 0.35));
  const pop = recencyPop(memory.created_at || memory.published_at, freshHours);
  // Scale 0–1 score into sortable magnitude while preserving LW order over pure chronology
  return scoreLwPulse({ place, distance, category, social, pop }) * 1e15 + toTs(memory.created_at);
}

/**
 * Master §2D LW-Pulse — ritual candidate
 * @param {object} ritual
 * @param {{ city?: string, viewerCity?: string, categoryMatch?: number, social?: number, distance?: number }} [ctx]
 */
export function scoreRitualCandidate(ritual, ctx = {}) {
  const isLive = ritual.status === 'live' || ritual.time_state === 'live_now';
  const freshHours = LOCAL_CONFIG.pulse?.FRESH_HOURS ?? 24;
  const place = sameCity(ritual.host_city || ritual.city, ctx.city || ctx.viewerCity);
  const distance = ctx.distance != null ? clamp01(ctx.distance) : place >= 1 ? 0.85 : 0.4;
  const category = clamp01(ctx.categoryMatch ?? 0.5);
  const social = clamp01(
    ctx.social ??
      Math.min(1, (Number(ritual.friends_here) || 0) * 0.25 + (ritual.is_friend_hosting ? 0.35 : 0))
  );
  const popBase = recencyPop(ritual.start_time || ritual.created_at, freshHours);
  const pop = isLive ? Math.min(1, popBase + 0.35) : popBase;
  const lw = scoreLwPulse({ place, distance, category, social, pop });
  const liveBoost = isLive ? 1e15 : 0;
  return liveBoost + lw * 1e15 + toTs(ritual.start_time || ritual.created_at);
}
