/**
 * LOCAL string table — v2 §16
 * Shape: {key, EN, TR, route?} · Concept words NEVER translated. UI uses t().
 * Keep in sync with backend/src/i18n/stringTable.js
 */
import { CHIP_COPY_STUBS } from './chipCopyStubs';

export const CONCEPT_WORDS = Object.freeze({
  ritual: 'Ritual',
  window: 'Window',
  pulse: 'Pulse',
  local_world: 'Local World',
  aura: 'Aura',
  trust: 'Trust',
  regular: 'Regular',
  takeover: 'Takeover',
});

export const STRING_TABLE = {
  ritual: { key: 'ritual', EN: 'Ritual', TR: 'Ritual', translate: false, route: 'RitualDetail' },
  window: { key: 'window', EN: 'Window', TR: 'Window', translate: false, route: 'LiveRitual' },
  pulse: { key: 'pulse', EN: 'Pulse', TR: 'Pulse', translate: false, route: 'PulseHome' },
  local_world: { key: 'local_world', EN: 'Local World', TR: 'Local World', translate: false, route: 'PulseHome' },
  aura: { key: 'aura', EN: 'Aura', TR: 'Aura', translate: false, route: 'VenueDetail' },
  trust: { key: 'trust', EN: 'Trust', TR: 'Trust', translate: false, route: 'VenueDetail' },
  regular: { key: 'regular', EN: 'Regular', TR: 'Regular', translate: false, route: 'VenueDetail' },
  takeover: { key: 'takeover', EN: 'Takeover', TR: 'Takeover', translate: false, route: 'VenueDetail' },

  street_masa_tonight: {
    key: 'street_masa_tonight',
    EN: 'Got a table tonight?',
    TR: 'Bu akşam masan var mı?',
    route: 'PulseHome',
  },

  time_instant: { key: 'time_instant', EN: 'Instant', TR: 'Anlık' },
  time_planned: { key: 'time_planned', EN: 'Planned', TR: 'Planlı' },
  time_series: { key: 'time_series', EN: 'Series', TR: 'Seri' },

  soz: { key: 'soz', EN: 'Comment', TR: 'Söz', route: 'MemoryDetail' },
  yanki: { key: 'yanki', EN: 'Echo', TR: 'Yankı', route: 'MemoryDetail' },
  rulo: { key: 'rulo', EN: 'Roll', TR: 'Rulo', route: 'SocialPassport' },

  culture_id_1: {
    key: 'culture_id_1',
    EN: 'Asking for the code is saying hello.',
    TR: 'Kodu sormak selam vermektir.',
    open: false,
  },
  culture_id_2: {
    key: 'culture_id_2',
    EN: 'The first to arrive opens the table — no host privilege.',
    TR: 'Masayı ilk gelen açar — host imtiyazı yok.',
    open: false,
  },
  culture_id_3: {
    key: 'culture_id_3',
    EN: 'The code travels mouth to mouth at the table — never by chat.',
    TR: 'Kod masada ağızdan ağıza gider — mesajla değil.',
    open: false,
  },
  culture_id_4: {
    key: 'culture_id_4',
    EN: 'Relay: whoever is sealed passes the code to the next arrival.',
    TR: 'Relay: mührü olan, kodu sonra gelene verir.',
    open: false,
  },
  kyc_err_durable: {
    key: 'kyc_err_durable',
    EN: 'Enter a document number (min 6 characters) for a stable identity seal.',
    TR: 'Stabil kimlik mühürü için belge numarası gir (en az 6 karakter).',
    open: false,
  },
  kyc_err_liveness: {
    key: 'kyc_err_liveness',
    EN: 'Liveness or face match failed. Hold still and try again.',
    TR: 'Canlılık veya yüz eşleşmesi başarısız. Sabit durup tekrar dene.',
    open: false,
  },
  kyc_err_blacklist: {
    key: 'kyc_err_blacklist',
    EN: 'This identity cannot re-register (permanent ban).',
    TR: 'Bu kimlikle yeniden kayıt yapılamaz (kalıcı ban).',
    open: false,
  },
  kyc_err_reregister: {
    key: 'kyc_err_reregister',
    EN: 'This identity is already linked to another account.',
    TR: 'Bu kimlik başka bir hesaba bağlı.',
    open: false,
  },
  kyc_err_media: {
    key: 'kyc_err_media',
    EN: 'Photos are never uploaded. Capture stays on device (verify-and-discard).',
    TR: 'Fotoğraflar yüklenmez. Kare cihazda kalır (doğrula-ve-at).',
    open: false,
  },
  kyc_err_once: {
    key: 'kyc_err_once',
    EN: 'Identity verification is once in a lifetime.',
    TR: 'Kimlik doğrulama ömürde bir kez yapılır.',
    open: false,
  },
  kyc_step_account: { key: 'kyc_step_account', EN: 'Account', TR: 'Hesap', open: false },
  kyc_step_doc: { key: 'kyc_step_doc', EN: 'Document', TR: 'Belge', open: false },
  kyc_step_camera: { key: 'kyc_step_camera', EN: 'Camera', TR: 'Kamera', open: false },
  kyc_step_nfc: { key: 'kyc_step_nfc', EN: 'NFC', TR: 'NFC', open: false },
  kyc_step_done: { key: 'kyc_step_done', EN: 'Verify', TR: 'Doğrula', open: false },
  report_cat_uncomfortable: {
    key: 'report_cat_uncomfortable',
    EN: 'I do not feel comfortable',
    TR: 'Kendimi rahat hissetmiyorum',
    open: false,
  },
  report_cat_boundary: {
    key: 'report_cat_boundary',
    EN: 'Someone crossed a boundary',
    TR: 'Birinin davranışı sınırı aştı',
    open: false,
  },
  report_cat_mismatch: {
    key: 'report_cat_mismatch',
    EN: 'Ritual was not as described',
    TR: 'Ritual tanımlandığı gibi değil',
    open: false,
  },
  report_cat_other: { key: 'report_cat_other', EN: 'Something else', TR: 'Başka bir şey', open: false },
  report_cat_csam: {
    key: 'report_cat_csam',
    EN: 'Child sexual abuse material / exploitation',
    TR: 'Çocuk istismarı / cinsel içerik (CSAM)',
    open: false,
  },
  report_cat_sexual_assault: {
    key: 'report_cat_sexual_assault',
    EN: 'Sexual assault',
    TR: 'Cinsel saldırı',
    open: false,
  },

  music_attr_spotify: {
    key: 'music_attr_spotify',
    EN: 'Spotify · link-out · audio does not stream from LOCAL',
    TR: "Spotify · link-out · ses LOCAL'den akmaz",
  },
  music_attr_apple: {
    key: 'music_attr_apple',
    EN: 'Apple Music · link-out · audio does not stream from LOCAL',
    TR: "Apple Music · link-out · ses LOCAL'den akmaz",
  },
  music_attr_youtube: {
    key: 'music_attr_youtube',
    EN: 'YouTube · link-out (3rd) · audio does not stream from LOCAL',
    TR: "YouTube · link-out (3. sıra) · ses LOCAL'den akmaz",
  },

  // Concept-layer plurals / common UI (never translate base concept)
  rituals: { key: 'rituals', EN: 'Rituals', TR: 'Rituals', translate: false },
  windows: { key: 'windows', EN: 'Windows', TR: 'Windows', translate: false },
  active_windows: {
    key: 'active_windows',
    EN: 'Active Windows',
    TR: 'Active Windows',
    translate: false,
  },
  create_ritual: {
    key: 'create_ritual',
    EN: 'Create Ritual',
    TR: 'Ritual Olustur',
    translate: false,
  },
  event_group_ritual_count: {
    key: 'event_group_ritual_count',
    EN: '{n} Ritual',
    TR: '{n} Ritual',
    translate: false,
  },
  ritual_full_other: {
    key: 'ritual_full_other',
    EN: 'This Ritual is full — other Rituals',
    TR: 'Bu Ritual dolu — diger Rituals',
    translate: false,
  },
  other_rituals: {
    key: 'other_rituals',
    EN: 'Other Rituals:',
    TR: 'Diger Rituals:',
    translate: false,
  },

  // Code display — v2 §2: digits only (spoken readout removed)
  code_readout_tr: {
    key: 'code_readout_tr',
    EN: '{digits}',
    TR: '{digits}',
    open: false,
    note: 'spoken line removed — digits only',
  },

  // §2C fee + audience
  fee_badge: { key: 'fee_badge', EN: '₺{amount}', TR: '₺{amount}' },
  fee_note_default: {
    key: 'fee_note_default',
    EN: 'Pay on site',
    TR: 'Yerinde ödenir',
  },
  audience_public: { key: 'audience_public', EN: 'Public', TR: 'Herkese açık' },
  audience_friends: {
    key: 'audience_friends',
    EN: 'Friends only',
    TR: 'Yalnız arkadaşlar',
  },
  audience_hint: {
    key: 'audience_hint',
    EN: 'FRIENDS: discovery only for FL friends of the host',
    TR: 'FRIENDS: keşif yalnız host’un FL arkadaşlarına',
  },

  // §2 check-in / window
  checkin_early_open: {
    key: 'checkin_early_open',
    EN: 'Check-in opens 15 min before start',
    TR: 'Check-in start’tan 15 dk önce açılır',
  },
  checkin_find_table: {
    key: 'checkin_find_table',
    EN: '{place} · Host: {host} · {n} here now',
    TR: '{place} · Host: {host} · şu an {n} kişi',
    route: 'RitualCheckIn',
  },
  pending_witness: {
    key: 'pending_witness',
    EN: 'Waiting for a sealed witness',
    TR: 'Mühürlü tanık bekleniyor',
    route: 'RitualCheckIn',
  },
  first_seal_opened: {
    key: 'first_seal_opened',
    EN: 'Ritual opened',
    TR: 'Ritual açıldı',
    route: 'RitualCheckIn',
  },

  // §5 window panel (4 structural buttons)
  win_report: { key: 'win_report', EN: 'Report', TR: 'Bildir' },
  win_report_leave: {
    key: 'win_report_leave',
    EN: 'Report and leave',
    TR: 'Bildir ve ayrıl',
  },
  win_share_location: {
    key: 'win_share_location',
    EN: 'Share my location with a friend',
    TR: 'Konumumu bir arkadaşımla paylaş',
  },
  win_help: { key: 'win_help', EN: 'Help options', TR: 'Yardım seçenekleri' },

  // §14 passport tabs
  tab_quote: { key: 'tab_quote', EN: 'Quote', TR: 'Quote', route: 'SocialPassport' },
  tab_badge: { key: 'tab_badge', EN: 'Badge', TR: 'Badge', route: 'SocialPassport' },
  tab_memories: { key: 'tab_memories', EN: 'Memories', TR: 'Memories', route: 'SocialPassport' },
  tab_rulo: { key: 'tab_rulo', EN: 'Roll', TR: 'Rulo', route: 'SocialPassport' },

  // §15 memory actions
  action_upvote: { key: 'action_upvote', EN: 'Up', TR: '▲' },
  action_downvote: { key: 'action_downvote', EN: 'Down', TR: '▼' },

  // §8 night report
  night_report_title: {
    key: 'night_report_title',
    EN: 'Night Report',
    TR: 'Gece Raporu',
  },
  night_aura: { key: 'night_aura', EN: 'Aura of the day', TR: 'Günün Aurasi' },

  // §6 regular
  regular_progress: {
    key: 'regular_progress',
    EN: '{n}/{need} toward Regular',
    TR: 'Regular’a {n}/{need}',
  },

  // §3 memory share ladder
  share_window: { key: 'share_window', EN: 'Window', TR: 'Window', route: 'CreateMemory' },
  share_circle: {
    key: 'share_circle',
    EN: '+Circle (Your Pulse)',
    TR: '+Çevre (Your Pulse)',
  },
  share_city: {
    key: 'share_city',
    EN: '+City (Local World)',
    TR: '+Şehir (Local World)',
  },
  save_to_rulo: {
    key: 'save_to_rulo',
    EN: 'Save to Roll',
    TR: 'Ruloya kaydet',
  },

  // §13 / forum
  forum_after_window: {
    key: 'forum_after_window',
    EN: 'Keep the discussion open after the table ends?',
    TR: 'Masa bitince tartışma devam etsin mi?',
  },
  forum_no: {
    key: 'forum_no',
    EN: 'No — traces stay, the ledger closes',
    TR: 'Hayır — izler kalır, defter kapanır',
  },
  forum_yes: {
    key: 'forum_yes',
    EN: 'Yes — forum stays open',
    TR: 'Evet — forum açık kalır',
  },

  find_note_label: {
    key: 'find_note_label',
    EN: 'How to find us',
    TR: 'Bizi nasıl bulursun',
  },

  ...Object.fromEntries(
    Object.entries(CHIP_COPY_STUBS).map(([k, v]) => [k, { ...v, route: v.route || 'RitualFeedback' }])
  ),
};

/**
 * @param {string} key
 * @param {'tr'|'en'} [lang]
 * @param {Record<string, string|number>} [vars]
 */
export function t(key, lang = 'tr', vars = {}) {
  const row = STRING_TABLE[key];
  if (!row) return key;
  let out = row.translate === false ? row.EN : lang === 'en' ? row.EN : row.TR;
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return out;
}

/** Concept word helper — always returns locked English form */
export function concept(word) {
  const k = String(word || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return CONCEPT_WORDS[k] || CONCEPT_WORDS[word] || word;
}

/** v2 §2: digits only — yazı-okunuş yok */
export function formatCodeReadout(code, _lang = 'tr') {
  return String(code || '').replace(/\D/g, '').slice(0, 3);
}

export default STRING_TABLE;
