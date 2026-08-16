/**
 * SpecialEventsView Test Wrapper
 * ================================
 *
 * Mock paginated fetch + simulated WebSocket live viewer updates.
 *
 * Davranış:
 *   - Toplam 40 mock item, 7 farklı kart tipi karışık
 *   - Sayfa başına 15 item, 3 sayfa
 *   - WebSocket simülasyonu: her 4 saniyede rastgele kartların viewer count'u değişir
 *   - Doluluk state'i: %25-%100 arası, bazıları waitlist-only
 *   - Pull-to-refresh: yeniden shuffle, viewer count sıfırlanır
 *
 * Kullanım:
 *   import SpecialEventsViewTest from './screens/SpecialEventsViewTest';
 *   export default function App() {
 *     return <SpecialEventsViewTest />;
 *   }
 */

import React from 'react';
import SpecialEventsView from './SpecialEventsView';

const TOTAL = 40;
const PAGE_SIZE = 15;
const FETCH_DELAY_MS = 800;
const WS_TICK_MS = 4000;

const mockNav = {
  navigate: (screen, params) => console.log(`[MOCK] navigate → ${screen}`, params),
};

/**
 * 40 çeşitli özel etkinlik üret.
 */
function generateMockItems() {
  const items = [];

  // 1. Super Event Hero
  items.push({
    id: 'super_1',
    title: 'Milano Design Week',
    subtitle:
      "LOCAL hostlarının Design Week süresince hazırladığı 8 özel ritüel — ilham, tasarım, ve şehrin kalbinde saklı atölyeler.",
    coverImage: 'https://picsum.photos/seed/superdesign/900/500',
    dateRange: '15-22 NİSAN',
    curationSignals: ['super-event', 'trending'],
    collectionStats: { ritualCount: 8, hostCount: 6, totalSeats: 98, takenSeats: 42 },
    liveStats: { currentViewers: 147, viewsLastHour: 620, bookingsLastHour: 14 },
    availability: { taken: 42, total: 98, waitlist: 0 },
  });

  // 5 Full editorial kartı
  for (let i = 0; i < 5; i++) {
    const isSoldOut = i === 3;
    const isAlmostFull = i === 1;
    items.push({
      id: `full_${i}`,
      type: 'curated-ritual',
      title: [
        'Soviet Modernism: A Night With Architects',
        '12-Person Dinner: Roman Şefle',
        'Alessi × LOCAL: Form Ritueli',
        'Gün Doğumu Yürüyüşü · San Siro',
        'Natural Wine Night · Navigli',
      ][i],
      host: [
        'Flavia De Rossi · Studio Raza',
        'Chef Giovanni Ferrari · Closed Kitchen',
        'Alessi Showroom · Via Manzoni',
        'Pietro Galanti · Urbanist',
        'Marco Vittoria · Sommelier',
      ][i],
      coverImage: `https://picsum.photos/seed/full${i}/900/500`,
      curationSignals: [
        ['editors-pick'],
        ['premium'],
        ['partner'],
        ['editors-pick', 'trending'],
        ['editors-pick'],
      ][i],
      price: [
        { kind: 'paid', amount: '35€' },
        { kind: 'paid', amount: '120€' },
        { kind: 'free' },
        { kind: 'free' },
        { kind: 'paid', amount: '45€' },
      ][i],
      collectionLink: i < 3 ? { id: 'super_1', name: 'Milano Design Week' } : null,
      curatorNote: [
        "Soğuk savaş döneminin görülmemiş mimarisini Flavia'nın gözünden dinlemek için nadir fırsat.",
        'Ayda bir kez açılan bu özel dinner için ayırt edici damak tadı bekleyenlerin vereceği değer 120€ üstünde.',
        'Alessi 100. yılında arşivinden nesneleri açıyor. Hand-picked objeler, mimar rehberliğinde.',
        "Pietro'nun hiç kimsenin bilmediği yollardan geçerek Milano'yu keşfettiği ücretsiz yürüyüş.",
        "Lombardy'nin küçük üreticilerinden 8 şarap, sommelier eşliğinde.",
      ][i],
      meta: {
        date: ['17 Nis · 20:00', '28 Nis · 19:30', '20 Nis · 18:00', '26 Nis · 06:00', '23 Nis · 20:00'][i],
        venue: ['Fondazione Prada', 'Navigli', 'Via Manzoni', 'San Siro', 'Navigli'][i],
        seats: isSoldOut ? '15/15' : isAlmostFull ? '11/12' : ['6/12', '3/12', '12/20', '8/15', '10/20'][i],
      },
      availability: isSoldOut
        ? { taken: 15, total: 15, waitlist: 14 }
        : isAlmostFull
        ? { taken: 11, total: 12, waitlist: 0 }
        : { taken: [6, 3, 12, 8, 10][i], total: [12, 12, 20, 15, 20][i], waitlist: 0 },
      liveStats: { currentViewers: [28, 12, 18, 45, 8][i], viewsLastHour: [80, 40, 60, 180, 30][i], bookingsLastHour: [4, 2, 3, 12, 2][i] },
      guests: i === 0
        ? [
            { name: 'Ivan Petrov', avatar: 'https://picsum.photos/seed/g1/80/80' },
            { name: 'Maria Lastovkina', avatar: 'https://picsum.photos/seed/g2/80/80' },
          ]
        : null,
      footerNote: [null, 'Dâhil: 7 yemek + şarap eşlemesi', 'Alessi & LOCAL işbirliği', '2 arkadaşın gidiyor', '3 arkadaşın kayıtlı'][i],
      hasFullContent: true,
    });
  }

  // 10 HalfTall card
  for (let i = 0; i < 10; i++) {
    const isLimited = i === 2 || i === 5;
    const isAlmost = i === 7;
    items.push({
      id: `half_${i}`,
      title: [
        'Rooftop Cinema',
        'Tango Milonga',
        'Gallery Crawl',
        'Morning Meditation',
        'Espresso Tasting',
        'Book Swap',
        'Midnight Tour',
        'Pottery Workshop',
        'Board Game Night',
        'Vintage Market',
      ][i],
      date: [
        '24 NİS · 21:00',
        '25 NİS · 22:00',
        '21 NİS · 17:00',
        'HER PAZAR · 08:00',
        '22 NİS · 15:00',
        '27 NİS · 19:00',
        '26 NİS · 23:30',
        '28 NİS · 14:00',
        '29 NİS · 20:00',
        '30 NİS · 10:00',
      ][i],
      coverImage: `https://picsum.photos/seed/half${i}/500/700`,
      curationSignals: isLimited ? ['limited'] : ['editors-pick'],
      curatorMini: i % 2 === 0
        ? 'LOCAL ekibinin bu ay özellikle önerdiği.'
        : null,
      seats: isAlmost ? '14/15' : `${3 + i}/${10 + i}`,
      priceLabel: i % 3 === 0 ? 'ÜCRETSİZ' : ['15€', '20€', '35€', '25€', '10€', '30€'][i % 6],
      viewerCountInline: i % 2 === 0 ? `${5 + (i * 2)} kişi bakıyor` : null,
      availability: isAlmost
        ? { taken: 14, total: 15, waitlist: 0 }
        : { taken: 3 + i, total: 10 + i, waitlist: 0 },
      liveStats: { currentViewers: 5 + i * 2 },
      registrationClosesAt: isLimited
        ? new Date(Date.now() + (2 + i) * 60 * 60 * 1000).toISOString()
        : null,
    });
  }

  // 8 Square past memories
  for (let i = 0; i < 8; i++) {
    items.push({
      id: `sq_${i}`,
      title: ['Fashion Week Closing', 'Truffle Dinner', 'Jazz & Wine', 'Opera Picnic', 'Silent Disco', 'Film Premiere', 'Chef\'s Table', 'Garden Party'][i],
      subtitle: ['ŞUBAT 2026', 'KASIM 2025', 'EKİM 2025', 'EYLÜL 2025', 'AĞUSTOS 2025', 'TEMMUZ 2025', 'HAZİRAN 2025', 'MAYIS 2025'][i],
      coverImage: `https://picsum.photos/seed/sq${i}/500/500`,
      curationSignals: i % 2 === 0 ? ['editors-pick'] : ['premium'],
      rating: [4.9, 5.0, 4.8, 4.7, 4.9, 5.0, 4.8, 4.9][i],
      attendeeCount: [48, 12, 32, 18, 65, 22, 10, 35][i],
      isPastMemory: true,
      availability: { taken: 0, total: 0, waitlist: 0 },
      liveStats: { currentViewers: 0 },
    });
  }

  // 6 Poster (special guests)
  for (let i = 0; i < 6; i++) {
    items.push({
      id: `poster_${i}`,
      name: ['Ivan Petrov', 'Maria Lastovkina', 'Flavia De Rossi', 'Chef Giovanni', 'Pietro Galanti', 'Marco Vittoria'][i],
      subtitle: [
        "Soviet Modernism'de konuşmacı",
        "Alessi Workshop'ta panelist",
        '3 ritüelde host',
        'Closed Kitchen Dinner',
        'Urbanist · 2 yürüyüş',
        'Sommelier · Wine Night',
      ][i],
      dateStrip: ['17 NİS', '18 NİS', '21 NİS', '28 NİS', '26 NİS', '23 NİS'][i],
      guestPortrait: `https://picsum.photos/seed/poster${i}/400/600`,
      curationSignals: ['special-guest'],
      availability: { taken: 0, total: 0, waitlist: 0 },
      liveStats: { currentViewers: 0 },
    });
  }

  // 6 WideShort (partner/guest/limited/trending chip announcements)
  const wideConfigs = [
    {
      signals: ['partner'],
      name: 'Form Ritueli',
      subtitle: "Alessi 100. yılında arşivinden özel objeleri açıyor. **20 Nis · 18:00 · Via Manzoni**",
      avatar: 'https://picsum.photos/seed/alessi/200/200',
      avatarSquare: true,
      ctaLabel: 'Kayıt',
    },
    {
      signals: ['limited'],
      name: 'Aperitivo Secreto · Navigli',
      subtitle: "Kayıt bu gece 23:59'da kapanıyor. **25 Nis · 19:30 · 6 yer kaldı**",
      avatar: null, // icon fallback
      ctaLabel: 'Hemen Al',
      ctaUrgent: true,
      registrationClosesAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      availability: { taken: 9, total: 15, waitlist: 0 },
    },
    {
      signals: ['trending'],
      name: 'Sunrise Pilates',
      subtitle: 'Parco Sempione başlangıçlı haftalık ritüel. **Her Cuma · 06:30 · 25€**',
      avatar: 'https://picsum.photos/seed/pilates/200/200',
      ctaLabel: 'Katıl',
    },
    {
      signals: ['special-guest'],
      name: 'Barbara Cassin',
      subtitle: "Philosophy Night'ta konuk. **30 Nis · 20:00 · Book Discussion**",
      avatar: 'https://picsum.photos/seed/cassin/200/200',
      ctaLabel: 'Detay',
    },
    {
      signals: ['partner'],
      name: 'Kartell × LOCAL',
      subtitle: 'Design showroom özel turu. **22 Nis · 15:00 · Ücretsiz**',
      avatar: 'https://picsum.photos/seed/kartell/200/200',
      avatarSquare: true,
      ctaLabel: 'Kayıt',
    },
    {
      signals: ['limited'],
      name: 'Last 2 Spots · Chef Table',
      subtitle: 'Giovanni Ferrari 12-kişilik masa son fırsatı. **28 Nis · 19:30**',
      avatar: null,
      ctaLabel: 'Hemen Al',
      ctaUrgent: true,
      availability: { taken: 10, total: 12, waitlist: 0 },
    },
  ];

  wideConfigs.forEach((config, i) => {
    items.push({
      id: `wide_${i}`,
      ...config,
      availability: config.availability || { taken: 0, total: 0, waitlist: 0 },
      liveStats: { currentViewers: 3 + i * 2 },
    });
  });

  // 4 Micro (quick glance)
  const microConfigs = [
    { title: 'Brera Atölye Turu', date: '19 NİS · 14:00', priceLabel: 'DAVETİYELİ', signals: ['limited'] },
    { title: 'Design Talk', date: '20 NİS · 16:00', priceLabel: 'ÜCRETSİZ', signals: ['partner'] },
    { title: 'Natural Wine Night', date: '23 NİS · 20:00', priceLabel: '45€', signals: ['trending'] },
    { title: 'Poetry Reading', date: '24 NİS · 19:00', priceLabel: '10€', signals: ['editors-pick'] },
  ];

  microConfigs.forEach((config, i) => {
    items.push({
      id: `micro_${i}`,
      ...config,
      curationSignals: config.signals,
      quickGlance: true,
      availability: { taken: 3 + i, total: 10, waitlist: 0 },
      liveStats: { currentViewers: 2 + i },
      registrationClosesAt: config.signals.includes('limited')
        ? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
        : null,
    });
  });

  return items;
}

const ALL_MOCK = generateMockItems();

/**
 * Paginated fetch simulator
 */
async function mockFetchSpecialEvents({ offset, limit }) {
  await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
  const page = ALL_MOCK.slice(offset, offset + limit);
  const hasMore = offset + limit < ALL_MOCK.length;
  console.log(
    `[MOCK] fetchSpecialEvents({offset: ${offset}, limit: ${limit}}) → ${page.length} items, hasMore: ${hasMore}`
  );
  return { items: page, hasMore };
}

/**
 * WebSocket live stats simulator.
 * Her 4 saniyede rastgele 3-5 kartın viewer count'u değişir.
 * Bazen bir kartın "taken" sayısı 1 artar (sanki yeni bir kayıt geldi).
 */
function mockSubscribeLiveStats(itemIds, callback) {
  const interval = setInterval(() => {
    const updates = {};
    const shuffled = [...itemIds].sort(() => Math.random() - 0.5);
    const affected = shuffled.slice(0, 3 + Math.floor(Math.random() * 3));

    affected.forEach((id) => {
      const item = ALL_MOCK.find((x) => x.id === id);
      if (!item) return;

      // Viewer count: ±30% delta, minimum 0
      const base = item.liveStats?.currentViewers || 0;
      const delta = Math.floor((Math.random() - 0.3) * base * 0.6);
      const newViewers = Math.max(0, base + delta);

      const update = { currentViewers: newViewers };

      // Ara sıra rezervasyon artışı simüle et
      if (Math.random() < 0.15 && item.availability?.total > 0) {
        const currentTaken = item.availability.taken || 0;
        if (currentTaken < item.availability.total) {
          update.taken = currentTaken + 1;
        }
      }

      updates[id] = update;
    });

    if (Object.keys(updates).length > 0) {
      console.log(`[WS] live update: ${Object.keys(updates).length} items`);
      callback(updates);
    }
  }, WS_TICK_MS);

  return () => {
    clearInterval(interval);
    console.log('[WS] unsubscribed');
  };
}

/**
 * Test component
 */
export default function SpecialEventsViewTest() {
  return (
    <SpecialEventsView
      fetchSpecialEvents={mockFetchSpecialEvents}
      subscribeLiveStats={mockSubscribeLiveStats}
      navigation={mockNav}
      onBack={() => console.log('[MOCK] back pressed')}
      pageSize={PAGE_SIZE}
    />
  );
}
