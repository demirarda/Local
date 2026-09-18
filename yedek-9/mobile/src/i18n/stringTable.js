/**
 * LOCAL string table — v2 §16
 * Shape: {key, EN, TR, route?} · Concept words NEVER translated. UI uses t().
 * Keep in sync with backend/src/i18n/stringTable.js
 */
import { CHIP_COPY_STUBS } from './chipCopyStubs';
import useLanguageStore from '../store/languageStore';

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
  guvenlik_bildir: {
    key: 'guvenlik_bildir',
    EN: 'Safety alert (not feedback)',
    TR: 'Güvenlik bildir (FB değil)',
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

  // Settings + language picker
  settings_title: { key: 'settings_title', EN: 'Settings', TR: 'Ayarlar' },
  settings_back_passport: { key: 'settings_back_passport', EN: '← Passport', TR: '← Passport' },
  settings_edit_profile: { key: 'settings_edit_profile', EN: 'Edit profile', TR: 'Profili Duzenle' },
  settings_user_fallback: { key: 'settings_user_fallback', EN: 'User', TR: 'Kullanici' },
  settings_uni_city_fallback: { key: 'settings_uni_city_fallback', EN: 'University · City', TR: 'Universite · Sehir' },
  settings_profile_hub: { key: 'settings_profile_hub', EN: 'Profile settings', TR: 'Profil ayarlari' },
  settings_profile_hub_sub: {
    key: 'settings_profile_hub_sub',
    EN: 'Uni tag · hosted count · privacy',
    TR: 'Uni-etiket · hosted sayı · gizlilik',
  },
  settings_trust_label: { key: 'settings_trust_label', EN: 'Trust', TR: 'Guvenilirlik' },
  settings_trust_status: {
    key: 'settings_trust_status',
    EN: 'Monochrome band · raw number hidden',
    TR: 'Monokrom bant · ham sayı gizli',
  },
  settings_trust_sub: {
    key: 'settings_trust_sub',
    EN: 'Open the RS transparency screen',
    TR: 'Detay için RS şeffaflık ekranı',
  },
  settings_group_account: { key: 'settings_group_account', EN: 'Account', TR: 'Hesap' },
  settings_profile_info: { key: 'settings_profile_info', EN: 'Profile details', TR: 'Profil Bilgileri' },
  settings_profile_info_sub: {
    key: 'settings_profile_info_sub',
    EN: 'Name, university, bio',
    TR: 'Ad, universite, biyografi',
  },
  settings_rs_visibility: { key: 'settings_rs_visibility', EN: 'RS visibility', TR: 'RS Gorunurlugu' },
  settings_rs_visibility_sub: {
    key: 'settings_rs_visibility_sub',
    EN: 'Who can see your RS score?',
    TR: 'Kim RS skorunu gorebilir?',
  },
  settings_city: { key: 'settings_city', EN: 'City', TR: 'Sehir' },
  settings_city_active: { key: 'settings_city_active', EN: '{city} active', TR: '{city} aktif' },
  settings_city_pick: { key: 'settings_city_pick', EN: 'Choose a city', TR: 'Sehir secimi' },
  settings_venue_apply: { key: 'settings_venue_apply', EN: 'LOCAL Venue application', TR: 'LOCAL Venue Basvurusu' },
  settings_venue_apply_sub: {
    key: 'settings_venue_apply_sub',
    EN: 'Apply as a venue on LOCAL',
    TR: "Mekan olarak LOCAL'e basvur",
  },
  settings_glossary: { key: 'settings_glossary', EN: '10. Glossary', TR: '10. Sozluk' },
  settings_glossary_sub: { key: 'settings_glossary_sub', EN: 'Terms and language', TR: 'Sozluk ve terimler' },
  settings_lte3: { key: 'settings_lte3', EN: 'LTE-3 Trust Engine', TR: 'LTE-3 Trust Engine' },
  settings_lte3_sub: {
    key: 'settings_lte3_sub',
    EN: 'RS constants and pipeline',
    TR: 'RS motoru sabitleri ve boru hatti',
  },
  settings_moderation: { key: 'settings_moderation', EN: 'Moderation panel', TR: 'Moderasyon Paneli' },
  settings_moderation_sub: {
    key: 'settings_moderation_sub',
    EN: 'Reports and safety actions',
    TR: 'Sikayet ve guvenlik islemleri',
  },
  settings_group_privacy: { key: 'settings_group_privacy', EN: 'Privacy', TR: 'Gizlilik' },
  settings_search_visible: { key: 'settings_search_visible', EN: 'Appear in search', TR: 'Aramada Gorun' },
  settings_search_visible_sub: {
    key: 'settings_search_visible_sub',
    EN: 'People can find you in search',
    TR: 'Kullanicilar seni aramada gorebilir',
  },
  settings_location_share: { key: 'settings_location_share', EN: 'Location sharing', TR: 'Konum Paylasimi' },
  settings_location_share_sub: {
    key: 'settings_location_share_sub',
    EN: 'Used only during check-in',
    TR: 'Sadece check-in sirasinda kullanilir',
  },
  settings_active_status: { key: 'settings_active_status', EN: 'Active status', TR: 'Aktif Durumu' },
  settings_active_status_sub: {
    key: 'settings_active_status_sub',
    EN: 'Connections can see when you are around',
    TR: 'Baglantilarin cevrimici durumunu gorebilir',
  },
  settings_group_notifications: { key: 'settings_group_notifications', EN: 'Notifications', TR: 'Bildirimler' },
  settings_notif_prefs: { key: 'settings_notif_prefs', EN: 'Notification preferences', TR: 'Bildirim Tercihleri' },
  settings_notif_prefs_sub: {
    key: 'settings_notif_prefs_sub',
    EN: 'Category-level control (§11)',
    TR: 'Kategori bazli kontrol (§11)',
  },
  settings_notif_live: { key: 'settings_notif_live', EN: 'Live Ritual started', TR: 'Canli Ritual basladi' },
  settings_notif_friends: {
    key: 'settings_notif_friends',
    EN: 'A friend joined a Ritual',
    TR: 'Rituale arkadasin katildi',
  },
  settings_notif_rs: { key: 'settings_notif_rs', EN: 'RS score changed', TR: 'RS skoru degisti' },
  settings_notif_badge: { key: 'settings_notif_badge', EN: 'New badge earned', TR: 'Yeni rozet kazanildi' },
  settings_group_social: { key: 'settings_group_social', EN: 'Social', TR: 'Sosyal' },
  settings_qr_bump: { key: 'settings_qr_bump', EN: 'QR-Bump', TR: 'QR-Bump' },
  settings_qr_bump_sub: { key: 'settings_qr_bump_sub', EN: 'Add a nearby friend', TR: 'Yakin arkadas ekle' },
  settings_regular: { key: 'settings_regular', EN: 'Regular status', TR: 'Regular Durumu' },
  settings_regular_sub: {
    key: 'settings_regular_sub',
    EN: '{n} venue · private tag',
    TR: '{n} mekân · gizli etiket',
  },
  settings_regular_none: {
    key: 'settings_regular_none',
    EN: 'Not Regular yet (private, not shared)',
    TR: 'Henuz regular degil (ozel, paylasilmaz)',
  },
  settings_memories: { key: 'settings_memories', EN: 'My memories', TR: 'Anilarim' },
  settings_memories_sub: { key: 'settings_memories_sub', EN: 'Your Ritual memories', TR: 'Ritual anilarin' },
  settings_group_coming: { key: 'settings_group_coming', EN: 'Coming soon (§14)', TR: 'Yakinda (§14)' },
  settings_stub_feature: { key: 'settings_stub_feature', EN: 'Feature', TR: 'Ozellik' },
  settings_stub_on: { key: 'settings_stub_on', EN: 'On', TR: 'Aktif' },
  settings_stub_off: { key: 'settings_stub_off', EN: 'Off', TR: 'Pasif' },
  settings_group_appearance: { key: 'settings_group_appearance', EN: 'Appearance', TR: 'Gorunum' },
  settings_language: { key: 'settings_language', EN: 'Language', TR: 'Dil' },
  settings_language_sub: {
    key: 'settings_language_sub',
    EN: 'App language · Ritual stays Ritual',
    TR: 'Uygulama dili · Ritual çevrilmez',
  },
  settings_dark_mode: { key: 'settings_dark_mode', EN: 'Appearance (Dark theme)', TR: 'Gorunum (Koyu Tema)' },
  settings_group_session: { key: 'settings_group_session', EN: 'Session', TR: 'Oturum' },
  settings_logout: { key: 'settings_logout', EN: 'Log out', TR: 'Cikis Yap' },
  settings_group_danger: { key: 'settings_group_danger', EN: 'Danger zone', TR: 'Tehlikeli Bolge' },
  settings_freeze: { key: 'settings_freeze', EN: 'Freeze account', TR: 'Hesabi Dondur' },
  settings_freeze_sub: {
    key: 'settings_freeze_sub',
    EN: 'Temporarily off · RS kept',
    TR: 'Gecici devre disi · RS korunur',
  },
  settings_delete: { key: 'settings_delete', EN: 'Delete account', TR: 'Hesabi Sil' },
  settings_delete_sub: {
    key: 'settings_delete_sub',
    EN: 'Permanent · cannot be undone',
    TR: 'Kalici silme · geri alinamaz',
  },
  settings_privacy: { key: 'settings_privacy', EN: 'Privacy', TR: 'Gizlilik' },
  settings_terms: { key: 'settings_terms', EN: 'Terms', TR: 'Kosullar' },
  settings_cookies: { key: 'settings_cookies', EN: 'Cookies', TR: 'Cerezler' },
  settings_contact: { key: 'settings_contact', EN: 'Contact', TR: 'Iletisim' },
  settings_badge_pivot: { key: 'settings_badge_pivot', EN: 'Pivot Host', TR: 'Pivot Host' },
  settings_badge_verified: { key: 'settings_badge_verified', EN: 'Verified', TR: 'Verified' },
  nav_city_rhythm: { key: 'nav_city_rhythm', EN: 'City Rhythm', TR: 'City Rhythm', translate: false },
  nav_passport: { key: 'nav_passport', EN: 'Passport', TR: 'Passport', translate: false },

  auth_tagline: {
    key: 'auth_tagline',
    EN: 'Real connections in real moments...',
    TR: 'Gercek anlarda gercek baglantilar...',
  },
  auth_university: { key: 'auth_university', EN: 'University', TR: 'Üniversiteli' },
  auth_kyc: { key: 'auth_kyc', EN: 'Verify with ID', TR: 'Kimlik ile doğrula' },
  auth_login: { key: 'auth_login', EN: 'Log in', TR: 'Giris Yap' },
  auth_welcome: { key: 'auth_welcome', EN: 'Welcome to LOCAL', TR: "LOCAL'e Hos Geldin" },
  auth_continue_login: { key: 'auth_continue_login', EN: 'Log in to continue', TR: 'Devam etmek icin giris yap' },
  auth_email: { key: 'auth_email', EN: 'Email', TR: 'E-posta' },
  auth_email_placeholder: { key: 'auth_email_placeholder', EN: 'email@example.com', TR: 'e-posta@ornek.com' },
  auth_password: { key: 'auth_password', EN: 'Password', TR: 'Sifre' },
  auth_password_placeholder: { key: 'auth_password_placeholder', EN: 'Enter your password', TR: 'Sifreni gir' },
  auth_forgot: { key: 'auth_forgot', EN: 'Forgot password', TR: 'Sifremi Unuttum' },
  auth_remember: { key: 'auth_remember', EN: 'Keep me signed in on this device', TR: 'Bu cihazda girisimi acik tut' },
  auth_no_account: { key: 'auth_no_account', EN: "Don't have an account?", TR: 'Hesabin yok mu?' },
  auth_register: { key: 'auth_register', EN: 'Sign up', TR: 'Kayit Ol' },
  auth_footer: {
    key: 'auth_footer',
    EN: 'By logging in you accept the following:',
    TR: 'Giris yaparak su metinleri kabul edersin:',
  },
  auth_terms: { key: 'auth_terms', EN: 'Terms of Use', TR: 'Kullanim Kosullari' },
  auth_privacy_policy: { key: 'auth_privacy_policy', EN: 'Privacy Policy', TR: 'Gizlilik Politikasi' },
  auth_and: { key: 'auth_and', EN: 'and', TR: 've' },

  search_tab_all: { key: 'search_tab_all', EN: 'All', TR: 'Tümü' },
  search_tab_series: { key: 'search_tab_series', EN: 'Series', TR: 'Seriler' },
  search_tab_slots: { key: 'search_tab_slots', EN: 'Slots', TR: 'Slotlar' },
  search_tab_venues: { key: 'search_tab_venues', EN: 'Venues', TR: 'Mekanlar' },
  search_tab_zones: { key: 'search_tab_zones', EN: 'Zones', TR: "Zone'lar" },
  search_tab_people: { key: 'search_tab_people', EN: 'People', TR: 'Kişiler' },
  search_tab_forum: { key: 'search_tab_forum', EN: 'Forum', TR: 'Forum' },
  search_tab_category: { key: 'search_tab_category', EN: 'Category', TR: 'Kategori' },
  search_tab_location: { key: 'search_tab_location', EN: 'Location', TR: 'Konum' },
  search_tab_brands: { key: 'search_tab_brands', EN: 'Brand', TR: 'Brand' },

  pulse_subtitle: { key: 'pulse_subtitle', EN: 'Flow in your city', TR: 'Sehrindeki Akis' },
  pulse_create: { key: 'pulse_create', EN: '+ Create Ritual', TR: '+ Ritual Olustur' },
  pulse_verify_to_create: {
    key: 'pulse_verify_to_create',
    EN: 'Verify your university email to create a Ritual.',
    TR: 'Ritual olusturmak icin universite e-postani dogrulamalisin.',
  },
  pulse_load_failed_title: { key: 'pulse_load_failed_title', EN: 'Pulse failed to load', TR: 'Pulse yuklenemedi' },
  pulse_load_failed_msg: {
    key: 'pulse_load_failed_msg',
    EN: 'Rituals could not load. Check your connection and try again.',
    TR: 'Rituals yuklenemedi. Baglantini kontrol edip tekrar dene.',
  },
  pulse_filter_all: { key: 'pulse_filter_all', EN: 'All', TR: 'Tümü' },
  pulse_filter_friends: { key: 'pulse_filter_friends', EN: 'Friends', TR: 'Arkadaşlar' },
  pulse_filter_hidden: { key: 'pulse_filter_hidden', EN: 'Hidden', TR: 'Gizli' },
  pulse_filter_live_now: { key: 'pulse_filter_live_now', EN: 'Live now', TR: 'Şimdi Canlı' },
  pulse_filter_has_room: { key: 'pulse_filter_has_room', EN: 'Spots open', TR: 'Yer Var' },
  pulse_filter_starting: { key: 'pulse_filter_starting', EN: 'Starting soon', TR: 'Başlamak Üzere' },
  pulse_filter_nearby: { key: 'pulse_filter_nearby', EN: 'Nearby', TR: 'Yakınımda' },
  pulse_filter_following: { key: 'pulse_filter_following', EN: 'Following', TR: 'Takip Edilenler' },
  pulse_filter_special: { key: 'pulse_filter_special', EN: 'Special events', TR: 'Özel Etkinlikler' },
  pulse_filter_verified: { key: 'pulse_filter_verified', EN: 'Verified', TR: 'Doğrulanmışlar' },
  pulse_filter_series: { key: 'pulse_filter_series', EN: 'Series', TR: 'Seri' },
  pulse_filter_new: { key: 'pulse_filter_new', EN: 'New on LOCAL', TR: "LOCAL'de Yeni" },
  pulse_filter_more: { key: 'pulse_filter_more', EN: 'More', TR: 'Daha fazla' },
  pulse_filter_less: { key: 'pulse_filter_less', EN: 'Less', TR: 'Daha az' },
  pulse_empty_all_title: { key: 'pulse_empty_all_title', EN: 'Pulse is empty', TR: 'Pulse bos' },
  pulse_empty_all_msg: {
    key: 'pulse_empty_all_msg',
    EN: 'No friend or FL memories in the last 24 hours. After a Ritual ends, you can share in the Window.',
    TR: 'Son 24 saatte arkadas ve FL kapsaminda memory yok. Ritual bitince windowda paylasim yapilabilir.',
  },
  pulse_empty_live_title: { key: 'pulse_empty_live_title', EN: 'No live Ritual', TR: 'Canli Ritual yok' },
  pulse_empty_live_msg: {
    key: 'pulse_empty_live_msg',
    EN: 'No live or about-to-start Ritual is visible right now.',
    TR: 'Simdilik canli veya cok yakin baslayan Ritual gorunmuyor.',
  },
  pulse_empty_starting_title: { key: 'pulse_empty_starting_title', EN: 'Nothing starting soon', TR: 'Yakinda baslayan yok' },
  pulse_empty_starting_msg: {
    key: 'pulse_empty_starting_msg',
    EN: 'No Ritual is about to start.',
    TR: 'Baslamak uzere olan Ritual bulunmuyor.',
  },
  pulse_empty_local_world_title: { key: 'pulse_empty_local_world_title', EN: 'Local World is empty', TR: 'Local World bos' },
  pulse_empty_local_world_msg: {
    key: 'pulse_empty_local_world_msg',
    EN: 'No open forum or city-wide public memory is visible.',
    TR: 'Acik forum veya sehir geneli public memory gorunmuyor.',
  },
  pulse_empty_friends_title: { key: 'pulse_empty_friends_title', EN: 'Friends feed is empty', TR: 'Arkadas akisi bos' },
  pulse_empty_friends_msg: {
    key: 'pulse_empty_friends_msg',
    EN: 'No Pulse shares from friends in the last 24 hours.',
    TR: 'Arkadaslarinin son 24 saatlik pulse paylasimi yok.',
  },
  pulse_empty_fl_title: { key: 'pulse_empty_fl_title', EN: 'FL feed is empty', TR: 'FL akisi bos' },
  pulse_empty_fl_msg: {
    key: 'pulse_empty_fl_msg',
    EN: 'No shares from close friends (FL) in the last 24 hours.',
    TR: 'Yakin arkadas (FL) kapsaminda son 24 saatte paylasim yok.',
  },
  pulse_empty_uni_title: { key: 'pulse_empty_uni_title', EN: 'Uni feed is empty', TR: 'Uni akisi bos' },
  pulse_empty_uni_msg: {
    key: 'pulse_empty_uni_msg',
    EN: 'No Pulse shares from people at the same university.',
    TR: 'Ayni universiteden kullanicilarin pulse paylasimi yok.',
  },
  pulse_empty_hidden_title: { key: 'pulse_empty_hidden_title', EN: 'No hidden Ritual', TR: 'Gizli Ritual yok' },
  pulse_empty_hidden_msg: {
    key: 'pulse_empty_hidden_msg',
    EN: 'No open Ritual with hidden visibility.',
    TR: 'Gorunurlugu hidden olan acik Ritual bulunmuyor.',
  },
  pulse_empty_special_title: { key: 'pulse_empty_special_title', EN: 'No special events', TR: 'Ozel etkinlik yok' },
  pulse_empty_special_msg: {
    key: 'pulse_empty_special_msg',
    EN: 'The curated special-event list is empty.',
    TR: 'Kurasyonlu ozel etkinlik listesi bos.',
  },
  pulse_empty_nearby_title: { key: 'pulse_empty_nearby_title', EN: 'No Ritual nearby', TR: 'Yakininda Ritual yok' },
  pulse_empty_nearby_msg: {
    key: 'pulse_empty_nearby_msg',
    EN: 'No live or starting-soon Ritual in the GPS radius.',
    TR: 'GPS yarıcapinda canli veya yakinda baslayan Ritual gorunmuyor.',
  },
  pulse_empty_default_title: { key: 'pulse_empty_default_title', EN: 'Nothing in this filter', TR: 'Bu filtrede icerik yok' },
  pulse_empty_default_msg: {
    key: 'pulse_empty_default_msg',
    EN: 'No Ritual or memory matches the selected filter.',
    TR: 'Secili filtreye uygun Ritual veya memory bulunamadi.',
  },
  pulse_empty_action_map: { key: 'pulse_empty_action_map', EN: 'Open map', TR: 'Haritaya bak' },
  pulse_empty_action_add_friend: { key: 'pulse_empty_action_add_friend', EN: 'Add a friend', TR: 'Arkadas ekle' },
  pulse_empty_action_citywide: { key: 'pulse_empty_action_citywide', EN: 'See the whole city', TR: 'Tum sehre bak' },
  bubble_active: { key: 'bubble_active', EN: 'LIVE', TR: 'AKTIF' },
  bubble_active_hint: { key: 'bubble_active_hint', EN: 'Ritual is ongoing', TR: 'Ritual devam ediyor' },
  bubble_near: { key: 'bubble_near', EN: 'NEAR', TR: 'YAKIN' },
  bubble_near_hint: { key: 'bubble_near_hint', EN: 'Window still open', TR: 'Window hala acik' },
  bubble_upcoming: { key: 'bubble_upcoming', EN: 'SOON', TR: 'YAKLASAN' },
  bubble_upcoming_hint: { key: 'bubble_upcoming_hint', EN: 'Ritual starts soon', TR: 'Ritual yakinda basliyor' },
  bubble_ended: { key: 'bubble_ended', EN: 'ENDED', TR: 'SONA ERDI' },
  bubble_ended_hint: { key: 'bubble_ended_hint', EN: 'Open archive', TR: 'Arsivi ac' },

  ...Object.fromEntries(
    Object.entries(CHIP_COPY_STUBS).map(([k, v]) => [k, { ...v, route: v.route || 'RitualFeedback' }])
  ),
};

function resolveLang(lang) {
  if (lang === 'en' || lang === 'tr') return lang;
  try {
    const current = useLanguageStore.getState?.()?.lang;
    if (current === 'en' || current === 'tr') return current;
  } catch (_e) {
    // store may be unavailable in isolated tests
  }
  return 'tr';
}

/**
 * @param {string} key
 * @param {'tr'|'en'|Record<string, string|number>} [langOrVars]
 * @param {Record<string, string|number>} [maybeVars]
 */
export function t(key, langOrVars, maybeVars) {
  const row = STRING_TABLE[key];
  if (!row) return key;
  const varsAreFirst = langOrVars && typeof langOrVars === 'object' && !Array.isArray(langOrVars);
  const lang = resolveLang(varsAreFirst ? undefined : langOrVars);
  const vars = varsAreFirst ? langOrVars : maybeVars || {};
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
