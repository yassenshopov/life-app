-- Add location fields to users table for weather preferences
ALTER TABLE users
ADD COLUMN IF NOT EXISTS weather_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS weather_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS weather_location_name TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_weather_location ON users(id) WHERE weather_latitude IS NOT NULL AND weather_longitude IS NOT NULL;





