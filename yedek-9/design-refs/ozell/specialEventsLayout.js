/**
 * Special Events Layout Engine
 *
 * Random bento layout engine. 7 farklı kart boyutu, her row farklı kombinasyon.
 * Pulse'un layoutEngine'inin Special Events varyantı.
 *
 * Layout kuralları:
 *   - Aynı layout tipi arka arkaya gelmesin
 *   - Her 4 row'da en az 1 görsel-ağırlıklı (hero/full/half-tall)
 *   - Her 6 row'da en az 1 ritm kırıcı (micro/wide-short)
 *   - Priority score yüksek kartlar feed'in üst kısmına yerleşsin
 */

import { priorityScore } from './eventAvailability';

/**
 * Card size types - kart boyutları
 */
export const CARD_SIZES = {
  HERO: 'hero',           // full-width, 280px+ cinematic
  FULL: 'full',           // full-width editorial
  HALF_TALL: 'half-tall', // dual grid 3/5 ratio
  SQUARE: 'square',       // dual grid 1/1.15 ratio
  WIDE_SHORT: 'wide-short', // full-width thin horizontal
  POSTER: 'poster',       // triple grid 3/4.5 portrait
  MICRO: 'micro',         // dual grid küçük chip
};

/**
 * Row layout types - row kompozisyonları
 */
export const ROW_LAYOUTS = {
  HERO: 'hero',                     // 1 hero full-width
  FULL: 'full',                     // 1 full editorial
  WIDE_SHORT: 'wide-short',         // 1 wide-short thin
  DUAL_HALF_TALL: 'dual-half-tall', // 2 half-tall
  DUAL_SQUARE: 'dual-square',       // 2 square
  DUAL_MICRO: 'dual-micro',         // 2 micro chips
  ASYM_MICRO_TALL: 'asym-micro-tall',   // micro + half-tall
  ASYM_TALL_MICRO: 'asym-tall-micro',   // half-tall + micro
  ASYM_SQUARE_TALL: 'asym-square-tall', // square + half-tall (asym)
  TRIPLE_POSTER: 'triple-poster',   // 3 poster yan yana
};

/**
 * Hangi row layout'u hangi kart tipi(leri) kullanıyor?
 */
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

/**
 * Item'a göre hangi kart boyutu tercih edilir?
 * Curation signal + availability state'e göre.
 */
export function preferredCardSize(item) {
  const signals = item.curationSignals || [];
  const computed = item._computed || {};

  // Super Events → HERO
  if (signals.includes('super-event')) return CARD_SIZES.HERO;

  // Special Guest portraits → POSTER (triple)
  if (signals.includes('special-guest') && item.guestPortrait) {
    return CARD_SIZES.POSTER;
  }

  // Past memories → SQUARE
  if (item.isPastMemory) return CARD_SIZES.SQUARE;

  // Micro announcements (quick-glance events)
  if (item.quickGlance) return CARD_SIZES.MICRO;

  // Limited urgent OR partner/guest announcements → WIDE_SHORT
  if (computed.isLimited || signals.includes('partner')) {
    // Partnership full editorial'ı varsa full'a düşer
    if (item.hasFullContent) return CARD_SIZES.FULL;
    return CARD_SIZES.WIDE_SHORT;
  }

  // Premium / editorial / curated → FULL
  if (signals.includes('premium') || signals.includes('editors-pick')) {
    return CARD_SIZES.FULL;
  }

  // Default → HALF_TALL (orta önemli)
  return CARD_SIZES.HALF_TALL;
}

/**
 * Fisher-Yates shuffle (deterministic seed opsiyonel)
 */
function shuffle(array, seed) {
  const arr = [...array];
  let random = seed != null ? seededRandom(seed) : Math.random;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Item pool'dan belirli bir card size ihtiyacını karşılayan item'ları bul.
 *
 * @param {Array} pool
 * @param {string} cardSize
 * @param {number} count
 * @returns {Array|null} - uygun item'lar veya null (yeterli yoksa)
 */
function findItemsForSize(pool, cardSize, count) {
  const matching = pool.filter((item) => preferredCardSize(item) === cardSize);
  if (matching.length < count) return null;
  return matching.slice(0, count);
}

/**
 * Pool'dan item çıkar (layout'a yerleştirildikten sonra).
 */
function removeItems(pool, items) {
  const ids = new Set(items.map((i) => i.id));
  return pool.filter((item) => !ids.has(item.id));
}

/**
 * Bir sonraki row layout'u seç. Son 2 row'u tekrarlamamaya çalışır.
 * Available pool'a göre adaptif davranır.
 */
function pickNextLayout(pool, lastLayouts, rowIndex) {
  // Pool'daki card size dağılımını analiz et
  const sizeCount = {};
  pool.forEach((item) => {
    const size = preferredCardSize(item);
    sizeCount[size] = (sizeCount[size] || 0) + 1;
  });

  // Hangi layout'lar şu an mümkün?
  const feasible = Object.entries(LAYOUT_CARD_NEEDS)
    .filter(([_, needs]) =>
      Object.entries(needs).every(([size, n]) => (sizeCount[size] || 0) >= n)
    )
    .map(([layout]) => layout);

  if (feasible.length === 0) return null;

  // Son 2 layout'tan farklı olanları tercih et
  const notRecent = feasible.filter((l) => !lastLayouts.includes(l));
  const candidates = notRecent.length > 0 ? notRecent : feasible;

  // Ritm kuralı: her 4 row'da en az 1 görsel-ağırlıklı (hero/full/dual-half-tall)
  const visualHeavy = [ROW_LAYOUTS.HERO, ROW_LAYOUTS.FULL, ROW_LAYOUTS.DUAL_HALF_TALL];
  const hasRecentVisual = lastLayouts.some((l) => visualHeavy.includes(l));
  if (rowIndex >= 3 && !hasRecentVisual) {
    const visualCandidates = candidates.filter((l) => visualHeavy.includes(l));
    if (visualCandidates.length > 0) {
      return randomPick(visualCandidates);
    }
  }

  // Ritm kuralı: her 6 row'da en az 1 ritm kırıcı (micro/wide-short)
  const breakers = [ROW_LAYOUTS.WIDE_SHORT, ROW_LAYOUTS.DUAL_MICRO, ROW_LAYOUTS.ASYM_MICRO_TALL, ROW_LAYOUTS.ASYM_TALL_MICRO];
  const hasRecentBreaker = lastLayouts.some((l) => breakers.includes(l));
  if (rowIndex >= 5 && !hasRecentBreaker) {
    const breakerCandidates = candidates.filter((l) => breakers.includes(l));
    if (breakerCandidates.length > 0) {
      return randomPick(breakerCandidates);
    }
  }

  return randomPick(candidates);
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Ana layout engine.
 * Enriched item listesini row'lara dönüştürür.
 *
 * @param {Array} items - enrichWithAvailability'den geçmiş item'lar
 * @param {object} options - { seed, maxRows }
 * @returns {Array<Row>} - [{ layout, items: [...] }]
 */
export function buildFeedLayout(items, options = {}) {
  if (!items || items.length === 0) return [];

  const { maxRows = 100 } = options;

  // Priority score'a göre sırala
  let pool = [...items].sort((a, b) => priorityScore(b) - priorityScore(a));

  // İlk item Super Event ise onu hero olarak kullan
  const rows = [];
  const firstItem = pool[0];

  if (firstItem && firstItem.curationSignals?.includes('super-event')) {
    rows.push({ layout: ROW_LAYOUTS.HERO, items: [firstItem] });
    pool = pool.slice(1);
  }

  // Kalan havuzu shuffle et — random hissi için
  // Ama priority yüksek olanları öne tutmak için soft shuffle:
  // Top %30'u kendi içinde shuffle, geri kalanını kendi içinde shuffle
  const topCutoff = Math.ceil(pool.length * 0.3);
  const topHalf = shuffle(pool.slice(0, topCutoff));
  const bottomHalf = shuffle(pool.slice(topCutoff));
  pool = [...topHalf, ...bottomHalf];

  const lastLayouts = rows.map((r) => r.layout).slice(-2);

  while (pool.length > 0 && rows.length < maxRows) {
    const rowIndex = rows.length;
    const layout = pickNextLayout(pool, lastLayouts, rowIndex);

    if (!layout) {
      // Fallback: kalan item'ları FULL olarak bas
      const item = pool[0];
      rows.push({ layout: ROW_LAYOUTS.FULL, items: [item] });
      pool = pool.slice(1);
      lastLayouts.push(ROW_LAYOUTS.FULL);
      if (lastLayouts.length > 2) lastLayouts.shift();
      continue;
    }

    // Gerekli item'ları bul
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
