# LOCAL - Setup Guide

## Faz 1: Teknik Altyapı Kurulumu

### Gereksinimler

- **Node.js** 18+ ([İndir](https://nodejs.org/))
- **PostgreSQL** 14+ ([İndir](https://www.postgresql.org/download/))
- **Redis** 6+ ([İndir](https://redis.io/download))
- **Expo CLI** (global): `npm install -g expo-cli`

### 1. Proje Yapısı ✅

Proje yapısı oluşturuldu:
```
LOCAL/
├── mobile/          # React Native app
├── backend/         # Node.js API
├── shared/          # Shared types
└── docs/            # Documentation
```

### 2. Backend Kurulumu

```bash
cd backend

# Dependencies yükle
npm install

# Environment dosyasını oluştur
cp .env.example .env

# .env dosyasını düzenle (database, redis, jwt secret)
# nano .env veya code .env
```

**PostgreSQL Database Oluştur:**
```sql
CREATE DATABASE local_db;
```

**Migration Çalıştır:**
```bash
# PostgreSQL'e bağlan ve migration'ı çalıştır
psql -U your_user -d local_db -f src/migrations/001_initial_schema.sql
```

**Redis Başlat:**
```bash
# macOS (Homebrew)
brew services start redis

# Linux
sudo systemctl start redis

# Windows
redis-server
```

**Backend'i Başlat:**
```bash
npm run dev
```

Backend `http://localhost:3000` adresinde çalışacak.

### 3. Mobile App Kurulumu

```bash
cd mobile

# Dependencies yükle
npm install

# Environment dosyasını oluştur
cp .env.example .env

# .env dosyasını düzenle (API_BASE_URL, WS_URL)
```

**Expo Development Server Başlat:**
```bash
npm start
```

Ardından:
- iOS için: `i` tuşuna bas veya QR kodu iOS Expo Go app ile tara
- Android için: `a` tuşuna bas veya QR kodu Android Expo Go app ile tara
- Web için: `w` tuşuna bas

### 4. İlk Test

**Backend Health Check:**
```bash
curl http://localhost:3000/health
```

**Mobile App:**
- Expo Go uygulamasını telefonuna indir
- QR kodu tara
- "LOCAL - Presence, not Content" ekranını görmelisin

### 5. Sonraki Adımlar

Faz 1 tamamlandı! Şimdi:

1. ✅ Proje yapısı hazır
2. ✅ Backend server çalışıyor
3. ✅ Mobile app scaffold hazır
4. ✅ Database schema hazır
5. ✅ WebSocket server hazır

**Faz 2'ye geç:** Pulse ekranını geliştirmeye başla!

---

## Sorun Giderme

### PostgreSQL bağlantı hatası
- PostgreSQL servisinin çalıştığından emin ol
- `.env` dosyasındaki database bilgilerini kontrol et
- Database'in oluşturulduğundan emin ol

### Redis bağlantı hatası
- Redis servisinin çalıştığından emin ol
- `redis-cli ping` komutu ile test et

### Expo bağlantı hatası
- Aynı WiFi ağında olduğundan emin ol
- Firewall ayarlarını kontrol et

### Port çakışması
- Backend port 3000 kullanıyorsa, başka bir port kullan
- `.env` dosyasında `PORT=3001` gibi değiştir
