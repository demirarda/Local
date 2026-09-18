-- VIES sonuç alanları (başvuru) + web panel / belge yükleme desteği

ALTER TABLE venue_applications
  ADD COLUMN IF NOT EXISTS vies_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS vies_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vies_error TEXT;

COMMENT ON COLUMN venue_applications.vies_ok IS 'AB VIES sonucu; AB dışı null + proof_url';
COMMENT ON COLUMN venue_applications.proof_url IS 'İşletme belgesi (PDF/foto) — VIES yoksa zorunlu';
