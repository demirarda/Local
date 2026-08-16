-- Spotify Playlist Schema
-- Migration 010: Add Spotify playlist support to memories (Spec 5.X.4, 5.X.6)

-- Add spotify_playlist_url column to memories table
ALTER TABLE memories 
ADD COLUMN IF NOT EXISTS spotify_playlist_url VARCHAR(500);

-- Add spotify_playlist_id column for easier parsing
ALTER TABLE memories 
ADD COLUMN IF NOT EXISTS spotify_playlist_id VARCHAR(100);

-- Add index for Spotify playlist queries
CREATE INDEX IF NOT EXISTS idx_memories_spotify ON memories(spotify_playlist_id) WHERE spotify_playlist_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN memories.spotify_playlist_url IS 'Spotify playlist URL for memory (Spec 5.X.4, 5.X.6)';
COMMENT ON COLUMN memories.spotify_playlist_id IS 'Spotify playlist ID extracted from URL';
