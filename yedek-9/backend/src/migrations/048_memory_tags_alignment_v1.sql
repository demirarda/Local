-- Migration 048: Align memory_tags with backend-yeni.md §2.10

CREATE TABLE IF NOT EXISTS memory_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  tagged_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tagger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(memory_id, tagged_user_id)
);

CREATE INDEX IF NOT EXISTS idx_memory_tags_memory_id ON memory_tags(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_tags_tagged_user_id ON memory_tags(tagged_user_id);
CREATE INDEX IF NOT EXISTS idx_memory_tags_tagger_id ON memory_tags(tagger_id);

-- Best-effort FL1+ gate from friendships table (uses requester/receiver model)
CREATE OR REPLACE FUNCTION enforce_memory_tagger_fl1()
RETURNS TRIGGER AS $$
DECLARE
  fl friendship_level_enum;
BEGIN
  -- Self-tag always allowed.
  IF NEW.tagger_id = NEW.tagged_user_id THEN
    RETURN NEW;
  END IF;

  SELECT f.friendship_level
  INTO fl
  FROM friendships f
  WHERE f.status = 'accepted'
    AND (
      (f.requester_id = NEW.tagger_id AND f.receiver_id = NEW.tagged_user_id) OR
      (f.requester_id = NEW.tagged_user_id AND f.receiver_id = NEW.tagger_id)
    )
  LIMIT 1;

  IF fl IS NULL OR fl = 'stranger' THEN
    RAISE EXCEPTION 'tagger must be FL1+ with tagged user';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_memory_tagger_fl1 ON memory_tags;
CREATE TRIGGER trg_memory_tagger_fl1
BEFORE INSERT OR UPDATE ON memory_tags
FOR EACH ROW
EXECUTE FUNCTION enforce_memory_tagger_fl1();

