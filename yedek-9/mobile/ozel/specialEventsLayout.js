import { priorityScore } from './eventAvailability';

export const CARD_SIZES = {
  HERO: 'hero',
  FULL: 'full',
  HALF_TALL: 'half-tall',
  SQUARE: 'square',
  WIDE_SHORT: 'wide-short',
  POSTER: 'poster',
  MICRO: 'micro',
};

export const ROW_LAYOUTS = {
  HERO: 'hero',
  FULL: 'full',
  WIDE_SHORT: 'wide-short',
  DUAL_HALF_TALL: 'dual-half-tall',
  DUAL_SQUARE: 'dual-square',
  DUAL_MICRO: 'dual-micro',
  ASYM_MICRO_TALL: 'asym-micro-tall',
  ASYM_TALL_MICRO: 'asym-tall-micro',
  ASYM_SQUARE_TALL: 'asym-square-tall',
  TRIPLE_POSTER: 'triple-poster',
};

const LAYOUT_CARD_NEEDS = {
  [ROW_LAYOUTS.HERO]: { hero: 1 },
  [ROW_LAYOUTS.FULL]: { full: 1 },
  [ROW_LAYOUTS.WIDE_SHORT]: { 'wide-short': 1 },
  [ROW_LAYOUTS.DUAL_HALF_TALL]: { 'half-tall': 2 },
  [ROW_LAYOUTS.DUAL_SQUARE]: { square: 2 },
  [ROW_LAYOUTS.DUAL_MICRO]: { micro: 2 },
  [ROW_LAYOUTS.ASYM_MICRO_TALL]: { micro: 1, 'half-tall': 1 },
  [ROW_LAYOUTS.ASYM_TALL_MICRO]: { 'half-tall': 1, micro: 1 },
  [ROW_LAYOUTS.ASYM_SQUARE_TALL]: { square: 1, 'half-tall': 1 },
  [ROW_LAYOUTS.TRIPLE_POSTER]: { poster: 3 },
};

export function preferredCardSize(item) {
  const signals = item.curationSignals || [];
  const computed = item._computed || {};
  if (signals.includes('super-event')) return CARD_SIZES.HERO;
  if (signals.includes('special-guest') && item.guestPortrait) return CARD_SIZES.POSTER;
  if (item.isPastMemory) return CARD_SIZES.SQUARE;
  if (item.quickGlance) return CARD_SIZES.MICRO;
  if (computed.isLimited || signals.includes('partner')) {
    if (item.hasFullContent) return CARD_SIZES.FULL;
    return CARD_SIZES.WIDE_SHORT;
  }
  if (signals.includes('premium') || signals.includes('editors-pick')) return CARD_SIZES.FULL;
  return CARD_SIZES.HALF_TALL;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function findItemsForSize(pool, cardSize, count) {
  const matching = pool.filter((item) => preferredCardSize(item) === cardSize);
  if (matching.length < count) return null;
  return matching.slice(0, count);
}

function removeItems(pool, items) {
  const ids = new Set(items.map((i) => i.id));
  return pool.filter((item) => !ids.has(item.id));
}

function pickNextLayout(pool, lastLayouts, rowIndex) {
  const sizeCount = {};
  pool.forEach((item) => {
    const size = preferredCardSize(item);
    sizeCount[size] = (sizeCount[size] || 0) + 1;
  });

  const feasible = Object.entries(LAYOUT_CARD_NEEDS)
    .filter(([_, needs]) => Object.entries(needs).every(([size, n]) => (sizeCount[size] || 0) >= n))
    .map(([layout]) => layout);
  if (feasible.length === 0) return null;
  const notRecent = feasible.filter((l) => !lastLayouts.includes(l));
  const candidates = notRecent.length > 0 ? notRecent : feasible;

  const visualHeavy = [ROW_LAYOUTS.HERO, ROW_LAYOUTS.FULL, ROW_LAYOUTS.DUAL_HALF_TALL];
  const hasRecentVisual = lastLayouts.some((l) => visualHeavy.includes(l));
  if (rowIndex >= 3 && !hasRecentVisual) {
    const visualCandidates = candidates.filter((l) => visualHeavy.includes(l));
    if (visualCandidates.length > 0) return visualCandidates[Math.floor(Math.random() * visualCandidates.length)];
  }

  const breakers = [ROW_LAYOUTS.WIDE_SHORT, ROW_LAYOUTS.DUAL_MICRO, ROW_LAYOUTS.ASYM_MICRO_TALL, ROW_LAYOUTS.ASYM_TALL_MICRO];
  const hasRecentBreaker = lastLayouts.some((l) => breakers.includes(l));
  if (rowIndex >= 5 && !hasRecentBreaker) {
    const breakerCandidates = candidates.filter((l) => breakers.includes(l));
    if (breakerCandidates.length > 0) return breakerCandidates[Math.floor(Math.random() * breakerCandidates.length)];
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function buildFeedLayout(items, options = {}) {
  if (!items || items.length === 0) return [];
  const { maxRows = 100 } = options;
  let pool = [...items].sort((a, b) => priorityScore(b) - priorityScore(a));
  const rows = [];
  const firstItem = pool[0];
  if (firstItem && firstItem.curationSignals?.includes('super-event')) {
    rows.push({ layout: ROW_LAYOUTS.HERO, items: [firstItem] });
    pool = pool.slice(1);
  }

  const topCutoff = Math.ceil(pool.length * 0.3);
  const topHalf = shuffle(pool.slice(0, topCutoff));
  const bottomHalf = shuffle(pool.slice(topCutoff));
  pool = [...topHalf, ...bottomHalf];

  const lastLayouts = rows.map((r) => r.layout).slice(-2);
  while (pool.length > 0 && rows.length < maxRows) {
    const rowIndex = rows.length;
    const layout = pickNextLayout(pool, lastLayouts, rowIndex);
    if (!layout) {
      const item = pool[0];
      rows.push({ layout: ROW_LAYOUTS.FULL, items: [item] });
      pool = pool.slice(1);
      lastLayouts.push(ROW_LAYOUTS.FULL);
      if (lastLayouts.length > 2) lastLayouts.shift();
      continue;
    }

    const needs = LAYOUT_CARD_NEEDS[layout];
    const rowItems = [];
    for (const [cardSize, count] of Object.entries(needs)) {
      const found = findItemsForSize(pool, cardSize, count);
      if (!found) {
        rowItems.length = 0;
        break;
      }
      rowItems.push(...found);
      pool = removeItems(pool, found);
    }
    if (rowItems.length === 0) continue;
    rows.push({ layout, items: rowItems });
    lastLayouts.push(layout);
    if (lastLayouts.length > 2) lastLayouts.shift();
  }
  return rows;
}
