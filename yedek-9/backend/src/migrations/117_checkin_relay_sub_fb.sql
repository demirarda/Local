-- Check-in kalan %3: dijital relay proximity + EVENT sub multi-presence FB
ALTER TABLE ritual_local_checkin_tags
  ADD COLUMN IF NOT EXISTS issuer_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS issuer_lng DOUBLE PRECISION;

COMMENT ON COLUMN ritual_local_checkin_tags.issuer_lat IS
  'LOCAL-TAG üretildiği anda issuer mühür GPS — redeem proximity için';

-- Aynı sub'da birden fazla mühürlü eşzamanlı oturabilir (FB zaman-kesişimi)
DROP INDEX IF EXISTS ux_event_sub_seals_active;
CREATE UNIQUE INDEX IF NOT EXISTS ux_event_sub_seals_user_active
  ON ritual_event_sub_seals (ritual_id, sub_id, actor_user_id)
  WHERE out_ts IS NULL;

COMMENT ON INDEX ux_event_sub_seals_user_active IS
  'sonMD §4: aynı sub zaman-kesişen masadaşlar — kişi başına tek aktif varlık';
