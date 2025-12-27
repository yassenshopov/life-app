-- Create table for storing top tracks rankings
CREATE TABLE IF NOT EXISTS spotify_top_tracks (
  user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  time_range TEXT NOT NULL CHECK (time_range IN ('short_term', 'medium_term', 'long_term')),
  rank INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, track_id, time_range),
  FOREIGN KEY (track_id) REFERENCES spotify_tracks(id) ON DELETE CASCADE
);

-- Create table for storing top artists rankings
CREATE TABLE IF NOT EXISTS spotify_top_artists (
  user_id TEXT NOT NULL,
  artist_id TEXT NOT NULL,
  time_range TEXT NOT NULL CHECK (time_range IN ('short_term', 'medium_term', 'long_term')),
  rank INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, artist_id, time_range),
  FOREIGN KEY (artist_id) REFERENCES spotify_artists(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_spotify_top_tracks_user_time ON spotify_top_tracks(user_id, time_range, rank);
CREATE INDEX IF NOT EXISTS idx_spotify_top_artists_user_time ON spotify_top_artists(user_id, time_range, rank);

-- Add comments
COMMENT ON TABLE spotify_top_tracks IS 'Stores user top tracks rankings for different time ranges';
COMMENT ON TABLE spotify_top_artists IS 'Stores user top artists rankings for different time ranges';
COMMENT ON COLUMN spotify_top_tracks.time_range IS 'Time range: short_term (4 weeks), medium_term (6 months), long_term (several years)';
COMMENT ON COLUMN spotify_top_artists.time_range IS 'Time range: short_term (4 weeks), medium_term (6 months), long_term (several years)';

