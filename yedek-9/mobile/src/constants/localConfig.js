/**
 * son-part.md §12 — mobile fallback mirror (backend localConfig.js ile senkron)
 * Canlı değerler GET /api/config/public üzerinden configStore ile güncellenir.
 */

export const DEFAULT_PUBLIC_CONFIG = {
  version: '1.0.0',
  ritual: {
    min_size: 3,
    duration_min_minutes: 30,
    duration_max_minutes: 24 * 60,
    window_hours_options: [3, 6, 12, 24],
    window_hours_default: 12,
    grace_minutes: 10,
    cancel_free_threshold_pct: 0.25,
    feedback_floor_hours: 12,
    /** sonMD: mutlak tek-masa tavanı 40 🔒 */
    custom_max_cap: 40,
    /** kategori soft önerisi (host aşabilir, uyarı) */
    category_soft_caps: {
      sohbet_tartisma: { soft_min: 3, soft_max: 12 },
      kahve_bulusmasi: { soft_min: 3, soft_max: 12 },
      Coffee: { soft_min: 3, soft_max: 12 },
      yemek_masasi: { soft_min: 3, soft_max: 14 },
      kitap_okuma: { soft_min: 3, soft_max: 12 },
      oyun_masasi: { soft_min: 3, soft_max: 16 },
      film_izleme: { soft_min: 3, soft_max: 16 },
      muzik_jam: { soft_min: 3, soft_max: 16 },
      dil_tandem: { soft_min: 3, soft_max: 12 },
      yuruyus_kosu: { soft_min: 3, soft_max: 30 },
      piknik_acik_hava: { soft_min: 3, soft_max: 24 },
      takim_spor: { soft_min: 6, soft_max: 30 },
      atolye_ogrenme: { soft_min: 3, soft_max: 20 },
      gezi_kesif: { soft_min: 3, soft_max: 16 },
      diger: { soft_min: 3, soft_max: 12 },
    },
  },
  checkin: {
    kapi_pct: 0.2,
    kapi_min_minutes: 10,
    kapi_max_minutes: 60,
    ais_full_threshold_pct: 0.6,
    ais_reduced: 1.0,
    ais_late: 0.85,
    gps_radius_meters: {
      custom: 30,
      venue: 50,
      venue_dense: 75,
      zone: 75,
      zone_max: 100,
      moving: 15,
      scheduled: 50,
      ferry: 50,
    },
    pending_seal_watch: 0.1,
    pending_seal_alarm: 0.15,
    android_location_education:
      'Beton kanyonlarda GPS sapar. Hassas konum izni mühür için gerekli — yaklaşık konum yetmez. Kapı önünde durun.',
  },
  /** buradasın bileti — kozmetik mod TTL (yetki yok) */
  presence: {
    ticket_ttl_min: 90,
  },
  badges: {
    highlight_user: 3,
    highlight_venue: 5,
  },
  venue: {
    badge_max: 5,
    badge_highlight_venue: 5,
    oturma: [2, 10],
  },
  regular: {
    threshold: 4,
    n: 4,
    window_d: 45,
    decay_d: 60,
    parked: false,
    vitrin_default: false,
    counter_ui: true,
    silent_decay: true,
    badge_ladder: [3, 10, 25],
  },
  rs_display: {
    init: 5.0,
    min: 1.0,
    max: 10.0,
    k_up: 0.15,
    k_down: 0.3,
    cap_pos: 0.12,
    cap_neg: 0.15,
    raw_cap_pos: 0.075,
    raw_cap_neg: 0.3,
    weights: { a: 0.25, iq: 0.3, cf: 0.15, mb: 0.05, if: 0.2 },
    bc: {
      pos_amp: 1.25,
      pos_damp: 0.75,
      neg_amp: 1.35,
      neg_damp: 0.7,
    },
    br_upper: 8.0,
    br_lower: 3.0,
    br_min: 0.4,
    bc5_weights: [0.1, 0.15, 0.2, 0.25, 0.3],
  },
  ds_display: {
    alpha: 0.3,
    weights: [0.6, 0.3, 0.1],
    mult_new: [0.55, 0.55],
    mult_mature: [0.45, 0.75],
    fl_w: [1.0, 0.85, 0.55, 0.2],
    regular_w: 0.3,
    max_window_capacity: 12,
    tier_thresholds: [0.35, 0.5, 0.65, 0.8],
  },
  fl_display: {
    thresholds: [1, 4, 8],
    freshness_months: 12,
    fb_weights: [1.0, 0.5, 0.0],
  },
  music_sdk_enabled: false,
  live_avatar: {
    enabled: false,
    parked: true,
    label: 'Canlı avatar',
    phase: 'v1.5 parked',
  },
  stubs: {
    slot_economy_enabled: true,
    music_sync: { enabled: false, label: 'Music Synced Playback', phase: 'Yıl 1+' },
    music_sdk: {
      enabled: false,
      label: 'Window-içi müzik SDK',
      phase: 'v1.5 stub · MUSIC_SDK_ENABLED:false',
    },
    live_avatar: {
      enabled: false,
      parked: true,
      label: 'Canlı avatar',
      phase: 'v1.5 parked · galeri avatar serbest',
    },
    brand_host: { enabled: false, label: 'Brand Host', phase: 'Faz 1+' },
    friends_dm: { enabled: false, label: 'Friends-DM', phase: 'F1.5 · launch kapalı · yalnız karşılıklı arkadaşlar' },
    waitlist: { enabled: true, label: 'Waitlist', phase: 'F1.5 · masa dolunca yıldız listesi' },
    role_slot: { enabled: false, label: 'Rol-slot', phase: 'LATER park' },
    series_regular: { enabled: false, label: 'Series-Regular', phase: 'F1.5 RAF · launch kapalı' },
    ritual_designer: { enabled: false, label: 'Ritual Designer', phase: 'F2 RAF' },
    web_showcase: {
      enabled: false,
      label: 'Web-vitrin',
      phase: '§12 salt-okunur vitrin · WEB_SHOWCASE_ENABLED:false',
    },
    ios_proximity_add: { enabled: false, label: 'iOS Yaklaştır-Ekle', phase: 'v1.5' },
    badge_llm_pipeline: { enabled: false, label: 'Badge LLM Pipeline', phase: 'admin onay' },
    venue_payment: {
      stripe_enabled: false,
      checkout_mode: 'request_queue',
      phase: 'Faz 1+',
      label: 'OPERATÖR / HAKİM odeme',
    },
    csam: {
      status: 'ops_review_fallback',
      live: false,
      hold_enforced: true,
    },
  },
  zone: { spark_enabled: false },
  chip_bridge: { enabled: false, open: false, min_repeats: 3 },
};

export function liveWindowHoursOf(ritual, config = DEFAULT_PUBLIC_CONFIG) {
  const n = Number(ritual?.live_window_hours);
  if (Number.isFinite(n) && n > 0) return n;
  return Number(config?.ritual?.window_hours_default) || 12;
}

/** @param {typeof DEFAULT_PUBLIC_CONFIG} config */
export function buildLiveWindowOptions(config = DEFAULT_PUBLIC_CONFIG) {
  return (config.ritual?.window_hours_options || [3, 6, 12, 24]).map((value) => ({
    value,
    label: `${value}h`,
  }));
}

/** @param {typeof DEFAULT_PUBLIC_CONFIG} config */
export function buildLocationTypeOptions(config = DEFAULT_PUBLIC_CONFIG) {
  const gps = config.checkin?.gps_radius_meters || DEFAULT_PUBLIC_CONFIG.checkin.gps_radius_meters;
  return [
    { value: 'custom', label: 'Custom', description: `${gps.custom}m GPS` },
    { value: 'venue', label: 'Venue', description: `${gps.venue}m GPS` },
    {
      value: 'zone',
      label: 'Zone',
      description: `${gps.zone}-${gps.zone_max || gps.zone}m GPS`,
    },
    { value: 'moving', label: 'Moving', description: `${gps.moving}m GPS` },
    {
      value: 'scheduled',
      label: 'Tarifeli/Vapur',
      description: `${gps.scheduled || gps.ferry || gps.venue}m GPS · tek sefer`,
    },
  ];
}

export function isScheduledLocationType(locationType) {
  const k = String(locationType || '').toLowerCase();
  return k === 'scheduled' || k === 'ferry' || k === 'tarifeli' || k === 'vapur';
}

/** @param {typeof DEFAULT_PUBLIC_CONFIG} config */
export function getGpsBoundsForLocationType(locationType, config = DEFAULT_PUBLIC_CONFIG) {
  const gps = config.checkin?.gps_radius_meters || DEFAULT_PUBLIC_CONFIG.checkin.gps_radius_meters;
  const key = String(locationType || 'custom').toLowerCase();
  if (key === 'venue') return { min: gps.venue, max: gps.venue };
  if (key === 'zone') return { min: gps.zone, max: gps.zone_max || gps.zone };
  if (key === 'moving') return { min: gps.moving, max: gps.moving };
  if (key === 'scheduled' || key === 'ferry' || key === 'tarifeli' || key === 'vapur') {
    const r = gps.scheduled || gps.ferry || gps.venue;
    return { min: r, max: r };
  }
  return { min: gps.custom, max: gps.custom };
}

/** @param {typeof DEFAULT_PUBLIC_CONFIG} config */
export function getHighlightUserMax(config = DEFAULT_PUBLIC_CONFIG) {
  return config.badges?.highlight_user ?? 3;
}

/** @param {typeof DEFAULT_PUBLIC_CONFIG} config */
export function getHighlightVenueMax(config = DEFAULT_PUBLIC_CONFIG) {
  return config.badges?.highlight_venue ?? config.venue?.badge_highlight_venue ?? 5;
}

/** @param {typeof DEFAULT_PUBLIC_CONFIG} config */
export function buildRsDisplayLines(config = DEFAULT_PUBLIC_CONFIG) {
  const rs = config.rs_display || DEFAULT_PUBLIC_CONFIG.rs_display;
  const ds = config.ds_display || DEFAULT_PUBLIC_CONFIG.ds_display;
  const w = rs.weights || {};
  return [
    `INIT_RS = ${rs.init}`,
    `RS_MIN = ${rs.min}`,
    `RS_MAX = ${rs.max}`,
    `K_UP = ${rs.k_up}`,
    `K_DOWN = ${rs.k_down}`,
    `Ritual delta cap = +${rs.cap_pos} / -${rs.cap_neg}`,
    `Raw delta cap = +${rs.raw_cap_pos} / -${rs.raw_cap_neg}`,
    `Weights(A/IQ/CF/M/IF) = ${w.a} / ${w.iq} / ${w.cf} / ${w.mb} / ${w.if}`,
    `DS_BASE(1-20)=${ds.mult_new[0]}, DS_COEF(1-20)=${ds.mult_new[1]}`,
    `DS_BASE(21+)=${ds.mult_mature[0]}, DS_COEF(21+)=${ds.mult_mature[1]}`,
    `DS_EMA_ALPHA = ${ds.alpha}`,
    `BC5_WINDOW = son 5 Ritual (${rs.bc5_weights.join(' / ')})`,
    `BR_UPPER = ${rs.br_upper}, BR_LOWER = ${rs.br_lower}, BR_MIN = ${rs.br_min}`,
  ];
}
