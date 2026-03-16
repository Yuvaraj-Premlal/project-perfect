-- ═══════════════════════════════════════════════════════════════
-- Migration 003 — Weekly reports project link + closure fields
-- ═══════════════════════════════════════════════════════════════

-- Add missing columns to weekly_reports
ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS project_id        UUID REFERENCES projects(project_id),
  ADD COLUMN IF NOT EXISTS opv_snapshot      NUMERIC(6,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lfv_snapshot      NUMERIC(6,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vr_snapshot       NUMERIC(6,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momentum_snapshot NUMERIC(6,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS high_risk_count   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tasks       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalation_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generated_by      UUID REFERENCES users(user_id);

-- Add closure fields to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS actual_end_date   DATE,
  ADD COLUMN IF NOT EXISTS closure_notes     TEXT,
  ADD COLUMN IF NOT EXISTS closure_report    TEXT,
  ADD COLUMN IF NOT EXISTS closed_by         UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS closed_at         TIMESTAMPTZ;

-- Index for project weekly reports
CREATE INDEX IF NOT EXISTS idx_weekly_reports_project 
  ON weekly_reports(project_id, week_ending DESC);

