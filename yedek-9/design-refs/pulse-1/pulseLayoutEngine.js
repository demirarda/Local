/**
 * Pulse Layout Engine
 * Backend'den gelen memory/event/media item'larını bento grid layout'lara dönüştürür.
 *
 * Kurallar:
 * 1. Her row bir "layout tipi"nde (full/dual/asym/triple)
 * 2. Aynı layout 2 kez arka arkaya gelmez (ritim)
 * 3. Ağırlıklı seçim (bazı layoutlar daha sık, bazıları nadir)
 * 4. Memory önceliği (%70), event destekleyici (%30)
 *
 * Sonuç: rows = [{ layout, items, id }]
 * Her row PulseScreen'de FlatList item olarak render edilir.
 */

const LAYOUTS = [
  // FULL (tek kart, tüm genişlik)
  'full-hero',
  'full-quote',
  'full-live',
  'full-spotify-track',
  'full-now-playing',
  'full-audio-story',
  'full-venue-ambiance',
  'full-group-voice',

  // DUAL (2 kart yan yana, eşit)
  'dual-square',
  'dual-mini-quote',
  'dual-mixed',
  'dual-spotify-mix',
  'dual-audio-mix',

  // ASYMMETRIC (1/3 + 2/3 veya tersi)
  'asym-left-mix',
  'asym-right-mix',
  'asym-spotify-playlist',
  'asym-audio-mix',

  // TRIPLE (3 küçük kart)
  'triple-square',
];

/**
 * Ağırlıklar - büyük sayı daha sık anlamında
 */
const WEIGHTS = {
  'full-hero': 3,
  'full-quote': 2,
  'full-live': 1,
  'full-spotify-track': 2,
  'full-now-playing': 1,
  'full-audio-story': 2,
  'full-venue-ambiance': 1,
  'full-group-voice': 2,
  'dual-square': 3,
  'dual-mini-quote': 2,
  'dual-mixed': 3,
  'dual-spotify-mix': 2,
  'dual-audio-mix': 2,
  'asym-left-mix': 2,
  'asym-right-mix': 2,
  'asym-spotify-playlist': 2,
  'asym-audio-mix': 2,
  'triple-square': 1,
};

/**
 * Her layout için kaç item gerekli
 */
const ITEM_COUNT = {
  'full-hero': 1,
  'full-quote': 1,
  'full-live': 1,
  'full-spotify-track': 1,
  'full-now-playing': 1,
  'full-audio-story': 1,
  'full-venue-ambiance': 1,
  'full-group-voice': 1,
  'dual-square': 2,
  'dual-mini-quote': 2,
  'dual-mixed': 2,
  'dual-spotify-mix': 2,
  'dual-audio-mix': 2,
  'asym-left-mix': 2,
  'asym-right-mix': 2,
  'asym-spotify-playlist': 2,
  'asym-audio-mix': 2,
  'triple-square': 3,
};

/**
 * Her layout hangi card type(s)'ı kabul eder
 */
const LAYOUT_ACCEPTS = {
  'full-hero': ['hero'],
  'full-quote': ['quote'],
  'full-live': ['live'],
  'full-spotify-track': ['spotifyTrack'],
  'full-now-playing': ['nowPlaying'],
  'full-audio-story': ['audioStory'],
  'full-venue-ambiance': ['venueAmbiance'],
  'full-group-voice': ['groupVoice'],
  'dual-square': ['square', 'square'],
  'dual-mini-quote': ['miniQuote', 'miniQuote'],
  'dual-mixed': ['any-small', 'any-small'],
  'dual-spotify-mix': ['spotifyPlaylist', 'any-small'],
  'dual-audio-mix': ['voiceMemo', 'any-small'],
  'asym-left-mix': ['miniQuote|voiceMemo', 'square|event-compact'],
  'asym-right-mix': ['square|event-compact', 'miniQuote|voiceMemo'],
  'asym-spotify-playlist': ['miniQuote', 'spotifyPlaylist'],
  'asym-audio-mix': ['voiceMemo|miniQuote', 'square'],
  'triple-square': ['square', 'square', 'square'],
};

// === Helpers ===

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Ağırlıklı random seçim. excludedLayout varsa onu çıkarır.
 */
function weightedPick(excludedLayout = null) {
  const available = LAYOUTS.filter(l => l !== excludedLayout);
  const weighted = [];
  available.forEach(layout => {
    const w = WEIGHTS[layout] || 1;
    for (let i = 0; i < w; i++) weighted.push(layout);
  });
  return pickOne(weighted);
}

/**
 * Item'ları type'a göre grupla
 *
 * Item shape: { id, type, ...data }
 * Type değerleri: 'hero' | 'square' | 'quote' | 'miniQuote' | 'polaroid'
 *                 | 'event' | 'live'
 *                 | 'spotifyTrack' | 'spotifyPlaylist' | 'nowPlaying'
 *                 | 'voiceMemo' | 'audioStory' | 'venueAmbiance' | 'groupVoice'
 */
function groupByType(items) {
  const groups = {};
  items.forEach(item => {
    if (!groups[item.type]) groups[item.type] = [];
    groups[item.type].push(item);
  });
  return groups;
}

/**
 * Layout'un kabul ettiği item'ı pool'dan bul ve çıkar
 */
function takeFromPool(pool, accept) {
  // accept = 'hero' | 'miniQuote|voiceMemo' | 'any-small' | ...
  let candidateTypes = [];

  if (accept === 'any-small') {
    candidateTypes = ['square', 'miniQuote', 'polaroid', 'voiceMemo'];
  } else if (accept.includes('|')) {
    candidateTypes = accept.split('|');
  } else if (accept === 'event-compact') {
    candidateTypes = ['event'];
  } else {
    candidateTypes = [accept];
  }

  for (const type of candidateTypes) {
    if (pool[type] && pool[type].length > 0) {
      return { item: pool[type].shift(), type };
    }
  }
  return null;
}

/**
 * Bir row için layout + itemlar üret
 */
function buildRow(pool, excludedLayout) {
  // Layout seç
  let attempts = 0;
  let layout;
  let items = null;

  while (attempts < 10) {
    layout = weightedPick(excludedLayout);
    const accepts = LAYOUT_ACCEPTS[layout];
    const poolSnapshot = JSON.parse(JSON.stringify(pool)); // deep clone for rollback

    items = [];
    let success = true;
    for (const accept of accepts) {
      const taken = takeFromPool(poolSnapshot, accept);
      if (!taken) {
        success = false;
        break;
      }
      items.push(taken);
    }

    if (success) {
      // Pool'dan gerçekten çıkar (snapshot'ta değil)
      // Basit yöntem: pool'u snapshot ile override et
      Object.keys(pool).forEach(k => delete pool[k]);
      Object.assign(pool, poolSnapshot);
      return { layout, items, id: `row_${Date.now()}_${Math.random()}` };
    }

    attempts++;
    excludedLayout = null; // fallback: allow any layout
  }

  // Fallback: en basit layout ile devam et (ilk mevcut item'ı al)
  for (const [type, list] of Object.entries(pool)) {
    if (list.length > 0) {
      const item = list.shift();
      return {
        layout: 'full-hero', // generic fallback
        items: [{ item, type }],
        id: `row_fallback_${Date.now()}_${Math.random()}`,
      };
    }
  }

  return null;
}

/**
 * Ana entry point.
 * Backend item array'ini bento row'lara dönüştürür.
 *
 * @param {Array} items - [{ id, type, ...data }, ...]
 * @param {Object} options
 * @param {number} options.maxRows - Maksimum row sayısı
 * @returns {Array} rows
 */
export function buildPulseLayout(items, options = {}) {
  const { maxRows = 20 } = options;
  if (!items || items.length === 0) return [];

  // Item'ları type'a göre grupla ve karıştır
  const grouped = groupByType(items);
  Object.keys(grouped).forEach(type => {
    grouped[type] = shuffle(grouped[type]);
  });

  const rows = [];
  let lastLayout = null;
  let rowCount = 0;

  while (rowCount < maxRows) {
    // Pool'da hiç item kaldı mı?
    const remaining = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
    if (remaining === 0) break;

    const row = buildRow(grouped, lastLayout);
    if (!row) break;

    rows.push(row);
    lastLayout = row.layout;
    rowCount++;
  }

  return rows;
}

/**
 * Layout metadata - PulseScreen'de render için
 */
export const layoutMeta = {
  isFullWidth: (layout) => layout.startsWith('full-'),
  isDual: (layout) => layout.startsWith('dual-'),
  isAsym: (layout) => layout.startsWith('asym-'),
  isTriple: (layout) => layout.startsWith('triple-'),
  getColumns: (layout) => {
    if (layout.startsWith('full-')) return 1;
    if (layout.startsWith('dual-')) return 2;
    if (layout.startsWith('asym-')) return 2;
    if (layout.startsWith('triple-')) return 3;
    return 1;
  },
};

export default { buildPulseLayout, layoutMeta };
