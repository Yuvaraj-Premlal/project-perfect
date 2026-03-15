-- ═══════════════════════════════════════════════════════════════
-- PROJECT PERFECT — Migration 001 — Initial Schema
-- All decisions finalised across full design session
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ───────────────────────────────────────────────────────────────
-- TENANTS
-- One row per client organisation using Project Perfect
-- ───────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  tenant_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name        VARCHAR(200) NOT NULL,
  subdomain           VARCHAR(100) UNIQUE NOT NULL,  -- e.g. "acme" for acme.projectperfect.in
  ebitda_current      DECIMAL(15,2),                 -- updated quarterly by PM
  ebitda_updated_at   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- USERS
-- All people who log in: PMs, team members, ownership
-- ───────────────────────────────────────────────────────────────
CREATE TABLE users (
  user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(tenant_id),
  email       VARCHAR(255) UNIQUE NOT NULL,
  full_name   VARCHAR(200) NOT NULL,
  role        VARCHAR(20)  NOT NULL CHECK (role IN ('pm', 'team_member', 'owner')),
  department  VARCHAR(100),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- SUPPLIERS
-- Tenant-level registry of all suppliers and sub-suppliers.
-- Performance metrics are system-calculated from closed projects.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE suppliers (
  supplier_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(tenant_id),
  supplier_name            VARCHAR(200) NOT NULL,
  supplier_type            VARCHAR(20)  NOT NULL CHECK (supplier_type IN ('direct', 'sub_supplier')),
  contact_name             VARCHAR(200),
  contact_email            VARCHAR(255),  -- used for direct nudge routing on CN=10/100 tasks
  -- System-calculated performance history (updated at project closure)
  projects_appeared_in     INTEGER     DEFAULT 0,
  average_delay_days       DECIMAL(6,2) DEFAULT 0,
  average_slippage_count   DECIMAL(6,2) DEFAULT 0,
  total_rn_contributed     INTEGER     DEFAULT 0,  -- sum of RN across all closed project tasks
  top3_risk_count          INTEGER     DEFAULT 0,  -- times in top 3 risk tasks at closure
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- PROJECTS
-- One row per launch programme.
-- Dates are locked at creation (24h grace window).
-- Metrics are system-calculated — never manually entered.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE projects (
  project_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(tenant_id),

  -- Identity (Block 1)
  project_name             VARCHAR(200) NOT NULL,
  project_code             VARCHAR(50),               -- Q Number
  customer_name            VARCHAR(200),
  customer_ref             VARCHAR(100),              -- customer PO or programme number
  primary_supplier_id      UUID REFERENCES suppliers(supplier_id),
  pm_user_id               UUID REFERENCES users(user_id),
  launch_date_target       DATE,

  -- Baseline dates — locked after charter_locked_at
  start_date               DATE NOT NULL,
  planned_end_date         DATE NOT NULL,
  charter_locked_at        TIMESTAMPTZ,              -- set 24h after creation

  -- Risk tier and environment number
  -- EN is auto-assigned from risk_tier: High=10, Moderate=5, Low=2
  -- EN is NEVER shown to any user — internal calculation only
  risk_tier                VARCHAR(20) NOT NULL CHECK (risk_tier IN ('high', 'moderate', 'low')),
  en_value                 INTEGER     NOT NULL CHECK (en_value IN (2, 5, 10)),

  -- Charter risk assessment (Block 6)
  charter_risk_score       INTEGER     DEFAULT 0,
  launch_status            VARCHAR(20) DEFAULT 'released' CHECK (launch_status IN ('released', 'risk_release')),

  -- Project status
  status                   VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'on_hold')),

  -- PPM Metrics — system-calculated on every task save, never manually entered
  opv                      DECIMAL(8,4) DEFAULT 0,   -- Operational Performance Velocity
  lfv                      DECIMAL(8,4) DEFAULT 0,   -- Load Factor Velocity
  vr                       DECIMAL(8,4) DEFAULT 0,   -- Velocity Ratio = OPV / LFV
  pr                       DECIMAL(8,4) DEFAULT 0,   -- Performance Ratio = VR x EN
  ecd_algorithmic          DATE,                     -- predicted end date from OPV formula
  momentum                 DECIMAL(8,4) DEFAULT 0,   -- OPV delta vs last review
  tcr                      DECIMAL(6,4) DEFAULT 0,   -- Task Chaos Ratio
  dcr                      DECIMAL(6,4) DEFAULT 0,   -- Duration Chaos Ratio

  -- Review cadence tracking
  next_review_due          DATE,
  last_review_at           TIMESTAMPTZ,

  -- Baseline revision tracking (Section 21)
  revision_count           INTEGER     DEFAULT 0,
  current_baseline_number  INTEGER     DEFAULT 0,   -- 0=original, 1=first revision etc.
  is_revised               BOOLEAN     DEFAULT FALSE,

  created_at               TIMESTAMPTZ DEFAULT NOW(),
  closed_at                TIMESTAMPTZ
);

-- ───────────────────────────────────────────────────────────────
-- PROJECT PHASES
-- User-defined per project — not hardcoded.
-- PM creates phases at project creation (suggested defaults
-- shown in UI but fully editable: add, rename, remove).
-- Phase dates are locked at project creation (same baseline rule).
-- ───────────────────────────────────────────────────────────────
CREATE TABLE project_phases (
  phase_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES projects(project_id),
  tenant_id         UUID NOT NULL,
  phase_name        VARCHAR(100) NOT NULL,  -- free text: "Samples", "PPAP", "SOP", or anything
  phase_order       INTEGER     NOT NULL,   -- display order: 1, 2, 3...
  target_date       DATE        NOT NULL,   -- LOCKED at project creation — baseline
  target_quantity   INTEGER,               -- optional: units expected at this milestone
  is_at_risk        BOOLEAN     DEFAULT FALSE,  -- true if any task ECD in phase > target_date
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- PROJECT TEAM
-- Cross-functional team assignments per project (Charter Block 2).
-- Role names are free text — not hardcoded.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE project_team (
  team_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(project_id),
  tenant_id    UUID NOT NULL,
  role         VARCHAR(100) NOT NULL,  -- "Program Manager", "SDE", "Sourcing" etc — PM defines
  user_id      UUID REFERENCES users(user_id),
  user_name    VARCHAR(200),
  user_email   VARCHAR(255),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, role)
);

-- ───────────────────────────────────────────────────────────────
-- TASKS
-- One row per task in a project.
-- Baseline fields (planned dates, acceptance criteria, control type)
-- are locked at creation — never change.
-- Only current_ecd, status, comments, and evidence are updateable.
-- All calculated fields are system-written — never user-entered.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  task_id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                UUID NOT NULL REFERENCES projects(project_id),
  tenant_id                 UUID NOT NULL,

  -- Baseline fields — set at creation, locked forever
  task_name                 VARCHAR(300) NOT NULL,
  owner_user_id             UUID REFERENCES users(user_id),
  owner_email               VARCHAR(255),
  owner_department          VARCHAR(100),
  phase_id                  UUID REFERENCES project_phases(phase_id),  -- user-defined phase
  control_type              VARCHAR(20) NOT NULL CHECK (control_type IN ('internal', 'supplier', 'sub_supplier')),
  cn_value                  INTEGER     NOT NULL CHECK (cn_value IN (1, 10, 100)),
  supplier_id               UUID REFERENCES suppliers(supplier_id),   -- null if internal
  planned_start_date        DATE,
  planned_end_date          DATE        NOT NULL,
  acceptance_criteria       TEXT        NOT NULL,  -- MANDATORY — cannot save task without this

  -- Updateable fields — owner or PM
  current_ecd               DATE,
  completion_status         VARCHAR(30) DEFAULT 'not_started' CHECK (completion_status IN (
                              'not_started',
                              'in_progress',
                              'submitted',          -- owner submitted for completion
                              'pending_approval',   -- visible in PM approval queue
                              'complete',           -- PM approved — counts in OPV
                              'blocked',
                              'rejected'            -- PM rejected — owner must resubmit
                            )),
  comments                  TEXT,
  evidence_url_1            TEXT,
  evidence_url_2            TEXT,
  evidence_label_1          VARCHAR(200),
  evidence_label_2          VARCHAR(200),
  acceptance_confirmed      BOOLEAN     DEFAULT FALSE,
  acceptance_confirmed_by   UUID REFERENCES users(user_id),
  acceptance_confirmed_at   TIMESTAMPTZ,

  -- Completion workflow fields (Section 22)
  completion_submitted_at   TIMESTAMPTZ,
  completion_submitted_by   UUID REFERENCES users(user_id),
  completion_note           TEXT,                  -- owner's completion description (min 30 chars)
  rejection_reason          TEXT,                  -- latest rejection reason from PM
  rejection_count           INTEGER     DEFAULT 0, -- total rejections across all attempts
  last_rejected_at          TIMESTAMPTZ,
  last_rejected_by          UUID REFERENCES users(user_id),

  -- System-calculated fields — written by backend only, never by users
  delay_days                INTEGER     DEFAULT 0,  -- max(0, current_ecd - planned_end_date)
  risk_number               INTEGER     DEFAULT 0,  -- cn_value x delay_days — NEVER shown to users
  risk_label                VARCHAR(20) DEFAULT 'on_track' CHECK (risk_label IN (
                              'high_risk',    -- top 3 by RN (non-zero)
                              'moderate',     -- next 3 by RN (non-zero)
                              'monitoring',   -- remaining non-zero RN
                              'on_track',     -- delay_days = 0
                              'complete'      -- PM approved completion
                            )),
  slippage_count            INTEGER     DEFAULT 0,  -- count of backward ECD moves only
  ai_suggested_ecd          DATE,                   -- from deterministic algorithm
  ai_ecd_explanation        TEXT,                   -- AI-written plain English reason

  created_by                UUID REFERENCES users(user_id),
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- TASK SLIPPAGE HISTORY
-- Append-only. Every backward ECD move is recorded here.
-- Forward moves (improvement) are NOT recorded.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE task_slippage_history (
  slippage_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id              UUID NOT NULL REFERENCES tasks(task_id),
  tenant_id            UUID NOT NULL,
  slippage_number      INTEGER     NOT NULL,  -- 1st, 2nd, 3rd slip etc.
  previous_ecd         DATE        NOT NULL,  -- what it was before the change
  new_ecd              DATE        NOT NULL,  -- what it moved to (must be later)
  delay_increase_days  INTEGER     NOT NULL,  -- new_ecd minus previous_ecd
  changed_by           UUID REFERENCES users(user_id),
  changed_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- TASK COMPLETION ATTEMPTS
-- Append-only. Every submission attempt is recorded permanently —
-- approved, rejected, or still pending.
-- Slippage counts are NOT reset by a revision or by rejection.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE task_completion_attempts (
  attempt_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID NOT NULL REFERENCES tasks(task_id),
  tenant_id        UUID NOT NULL,
  attempt_number   INTEGER     NOT NULL,  -- 1st, 2nd, 3rd attempt
  submitted_by     UUID REFERENCES users(user_id),
  submitted_at     TIMESTAMPTZ DEFAULT NOW(),
  completion_note  TEXT,                  -- owner's description of what was done
  evidence_url_1   TEXT,                  -- snapshot of evidence at submission time
  evidence_url_2   TEXT,
  evidence_label_1 VARCHAR(200),
  evidence_label_2 VARCHAR(200),
  outcome          VARCHAR(20) DEFAULT 'pending' CHECK (outcome IN ('approved', 'rejected', 'pending')),
  reviewed_by      UUID REFERENCES users(user_id),  -- PM who reviewed
  reviewed_at      TIMESTAMPTZ,
  review_note      TEXT                   -- approval note or rejection reason
);

-- ───────────────────────────────────────────────────────────────
-- REVIEWS
-- One row per completed review session.
-- Metrics are snapshotted and locked at save — never editable.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE reviews (
  review_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID NOT NULL REFERENCES projects(project_id),
  tenant_id             UUID NOT NULL,
  review_date           DATE        NOT NULL,
  discussion_points     TEXT,
  blockers              TEXT,
  actions_agreed        TEXT,
  -- Metric snapshots — locked at save, never editable after
  opv_snapshot          DECIMAL(8,4),
  lfv_snapshot          DECIMAL(8,4),
  vr_snapshot           DECIMAL(8,4),
  momentum_snapshot     DECIMAL(8,4),
  escalation_triggered  BOOLEAN     DEFAULT FALSE,
  conducted_by          UUID REFERENCES users(user_id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- ESCALATIONS
-- Two-tier automatic escalation (Section 8).
-- Tier 1: PM. Triggered when OPV < 0.8 or LFV > 1.2 at review save.
-- Tier 2: Ownership. Triggered 7 days after Tier 1 if unresolved.
-- Records are permanent — never deleted.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE escalations (
  escalation_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES projects(project_id),
  tenant_id          UUID NOT NULL,
  tier               INTEGER     NOT NULL CHECK (tier IN (1, 2)),
  triggered_at       TIMESTAMPTZ DEFAULT NOW(),
  trigger_opv        DECIMAL(8,4),  -- OPV value that triggered escalation
  trigger_lfv        DECIMAL(8,4),  -- LFV value that triggered escalation
  ai_brief_original  TEXT,          -- AI-generated draft
  ai_brief_edited    TEXT,          -- PM-edited version (Tier 1 only — Tier 2 sent as-is)
  pm_confirmed_at    TIMESTAMPTZ,
  sent_to            TEXT,          -- email addresses
  sent_at            TIMESTAMPTZ,
  resolved_at        TIMESTAMPTZ,
  resolution_opv     DECIMAL(8,4)   -- OPV when escalation was resolved
);

-- ───────────────────────────────────────────────────────────────
-- PROJECT REVISIONS (Section 21)
-- Formal baseline revision workflow.
-- Distinguishes PM-driven drift (blocked) from legitimate
-- external changes (allowed via this formal process).
-- Original baseline (Baseline 0) is preserved permanently.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE project_revisions (
  revision_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                UUID NOT NULL REFERENCES projects(project_id),
  tenant_id                 UUID NOT NULL,
  revision_number           INTEGER     NOT NULL,  -- 1, 2, 3 — increments per revision
  reason_category           VARCHAR(30) NOT NULL CHECK (reason_category IN (
                              'customer_request',
                              'scope_change',
                              'regulatory',
                              'force_majeure',
                              'other'               -- requires 100-char min description
                            )),
  description               TEXT        NOT NULL,  -- minimum 50 characters
  change_requested_by       VARCHAR(30) NOT NULL CHECK (change_requested_by IN (
                              'customer',
                              'internal_leadership',
                              'regulatory',
                              'other'
                            )),
  evidence_reference        TEXT        NOT NULL,  -- email ref, change order number, URL
  original_end_date         DATE        NOT NULL,  -- preserved from previous baseline
  new_end_date              DATE        NOT NULL,  -- must be later than original_end_date
  original_phase_dates      JSONB,                 -- snapshot of all phase target_dates before revision
  new_phase_dates           JSONB,                 -- all phase target_dates after revision
  raised_by                 UUID REFERENCES users(user_id),
  raised_at                 TIMESTAMPTZ DEFAULT NOW(),
  notified_to_ownership_at  TIMESTAMPTZ,
  auto_approve_deadline     TIMESTAMPTZ,           -- raised_at + 48 hours
  approved_at               TIMESTAMPTZ,
  approved_by               UUID REFERENCES users(user_id),  -- null if auto-approved
  approval_type             VARCHAR(20) CHECK (approval_type IN ('explicit', 'auto', 'rejected')),
  rejection_reason          TEXT
);

-- ───────────────────────────────────────────────────────────────
-- DAILY OPV SNAPSHOTS
-- One row per project per day.
-- Used for the run rate chart in the Summary tab.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE daily_opv_snapshots (
  snapshot_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(project_id),
  tenant_id      UUID NOT NULL,
  snapshot_date  DATE        NOT NULL,
  opv            DECIMAL(8,4),
  lfv            DECIMAL(8,4),
  UNIQUE(project_id, snapshot_date)  -- one row per project per day, no duplicates
);

-- ───────────────────────────────────────────────────────────────
-- WEEKLY REPORTS
-- Auto-generated every Sunday 8pm. Emailed Monday 7am.
-- PM cannot edit or regenerate. Archived permanently.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE weekly_reports (
  report_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  week_ending             DATE        NOT NULL,  -- the Sunday the report was generated
  report_content          TEXT,                  -- full AI-generated narrative
  generated_at            TIMESTAMPTZ DEFAULT NOW(),
  sent_to_ownership_at    TIMESTAMPTZ,
  sent_to_pm_at           TIMESTAMPTZ
);

-- ───────────────────────────────────────────────────────────────
-- AUDIT LOG
-- Append-only. Every significant action is recorded here.
-- Application user has INSERT permission only — no UPDATE or DELETE.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  log_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL,
  event_type   VARCHAR(100) NOT NULL,  -- e.g. 'task_ecd_changed', 'review_saved', 'escalation_triggered'
  entity_type  VARCHAR(50),            -- 'task', 'project', 'review', 'escalation', 'nudge'
  entity_id    UUID,
  user_id      UUID,                   -- null for system-generated events
  old_value    JSONB,
  new_value    JSONB,
  metadata     JSONB,                  -- additional context
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- Covering all critical query paths
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX idx_users_tenant              ON users(tenant_id);
CREATE INDEX idx_suppliers_tenant          ON suppliers(tenant_id);
CREATE INDEX idx_projects_tenant           ON projects(tenant_id);
CREATE INDEX idx_projects_pm               ON projects(pm_user_id);
CREATE INDEX idx_projects_status           ON projects(status);
CREATE INDEX idx_phases_project            ON project_phases(project_id);
CREATE INDEX idx_team_project              ON project_team(project_id);
CREATE INDEX idx_tasks_project             ON tasks(project_id);
CREATE INDEX idx_tasks_tenant              ON tasks(tenant_id);
CREATE INDEX idx_tasks_owner               ON tasks(owner_user_id);
CREATE INDEX idx_tasks_status              ON tasks(completion_status);
CREATE INDEX idx_tasks_phase               ON tasks(phase_id);
CREATE INDEX idx_tasks_risk_label          ON tasks(risk_label);
CREATE INDEX idx_slippage_task             ON task_slippage_history(task_id);
CREATE INDEX idx_completion_attempts_task  ON task_completion_attempts(task_id);
CREATE INDEX idx_reviews_project           ON reviews(project_id);
CREATE INDEX idx_escalations_project       ON escalations(project_id);
CREATE INDEX idx_revisions_project         ON project_revisions(project_id);
CREATE INDEX idx_daily_opv_project_date    ON daily_opv_snapshots(project_id, snapshot_date);
CREATE INDEX idx_weekly_reports_tenant     ON weekly_reports(tenant_id);
CREATE INDEX idx_audit_tenant              ON audit_log(tenant_id);
CREATE INDEX idx_audit_entity              ON audit_log(entity_id);
CREATE INDEX idx_audit_event_type          ON audit_log(event_type);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Enabled on all tables. Policies defined in migration 002.
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE tenants                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_phases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_team              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_slippage_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completion_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations               ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_revisions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_opv_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                 ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- APPEND-ONLY TABLE PERMISSIONS
-- These three tables must never have rows updated or deleted.
-- Revoke at the PUBLIC level — applies to all non-superuser roles.
-- ═══════════════════════════════════════════════════════════════
REVOKE UPDATE, DELETE ON task_slippage_history    FROM PUBLIC;
REVOKE UPDATE, DELETE ON task_completion_attempts FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_log                FROM PUBLIC;
