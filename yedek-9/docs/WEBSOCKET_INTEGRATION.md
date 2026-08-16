# WebSocket Real-time Updates - Entegrasyon Dokümantasyonu

**Tarih:** 02.02.2026  
**Durum:** ✅ Tamamlandı

---

## 🎯 Amaç

LOCAL uygulamasında real-time updates sağlamak için WebSocket (Socket.io) entegrasyonu.

---

## 📦 Backend Implementation

### 1. WebSocket Handlers

**Dosya:** `backend/src/websocket/ritualHandlers.js`

**Fonksiyonlar:**
- `emitRitualUpdate(io, ritualId, updateType, data)` - Ritual güncellemelerini emit eder
- `emitPulseUpdate(io, city)` - Pulse güncellemelerini emit eder
- `handleRitualSubscribe(socket, ritualId)` - Ritual subscription handler
- `handleRitualUnsubscribe(socket, ritualId)` - Ritual unsubscribe handler
- `handlePulseSubscribe(socket, city)` - Pulse subscription handler
- `handlePulseUnsubscribe(socket, city)` - Pulse unsubscribe handler

**Update Types:**
- `status_change` - Ritual status değişikliği
- `attendance_update` - Attendance count güncellemesi
- `new_ritual` - Yeni ritual oluşturuldu

---

### 2. API Integration

**Dosya:** `backend/src/api/rituals.js`

**WebSocket Emit'leri:**

#### Ritual Oluşturma (POST /api/rituals)
```javascript
// Yeni ritual oluşturulduğunda pulse update emit edilir
emitPulseUpdate(req.io, hostCity);
```

#### Ritual'e Katılma (POST /api/rituals/:id/join)
```javascript
// Attendance update emit edilir
emitRitualUpdate(req.io, ritualId, 'attendance_update', {
  current_attendees: count,
  capacity: ritual.capacity
});

// Pulse update emit edilir
emitPulseUpdate(req.io, city);
```

---

### 3. Server Setup

**Dosya:** `backend/src/index.js`

**WebSocket Events:**
- `ritual:subscribe` - Ritual'e subscribe ol
- `ritual:unsubscribe` - Ritual'den unsubscribe ol
- `pulse:subscribe` - Pulse'a subscribe ol (city-based)
- `pulse:unsubscribe` - Pulse'dan unsubscribe ol

**Emitted Events:**
- `ritual:update` - Ritual güncellemesi
- `ritual:state` - Ritual mevcut state'i
- `pulse:update` - Pulse güncellemesi

---

## 📱 Mobile App Implementation

### 1. WebSocket Service

**Dosya:** `mobile/src/services/websocket.js`

**Özellikler:**
- Singleton pattern
- Auto-reconnection
- Event listener management
- Connection state tracking

**Methods:**
- `connect()` - WebSocket bağlantısı kur
- `disconnect()` - Bağlantıyı kapat
- `subscribeToRitual(ritualId)` - Ritual'e subscribe ol
- `unsubscribeFromRitual(ritualId)` - Ritual'den unsubscribe ol
- `subscribeToPulse(city)` - Pulse'a subscribe ol
- `unsubscribeFromPulse(city)` - Pulse'dan unsubscribe ol
- `on(event, callback)` - Event listener ekle
- `off(event, callback)` - Event listener kaldır

---

### 2. Pulse Screen Integration

**Dosya:** `mobile/src/screens/PulseScreen.js`

**Entegrasyon:**
```javascript
useEffect(() => {
  // Connect WebSocket
  websocketService.connect();
  
  // Subscribe to pulse updates
  websocketService.subscribeToPulse(city);

  // Listen for pulse updates
  const handlePulseUpdate = () => {
    loadRituals(); // Refresh ritual list
  };

  websocketService.on('pulse:update', handlePulseUpdate);

  return () => {
    websocketService.off('pulse:update', handlePulseUpdate);
    websocketService.unsubscribeFromPulse(city);
  };
}, [city]);
```

**Özellikler:**
- Real-time pulse updates
- Otomatik refresh when new rituals created
- Otomatik refresh when attendance changes

---

### 3. Ritual Detail Screen Integration

**Dosya:** `mobile/src/screens/RitualDetailScreen.js`

**Entegrasyon:**
```javascript
useEffect(() => {
  // Connect WebSocket
  websocketService.connect();

  // Subscribe to ritual updates
  websocketService.subscribeToRitual(ritualId);

  // Listen for ritual updates
  const handleRitualUpdate = (data) => {
    if (data.updateType === 'attendance_update') {
      // Update attendance count in real-time
      setRitual(prev => ({
        ...prev,
        current_attendees: data.data.current_attendees
      }));
    }
  };

  websocketService.on('ritual:update', handleRitualUpdate);

  return () => {
    websocketService.off('ritual:update', handleRitualUpdate);
    websocketService.unsubscribeFromRitual(ritualId);
  };
}, [ritualId]);
```

**Özellikler:**
- Real-time attendance count updates
- Ritual state updates
- Otomatik UI refresh

---

## 🔄 Real-time Update Flow

### Senaryo 1: Yeni Ritual Oluşturuldu

1. Host yeni ritual oluşturur (POST /api/rituals)
2. Backend pulse update emit eder
3. Tüm pulse subscribers (o şehirdeki) update alır
4. Pulse screen otomatik refresh edilir

### Senaryo 2: Kullanıcı Ritual'e Katıldı

1. Kullanıcı ritual'e join olur (POST /api/rituals/:id/join)
2. Backend iki update emit eder:
   - `ritual:update` (ritual subscribers için)
   - `pulse:update` (pulse subscribers için)
3. Ritual detail screen attendance count'u günceller
4. Pulse screen refresh edilir

### Senaryo 3: Ritual Status Değişti

1. Ritual status değişir (ör: upcoming → live)
2. Backend `ritual:update` emit eder
3. Ritual subscribers update alır
4. UI otomatik güncellenir

---

## 🧪 Test Senaryoları

### Test 1: Pulse Real-time Update
1. Pulse screen'i aç
2. Başka bir client'tan yeni ritual oluştur
3. Pulse screen otomatik refresh olmalı

### Test 2: Attendance Real-time Update
1. Ritual detail screen'i aç
2. Başka bir client'tan join ol
3. Attendance count otomatik güncellenmeli

### Test 3: Connection Recovery
1. WebSocket bağlantısını kes
2. Bağlantı otomatik yeniden kurulmalı
3. Subscriptions korunmalı

---

## 📝 Notlar

### Connection Management
- WebSocket service singleton pattern kullanıyor
- Auto-reconnection enabled
- Connection state tracking var

### Event Cleanup
- useEffect cleanup'larında event listener'lar kaldırılıyor
- Memory leak'leri önlemek için önemli

### Error Handling
- Connection errors loglanıyor
- Reconnection attempts var
- Graceful degradation (WebSocket yoksa polling fallback)

---

## 🚀 Sonraki İyileştirmeler

1. ⏳ Authentication token WebSocket'te
2. ⏳ Rate limiting WebSocket events için
3. ⏳ Message queuing (offline support)
4. ⏳ Compression (büyük payload'lar için)
5. ⏳ Heartbeat/ping mechanism

---

**Entegrasyon Durumu:** ✅ **TAMAMLANDI**

**Test Durumu:** ⏳ Test edilmeli
