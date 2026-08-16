-- Migration 054: Align chat_messages schema with backend-yeni.md §2.16 (lines 516-541)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_message_type') THEN
    CREATE TYPE chat_message_type AS ENUM ('text', 'photo', 'quote', 'playlist', 'voice');
  END IF;
END $$;

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS type chat_message_type,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS reaction_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL;

-- Backfill from legacy columns
UPDATE chat_messages
SET content = message
WHERE content IS NULL
  AND message IS NOT NULL;

UPDATE chat_messages
SET type = CASE
  WHEN message_type::text = 'host_announcement' THEN 'quote'::chat_message_type
  WHEN message_type::text = 'system' THEN 'quote'::chat_message_type
  ELSE 'text'::chat_message_type
END
WHERE type IS NULL;

ALTER TABLE chat_messages
  ALTER COLUMN reaction_count SET DEFAULT 0,
  ALTER COLUMN reply_count SET DEFAULT 0,
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Keep legacy and canonical columns synchronized for compatibility
CREATE OR REPLACE FUNCTION trg_sync_chat_messages_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS NULL AND NEW.message IS NOT NULL THEN
    NEW.content := NEW.message;
  END IF;
  IF NEW.message IS NULL AND NEW.content IS NOT NULL THEN
    NEW.message := NEW.content;
  END IF;

  IF NEW.type IS NULL THEN
    NEW.type := CASE
      WHEN COALESCE(NEW.message_type, 'user') IN ('host_announcement', 'system') THEN 'quote'::chat_message_type
      ELSE 'text'::chat_message_type
    END;
  END IF;

  IF NEW.message_type IS NULL THEN
    NEW.message_type := CASE
      WHEN NEW.type = 'quote'::chat_message_type THEN 'host_announcement'
      ELSE 'user'
    END;
  END IF;

  NEW.reaction_count := COALESCE(NEW.reaction_count, 0);
  NEW.reply_count := COALESCE(NEW.reply_count, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_chat_messages_columns ON chat_messages;
CREATE TRIGGER trg_sync_chat_messages_columns
BEFORE INSERT OR UPDATE ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION trg_sync_chat_messages_columns();

CREATE INDEX IF NOT EXISTS idx_chat_messages_parent_message_id ON chat_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_type ON chat_messages(type);

