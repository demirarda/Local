-- Host / venue pipeline + screen tracker for role-based ops

CREATE TABLE IF NOT EXISTS ops.ops_host_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ops.ops_projects(id) ON DELETE CASCADE,
  production_user_id UUID,
  display_name VARCHAR(120) NOT NULL,
  email VARCHAR(255),
  city VARCHAR(80),
  pipeline_status VARCHAR(30) NOT NULL DEFAULT 'candidate' CHECK (pipeline_status IN (
    'candidate', 'contacted', 'onboarding', 'active', 'paused', 'churned'
  )),
  rituals_hosted INT NOT NULL DEFAULT 0,
  rituals_hosted_synced_at TIMESTAMPTZ,
  host_feedback TEXT,
  internal_notes TEXT,
  owner_id UUID REFERENCES ops.ops_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.ops_venue_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ops.ops_projects(id) ON DELETE CASCADE,
  production_venue_id UUID,
  name VARCHAR(200) NOT NULL,
  city VARCHAR(80),
  address TEXT,
  contact_name VARCHAR(120),
  contact_email VARCHAR(255),
  pipeline_status VARCHAR(30) NOT NULL DEFAULT 'target' CHECK (pipeline_status IN (
    'target', 'contacted', 'negotiating', 'agreed', 'declined', 'active'
  )),
  internal_notes TEXT,
  owner_id UUID REFERENCES ops.ops_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.ops_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ops.ops_projects(id) ON DELETE CASCADE,
  spec_id VARCHAR(40) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(40) DEFAULT 'other',
  file_ref VARCHAR(512),
  is_target BOOLEAN DEFAULT true,
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  design_status VARCHAR(20) DEFAULT 'not_started' CHECK (design_status IN (
    'not_started', 'in_progress', 'review', 'done'
  )),
  dev_status VARCHAR(20) DEFAULT 'not_started' CHECK (dev_status IN (
    'not_started', 'in_progress', 'qa', 'done'
  )),
  designer_id UUID REFERENCES ops.ops_users(id) ON DELETE SET NULL,
  developer_id UUID REFERENCES ops.ops_users(id) ON DELETE SET NULL,
  design_notes TEXT,
  dev_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, spec_id)
);

CREATE INDEX IF NOT EXISTS idx_ops_host_pipeline_project ON ops.ops_host_pipeline(project_id);
CREATE INDEX IF NOT EXISTS idx_ops_host_pipeline_status ON ops.ops_host_pipeline(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_ops_venue_pipeline_project ON ops.ops_venue_pipeline(project_id);
CREATE INDEX IF NOT EXISTS idx_ops_venue_pipeline_status ON ops.ops_venue_pipeline(pipeline_status);
CREATE INDEX IF NOT EXISTS idx_ops_screens_project ON ops.ops_screens(project_id);
CREATE INDEX IF NOT EXISTS idx_ops_screens_designer ON ops.ops_screens(designer_id);
CREATE INDEX IF NOT EXISTS idx_ops_screens_developer ON ops.ops_screens(developer_id);
