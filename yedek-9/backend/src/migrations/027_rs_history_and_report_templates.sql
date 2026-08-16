-- RS history (all RS changes for admin display: ritual, admin override, bulk)
CREATE TABLE IF NOT EXISTS rs_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_rs DECIMAL(3,1) NOT NULL,
  new_rs DECIMAL(3,1) NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('ritual', 'admin', 'bulk')),
  ritual_id UUID REFERENCES rituals(id) ON DELETE SET NULL,
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rs_history_user ON rs_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rs_history_created ON rs_history(created_at DESC);

COMMENT ON TABLE rs_history IS 'Log of all RS score changes for admin RS history view (ritual, admin, bulk)';

-- Report action note templates (admin-defined quick replies)
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_report_templates_name ON report_templates(name);

COMMENT ON TABLE report_templates IS 'Saved reply templates for report action notes in admin panel';
