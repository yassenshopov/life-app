'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Clock, Music, Users, Calendar, Zap, RefreshCw, ExternalLink } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { getDefaultBgColor, getDominantColor } from '@/lib/spotify-color';

// Top Track Card Component with album art and color extraction
function TopTrackCard({ track }: {
  track: {
    id: string;
    name: string;
    rank: number;
    album_image_url?: string;
    artist_names?: string[];
    album_name?: string;
    external_url?: string;
  };
}) {
  const [bgColor, setBgColor] = React.useState<string>(() => getDefaultBgColor());
  const imageUrl = track.album_image_url;

  React.useEffect(() => {
    if (imageUrl) {
      getDominantColor(imageUrl)
        .then((color) => {
          setBgColor(color);
        })
        .catch(() => {
          setBgColor(getDefaultBgColor());
        });
    } else {
      setBgColor(getDefaultBgColor());
    }
  }, [imageUrl]);

  return (
    <div
      className="rounded-lg border border-white/10 transition-all duration-500 overflow-hidden cursor-pointer hover:scale-[1.02]"
      style={
        {
          backgroundColor: bgColor || getDefaultBgColor(),
          background: bgColor || getDefaultBgColor(),
        } as React.CSSProperties
      }
      onClick={() => {
        if (track.external_url) {
          window.open(track.external_url, '_blank');
        }
      }}
    >
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={track.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-white/20 flex items-center justify-center">
                <Music className="w-6 h-6 text-white/60" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm truncate">{track.name}</div>
            <p className="text-white/80 text-xs truncate">
              {track.artist_names?.join(', ') || 'Unknown Artist'}
            </p>
            {track.album_name && (
              <p className="text-white/60 text-xs truncate">{track.album_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-white/80 text-xs font-bold">#{track.rank}</span>
            {track.external_url && (
              <ExternalLink className="w-4 h-4 text-white/60" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Top Artist Card Component
function TopArtistCard({ artist }: {
  artist: {
    id: string;
    name: string;
    rank: number;
    image_url?: string;
    external_url?: string;
  };
}) {
  const [bgColor, setBgColor] = React.useState<string>(() => getDefaultBgColor());
  const imageUrl = artist.image_url;

  React.useEffect(() => {
    if (imageUrl) {
      getDominantColor(imageUrl)
        .then((color) => {
          setBgColor(color);
        })
        .catch(() => {
          setBgColor(getDefaultBgColor());
        });
    } else {
      setBgColor(getDefaultBgColor());
    }
  }, [imageUrl]);

  return (
    <div
      className="rounded-lg border border-white/10 transition-all duration-500 overflow-hidden cursor-pointer hover:scale-[1.02]"
      style={
        {
          backgroundColor: bgColor || getDefaultBgColor(),
          background: bgColor || getDefaultBgColor(),
        } as React.CSSProperties
      }
      onClick={() => {
        if (artist.external_url) {
          window.open(artist.external_url, '_blank');
        }
      }}
    >
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-white/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-white/60" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm truncate">{artist.name}</div>
            <div className="text-white/60 text-xs truncate">&nbsp;</div> {/* Spacer for height matching */}
            <div className="text-white/60 text-xs truncate">&nbsp;</div> {/* Spacer for height matching */}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-white/80 text-xs font-bold">#{artist.rank}</span>
            {artist.external_url && (
              <ExternalLink className="w-4 h-4 text-white/60" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Personal Track Card Component (for user's listening history)
function PersonalTrackCard({ item, index }: {
  item: {
    count: number;
    track: {
      id: string;
      name: string;
      artists: string[];
      image: string;
    };
    lastPlayed: Date;
  };
  index: number;
}) {
  const [bgColor, setBgColor] = React.useState<string>(() => getDefaultBgColor());
  const imageUrl = item.track.image;

  React.useEffect(() => {
    if (imageUrl) {
      getDominantColor(imageUrl)
        .then((color) => {
          setBgColor(color);
        })
        .catch(() => {
          setBgColor(getDefaultBgColor());
        });
    } else {
      setBgColor(getDefaultBgColor());
    }
  }, [imageUrl]);

  return (
    <div
      className="rounded-lg border border-white/10 transition-all duration-500 overflow-hidden cursor-pointer hover:scale-[1.02]"
      style={
        {
          backgroundColor: bgColor || getDefaultBgColor(),
          background: bgColor || getDefaultBgColor(),
        } as React.CSSProperties
      }
    >
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={item.track.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-white/20 flex items-center justify-center">
                <Music className="w-6 h-6 text-white/60" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm truncate">{item.track.name}</div>
            <p className="text-white/80 text-xs truncate">
              {item.track.artists.join(', ')}
            </p>
            <div className="text-white/60 text-xs truncate">
              {item.count} plays
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-white/80 text-xs font-bold">#{index + 1}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Personal Artist Card Component (for user's listening history)
function PersonalArtistCard({ artist, index }: {
  artist: {
    count: number;
    name: string;
    image_url?: string;
  };
  index: number;
}) {
  const [bgColor, setBgColor] = React.useState<string>(() => getDefaultBgColor());
  const imageUrl = artist.image_url;

  React.useEffect(() => {
    if (imageUrl) {
      getDominantColor(imageUrl)
        .then((color) => {
          setBgColor(color);
        })
        .catch(() => {
          setBgColor(getDefaultBgColor());
        });
    } else {
      setBgColor(getDefaultBgColor());
    }
  }, [imageUrl]);

  return (
    <div
      className="rounded-lg border border-white/10 transition-all duration-500 overflow-hidden cursor-pointer hover:scale-[1.02]"
      style={
        {
          backgroundColor: bgColor || getDefaultBgColor(),
          background: bgColor || getDefaultBgColor(),
        } as React.CSSProperties
      }
    >
      <div className="p-3">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-white/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-white/60" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm truncate">{artist.name}</div>
            <div className="text-white/60 text-xs truncate">&nbsp;</div> {/* Spacer for height matching */}
            <div className="text-white/60 text-xs truncate">
              {artist.count} plays
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-white/80 text-xs font-bold">#{index + 1}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AnalyticsData {
  totalMinutes: number;
  totalPlays: number;
  uniqueTracks: number;
  streak: number;
  topTracks: Array<{
    count: number;
    track: {
      id: string;
      name: string;
      artists: string[];
      image: string;
    };
    lastPlayed: Date;
  }>;
  topArtists: Array<{
    count: number;
    name: string;
    image_url?: string;
  }>;
  listeningByHour: number[];
  listeningByDay: number[];
  timeRange: number | 'all';
  hasTopData?: boolean;
  topTracksByTimeRange?: Record<string, Array<{
    id: string;
    name: string;
    rank: number;
    album_image_url?: string;
    artist_names?: string[];
    album_name?: string;
    external_url?: string;
  }>>;
  topArtistsByTimeRange?: Record<string, Array<{
    id: string;
    name: string;
    rank: number;
    image_url?: string;
    external_url?: string;
  }>>;
}

export function SpotifyAnalytics() {
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [timeRange, setTimeRange] = React.useState<number | 'all'>(30);

  const fetchAnalytics = React.useCallback(async () => {
    setLoading(true);
    try {
      const rangeParam = timeRange === 'all' ? 'all' : timeRange.toString();
      const response = await fetch(`/api/spotify/analytics?range=${rangeParam}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const syncHistory = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/spotify/sync-history', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        console.log('Sync result:', data);
        // Show a brief message about what was synced
        if (data.note) {
          console.info(data.note);
        }
        // Refresh analytics after syncing
        await fetchAnalytics();
      }
    } catch (error) {
      console.error('Error syncing history:', error);
    } finally {
      setSyncing(false);
    }
  };

  const [syncingTop, setSyncingTop] = React.useState(false);

  const syncTopData = async () => {
    setSyncingTop(true);
    try {
      const response = await fetch('/api/spotify/sync-top-data', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        console.log('Top data sync result:', data);
        // Refresh analytics after syncing
        await fetchAnalytics();
      }
    } catch (error) {
      console.error('Error syncing top data:', error);
    } finally {
      setSyncingTop(false);
    }
  };

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" className="text-muted-foreground" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Data Available</CardTitle>
          <CardDescription>Sync your listening history to see analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={syncHistory} disabled={syncing}>
            {syncing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync History
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const maxHour = Math.max(...analytics.listeningByHour);
  const maxDay = Math.max(...analytics.listeningByDay);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      {/* Header with Sync Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Listening Analytics</h2>
          <p className="text-muted-foreground">Insights from your listening history</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="text-sm border rounded px-3 py-1.5 bg-background"
          >
            <option value="all">All time</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <Button onClick={syncHistory} disabled={syncing} variant="outline" title="Sync recently played tracks (last 50)">
            {syncing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync History
              </>
            )}
          </Button>
          <Button onClick={syncTopData} disabled={syncingTop} variant="outline" title="Sync top tracks/artists (4 weeks, 6 months, several years)">
            {syncingTop ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Top Data
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Listening</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(analytics.totalMinutes / 60)}h</div>
            <p className="text-xs text-muted-foreground">
              {Math.round(analytics.totalMinutes % 60)} minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plays</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalPlays.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.uniqueTracks} unique tracks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.streak}</div>
            <p className="text-xs text-muted-foreground">consecutive days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg per Day</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.timeRange === 'all' 
                ? analytics.totalPlays 
                : Math.round(analytics.totalPlays / analytics.timeRange)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.timeRange === 'all' ? 'total plays' : 'plays per day'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Listening Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Listening by Hour</CardTitle>
            <CardDescription>Your most active listening times</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.listeningByHour.map((count, hour) => (
                <div key={hour} className="flex items-center gap-3">
                  <div className="w-12 text-xs text-muted-foreground text-right">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${(count / maxHour) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-8 text-xs text-muted-foreground text-right">
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Listening by Day</CardTitle>
            <CardDescription>Your weekly listening patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.listeningByDay.map((count, day) => (
                <div key={day} className="flex items-center gap-3">
                  <div className="w-12 text-xs text-muted-foreground text-right">
                    {dayNames[day]}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${(count / maxDay) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-8 text-xs text-muted-foreground text-right">
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Tracks and Artists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Tracks</CardTitle>
            <CardDescription>
              {analytics.hasTopData 
                ? 'From your listening history (sync top data for Spotify\'s aggregated rankings)' 
                : 'Your most played songs'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.topTracks.length > 0 ? (
                analytics.topTracks.slice(0, 5).map((item, index) => (
                  <PersonalTrackCard key={item.track.id} item={item} index={index} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No track data available. Sync your history to see top tracks.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Artists</CardTitle>
            <CardDescription>
              {analytics.hasTopData 
                ? 'From your listening history (sync top data for Spotify\'s aggregated rankings)' 
                : 'Your most listened artists'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.topArtists.length > 0 ? (
                analytics.topArtists.slice(0, 5).map((artist, index) => (
                  <PersonalArtistCard key={artist.name} artist={artist} index={index} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No artist data available. Sync your history to see top artists.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spotify's Top Data by Time Range */}
      {analytics.hasTopData && (analytics.topTracksByTimeRange || analytics.topArtistsByTimeRange) && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold mb-2">Spotify's Top Rankings</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Aggregated data from Spotify across different time periods
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Tracks Section */}
            {analytics.topTracksByTimeRange && Object.values(analytics.topTracksByTimeRange).some(arr => arr.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Tracks</CardTitle>
                  <CardDescription>Your most played songs by time period</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="short_term" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="short_term">4 Weeks</TabsTrigger>
                      <TabsTrigger value="medium_term">6 Months</TabsTrigger>
                      <TabsTrigger value="long_term">All Time</TabsTrigger>
                    </TabsList>
                    {(['short_term', 'medium_term', 'long_term'] as const).map((timeRange) => {
                      const tracks = analytics.topTracksByTimeRange?.[timeRange] || [];
                      return (
                        <TabsContent key={timeRange} value={timeRange} className="space-y-2 mt-4">
                          {tracks.slice(0, 5).map((track) => (
                            <TopTrackCard key={track.id} track={track} />
                          ))}
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {/* Top Artists Section */}
            {analytics.topArtistsByTimeRange && Object.values(analytics.topArtistsByTimeRange).some(arr => arr.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Artists</CardTitle>
                  <CardDescription>Your most listened artists by time period</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="short_term" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="short_term">4 Weeks</TabsTrigger>
                      <TabsTrigger value="medium_term">6 Months</TabsTrigger>
                      <TabsTrigger value="long_term">All Time</TabsTrigger>
                    </TabsList>
                    {(['short_term', 'medium_term', 'long_term'] as const).map((timeRange) => {
                      const artists = analytics.topArtistsByTimeRange?.[timeRange] || [];
                      return (
                        <TabsContent key={timeRange} value={timeRange} className="space-y-2 mt-4">
                          {artists.slice(0, 5).map((artist) => (
                            <TopArtistCard key={artist.id} artist={artist} />
                          ))}
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

