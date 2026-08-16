-- son-part.md §1 — veri modeli tamamlama

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ritual_definition_level') THEN
    CREATE TYPE ritual_definition_level AS ENUM ('bos', 'kategori', 'tam', 'user_oneri');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ritual_visibility') THEN
    CREATE TYPE ritual_visibility AS ENUM ('public', 'venue_only', 'regular_only');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ritual_time_type') THEN
    CREATE TYPE ritual_time_type AS ENUM ('fixed', 'instant', 'recurring');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_scope_enum') THEN
    CREATE TYPE memory_scope_enum AS ENUM ('solo', 'pulse', 'all');
  END IF;
END $$;

ALTER TYPE ritual_status ADD VALUE IF NOT EXISTS 'created';

ALTER TABLE rituals
  ADD COLUMN IF NOT EXISTS definition_level ritual_definition_level NOT NULL DEFAULT 'tam',
  ADD COLUMN IF NOT EXISTS visibility ritual_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS time_type ritual_time_type NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS check_in_radius INTEGER;

UPDATE rituals
SET check_in_radius = CASE location_type
  WHEN 'venue' THEN 50
  WHEN 'zone' THEN 75
  WHEN 'moving' THEN 15
  ELSE 30
END
WHERE check_in_radius IS NULL;

UPDATE rituals
SET time_type = 'recurring'::ritual_time_type
WHERE is_recurring = true;

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS memory_scope memory_scope_enum,
  ADD COLUMN IF NOT EXISTS created_in_window BOOLEAN NOT NULL DEFAULT false;

UPDATE memories
SET memory_scope = 'pulse'::memory_scope_enum
WHERE memory_type = 'pulse'
   OR destination::text = 'ritual_and_pulse';

UPDATE memories
SET memory_scope = 'solo'::memory_scope_enum
WHERE memory_scope IS NULL;

UPDATE memories
SET created_in_window = true
WHERE ritual_id IS NOT NULL;

ALTER TYPE memory_type_enum ADD VALUE IF NOT EXISTS 'media';
ALTER TYPE memory_type_enum ADD VALUE IF NOT EXISTS 'music';

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS r1_self VARCHAR(10),
  ADD COLUMN IF NOT EXISTS p2v_feeling VARCHAR(10);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feedback_feedback_type_check') THEN
    ALTER TABLE feedback DROP CONSTRAINT feedback_feedback_type_check;
  END IF;
END $$;

ALTER TABLE feedback
  ADD CONSTRAINT feedback_feedback_type_check
  CHECK (feedback_type IN ('p2p', 'p2host', 'p2r', 'p2m', 'p2v', 'r1_self'));

ALTER TABLE feedback
  DROP CONSTRAINT IF EXISTS feedback_r1_self_check;
ALTER TABLE feedback
  ADD CONSTRAINT feedback_r1_self_check
  CHECK (r1_self IS NULL OR r1_self IN ('green', 'yellow', 'red'));

ALTER TABLE feedback
  DROP CONSTRAINT IF EXISTS feedback_p2v_feeling_check;
ALTER TABLE feedback
  ADD CONSTRAINT feedback_p2v_feeling_check
  CHECK (p2v_feeling IS NULL OR p2v_feeling IN ('green', 'yellow', 'red'));

-- p2m → p2v (spec alias)
UPDATE feedback SET feedback_type = 'p2v' WHERE feedback_type = 'p2m';

CREATE INDEX IF NOT EXISTS idx_rituals_visibility ON rituals(visibility);
CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(memory_scope);
CREATE INDEX IF NOT EXISTS idx_feedback_p2v ON feedback(ritual_id) WHERE feedback_type = 'p2v';
CREATE INDEX IF NOT EXISTS idx_pulse_reposts_ritual ON pulse_reposts(source_ritual_id, created_at DESC);

COMMENT ON COLUMN rituals.definition_level IS 'bos|kategori|tam|user_oneri — son-part.md §1';
COMMENT ON COLUMN rituals.visibility IS 'public|venue_only|regular_only — son-part.md §1';
COMMENT ON COLUMN memories.memory_scope IS 'solo|pulse|all — son-part.md §2.4';
COMMENT ON COLUMN feedback.r1_self IS 'R1 self reflection → CF_self';
COMMENT ON COLUMN feedback.p2v_feeling IS 'P2V venue feeling → venue Trust (never RS)';
