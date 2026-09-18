# LOCAL Product Ops

Rol kapılı yönetim. `ADMIN_EMAILS` / `ADMIN_USER_IDS` **founder yapmaz** — yalnız mekan paneli override (opsiyonel).

## Roller (`.env`, virgülle)

| Env | Rol | Ne yapar |
|---|---|---|
| `FOUNDER_EMAILS` / `FOUNDER_USER_IDS` | founder | Config, L3/L4, brand, hub’ın hepsi |
| `OPS_MODERATOR_EMAILS` / `OPS_MODERATOR_USER_IDS` | moderator | MOD kuyruğu L0–L2; başvuru onayı yok |
| `OPS_VENUE_OPS_EMAILS` / `OPS_VENUE_OPS_USER_IDS` | venue_ops | Başvuru onay, pin, nominasyon |
| `OPS_SUPPORT_EMAILS` / `OPS_SUPPORT_USER_IDS` | support | Arama + not; onay/ceza yok |
| `OPS_READONLY_EMAILS` / `OPS_READONLY_USER_IDS` | read_only | Nabız; yazma yok |
| `ADMIN_EMAILS` / `ADMIN_USER_IDS` | — | Mekan paneli override. Ops rolü değil. |

Aynı kişi birden fazla listede olabilir; **founder listesi kazanır**, sonra moderator → venue_ops → support → read_only.

## Erişim

1. Backend: **http://localhost:3000/admin/hub.html**
2. LOCAL hesabı (email + şifre) — yukarıdaki listelerden birinde olmalı.
3. Hub menüsü `GET /api/admin/me` ile role göre kesilir. MOD: `/admin/mod.html`.

## Veritabanı

- Migration 021: `reports.action_note`
- Migration 027: `rs_history`, `report_templates` — `npm run migrate`
