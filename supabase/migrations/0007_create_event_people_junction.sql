-- Migration: Create event_people junction table
-- Description: Many-to-many relationship between calendar events and people
-- Created: 2024

CREATE TABLE IF NOT EXISTS event_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_id TEXT NOT NULL, -- Google Calendar event ID
  person_id UUID NOT NULL, -- Reference to people table
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_event_people_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_people_person FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
  CONSTRAINT unique_event_person UNIQUE (user_id, event_id, person_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_event_people_user_id ON event_people(user_id);
CREATE INDEX IF NOT EXISTS idx_event_people_event_id ON event_people(event_id);
CREATE INDEX IF NOT EXISTS idx_event_people_person_id ON event_people(person_id);
CREATE INDEX IF NOT EXISTS idx_event_people_user_event ON event_people(user_id, event_id);

-- Add comments
COMMENT ON TABLE event_people IS 'Junction table linking calendar events to people. Relationships persist through syncs.';
COMMENT ON COLUMN event_people.event_id IS 'Google Calendar event ID';
COMMENT ON COLUMN event_people.person_id IS 'Reference to people table';
COMMENT ON COLUMN event_people.user_id IS 'User who owns this relationship';

