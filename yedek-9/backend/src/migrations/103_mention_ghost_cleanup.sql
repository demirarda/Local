-- 103 — mention table · ghost_mode deprecate (sonMD: Ghost yok)
CREATE TABLE IF NOT EXISTS content_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(32) NOT NULL,
  source_id UUID NOT NULL,
  ritual_id UUID,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_mentions_src_to
  ON content_mentions (source_type, source_id, to_user_id)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_mentions_to
  ON content_mentions (to_user_id, created_at DESC)
  WHERE removed_at IS NULL;

COMMENT ON TABLE content_mentions IS
  'sonMD §7 mention — masa/arkadaş/hiçbiri; reach-farming limitlenir';

-- Ghost özelliği kaldırıldı: mevcut true değerleri kapat
UPDATE users SET ghost_mode = false WHERE ghost_mode = true;
