-- Migration: Add QA Reports table
-- Created: 2026-01-12

-- Create qa_reports table
CREATE TABLE IF NOT EXISTS qa_reports (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL,
  report_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  overall_score INTEGER NOT NULL,
  status TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS qa_reports_report_type_idx ON qa_reports(report_type);
CREATE INDEX IF NOT EXISTS qa_reports_report_date_idx ON qa_reports(report_date);
