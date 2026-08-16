-- F5 Adim 4-5: venue archive query index
CREATE INDEX IF NOT EXISTS idx_memories_venue_archive
  ON memories (ritual_id, created_at DESC)
  WHERE ritual_id IS NOT NULL;
