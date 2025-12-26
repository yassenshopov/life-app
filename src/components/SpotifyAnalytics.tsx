'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Clock, Music, Users, Calendar, Zap, RefreshCw } from 'lucide-react';

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
  }>;
  listeningByHour: number[];
  listeningByDay: number[];
  timeRange: number | 'all';
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
        // Refresh analytics after syncing
        await fetchAnalytics();
      }
    } catch (error) {
      console.error('Error syncing history:', error);
    } finally {
      setSyncing(false);
    }
  };

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          <Button onClick={syncHistory} disabled={syncing} variant="outline">
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync
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
            <CardDescription>Your most played songs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topTracks.map((item, index) => (
                <div
                  key={item.track.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="w-8 text-center font-bold text-muted-foreground">
                    {index + 1}
                  </div>
                  {item.track.image && (
                    <img
                      src={item.track.image}
                      alt={item.track.name}
                      className="w-12 h-12 rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{item.track.name}</h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.track.artists.join(', ')}
                    </p>
                  </div>
                  <Badge variant="secondary">{item.count} plays</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Artists</CardTitle>
            <CardDescription>Your most listened artists</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topArtists.map((artist, index) => (
                <div
                  key={artist.name}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="w-8 text-center font-bold text-muted-foreground">
                    {index + 1}
                  </div>
                  <Users className="w-8 h-8 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold truncate">{artist.name}</h4>
                  </div>
                  <Badge variant="secondary">{artist.count} plays</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

