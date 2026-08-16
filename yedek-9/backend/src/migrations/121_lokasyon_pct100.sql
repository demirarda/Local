-- sonMD Check-In §4 — lokasyon %100 (tarifeli hat, ev düşüşü)
-- TARİFELİ: rota = tek sefer · zone-Aura hat bazlı (route_id → line zone)
-- CUSTOM ev: kimse giremezse kapıda düşer, katılımcı cezasız (is_home)

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS is_home BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS route_id TEXT;

CREATE INDEX IF NOT EXISTS idx_rituals_route_id
  ON rituals (route_id) WHERE route_id IS NOT NULL;

ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS route_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_zones_route_id
  ON zones (route_id) WHERE route_id IS NOT NULL;

COMMENT ON COLUMN rituals.is_home IS '§4 CUSTOM ev — 0 mühürde kapıda düşüş, katılımcı cezasız';
COMMENT ON COLUMN rituals.route_id IS '§4 TARİFELİ hat kimliği — tek sefer, zone-Aura hat bazlı';
COMMENT ON COLUMN zones.route_id IS 'Hat zone — scheduled/ferry Aura kovası';
