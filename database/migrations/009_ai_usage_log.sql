-- ═══════════════════════════════════════════════════════════════
-- PROJECT PERFECT — Migration 009 — AI Usage Log
-- Tracks AI feature usage per project per day/week
-- to enforce usage limits.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE ai_usage_log (
  log_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL,
  feature      VARCHAR(50) NOT NULL, -- 'project_quick_glance' | 'review_summary' | 'weekly_report'
  used_by      UUID,                 -- user_id who triggered it
  used_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_project   ON ai_usage_log(project_id, feature, used_at);
CREATE INDEX idx_ai_usage_tenant    ON ai_usage_log(tenant_id);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON ai_usage_log
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
