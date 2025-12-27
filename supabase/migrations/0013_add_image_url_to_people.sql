-- Migration: Add image_url column to people table
-- Description: Store Supabase Storage URLs for people images instead of Notion URLs
-- Created: 2025
--
-- NOTE: You need to create a Supabase Storage bucket named 'people-images' manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket named 'people-images'
-- 3. Set it to public (or configure RLS policies as needed)

ALTER TABLE people 
ADD COLUMN IF NOT EXISTS image_url TEXT NULL;

-- Create index for image_url
CREATE INDEX IF NOT EXISTS idx_people_image_url ON people(image_url) WHERE image_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN people.image_url IS 'Supabase Storage URL for the person image';

