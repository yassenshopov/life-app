-- Migration: Add thumbnail_url column to media table
-- Description: Store Supabase Storage URLs for thumbnails instead of Notion URLs
-- Created: 2025
--
-- NOTE: You need to create a Supabase Storage bucket named 'media-thumbnails' manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket named 'media-thumbnails'
-- 3. Set it to public (or configure RLS policies as needed)

ALTER TABLE media 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NULL;

-- Create index for thumbnail_url
CREATE INDEX IF NOT EXISTS idx_media_thumbnail_url ON media(thumbnail_url) WHERE thumbnail_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN media.thumbnail_url IS 'Supabase Storage URL for the thumbnail image';

