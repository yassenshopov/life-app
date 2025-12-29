-- Migration: Add monthly_tracking_id to media table
-- Description: Relate media entries to monthly tracking entries
-- Created: 2025

ALTER TABLE media 
ADD COLUMN IF NOT EXISTS monthly_tracking_id UUID NULL;

-- Add foreign key constraint
ALTER TABLE media
ADD CONSTRAINT fk_media_monthly_tracking 
FOREIGN KEY (monthly_tracking_id) 
REFERENCES tracking_monthly(id) 
ON DELETE SET NULL;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_media_monthly_tracking_id ON media(monthly_tracking_id) WHERE monthly_tracking_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN media.monthly_tracking_id IS 'Reference to the monthly tracking entry when this media was consumed';

