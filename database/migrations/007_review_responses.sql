-- ═══════════════════════════════════════════════════════════════
-- PROJECT PERFECT — Migration 007 — Review Responses
-- Adds review_responses JSON column to store the full
-- structured per-agenda-item responses from each review.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_responses JSONB;
