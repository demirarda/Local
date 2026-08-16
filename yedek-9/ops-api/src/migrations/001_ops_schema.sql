-- LOCAL Ops Portal schema (isolated from production app tables)

CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS ops.ops_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN (
    'pm', 'designer', 'developer', 'host_lead', 'venue_lead', 'founder'
  )),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.ops_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  city VARCHAR(80),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'done')),
  target_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.ops_board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ops.ops_projects(id) ON DELETE CASCADE,
  name VARCHAR(60) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  wip_limit INT
);

CREATE TABLE IF NOT EXISTS ops.ops_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ops.ops_projects(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES ops.ops_board_columns(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assignee_id UUID REFERENCES ops.ops_users(id) ON DELETE SET NULL,
  reporter_id UUID REFERENCES ops.ops_users(id) ON DELETE SET NULL,
  due_date DATE,
  position INT NOT NULL DEFAULT 0,
  parent_task_id UUID REFERENCES ops.ops_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.ops_task_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ops.ops_tasks(id) ON DELETE CASCADE,
  link_type VARCHAR(30) NOT NULL CHECK (link_type IN (
    'screen', 'host', 'venue', 'ritual', 'doc', 'figma', 'file'
  )),
  ref_key VARCHAR(255) NOT NULL,
  ref_label VARCHAR(255),
  meta JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS ops.ops_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ops.ops_tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES ops.ops_users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.ops_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES ops.ops_tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES ops.ops_users(id),
  file_name VARCHAR(255),
  storage_key VARCHAR(512),
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.ops_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES ops.ops_tasks(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES ops.ops_users(id),
  action VARCHAR(40) NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_tasks_project ON ops.ops_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_ops_tasks_column ON ops.ops_tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_ops_tasks_assignee ON ops.ops_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_ops_task_links_task ON ops.ops_task_links(task_id);
CREATE INDEX IF NOT EXISTS idx_ops_comments_task ON ops.ops_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_ops_activity_task ON ops.ops_activity_log(task_id);
