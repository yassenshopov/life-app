-- Create table for storing listening history
CREATE TABLE IF NOT EXISTS spotify_listening_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  artist_names TEXT[] NOT NULL,
  album_name TEXT NOT NULL,
  album_image_url TEXT,
  played_at TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER,
  popularity INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id, played_at)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_spotify_history_user_id ON spotify_listening_history(user_id);
CREATE INDEX IF NOT EXISTS idx_spotify_history_played_at ON spotify_listening_history(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_spotify_history_track_id ON spotify_listening_history(track_id);
CREATE INDEX IF NOT EXISTS idx_spotify_history_user_played ON spotify_listening_history(user_id, played_at DESC);

-- Create table for track metadata (to avoid duplication)
CREATE TABLE IF NOT EXISTS spotify_tracks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  artist_names TEXT[] NOT NULL,
  album_name TEXT NOT NULL,
  album_image_url TEXT,
  duration_ms INTEGER,
  popularity INTEGER,
  external_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create table for artist metadata
CREATE TABLE IF NOT EXISTS spotify_artists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  genres TEXT[],
  image_url TEXT,
  popularity INTEGER,
  external_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create junction table for track-artist relationships
CREATE TABLE IF NOT EXISTS spotify_track_artists (
  track_id TEXT NOT NULL REFERENCES spotify_tracks(id) ON DELETE CASCADE,
  artist_id TEXT NOT NULL REFERENCES spotify_artists(id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, artist_id)
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_spotify_history_updated_at
  BEFORE UPDATE ON spotify_listening_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spotify_tracks_updated_at
  BEFORE UPDATE ON spotify_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spotify_artists_updated_at
  BEFORE UPDATE ON spotify_artists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

