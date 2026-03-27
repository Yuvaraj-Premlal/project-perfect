CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE charter_change_requests (
  ccr_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  tenant_id            UUID NOT NULL,
  ccr_number           VARCHAR(50) NOT NULL,
  raised_at            TIMESTAMPTZ DEFAULT NOW(),
  raised_by            UUID,
  raised_by_name       VARCHAR(200),
  reason_category      VARCHAR(50) NOT NULL CHECK (reason_category IN ('customer_request','scope_change','regulatory','force_majeure','other')),
  description          TEXT NOT NULL,
  change_requested_by  VARCHAR(50) NOT NULL CHECK (change_requested_by IN ('customer','internal_leadership','regulatory','other')),
  evidence_reference   TEXT NOT NULL,
  changes_snapshot     JSONB NOT NULL,
  status               VARCHAR(20) DEFAULT 'approved'
);

CREATE INDEX idx_ccr_project ON charter_change_requests(project_id);
CREATE INDEX idx_ccr_tenant  ON charter_change_requests(tenant_id);

ALTER TABLE charter_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON charter_change_requests
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
