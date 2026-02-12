-- Migration: Optimize event_people queries for person events
-- Description: Add composite index to optimize queries that fetch events for a specific person
--              This significantly improves performance for /api/people/[personId]/events
-- Created: 2025

-- Create composite index for the query pattern: user_id + person_id
-- Query: SELECT event_id FROM event_people WHERE user_id = ? AND person_id = ?
-- This index makes the WHERE clause very fast
CREATE INDEX IF NOT EXISTS idx_event_people_user_person 
ON event_people(user_id, person_id);

-- Create covering index that includes event_id to avoid table lookups
-- This makes the query even faster as it can get all data from the index
CREATE INDEX IF NOT EXISTS idx_event_people_user_person_event 
ON event_people(user_id, person_id, event_id);

-- Add comments
COMMENT ON INDEX idx_event_people_user_person IS 
'Optimized index for queries fetching events linked to a specific person. Covers: user_id + person_id';

COMMENT ON INDEX idx_event_people_user_person_event IS 
'Covering index for person events queries. Includes event_id to avoid table lookups. Covers: user_id + person_id + event_id';


