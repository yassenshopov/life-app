-- Migration: Create YouTube watch history table
-- Description: Stores YouTube watch history synced from Google Takeout data
-- Created: 2025

-- Create table for storing YouTube watch history
CREATE TABLE IF NOT EXISTS youtube_watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  video_title TEXT NOT NULL,
  channel_name TEXT,
  channel_url TEXT,
  video_url TEXT NOT NULL,
  watched_at TIMESTAMPTZ NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, video_id, watched_at)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_youtube_history_user_id ON youtube_watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_youtube_history_watched_at ON youtube_watch_history(watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_history_video_id ON youtube_watch_history(video_id);
CREATE INDEX IF NOT EXISTS idx_youtube_history_user_watched ON youtube_watch_history(user_id, watched_at DESC);

-- Create table for video metadata (to avoid duplication)
CREATE TABLE IF NOT EXISTS youtube_videos (
  video_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  channel_name TEXT,
  channel_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  view_count BIGINT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create triggers for updated_at
CREATE TRIGGER update_youtube_history_updated_at
  BEFORE UPDATE ON youtube_watch_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_youtube_videos_updated_at
  BEFORE UPDATE ON youtube_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE youtube_watch_history IS 'Stores individual watch history entries from YouTube';
COMMENT ON TABLE youtube_videos IS 'Stores metadata for YouTube videos to avoid duplication';
COMMENT ON INDEX idx_youtube_history_user_watched IS 'Optimized index for queries fetching most recent watch history for a user';

