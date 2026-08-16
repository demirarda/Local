-- LOCAL v2 §9 — Chip→badge bridge signal store
-- Authority: LOCAL_Cursor_Build_Dokumani_v2-2.md §9
-- Auto-grant gated by badges.CHIP_BRIDGE.enabled (launch: false)

CREATE TABLE IF NOT EXISTS chip_badge_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chip_id VARCHAR(64) NOT NULL,
  pattern_key VARCHAR(80) NOT NULL,
  suggested_badge_slug VARCHAR(80),
  hit_count INT NOT NULL DEFAULT 1,
  status VARCHAR(24) NOT NULL DEFAULT 'observed',
  last_feedback_id UUID,
  last_ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pattern_key),
  CONSTRAINT chk_chip_badge_signal_status
    CHECK (status IN ('observed', 'ready', 'queued', 'dismissed', 'granted'))
);

CREATE INDEX IF NOT EXISTS idx_chip_badge_signals_status
  ON chip_badge_signals (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chip_badge_signals_user
  ON chip_badge_signals (user_id, chip_id);
