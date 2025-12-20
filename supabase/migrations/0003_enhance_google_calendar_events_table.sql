-- Migration: Enhance google_calendar_events table
-- Description: Add columns to store more data from Google Calendar API response
-- Created: 2024

-- Add is_all_day column to explicitly track all-day events
ALTER TABLE google_calendar_events 
ADD COLUMN IF NOT EXISTS is_all_day BOOLEAN DEFAULT FALSE;

-- Add more event metadata columns
ALTER TABLE google_calendar_events 
ADD COLUMN IF NOT EXISTS organizer_email TEXT,
ADD COLUMN IF NOT EXISTS organizer_display_name TEXT,
ADD COLUMN IF NOT EXISTS attendees JSONB,
ADD COLUMN IF NOT EXISTS recurrence JSONB,
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS html_link TEXT,
ADD COLUMN IF NOT EXISTS hangout_link TEXT,
ADD COLUMN IF NOT EXISTS conference_data JSONB,
ADD COLUMN IF NOT EXISTS reminders JSONB,
ADD COLUMN IF NOT EXISTS transparency TEXT,
ADD COLUMN IF NOT EXISTS visibility TEXT,
ADD COLUMN IF NOT EXISTS i_cal_uid TEXT,
ADD COLUMN IF NOT EXISTS sequence INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS updated TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS start_date DATE, -- For all-day events
ADD COLUMN IF NOT EXISTS end_date DATE;   -- For all-day events (exclusive)

-- Create index on is_all_day for faster filtering
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_is_all_day 
ON google_calendar_events(is_all_day);

-- Create index on i_cal_uid for deduplication
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_i_cal_uid 
ON google_calendar_events(i_cal_uid);

-- Create index on start_date for all-day event queries
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_start_date 
ON google_calendar_events(start_date) 
WHERE is_all_day = TRUE;

-- Add comments
COMMENT ON COLUMN google_calendar_events.is_all_day IS 'Whether this is an all-day event (no specific time)';
COMMENT ON COLUMN google_calendar_events.start_date IS 'Date for all-day events (no time component)';
COMMENT ON COLUMN google_calendar_events.end_date IS 'End date for all-day events (exclusive, no time component)';
COMMENT ON COLUMN google_calendar_events.attendees IS 'List of attendees as JSONB array';
COMMENT ON COLUMN google_calendar_events.recurrence IS 'Recurrence rules as JSONB array';
COMMENT ON COLUMN google_calendar_events.i_cal_uid IS 'iCal UID for event deduplication';

