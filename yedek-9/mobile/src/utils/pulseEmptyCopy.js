/** son-part.md §8.4 — filtre bazlı boş durum metinleri */

const COPY = {
  'Tümü': {
    title: 'Pulse bos',
    message: 'Son 24 saatte arkadas ve FL kapsaminda memory yok. Ritual bitince windowda paylasim yapilabilir.',
    action: 'City Rhythm',
    route: 'CityRhythm',
  },
  'Şimdi Canlı': {
    title: 'Canli Ritual yok',
    message: 'Simdilik canli veya cok yakin baslayan Ritual gorunmuyor.',
    action: 'City Rhythm',
    route: 'CityRhythm',
  },
  'Başlamak Üzere': {
    title: 'Yakinda baslayan yok',
    message: 'Baslamak uzere olan Ritual bulunmuyor.',
    action: 'City Rhythm',
    route: 'CityRhythm',
  },
  'Local World': {
    title: 'Local World bos',
    message: 'Acik forum veya sehir geneli public memory gorunmuyor.',
    action: 'Haritaya bak',
    route: 'Local',
  },
  Arkadaşlar: {
    title: 'Arkadas akisi bos',
    message: 'Arkadaslarinin son 24 saatlik pulse paylasimi yok.',
    action: 'Arkadas ekle',
    route: 'FriendsList',
  },
  FL: {
    title: 'FL akisi bos',
    message: 'Yakin arkadas (FL) kapsaminda son 24 saatte paylasim yok.',
    action: null,
    route: null,
  },
  Uni: {
    title: 'Uni akisi bos',
    message: 'Ayni universiteden kullanicilarin pulse paylasimi yok.',
    action: null,
    route: null,
  },
  Gizli: {
    title: 'Gizli Ritual yok',
    message: 'Gorunurlugu hidden olan acik Ritual bulunmuyor.',
    action: null,
    route: null,
  },
  'Özel Etkinlikler': {
    title: 'Ozel etkinlik yok',
    message: 'Kurasyonlu ozel etkinlik listesi bos.',
    action: 'City Rhythm',
    route: 'CityRhythm',
  },
  Yakınımda: {
    title: 'Yakininda Ritual yok',
    message: 'GPS yarıcapinda canli veya yakinda baslayan Ritual gorunmuyor.',
    action: 'Tum sehre bak',
    route: null,
  },
  default: {
    title: 'Bu filtrede icerik yok',
    message: 'Secili filtreye uygun Ritual veya memory bulunamadi.',
    action: 'City Rhythm',
    route: 'CityRhythm',
  },
};

export function getPulseEmptyCopy(activeFilter = 'Tümü') {
  return COPY[activeFilter] || COPY.default;
}
