-- Migration 093: GPS distance log + edge-pattern MOD signal (Master Parametre §2)
-- Persists check-in distance for "hep radius sınırı + sıfır memory" correlation.

ALTER TABLE ritual_attendance
  ADD COLUMN IF NOT EXISTS gps_distance_m REAL,
  ADD COLUMN IF NOT EXISTS checkin_radius_m REAL;

CREATE INDEX IF NOT EXISTS idx_attendance_gps_edge_pattern
  ON ritual_attendance (user_id, checkin_at DESC)
  WHERE checkin_at IS NOT NULL AND gps_distance_m IS NOT NULL AND checkin_radius_m IS NOT NULL;
