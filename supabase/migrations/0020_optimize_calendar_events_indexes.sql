-- Migration: Optimize calendar events indexes
-- Description: Add composite indexes to optimize event queries by user_id and date range
--              These indexes will significantly improve query performance for the calendar views
-- Created: 2025

-- Drop the existing date_range index if it exists (it doesn't include user_id which is always filtered first)
DROP INDEX IF EXISTS idx_google_calendar_events_date_range;

-- Create optimized composite index for the main query pattern:
-- Query: user_id + date range (start_time <= timeMax AND end_time >= timeMin) + order by start_time
-- This index covers the most common query pattern in the calendar API
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_user_date_range 
ON google_calendar_events(user_id, start_time, end_time);

-- Create composite index for queries that also filter by calendar_id
-- This is used when specific calendars are requested
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_user_calendar_date_range 
ON google_calendar_events(user_id, calendar_id, start_time, end_time);

-- Create index for all-day events queries (when filtering by start_date)
-- This helps with queries that specifically look for all-day events
CREATE INDEX IF NOT EXISTS idx_google_calendar_events_user_start_date 
ON google_calendar_events(user_id, start_date) 
WHERE is_all_day = TRUE AND start_date IS NOT NULL;

-- Optimize event_people queries - add covering index for batch fetches
-- The query pattern is: user_id + event_id IN (...)
-- The existing idx_event_people_user_event is good, but we can add person_id to make it covering
CREATE INDEX IF NOT EXISTS idx_event_people_user_event_person 
ON event_people(user_id, event_id, person_id);

-- Add comments
COMMENT ON INDEX idx_google_calendar_events_user_date_range IS 
'Optimized index for calendar event queries by user and date range. Covers: user_id + start_time + end_time';

COMMENT ON INDEX idx_google_calendar_events_user_calendar_date_range IS 
'Optimized index for calendar event queries by user, calendar, and date range. Covers: user_id + calendar_id + start_time + end_time';

COMMENT ON INDEX idx_google_calendar_events_user_start_date IS 
'Optimized index for all-day event queries by user and date. Partial index for is_all_day = TRUE';

COMMENT ON INDEX idx_event_people_user_event_person IS 
'Covering index for batch event-people queries. Includes person_id to avoid table lookups';



