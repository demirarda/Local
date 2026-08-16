# LOCAL - Local Development Guide

Bu doküman, LOCAL projesini local ortamda geliştirmek için gerekli tüm adımları içerir.

## 🚀 Hızlı Başlangıç

### İlk Kurulum (Tek Seferlik)

```bash
# Proje root dizininde
./scripts/setup-local.sh
```

Bu script:
- ✅ Backend ve mobile dependencies'leri yükler
- ✅ `.env` dosyalarını oluşturur
- ✅ Database oluşturmayı önerir
- ✅ Migration'ları çalıştırmayı önerir

### Günlük Geliştirme

**Seçenek 1: Otomatik (Önerilen)**
```bash
./scripts/dev.sh
```

Bu script hem backend hem mobile'ı başlatır.

**Seçenek 2: Manuel**
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Mobile
cd mobile
npm start
```

### Sistem Durumu Kontrolü

```bash
./scripts/check-health.sh
```

Bu script tüm servislerin durumunu kontrol eder:
- PostgreSQL
- Redis
- Backend API
- Environment dosyaları
- Dependencies

---

## 📋 Gereksinimler

### Zorunlu
- **Node.js** 18+ ([İndir](https://nodejs.org/))
- **npm** (Node.js ile birlikte gelir)

### Önerilen
- **PostgreSQL** 14+ ([İndir](https://www.postgresql.org/download/))
- **Redis** 6+ ([İndir](https://redis.io/download))
- **Expo CLI** (opsiyonel): `npm install -g expo-cli`

---

## 🔧 Detaylı Kurulum

### 1. PostgreSQL Kurulumu

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Database Oluştur:**
```bash
psql -U $(whoami) -d postgres -c "CREATE DATABASE local_db;"
```

**Kontrol:**
```bash
pg_isready
psql -U $(whoami) -d local_db -c "SELECT 1;"
```

### 2. Redis Kurulumu

**macOS (Homebrew):**
```bash
brew install redis
brew services start redis
```

**Kontrol:**
```bash
redis-cli ping
# Beklenen çıktı: PONG
```

### 3. Backend Kurulumu

```bash
cd backend

# Dependencies yükle
npm install

# .env dosyasını oluştur
cp .env.example .env

# .env dosyasını düzenle (database credentials)
# nano .env veya code .env

# Migration'ları çalıştır
npm run migrate

# Backend'i başlat
npm run dev
```

Backend `http://localhost:3000` adresinde çalışacak.

**Health Check:**
```bash
curl http://localhost:3000/health
```

### 4. Mobile App Kurulumu

```bash
cd mobile

# Dependencies yükle
npm install

# .env dosyasını oluştur
cp .env.example .env

# .env dosyasını düzenle (gerekirse)
# Fiziksel cihaz kullanıyorsan Mac'in local IP'sini ekle

# Expo'yu başlat
npm start
```

**Fiziksel Cihaz İçin:**
1. Mac'inizin local IP adresini bulun:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
2. `mobile/.env` dosyasını düzenleyin:
   ```bash
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.XXX:3000/api
   EXPO_PUBLIC_WS_URL=http://192.168.1.XXX:3000
   ```

---

## 🗄️ Database Migration

### Migration Çalıştırma

```bash
cd backend
npm run migrate
```

### Yeni Migration Ekleme

1. `backend/src/migrations/` klasörüne yeni SQL dosyası ekle
2. Dosya adı formatı: `018_description.sql`
3. Migration script otomatik olarak sırayla çalıştırır

### Migration Sırası

Migrations şu sırayla çalışır:
1. `001_initial_schema.sql` - Temel şema
2. `002_chat_memory_schema.sql` - Chat ve memory
3. `003_safety_antigaming_schema.sql` - Güvenlik
4. `004_bc3_trend_schema.sql` - BC3 trend
5. `005_bc3_fix_delta_before.sql` - BC3 fix
6. `006_diversity_state_schema.sql` - Diversity
7. `007_follow_system_schema.sql` - Follow sistemi
8. `008_notifications_schema.sql` - Bildirimler
9. `009_vibe_pills_schema.sql` - Vibe pills
10. `010_spotify_playlist_schema.sql` - Spotify
11. `011_verification_schema.sql` - Verification
12. `012_user_settings_schema.sql` - Settings
13. `013_user_interests_schema.sql` - Interests
14. `014_add_cancelled_status.sql` - Cancelled status
15. `015_ritual_advanced_fields.sql` - Advanced fields
16. `016_add_auth_fields.sql` - Auth fields
17. `017_ritual_invites_schema.sql` - Invites

---

## 🧪 Test

### Backend Testleri

```bash
cd backend
npm test
```

### API Test

```bash
# Health check
curl http://localhost:3000/health

# API info
curl http://localhost:3000/api
```

---

## 🔍 Sorun Giderme

### PostgreSQL Bağlantı Hatası

**Problem:** `Database connection failed`

**Çözüm:**
1. PostgreSQL çalışıyor mu?
   ```bash
   pg_isready
   ```
2. Database var mı?
   ```bash
   psql -U $(whoami) -d local_db -c "SELECT 1;"
   ```
3. `.env` dosyasında credentials doğru mu?
   ```bash
   cat backend/.env | grep DB_
   ```

### Redis Bağlantı Hatası

**Problem:** `Redis Client Error`

**Çözüm:**
1. Redis çalışıyor mu?
   ```bash
   redis-cli ping
   ```
2. Redis'i başlat:
   ```bash
   brew services start redis
   ```

### Backend Başlamıyor

**Problem:** Port 3000 zaten kullanılıyor

**Çözüm:**
```bash
# Port'u kullanan process'i bul
lsof -i :3000

# Process'i durdur
kill -9 <PID>

# Veya farklı port kullan
PORT=3001 npm run dev
```

### Mobile App Bağlanamıyor

**Problem:** `Network request failed`

**Çözüm:**
1. Backend çalışıyor mu?
   ```bash
   curl http://localhost:3000/health
   ```
2. `.env` dosyasında URL doğru mu?
   ```bash
   cat mobile/.env
   ```
3. Fiziksel cihaz kullanıyorsan Mac'in IP'si doğru mu?
4. Firewall Mac'in port 3000'i engelliyor mu?

### Migration Hataları

**Problem:** `relation already exists`

**Çözüm:**
- Bu normal, migration zaten uygulanmış demektir
- Script otomatik olarak skip eder

**Problem:** `syntax error`

**Çözüm:**
1. SQL dosyasını kontrol et
2. PostgreSQL versiyonunu kontrol et (14+ gerekli)

---

## 📁 Proje Yapısı

```
LOCAL/
├── backend/
│   ├── src/
│   │   ├── api/          # REST API endpoints
│   │   ├── services/     # Business logic
│   │   ├── config/       # Database, Redis config
│   │   ├── migrations/    # Database migrations
│   │   └── websocket/    # WebSocket handlers
│   ├── scripts/          # Utility scripts
│   ├── .env.example      # Environment template
│   └── package.json
├── mobile/
│   ├── src/
│   │   ├── screens/      # App screens
│   │   ├── components/   # UI components
│   │   ├── services/     # API, WebSocket clients
│   │   └── navigation/   # Navigation config
│   ├── .env.example      # Environment template
│   └── package.json
├── scripts/               # Project-level scripts
│   ├── setup-local.sh    # Initial setup
│   ├── dev.sh            # Start both servers
│   └── check-health.sh   # Health check
└── docs/                 # Documentation
```

---

## 🛠️ Yararlı Komutlar

### Database

```bash
# Database'e bağlan
psql -U $(whoami) -d local_db

# Tüm tabloları listele
psql -U $(whoami) -d local_db -c "\dt"

# Tablo yapısını görüntüle
psql -U $(whoami) -d local_db -c "\d table_name"
```

### Redis

```bash
# Redis CLI'ye bağlan
redis-cli

# Tüm key'leri listele
redis-cli KEYS "*"

# Key'i sil
redis-cli DEL key_name
```

### Backend

```bash
# Backend loglarını izle
tail -f /tmp/local-backend.log

# Backend'i restart et
# Ctrl+C ile durdur, sonra tekrar başlat
```

### Mobile

```bash
# Expo cache'i temizle
cd mobile
npx expo start --clear

# Metro bundler'ı resetle
npx expo start --reset-cache
```

---

## 📚 Ek Kaynaklar

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)

---

## 💡 İpuçları

1. **Hot Reload:** Backend'de nodemon, mobile'da Expo otomatik reload yapar
2. **Logs:** Backend logları terminal'de, mobile logları Expo DevTools'da
3. **Debugging:** React Native Debugger veya Chrome DevTools kullan
4. **Performance:** `./scripts/check-health.sh` ile sistem durumunu kontrol et

---

**Son Güncelleme:** 2026  
**Versiyon:** 1.1
