# LOCAL Projesi - Kullanılan Teknolojiler

**Tarih:** 2026  
**Versiyon:** v1.1

---

## 📦 Backend Teknolojileri

### Core Framework
- **Node.js** - JavaScript runtime environment
- **Express.js 4.18.2** - REST API framework
- **ES Modules** - Modern JavaScript module system (`"type": "module"`)

### Veritabanı ve Cache
- **PostgreSQL** - Ana ilişkisel veritabanı
  - **pg 8.11.3** - PostgreSQL client library
  - **PostgreSQL 14+** - Veritabanı versiyonu gereksinimi
- **Redis 4.6.12** - In-memory cache ve real-time veri yönetimi
  - **Redis 6+** - Redis versiyonu gereksinimi

### Real-time İletişim
- **Socket.io 4.6.1** - WebSocket sunucusu (real-time güncellemeler için)

### Güvenlik ve Middleware
- **Helmet 7.1.0** - HTTP header güvenliği
- **CORS 2.8.5** - Cross-Origin Resource Sharing
- **express-rate-limit 7.1.5** - API rate limiting
- **jsonwebtoken 9.0.2** - JWT authentication
- **bcryptjs 2.4.3** - Şifre hashleme

### Background Jobs ve Scheduling
- **Bull 4.12.0** - Job queue sistemi (Redis tabanlı)
- **node-cron 3.0.3** - Zamanlanmış görevler (cron jobs)

### Utilities
- **dotenv 16.3.1** - Environment variables yönetimi

### Development Tools
- **nodemon 3.0.2** - Auto-restart development server
- **Jest 29.7.0** - Testing framework

---

## 📱 Mobile App Teknolojileri

### Core Framework
- **React Native 0.81.5** - Cross-platform mobile framework
- **React 19.1.0** - UI library
- **Expo ~54.0.33** - Development platform ve tooling

### Navigation
- **@react-navigation/native 6.1.9** - Navigation core library
- **@react-navigation/stack 6.3.20** - Stack navigator
- **@react-navigation/bottom-tabs 6.5.11** - Bottom tab navigator
- **react-native-screens 4.16.0** - Native screen optimizasyonu
- **react-native-gesture-handler ~2.28.0** - Gesture handling
- **react-native-safe-area-context ~5.6.0** - Safe area handling

### State Management
- **Zustand 4.4.7** - Lightweight state management library

### Networking
- **axios 1.6.2** - HTTP client
- **socket.io-client 4.6.1** - WebSocket client

### Expo Modules
- **expo-location ~19.0.8** - Konum servisleri
- **expo-notifications ~0.32.16** - Push notifications
- **expo-linear-gradient ~15.0.8** - Gradient component
- **expo-asset ~12.0.12** - Asset yönetimi
- **expo-status-bar ~3.0.9** - Status bar kontrolü
- **@expo/metro-runtime ~6.1.2** - Metro bundler runtime

### Storage ve Utilities
- **@react-native-async-storage/async-storage 2.2.0** - Local storage
- **@react-native-community/netinfo 11.4.1** - Network bilgisi
- **memoize-one 6.0.0** - Memoization utility

### Web Support
- **react-native-web ^0.21.0** - Web platform desteği
- **react-dom 19.1.0** - React DOM

### Development Tools
- **@babel/core ^7.20.0** - Babel transpiler
- **TypeScript 5.1.3** - Type checking (dev dependency)
- **@types/react ~19.1.10** - React type definitions
- **Metro** - JavaScript bundler (Expo ile birlikte gelir)

---

## 🗄️ Altyapı ve Servisler

### Veritabanı
- **PostgreSQL 14+** - Ana veritabanı
- **Redis 6+** - Cache ve job queue

### Runtime Gereksinimleri
- **Node.js 18+** - Backend runtime
- **npm** - Paket yöneticisi

---

## 🏗️ Mimari Özellikler

### Backend
- **RESTful API** - Express.js ile REST endpoints
- **WebSocket Server** - Socket.io ile real-time iletişim
- **Job Queue** - Bull ile async işlem yönetimi
- **Rate Limiting** - API koruması
- **Security Middleware** - Helmet, CORS, JWT

### Mobile
- **Cross-platform** - iOS ve Android desteği
- **Real-time Updates** - WebSocket entegrasyonu
- **Offline Support** - AsyncStorage ile local storage
- **Push Notifications** - Expo Notifications
- **Location Services** - Expo Location

---

## 📊 Teknoloji Stack Özeti

| Kategori | Teknoloji |
|----------|-----------|
| **Backend Framework** | Node.js + Express.js |
| **Database** | PostgreSQL |
| **Cache/Queue** | Redis + Bull |
| **Real-time** | Socket.io |
| **Mobile Framework** | React Native + Expo |
| **State Management** | Zustand |
| **Navigation** | React Navigation |
| **HTTP Client** | Axios |
| **Authentication** | JWT (jsonwebtoken) |
| **Security** | Helmet, bcryptjs, rate-limit |
| **Testing** | Jest |
| **Build Tool** | Metro (Expo) |
| **Language** | JavaScript (ES Modules) |

---

## 🎯 Öne Çıkan Özellikler

1. **Modern JavaScript** - ES Modules kullanımı
2. **Real-time** - Socket.io ile anlık güncellemeler
3. **Cross-platform** - React Native ile tek kod tabanı
4. **Scalable** - Bull job queue ile async işlemler
5. **Secure** - Güvenlik middleware'leri
6. **Developer-friendly** - Expo ile hızlı geliştirme

---

## 📝 Versiyon Bilgileri

### Backend Dependencies
```
express: ^4.18.2
socket.io: ^4.6.1
pg: ^8.11.3
redis: ^4.6.12
dotenv: ^16.3.1
cors: ^2.8.5
helmet: ^7.1.0
express-rate-limit: ^7.1.5
jsonwebtoken: ^9.0.2
bcryptjs: ^2.4.3
bull: ^4.12.0
node-cron: ^3.0.3
```

### Mobile Dependencies
```
react: 19.1.0
react-native: 0.81.5
expo: ~54.0.33
@react-navigation/native: ^6.1.9
@react-navigation/stack: ^6.3.20
@react-navigation/bottom-tabs: ^6.5.11
axios: ^1.6.2
socket.io-client: ^4.6.1
zustand: ^4.4.7
expo-location: ~19.0.8
expo-notifications: ~0.32.16
```

---

## 🔧 Kurulum Gereksinimleri

### Minimum Gereksinimler
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- npm veya yarn
- Expo CLI (mobile için)

### Geliştirme Ortamı
- macOS, Linux veya Windows
- Code editor (VS Code önerilir)
- Git

---

**Son Güncelleme:** 2026  
**Proje Versiyonu:** v1.1 Complete
