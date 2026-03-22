-- Migration 004: Add product_name to projects, start_date and data_availability to project_phases

ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(200);

ALTER TABLE project_phases 
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS data_availability VARCHAR(20) DEFAULT 'yes' 
    CHECK (data_availability IN ('yes', 'no', 'partial'));

-- Phase data availability notes
ALTER TABLE project_phases
  ADD COLUMN IF NOT EXISTS data_notes TEXT,
  ADD COLUMN IF NOT EXISTS data_notes_updated_by VARCHAR(200),
  ADD COLUMN IF NOT EXISTS data_notes_updated_at TIMESTAMPTZ;
