-- Migration: Add Google Calendar columns to users table
-- Description: Adds google_calendar_credentials and calendar_preferences columns to support Google Calendar integration
-- Created: 2024

-- Add google_calendar_credentials column if it doesn't exist
-- This stores OAuth2 credentials: { access_token, refresh_token, expiry_date }
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'users' 
        AND column_name = 'google_calendar_credentials'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN google_calendar_credentials JSONB DEFAULT NULL;
        
        COMMENT ON COLUMN users.google_calendar_credentials IS 'Stores OAuth2 credentials for Google Calendar integration. Structure: { access_token: string, refresh_token: string, expiry_date?: number }';
    END IF;
END $$;

-- Add calendar_preferences column if it doesn't exist
-- This stores user preferences for which calendars to show/hide
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'users' 
        AND column_name = 'calendar_preferences'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN calendar_preferences JSONB DEFAULT NULL;
        
        COMMENT ON COLUMN users.calendar_preferences IS 'Stores user preferences for calendar visibility. Structure: { [calendarId]: { selected: boolean } }';
    END IF;
END $$;

-- Create GIN indexes for efficient JSONB queries
-- These indexes allow fast lookups and filtering on JSONB columns
CREATE INDEX IF NOT EXISTS idx_users_google_calendar_credentials 
ON users USING GIN (google_calendar_credentials)
WHERE google_calendar_credentials IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_calendar_preferences 
ON users USING GIN (calendar_preferences)
WHERE calendar_preferences IS NOT NULL;

-- Add helpful comments
COMMENT ON TABLE users IS 'User accounts with Google Calendar integration support';
