-- Migration: Create google_calendar_events table
-- Description: Stores cached Google Calendar events to avoid constant API calls
-- Created: 2024

CREATE TABLE IF NOT EXISTS google_calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    calendar_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    title TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    color TEXT,
    description TEXT,
    location TEXT,
    event_data JSONB,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_google_calendar_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_calendar_event UNIQUE (user_id, calendar_id, event_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_user_id ON google_calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_calendar_id ON google_calendar_events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_start_time ON google_calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_user_calendar ON google_calendar_events(user_id, calendar_id);
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_date_range ON google_calendar_events(start_time, end_time);

-- Add comments
COMMENT ON TABLE google_calendar_events IS 'Cached Google Calendar events to reduce API calls';
COMMENT ON COLUMN google_calendar_events.event_data IS 'Full event data from Google Calendar API as JSONB';
COMMENT ON COLUMN google_calendar_events.last_synced_at IS 'When this event was last synced from Google Calendar API';

