# Yakınımda (Nearby) Mode - Entegrasyon Rehberi

Hibrit radar + mesafe-öncelikli feed. "Yakınımda" filtresi seçildiğinde aktifleşir.

## 📦 Yeni Dosyalar

```
pulse_rn/
├── utils/
│   └── geoUtils.js                           [YENİ] Haversine + bearing + format helpers
├── components/
│   ├── NearbyRadar/
│   │   ├── NearbyRadar.js                    [YENİ] Ana radar SVG component
│   │   ├── RadarDot.js                       [YENİ] Pulse animasyonlu dot
│   │   └── index.js                          [YENİ]
│   └── PulseCards/
│       ├── DistanceBadge.js                  [YENİ] Mesafe etiketi
│       ├── VenueCard.js                      [YENİ] Mekan + Arkadaş kartı
│       └── index.js                          [GÜNCELLEME] Yeni export'lar
└── screens/
    └── NearbyView.js                         [YENİ] Tam Yakınımda ekranı
```

## 🔧 Kurulum

```bash
npm install react-native-svg
cd ios && pod install && cd ..
```

`react-native-svg` zaten yüklüyse ekstra bir şey gerekmiyor.

## 🔌 PulseScreen.js Entegrasyonu

Mevcut `PulseScreen.js` içinde filter state'in var. `activeFilter === 'Yakınımda'` olduğunda radar deneyimini göstereceğiz. En temiz yol **filter state'i izlemek** ve NearbyView'e yönlendirmek:

### Seçenek A: Conditional render (aynı stack içinde)

`PulseScreen.js` içinde render bloğunun en başına ekle:

```js
import NearbyView from './NearbyView';

export default function PulseScreen({ navigation }) {
  const [activeFilter, setActiveFilter] = useState('Tümü');
  // ... diğer state'ler

  // Yakınımda seçildiyse NearbyView göster
  if (activeFilter === 'Yakınımda') {
    return (
      <NearbyView
        userLocation={userLocation}
        fetchNearby={fetchNearbyItems}
        neighborhood="Brera"
        navigation={navigation}
        onBack={() => setActiveFilter('Tümü')}
      />
    );
  }

  // Normal Pulse render...
}
```

### Seçenek B: Ayrı route (daha modüler)

```js
// Navigator config
<Stack.Screen name="Pulse" component={PulseScreen} />
<Stack.Screen name="PulseNearby" component={NearbyScreen} />

// PulseScreen içinde filter tıklandığında
onPress={() => {
  if (filter === 'Yakınımda') {
    navigation.navigate('PulseNearby');
  } else {
    setActiveFilter(filter);
  }
}}
```

**Önerim**: Seçenek A — çünkü filter state'i zaten mevcut, daha az boilerplate.

## 📍 Konum Erişimi (react-native-geolocation-service)

```bash
npm install react-native-geolocation-service
```

`NearbyView` kullanımı için `userLocation` prop'u gerekiyor. PulseScreen'de:

```js
import Geolocation from 'react-native-geolocation-service';

const [userLocation, setUserLocation] = useState(null);

useEffect(() => {
  Geolocation.getCurrentPosition(
    (position) => {
      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    },
    (error) => {
      console.warn('Konum alınamadı:', error);
      // Fallback: varsayılan neighborhood (Brera)
      setUserLocation({ lat: 45.4719, lng: 9.1882 });
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
  );
}, []);
```

iOS için `Info.plist`'e ekle:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Yakındaki ritüelleri göstermek için konumuna ihtiyacımız var.</string>
```

Android için `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

## 🌐 Backend Item Shape

Backend item'lar şu yapıda gelmeli (lat/lng ZORUNLU):

```js
{
  id: 'mem_123',
  type: 'venue' | 'live' | 'memory' | 'square' | 'miniQuote' | 'event' | 'friend',
  lat: 45.4723,      // ZORUNLU
  lng: 9.1895,       // ZORUNLU

  // Type-specific data:
  // venue için:
  name: 'Caffè Letterario',
  image: 'https://...',
  verified: true,
  status: 'open' | 'closed',
  occupancy: '18 kişi içeride',
  activity: 'Miles Davis çalıyor',
  activityIcon: '♪',

  // friend için:
  avatar: 'https://...',
  name: 'Giulia T.',
  location: "Parco Sempione'de",
  currentRitual: 'Morning Yoga',

  // live için (mevcut LiveChipCard shape'i):
  image, title, meta, seats, rankingText

  // memory için (mevcut kart shape'leri)
}
```

`enrichWithDistance()` utility fonksiyonu otomatik olarak her item'a `distance` ve `bearing` ekliyor.

## 🔗 Backend Endpoint Önerisi

```
GET /pulse/nearby?lat={}&lng={}&radius={}&limit=50
```

Response:
```json
{
  "items": [
    {
      "id": "...",
      "type": "venue",
      "lat": 45.4723,
      "lng": 9.1895,
      "name": "Caffè Letterario",
      "status": "open",
      ...
    }
  ],
  "neighborhood": "Brera",  // reverse geocoding ile
  "count_by_type": { "live": 1, "venue": 2, "memory": 4, "friend": 2 }
}
```

## 🎯 Örnek Kullanım

```js
import NearbyView from './screens/NearbyView';

<NearbyView
  userLocation={{ lat: 45.4719, lng: 9.1882 }}
  fetchNearby={async (radius) => {
    const res = await api.get('/pulse/nearby', {
      params: { lat: 45.4719, lng: 9.1882, radius }
    });
    return res.data.items;
  }}
  neighborhood="Brera"
  onBack={() => navigation.goBack()}
  navigation={navigation}
/>
```

## 📐 Radar Davranışı

- **Sweep**: 5 saniyelik rotasyon, altın gradient wedge
- **Kullanıcı pulse**: merkez altın nokta + 2 staggered pulse ring'i (2.5s cycle)
- **Canlı dot'lar**: scale pulse animasyonu (1.2s cycle)
- **Dot tıklama**: activeDotId state'i → dot pop + feed'e scroll + kart highlight
- **Yarıçap değişimi**: tüm dot pozisyonları recompute ediliyor, dışarı çıkanlar otomatik kayboluyor

## 🎨 Tasarım Sistemi Uyumu

Mevcut theme'e entegre:
- `colors.navy` - Radar background
- `colors.gold` - User center + sweep
- `colors.live / .green / .blue / .gold` - Dot tipleri
- `colors.cream` - Context strip background
- `fonts.serif` - Neighborhood name (Brera · Milano)
- `fonts.sansBold` - Labels (CANLI TARAMA, SEN, vs.)

## 🧪 Mock Data ile Test

`NearbyView`'e `initialItems` prop'u geçerek backend olmadan test edebilirsin:

```js
<NearbyView
  userLocation={{ lat: 45.4719, lng: 9.1882 }}
  initialItems={[
    {
      id: 'live_1',
      type: 'live',
      lat: 45.4725,      // ~70m kuzey
      lng: 9.1885,
      image: 'https://...',
      title: 'Brunch Circle',
      meta: 'Brera',
      seats: '6 yer kaldı',
      rankingText: '2 arkadaş içeride',
    },
    {
      id: 'venue_caffe',
      type: 'venue',
      lat: 45.4720,
      lng: 9.1892,
      name: 'Caffè Letterario',
      image: 'https://...',
      status: 'open',
      occupancy: '18 kişi içeride',
      activity: 'Miles Davis · So What çalıyor',
      verified: true,
    },
    // ... diğer itemlar
  ]}
  neighborhood="Brera"
/>
```

## ⚡ Performans Notları

- Radar SVG: 400x280 viewBox, ~15-20 dot max gösteriliyor
- Dot pulse animasyonları `useNativeDriver: true` (scale için)
- Sweep rotation `useNativeDriver: false` (SVG transform prop için native driver desteklenmiyor)
- 5000 concurrent user'da 1km yarıçap içinde ~20-50 item beklenebilir — radar güzel gösterir
- Daha fazlası olursa backend filtrelenmiş halde dönmeli (en yakın N item)

## 🚧 Sonraki Adımlar

Geliştirilebilecek özellikler:
1. **Compass heading** — cihaz yönü ile radar rotasyonu (MagnetometerService)
2. **Slider** — pill'ler yerine gerçek yarıçap slider'ı (250m - 5km arası sürekli)
3. **Cluster** — çok yoğun bölgelerde dot'ları kümele
4. **Sheet modal** — dot'a tıklayınca alttan slide-up detay
5. **Harita görünümü** — radar top-right'ta "harita" ikon → full-screen Mapbox
