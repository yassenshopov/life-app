-- Migration: Create google_calendars table
-- Description: Caches Google Calendar list to avoid constant API calls
-- Created: 2024

CREATE TABLE IF NOT EXISTS google_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    calendar_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    description TEXT,
    time_zone TEXT,
    background_color TEXT,
    foreground_color TEXT,
    access_role TEXT,
    selected BOOLEAN DEFAULT TRUE,
    primary_calendar BOOLEAN DEFAULT FALSE,
    calendar_data JSONB, -- Store full calendar data from Google API
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_google_calendars_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_calendar UNIQUE (user_id, calendar_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_google_calendars_user_id ON google_calendars(user_id);
CREATE INDEX IF NOT EXISTS idx_google_calendars_calendar_id ON google_calendars(calendar_id);
CREATE INDEX IF NOT EXISTS idx_google_calendars_user_selected ON google_calendars(user_id, selected);

-- Add comments
COMMENT ON TABLE google_calendars IS 'Cached Google Calendar list to reduce API calls';
COMMENT ON COLUMN google_calendars.calendar_data IS 'Full calendar data from Google Calendar API as JSONB';
COMMENT ON COLUMN google_calendars.last_synced_at IS 'When this calendar was last synced from Google Calendar API';

