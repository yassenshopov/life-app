-- Migration: Create people table
-- Description: Stores synced People entries from Notion database
-- Created: 2024

CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Notion properties mapped to columns
  name TEXT NOT NULL,
  origin_of_connection TEXT[] NULL,
  star_sign TEXT NULL,
  image JSONB NULL,
  currently_at TEXT NULL,
  age JSONB NULL, -- Formula field, stored as JSONB
  tier TEXT[] NULL,
  occupation TEXT NULL,
  birthday JSONB NULL, -- Formula field, stored as JSONB
  contact_freq TEXT NULL,
  from_location TEXT NULL, -- "from" is a reserved keyword, using from_location
  birth_date DATE NULL,

  CONSTRAINT fk_people_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_notion_page UNIQUE (user_id, notion_page_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);
CREATE INDEX IF NOT EXISTS idx_people_notion_page_id ON people(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_people_notion_database_id ON people(notion_database_id);
CREATE INDEX IF NOT EXISTS idx_people_tier ON people USING GIN (tier);
CREATE INDEX IF NOT EXISTS idx_people_birth_date ON people(birth_date);

-- Add comments
COMMENT ON TABLE people IS 'Synced People entries from Notion database';
COMMENT ON COLUMN people.notion_page_id IS 'Notion page ID for this person entry';
COMMENT ON COLUMN people.notion_database_id IS 'Notion database ID that this person belongs to';
COMMENT ON COLUMN people.last_synced_at IS 'When this entry was last synced from Notion';
COMMENT ON COLUMN people.image IS 'Image files from Notion stored as JSONB array';
COMMENT ON COLUMN people.age IS 'Calculated age formula from Notion stored as JSONB';
COMMENT ON COLUMN people.birthday IS 'Calculated birthday formula from Notion stored as JSONB';
COMMENT ON COLUMN people.tier IS 'Array of tier values (e.g., ["Tier CR", "Tier F"])';
COMMENT ON COLUMN people.from_location IS 'Origin country/location (from is a reserved keyword)';

