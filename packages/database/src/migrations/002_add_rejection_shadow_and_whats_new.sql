-- Migration 002: Add rejection_shadow, whats_new_since_last_time, and version columns to ideas table
-- Per Operating Parameters compliance requirements

-- Add version column for immutable idea versions
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

-- Add rejection_shadow column (JSONB)
-- Tracks prior rejections and whether they block re-submission
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS rejection_shadow JSONB;

-- Add whats_new_since_last_time column (JSONB array)
-- Tracks changes that justify re-surfacing a previously seen ticker
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS whats_new_since_last_time JSONB;

-- Add is_new_ticker flag
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS is_new_ticker BOOLEAN DEFAULT FALSE;

-- Add is_exploration flag
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS is_exploration BOOLEAN DEFAULT FALSE;

-- Add company_name column if not exists
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Add index for version lookups
CREATE INDEX IF NOT EXISTS ideas_ticker_version_idx ON ideas (ticker, version DESC);

-- Add index for rejection shadow lookups
CREATE INDEX IF NOT EXISTS ideas_rejection_shadow_idx ON ideas ((rejection_shadow->>'reason'));

-- Add last_catalysts column to novelty_state for tracking catalyst changes
ALTER TABLE novelty_state ADD COLUMN IF NOT EXISTS last_catalysts JSONB;

-- Add last_themes column to novelty_state for tracking theme changes
ALTER TABLE novelty_state ADD COLUMN IF NOT EXISTS last_themes JSONB;

-- Add promoted_at timestamp to ideas for tracking when idea was promoted
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP;

-- Create rejection_history table for tracking all rejections
CREATE TABLE IF NOT EXISTS rejection_history (
  rejection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES ideas(idea_id),
  ticker TEXT NOT NULL,
  rejected_at TIMESTAMP DEFAULT NOW() NOT NULL,
  reason TEXT NOT NULL,
  is_blocking BOOLEAN DEFAULT FALSE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS rejection_history_ticker_idx ON rejection_history (ticker);
CREATE INDEX IF NOT EXISTS rejection_history_reason_idx ON rejection_history (reason);
CREATE INDEX IF NOT EXISTS rejection_history_is_blocking_idx ON rejection_history (is_blocking);

-- Add completion_status to research_packets for tracking module completion
ALTER TABLE research_packets ADD COLUMN IF NOT EXISTS completion_status JSONB;

-- Add modules column to research_packets for storing individual module outputs
ALTER TABLE research_packets ADD COLUMN IF NOT EXISTS modules JSONB;

-- Add evidence_count to research_packets
ALTER TABLE research_packets ADD COLUMN IF NOT EXISTS evidence_count INTEGER DEFAULT 0;

-- Add is_complete flag to research_packets
ALTER TABLE research_packets ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT FALSE;

-- Update style_mix_state to track daily promotions
ALTER TABLE style_mix_state ADD COLUMN IF NOT EXISTS daily_promotions JSONB;

-- Comment on new columns
COMMENT ON COLUMN ideas.version IS 'Immutable version number, incremented on each update';
COMMENT ON COLUMN ideas.rejection_shadow IS 'Prior rejection info: {rejected_at, reason, is_blocking, prior_idea_id, notes}';
COMMENT ON COLUMN ideas.whats_new_since_last_time IS 'Array of changes justifying re-surfacing: [{category, description, evidence, detected_at}]';
COMMENT ON COLUMN ideas.is_new_ticker IS 'True if ticker not seen in 90 days';
COMMENT ON COLUMN ideas.is_exploration IS 'True if selected via exploration rate';
COMMENT ON COLUMN ideas.promoted_at IS 'Timestamp when idea was promoted to Lane B';
COMMENT ON COLUMN research_packets.completion_status IS 'Module completion status: {module_name: {is_complete, missing_fields, errors}}';
COMMENT ON COLUMN research_packets.is_complete IS 'True when all 7 modules complete + decision brief + min 5 evidence';
