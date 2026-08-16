# Özel Etkinlikler (Special Events) Mode - Entegrasyon Rehberi

Altın accent random bento + 7 farklı kart boyutu + live viewer count + waitlist state + priority-weighted shuffle. "Özel Etkinlikler" filtresi seçildiğinde aktifleşir. 5000 eşzamanlı kullanıcı için tasarlandı.

## 📦 Yeni Dosyalar

```
pulse_rn/
├── utils/
│   ├── eventAvailability.js                      [YENİ] Signal + availability + viewer hesaplamaları
│   └── specialEventsLayout.js                    [YENİ] Random bento layout engine
├── components/
│   └── SpecialEventsCards/
│       ├── index.js                               [YENİ] Export barrel
│       ├── CurationBadge.js                       [YENİ] 7 curation signal tipi
│       ├── LiveAvailability.js                    [YENİ] AvailBar + ViewerPill + PricePill
│       ├── SpecialEventsContext.js                [YENİ] Üst bant + live total viewer
│       ├── BigCards.js                            [YENİ] HeroCard + FullCard
│       ├── GridCards.js                           [YENİ] HalfTall + Square + Poster
│       └── ChipCards.js                           [YENİ] WideShort + Micro
└── screens/
    ├── SpecialEventsView.js                       [YENİ] Tam ekran + WS hook
    └── SpecialEventsViewTest.js                   [YENİ] Mock wrapper test için
```

## 🔧 Kurulum

Ekstra paket gerekmiyor — mevcut `react-native-linear-gradient` ve `react-native-vector-icons` yeterli.

## 🏷️ 7 Curation Signal

Her kartta "neden bu özel?" göstergesi. Pulse'un ranking sistemi, Nearby'nin distance, Friends'in heat gibi — Special Events'in kendi **curation signal** sistemi.

| Signal | Renk | Anlam |
|--------|------|-------|
| `super-event` | Dolu altın | Şemsiye koleksiyon (Design Week, Fashion Week) |
| `editors-pick` | Altın soft | LOCAL ekibi editorial seçimi |
| `premium` | Beyaz + altın border | Ücretli/premium deneyim |
| `partner` | Navy | Marka işbirliği (Alessi × LOCAL) |
| `special-guest` | Mor | Özel misafir (konuşmacı, sanatçı) |
| `limited` | Kırmızı | Son yerler/tek seferlik urgent |
| `trending` | Turuncu | Son 1 saatte 50+ view veya 10+ rezervasyon |

**Dinamik label'lar**: `limited` için backend `registrationClosesAt` veya kalan yer sayısına göre frontend otomatik "SON 4 SAAT" / "SON 2 YER" label'ı üretir. Siz sabit "LIMITED" göstermek yerine `overrideLabel` prop'u geçebilirsiniz.

**Multi-signal kartlar**: Bir item birden fazla signal taşıyabilir. Hero Super Event hem `super-event` hem `trending` olabilir. Kart kendi içinde ilk 2-3'ünü gösterir.

## 🧱 7 Kart Boyutu

| Component | Ratio | Kullanım |
|-----------|-------|---------|
| `HeroCard` | Full-width, 280px+ cinematic | Super Events |
| `FullCard` | Full-width editorial | Premium, partner, curated ritual |
| `HalfTallCard` | Dual grid, 3/5 portrait | Orta önemli ritüeller |
| `SquareCard` | Dual grid, 1/1.15 | Geçmiş memory'ler (rating + count) |
| `WideShortCard` | Full-width thin horizontal | Partnership, guest, limited urgent chip |
| `PosterCard` | Triple grid, 3/4.5 portrait | Special guest portraits |
| `MicroCard` | Dual grid küçük chip | Quick-glance tek satır duyurular |

Hepsinin farklı yerleşim anatomi'leri var — aynı tasarım sistemi ama feed gözle görülür çeşitli.

## 🎲 Random Bento Layout Engine

`buildFeedLayout(items)` → ekranda görünecek row'ları üretir. 10 farklı row layout:

```
HERO                       (1 hero full-width)
FULL                       (1 full editorial)
WIDE_SHORT                 (1 wide-short thin)
DUAL_HALF_TALL             (2 half-tall yan yana)
DUAL_SQUARE                (2 square yan yana)
DUAL_MICRO                 (2 micro chip)
ASYM_MICRO_TALL            (micro + half-tall)
ASYM_TALL_MICRO            (half-tall + micro)
ASYM_SQUARE_TALL           (square + half-tall)
TRIPLE_POSTER              (3 poster yan yana)
```

### Layout kuralları

1. **Priority-weighted shuffle**: `priorityScore(item)` → Super Event (+100), Limited (+60), Trending (+40), Premium (+30)... Top %30 kendi içinde shuffle, kalan kendi içinde shuffle. Yani Super Event en üstte kalır ama aynı önemdeki kartlar her açılışta farklı sırada.

2. **Son 2 row tekrarlamama**: Aynı layout 2 kez üst üste gelmez. 3 `DUAL_HALF_TALL` arka arkaya yerine araya bir `FULL` veya `WIDE_SHORT` girer.

3. **Visual rhythm**: Her 4 row'da en az 1 görsel-ağırlıklı (hero/full/dual-half-tall). Yoksa engine bir sonraki row'da visual-heavy'yi zorla seçer.

4. **Breaker rhythm**: Her 6 row'da en az 1 ritm kırıcı (micro/wide-short). Aynı şekilde zorunlu.

5. **Adaptive to pool**: Pool'da sadece `square` tipi 2 tane kaldıysa, engine sadece `DUAL_SQUARE` layout'u seçer. Yeterli item olmayan layout'lar feasible set'ten düşer.

6. **Pull-to-refresh → `layoutSeed` artar** → feed baştan shuffle. Aynı data farklı sıralama.

## 🌐 Backend Data Shape

```js
{
  id: 'ritual_123',
  type: 'curated-ritual',            // internal tip (opsiyonel)

  // ---- Görsel ----
  title: 'Soviet Modernism: A Night With Architects',
  subtitle: '...',                    // Hero için tanıtım metni
  host: 'Flavia De Rossi · Studio Raza',
  coverImage: 'https://...',
  dateRange: '15-22 NİSAN',          // Super Event için date range string
  dateStrip: '17 NİS',                // Poster için kısa date strip

  // ---- Curation ----
  curationSignals: ['editors-pick', 'premium'],
                                      // 1+ signal, priority yüksek olan önce
  price: {
    kind: 'paid',                     // 'paid' | 'free' | 'invite-only' | 'rs-gated'
    amount: '120€',                   // label - opsiyonel, kind'a göre default
  },

  // ---- Collection ilişkisi ----
  collectionLink: {
    id: 'super_1',
    name: 'Milano Design Week',
  },                                   // opsiyonel — bu ritüel hangi Super Event'e bağlı

  // ---- Editorial ----
  curatorNote: "Soğuk savaş döneminin görülmemiş mimarisi...",
                                      // LOCAL'in notu, Full kartın box'ına render
  curatorMini: "Flavia'nın gözünden dinlemek için fırsat.",
                                      // HalfTall için kısa varyant

  // ---- Meta ----
  meta: {                              // Full kart meta grid
    date: '17 Nis · 20:00',
    venue: 'Fondazione Prada',
    seats: '6/12',                    // taken/total format string
  },

  // ---- Doluluk ----
  availability: {                      // WebSocket ile güncellenir
    taken: 6,
    total: 12,
    waitlist: 0,                      // bekleme listesindeki kişi sayısı
  },

  // ---- Live stats (WebSocket ile güncellenir) ----
  liveStats: {
    currentViewers: 28,               // şu an sayfaya bakan kişi
    viewsLastHour: 80,                // trending için
    bookingsLastHour: 4,              // trending için
  },

  // ---- Special guests (Full kart için) ----
  guests: [
    { name: 'Ivan Petrov', avatar: 'https://...' },
    { name: 'Maria Lastovkina', avatar: 'https://...' },
  ],

  // ---- Registration timing ----
  registrationClosesAt: '2025-04-25T23:59:00Z',
                                      // limited signal için 4 saat altındaki kartlar
                                      // "SON 4 SAAT" label'ı alır

  // ---- Past memory ----
  isPastMemory: true,                  // SquareCard kullanılacak
  rating: 4.9,                         // 0-5 yıldız
  attendeeCount: 48,                   // katılan kişi sayısı

  // ---- Poster-özel ----
  guestPortrait: 'https://...',        // dikey portre foto
  name: 'Ivan Petrov',                 // poster başlık

  // ---- Hint flags ----
  quickGlance: false,                  // true → MicroCard tercih edilir
  hasFullContent: true,                // true → FullCard'a yükseltilir

  // ---- Wide-short-özel ----
  avatarSquare: true,                  // partner logo için square avatar
  ctaLabel: 'Kayıt',                   // "Kayıt" | "Hemen Al" | "Detay"
  ctaUrgent: true,                     // CTA'yı kırmızı yapar (limited için)
}
```

### Hangi kart hangi field'lara ihtiyaç duyar?

| Card | Zorunlu | Önemli opsiyonel |
|------|---------|-----------------|
| HeroCard | title, coverImage, curationSignals:['super-event'] | subtitle, dateRange, collectionStats, liveStats |
| FullCard | title, coverImage, host | curatorNote, meta, availability, liveStats, price, guests, footerNote, collectionLink |
| HalfTallCard | title, date, coverImage | seats, priceLabel, curatorMini, viewerCountInline |
| SquareCard | title, coverImage, isPastMemory | subtitle, rating, attendeeCount |
| PosterCard | name, guestPortrait, dateStrip | subtitle |
| WideShortCard | name, subtitle, ctaLabel | avatar, avatarSquare, ctaUrgent |
| MicroCard | title, date, priceLabel | — |

### collectionStats (sadece HeroCard için)

```js
collectionStats: {
  ritualCount: 8,       // koleksiyondaki ritüel sayısı
  hostCount: 6,
  totalSeats: 98,
  takenSeats: 42,
}
```

## 🔗 Backend Endpoint'leri

### 1. Paginated list

```
GET /pulse/special-events?offset=0&limit=15
```

Response:
```json
{
  "items": [...],
  "hasMore": true
}
```

Backend **priority'ye göre sıralı** döndürmeli (Super Event'ler, limited'lar önce). Frontend bunu tekrar shuffle ediyor ama priority öne almak için.

### 2. Live stats WebSocket

```
WS /pulse/special-events/live
```

Subscribe mesajı:
```json
{
  "action": "subscribe",
  "itemIds": ["ritual_123", "ritual_124", ...]
}
```

Server tarafından gelen update mesajları:
```json
{
  "type": "live-update",
  "updates": {
    "ritual_123": {
      "currentViewers": 34,
      "viewsLastHour": 85,
      "bookingsLastHour": 4,
      "taken": 7,
      "waitlist": 0
    },
    "ritual_124": {
      "currentViewers": 12
    }
  }
}
```

Partial update — sadece değişen field'lar gelir. Frontend `liveOverrides` state'inde merge eder.

**Frequency**: Server her 3-5 saniyede bir batch halinde push edebilir. Her değişiklikte tek tek push etmek 5000 kullanıcıda network'u aşırı yükler.

### 3. RSVP & Waitlist

```
POST /pulse/special-events/:id/rsvp
POST /pulse/special-events/:id/waitlist
```

`FullCard`'ın `onRSVP` / `onJoinWaitlist` callback'leri bu endpoint'lere route'lanmalı. `RSVPFlow` / `WaitlistJoin` screen'leri kullanıcıya ek onay/ödeme ekranı gösterir, buradan sonra bu endpoint'e POST atılır.

## 🔌 PulseScreen.js Entegrasyonu

```js
import SpecialEventsView from './SpecialEventsView';

const wsClient = initializeWebSocketClient(); // LOCAL'in WS client'ı

export default function PulseScreen({ navigation }) {
  const [activeFilter, setActiveFilter] = useState('Tümü');

  if (activeFilter === 'Özel Etkinlikler') {
    return (
      <SpecialEventsView
        fetchSpecialEvents={async ({ offset, limit }) => {
          const res = await api.get('/pulse/special-events', {
            params: { offset, limit },
          });
          return res.data;
        }}

        subscribeLiveStats={(itemIds, callback) => {
          const handler = (msg) => {
            if (msg.type === 'live-update') callback(msg.updates);
          };
          wsClient.send({ action: 'subscribe', itemIds });
          wsClient.on('message', handler);

          return () => {
            wsClient.send({ action: 'unsubscribe', itemIds });
            wsClient.off('message', handler);
          };
        }}

        navigation={navigation}
        onBack={() => setActiveFilter('Tümü')}
        pageSize={15}
      />
    );
  }

  // Normal Pulse...
}
```

## 🔥 5000 Eşzamanlı Kullanıcı Optimizasyonları

### Frontend tarafında

1. **WebSocket partial updates**: Server sadece değişen field'ları push ediyor, tüm item replace etmiyor. `setLiveOverrides(prev => ({...prev, ...updates}))` ile immutable merge.

2. **FlatList virtualization**: `removeClippedSubviews`, `maxToRenderPerBatch=6`, `windowSize=10`. Ekran dışındaki kartlar unmount olur, memory leak yok.

3. **Memoized enrichment**: `enrichWithAvailability` `useMemo` içinde — items veya liveOverrides değişmedikçe rerun etmez.

4. **Layout stability**: `layoutSeed` sadece pull-to-refresh'te değişir. Yeni page load'larda row'lar key-stable kalır, re-render patlamaz.

5. **Animated `useNativeDriver: true`**: Live viewer pulse animation'ı UI thread'de değil, animation thread'de çalışır.

### Backend'de önerilen

1. **WS fanout**: 5000 kullanıcı aynı popüler Hero kartı izliyorsa, her birine tek tek update push etmek yerine topic-based subscription.

2. **Rate limiting**: Aynı kullanıcı dakikada max 30 RSVP denemesi. 5000 kullanıcının aynı Limited kartına aynı anda tıklaması durumunda first-come-first-served + fair queueing.

3. **Cache**: `currentViewers` count'u CDN edge'de cache'lenebilir (TTL 3-5sn). Database'den her seferinde okumak yerine Redis counter.

4. **Waitlist atomicity**: Bir kart doluluğu 11/12 iken 50 kullanıcı "Yerini Al" tıkladığında sadece 1'i kayıt olabilir, gerisi atomic CAS ile waitlist'e düşer.

## 🧪 Mock Test

```js
// App.js
import SpecialEventsViewTest from './screens/SpecialEventsViewTest';
export default function App() {
  return <SpecialEventsViewTest />;
}
```

Davranışı göreceksin:
- 40 mock item, 15'erli sayfa, 3 sayfa
- WebSocket simülasyonu: her 4 saniyede 3-5 kartın viewer count'u değişir
- Bazı kartlar otomatik waitlist-only'ye geçer (taken arttıkça)
- Pull-to-refresh yeniden shuffle
- Console'da WS update'leri log'lanır

Bu wrapper production'a gerek yok — sadece Cursor'da çalıştırıp davranışı görmek için.

## ⚠️ Notlar

**1. Altın palette eksikse theme'e ekleyin**
`theme/index.js` içinde `gold`, `goldSoft`, `goldDeep`, `goldLight` renkleri olmalı:
```js
gold: '#b8891f',
goldSoft: '#f5ecd4',
goldDeep: '#8a6514',
goldLight: '#d4a94a',
orange: '#d97706',       // trending için
orangeSoft: '#fde8c7',
```

**2. WebSocket yoksa degrade**
`subscribeLiveStats` prop'unu geçmeyebilirsin. O zaman viewer count'lar static kalır, backend snapshot'ı olarak görünür. Component yine çalışır.

**3. `liveOverrides` bellek büyümesi**
Kullanıcı çok fazla sayfa yüklerse `liveOverrides` state'i büyür (silinmiş item'lar için de key kalabilir). Kritik olmayabilir ama `setItems` sırasında orphaned override'ları temizlemek istiyorsan:
```js
setLiveOverrides((prev) => {
  const activeIds = new Set(newItems.map(i => i.id));
  return Object.fromEntries(
    Object.entries(prev).filter(([id]) => activeIds.has(id))
  );
});
```

**4. Layout engine'in fallback'i**
Pool'da kalan item'lar hiçbir layout'a sığmıyorsa (örn. sadece 1 poster kaldı) fallback olarak `FULL` layout'una düşer. Yani hiçbir item kaybolmaz, ama optimal olmayan bir boyutta render olabilir.

**5. Priority score özelleştirilebilir**
`utils/eventAvailability.js` içindeki `priorityScore` fonksiyonu business logic'ine göre tunelenebilir. Şu an Super Event +100, Trending +40, Limited +60 gibi weight'ler var. Backend tarafı custom score döndürebilirse ona göre de sort edilebilir.

**6. CuratorNote Full dışındaki kartlarda**
Şu an sadece `FullCard`'da büyük curator note box'ı var. `HalfTall` ve `WideShort`'ta `curatorMini` olarak kısa versiyonu render ediliyor. Micro ve Square'da hiç yok — zaten o kartlar tek bakışla geçen kartlar.
