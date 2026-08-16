# LOCAL — Real-World Social Infrastructure

> "Presence, not Content"

LOCAL is a real-world social infrastructure product that helps users discover and join live, time-sensitive rituals in their city—safely and without the mechanics of social media.

## 🎯 Mission

Create a new category: **presence infrastructure for cities**. Not content platforms. Not event calendars.

## 📱 Project Structure

```
LOCAL/
├── mobile/          # React Native app (iOS + Android)
├── backend/         # Node.js API + WebSocket server
├── shared/          # Shared types and constants
└── docs/            # Documentation
```

## 🚀 Getting Started

### Quick Start (Recommended)

**First-time setup:**
```bash
./scripts/setup-local.sh
```

**Daily development:**
```bash
./scripts/dev.sh
```

**Check system health:**
```bash
./scripts/check-health.sh
```

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (recommended)
- Redis 6+ (recommended)
- Expo CLI (optional, for mobile development)

### Manual Installation

#### Backend

```bash
cd backend
npm install
cp .env.example .env  # Configure your environment
npm run migrate       # Run database migrations
npm run dev
```

#### Mobile App

```bash
cd mobile
npm install
cp .env.example .env  # Configure your environment
npm start
```

### Environment Setup

The setup script will create `.env` files automatically. For manual setup:

**backend/.env:**
- Database connection (DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD)
- Redis connection (REDIS_URL)
- JWT secret (JWT_SECRET)
- Server port (PORT, default: 3000)

**mobile/.env:**
- API base URL (EXPO_PUBLIC_API_BASE_URL)
- WebSocket URL (EXPO_PUBLIC_WS_URL)

## 📚 Documentation

- **[Local Development Guide](./LOCAL_DEVELOPMENT.md)** - Complete setup and development guide ⭐
- [Product Specification](./docs/PRODUCT_SPEC.md) - Full product and UX specification
- [Roadmap](./ROADMAP.md) - Development roadmap and phases
- [API Documentation](./docs/API.md) - Backend API reference

## 🏗️ Development Phases

See [ROADMAP.md](./ROADMAP.md) for detailed development phases.

**Current Phase:** Faz 1 - Technical Infrastructure

## 🛠️ Tech Stack

- **Frontend:** React Native (Expo)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Cache/Real-time:** Redis
- **WebSocket:** Socket.io
- **State Management:** Zustand
- **Navigation:** React Navigation

## 📄 License

ISC

---

**Status:** ✅ MVP Complete - Ready for Development

For detailed local development instructions, see [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
