/**
 * LOCAL_FB_Soru_Agaci_v2 — kilitli ürün kuralları.
 * Copy cilası isim-oturumunda; etiketler (fiil-chip'ler) kilitli.
 * CF uyku · chip skora girmez · yeşil+kırmızı asla.
 */
import LOCAL_CONFIG from '../config/localConfig.js';

const MIN_BRANCH = 4;

export const FB_FEELINGS = ['green', 'yellow', 'red'];

/** Kilitli ağaç — ID'ler dil-bağımsız. */
export const FB_TREE = {
  K1: {
    axis: 'q1_comfort',
    question: 'X ile aynı masada kendini nasıl hissettin?',
    scores: 'iq_q1',
    sets: {
      green: ['p2p_g_1', 'p2p_g_2', 'p2p_g_3', 'p2p_g_4', 'p2p_g_5'],
      yellow: ['p2p_y_1', 'p2p_y_2', 'p2p_y_3', 'p2p_y_4', 'p2p_y_5'],
      red: ['p2p_r_1', 'p2p_r_2', 'p2p_r_3', 'p2p_r_4', 'p2p_r_5'],
    },
  },
  K2: {
    axis: 'q2_energy',
    question: 'X masanın akışına nasıl katıldı?',
    scores: 'iq_q2',
    sets: {
      green: ['k2_g_1', 'k2_g_2', 'k2_g_3', 'k2_g_4', 'k2_g_5'],
      yellow: ['k2_y_1', 'k2_y_2', 'k2_y_3', 'k2_y_4', 'k2_y_5'],
      red: ['k2_r_1', 'k2_r_2', 'k2_r_3', 'k2_r_4', 'k2_r_5'],
    },
  },
  R: {
    kind: 'RQ',
    question: 'Bu masa nasıl geçti?',
    scores: 'r_archive_host_mirror',
    sets: {
      green: ['rq_g_1', 'rq_g_2', 'rq_g_3', 'rq_g_4', 'rq_g_5'],
      yellow: ['rq_y_1', 'rq_y_2', 'rq_y_3', 'rq_y_4', 'rq_y_5'],
      red: ['rq_r_1', 'rq_r_2', 'rq_r_3', 'rq_r_4', 'rq_r_5'],
    },
  },
  V: {
    kind: 'P2V',
    question: 'Mekan nasıldı?',
    scores: 'venue_trust',
    sets: {
      green: ['p2v_g_1', 'p2v_g_2', 'p2v_g_3', 'p2v_g_4', 'p2v_g_5'],
      yellow: ['p2v_y_1', 'p2v_y_2', 'p2v_y_3', 'p2v_y_4', 'p2v_y_5'],
      red: ['p2v_r_servis', 'p2v_r_gurultu', 'p2v_r_temizlik', 'p2v_r_ucret', 'p2v_r_masa'],
    },
  },
  P2C: {
    kind: 'P2C',
    question: 'Buluşma için yer uygun muydu?',
    scores: 'none',
    sets: {
      green: ['p2c_g_1', 'p2c_g_2', 'p2c_g_3', 'p2c_g_4', 'p2c_g_5'],
      yellow: ['p2c_y_1', 'p2c_y_2', 'p2c_y_3', 'p2c_y_4', 'p2c_y_5'],
      red: ['p2c_r_1', 'p2c_r_2', 'p2c_r_3', 'p2c_r_4', 'p2c_r_5'],
    },
  },
  P2Z: {
    kind: 'P2Z',
    question: 'Bu zone buluşmana nasıl hizmet etti?',
    scores: 'none',
    sets: {
      green: ['p2z_g_1', 'p2z_g_2', 'p2z_g_3', 'p2z_g_4', 'p2z_g_5'],
      yellow: ['p2z_y_1', 'p2z_y_2', 'p2z_y_3', 'p2z_y_4', 'p2z_y_5'],
      red: ['p2z_r_totem', 'p2z_r_1', 'p2z_r_guvenlik', 'p2z_r_temizlik', 'p2z_r_erisim'],
    },
  },
  E: {
    kind: 'E',
    question: 'Gece geneli nasıldı?',
    scores: 'organizer_card',
    sets: {
      green: ['e_g_1', 'e_g_2', 'e_g_3', 'e_g_4', 'e_g_5'],
      yellow: ['e_y_1', 'e_y_2', 'e_y_3', 'e_y_4'],
      red: ['e_r_1', 'e_r_2', 'e_r_3', 'e_r_4', 'e_r_5'],
    },
  },
  S: {
    kind: 'S',
    question: 'Hizmet nasıldı?',
    scores: 'seller_sicil',
    sets: {
      green: ['s_g_1', 's_g_2', 's_g_3', 's_g_4', 's_g_5'],
      yellow: ['s_y_1', 's_y_2', 's_y_3', 's_y_4', 's_y_5'],
      red: ['s_r_1', 's_r_2', 's_r_3', 's_r_4', 's_r_5'],
    },
  },
  VR: {
    kind: 'VR',
    question: 'Masa mekan açısından nasıl ilerledi?',
    scores: 'ops_note_only',
    sets: {
      green: ['vr_g_1', 'vr_g_2', 'vr_g_3', 'vr_g_4', 'vr_g_5'],
      yellow: ['vr_y_1', 'vr_y_2', 'vr_y_3', 'vr_y_4', 'vr_y_5'],
      red: ['vr_r_1', 'vr_r_2', 'vr_r_3', 'vr_r_4', 'vr_r_5'],
    },
  },
};

const INTENT_RE = /tekrar (gelir|alır|oturur)|would (come|buy|sit) again/i;

export function fbSpecPins() {
  const chip = LOCAL_CONFIG.chip || {};
  const rs = LOCAL_CONFIG.rs || {};
  const ritual = LOCAL_CONFIG.ritual || {};
  return {
    categories: 3,
    min_chips_per_branch: MIN_BRANCH,
    max_chip_select: Number(chip.MAX_CHIP_SELECT ?? 2),
    chips_enter_scores: false,
    cf_asleep: Number(rs.W_CF) === 0,
    r1_archive_only: true,
    host_own_rq: false,
    safety_separate: true,
    p2c_p2z_enter_person_scores: false,
    vr_enters_rs: false,
    vr_enters_trust: false,
    vr_public: false,
    freeze_0208: ritual.FEEDBACK_FREEZE_0208 === true,
    window_hours: Number(ritual.FEEDBACK_FLOOR_HOURS ?? 12),
    p2p_max_people: Number(chip.P2P_MAX_PEOPLE ?? 2),
    sub_fb_max: Number(ritual.SUB_FB_MAX ?? 3),
    vitrine: {
      public_default: false,
      opt_in: true,
      positive_only: true,
      max_chips: 3,
      copy_prefix: 'Sık anılanlar:',
      exact_count_public: false,
      min_raters: 4,
      min_rituals: 2,
    },
  };
}

export function assertBranchMin(ids = []) {
  return { ok: (ids || []).length >= MIN_BRANCH, n: (ids || []).length, min: MIN_BRANCH };
}

export function assertFbTreeLocks() {
  const pins = fbSpecPins();
  const failures = [];
  if (!pins.cf_asleep) failures.push('CF_AWAKE');
  if (pins.chips_enter_scores) failures.push('CHIPS_SCORE');
  if (pins.window_hours !== 12) failures.push('WINDOW_NOT_12H');
  if (pins.freeze_0208) failures.push('FREEZE_ON');
  if (pins.max_chip_select !== 2) failures.push('MAX_CHIP');
  for (const [name, node] of Object.entries(FB_TREE)) {
    for (const [color, ids] of Object.entries(node.sets)) {
      if (ids.length < MIN_BRANCH) failures.push(`${name}_${color}_LT4`);
    }
  }
  return { ok: failures.length === 0, failures, pins };
}

export function colorOfChip(chipId) {
  const id = String(chipId || '').toLowerCase();
  if (!id) return null;
  if (/(^|_)g_/.test(id) || /_g\d/.test(id)) return 'green';
  if (/(^|_)y_/.test(id) || /_y\d/.test(id)) return 'yellow';
  if (/(^|_)r_/.test(id) || id.includes('_r_') || /_r[a-z]/.test(id)) return 'red';
  return null;
}

const NEIGHBOR = {
  green: ['green', 'yellow'],
  yellow: ['green', 'yellow', 'red'],
  red: ['red', 'yellow'],
};

/** ilki kategoriden; ikincisi aynı/komşu; yeşil+kırmızı asla */
export function assertChipPair({ feeling, chipIds = [] } = {}) {
  const ids = (chipIds || []).filter(Boolean).slice(0, 2);
  if (ids.length > 2) {
    return { ok: false, code: 'CHIP_MAX_2' };
  }
  if (ids.length <= 1) return { ok: true, chip_ids: ids };
  const f = String(feeling || '').toLowerCase();
  const c0 = colorOfChip(ids[0]);
  const c1 = colorOfChip(ids[1]);
  if ((c0 === 'green' && c1 === 'red') || (c0 === 'red' && c1 === 'green')) {
    return { ok: false, code: 'CHIP_GREEN_RED', error: 'Yeşil ve kırmızı birlikte seçilemez' };
  }
  if (f && c0 && c0 !== f) {
    return { ok: false, code: 'CHIP_FIRST_CATEGORY', error: 'İlk chip seçilen kategoriden olmalı' };
  }
  const allow = NEIGHBOR[f] || NEIGHBOR[c0] || FB_FEELINGS;
  if (c1 && !allow.includes(c1)) {
    return { ok: false, code: 'CHIP_NEIGHBOR', error: 'İkinci chip aynı veya komşu kategoriden olmalı' };
  }
  return { ok: true, chip_ids: ids };
}

export function assertNoIntentCopy(text) {
  const raw = String(text || '');
  if (INTENT_RE.test(raw)) {
    return { ok: false, code: 'CHIP_INTENT_FORBIDDEN' };
  }
  return { ok: true };
}

export function chipsNeverEnterScores() {
  return true;
}

export function isCfAsleep() {
  return Number(LOCAL_CONFIG.rs?.W_CF) === 0;
}

export function averageIqDimensions(q1, q2) {
  const a = q1 == null ? null : Number(q1);
  const b = q2 == null ? null : Number(q2);
  if (a == null && b == null) return null;
  if (a != null && b != null) return (a + b) / 2;
  return a ?? b;
}

export function p2pMaxPeople() {
  return Number(LOCAL_CONFIG.chip?.P2P_MAX_PEOPLE ?? 2);
}

export function assertP2pPeopleCap(count) {
  const max = p2pMaxPeople();
  if (Number(count) > max) {
    return { ok: false, code: 'P2P_MAX_PEOPLE', max };
  }
  return { ok: true, max };
}

export function feedbackEntersPersonScore(feedbackType) {
  const t = String(feedbackType || '').toLowerCase();
  if (t === 'p2c' || t === 'p2z' || t === 'vr' || t === 'p2s' || t === 'seller' || t === 'r1_self' || t === 'rq_event') {
    return false;
  }
  return t === 'p2p' || t === 'p2host';
}

export function vrWalls() {
  return {
    enters_rs: false,
    enters_trust: false,
    public: false,
    first_record: 'ops_note',
    auto_host_block: false,
    staff_person_score: false,
    per_ritual: 1,
  };
}

export function assertVrSubmit({ existingForRitual = 0 } = {}) {
  const walls = vrWalls();
  if (Number(existingForRitual) >= walls.per_ritual) {
    return { ok: false, code: 'VR_ONE_PER_RITUAL' };
  }
  return { ok: true, walls };
}

/** aura_relevant: mekan/zone kelimesi. K1/K2/insan RQ yazılmaz. */
export function isAuraRelevantChip(chipId, { place = 'venue' } = {}) {
  const id = String(chipId || '').toLowerCase();
  if (!id) return false;
  if (id.startsWith('k1_') || id.startsWith('k2_') || id.startsWith('p2p_')) return false;
  if (id.startsWith('vr_') || id.startsWith('s_') || id.startsWith('p2c_')) return false;
  if (place === 'zone') {
    return id.startsWith('p2z_g_') || id.startsWith('p2z_y_');
  }
  if (id.startsWith('p2v_')) return true;
  if (id.startsWith('e_g_') || id.startsWith('e_y_')) return true;
  return false;
}

export function buildSikAnilanlar({
  chips = [],
  optIn = false,
  distinctRaters = 0,
  distinctRituals = 0,
  sellerForced = false,
} = {}) {
  const pins = fbSpecPins().vitrine;
  if (!sellerForced) {
    if (!optIn) return { public: false, copy: null, reason: 'opt_in' };
    if (Number(distinctRaters) < pins.min_raters || Number(distinctRituals) < pins.min_rituals) {
      return { public: false, copy: null, reason: 'threshold' };
    }
  }
  const positive = (chips || [])
    .filter((c) => colorOfChip(c.chip_id || c.id) === 'green' || c.positive === true)
    .slice(0, pins.max_chips)
    .map((c) => c.label || c.chip_id || c.id)
    .filter(Boolean);
  if (!positive.length) return { public: false, copy: null, reason: 'empty' };
  return {
    public: true,
    copy: `${pins.copy_prefix} ${positive.join(' · ')}`,
    exact_count: null,
    chips: positive,
  };
}

export function sellerSicilPublic({ n = 0, negative = false, minN = 10 } = {}) {
  if (negative && Number(n) < Number(minN)) {
    return { public: false, reason: 'MIN_N' };
  }
  return { public: true, buyer_identity: false, personal_rs: 'opt_in_hidden' };
}

export function configSetsFromTree() {
  return {
    RQ_GREEN: [...FB_TREE.R.sets.green],
    RQ_YELLOW: [...FB_TREE.R.sets.yellow],
    RQ_RED: [...FB_TREE.R.sets.red],
    P2V_GREEN: [...FB_TREE.V.sets.green],
    P2V_YELLOW: [...FB_TREE.V.sets.yellow],
    P2V_RED: [...FB_TREE.V.sets.red],
    P2Z_GREEN: [...FB_TREE.P2Z.sets.green],
    P2Z_YELLOW: [...FB_TREE.P2Z.sets.yellow],
    P2Z_RED: [...FB_TREE.P2Z.sets.red],
    P2C_GREEN: [...FB_TREE.P2C.sets.green],
    P2C_YELLOW: [...FB_TREE.P2C.sets.yellow],
    P2C_RED: [...FB_TREE.P2C.sets.red],
    P2P_GREEN: [...FB_TREE.K1.sets.green],
    P2P_YELLOW: [...FB_TREE.K1.sets.yellow],
    P2P_RED: [...FB_TREE.K1.sets.red],
    K2_GREEN: [...FB_TREE.K2.sets.green],
    K2_YELLOW: [...FB_TREE.K2.sets.yellow],
    K2_RED: [...FB_TREE.K2.sets.red],
    E_GREEN: [...FB_TREE.E.sets.green],
    E_YELLOW: [...FB_TREE.E.sets.yellow],
    E_RED: [...FB_TREE.E.sets.red],
    S_GREEN: [...FB_TREE.S.sets.green],
    S_YELLOW: [...FB_TREE.S.sets.yellow],
    S_RED: [...FB_TREE.S.sets.red],
    VR_GREEN: [...FB_TREE.VR.sets.green],
    VR_YELLOW: [...FB_TREE.VR.sets.yellow],
    VR_RED: [...FB_TREE.VR.sets.red],
  };
}
