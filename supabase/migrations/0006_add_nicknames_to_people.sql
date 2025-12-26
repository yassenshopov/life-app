-- Migration: Add nicknames column to people table
-- Description: Stores nicknames/alternative names for people matching
-- Created: 2024

ALTER TABLE people ADD COLUMN IF NOT EXISTS nicknames TEXT[] NULL;

-- Create index for efficient nickname searches
CREATE INDEX IF NOT EXISTS idx_people_nicknames ON people USING GIN (nicknames);

-- Add comment
COMMENT ON COLUMN people.nicknames IS 'Array of nicknames/alternative names for matching calendar events';

