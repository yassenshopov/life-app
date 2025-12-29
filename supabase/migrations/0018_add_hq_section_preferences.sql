-- Add HQ section preferences column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS hq_section_preferences JSONB DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_hq_section_preferences 
ON users USING GIN (hq_section_preferences)
WHERE hq_section_preferences IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.hq_section_preferences IS 'Stores user preferences for HQ page section visibility. Structure: { [sectionId]: { visible: boolean } }';

