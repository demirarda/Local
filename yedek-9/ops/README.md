# LOCAL Ops Portal

Jira tarzı yürütme koordinasyon paneli — host, mekan, tasarım ve geliştirme görevleri.

Ürün admin panelinden (`backend/admin`) **tamamen ayrıdır**.

## Yapı

| Klasör | Port | Açıklama |
|--------|------|----------|
| `ops-api/` | 3001 | REST API (`/api/ops/*`) |
| `ops-portal/` | 5173 | React Kanban UI |

## Kurulum

### 1. Veritabanı (aynı Postgres, `ops` şeması)

```bash
cd ops-api
cp .env.example .env
# .env içinde backend ile aynı DB bilgilerini kullanın
npm install
npm run migrate
npm run seed
```

Seed varsayılan giriş:
- **E-posta:** `ops@local.dev`
- **Şifre:** `OpsLocal2026!`

### 2. API

```bash
cd ops-api
npm run dev
# http://localhost:3001/health
```

### 3. Portal

```bash
cd ops-portal
npm install
npm run dev
# http://localhost:5173
```

## Özellikler

### Faz 1
- Ops kullanıcı girişi (`ops.ops_users`)
- Proje listesi + Kanban (sürükle-bırak)
- Görev CRUD, yorum, bağlantılar
- Örnek proje: **LOCAL Milano Launch**

### Faz 3 — Rol bazlı modüller

| Rol | Görür | Varsayılan sayfa |
|-----|--------|------------------|
| **founder / pm** | Her şey | `/dashboard` |
| **host_lead** | Hostlar, köprü, kanban | `/hosts` |
| **venue_lead** | Mekanlar, köprü, kanban | `/venues` |
| **designer** | Ekranlar (tasarım sütunu) | `/screens` |
| **developer** | Ekranlar (dev sütunu) | `/screens` |

**Hostlar** (`/hosts`): pipeline durumu, ritüel sayısı (uygulamadan senkron), host geri bildirimi alanı.

**Mekanlar** (`/venues`): hedef · görüşmede · anlaşılan · olumsuz — sürükle-bırak kolonlar.

**Ekranlar** (`/screens`): hedef ekranlar, tasarım/dev durumu (rol bazlı düzenleme).

Demo kullanıcılar: `npm run seed:roles` (şifre hepsi `OpsLocal2026!`)

### Faz 2
- **Spec import:** Projede "Spec eksiklerini içe aktar" veya CLI `npm run import:spec`
- **Ekip:** `/team` — üye listesi + davet (pm/founder)
- **Köprü:** `/bridge` — production host/mekan arama + görev aç
- **Dosya ekleri:** Görev detayında upload (yerel `ops-api/uploads/`)

## Spec import (CLI)

```bash
cd ops-api
npm run import:spec -- "LOCAL Milano Launch" canon
# veya markdown checklist'ten:
npm run import:spec -- "LOCAL Milano Launch" markdown
```

## Ortam değişkenleri

`ops-api/.env`:
- `OPS_JWT_SECRET` — production JWT'den **farklı** olmalı
- `CORS_ORIGIN=http://localhost:5173`
- `OPS_PUBLIC_URL=http://localhost:3001` (dosya URL'leri için)

## Sonraki fazlar

- Sprint / etiket
- S3 dosya depolama
- Slack/e-posta bildirimleri
