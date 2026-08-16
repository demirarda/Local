/**
 * LOCAL canonical runtime config — son-part.md §12
 * ⭐ Tüm kalibre parametreler burada. Launch sonrası saha kalibrasyonu bu dosyadan (veya DB override) yapılır.
 * Kod içine sabit gömme — bu dosyayı import et.
 */

export const LOCAL_CONFIG_VERSION = '2.0.0';

/** @type {const} */
export const LOCAL_CONFIG = {
  version: LOCAL_CONFIG_VERSION,

  rs: {
    INIT: 5.0,
    MIN: 1.0,
    MAX: 10.0,
    THRESHOLD: 0.5,
    K_UP: 0.15,
    K_DOWN: 0.3,
    CAP_POS: 0.12,
    CAP_NEG: 0.15,
    BYPASS_CAP_NEG: 0.2,
    RAW_CAP_POS: 0.075,
    RAW_CAP_NEG: 0.3,
    W_A: 0.25,
    W_IQ: 0.3,
    W_CF: 0.15,
    W_MB: 0.05,
    W_IF: 0.2,
    CF_PEER: 0.65,
    CF_SELF: 0.35,
    /**
     * NO_PEER_PATH (ürün dili: Solo Ritualist — config/kodda yalnız `no_peer`)
     * memory_scope DB enum `solo` = WINDOW legacy; bu RS path ile karıştırma.
     */
    no_peer: {
      NO_PEER_DAMPENER: 0.35,
      NO_PEER_CEILING: 7.5,
      CF_SELF_NO_PEER_W: 0.5,
    },
    /** RS opt-in halka — ham sayı public değil (E3.5) */
    visibility: {
      DEFAULT_PUBLIC: false,
      MIN_RITUALS_FOR_RING: 10,
      TOGGLE_DAYS: 30,
      PUBLIC_RAW_SCORE: false,
    },
    S_POS_MAX: 0.75,
    /** Legacy index — otorite IQ_BLEND_* (Anayasa A2 CONF: n1 %60 nötr / n2 %25 / n≥3 ham) */
    CONF: [0, 0.4, 0.75, 1.0],
    DIVERSITY_REQ_PENALTY: 0.25,
    /** Anayasa A2 — n=1: %60 nötr + %40 raw · n=2: %25 nötr · n≥3: ham */
    IQ_BLEND_N1_NEUTRAL: 0.6,
    IQ_BLEND_N1_RAW: 0.4,
    IQ_BLEND_N2_RAW: 0.75,
    IQ_BLEND_N2_NEUTRAL: 0.25,
    /** IF feedback friction */
    IF_FEEDBACK_MISSING: 0.3, // EMPTY_FB_IF — Master Parametre §4
    IF_FEEDBACK_RED_HEAVY: 0.1,
    IF_LATE_SLICE: 0.25,
    BC: {
      MIN_RITUALS: 4,
      POS_TREND_HIGH: 0.65,
      POS_TREND_MID: 0.5,
      NEG_TREND_LOW: 0.35,
      NEG_TREND_MID: 0.55,
      POS_AMP: 1.25,
      POS_DAMP: 0.75,
      NEG_AMP: 1.35,
      NEG_DAMP: 0.7,
    },
    /** Ritual indeksi 1-based → MD çarpanı (ilk 12 Ritual) */
    MD: [
      { maxRitual: 2, mult: 0.5 },
      { maxRitual: 5, mult: 0.6 },
      { maxRitual: 8, mult: 0.75 },
      { maxRitual: 11, mult: 0.88 },
      { maxRitual: Infinity, mult: 1.0 },
    ],
    BR_UPPER: 8.0,
    BR_LOWER: 3.0,
    BR_MIN: 0.4,
    BC5_WEIGHTS: [0.1, 0.15, 0.2, 0.25, 0.3],
  },

  ds: {
    ALPHA: 0.3,
    W_PD: 0.6,
    W_CTX: 0.3,
    W_VD: 0.1,
    RITUAL_WINDOW: 5,
    INIT: 0.5,
    MULT_NEW_BASE: 0.55,
    MULT_NEW_EMA_COEF: 0.55,
    MULT_MATURE_BASE: 0.45,
    MULT_MATURE_EMA_COEF: 0.75,
    MULT_NEW_MAX_RITUAL: 20,
    FL_W: [1.0, 0.85, 0.55, 0.2],
    /** v2 §6 — Regular DS ağırlığı kaldırıldı (mekan-tekrarı VD/CtxD'de) */
    N_CONTEXT_THRESHOLD: 0.65,
    N_CONTEXT_DAYS: 30,
    /** DS_full tier eşikleri — launch kalibrasyonu (son-part.md §6) */
    TIER_THRESHOLDS: [0.35, 0.5, 0.65, 0.8],
    TIER_NAMES: ['homebody', 'familiar', 'explorer', 'wanderer', 'voyager'],
    /** Window bubble üst sınırı — launch: 12 (son-part.md §6) */
    MAX_WINDOW_CAPACITY: 12,
  },

  fl: {
    THRESHOLDS: [1, 4, 8],
    FRESHNESS_MONTHS: 12,
    FB_WEIGHTS: [1.0, 0.5, 0.0],
  },

  ritual: {
    MIN_SIZE: 3,
    DURATION_MIN_MINUTES: 30,
    /** §18 alias — MIN_DURATION_MIN:30 🔒 */
    MIN_DURATION_MIN: 30,
    DURATION_MAX_MINUTES: 24 * 60,
    WINDOW_HOURS_OPTIONS: [3, 6, 12, 24],
    /** sonMD §2 — window-kapanışı varsayılan 12s ⭐ */
    WINDOW_HOURS_DEFAULT: 12,
    GRACE_MINUTES: 10,
    /** KİLİT-ANI: %25 süre, abs clamp 15dk–3h (§18) */
    CANCEL_FREE_THRESHOLD_PCT: 0.25,
    CANCEL_FREE_MIN_MINUTES: 15,
    CANCEL_FREE_MAX_MINUTES: 180,
    FEEDBACK_FLOOR_HOURS: 12,
    /** v2 §2 — prelobby chat kilit anında açılır (join'de değil) */
    PRELOBBY_CHAT_OPEN_ON_JOIN: false,
    MAX_CONCURRENT_WINDOW_BUBBLES: 10,
    /** v2 §2 K-seti */
    JOIN_BUFFER_MIN: 0,
    DAILY_COMMIT_CAP: 4,
    LATE_JOIN_EXEMPT_MIN: 30,
    SAME_RITUAL_JOIN_PER_DAY: 1,
    /** sonMD: MUTLAK tek-masa tavanı 40 🔒 · soft kategori E2.7 */
    CUSTOM_MAX_CAP: 40,
    /** §18 alias */
    ABSOLUTE_TABLE_CAP: 40,
    INSTANT_MAX_LEAD_H: 2,
    /** find_note max length ⭐ */
    FIND_NOTE_MAX_CH: 60,
    ORIGIN_ENUM: ['SLOT_PLANNED', 'WALK_IN', 'VEN_EVENT'],
    /** 0 = sınırsız (sonMD WALK-IN SINIRSIZ 🔒) */
    WALK_IN_DAILY_CAP: 0,
    /** şahıs tek-seferlik ufuk (gün) ⭐ */
    PLANNED_MAX_AHEAD_D: 21,
    /** VEN_EVENT + brand-imzalı ufuk (gün) ⭐ */
    EVENT_MAX_AHEAD_D: 60,
    BIRTH_CANCEL_MIN: 10,
    SELF_REZ_MODES: ['INSTANT', 'APPROVAL'],
    /** Self-rez kişi limiti — 1/gün/mekan ⭐ */
    SELF_REZ_PER_DAY_PER_VENUE: 1,
    /** §2C discovery audience — PUBLIC|FRIENDS (ayrı: visibility) */
    AUDIENCE_DEFAULT: 'PUBLIC',
    AUDIENCE_VALUES: ['PUBLIC', 'FRIENDS'],
    /** §2C fee beyanı — nullable; note default "yerinde ödenir" */
    FEE_CURRENCY_DEFAULT: 'TRY',
    FEE_NOTE_DEFAULT: 'yerinde ödenir',
    /**
     * VEN-EVENT aylık tavan ⭐ AÇIK — değer BOŞ (pivot sonrası)
     * MONTHLY_CAP null/0 → sınırsız; pozitif sayı → enforce
     */
    VEN_EVENT: {
      MONTHLY_CAP: null,
      MONTHLY_CAP_STATUS: 'open_empty',
      MONTHLY_CAP_NOTE: 'founder pivot — keşif mekan-ilanı çöplüğü olmasın',
      /** iptal edilenler kotaya sayılmaz (enforce açıkken) */
      COUNT_CANCELLED: false,
    },
    /**
     * E2.7 — 14 launch kategori soft önerisi (host aşabilir, mutlak 40)
     * soft_max = önerilen üst; soft_min = önerilen alt (MIN_SIZE ile max)
     */
    CATEGORY_SOFT_CAPS: {
      sohbet_tartisma: { soft_min: 3, soft_max: 12 },
      kahve_bulusmasi: { soft_min: 3, soft_max: 12 },
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

  /**
   * Pivot saha kontrol kartı — LOCAL_CheckIn_Sistemi §9
   * Ürün yüzeyi değil; ops/founder checklist kaynağı.
   */
  checkinPivotChecklist: [
    'Kapı-ekranı süresi: [CHECK-IN]→mühür kaç saniye? (hedef <20sn; >45sn = C1 alarmı)',
    '"Kod ne?" anı: kim soruyor, tereddüt var mı, göster/LOCAL-TAG kaç kez kullanıldı? (C3)',
    'İlk-mühür töreni: açan kişi ne hissetti — onur mu yük mü? (copy kalibresi)',
    'Konum notu yazılıyor mu, işe yarıyor mu? ("masayı bul" başarısı)',
    'Pending sıklığı + çözülme süresi + tanık tereddütü (C2 + eşik kalibresi)',
    'Şerit etkisi: prelobby\'dekiler "masa yaşıyor" push\'uyla hızlandı mı?',
    'Geç kalan davranışı: 0.85 dilimi + nötr kart nasıl karşılandı?',
    'Venue tarafı: personel toteme sahip çıktı mı, rez-hazırlık refleksi doğdu mu?',
    'Walk-in doğumu: sokaktan masa gerçekleşti mi, kaç dakikada?',
    'Kapı sonrası gelenler: kaç kişi kapıya çarptı, tepkisi ne?',
    'Kod kültürü: kod dijital yollandı mı, masada nasıl söylendi?',
    'Telefon-ölü vakası: kaç kez yaşandı, masa nasıl çözdü?',
  ],

  content: {
    PULSE_TTL_HOURS: 24,
    SHARE_NOTE_MAX_CHARS: 280,
    FORUM_SURFACE_WHOLE: 'whole_window',
    FORUM_SURFACE_MEMORIES: 'memories_only',
  },

  /** v2 §3 visual source — window/prelobby: in-app camera only */
  visual: {
    GALLERY_IN_WINDOW: false,
    FILTERS_ENABLED: false,
    AVATAR_GALLERY_ALLOWED: true,
    CAPTURE_SOURCE: 'in_app_camera',
  },
  video: {
    MAX_S: 45,
  },

  pulse: {
    FRESH_HOURS: 24,
    LIVE_MIX: { checkin_weight: 0.55, memory_tempo_weight: 0.45 },
    BANDS: { low: 0.4, mid: 0.7 },
    MEMORY_RANK_MIX: { upvote: 1, soz: 1.2, yanki: 0.8 },
    /**
     * Master §2D — LW-Pulse discovery ağırlıkları ⭐ (kalibre-1)
     * yer · mesafe · kategori · sosyal-eko · pop (tavanlı)
     */
    LW_WEIGHTS: {
      place: 0.3,
      distance: 0.2,
      category: 0.2,
      social: 0.2,
      pop: 0.1,
    },
    LW_POP_CAP: 1.0,
    LW_WEIGHTS_LOCKED_AT: '2026-08-12',
  },

  /**
   * Master §2E — event_group köşe tavanı
   * köşe cap 12 ⭐ · köşe sayısı max 8 ⭐ · ~96 fiili tavan
   */
  event_group: {
    CORNER_CAP: 12,
    MAX_CORNERS: 8,
    EFFECTIVE_CEILING: 96,
    LOCKED_AT: '2026-08-12',
  },

  /**
   * Master §16 — Büyüme eşikleri (sağlıklı bantlar)
   * Ürün enforce değil; Aras izleme / kalibrasyon protokolü kaynağı.
   */
  growth: {
    WEEKLY_RITUALS_CLUSTER_MIN: 50,
    REPEAT_PARTICIPATION_30D_MIN: 0.4,
    NOSHOW_RATE_MAX: 0.15,
    FEEDBACK_COMPLETION_MIN: 0.4,
    RS_CENTER: 5.0,
    RS_CENTER_TOLERANCE: 0.5,
    NEW_VENUE_SETTLE_WEEKS_MIN: 1,
    NEW_VENUE_SETTLE_WEEKS_MAX: 3,
    SPARK_REACH_3_MIN: 0.3,
    YELLOW_CHIP_DEAD_FORBIDDEN: true,
    LOCKED_AT: '2026-08-12',
    NOTE: 'Master §16 — sinyal→Aras→founder→config; kod değişmez',
  },

  /** v2 §1 identity gate */
  identity: {
    TARGET_S: 60,
    PROVIDERS: ['stub', 'techsign', 'ihs'],
    ACTIVE_PROVIDER: 'stub',
    /** Bekleme ekranı kültür sahnesi — metinler 🔒 kilitli (2026-08-10) */
    CULTURE_LINES: ['culture_id_1', 'culture_id_2', 'culture_id_3', 'culture_id_4'],
    /** Stub path: gallery upload never allowed; NFC primary, photo+selfie fallback */
    GALLERY_UPLOAD_ALLOWED: false,
    NFC_PRIMARY: true,
    FALLBACK_PATH: 'card_photo_selfie',
    DOCUMENTS: ['TCKK', 'PASSPORT', 'EU_ID'],
    LIVENESS_PASSIVE_S: 3,
    /** sonMD §18 — değişim limitleri (gün) */
    USERNAME_CHANGE_D: 90,
    NAME_CHANGE_D: 90,
  },

  /** v2 §2 keyword → 3-digit code */
  keyword: {
    CODE_LEN: 3,
    CODE_MIN: 100,
    CODE_MAX: 999,
    COLLISION_RADIUS_M: 500,
    ENTRY_TRIES: 3,
    RETRY_WAIT_S: 30,
    /** ESCROW öldü (sonMD §18) — ESCROW_MIN kaldırıldı */
    CHECKIN_EARLY_OPEN_MIN: 15,
    /** v2 §2: yazı-okunuş kaldırıldı — DIGIT_WORDS artık kullanılmaz */
  },

  /**
   * v2 §2 PENDING_WITNESS — Master §PENDING_WITNESS / Build Doc §18
   * AKTİF şema = LEGACY_2_TIER. FUTURE_3_TIER config-hazır; yalnız founder/pivot açar.
   */
  witness: {
    ACTIVE_SCHEME: 'LEGACY_2_TIER',
    FUTURE_3_TIER_ENABLED: false,
    /** LEGACY_2_TIER: ≤3→1 · ≥4→2 */
    THRESHOLD: { le3: 1, ge4: 2 },
    /** FUTURE_3_TIER şema (uyur): ≤3→1 · 4–12→2 · ≥13→3 */
    FUTURE_3_TIER: { le3: 1, mid_lo: 4, mid_hi: 12, mid: 2, ge13: 3 },
    PENDING_GRACE_MIN: 10,
    /**
     * sonMD §3/C4 — yalancı-tanık deseni MOD sicili (RS yok, insan kararı).
     * Belirti: hep-aynı-tanık + (T2 location_suspect | gps sınır-deseni).
     */
    FALSE_WITNESS: {
      WINDOW_DAYS: 30,
      MIN_SUSPECT_SUBJECTS: 3,
      MIN_PAIR_REPEATS: 2,
      FACTOR_WEIGHT: 0.2,
    },
  },

  /** v2 §2 LOCAL-TAG (mühürlü → tek kullanım QR/yakın) */
  tag: {
    TTL_S: 30,
    /** Dijital yollama yasağı: redeem GPS, issuer GPS'e bu yarıçapta olmalı */
    PHYSICAL_RELAY_RADIUS_M: 15,
  },

  /**
   * sonMD §1/C4: dijital kod relay yasağı
   * paste/DM ile gelen kod → reddet veya PENDING; LOCAL-TAG proximity zorunlu
   */
  relayBan: {
    REJECT_DIGITAL_PASTE: true,
    TAG_REQUIRES_PROXIMITY: true,
    /** C4: numpad dışı süper-hızlı tam-kod girişi (ms) — paste/autofill şüphesi */
    FAST_ENTRY_MS: 400,
  },

  /** v2 §5 MOD-ENGINE */
  mod: {
    L2A_H: 72,
    L2B_D: 7,
    L2B_FREE_BAN_D: 30,
    L3_RS_BASE: -0.15,
    L3_RS_MAX: -0.3,
    L3_SUSPEND_D: 30,
    /** Master Parametre §8 — L1 paket eşiği ⭐ (prova kalibresi kilitlendi) */
    L1_PACKET_MIN: 3,
    L1_PACKET_LOCKED_AT: '2026-08-12',
    SLA_H: { safety: 2, content: 12, general: 48 },
    LOCATION_SHARE_DEFAULT_H: 1,
    /**
     * Sessiz-çıkış pattern — 2–3 / 30g inceleme tetği
     * MIN_HITS=3 (bant 2–3; kalibre edilebilir)
     */
    SILENT_EXIT: {
      MIN_HITS: 3,
      WINDOW_DAYS: 30,
      FACTOR_WEIGHT: 0.15,
    },
  },

  /** v2 §10 / E2.8 chips — RQ tam 3/renk · P2V tam 5/renk · copy 🔓 stringTable */
  chip: {
    SINGLE_SELECT: true,
    PUBLIC_MIN_N: 10,
    TOP_CHIP_RITUAL_MIN_DISTINCT: 3,
    TOP_CHIP_VENUE_MIN: 10,
    RQ_OPTIONS_PER_COLOR: 3,
    P2V_OPTIONS_PER_COLOR: 5,
    /** EVENT sub'lı masada FB'ye ek "gece geneli nasıldı" 🔒 */
    EVENT_GENERAL_RQ_ENABLED: true,
    MAX_CHIP_SELECT: 1,
    ROTATE: true,
    SETS: {
      // 🟢 sohbet aktı · masa dengeliydi · tekrar isterim
      RQ_GREEN: ['rq_g_1', 'rq_g_2', 'rq_g_3'],
      // 🟡 geç ısındı · küçük gruplara bölündük · tanımdan biraz farklıydı
      RQ_YELLOW: ['rq_y_1', 'rq_y_2', 'rq_y_3'],
      // 🔴 tanım yanılttı · tek ses baskındı · kadro uyumsuzdu
      RQ_RED: ['rq_r_1', 'rq_r_2', 'rq_r_3'],
      // 🟢 mekan sahiplendi · servis akıcıydı · fiyatına değdi · ortam tam masalıktı · personel sıcaktı
      P2V_GREEN: ['p2v_g_1', 'p2v_g_2', 'p2v_g_3', 'p2v_g_4', 'p2v_g_5'],
      // 🟡 servis yavaştı · yer dardı · biraz gürültülüydü · fiyat yüksekti · masa geç hazırlandı
      P2V_YELLOW: ['p2v_y_1', 'p2v_y_2', 'p2v_y_3', 'p2v_y_4', 'p2v_y_5'],
      // 🔴 servis sorunluydu · gürültüden konuşamadık · temizlik zayıftı · ücret sürpriziydi · masa hazır değildi
      P2V_RED: ['p2v_r_servis', 'p2v_r_gurultu', 'p2v_r_temizlik', 'p2v_r_ucret', 'p2v_r_masa'],
      P2Z_GREEN: ['p2z_g_1', 'p2z_g_2'],
      P2Z_YELLOW: ['p2z_y_1', 'p2z_y_2'],
      P2Z_RED: ['p2z_r_1', 'p2z_r_marker'],
    },
    ROUTES: {
      p2v_g_1: 'venue_itibar',
      p2v_g_2: 'venue_itibar',
      p2v_g_3: 'venue_itibar',
      p2v_g_4: 'venue_itibar',
      p2v_g_5: 'venue_itibar',
      p2v_y_1: 'venue_itibar',
      p2v_y_2: 'venue_itibar',
      p2v_y_3: 'venue_itibar',
      p2v_y_4: 'venue_itibar',
      p2v_y_5: 'venue_itibar',
      p2v_r_servis: 'venue_itibar',
      p2v_r_gurultu: 'venue_itibar',
      p2v_r_temizlik: 'venue_itibar',
      p2v_r_ucret: 'venue_itibar',
      p2v_r_masa: 'venue_itibar',
      p2z_r_marker: 'ops',
      default: 'host_private',
    },
  },

  /** v2 §11 zone / spark */
  zone: {
    BADGE_RITUAL_P: 3,
    MARKER_P: 1,
    SPARK_ENABLED: false,
    DEFAULT_RADIUS_M: 75,
  },

  follow: {
    RARE_HOST_D: 60,
  },

  search: {
    RANKING_WEIGHTS: { objective: 0.55, personal: 0.45 },
    /** Brand imza keşif sıralamasına GİRMEZ */
    BRAND_SIGNATURE_AFFECTS_RANKING: false,
  },

  /** son-part.md §11 — NOTIF v1 defaults & thresholds */
  notifications: {
    /** Master Parametre §15 — upvote sinyal eşiği “10+” toplu */
    FORUM_UPVOTE_THRESHOLD: 10,
    FORUM_UPVOTE_STEP: 10,
    /** A + Share-2-Person on; forum upvote / FL / DS off by default */
    DEFAULT_ON: ['share_object', 'forum_comment', 'forum_repost', 'friend_request', 'penalty_warning'],
    DEFAULT_OFF: ['forum_upvote', 'fl_change', 'ds_tier', 'public_memory_follow'],
    PUSH_DEFAULTS: {
      memory_soz: true,
      memory_echo: true,
      memory_upvote_milestone: true,
      memory_downvote: false,
      retro_publish: false,
      rare_host: true,
      night_report: true,
      badge_approach: true,
      regular_gained_venue: true,
      vitrine_selected: true,
      seating_status_change: true,
      zone_liveness: true,
      zone_spark: false,
      zone_founder_opportunity: true,
      venue_slot_opened: true,
      followed_host_ritual: true,
      weekly_digest: true,
    },
    QUIET_HOURS_DEFAULT: { enabled: true, start: '01:00', end: '09:00' },
    /** launch haftası founder temizliği — 2026-08-10 kilit */
    push_defaults_founder_clean: '2026-08-10',
  },

  checkin: {
    KAPI_PCT: 0.2,
    KAPI_MIN_MINUTES: 10,
    KAPI_MAX_MINUTES: 60,
    AIS_FULL_THRESHOLD_PCT: 0.6,
    AIS_REDUCED: 1.0,
    AIS_LATE: 0.85,
    /** sonMD 30 Tem: AIS_MANUAL KALDIRILDI — host mühürleyemez; yalnız PENDING_WITNESS */
    AIS_MANUAL_ENABLED: false,
    GPS_RADIUS_METERS: {
      custom: 30,
      venue: 50,
      /** C2 bina-yoğun / beton kanyon — venues.dense_canyon yıldızı */
      venue_dense: 75,
      zone: 75,
      zone_max: 100,
      moving: 15,
      /** TARİFELİ/VAPUR — iskele çapa; gemiye binerken gate_override_until = kalkış+5 */
      scheduled: 50,
      ferry: 50,
    },
    /** C2: pending/mühür alarm bandı */
    PENDING_SEAL_WATCH: 0.1,
    PENDING_SEAL_ALARM: 0.15,
    /** C2 Android konum-izni onboarding (hassas konum; yaklaşık yetmez) */
    ANDROID_LOCATION_EDUCATION:
      'Beton kanyonlarda GPS sapar. Hassas konum izni mühür için gerekli — yaklaşık konum yetmez. Kapı önünde durun.',
    /** §9 kapı-ekranı süresi ⭐ */
    DOOR_SEAL_TARGET_S: 20,
    DOOR_SEAL_ALARM_S: 45,
    /** §9 şerit: push sonrası hızlanma penceresi */
    STRIP_FOLLOW_MIN: 15,
    /** EVENT main ≥ bu kapasitede 3-hane kod YASAK — totem/personel/turnike */
    EVENT_CODE_BAN_CAPACITY: 100,
    /** §18 alias */
    CODE_BAN_MIN_SIZE: 100,
    /** scheduled kapı: min(formül, departure+DEPARTURE_GATE_PAD_MIN) */
    DEPARTURE_GATE_PAD_MIN: 5,
    DEFAULT_LOCATION_TYPE: 'custom',
    /**
     * Master Parametre §2 — GPS mesafe logu / sınır-deseni eşiği
     * “hep radius sınırı + sıfır memory” → MOD korelasyon sinyali
     */
    GPS_EDGE: {
      /** Allowed radius'a bu kadar yakın = sınır (m) */
      MARGIN_M: 5,
      /** Alternatif: distance/radius ≥ bu oran da sınır sayılır */
      RATIO_MIN: 0.9,
      MIN_HITS: 3,
      WINDOW_DAYS: 30,
      /** buildReportPackage correlation weight */
      FACTOR_WEIGHT: 0.15,
    },
    EDGE_PATTERN_M: 5,
    /**
     * sonMD §1/§3 T3 sınır-deseni ⭐ opsiyonel — default kapalı (MOD korelasyon ayrı kalır).
     * true iken GPS_EDGE hit → PENDING_WITNESS.
     */
    T3_PENDING_ENABLED: false,
    /**
     * sonMD §1 T2: mock/root/integrity-fail/imkansız-hız → PENDING_WITNESS (hard block değil).
     * BLOCK_* false = suspect; imkansız hız yalnız suspect bandında.
     */
    INTEGRITY: {
      BLOCK_ON_PLAY_INTEGRITY_FAIL: false,
      BLOCK_ON_APP_ATTEST_FAIL: false,
      IMPOSSIBLE_SPEED_BLOCK_KMH: 0,
      IMPOSSIBLE_SPEED_SUSPECT_KMH: 180,
      HISTORY_WINDOW_MIN: 30,
    },
    /** C5: totem kayıp/kırık → kod yolu ile yaşa (venue.totem_status=broken) */
    TOTEM_BROKEN_FALLBACK_TO_CODE: true,
  },

  presence: {
    TICKET_TTL_MIN: 90,
  },

  modSignals: {
    DAILY_LEAVE_MOD_SIGNAL: 6,
  },

  penalties: {
    ROLLING_DAYS: 30,
    LATE_CANCEL_RS: [null, 0.06, 0.1, 0.15],
    NOSHOW_RS: [0.08, 0.15, 0.2],
    NOSHOW_SUSPENSION_HOURS: [null, null, 3, 6, 12, 24],
    HOST_BAN: [
      { warning: true, hours: 3 },
      { hours: 24 },
      { hours: 48 },
      { hours: 168 },
    ],
  },

  venue: {
    K: 3,
    /**
     * VEN-4 — hesap 0–1 uzayında (prior_internal:0.50); gösterim ×10
     * PRIOR display-alias = PRIOR_INTERNAL * DISPLAY_SCALE (=5.0)
     */
    PRIOR_INTERNAL: 0.5,
    DISPLAY_SCALE: 10,
    PRIOR: 5.0,
    WINDOW_DAYS: 90,
    OTURMA: [2, 10],
    DIST_MIN_RITUAL: 5,
    KATEGORI_TENTATIVE: 3,
    /** Public vitrin: sayı ≥5. gözlemde; öncesi etiket. Panel gün-1'den görür */
    MIN_DISPLAY_N: 5,
    /** Soru tipi başına min ham cevap — altı gözlem üretmez (chip kaydı ayrı) */
    MIN_ANSWERS_PER_OBS: 2,
    /** Aynı kullanıcı→aynı mekan 90g'de kaçıncı cevap ağırlığı */
    REPEAT_RATER_W: [1.0, 0.5, 0.5, 0.25],
    /** §18 prior geçişi: kategori/şehir örneklem ≥35 → empirik prior; altı → PRIOR 5.0 */
    CATEGORY_PRIOR_SWITCH_N: 35,
    BADGE_MAX: 5,
    BADGE_HIGHLIGHT_USER: 3,
    BADGE_HIGHLIGHT_VENUE: 5,
    ONBOARDING_STEPS: [
      'application_submitted',
      'approved',
      'vitrine',
      'floor_plan',
      'gps_verified',
      'first_slot',
      'venue_badge',
      'live',
    ],
    SLOT_TIME_MODES: ['fixed', 'loose', 'recurring', 'instant'],
    SLOT_VISIBILITY: ['public', 'venue_only', 'regular_only', 'hidden'],
    /** Legacy aliases accepted at API boundary */
    SLOT_VISIBILITY_ALIASES: {
      members: 'venue_only',
      venue_only: 'venue_only',
      regular_only: 'regular_only',
      public: 'public',
      hidden: 'hidden',
    },
    DEFAULT_SLOT_CAPACITY: 10,
    CATEGORY_PRIOR_ENABLED: true,
    PACKAGES_STUB: {
      design_pending: false,
      FREE_SLOTS_MO: 1,
      OP_SLOTS: 3,
      HAKIM_SLOTS: 5,
      PRICE_OP: 7900,
      PRICE_HAKIM: 19900,
      SIZE_MULT: 0.7,
      /** §8 / 3 Ağu — compact bant KAPALI başlar */
      COMPACT_ENABLED: false,
      ADDON_SLOT: 2000,
      /** Master Parametre §12 — paket fiyatı × gün-tipi: hafta içi %30 / sonu %50 */
      TAKEOVER_FORMULA: {
        weekday: 0.3,
        weekend: 0.5,
        friday: 0.5,
      },
      NIGHT_REPORT_OFFSET_MIN: 30,
      TRIGGER: { N_RITUAL: 5, X_CHECKIN: 20, DEAD_DAY_DELTA: 15 },
      SUGGESTION_DAILY_CAP: 5,
      /** v3 §8: aynı mekana 1 bekleyen istek (yıldız A4=2; implementasyon otoritesi v3) */
      SUGGESTION_PENDING_PER_VENUE: 1,
      SUGGESTION_EXPIRE_HOURS_BEFORE: 24,
      COMMITMENT_TEXT:
        'LOCAL mekan ortağı olarak doğruluğu, fiziksel mekânı ve kullanıcı güvenliğini taahhüt ederim. Sahte veya yanıltıcı bilgi hesabımı kapatır.',
      PHOTO_MIN: 5,
      tiers: [
        {
          id: 'free',
          label: 'FREE',
          price_try: 0,
          billing: 'none',
          concurrent_slots: 1,
          active: true,
          features: ['profil', 'arsiv', 'skorlar', 'oneri_kutusu', '1_slot_ay', 'mini_rapor'],
        },
        {
          id: 'operator',
          label: 'OPERATÖR',
          price_try: 7900,
          billing: 'monthly',
          concurrent_slots: 3,
          active: true,
          features: ['recurring', 'instant', 'regular', 'venue_badge_5', 'gece_raporu', 'aylik_nabiz', 'chip_trends', 'alt_oneri', 'masa_totem'],
        },
        {
          id: 'hakim',
          label: 'HAKİM',
          price_try: 19900,
          billing: 'monthly',
          concurrent_slots: 5,
          active: true,
          features: ['operator_all', 'pazar_payi', 'bolge_radari', 'anonim_benchmark', 'ai_aylik', 'takeover_1', 'brand_slot', 'featured_event'],
        },
      ],
    },
  },

  /**
   * §2C VENUE-LEAD RADARI — aynı custom-pin tekrar → ops lead
   * Build Doc: leads.REPEAT_PIN_N:3 ⭐
   */
  leads: {
    REPEAT_PIN_N: 3,
    /** pin küme yarıçapı (m) — custom GPS radius ile hizalı */
    PIN_CLUSTER_RADIUS_M: 30,
    /** lead penceresi (gün) — tekrar sayımı */
    WINDOW_D: 90,
  },

  regular: {
    N: 4,
    WINDOW_D: 45,
    DECAY_D: 60,
    THRESHOLD: 4,
    PRIVATE_LABEL: 'Regular',
    PARKED: false,
    VITRIN_DEFAULT: false,
    COUNTER_UI: true,
    /** Sönüm bildirimsiz — yalnızca newly_gained push */
    SILENT_DECAY: true,
    /** VENUE ailesi ortak merdiven — venue_regular Novice/Regular/Master */
    BADGE_LADDER: [3, 10, 25],
  },

  /** sonMD Wave B — kapalı ürün kararları */
  weather_cancel: {
    ENABLED: true,
    WINDOW_HOURS_BEFORE_START: 3,
    /** E2.7 açık-hava + zone masaları */
    CATEGORY_KEYS: ['yuruyus_kosu', 'piknik_acik_hava', 'gezi_kesif', 'takim_spor'],
    ZONE_TABLES_ELIGIBLE: true,
    MOD_SIGNAL_WINDOW_D: 90,
    MOD_SIGNAL_THRESHOLD: 3,
  },

  collaborator: {
    ALLOWED_SCOPES: ['series', 'event_group', 'venue_event'],
    PERMISSIONS: ['announce', 'participant_comms', 'instance_manage'],
    FORBIDDEN: ['seal', 'witness', 'rs', 'feedback', 'moderation', 'punish'],
  },

  account_privacy: {
    DEFAULT: 'OPEN',
    CLOSED_FOLLOW_REQUIRES_APPROVAL: true,
    CLOSED_LW_EXCEPTION: true,
    MASA_EXEMPT: true,
    /**
     * Takipçi sayacı liste-içi 🔒 (3 Ağu)
     * Profilde yalnız "Takipçiler ›" (sayısız); sayı liste sayfası tepesinde.
     */
    FOLLOWER_COUNT_IN_LIST_ONLY: true,
  },

  messaging: {
    EDIT_WINDOW_MIN: 5,
    REACTIONS: ['🤝', '😂', '🙌', '👀', '💡', '❓'],
    REACTION_PER_USER: 1,
  },

  saves: {
    OBJECT_TYPES: ['ritual', 'venue', 'zone', 'memory'],
    RANK_EFFECT: 0,
  },

  mutes: {
    OBJECT_TYPES: ['user', 'series', 'venue', 'category'],
  },

  memory_audience: {
    DEFAULT: 'WINDOW',
    VALUES: ['WINDOW', 'CIRCLE', 'CITY'],
    LEGACY_MAP: { solo: 'WINDOW', pulse: 'CIRCLE', all: 'CITY' },
    ECHO_CANNOT_RAISE: true,
  },

  mention: {
    DEFAULT_PERMISSION: 'masa', // masa | friends | none
    MAX_PER_MESSAGE: 5,
  },

  rsSanity: {
    /** LOCAL motor v1.0 ile kalibre edildi — npm run simulate:rs */
    SCENARIOS: [
      { id: 'reliable_climb', label: '5.00 → 7.50 (Reliable)', start_rs: 5.0, target_rs: 7.5, tolerance: 0.15, rituals: 32, s_r: 0.92 },
      { id: 'recovery_climb', label: '3.00 → 6.00 (Recovery)', start_rs: 3.0, target_rs: 6.0, tolerance: 0.2, rituals: 38, s_r: 0.86 },
      { id: 'three_noshow', label: '7.50 + 3 no-show', start_rs: 7.5, target_rs: 7.07, tolerance: 0.05, rituals: 0, noshow_strikes: 3 },
      { id: 'exceptional_climb', label: '8.00 → 9.00', start_rs: 8.0, target_rs: 9.0, tolerance: 0.15, rituals: 15, s_r: 0.98 },
      { id: 'first_perfect', label: '1. Ritual mükemmel', start_rs: 5.0, target_rs: 5.04, tolerance: 0.05, rituals: 1, s_r: 0.95 },
      { id: 'first_noshow', label: '1. Ritual no-show uyarı', start_rs: 5.0, target_rs: 5.0, tolerance: 0.001, rituals: 0, noshow_strikes: 1, noshow_rs: false },
      { id: 'six_late_cancel', label: '6 late cancel', start_rs: 5.0, target_rs: 4.39, tolerance: 0.05, rituals: 0, late_cancel_strikes: 6 },
    ],
  },

  /** Yıl 1+ / v1.5 pasif özellikler — sonMD stubs · F1.5/F2 launch'a SOKMA */
  stubs: {
    MUSIC_SYNC_ENABLED: false,
    MUSIC_SDK_ENABLED: false,
    /** §3 — canlı avatar v1.5; parked (galeri avatar serbest) */
    LIVE_AVATAR_ENABLED: false,
    BRAND_HOST_ENABLED: false,
    /** §12 — web-vitrin salt-okunur; v3: WEB_SHOWCASE_ENABLED:false (prova sonrası aç) */
    WEB_SHOWCASE_ENABLED: false,
    WEB_SHOWCASE_APP_STORE_URL: 'https://apps.apple.com/app/local',
    WEB_SHOWCASE_PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=app.local',
    IOS_PROXIMITY_ADD_ENABLED: false,
    RECURRING_RITUALS_ENABLED: true,
    SLOT_ECONOMY_ENABLED: true,
    SLOT_ECONOMY: {
      design_pending: false,
      currency: 'EUR',
      claim_fee_cents: 0,
      suggestion_reward_cents: 0,
      host_payout_cents: 0,
    },
    /** F1.5 — §0 launch’a sokma; kod hazır, flag kapalı */
    FRIENDS_DM_ENABLED: false,
    WAITLIST_ENABLED: true,
    /** LATER park — endpoint 410 stub */
    ROLE_SLOT_ENABLED: false,
    /** F1.5 Defter — launch’ta yok; rozet + SERIES_REGULAR_ONLY flag kapalı */
    SERIES_REGULAR_ENABLED: false,
    /** F2 RAF — launch create=söz */
    RITUAL_DESIGNER_ENABLED: false,
  },

  /** §19 open items — stub values; founder session fills copy/providers */
  open: {
    chip_copy: 'locked_2026-08-10',
    /** §19 #3 — launch yürür; canlı satıcı OPEN (kapatma) */
    kyc_provider_contract: {
      status: 'pass_stub_launch',
      active: 'stub',
      candidates: ['techsign', 'ihs'],
      owner: 'founder',
      launch_accepted: true,
      launch_accepted_at: '2026-08-11',
      /** Yapısal ürün tamam — canlı vendor ops (DPA/keys) hâlâ OPEN */
      treat_as_complete: true,
      product_complete_at: '2026-08-12',
      launch_unblocks: true,
      still_open: true,
      still_open_reason: 'live_techsign_or_ihs_credentials',
      phase2_code_ready: true,
      phase2_code_ready_at: '2026-08-11',
      note:
        'Yapısal %100: stub adaptör + verify-and-discard + identity_hash. Canlı Techsign/İHS = ops (DPA/keys), kod boşluğu değil.',
      phase2_checklist: [
        'Provider seç: Techsign veya İHS',
        'DPA + sandbox API key + webhook',
        'KYC_PROVIDER + KYC_*_BASE_URL + API_KEY',
        'Smoke: live-readiness → live_mode true',
        'Mobil SDK token akışı vendor dokümanına göre',
      ],
    },
    /** Master Parametre §12 ile hizalandı: weekday 0.30 · weekend/friday 0.50 */
    takeover_formula: { weekday: 0.3, weekend: 0.5, friday: 0.5, source: 'master_s12' },
    /** 3 Ağu: compact-band configli-kapalı 🔒 */
    compact_band_approved: false,
    push_defaults_founder_clean: '2026-08-10',
    /** Canlı provider — null = ops review path; hold feed'de zorunlu */
    csam_provider: null,
    csam_status: 'ops_review_fallback',
    csam_product_complete: true,
    csam_hold_enforced: true,
    csam_note:
      'Fail-closed hold + ops queue ürün tamam. Canlı: CSAM_SCAN_WEBHOOK_URL veya CSAM_PROVIDER=sightengine + keys.',
    /** Master TRIGGER kilidi (absolute 100 B) — PACKAGES_STUB.TRIGGER ile aynı */
    sales_trigger_thresholds: { N_RITUAL: 5, X_CHECKIN: 20, DEAD_DAY_DELTA: 15 },
    sales_trigger_locked_at: '2026-08-12',
    compact_band_locked_at: null,
    takeover_formula_locked_at: '2026-08-12',
    /** LOCAL_Sistem_Anayasasi.md — yapısal %100 (12 Ağu 2026) */
    anayasa_product_complete: true,
    anayasa_structural_pct: 100,
    anayasa_locked_at: '2026-08-12',
    anayasa_ops_ceiling: ['kyc_live_keys', 'csam_live_provider', 'stripe_live_keys'],
    packages_product_complete: true,
    packages_product_complete_at: '2026-08-12',
  },

  /** §8 / 3 Ağu — compact bant çarpan-hazır, enabled:false */
  compact: {
    enabled: false,
    SEAT_LE40_MULT: 0.7,
  },

  badges: {
    HIGHLIGHT_USER: 3,
    HIGHLIGHT_VENUE: 5,
    LEVELS: ['novice', 'regular', 'master'],
    LEVEL_LABELS: { novice: 'Novice', regular: 'Regular', master: 'Master' },
    /** v2 §9 — 6 families (legacy mapping preserved on catalog items) */
    CATEGORIES: ['SPECIAL', 'MASTERY', 'BEHAVIORAL', 'VENUE', 'ZONE', 'MILESTONE'],
    FAMILY_GLYPHS: {
      SPECIAL: '✦',
      MASTERY: '⬡',
      BEHAVIORAL: '●',
      VENUE: '🛡',
      ZONE: '📍',
      MILESTONE: '▦',
    },
    CATEGORY_MAP: {
      special: 'SPECIAL',
      content: 'MASTERY',
      behavior: 'BEHAVIORAL',
      location: 'ZONE',
      region: 'ZONE',
      venue: 'VENUE',
      milestone: 'MILESTONE',
    },
    /** Negatif rozetler — skor doğurmaz, skor etkilemez, kapı koşulu olamaz */
    NEGATIVE_SLUGS: ['under_trial'],
    /** Chip→badge köprüsü — v3 🔓 AÇIK: tekrarlayan chip → sinyal; auto-grant kapalı */
    CHIP_BRIDGE: {
      enabled: false,
      open: true,
      min_repeats: 3,
      window_days: 90,
      locked_at: '2026-08-12',
      pattern_map: {
        rq_g_1: 'feedback_giver',
        rq_g_2: 'feedback_giver',
        rq_y_1: 'always_on_time',
        p2v_g_1: 'venue_regular',
        p2v_r_servis: 'feedback_champion',
        p2z_g_1: 'zone_spark',
        p2z_r_marker: 'zone_spark',
      },
    },
    LLM_PIPELINE_ENABLED: false,
    VENUE_BADGE: {
      MAX: 5,
      SHIELD_TEMPLATE: 'shield_v1',
      ALLOWED_CONDITIONS: ['visit', 'category', 'slot', 'event'],
      FORBIDDEN_CONDITIONS: ['spend', 'subjective'],
    },
    /** v1 katalog: 6 aileye map'li */
    CATALOG: [
      {
        slug: 'city_explorer',
        name: 'Sehir Kesfi',
        spec_category: 'location',
        icon_emoji: '🗺',
        rule: { type: 'unique_cities', thresholds: { novice: 1, regular: 3, master: 6 } },
      },
      {
        slug: 'neighborhood_regular',
        name: 'Mahalle Müdavimi',
        spec_category: 'region',
        icon_emoji: '🏘',
        rule: { type: 'rituals_in_city', thresholds: { novice: 5, regular: 15, master: 30 } },
      },
      {
        slug: 'always_on_time',
        name: 'Zamaninda',
        spec_category: 'behavior',
        icon_emoji: '⏰',
        rule: { type: 'clean_attendance', thresholds: { novice: 5, regular: 10, master: 20 } },
      },
      {
        slug: 'no_show_free',
        name: 'Gelmeme Yok',
        spec_category: 'behavior',
        icon_emoji: '✓',
        rule: { type: 'attended_without_noshow', thresholds: { novice: 5, regular: 15, master: 30 } },
      },
      {
        slug: 'memory_maker',
        name: 'Ani Yapici',
        spec_category: 'content',
        icon_emoji: '📝',
        rule: { type: 'memory_count', thresholds: { novice: 3, regular: 10, master: 25 } },
      },
      {
        slug: 'forum_voice',
        name: 'Forum Sesi',
        spec_category: 'content',
        icon_emoji: '💬',
        rule: { type: 'forum_posts', thresholds: { novice: 1, regular: 5, master: 15 } },
      },
      {
        slug: 'pivot_host',
        name: 'Pivot Host',
        spec_category: 'special',
        icon_emoji: '🌟',
        rule: { type: 'manual_pivot_host' },
        assignment_layer: 'manual',
      },
      {
        slug: 'founder',
        name: 'Founder',
        spec_category: 'special',
        icon_emoji: '🏛',
        rule: { type: 'manual_admin' },
        assignment_layer: 'manual',
      },
      {
        slug: 'early_bird',
        name: 'Erken Kus',
        spec_category: 'behavior',
        icon_emoji: '🌅',
        rule: { type: 'early_checkins', thresholds: { novice: 3, regular: 8, master: 20 } },
      },
      {
        slug: 'host_streak',
        name: 'Host Serisi',
        spec_category: 'behavior',
        icon_emoji: '🔥',
        rule: { type: 'hosted_rituals', thresholds: { novice: 2, regular: 5, master: 12 } },
      },
      {
        slug: 'window_wanderer',
        name: 'Window Gezgini',
        spec_category: 'content',
        icon_emoji: '🪟',
        rule: { type: 'window_memories', thresholds: { novice: 2, regular: 8, master: 20 } },
      },
      {
        slug: 'share_connector',
        name: 'Baglanti Kurucu',
        spec_category: 'content',
        icon_emoji: '🤝',
        rule: { type: 'share_objects_sent', thresholds: { novice: 1, regular: 5, master: 15 } },
      },
      {
        slug: 'venue_regular',
        name: 'Mekan Müdavimi',
        spec_category: 'location',
        icon_emoji: '☕',
        rule: { type: 'rituals_at_venue', thresholds: { novice: 3, regular: 10, master: 25 } },
      },
      {
        slug: 'feedback_giver',
        name: 'Geri Bildirimci',
        spec_category: 'behavior',
        icon_emoji: '⭐',
        rule: { type: 'feedback_given', thresholds: { novice: 5, regular: 15, master: 40 } },
      },
      {
        slug: 'pulse_voice',
        name: 'Pulse Sesi',
        spec_category: 'content',
        icon_emoji: '📡',
        rule: { type: 'pulse_posts', thresholds: { novice: 1, regular: 5, master: 15 } },
      },
      {
        slug: 'ritual_veteran',
        name: 'Ritual Veterani',
        spec_category: 'behavior',
        icon_emoji: '🎖',
        rule: { type: 'attended_without_noshow', thresholds: { novice: 10, regular: 25, master: 50 } },
      },
      {
        slug: 'quote_artist',
        name: 'Alinti Sanatcisi',
        spec_category: 'content',
        icon_emoji: '✍️',
        rule: { type: 'memory_count', thresholds: { novice: 5, regular: 15, master: 30 } },
      },
      {
        slug: 'table_captain',
        name: 'Masa Kaptani',
        spec_category: 'behavior',
        icon_emoji: '🪑',
        rule: { type: 'hosted_rituals', thresholds: { novice: 3, regular: 8, master: 20 } },
      },
      {
        slug: 'cross_city',
        name: 'Sehirler Arasi',
        spec_category: 'location',
        icon_emoji: '🚆',
        rule: { type: 'unique_cities', thresholds: { novice: 2, regular: 4, master: 8 } },
      },
      {
        slug: 'forum_regular',
        name: 'Forum Müdavimi',
        spec_category: 'content',
        icon_emoji: '📣',
        rule: { type: 'forum_posts', thresholds: { novice: 3, regular: 10, master: 25 } },
      },
      {
        slug: 'share_ambassador',
        name: 'Paylasim Elcisi',
        spec_category: 'content',
        icon_emoji: '📨',
        rule: { type: 'share_objects_sent', thresholds: { novice: 3, regular: 10, master: 25 } },
      },
      {
        slug: 'venue_champion',
        name: 'Mekan Sampiyonu',
        spec_category: 'location',
        icon_emoji: '🏆',
        rule: { type: 'rituals_at_venue', thresholds: { novice: 5, regular: 15, master: 35 } },
      },
      {
        slug: 'feedback_champion',
        name: 'Geri Bildirim Sampiyonu',
        spec_category: 'behavior',
        icon_emoji: '🌟',
        rule: { type: 'feedback_given', thresholds: { novice: 10, regular: 25, master: 60 } },
      },
      {
        slug: 'brand_partner',
        name: 'Marka Ortagi',
        spec_category: 'special',
        family: 'SPECIAL',
        icon_emoji: '🏷',
        rule: { type: 'manual_brand' },
        assignment_layer: 'manual',
      },
      {
        slug: 'venue_creator',
        name: 'Mekan Kurucusu',
        spec_category: 'venue',
        family: 'VENUE',
        icon_emoji: '🛡',
        rule: { type: 'manual_venue' },
        assignment_layer: 'manual',
      },
      {
        slug: 'first_localli',
        name: "İlk LOCAL'li",
        spec_category: 'milestone',
        family: 'MILESTONE',
        icon_emoji: '▦',
        rule: { type: 'attended_without_noshow', thresholds: { novice: 1, regular: 1, master: 1 } },
      },
      {
        slug: 'growing_localli',
        name: "Büyüyen LOCAL'li",
        spec_category: 'milestone',
        family: 'MILESTONE',
        icon_emoji: '▦',
        rule: { type: 'attended_without_noshow', thresholds: { novice: 10, regular: 10, master: 10 } },
      },
      {
        slug: 'zone_spark',
        name: 'Bölge Kıvılcımı',
        spec_category: 'location',
        family: 'ZONE',
        icon_emoji: '📍',
        rule: { type: 'unique_cities', thresholds: { novice: 1, regular: 2, master: 4 } },
      },
    ],
  },

  liveActivity: {
    UPDATE_INTERVAL_SEC: 60,
    BRAND_MARK: 'L',
    PHASES: ['prelobby', 'live', 'window'],
  },
};

/** RS motoru için düz sabit obje (geriye uyumluluk) */
export const RS_CONSTANTS = {
  INIT: LOCAL_CONFIG.rs.INIT,
  MIN: LOCAL_CONFIG.rs.MIN,
  MAX: LOCAL_CONFIG.rs.MAX,
  THRESHOLD: LOCAL_CONFIG.rs.THRESHOLD,
  K_UP: LOCAL_CONFIG.rs.K_UP,
  K_DOWN: LOCAL_CONFIG.rs.K_DOWN,
  CAP_POS: LOCAL_CONFIG.rs.CAP_POS,
  CAP_NEG: LOCAL_CONFIG.rs.CAP_NEG,
  W_A: LOCAL_CONFIG.rs.W_A,
  W_IQ: LOCAL_CONFIG.rs.W_IQ,
  W_CF: LOCAL_CONFIG.rs.W_CF,
  W_M: LOCAL_CONFIG.rs.W_MB,
  W_IF: LOCAL_CONFIG.rs.W_IF,
  CF_PEER: LOCAL_CONFIG.rs.CF_PEER,
  CF_SELF: LOCAL_CONFIG.rs.CF_SELF,
  S_POS_MAX: LOCAL_CONFIG.rs.S_POS_MAX,
  BR_UPPER: LOCAL_CONFIG.rs.BR_UPPER,
  BR_LOWER: LOCAL_CONFIG.rs.BR_LOWER,
  BR_MIN: LOCAL_CONFIG.rs.BR_MIN,
};

/**
 * @param {number} durationMin
 */
export function getKapiMinutes(durationMin) {
  const { KAPI_PCT, KAPI_MIN_MINUTES, KAPI_MAX_MINUTES } = LOCAL_CONFIG.checkin;
  const raw = durationMin * KAPI_PCT;
  return Math.max(KAPI_MIN_MINUTES, Math.min(KAPI_MAX_MINUTES, raw));
}

/**
 * @param {number} lateMinutes — check_in_time − start_at
 * @param {number} durationMin
 * @returns {{ ais: number, status: 'on_time'|'late'|'no_show' }}
 */
export function computeAis(lateMinutes, durationMin) {
  const kapı = getKapiMinutes(durationMin);
  if (lateMinutes > kapı) {
    return { ais: 0, status: 'no_show' };
  }
  const fullThreshold = kapı * LOCAL_CONFIG.checkin.AIS_FULL_THRESHOLD_PCT;
  if (lateMinutes <= fullThreshold) {
    return { ais: LOCAL_CONFIG.checkin.AIS_REDUCED, status: 'on_time' };
  }
  return { ais: LOCAL_CONFIG.checkin.AIS_LATE, status: 'late' };
}

/**
 * sonMD CheckIn §6 TEK KÖPRÜ — AIS saati = ① denendiği an.
 * Formüller mühür saati (checkin_at) ile yeniden hesaplamaz:
 * 1) basılı ais_score (mühür sonrası attempt NULL)
 * 2) checkin_attempt_at
 * 3) checkin_at (yalnız legacy satır)
 */
export function aisFromAttendanceRow(row, startTime, durationMin) {
  if (row?.ais_score != null && Number.isFinite(Number(row.ais_score))) {
    const ais = Number(row.ais_score);
    if (ais <= 0) return { ais: 0, status: 'no_show', source: 'ais_score' };
    if (ais >= LOCAL_CONFIG.checkin.AIS_REDUCED) {
      return { ais, status: 'on_time', source: 'ais_score' };
    }
    return { ais, status: 'late', source: 'ais_score' };
  }
  const clock = row?.checkin_attempt_at || row?.checkin_at;
  if (!clock || !startTime) return null;
  const lateMinutes = (new Date(clock) - new Date(startTime)) / 60000;
  const ais = computeAis(lateMinutes, Number(durationMin) || 60);
  return {
    ...ais,
    source: row?.checkin_attempt_at ? 'checkin_attempt_at' : 'checkin_at',
  };
}

/**
 * Master Parametre §2 — check-in mesafesi radius sınırında mı?
 * @param {number} distanceM
 * @param {number} radiusM
 */
export function isGpsEdgeDistance(distanceM, radiusM) {
  const d = Number(distanceM);
  const r = Number(radiusM);
  if (!Number.isFinite(d) || !Number.isFinite(r) || r <= 0 || d < 0) return false;
  if (d > r) return false;
  const { MARGIN_M, RATIO_MIN } = LOCAL_CONFIG.checkin.GPS_EDGE;
  const nearMargin = d >= Math.max(0, r - MARGIN_M);
  const nearRatio = d / r >= RATIO_MIN;
  return nearMargin || nearRatio;
}

/**
 * @param {string} [locationType] — custom | venue | zone | moving
 */
export function getGpsRadiusMeters(locationType) {
  const envOverride = process.env.CHECKIN_GPS_MAX_METERS;
  if (envOverride != null && envOverride !== '') {
    const n = Number(envOverride);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const key = String(locationType || LOCAL_CONFIG.checkin.DEFAULT_LOCATION_TYPE).toLowerCase();
  const radii = LOCAL_CONFIG.checkin.GPS_RADIUS_METERS;
  if (key === 'venue') return radii.venue;
  if (key === 'zone') return radii.zone; // default min; ritual.check_in_radius may be 75–100
  if (key === 'moving') return radii.moving;
  if (key === 'scheduled' || key === 'ferry' || key === 'tarifeli' || key === 'vapur') {
    return radii.scheduled ?? radii.ferry ?? radii.venue;
  }
  return radii.custom;
}

/**
 * C2: venue gps_radius_m > dense_canyon yıldızı > ritual.check_in_radius > tip varsayılanı.
 * C1 asla: custom 30 gevşemez (dense yalnız venue satırında).
 */
export function resolveCheckinRadiusMeters({
  locationType,
  ritualRadius,
  venueGpsRadiusM,
  denseCanyon,
} = {}) {
  const nVenue = Number(venueGpsRadiusM);
  if (Number.isFinite(nVenue) && nVenue > 0) return Math.round(nVenue);
  const key = String(locationType || '').toLowerCase();
  const venueLike =
    key === 'venue' || key === 'scheduled' || key === 'ferry' || key === 'tarifeli' || key === 'vapur';
  if (denseCanyon && venueLike) {
    const dense = Number(LOCAL_CONFIG.checkin.GPS_RADIUS_METERS.venue_dense);
    if (Number.isFinite(dense) && dense > 0) return Math.round(dense);
  }
  const nRitual = Number(ritualRadius);
  if (Number.isFinite(nRitual) && nRitual > 0) return Math.round(nRitual);
  return getGpsRadiusMeters(locationType);
}

/**
 * @param {number} ritualIndex — 1-based tamamlanan Ritual sayısı (bu Ritual dahil)
 */
export function getMaturationMultiplier(ritualIndex) {
  for (const tier of LOCAL_CONFIG.rs.MD) {
    if (ritualIndex <= tier.maxRitual) return tier.mult;
  }
  return 1.0;
}

/**
 * @param {number} trend — BC5 ağırlıklı trend 0..1
 * @param {number} deltaSigned
 */
export function getBcMultiplier(trend, deltaSigned) {
  const bc = LOCAL_CONFIG.rs.BC;
  if (deltaSigned === 0) return 1.0;
  if (deltaSigned > 0) {
    if (trend >= bc.POS_TREND_HIGH) return bc.POS_AMP;
    if (trend >= bc.POS_TREND_MID) return 1.0;
    return bc.POS_DAMP;
  }
  if (trend <= bc.NEG_TREND_LOW) return bc.NEG_AMP;
  if (trend <= bc.NEG_TREND_MID) return 1.0;
  return bc.NEG_DAMP;
}

/**
 * @param {number} delta
 */
export function clampRsDelta(delta) {
  const { CAP_NEG, CAP_POS } = LOCAL_CONFIG.rs;
  return Math.max(-CAP_NEG, Math.min(CAP_POS, delta));
}

/** Step 5 raw delta bounds — son-part.md §5 */
export function clampRawDelta(delta) {
  const { RAW_CAP_NEG, RAW_CAP_POS } = LOCAL_CONFIG.rs;
  return Math.max(-RAW_CAP_NEG, Math.min(RAW_CAP_POS, delta));
}

export function rawDeltaFromTruthSignal(S_r, constants = RS_CONSTANTS) {
  if (S_r >= constants.THRESHOLD) {
    return constants.K_UP * 2 * (S_r - constants.THRESHOLD);
  }
  return -constants.K_DOWN * 2 * (constants.THRESHOLD - S_r);
}

export function boundaryResistance(rs, delta, constants = RS_CONSTANTS) {
  if (rs > constants.BR_UPPER && delta > 0) {
    return Math.max(constants.BR_MIN, 1.0 - (0.6 * (rs - constants.BR_UPPER)) / 2.0);
  }
  if (rs < constants.BR_LOWER && delta < 0) {
    return Math.max(constants.BR_MIN, 1.0 - (0.6 * (constants.BR_LOWER - rs)) / 2.0);
  }
  return 1.0;
}

/**
 * son-part.md §5.2 — IQ confidence blend by rater count (after diversity penalty on conf).
 * @param {number} iqRaw — weighted peer average 0..1
 * @param {number} n — rater count
 * @param {number} conf — confidence after diversity adjustment
 */
export function blendIqFromRaw(iqRaw, n, conf) {
  const neutral = 0.5;
  const { IQ_BLEND_N1_NEUTRAL, IQ_BLEND_N1_RAW, IQ_BLEND_N2_RAW, IQ_BLEND_N2_NEUTRAL } =
    LOCAL_CONFIG.rs;

  if (n <= 0) return neutral;
  if (n === 1) return IQ_BLEND_N1_NEUTRAL * neutral + IQ_BLEND_N1_RAW * iqRaw;
  if (n === 2) return IQ_BLEND_N2_RAW * iqRaw + IQ_BLEND_N2_NEUTRAL * neutral;
  return iqRaw * conf + neutral * (1 - conf);
}

/**
 * v2 §4 — CF blend: peers varken CF_PEER/CF_SELF; yokken CF_SELF_NO_PEER_W × self + (1−w)×0.5.
 */
export function blendCf({ CF_peers, CF_self, peerCount }) {
  if (!peerCount || peerCount <= 0) {
    const w = LOCAL_CONFIG.rs.no_peer.CF_SELF_NO_PEER_W;
    return w * CF_self + (1 - w) * 0.5;
  }
  return RS_CONSTANTS.CF_PEER * CF_peers + RS_CONSTANTS.CF_SELF * CF_self;
}

/**
 * NO_PEER_ENGAGEMENT — peer yokken pozitif delta için R1 VEYA memory şart.
 * Negatif delta engellenmez.
 */
export function applyNoPeerEngagementGate(delta, { noPeerPath, hasR1, hasMemory }) {
  if (noPeerPath && delta > 0 && !(hasR1 || hasMemory)) return 0;
  return delta;
}

/** @deprecated alias — applyNoPeerEngagementGate */
export function applySoloEngagementGate(delta, { soloPath, noPeerPath, hasR1, hasMemory }) {
  return applyNoPeerEngagementGate(delta, {
    noPeerPath: noPeerPath ?? soloPath,
    hasR1,
    hasMemory,
  });
}

/**
 * E2.7 soft kategori kapasitesi — soft uyarı, mutlak CUSTOM_MAX_CAP.
 * @param {string|null} category
 * @returns {{ key: string, soft_min: number, soft_max: number }}
 */
export function getCategorySoftCap(category) {
  const caps = LOCAL_CONFIG.ritual.CATEGORY_SOFT_CAPS || {};
  const raw = String(category || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const aliases = [
    [/sohbet|tartisma|felsefe|topluluk|sosyal/, 'sohbet_tartisma'],
    [/kahve|cay|aperitivo/, 'kahve_bulusmasi'],
    [/yemek|mutfak|vegan|sarap|bira/, 'yemek_masasi'],
    [/kitap|okuma|yazi|siir/, 'kitap_okuma'],
    [/oyun|satranc|kart|masa oyun|tavla|dart/, 'oyun_masasi'],
    [/film|tiyatro|podcast|galeri/, 'film_izleme'],
    [/muzik|jam|mikrofon|dans/, 'muzik_jam'],
    [/dil|tandem|languages?/, 'dil_tandem'],
    [/yuruyus|kosu|bisiklet|hiking|run/, 'yuruyus_kosu'],
    [/piknik|acik.?hava|doga|gun dogumu/, 'piknik_acik_hava'],
    [/spor|futbol|basket|voley|tenis|halisaha|takim/, 'takim_spor'],
    [/atolye|ogrenme|calisma|workshop|maker/, 'atolye_ogrenme'],
    [/gezi|kesif|sehir|mahalle/, 'gezi_kesif'],
  ];

  let key = 'diger';
  for (const [re, k] of aliases) {
    if (re.test(raw)) {
      key = k;
      break;
    }
  }
  const band = caps[key] || caps.diger || { soft_min: 3, soft_max: 12 };
  return { key, soft_min: band.soft_min, soft_max: band.soft_max };
}

/**
 * @param {number} capacity
 * @param {string|null} category
 * @param {{ locationType?: string }} [opts]
 * @returns {{ ok: true, soft_warning: null|object } | { ok: false, error: string, code: string }}
 */
export function validateRitualCapacity(capacity, category, opts = {}) {
  const cap = Number(capacity);
  const absMax = Number(LOCAL_CONFIG.ritual.CUSTOM_MAX_CAP || 40);
  if (!Number.isFinite(cap) || cap < LOCAL_CONFIG.ritual.MIN_SIZE) {
    return {
      ok: false,
      code: 'CAPACITY_TOO_LOW',
      error: `Capacity must be at least ${LOCAL_CONFIG.ritual.MIN_SIZE}`,
    };
  }
  const isCustom =
    !opts.locationType ||
    String(opts.locationType).toLowerCase() === 'custom' ||
    opts.locationType === 'free';
  if (isCustom && cap > absMax) {
    return {
      ok: false,
      code: 'CAPACITY_ABSOLUTE_MAX',
      error: `Custom single-table capacity cannot exceed ${absMax} — use event_group or venue event`,
    };
  }
  const soft = getCategorySoftCap(category);
  if (cap > soft.soft_max) {
    return {
      ok: true,
      soft_warning: {
        code: 'SOFT_CAPACITY_EXCEEDED',
        category_key: soft.key,
        soft_max: soft.soft_max,
        capacity: cap,
        message: `${soft.soft_max} kiside tek sohbet zorlasabilir — koselere ayirmak ister misin?`,
      },
    };
  }
  return { ok: true, soft_warning: null };
}

/**
 * Monokrom RS halka opaklığı (1.0–10.0 → ~0.15–1.0). Ham sayı public değil.
 */
export function rsRingOpacity(rsScore) {
  const min = LOCAL_CONFIG.rs.MIN;
  const max = LOCAL_CONFIG.rs.MAX;
  const s = Number(rsScore);
  if (!Number.isFinite(s)) return null;
  const t = Math.max(0, Math.min(1, (s - min) / (max - min)));
  return Math.round((0.15 + 0.85 * t) * 100) / 100;
}

/**
 * son-part.md §5 — P_r ∈ [0, S_POS_MAX], T_r = clamp(P_r − W_IF·IF, 0, 1).
 */
export function computeTruthSignalFromComponents({ A_r, IQ_r, CF_r, M_r, IF_r }) {
  const rawP =
    RS_CONSTANTS.W_A * A_r +
    RS_CONSTANTS.W_IQ * IQ_r +
    RS_CONSTANTS.W_CF * CF_r +
    RS_CONSTANTS.W_M * M_r;
  const P_r = Math.max(0, Math.min(RS_CONSTANTS.S_POS_MAX, rawP));
  const T_r = Math.max(0, Math.min(1, P_r - RS_CONSTANTS.W_IF * IF_r));
  return { P_r, T_r, S_r: T_r };
}

/**
 * Full RS pipeline steps 6–10 — son-part.md §5
 */
export function computeRsPipeline({
  S_r,
  currentRS,
  ritualIndex,
  dsMultiplier = 1.0,
  bcTrend = 0.5,
  nFrozen = false,
}) {
  const deltaRaw = rawDeltaFromTruthSignal(S_r);
  const deltaRawCapped = clampRawDelta(deltaRaw);

  let deltaAfterDs = deltaRawCapped;
  let dsApplied = false;
  if (ritualIndex >= 6) {
    deltaAfterDs = deltaRawCapped * dsMultiplier;
    dsApplied = true;
  }

  if (nFrozen && deltaAfterDs > 0) {
    deltaAfterDs = 0;
  }

  let bcMult = 1.0;
  let deltaAfterBc = deltaAfterDs;
  let bcApplied = false;
  if (ritualIndex >= LOCAL_CONFIG.rs.BC.MIN_RITUALS) {
    bcMult = getBcMultiplier(bcTrend, deltaAfterDs);
    deltaAfterBc = deltaAfterDs * bcMult;
    bcApplied = true;
  }

  const mdMult = getMaturationMultiplier(ritualIndex);
  const deltaAfterMd = deltaAfterBc * mdMult;

  const brMult = boundaryResistance(currentRS, deltaAfterMd);
  const deltaAfterBr = deltaAfterMd * brMult;

  const deltaFinal = clampRsDelta(deltaAfterBr);

  return {
    deltaRaw,
    deltaRawCapped,
    deltaAfterDs,
    deltaAfterBc,
    deltaAfterMd,
    deltaAfterBr,
    deltaFinal,
    dsMult: dsApplied ? dsMultiplier : 1.0,
    bcMult,
    mdMult,
    brMult,
    dsApplied,
    bcApplied,
  };
}

/**
 * @param {number} strike — 1-based no-show sayısı (rolling)
 * @returns {number|null} RS delta; null = sadece uyarı (spec'te no-show için yok — her vuruş ceza)
 */
export function getNoShowRsPenalty(strike) {
  const penalties = LOCAL_CONFIG.penalties.NOSHOW_RS;
  if (strike <= 0) return null;
  const idx = Math.min(strike - 1, penalties.length - 1);
  return -penalties[idx];
}

/**
 * @param {number} strike — 1-based late-cancel sayısı
 * @returns {number|null}
 */
export function getLateCancelRsPenalty(strike) {
  const penalties = LOCAL_CONFIG.penalties.LATE_CANCEL_RS;
  if (strike <= 0) return null;
  const entry = penalties[Math.min(strike - 1, penalties.length - 1)];
  return entry == null ? null : -entry;
}

/** son-part.md §7.2 — no-show askı süreleri (strike 1-based) */
export function getNoShowSuspensionHours(strike) {
  const hours = LOCAL_CONFIG.penalties.NOSHOW_SUSPENSION_HOURS;
  if (strike <= 0) return null;
  const h = hours[Math.min(strike - 1, hours.length - 1)];
  return h == null ? null : h;
}

/** son-part.md §7.3 — host-ban süreleri (strike 1-based) */
export function getHostBanConfig(strike) {
  const bans = LOCAL_CONFIG.penalties.HOST_BAN;
  if (strike <= 0) return null;
  return bans[Math.min(strike - 1, bans.length - 1)] ?? null;
}

/** sonMD §2 — window-kapanışı varsayılan (3/6/12/24 bandı, def. 12) */
export function defaultLiveWindowHours() {
  const n = Number(LOCAL_CONFIG.ritual?.WINDOW_HOURS_DEFAULT ?? 12);
  return Number.isFinite(n) && n > 0 ? n : 12;
}

export function liveWindowHoursOf(ritual) {
  const n = Number(ritual?.live_window_hours);
  return Number.isFinite(n) && n > 0 ? n : defaultLiveWindowHours();
}

/** SQL COALESCE(live_window_hours, N) — config’ten güvenli tamsayı */
export function liveWindowHoursSqlDefault() {
  return String(Math.round(defaultLiveWindowHours()));
}

/** KİLİT-ANI eşiği (dk): duration×%25, clamp(15dk–3h) */
export function freeCancelThresholdMinutes(ritual) {
  const durationMin = Math.max(1, Number(ritual?.duration) || 60);
  const pct = LOCAL_CONFIG.ritual.CANCEL_FREE_THRESHOLD_PCT ?? 0.25;
  const minM = LOCAL_CONFIG.ritual.CANCEL_FREE_MIN_MINUTES ?? 15;
  const maxM = LOCAL_CONFIG.ritual.CANCEL_FREE_MAX_MINUTES ?? 180;
  const raw = durationMin * pct;
  return Math.max(minM, Math.min(maxM, raw));
}

/** Kalan süre / toplam duration — bilgi amaçlı oran */
export function durationPctUntilStart(ritual, now = new Date()) {
  const start = new Date(ritual.start_time);
  const durationMin = Number(ritual.duration) || 60;
  const remainingMs = start.getTime() - now.getTime();
  if (remainingMs <= 0) return 0;
  return remainingMs / (durationMin * 60000);
}

/** Serbest iptal: start’a kalan süre > KİLİT-ANI eşiği */
export function isFreeCancelWindow(ritual, now = new Date()) {
  const start = new Date(ritual.start_time);
  const remainingMs = start.getTime() - now.getTime();
  if (remainingMs <= 0) return false;
  const thresholdMs = freeCancelThresholdMinutes(ritual) * 60000;
  return remainingMs > thresholdMs;
}

/** Join sonrası grace içinde mi — son-part.md §7.1 */
export function isWithinJoinGrace(attendance, now = new Date()) {
  const joinedAt = new Date(attendance.joined_at || attendance.created_at);
  if (Number.isNaN(joinedAt.getTime())) return false;
  const graceMs = LOCAL_CONFIG.ritual.GRACE_MINUTES * 60000;
  return now.getTime() - joinedAt.getTime() <= graceMs;
}

export function requiresReplacement(ritual, now = new Date()) {
  const start = new Date(ritual.start_time);
  if (now >= start) return false;
  return !isFreeCancelWindow(ritual, now);
}

/** FL level from fresh feedback count — son-part.md §4.2 */
export function levelFromFbCount(count) {
  const n = Number(count) || 0;
  const [t1, t2, t3] = LOCAL_CONFIG.fl.THRESHOLDS;
  if (n >= t3) return 'l3';
  if (n >= t2) return 'l2';
  if (n >= t1) return 'l1';
  return 'stranger';
}

/** IQ feedback weight by FL level */
export function fbWeightFromLevel(level) {
  const weights = LOCAL_CONFIG.fl.FB_WEIGHTS;
  if (level === 'l1') return weights[0];
  if (level === 'l2') return weights[1];
  if (level === 'l3') return weights[2];
  return 0;
}

/** DS_full FL weight — son-part.md §6 (stranger=FL0) */
export function dsFlWeight(level, _isRegular = false) {
  const w = LOCAL_CONFIG.ds.FL_W;
  if (level === 'l3') return w[3];
  if (level === 'l2') return w[2];
  if (level === 'l1') return w[1];
  return w[0];
}

export function isExcludedFromDsAdjusted(level, isRegular = false) {
  return level === 'l3' || isRegular;
}

export function computeDsRaw(pd, ctxD, vd) {
  const { W_PD, W_CTX, W_VD } = LOCAL_CONFIG.ds;
  return W_PD * pd + W_CTX * ctxD + W_VD * vd;
}

export function computeDsMultiplierFromEma(dsEma, ritualIndex = 1) {
  const ds = LOCAL_CONFIG.ds;
  const ema = Number(dsEma) || ds.INIT;
  const idx = ritualIndex || 1;
  if (idx <= ds.MULT_NEW_MAX_RITUAL) {
    return Math.max(ds.MULT_NEW_BASE, Math.min(1.2, ds.MULT_NEW_BASE + ds.MULT_NEW_EMA_COEF * ema));
  }
  return Math.max(ds.MULT_MATURE_BASE, Math.min(1.2, ds.MULT_MATURE_BASE + ds.MULT_MATURE_EMA_COEF * ema));
}

export function tierFromDsFull(dsFull) {
  const thresholds = LOCAL_CONFIG.ds.TIER_THRESHOLDS;
  const names = LOCAL_CONFIG.ds.TIER_NAMES;
  const v = Number(dsFull) || 0;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (v >= thresholds[i]) return names[i + 1] ?? names[names.length - 1];
  }
  return names[0];
}

/** Human-readable tier label (private DS dashboard) */
export function tierLabelTr(tier) {
  const labels = {
    homebody: 'Evci (Homebody)',
    familiar: 'Tanidik (Familiar)',
    explorer: 'Kesifci (Explorer)',
    wanderer: 'Gezgin (Wanderer)',
    voyager: 'Voyager',
  };
  return labels[String(tier || '').toLowerCase()] || tier || '—';
}

export function computeWindowVd(uniqueVenueCount, maxCap = LOCAL_CONFIG.ds.MAX_WINDOW_CAPACITY) {
  return Math.min(1, Number(uniqueVenueCount) / Math.max(1, Number(maxCap)));
}

export function updateDsEma(prevEma, dsRaw) {
  const alpha = LOCAL_CONFIG.ds.ALPHA;
  const prev = Number(prevEma);
  const raw = Number(dsRaw);
  const p = Number.isFinite(prev) ? prev : LOCAL_CONFIG.ds.INIT;
  const r = Number.isFinite(raw) ? raw : LOCAL_CONFIG.ds.INIT;
  return (1 - alpha) * p + alpha * r;
}

export default LOCAL_CONFIG;
