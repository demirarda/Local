# LOCAL Uygulamasını Çalıştırma

## 🚀 Hızlı Başlangıç

### 1. Backend'i Başlat

```bash
cd backend
npm install  # İlk kez çalıştırıyorsanız
npm run dev
```

Backend `http://localhost:3000` adresinde çalışacak.

### 2. Mobile App'i Başlat

#### Seçenek A: Expo Go (Önerilen - Telefon/Tablet)

1. **Expo Go** uygulamasını indirin:
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Terminal'de mobile klasörüne gidin:
   ```bash
   cd mobile
   ```

3. Expo'yu başlatın:
   ```bash
   npx expo start
   ```

4. QR code'u Expo Go ile tarayın veya:
   - iOS için: Terminal'de `i` tuşuna basın
   - Android için: Terminal'de `a` tuşuna basın

#### Seçenek B: Web Browser

```bash
cd mobile
npx expo start --web
```

Tarayıcıda `http://localhost:8081` açılacak.

#### Seçenek C: iOS Simulator (macOS only)

```bash
cd mobile
npx expo start --ios
```

#### Seçenek D: Android Emulator

```bash
cd mobile
npx expo start --android
```

---

## ⚠️ Sorun Giderme

### "EMFILE: too many open files" Hatası

**Çözüm 1: Watchman Kurulumu (Önerilen)**
```bash
brew install watchman
```

**Çözüm 2: File Descriptor Limit Artırma**
```bash
ulimit -n 4096
```

**Çözüm 3: .gitignore Kontrolü**
- `mobile/.gitignore` dosyasının doğru yapılandırıldığından emin olun
- `node_modules/` ve `.expo/` ignore edilmeli

### Backend Bağlantı Hatası

1. Backend'in çalıştığını kontrol edin:
   ```bash
   curl http://localhost:3000/health
   ```

2. Environment variables kontrol edin:
   - `backend/.env` dosyası mevcut mu?
   - `API_BASE_URL` doğru mu? (default: `http://localhost:3000/api`)

### Database Bağlantı Hatası

1. PostgreSQL çalışıyor mu?
   ```bash
   brew services list | grep postgresql
   ```

2. Database var mı?
   ```bash
   psql -U $(whoami) -d local_db -c "SELECT 1;"
   ```

---

## 📱 Uygulama Özellikleri

### Pulse Screen
- Real-time ritual listesi
- Time state grouping
- Pull-to-refresh

### City Rhythm
- Browse rituals
- Search functionality
- Category filters

### Social Passport
- User profile
- RS score display
- Friends list
- Recent rituals

### Live Ritual
- Chat functionality
- Host announcements
- Memories
- Emergency exit

---

## 🔗 API Endpoints

Backend API'leri test etmek için:

```bash
# Health check
curl http://localhost:3000/health

# Pulse rituals
curl http://localhost:3000/api/rituals/pulse?city=Istanbul

# Categories
curl http://localhost:3000/api/city-rhythm/categories
```

---

## 📝 Notlar

- Backend logları: `tail -f /tmp/backend.log`
- Expo Metro bundler: `http://localhost:8081`
- Backend API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

---

**Hazır!** 🎉
