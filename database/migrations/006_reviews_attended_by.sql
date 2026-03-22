-- ═══════════════════════════════════════════════════════════════
-- PROJECT PERFECT — Migration 006 — Reviews attended_by
-- Adds attended_by field to reviews table to capture
-- who was present in the review meeting.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS attended_by TEXT;
