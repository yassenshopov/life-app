-- Migration: Add icon_url column to finances_places table
-- Description: Stores Supabase Storage URL for place icons (for CORS-free color extraction)
-- Created: 2025

ALTER TABLE finances_places
ADD COLUMN IF NOT EXISTS icon_url TEXT NULL;

COMMENT ON COLUMN finances_places.icon_url IS 'Supabase Storage URL for place icon (uploaded from Notion)';

