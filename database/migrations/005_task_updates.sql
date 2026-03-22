-- ═══════════════════════════════════════════════════════════════
-- PROJECT PERFECT — Migration 005 — Task Updates
-- Replaces the free-text comments field with a structured
-- event log per task. Each update captures what was done,
-- what is pending, any blockers, action owner, due date,
-- and impact if not resolved.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE task_updates (
  update_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             UUID NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  project_id          UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL,

  -- Structured update fields
  what_done           TEXT NOT NULL,
  what_pending        TEXT NOT NULL,
  issue_blocker       TEXT,                    -- optional
  action_owner        VARCHAR(255) NOT NULL,
  action_due_date     DATE NOT NULL,
  impact_if_not_done  TEXT NOT NULL,

  -- Audit
  created_by_name     VARCHAR(255) NOT NULL,   -- derived from JWT email
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_task_updates_task     ON task_updates(task_id);
CREATE INDEX idx_task_updates_project  ON task_updates(project_id);
CREATE INDEX idx_task_updates_tenant   ON task_updates(tenant_id);

-- RLS
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON task_updates
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Only PMs can insert/delete updates (SELECT open to all tenant members)
REVOKE INSERT, UPDATE, DELETE ON task_updates FROM PUBLIC;
GRANT SELECT ON task_updates TO PUBLIC;
