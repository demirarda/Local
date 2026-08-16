-- User profile avatar (photo URL or path)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
