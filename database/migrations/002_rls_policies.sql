-- ═══════════════════════════════════════════════════════════════
-- PROJECT PERFECT — Migration 002 — RLS Policies
-- Must run AFTER migration 001
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- HOW THIS WORKS
-- The Node.js backend sets the session variable app.tenant_id
-- at the start of every request, extracted from the JWT.
-- Every RLS policy checks that the row's tenant_id matches
-- the session variable — so a user from Tenant A can never
-- see or touch rows belonging to Tenant B, even if the
-- application code has a bug.
--
-- current_setting('app.tenant_id', true) — the true argument
-- means return NULL (not throw an error) if the variable is
-- not set. This prevents crashes during migrations and admin
-- operations run as superuser.
-- ───────────────────────────────────────────────────────────────

CREATE POLICY tenant_isolation ON tenants
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON suppliers
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON project_phases
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON project_team
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON tasks
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON task_slippage_history
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON task_completion_attempts
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON reviews
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON escalations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON project_revisions
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON daily_opv_snapshots
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON weekly_reports
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON audit_log
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
