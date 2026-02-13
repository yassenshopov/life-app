-- Migration: Add last_edited_time column to people table
-- Description: Store Notion page last edited time when synced from People database

ALTER TABLE people
ADD COLUMN IF NOT EXISTS last_edited_time TIMESTAMP WITH TIME ZONE NULL;

COMMENT ON COLUMN people.last_edited_time IS 'Last edited time from Notion page (when synced)';
