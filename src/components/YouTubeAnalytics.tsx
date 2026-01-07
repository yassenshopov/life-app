'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrendingUp, Clock, Video, Users, Calendar, Zap, RefreshCw, ExternalLink, History, Sparkles, BarChart3 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { getDefaultBgColor, getDominantColor } from '@/lib/youtube-color';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format, parseISO } from 'date-fns';

// Top Video Card Component
function TopVideoCard({ video, index }: {
  video: {
    count: number;
    video: {
      id: string;
      title: string;
      channel_name: string | null;
      thumbnail_url: string | null;
      video_url: string;
    };
    lastWatched: Date;
  };
  index: number;
}) {
  const [bgColor, setBgColor] = React.useState<string>(() => getDefaultBgColor());
  const imageUrl = video.video.thumbnail_url;

  React.useEffect(() => {
    let mounted = true;
    if (imageUrl) {
      getDominantColor(imageUrl)
        .then((color) => {
          if (mounted) {
            setBgColor(color);
          }
        })
        .catch(() => {
          if (mounted) {
            setBgColor(getDefaultBgColor());
          }
        });
    } else {
      if (mounted) {
        setBgColor(getDefaultBgColor());
      }
    }
    return () => {
      mounted = false;
    };
  }, [imageUrl]);

  const cardContent = (
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
           <div className="relative w-20 h-12 rounded overflow-hidden flex-shrink-0" style={{ aspectRatio: '16/9' }}>
             {imageUrl ? (
               <img
                 src={imageUrl}
                 alt={video.video.title}
                 className="w-full h-full object-cover"
               />
             ) : (
               <div className="w-full h-full bg-white/20 flex items-center justify-center">
                 <Video className="w-6 h-6 text-white/60" />
               </div>
             )}
           </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-sm truncate">{video.video.title}</div>
            <p className="text-white/80 text-xs truncate">
              {video.video.channel_name || 'Unknown Channel'}
            </p>
            <div className="text-white/60 text-xs truncate">
              {video.count} {video.count === 1 ? 'watch' : 'watches'}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-white/80 text-xs font-bold">#{index + 1}</span>
            <ExternalLink className="w-4 h-4 text-white/60" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <a
      href={video.video.video_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      {cardContent}
    </a>
  );
}

// Top Channel Card Component
function TopChannelCard({ channel, index }: {
  channel: {
    count: number;
    name: string;
    channel_url: string | null;
  };
  index: number;
}) {
  return (
    <div className="rounded-lg border p-3 hover:bg-accent transition-colors">
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-red-500 flex items-center justify-center">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{channel.name}</div>
          <div className="text-muted-foreground text-xs truncate">
            {channel.count} {channel.count === 1 ? 'video' : 'videos'}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-muted-foreground text-xs font-bold">#{index + 1}</span>
          {channel.channel_url && (
            <a
              href={channel.channel_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

interface AnalyticsData {
  totalVideos: number;
  uniqueVideos: number;
  uniqueChannels: number;
  streak: number;
  topVideos: Array<{
    count: number;
    video: {
      id: string;
      title: string;
      channel_name: string | null;
      thumbnail_url: string | null;
      video_url: string;
    };
    lastWatched: Date;
  }>;
  topChannels: Array<{
    count: number;
    name: string;
    channel_url: string | null;
  }>;
  watchingByHour: number[];
  watchingByDay: number[];
  timeRange: number | 'all';
  dateRange?: {
    oldest: string;
    newest: string;
    daysBack: number;
  };
  monthlyTrends?: Array<{ month: string; count: number }>;
  yearlyTrends?: Array<{ year: string; count: number }>;
  topChannelsByYear?: Record<string, Array<{ name: string; count: number }>>;
  channelDiscovery?: Array<{ channel: string; firstWatched: string }>;
  bingeSessions?: Array<{ date: string; count: number; videos: string[] }>;
  memoryLane?: Array<{ year: number; videos: Array<{ title: string; channel: string; url: string; date: string }> }>;
}

export function YouTubeAnalytics() {
  const [analytics, setAnalytics] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState<number | 'all'>(30);

  const fetchAnalytics = React.useCallback(async () => {
    setLoading(true);
    try {
      const rangeParam = timeRange === 'all' ? 'all' : timeRange.toString();
      const response = await fetch(`/api/youtube/analytics?range=${rangeParam}`);
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

  if (!analytics || analytics.totalVideos === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Data Available</CardTitle>
          <CardDescription>Sync your YouTube watch history to see analytics</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const maxHour = Math.max(...analytics.watchingByHour, 1);
  const maxDay = Math.max(...analytics.watchingByDay, 1);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Watch History Analytics</h2>
          <p className="text-muted-foreground">Insights from your YouTube watch history</p>
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
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalVideos.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.uniqueVideos} unique videos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Channels Watched</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.uniqueChannels}</div>
            <p className="text-xs text-muted-foreground">unique channels</p>
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
              {analytics.timeRange === 'all' && analytics.dateRange
                ? Math.round(analytics.totalVideos / Math.max(analytics.dateRange.daysBack, 1))
                : analytics.timeRange === 'all'
                ? analytics.totalVideos
                : Math.round(analytics.totalVideos / analytics.timeRange)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.timeRange === 'all' ? 'videos total' : 'videos per day'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Watching Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Watching by Hour</CardTitle>
            <CardDescription>Your most active watching times</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.watchingByHour.map((count, hour) => (
                <div key={hour} className="flex items-center gap-3">
                  <div className="w-12 text-xs text-muted-foreground text-right">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 transition-all"
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
            <CardTitle>Watching by Day</CardTitle>
            <CardDescription>Your weekly watching patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.watchingByDay.map((count, day) => (
                <div key={day} className="flex items-center gap-3">
                  <div className="w-12 text-xs text-muted-foreground text-right">
                    {dayNames[day]}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 transition-all"
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

      {/* Top Videos and Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Videos</CardTitle>
            <CardDescription>
              Your most watched videos ({analytics.topVideos.length} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.topVideos.length > 0 ? (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {analytics.topVideos.map((video, index) => (
                    <TopVideoCard key={video.video.id} video={video} index={index} />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No video data available.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Channels</CardTitle>
            <CardDescription>
              Your most watched channels ({analytics.topChannels.length} total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.topChannels.length > 0 ? (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-2">
                  {analytics.topChannels.map((channel, index) => (
                    <TopChannelCard key={channel.name} channel={channel} index={index} />
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No channel data available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly & Yearly Trends */}
      {analytics.monthlyTrends && analytics.monthlyTrends.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Trends</CardTitle>
              <CardDescription>Watch volume over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.monthlyTrends}>
                  <defs>
                    <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => {
                      try {
                        const [year, month] = value.split('-');
                        return `${month}/${year.slice(2)}`;
                      } catch {
                        return value;
                      }
                    }}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-2 shadow-lg">
                            <p className="font-semibold">{payload[0].payload.month}</p>
                            <p className="text-sm text-muted-foreground">
                              {payload[0].value} videos
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#ef4444"
                    fill="url(#monthlyGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Yearly Trends</CardTitle>
              <CardDescription>Watch volume by year</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.yearlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg p-2 shadow-lg">
                            <p className="font-semibold">{payload[0].payload.year}</p>
                            <p className="text-sm text-muted-foreground">
                              {payload[0].value} videos
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top Channels by Year */}
      {analytics.topChannelsByYear && Object.keys(analytics.topChannelsByYear).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Top Channels by Year
            </CardTitle>
            <CardDescription>Your most watched channels each year</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={Object.keys(analytics.topChannelsByYear).sort().reverse()[0]} className="w-full">
              <TabsList className="flex flex-wrap gap-1">
                {Object.keys(analytics.topChannelsByYear)
                  .sort()
                  .reverse()
                  .map((year) => (
                    <TabsTrigger key={year} value={year}>
                      {year}
                    </TabsTrigger>
                  ))}
              </TabsList>
              {Object.entries(analytics.topChannelsByYear)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([year, channels]) => (
                  <TabsContent key={year} value={year} className="mt-4">
                    <div className="space-y-2">
                      {channels.map((channel, index) => (
                        <div
                          key={channel.name}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-muted-foreground font-bold w-6">#{index + 1}</span>
                            <div>
                              <p className="font-semibold">{channel.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {channel.count} {channel.count === 1 ? 'video' : 'videos'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Channel Discovery Timeline */}
      {analytics.channelDiscovery && analytics.channelDiscovery.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Channel Discovery Timeline
            </CardTitle>
            <CardDescription>When you first discovered your favorite channels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {analytics.channelDiscovery.slice(0, 30).map((discovery, index) => (
                <div
                  key={discovery.channel}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{discovery.channel}</p>
                      <p className="text-xs text-muted-foreground">
                        First watched {format(parseISO(discovery.firstWatched), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Binge Sessions */}
      {analytics.bingeSessions && analytics.bingeSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Binge Sessions
            </CardTitle>
            <CardDescription>Days you watched 10+ videos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.bingeSessions.map((binge, index) => {
                // Parse date string (format: "Mon Jan 01 2024")
                const bingeDate = new Date(binge.date);
                return (
                  <div
                    key={binge.date}
                    className="flex items-center justify-between p-4 rounded-lg border bg-red-50 dark:bg-red-950/20"
                  >
                    <div>
                      <p className="font-semibold">
                        {format(bingeDate, 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {binge.count} videos watched • {binge.videos.length} unique videos
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-red-500">{binge.count}</p>
                      <p className="text-xs text-muted-foreground">videos</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Memory Lane */}
      {analytics.memoryLane && analytics.memoryLane.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Memory Lane
            </CardTitle>
            <CardDescription>What you were watching on this day in previous years</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {analytics.memoryLane.map((memory) => (
                <div key={memory.year} className="space-y-3">
                  <h3 className="text-lg font-semibold">{memory.year}</h3>
                  <div className="space-y-2">
                    {memory.videos.map((video, index) => (
                      <a
                        key={index}
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <Video className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{video.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {video.channel} • {format(parseISO(video.date), 'MMM d')}
                          </p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Date Range Info */}
      {analytics.dateRange && (
        <Card>
          <CardHeader>
            <CardTitle>History Range</CardTitle>
            <CardDescription>Your watch history spans this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-muted-foreground">Oldest video</p>
                <p className="font-semibold">
                  {new Date(analytics.dateRange.oldest).toLocaleDateString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">Total span</p>
                <p className="font-semibold">{analytics.dateRange.daysBack} days</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Newest video</p>
                <p className="font-semibold">
                  {new Date(analytics.dateRange.newest).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

