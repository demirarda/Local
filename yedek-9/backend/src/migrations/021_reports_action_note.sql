-- Add action_note to reports for admin moderation notes
ALTER TABLE reports ADD COLUMN IF NOT EXISTS action_note TEXT;
