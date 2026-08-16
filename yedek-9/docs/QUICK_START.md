# LOCAL - Hızlı Başlangıç

## ✅ Backend Çalışıyor!

Backend şu anda çalışıyor ve hazır:
- **URL:** http://localhost:3000
- **Health:** ✅
- **WebSocket:** ✅

---

## 📱 Mobile App'i Başlat

### Yöntem 1: Normal Expo (Önerilen)

Terminal'de şu komutu çalıştırın:

```bash
cd mobile
npx expo start
```

Sonra:
- **iOS için:** Terminal'de `i` tuşuna basın
- **Android için:** Terminal'de `a` tuşuna basın
- **QR Code:** Expo Go app ile QR code'u tarayın

### Yöntem 2: Web Browser

```bash
cd mobile
npx expo start --web
```

Tarayıcıda `http://localhost:8081` açılacak.

---

## 🧪 Backend API Test

Backend API'leri test etmek için:

```bash
# Health check
curl http://localhost:3000/health

# Pulse rituals
curl "http://localhost:3000/api/rituals/pulse?city=Istanbul"

# Categories
curl http://localhost:3000/api/city-rhythm/categories

# Ritual detail (ID'yi değiştirin)
curl http://localhost:3000/api/rituals/<ritual-id>
```

---

## ⚠️ Sorun Giderme

### "EMFILE: too many open files"

**Çözüm:**
```bash
# File descriptor limit artır
ulimit -n 10240

# Watchman temizle
watchman shutdown-server
watchman watch-del-all

# Tekrar başlat
cd mobile
npx expo start
```

### Backend Bağlantı Hatası

Backend'in çalıştığını kontrol edin:
```bash
curl http://localhost:3000/health
```

Eğer çalışmıyorsa:
```bash
cd backend
npm run dev
```

---

## 📝 Notlar

- Backend logları: `tail -f /tmp/backend.log`
- Expo Metro: `http://localhost:8081`
- Backend API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000`

---

**Hazır!** 🎉
