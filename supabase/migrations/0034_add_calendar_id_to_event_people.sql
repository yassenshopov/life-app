-- Add optional calendar_id to event_people for faster person-events fetch.
-- When set, we can fetch the event with a single Google API call instead of trying every calendar.
ALTER TABLE event_people
ADD COLUMN IF NOT EXISTS calendar_id TEXT;

COMMENT ON COLUMN event_people.calendar_id IS 'Google Calendar ID where the event lives; used to fetch event in one API call';
