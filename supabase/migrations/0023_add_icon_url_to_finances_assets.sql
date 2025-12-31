-- Migration: Add icon_url column to finances_assets table
-- Description: Stores Supabase Storage URL for asset icons (for CORS-free color extraction)
-- Created: 2025

ALTER TABLE finances_assets
ADD COLUMN IF NOT EXISTS icon_url TEXT NULL;

COMMENT ON COLUMN finances_assets.icon_url IS 'Supabase Storage URL for asset icon (uploaded from Notion)';

