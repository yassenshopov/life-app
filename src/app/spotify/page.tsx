'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Music,
  User,
  Play,
  TrendingUp,
  Clock,
  ListMusic,
  Sparkles,
  LogOut,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface SpotifyProfile {
  id: string;
  display_name: string;
  email: string;
  images: Array<{ url: string }>;
  followers: { total: number };
  country: string;
  product: string;
}

interface Track {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; images: Array<{ url: string }> };
  external_urls: { spotify: string };
  popularity?: number;
}

interface Artist {
  id: string;
  name: string;
  images: Array<{ url: string }>;
  genres: string[];
  external_urls: { spotify: string };
  popularity?: number;
}

interface CurrentlyPlaying {
  isPlaying: boolean;
  item?: {
    name: string;
    artists: Array<{ name: string }>;
    album: { images: Array<{ url: string }> };
    external_urls: { spotify: string };
  };
  progress_ms?: number;
  is_playing?: boolean;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  images: Array<{ url: string }>;
  owner: { display_name: string };
  tracks: { total: number };
  external_urls: { spotify: string };
}

export default function SpotifyPage() {
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [profile, setProfile] = React.useState<SpotifyProfile | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = React.useState<CurrentlyPlaying | null>(null);
  const [topTracks, setTopTracks] = React.useState<Track[]>([]);
  const [topArtists, setTopArtists] = React.useState<Artist[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = React.useState<Track[]>([]);
  const [playlists, setPlaylists] = React.useState<Playlist[]>([]);
  const [recommendations, setRecommendations] = React.useState<Track[]>([]);
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [timeRange, setTimeRange] = React.useState<'short_term' | 'medium_term' | 'long_term'>('medium_term');

  React.useEffect(() => {
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');

    if (connected === 'true') {
      setIsConnected(true);
      window.history.replaceState({}, '', window.location.pathname);
      checkConnection();
    } else if (error) {
      console.error('Spotify connection error:', error);
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      checkConnection();
    }
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/spotify/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      setIsConnected(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch('/api/spotify/auth');
      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      }
    } catch (error) {
      console.error('Error connecting to Spotify:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/spotify/disconnect', { method: 'POST' });
      if (response.ok) {
        setIsConnected(false);
        setProfile(null);
        setCurrentlyPlaying(null);
        setTopTracks([]);
        setTopArtists([]);
        setRecentlyPlayed([]);
        setPlaylists([]);
        setRecommendations([]);
      }
    } catch (error) {
      console.error('Error disconnecting from Spotify:', error);
    }
  };

  const fetchProfile = async () => {
    setLoading((prev) => ({ ...prev, profile: true }));
    try {
      const response = await fetch('/api/spotify/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading((prev) => ({ ...prev, profile: false }));
    }
  };

  const fetchCurrentlyPlaying = async () => {
    setLoading((prev) => ({ ...prev, currentlyPlaying: true }));
    try {
      const response = await fetch('/api/spotify/currently-playing');
      if (response.ok) {
        const data = await response.json();
        setCurrentlyPlaying(data);
      }
    } catch (error) {
      console.error('Error fetching currently playing:', error);
    } finally {
      setLoading((prev) => ({ ...prev, currentlyPlaying: false }));
    }
  };

  const fetchTopTracks = async () => {
    setLoading((prev) => ({ ...prev, topTracks: true }));
    try {
      const response = await fetch(`/api/spotify/top-tracks?time_range=${timeRange}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setTopTracks(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching top tracks:', error);
    } finally {
      setLoading((prev) => ({ ...prev, topTracks: false }));
    }
  };

  const fetchTopArtists = async () => {
    setLoading((prev) => ({ ...prev, topArtists: true }));
    try {
      const response = await fetch(`/api/spotify/top-artists?time_range=${timeRange}&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setTopArtists(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching top artists:', error);
    } finally {
      setLoading((prev) => ({ ...prev, topArtists: false }));
    }
  };

  const fetchRecentlyPlayed = async () => {
    setLoading((prev) => ({ ...prev, recentlyPlayed: true }));
    try {
      const response = await fetch('/api/spotify/recently-played?limit=10');
      if (response.ok) {
        const data = await response.json();
        setRecentlyPlayed(
          data.items?.map((item: any) => item.track).filter(Boolean) || []
        );
      }
    } catch (error) {
      console.error('Error fetching recently played:', error);
    } finally {
      setLoading((prev) => ({ ...prev, recentlyPlayed: false }));
    }
  };

  const fetchPlaylists = async () => {
    setLoading((prev) => ({ ...prev, playlists: true }));
    try {
      const response = await fetch('/api/spotify/playlists?limit=10');
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setLoading((prev) => ({ ...prev, playlists: false }));
    }
  };

  const fetchRecommendations = async () => {
    setLoading((prev) => ({ ...prev, recommendations: true }));
    try {
      // Get seed tracks from top tracks
      const seedTracks = topTracks.slice(0, 3).map((t) => t.id).join(',');
      if (!seedTracks) {
        // If no top tracks, fetch them first
        await fetchTopTracks();
        return;
      }

      const response = await fetch(
        `/api/spotify/recommendations?seed_tracks=${seedTracks}&limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.tracks || []);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading((prev) => ({ ...prev, recommendations: false }));
    }
  };

  React.useEffect(() => {
    if (isConnected && topTracks.length > 0) {
      fetchRecommendations();
    }
  }, [topTracks, isConnected]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-black dark:via-slate-950 dark:to-slate-900 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
              <Music className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Connect to Spotify</CardTitle>
            <CardDescription>
              Connect your Spotify account to explore the full power of the Spotify Web API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                View your listening history
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                See your top tracks and artists
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Get personalized recommendations
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Manage your playlists
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                Track currently playing music
              </li>
            </ul>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full bg-green-500 hover:bg-green-600 text-white"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Music className="mr-2 h-4 w-4" />
                  Connect with Spotify
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-black dark:via-slate-950 dark:to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
              Spotify API Showcase
            </h1>
            <p className="text-muted-foreground mt-2">
              Explore what's possible with the Spotify Web API
            </p>
          </div>
          <div className="flex items-center gap-4">
            {profile && (
              <div className="flex items-center gap-3">
                {profile.images?.[0] && (
                  <img
                    src={profile.images[0].url}
                    alt={profile.display_name}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <p className="font-semibold">{profile.display_name}</p>
                  <p className="text-sm text-muted-foreground">{profile.followers?.total} followers</p>
                </div>
              </div>
            )}
            <Button variant="outline" onClick={handleDisconnect}>
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </div>

        {/* Currently Playing */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5 text-green-500" />
                <CardTitle>Currently Playing</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchCurrentlyPlaying}
                disabled={loading.currentlyPlaying}
              >
                {loading.currentlyPlaying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {currentlyPlaying?.isPlaying && currentlyPlaying.item ? (
              <div className="flex items-center gap-4">
                <img
                  src={currentlyPlaying.item.album.images[0]?.url}
                  alt={currentlyPlaying.item.name}
                  className="w-20 h-20 rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{currentlyPlaying.item.name}</h3>
                  <p className="text-muted-foreground">
                    {currentlyPlaying.item.artists.map((a) => a.name).join(', ')}
                  </p>
                  <a
                    href={currentlyPlaying.item.external_urls.spotify}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-500 hover:underline flex items-center gap-1 mt-2"
                  >
                    Open in Spotify <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Play className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nothing is currently playing</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchCurrentlyPlaying}
                  className="mt-4"
                >
                  Check Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="top-tracks" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="top-tracks">Top Tracks</TabsTrigger>
            <TabsTrigger value="top-artists">Top Artists</TabsTrigger>
            <TabsTrigger value="recently-played">Recently Played</TabsTrigger>
            <TabsTrigger value="playlists">Playlists</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          {/* Top Tracks */}
          <TabsContent value="top-tracks" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <CardTitle>Your Top Tracks</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={timeRange}
                      onChange={(e) => {
                        setTimeRange(e.target.value as any);
                        fetchTopTracks();
                      }}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="short_term">Last 4 weeks</option>
                      <option value="medium_term">Last 6 months</option>
                      <option value="long_term">All time</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchTopTracks}
                      disabled={loading.topTracks}
                    >
                      {loading.topTracks ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Refresh'
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topTracks.map((track, index) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-8 text-center font-bold text-muted-foreground">
                        {index + 1}
                      </div>
                      <img
                        src={track.album.images[2]?.url || track.album.images[0]?.url}
                        alt={track.name}
                        className="w-16 h-16 rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold">{track.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {track.artists.map((a) => a.name).join(', ')} • {track.album.name}
                        </p>
                      </div>
                      <a
                        href={track.external_urls.spotify}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-500 hover:text-green-600"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                  {topTracks.length === 0 && !loading.topTracks && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Button onClick={fetchTopTracks}>Load Top Tracks</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Artists */}
          <TabsContent value="top-artists" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-green-500" />
                    <CardTitle>Your Top Artists</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={timeRange}
                      onChange={(e) => {
                        setTimeRange(e.target.value as any);
                        fetchTopArtists();
                      }}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="short_term">Last 4 weeks</option>
                      <option value="medium_term">Last 6 months</option>
                      <option value="long_term">All time</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchTopArtists}
                      disabled={loading.topArtists}
                    >
                      {loading.topArtists ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Refresh'
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {topArtists.map((artist) => (
                    <div
                      key={artist.id}
                      className="text-center space-y-2 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <img
                        src={artist.images[2]?.url || artist.images[0]?.url}
                        alt={artist.name}
                        className="w-full aspect-square rounded-full object-cover mx-auto"
                      />
                      <h4 className="font-semibold text-sm">{artist.name}</h4>
                      {artist.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {artist.genres.slice(0, 2).map((genre) => (
                            <Badge key={genre} variant="secondary" className="text-xs">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <a
                        href={artist.external_urls.spotify}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-500 hover:text-green-600 text-xs flex items-center justify-center gap-1"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                  {topArtists.length === 0 && !loading.topArtists && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      <Button onClick={fetchTopArtists}>Load Top Artists</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recently Played */}
          <TabsContent value="recently-played" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-green-500" />
                    <CardTitle>Recently Played</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchRecentlyPlayed}
                    disabled={loading.recentlyPlayed}
                  >
                    {loading.recentlyPlayed ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentlyPlayed.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <img
                        src={track.album.images[2]?.url || track.album.images[0]?.url}
                        alt={track.name}
                        className="w-16 h-16 rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold">{track.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {track.artists.map((a) => a.name).join(', ')} • {track.album.name}
                        </p>
                      </div>
                      <a
                        href={track.external_urls.spotify}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-500 hover:text-green-600"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                  {recentlyPlayed.length === 0 && !loading.recentlyPlayed && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Button onClick={fetchRecentlyPlayed}>Load Recently Played</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Playlists */}
          <TabsContent value="playlists" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListMusic className="h-5 w-5 text-green-500" />
                    <CardTitle>Your Playlists</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchPlaylists}
                    disabled={loading.playlists}
                  >
                    {loading.playlists ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {playlists.map((playlist) => (
                    <Card key={playlist.id} className="overflow-hidden">
                      <img
                        src={playlist.images[0]?.url}
                        alt={playlist.name}
                        className="w-full h-48 object-cover"
                      />
                      <CardHeader>
                        <CardTitle className="text-lg">{playlist.name}</CardTitle>
                        <CardDescription>
                          {playlist.description || `By ${playlist.owner.display_name}`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          {playlist.tracks.total} tracks
                        </p>
                        <a
                          href={playlist.external_urls.spotify}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-500 hover:text-green-600 text-sm flex items-center gap-1"
                        >
                          Open in Spotify <ExternalLink className="h-3 w-3" />
                        </a>
                      </CardContent>
                    </Card>
                  ))}
                  {playlists.length === 0 && !loading.playlists && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      <Button onClick={fetchPlaylists}>Load Playlists</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recommendations */}
          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-green-500" />
                    <CardTitle>Recommendations for You</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchRecommendations}
                    disabled={loading.recommendations}
                  >
                    {loading.recommendations ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Refresh'
                    )}
                  </Button>
                </div>
                <CardDescription>
                  Based on your top tracks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recommendations.map((track) => (
                    <div
                      key={track.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <img
                        src={track.album.images[2]?.url || track.album.images[0]?.url}
                        alt={track.name}
                        className="w-16 h-16 rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold">{track.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {track.artists.map((a) => a.name).join(', ')} • {track.album.name}
                        </p>
                      </div>
                      <a
                        href={track.external_urls.spotify}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-500 hover:text-green-600"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                  {recommendations.length === 0 && !loading.recommendations && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="mb-4">Load your top tracks first to get recommendations</p>
                      <Button onClick={fetchTopTracks}>Load Top Tracks</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

