-- Unique open application (pending|draft) per user.
-- Separate file: PG forbids using a new enum value in the same transaction as ADD VALUE.

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_applications_one_open_per_user
  ON venue_applications(user_id)
  WHERE status IN ('pending', 'draft');
