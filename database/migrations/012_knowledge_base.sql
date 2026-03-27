-- ════════════════════════════════════════════════════════════════
-- Migration 012 — Knowledge Base (Closure Reports, Reactions,
--                 Comments, Attachments)
-- ════════════════════════════════════════════════════════════════

-- ── 1. Closure Reports ───────────────────────────────────────────
CREATE TABLE closure_reports (
  report_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL,
  project_id          UUID NOT NULL REFERENCES projects(project_id),

  -- PM free text input
  pm_notes            TEXT,

  -- AI generated sections stored as structured JSON
  sections            JSONB NOT NULL DEFAULT '{}',
  -- Expected keys:
  -- {
  --   "project_overview":        "...",
  --   "key_events_timeline":     "...",
  --   "what_went_right":         "...",
  --   "what_went_wrong":         "...",
  --   "stakeholder_performance": "...",
  --   "recommendations":         "...",
  --   "pm_closing_remarks":      "..."
  -- }

  -- AI generated tags for filtering
  tags                TEXT[] DEFAULT '{}',

  -- Project metric snapshot at time of closure
  actual_end_date     DATE NOT NULL,
  planned_end_date    DATE NOT NULL,
  days_variance       INTEGER NOT NULL,
  total_tasks         INTEGER NOT NULL,
  completed_tasks     INTEGER NOT NULL,
  total_slippages     INTEGER NOT NULL,
  final_opv           NUMERIC(5,4),
  final_lfv           NUMERIC(5,4),

  -- Meta
  generated_by        UUID REFERENCES users(user_id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id)  -- one closure report per project, ever
);

-- ── 2. Knowledge Base Reactions ──────────────────────────────────
CREATE TABLE kb_reactions (
  reaction_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  report_id       UUID NOT NULL REFERENCES closure_reports(report_id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(user_id),
  reaction_type   VARCHAR(20) NOT NULL CHECK (reaction_type IN ('thumbs_up', 'lightbulb', 'warning')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(report_id, user_id, reaction_type) -- one of each reaction type per PM per report
);

-- ── 3. Knowledge Base Comments ───────────────────────────────────
CREATE TABLE kb_comments (
  comment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  report_id     UUID NOT NULL REFERENCES closure_reports(report_id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES kb_comments(comment_id),  -- NULL = top level, set = reply
  user_id       UUID NOT NULL REFERENCES users(user_id),
  body          TEXT NOT NULL,
  tag           VARCHAR(50) CHECK (tag IN (
                  'we_experienced_this',
                  'different_outcome',
                  'useful_recommendation',
                  'general'
                )),

  -- Soft delete for moderation — record kept, display hidden
  deleted       BOOLEAN DEFAULT FALSE,
  deleted_by    UUID REFERENCES users(user_id),
  deleted_at    TIMESTAMPTZ,

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Knowledge Base Attachments ───────────────────────────────
CREATE TABLE kb_attachments (
  attachment_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,

  -- Belongs to either a report OR a comment — never both, never neither
  report_id         UUID REFERENCES closure_reports(report_id) ON DELETE CASCADE,
  comment_id        UUID REFERENCES kb_comments(comment_id) ON DELETE CASCADE,

  -- File details
  file_name         TEXT NOT NULL,
  file_url          TEXT NOT NULL,         -- Azure Blob Storage URL
  file_type         TEXT NOT NULL,         -- e.g. image/jpeg, image/png, application/pdf
  file_size_bytes   INTEGER,
  caption           TEXT,                  -- e.g. "Final qualified part — Supplier A"

  uploaded_by       UUID REFERENCES users(user_id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Exactly one parent
  CONSTRAINT exactly_one_parent CHECK (
    (report_id IS NOT NULL AND comment_id IS NULL) OR
    (report_id IS NULL     AND comment_id IS NOT NULL)
  )
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX idx_closure_reports_tenant     ON closure_reports(tenant_id);
CREATE INDEX idx_closure_reports_project    ON closure_reports(project_id);
CREATE INDEX idx_closure_reports_tags       ON closure_reports USING GIN(tags);
CREATE INDEX idx_closure_reports_created    ON closure_reports(created_at DESC);

CREATE INDEX idx_kb_reactions_report        ON kb_reactions(report_id);
CREATE INDEX idx_kb_reactions_user          ON kb_reactions(user_id);

CREATE INDEX idx_kb_comments_report         ON kb_comments(report_id);
CREATE INDEX idx_kb_comments_parent         ON kb_comments(parent_id);
CREATE INDEX idx_kb_comments_user           ON kb_comments(user_id);

CREATE INDEX idx_kb_attachments_report      ON kb_attachments(report_id);
CREATE INDEX idx_kb_attachments_comment     ON kb_attachments(comment_id);

-- ── Row Level Security ───────────────────────────────────────────
ALTER TABLE closure_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_reactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_attachments   ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON closure_reports
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON kb_reactions
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON kb_comments
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON kb_attachments
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ── Grants ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON closure_reports  TO "ppAdmin";
GRANT SELECT, INSERT, UPDATE, DELETE ON kb_reactions     TO "ppAdmin";
GRANT SELECT, INSERT, UPDATE, DELETE ON kb_comments      TO "ppAdmin";
GRANT SELECT, INSERT, UPDATE, DELETE ON kb_attachments   TO "ppAdmin";
