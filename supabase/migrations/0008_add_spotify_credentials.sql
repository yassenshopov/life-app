-- Migration: Add Spotify credentials column to users table
-- Description: Adds spotify_credentials column to support Spotify integration
-- Created: 2024

-- Add spotify_credentials column if it doesn't exist
-- This stores OAuth2 credentials: { access_token, refresh_token, expires_in, expires_at }
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'users' 
        AND column_name = 'spotify_credentials'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN spotify_credentials JSONB DEFAULT NULL;
        
        COMMENT ON COLUMN users.spotify_credentials IS 'Stores OAuth2 credentials for Spotify integration. Structure: { access_token: string, refresh_token: string, expires_in: number, expires_at: number }';
    END IF;
END $$;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_spotify_credentials 
ON users USING GIN (spotify_credentials)
WHERE spotify_credentials IS NOT NULL;

