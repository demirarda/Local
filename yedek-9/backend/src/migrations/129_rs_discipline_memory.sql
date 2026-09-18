-- §5 AT-10 — identity_hash merdiven fotoğrafı (penalty_events taşınır)

ALTER TABLE identity_hashes
  ADD COLUMN IF NOT EXISTS discipline_events JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN identity_hashes.discipline_events IS
  'Son-30g no_show/late_cancel olayları — hesap silinince hash’te, yeniden-doğumda penalty_events’e';
