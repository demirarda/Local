-- Post-F6: venue isletme paket stub alanlari — son-part.md §14

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS package_stub JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN venues.package_stub IS 'Isletme paket stub (tasarim bekliyor) — vitrine disi yonetici notlari';
