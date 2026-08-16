-- Migration 046: Align memories schema with backend-yeni.md §2.9

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_type_enum') THEN
    CREATE TYPE memory_type_enum AS ENUM ('photo', 'quote', 'playlist', 'voice', 'text');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_privacy_enum_doc') THEN
    CREATE TYPE memory_privacy_enum_doc AS ENUM ('public', 'friends', 'private');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'memory_destination_enum') THEN
    CREATE TYPE memory_destination_enum AS ENUM ('ritual_only', 'ritual_and_pulse');
  END IF;
END $$;

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS type memory_type_enum,
  ADD COLUMN IF NOT EXISTS content_url TEXT,
  ADD COLUMN IF NOT EXISTS content_text TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS caption TEXT,
  ADD COLUMN IF NOT EXISTS privacy memory_privacy_enum_doc DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS destination memory_destination_enum,
  ADD COLUMN IF NOT EXISTS reshare_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_memory_id UUID REFERENCES memories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reshared_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Backfill from legacy columns
UPDATE memories
SET type = COALESCE(
      type,
      CASE memory_type
        WHEN 'pulse' THEN 'text'::memory_type_enum
        WHEN 'ritual' THEN 'text'::memory_type_enum
        ELSE 'text'::memory_type_enum
      END
    ),
    content_text = COALESCE(content_text, content),
    external_url = COALESCE(external_url, spotify_playlist_url),
    privacy = COALESCE(privacy, 'friends'::memory_privacy_enum_doc),
    destination = COALESCE(
      destination,
      CASE WHEN memory_type = 'pulse' THEN 'ritual_and_pulse'::memory_destination_enum
           ELSE 'ritual_only'::memory_destination_enum
      END
    )
WHERE type IS NULL
   OR content_text IS NULL
   OR external_url IS NULL
   OR privacy IS NULL
   OR destination IS NULL;

ALTER TABLE memories
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN destination SET NOT NULL;

ALTER TABLE memories
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT NOW();

-- Keep legacy/new columns in sync for API compatibility.
CREATE OR REPLACE FUNCTION sync_memories_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content_text IS NULL AND NEW.content IS NOT NULL THEN
    NEW.content_text := NEW.content;
  END IF;
  IF NEW.content IS NULL AND NEW.content_text IS NOT NULL THEN
    NEW.content := NEW.content_text;
  END IF;

  IF NEW.external_url IS NULL AND NEW.spotify_playlist_url IS NOT NULL THEN
    NEW.external_url := NEW.spotify_playlist_url;
  END IF;
  IF NEW.spotify_playlist_url IS NULL AND NEW.external_url IS NOT NULL THEN
    NEW.spotify_playlist_url := NEW.external_url;
  END IF;

  IF NEW.memory_type IS NULL THEN
    NEW.memory_type := CASE
      WHEN NEW.destination = 'ritual_and_pulse'::memory_destination_enum THEN 'pulse'
      ELSE 'ritual'
    END;
  END IF;

  IF NEW.type IS NULL THEN
    NEW.type := 'text'::memory_type_enum;
  END IF;

  IF NEW.destination IS NULL THEN
    NEW.destination := CASE
      WHEN NEW.memory_type = 'pulse' THEN 'ritual_and_pulse'::memory_destination_enum
      ELSE 'ritual_only'::memory_destination_enum
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_memories_columns ON memories;
CREATE TRIGGER trg_sync_memories_columns
BEFORE INSERT OR UPDATE ON memories
FOR EACH ROW
EXECUTE FUNCTION sync_memories_columns();

