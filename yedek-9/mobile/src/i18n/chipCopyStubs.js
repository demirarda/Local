/**
 * Chip + FB copy — 🔒 KİLİTLİ (founder, 2026-08-10)
 * RQ (3/renk) ve P2V (5/renk) metinleri LOCAL_Sosyal_Urun_Temelleri.md §9 seed'inden birebir.
 * Keys match localConfig.chip.SETS. Sync: backend + mobile stringTable.
 */
export const CHIP_COPY_STUBS = {
  fb_event_general_q: {
    key: 'fb_event_general_q',
    EN: 'How was the night overall?',
    TR: 'Gece geneli nasıldı?',
  },
  fb_rq_table_q: {
    key: 'fb_rq_table_q',
    EN: 'How was this table?',
    TR: 'Bu masa nasıldı?',
  },
  fb_rq_ritual_q: {
    key: 'fb_rq_ritual_q',
    EN: 'How was this Ritual?',
    TR: 'Bu Ritual nasıldı?',
  },

  // RQ 🟢 — sohbet aktı · masa dengeliydi · tekrar isterim
  rq_g_1: { key: 'rq_g_1', EN: 'Conversation flowed', TR: 'Sohbet aktı', open: false },
  rq_g_2: { key: 'rq_g_2', EN: 'Table felt balanced', TR: 'Masa dengeliydi', open: false },
  rq_g_3: { key: 'rq_g_3', EN: 'I would do it again', TR: 'Tekrar isterim', open: false },
  // RQ 🟡 — geç ısındı · küçük gruplara bölündük · tanımdan biraz farklıydı
  rq_y_1: { key: 'rq_y_1', EN: 'Took time to warm up', TR: 'Geç ısındı', open: false },
  rq_y_2: {
    key: 'rq_y_2',
    EN: 'Split into smaller groups',
    TR: 'Küçük gruplara bölündük',
    open: false,
  },
  rq_y_3: {
    key: 'rq_y_3',
    EN: 'A bit different from the description',
    TR: 'Tanımdan biraz farklıydı',
    open: false,
  },
  // RQ 🔴 — tanım yanılttı · tek ses baskındı · kadro uyumsuzdu
  rq_r_1: { key: 'rq_r_1', EN: 'The description misled', TR: 'Tanım yanılttı', open: false },
  rq_r_2: { key: 'rq_r_2', EN: 'One voice dominated', TR: 'Tek ses baskındı', open: false },
  rq_r_3: { key: 'rq_r_3', EN: 'Group chemistry was off', TR: 'Kadro uyumsuzdu', open: false },

  // P2V 🟢 — mekan sahiplendi · servis akıcıydı · fiyatına değdi · ortam tam masalıktı · personel sıcaktı
  p2v_g_1: { key: 'p2v_g_1', EN: 'Venue owned the night', TR: 'Mekan sahiplendi', open: false },
  p2v_g_2: { key: 'p2v_g_2', EN: 'Service flowed', TR: 'Servis akıcıydı', open: false },
  p2v_g_3: { key: 'p2v_g_3', EN: 'Worth the price', TR: 'Fiyatına değdi', open: false },
  p2v_g_4: {
    key: 'p2v_g_4',
    EN: 'Atmosphere fit a table night',
    TR: 'Ortam tam masalıktı',
    open: false,
  },
  p2v_g_5: { key: 'p2v_g_5', EN: 'Staff was warm', TR: 'Personel sıcaktı', open: false },
  // P2V 🟡 — servis yavaştı · yer dardı · biraz gürültülüydü · fiyat yüksekti · masa geç hazırlandı
  p2v_y_1: { key: 'p2v_y_1', EN: 'Service was slow', TR: 'Servis yavaştı', open: false },
  p2v_y_2: { key: 'p2v_y_2', EN: 'Space felt tight', TR: 'Yer dardı', open: false },
  p2v_y_3: { key: 'p2v_y_3', EN: 'A bit noisy', TR: 'Biraz gürültülüydü', open: false },
  p2v_y_4: { key: 'p2v_y_4', EN: 'Price felt high', TR: 'Fiyat yüksekti', open: false },
  p2v_y_5: { key: 'p2v_y_5', EN: 'Table was ready late', TR: 'Masa geç hazırlandı', open: false },
  // P2V 🔴 — servis sorunluydu · gürültüden konuşamadık · temizlik zayıftı · ücret sürpriziydi · masa hazır değildi
  p2v_r_servis: {
    key: 'p2v_r_servis',
    EN: 'Service had problems',
    TR: 'Servis sorunluydu',
    open: false,
  },
  p2v_r_gurultu: {
    key: 'p2v_r_gurultu',
    EN: 'Too loud to talk',
    TR: 'Gürültüden konuşamadık',
    open: false,
  },
  p2v_r_temizlik: {
    key: 'p2v_r_temizlik',
    EN: 'Cleanliness was weak',
    TR: 'Temizlik zayıftı',
    open: false,
  },
  p2v_r_ucret: {
    key: 'p2v_r_ucret',
    EN: 'Surprise charge',
    TR: 'Ücret sürpriziydi',
    open: false,
  },
  p2v_r_masa: {
    key: 'p2v_r_masa',
    EN: 'Table was not ready',
    TR: 'Masa hazır değildi',
    open: false,
  },

  // P2Z — sonMD §9'da ayrı seed yok; P2V desenine göre kilitlendi (2026-08-10)
  p2z_g_1: { key: 'p2z_g_1', EN: 'Zone felt right', TR: 'Zone uygundu', open: false },
  p2z_g_2: { key: 'p2z_g_2', EN: 'Easy to find', TR: 'Kolay bulundu', open: false },
  p2z_y_1: { key: 'p2z_y_1', EN: 'Marker was vague', TR: 'Marker belirsizdi', open: false },
  p2z_y_2: { key: 'p2z_y_2', EN: 'Zone was crowded', TR: 'Zone kalabalıktı', open: false },
  p2z_r_1: { key: 'p2z_r_1', EN: 'Wrong spot', TR: 'Yanlış nokta', open: false },
  p2z_r_marker: { key: 'p2z_r_marker', EN: 'Marker was missing', TR: 'Marker yoktu', open: false },

  followers_row: {
    key: 'followers_row',
    EN: 'Followers',
    TR: 'Takipçiler',
  },
  following_row: {
    key: 'following_row',
    EN: 'Following',
    TR: 'Takip',
  },
  followers_list_count: {
    key: 'followers_list_count',
    EN: '{n} followers',
    TR: '{n} takipçi',
  },
};
