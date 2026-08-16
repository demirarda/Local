# LOCAL · Pulse React Native Module

Bento grid layout ile karışık ritimli memory/event/music/audio feed.

## 📁 Dosya yapısı

```
pulse_rn/
├── theme/
│   └── index.js                          # Renkler, fontlar, spacing, shadows
├── utils/
│   └── pulseLayoutEngine.js              # Layout randomization engine
├── components/
│   └── PulseCards/
│       ├── index.js                      # Export barrel
│       ├── RankingBadge.js               # "neden bu kart?" etiketi
│       ├── HeroMemoryCard.js             # Full-width memory
│       ├── SquareMemoryCard.js           # Kare memory (dual/triple)
│       ├── QuoteCards.js                 # Quote + MiniQuote
│       ├── EventCard.js                  # Cinematic etkinlik
│       ├── MiscCards.js                  # Polaroid + Live
│       ├── SpotifyCards.js               # Track + Playlist + NowPlaying
│       └── AudioCards.js                 # VoiceMemo + Story + Ambiance + Group
└── screens/
    └── PulseScreen.js                    # Ana ekran (mevcut PulseScreen.js'i replace eder)
```

## 🔧 Gerekli Kurulum

### 1. npm paketleri

```bash
npm install react-native-vector-icons react-native-linear-gradient react-native-svg
```

### 2. Link (iOS için)

```bash
cd ios && pod install && cd ..
```

### 3. Android Icon'ları (android/app/build.gradle)

```gradle
apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"
```

### 4. Font dosyaları

Projenize şu fontları ekleyin (`assets/fonts/`):
- `CormorantGaramond-Regular.ttf`
- `CormorantGaramond-Medium.ttf`
- `CormorantGaramond-SemiBold.ttf`
- `Inter-Regular.ttf`
- `Inter-Medium.ttf`
- `Inter-SemiBold.ttf`
- `Inter-Bold.ttf`
- `Caveat-Regular.ttf`
- `Caveat-Bold.ttf`

`react-native.config.js`:
```js
module.exports = {
  assets: ['./assets/fonts/'],
};
```

Sonra:
```bash
npx react-native-asset
```

## 🚀 Kullanım

### Ana ekran entegrasyonu

Mevcut PulseScreen.js'i yeni olanıyla değiştir. Navigation'a göre örnek:

```js
// App.js veya navigation config
import PulseScreen from './screens/PulseScreen';

<Stack.Screen name="Pulse" component={PulseScreen} />
```

### Backend entegrasyonu

`PulseScreen.js` içinde `mockFetchFeed` fonksiyonunu gerçek API ile değiştir:

```js
const fetchPulseFeed = useCallback(async (opts = {}) => {
  const response = await api.get('/pulse/feed', {
    params: {
      filter: opts.filter,
      limit: 30,
      offset: opts.refresh ? 0 : items.length,
    },
  });
  const newItems = response.data.items;
  // ...
}, []);
```

### Backend item shape

Her item şu yapıda olmalı:

```js
{
  id: 'unique_id',
  type: 'hero' | 'square' | 'quote' | 'miniQuote' | 'event' |
        'polaroid' | 'live' | 'spotifyTrack' | 'spotifyPlaylist' |
        'nowPlaying' | 'voiceMemo' | 'audioStory' | 'venueAmbiance' | 'groupVoice',
  ranking: {
    type: 'friend' | 'follow' | 'nearby' | 'trending' | 'similar' | 'new',
    label: 'Takip ettiğin host', // Kullanıcıya gösterilecek metin
  },
  // Type'a göre değişen diğer field'lar (her kart dosyasındaki JSDoc'a bak)
}
```

### WebSocket - Fresh indicator

`PulseScreen.js` içinde:

```js
useEffect(() => {
  const ws = websocketService.subscribe('pulse:new_items', (data) => {
    setFreshCount(prev => prev + data.count);
    showFreshPill();
  });
  return () => ws.unsubscribe();
}, []);
```

## 🎨 Layout Engine Nasıl Çalışır

`buildPulseLayout(items)` fonksiyonu:

1. Item'ları `type`'a göre gruplar
2. Her type'ı Fisher-Yates ile karıştırır
3. Layout listesinden ağırlıklı random seçim yapar
4. **Aynı layout 2 kez arka arkaya gelmez**
5. Seçilen layout'un kabul ettiği item tipleri pool'dan alınır
6. Row objesi: `{ id, layout, items: [{item, type}, ...] }`

### Layout türleri

- **Full** (1 kart tam genişlik): `full-hero`, `full-quote`, `full-live`, `full-spotify-track`, `full-now-playing`, `full-audio-story`, `full-venue-ambiance`, `full-group-voice`
- **Dual** (2 eşit kolon): `dual-square`, `dual-mini-quote`, `dual-mixed`, `dual-spotify-mix`, `dual-audio-mix`
- **Asym** (1/3 + 2/3): `asym-left-mix`, `asym-right-mix`, `asym-spotify-playlist`, `asym-audio-mix`
- **Triple** (3 küçük kart): `triple-square`

### Ağırlık ayarlama

`pulseLayoutEngine.js` içinde `WEIGHTS` objesinden değiştir:

```js
const WEIGHTS = {
  'full-hero': 3,       // sık çıksın
  'full-live': 1,       // nadir
  // ...
};
```

## 🔗 Backend Endpoint Önerileri

```
GET  /pulse/feed?filter=Tümü&limit=30&offset=0
POST /pulse/feedback  { memory_id, action: 'not_interested' }
GET  /pulse/fresh     (sadece son X dakikadaki yeni sayı)

# Media specific
GET  /spotify/track/:id         (Spotify Web API proxy)
GET  /spotify/playlist/:id
GET  /spotify/now-playing/:userId    (WebSocket push önerilir)

POST /audio/upload              (voice memo / group voice)
GET  /audio/:id
GET  /venues/:id/ambiance/stream   (HLS live stream)
```

## 📱 Card Event Handlers

Her kart şu handler'ları kabul eder (PulseScreen'de tanımlı):

- `onPress(item)` — Kart tıklanması
- `onDismiss(item)` — "ilgimi çekmiyor"
- `onJoin(item)` — Event'e katıl
- `onPlay(item, isPlaying)` — Ses/müzik oynat/durdur
- `onListen(item)` — Venue ambiance stream başlat

## ⚡ Performans İpuçları

`FlatList` şu optimizasyonlarla çalışıyor:

- `removeClippedSubviews={true}` — ekran dışı view'ları unmount eder
- `maxToRenderPerBatch={5}` — batch başına max render
- `windowSize={10}` — render window
- `initialNumToRender={6}` — ilk açılışta 6 row

Daha büyük listelerde `FlashList` (shopify) geçişi düşünülebilir.

## 🧪 Test

Placeholder `mockFetchFeed` fonksiyonu 15 farklı item döndürür. PulseScreen tam olarak backend olmadan da çalışır — Cursor'da direkt açıp görebilirsin.
