-- Migration: Create media table
-- Description: Stores synced Media entries from Notion database (Media Ground)
-- Created: 2025

-- Drop constraint if it exists with the old name (in case table was partially created)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'media') THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'unique_user_notion_page' 
      AND conrelid = 'media'::regclass
    ) THEN
      ALTER TABLE media DROP CONSTRAINT unique_user_notion_page;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  notion_database_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Notion properties mapped to columns
  name TEXT NOT NULL,
  category TEXT NULL, -- select: Book, YouTube, Podcast Ep, Article, Twitter Thread, Movie, Series
  status TEXT NULL, -- status field
  url TEXT NULL, -- url field
  by TEXT[] NULL, -- multi_select: authors/creators
  topic TEXT[] NULL, -- multi_select: topics
  thumbnail JSONB NULL, -- files: thumbnail images
  ai_synopsis TEXT NULL, -- rich_text
  created TIMESTAMP WITH TIME ZONE NULL, -- created_time

  CONSTRAINT fk_media_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT unique_media_user_notion_page UNIQUE (user_id, notion_page_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_notion_page_id ON media(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_media_notion_database_id ON media(notion_database_id);
CREATE INDEX IF NOT EXISTS idx_media_category ON media(category);
CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);
CREATE INDEX IF NOT EXISTS idx_media_by ON media USING GIN (by);
CREATE INDEX IF NOT EXISTS idx_media_topic ON media USING GIN (topic);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created);

-- Add comments
COMMENT ON TABLE media IS 'Synced Media entries from Notion database (Media Ground)';
COMMENT ON COLUMN media.notion_page_id IS 'Notion page ID for this media entry';
COMMENT ON COLUMN media.notion_database_id IS 'Notion database ID that this media belongs to';
COMMENT ON COLUMN media.last_synced_at IS 'When this entry was last synced from Notion';
COMMENT ON COLUMN media.thumbnail IS 'Thumbnail files from Notion stored as JSONB array';
COMMENT ON COLUMN media.by IS 'Array of authors/creators (multi_select)';
COMMENT ON COLUMN media.topic IS 'Array of topics (multi_select)';
COMMENT ON COLUMN media.category IS 'Media category: Book, Movie, Series, YouTube, Podcast Ep, Article, Twitter Thread';

