-- Migration: Add enrichment fields to youtube_videos table
-- Description: Adds fields for YouTube Data API v3 enrichment
-- Created: 2025

-- Add enrichment fields to youtube_videos table
ALTER TABLE youtube_videos
  ADD COLUMN IF NOT EXISTS channel_id TEXT,
  ADD COLUMN IF NOT EXISTS like_count BIGINT,
  ADD COLUMN IF NOT EXISTS comment_count BIGINT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category_id TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Create index on channel_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel_id ON youtube_videos(channel_id);

-- Add comment
COMMENT ON COLUMN youtube_videos.channel_id IS 'YouTube channel ID from API';
COMMENT ON COLUMN youtube_videos.like_count IS 'Number of likes from YouTube API';
COMMENT ON COLUMN youtube_videos.comment_count IS 'Number of comments from YouTube API';
COMMENT ON COLUMN youtube_videos.description IS 'Video description from YouTube API';
COMMENT ON COLUMN youtube_videos.category_id IS 'YouTube category ID';
COMMENT ON COLUMN youtube_videos.tags IS 'Array of video tags';

