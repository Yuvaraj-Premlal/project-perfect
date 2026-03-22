-- ═══════════════════════════════════════════════════════════════
-- PROJECT PERFECT — Migration 008 — Review AI Summary & Action Items
-- Adds ai_summary and action_items columns to reviews table.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS action_items JSONB;
