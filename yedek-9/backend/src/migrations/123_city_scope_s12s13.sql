-- §12.5 — zones/memories city_id denormalize (gün-1 şehir mimarisi)
-- Authority: LOCAL_Cursor_Build_Dokumani_v3.md satır 354

ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);

CREATE INDEX IF NOT EXISTS idx_zones_city_id ON zones (city_id);

UPDATE zones z
SET city_id = sub.city_id
FROM (
  SELECT DISTINCT ON (r.zone_id) r.zone_id, r.city_id
  FROM rituals r
  WHERE r.zone_id IS NOT NULL AND r.city_id IS NOT NULL
  ORDER BY r.zone_id, r.start_time DESC NULLS LAST
) sub
WHERE z.id = sub.zone_id
  AND z.city_id IS NULL;

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES cities(id);

CREATE INDEX IF NOT EXISTS idx_memories_city_id ON memories (city_id);

UPDATE memories m
SET city_id = r.city_id
FROM rituals r
WHERE m.ritual_id = r.id
  AND m.city_id IS NULL
  AND r.city_id IS NOT NULL;

CREATE OR REPLACE FUNCTION stamp_memory_city_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.city_id IS NULL AND NEW.ritual_id IS NOT NULL THEN
    SELECT city_id INTO NEW.city_id FROM rituals WHERE id = NEW.ritual_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_memories_stamp_city ON memories;
CREATE TRIGGER trg_memories_stamp_city
  BEFORE INSERT OR UPDATE OF ritual_id ON memories
  FOR EACH ROW
  EXECUTE FUNCTION stamp_memory_city_id();

-- §13 badge yaklaşımı launch default: sahibe push açık
ALTER TABLE user_settings
  ALTER COLUMN notify_badge_approaching SET DEFAULT true;

UPDATE user_settings
SET notify_badge_approaching = true
WHERE notify_badge_approaching IS NOT TRUE;

COMMENT ON COLUMN zones.city_id IS '§12.5 konumdan denormalize şehir';
COMMENT ON COLUMN memories.city_id IS '§12.5 ritüel şehrinden denormalize';
