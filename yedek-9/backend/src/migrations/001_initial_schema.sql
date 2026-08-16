-- LOCAL Database Schema
-- Initial migration for MVP

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  university VARCHAR(255),
  rs_score DECIMAL(3,1) DEFAULT 6.0 CHECK (rs_score >= 1.0 AND rs_score <= 10.0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rituals table
CREATE TABLE IF NOT EXISTS rituals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  venue_name VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  duration INTEGER NOT NULL, -- in minutes
  capacity INTEGER NOT NULL,
  entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('open', 'request_seat', 'invite_only')),
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lng DECIMAL(11, 8) NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'ended', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ritual attendance
CREATE TABLE IF NOT EXISTS ritual_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'joined' CHECK (status IN ('joined', 'checked_in', 'left_early', 'no_show')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ritual_id, user_id)
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ritual_id UUID NOT NULL REFERENCES rituals(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for P2R
  feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('p2p', 'p2host', 'p2r')),
  q1_comfort VARCHAR(10) CHECK (q1_comfort IN ('green', 'yellow', 'red')),
  q2_energy VARCHAR(10) CHECK (q2_energy IN ('green', 'yellow', 'red')),
  p2r_feeling VARCHAR(10) CHECK (p2r_feeling IN ('green', 'yellow', 'red')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ritual_id, from_user_id, to_user_id, feedback_type)
);

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rituals_start_time ON rituals(start_time);
CREATE INDEX IF NOT EXISTS idx_rituals_status ON rituals(status);
CREATE INDEX IF NOT EXISTS idx_rituals_location ON rituals(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_ritual_attendance_ritual ON ritual_attendance(ritual_id);
CREATE INDEX IF NOT EXISTS idx_ritual_attendance_user ON ritual_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_ritual ON feedback(ritual_id);
CREATE INDEX IF NOT EXISTS idx_feedback_to_user ON feedback(to_user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
