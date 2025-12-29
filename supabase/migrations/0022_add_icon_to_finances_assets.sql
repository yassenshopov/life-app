-- Migration: Add icon column to finances_assets table
-- Description: Add icon field to store Notion page icons (emoji, external, or file)
-- Created: 2025

ALTER TABLE finances_assets 
ADD COLUMN IF NOT EXISTS icon JSONB NULL;

-- Add comment
COMMENT ON COLUMN finances_assets.icon IS 'Notion page icon (emoji, external URL, or file) stored as JSONB';

