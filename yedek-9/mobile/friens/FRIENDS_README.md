# Arkadaşlar (Friends) Mode - Entegrasyon Rehberi

Bento grid + sıcaklık (heat) göstergesi + yakınlık gruplaması. "Arkadaşlar" filtresi seçildiğinde aktifleşir.

## 📦 Yeni Dosyalar

```
pulse_rn/
├── utils/
│   └── friendshipHeat.js                  [YENİ] Heat + closeness hesaplaması
├── components/
│   └── FriendsCards/
│       ├── index.js                        [YENİ] Export barrel
│       ├── HeatIndicator.js                [YENİ] 4-pip sıcaklık göstergesi
│       ├── FriendsContext.js               [YENİ] Üst özet bandı
│       ├── FriendSpotlightCard.js          [YENİ] Büyük editoryal kart
│       ├── FriendThinCards.js              [YENİ] FriendNow + Rekindle
│       ├── SharedMemoryCard.js             [YENİ] "SEN DE" badge'li anı
│       ├── RitualTogetherCard.js           [YENİ] Aksiyon: arkadaşların gidiyor
│       └── FriendQuoteAndNewConnection.js  [YENİ] Quote + NewConnection
└── screens/
    └── FriendsView.js                      [YENİ] Tam Arkadaşlar ekranı
```

## 🔧 Kurulum

Ekstra bir paket gerekmiyor. `react-native-linear-gradient` ve `react-native-vector-icons` zaten Pulse için yüklenmiş.

## 🌡️ Heat (sıcaklık) sistemi

Her arkadaş için backend'den `lastRitualDate` (son ortak ritüel tarihi) ve `sharedRitualCount` (toplam ortak ritüel sayısı) gelmeli. `friendshipHeat.js` bunlardan otomatik hesaplar:

| Heat | Süre | Renk | Label |
|------|------|------|-------|
| `hot` | ≤7 gün | Kırmızı | CANLI |
| `warm` | ≤30 gün | Altın | SICAK |
| `cool` | ≤90 gün | Koyu gri | TANIDIK |
| `cold` | >90 gün | Açık gri | SOĞUYAN |

Yakınlık grubu 3 kategoriye ayrılır:

| Closeness | Kriter |
|-----------|--------|
| `close` | 10+ ortak ritüel VEYA heat='hot' |
| `acquaintance` | 2-10 ortak ritüel |
| `new` | Son 30 günde tanışılmış + 1-2 ritüel |

## 🌐 Backend Data Shape

### Friends array
```js
{
  id: 'friend_123',
  name: 'Elena Moretti',
  avatar: 'https://...',

  // Heat calculation için zorunlu:
  lastRitualDate: '2024-11-20T18:30:00Z',
  sharedRitualCount: 23,

  // Closeness için:
  firstMetDate: '2024-03-15T00:00:00Z',
  firstMetRitual: { name: 'Jazz Night', date: '2024-03-15' },

  // FriendSpotlightCard için:
  coverImage: 'https://...',
  handwrittenQuote: '"geçen akşam dopdoluydu..."',  // opsiyonel
  isActive: true,
  activeRitual: { name: 'Terrazza Aperol', venue: 'Navigli' },  // eğer isActive true ise
  stats: {
    sharedRituals: 23,
    lastMeetingDate: '2024-11-20',
    sharedMemories: 47,
  },
  ctaLabel: "Terrazza Aperol'e katıl",  // isActive true ise

  // FriendNowCard için:
  // isActive + activeRitual yeterli

  // RekindleCard için:
  // lastRitualDate + firstMetRitual yeterli (heat otomatik hesaplanır)
}
```

### Memories array (event-like kartlar için)

```js
[
  {
    id: 'sm_1',
    type: 'shared-memory',
    image: 'https://...',
    title: 'Jazz Night',
    venue: 'Blue Note',
    date: '2024-11-01T20:00:00Z',
    participants: [
      { name: 'Elena', avatar: '...' },
      { name: 'Alessandro', avatar: '...' },
    ],  // senin hariç
  },
  {
    id: 'rt_1',
    type: 'ritual-together',
    ritualName: 'Dinner Circle',
    venue: 'Navigli',
    bgImage: 'https://...',
    date: 'Perşembe 20:00',
    seatsLeft: 4,
    friendsGoing: [
      { name: 'Chiara', avatar: '...' },
      { name: 'Alessandro', avatar: '...' },
      { name: 'Luca', avatar: '...' },
    ],
  },
  {
    id: 'fq_1',
    type: 'friend-quote',
    text: "Milano'da bir yere ait olmak, orada ritüellerin olmasıyla başlıyor.",
    authorName: 'Alessandro',
    authorAvatar: 'https://...',
    context: 'BOOK CLUB · 1h',  // rituel + saat
    heat: 'warm',  // opsiyonel, verilmezse neutral
  },
]
```

### NewConnection için ek field'lar (friends array'inde)

```js
{
  // ... diğer friend field'ları
  firstConversationNote: 'ilk sohbetiniz Calvino üzerineydi',  // opsiyonel, el yazısı hatıra
}
```

## 🔗 Backend Endpoint Önerisi

```
GET /pulse/friends
```

Response:
```json
{
  "friends": [
    { "id": "...", "name": "...", "lastRitualDate": "...", ... }
  ],
  "memories": [
    { "id": "...", "type": "shared-memory", ... },
    { "id": "...", "type": "ritual-together", ... },
    { "id": "...", "type": "friend-quote", ... }
  ]
}
```

Backend'de heat/closeness hesaplamak gereksiz — frontend'de `friendshipHeat.js` hallediyor.

## 🔌 PulseScreen.js Entegrasyonu

Tıpkı Nearby gibi, filter state'e göre render:

```js
import FriendsView from './FriendsView';

export default function PulseScreen({ navigation }) {
  const [activeFilter, setActiveFilter] = useState('Tümü');

  if (activeFilter === 'Arkadaşlar') {
    return (
      <FriendsView
        fetchFriends={async () => {
          const res = await api.get('/pulse/friends');
          return res.data;  // { friends, memories }
        }}
        city="Milano"
        navigation={navigation}
        onBack={() => setActiveFilter('Tümü')}
      />
    );
  }

  // Normal Pulse...
}
```

## 🎨 7 Kart Tipi

### 1. FriendSpotlightCard (Full-width, editoryal)
En yakın arkadaş için büyük kart: cover fotoğraf + el yazısı quote + avatar + 3 istatistik (ritüel/gün/anı) + CTA butonları.

### 2. FriendNowCard (Thin)
Aktif arkadaş için: avatar + pulse dot + "Morning Yoga · Parco" + Gör butonu.

### 3. SharedMemoryCard (Kare, dual grid)
"SEN DE" altın badge + ritüel fotosu + katılan arkadaşlar.

### 4. RitualTogetherCard (Full-width, siyah cinematic)
Arkadaşların gideceği ritüel: "3 ARKADAŞIN GİDİYOR" + ritüel adı + "Sen de katıl" beyaz buton.

### 5. RekindleCard (Thin, paper)
Soğumakta arkadaş: desaturate avatar + gün badge (42g) + "Book Discussion'da tanışmıştınız" + Yaz butonu.

### 6. FriendQuoteCard (Paper, dual grid)
Arkadaşının söylediği söz: büyük tırnak + italik metin + HeatIndicator + byline.

### 7. NewConnectionCard (Cream gradient, full veya compact)
Son 30 günde tanıştıkların: altın star label + avatar + ilk ritüel + el yazısı ilk sohbet notu + "Tanışıklığı pekiştir" butonu.

## 📐 Layout Mantığı

`FriendsView.js` içinde 3 section, her biri farklı layout engine:

**yakınların** → `CloseFriendsLayout`
- Spotlight (ilk, en yakın) → FriendNow'lar → Dual SharedMemory → RitualTogether → Rekindle

**tanıdıkların** → `AcquaintanceLayout`
- Asym (Quote + SharedMemory) → Rekindle'lar

**yeni tanıştıkların** → `NewConnectionsLayout`
- Full NewConnection → Dual compact NewConnection'lar

## 🧪 Mock Test

```js
<FriendsView
  friends={[
    {
      id: 'elena',
      name: 'Elena Moretti',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
      lastRitualDate: '2024-11-20',  // 3 gün önce → hot
      sharedRitualCount: 23,
      firstMetDate: '2024-03-15',
      firstMetRitual: { name: 'Jazz Night', date: '2024-03-15' },
      coverImage: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=900',
      handwrittenQuote: '"geçen akşam dopdoluydu..."',
      isActive: true,
      stats: {
        sharedRituals: 23,
        lastMeetingDate: '2024-11-20',
        sharedMemories: 47,
      },
      ctaLabel: "Terrazza Aperol'e katıl",
    },
    {
      id: 'sofia',
      name: 'Sofia Bianchi',
      avatar: 'https://...',
      lastRitualDate: '2024-10-12',  // 42 gün önce → cool
      sharedRitualCount: 15,
      firstMetRitual: { name: 'Book Discussion' },
    },
    // ...
  ]}
  memories={[
    {
      id: 'sm_jazz',
      type: 'shared-memory',
      image: 'https://...',
      title: 'Jazz Night',
      venue: 'Blue Note',
      date: '2024-11-01',
      participants: [
        { name: 'Elena', avatar: '...' },
        { name: 'Alessandro', avatar: '...' },
      ],
    },
    {
      id: 'rt_dinner',
      type: 'ritual-together',
      ritualName: 'Dinner Circle',
      venue: 'Navigli',
      bgImage: 'https://...',
      date: 'Perşembe 20:00',
      seatsLeft: 4,
      friendsGoing: [...],
    },
  ]}
  city="Milano"
/>
```

## ⚠️ Önemli Notlar

1. **Desaturation workaround**: RN'de CSS `filter: grayscale()` yok. RekindleCard'da `opacity: 0.7` kullandım. Alternatif olarak tint color veya OpacitySaturation paketi düşünülebilir.

2. **Heat güncellemesi**: Heat client-side hesaplanıyor. Saat değiştiğinde tekrar hesaplanmaz — ekran tekrar mount edilene kadar. Canlı güncelleme isteniyorsa `useEffect` + interval eklenebilir.

3. **isActive durumu**: Real-time için WebSocket gerekli. Backend'den `activity:friend_joined_ritual` event'leri subscribe et.

4. **Spotlight seçimi**: Şu an sadece ilk friend alınıyor. Gelecekte daha akıllı seçim yapılabilir (örn: "en uzun süredir görüşmediğin yakın arkadaş").

5. **Empty state**: Arkadaş hiç yoksa gösteriliyor. Ama grupların biri boş olursa o section hiç render edilmiyor — bu iyi.
