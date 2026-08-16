-- 105 — COMING city notify-me · şehir teaser (sonMD §12.5 gün-1)
-- cities.status zaten 104'te ACTIVE|COMING

ALTER TABLE cities
  ADD COLUMN IF NOT EXISTS teaser_copy VARCHAR(200),
  ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN cities.teaser_copy IS
  'COMING şehir vitrin metni — "LOCAL henüz şehrinde değil"';
COMMENT ON COLUMN cities.notify_enabled IS
  'COMING şehirde notify-me CTA açık mı';

-- Legacy is_active ↔ status senkron (ACTIVE = is_active true)
UPDATE cities
SET status = CASE WHEN COALESCE(is_active, false) THEN 'ACTIVE' ELSE status END
WHERE status = 'ACTIVE' OR status = 'COMING';

CREATE TABLE IF NOT EXISTS city_notify_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (city_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_city_notify_city
  ON city_notify_requests (city_id);
CREATE INDEX IF NOT EXISTS idx_city_notify_user
  ON city_notify_requests (user_id);

COMMENT ON TABLE city_notify_requests IS
  'COMING şehir talep logu — notify-me; push açılışta kullanılır';
