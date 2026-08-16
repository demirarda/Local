# LOCAL v2.0 — Open items (🔓)

Absolute-100 B kilidi: 2026-08-12. Ürün/config kilitleri kapandı; canlı vendor yalnız env secret bekler.

| # | Item | Config / code | Status |
|---|------|---------------|--------|
| 1 | Chip METİNLERİ + [fiyat] simetri | `chipCopyStubs.js` locked 2026-08-10 | **done** |
| 2 | Kompakt bant çarpanı | `SIZE_MULT: 0.7` · `compact_band_approved` + locked_at | **done** |
| 2b | Takeover formülü | `TAKEOVER_FORMULA` weekday 0.30 / weekend+friday 0.50 | **done** |
| 2c | Kilitli Pazar Payı teaser | OPERATÖR İtibar'da blur+kilit | **done** |
| 3 | KYC sağlayıcı (Techsign/İHS) | `ACTIVE_PROVIDER:'stub'` · HTTP adapter hazır | **env** — key + DPA ile live |
| 4 | Kalan kelime kilitleri | `stringTable.js` open:false | **done** |
| 5 | Push default founder temizliği | `PUSH_DEFAULTS` kilitli | **done** |
| 6 | Nudity/CSAM tarama sağlayıcısı | hold + `csamScanner` | **ürün done** · canlı scanner **env** |
| 6b | Stripe venue paket ödemesi | Checkout + webhook | **ürün done** · key **env** |
| 7 | Paket satış-tetik eşikleri | `TRIGGER` / `sales_trigger_thresholds` = 5/20/15 | **done** |
| 8 | Chip→badge köprüsü | `CHIP_BRIDGE.enabled:true` · map kilitli | **done** |

Authority: sonMD Cursor Build Dokümanı v3 §19 · absolute-100 B.

---

## Canlı env (ürün tamam — secret bekler)

**KYC:** `KYC_PROVIDER` + `KYC_*_BASE_URL` + `API_KEY` (+ webhook) → `GET /api/identity/live-readiness`

**CSAM:** `CSAM_SCAN_WEBHOOK_URL` veya `CSAM_PROVIDER=sightengine` + keys → `GET /api/mod/csam-readiness`

**Stripe:** `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` → `GET /api/venues/payment-readiness`
