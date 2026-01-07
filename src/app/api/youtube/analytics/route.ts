import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || 'all';
    
    // If 'all', don't filter by date - get all stored history
    let startDate: Date | null = null;
    if (timeRange !== 'all') {
      const days = parseInt(timeRange);
      if (!isNaN(days)) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
      }
    }

    // Pagination variables (used throughout)
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;
    const today = new Date(); // Used for streak and memory lane calculations

    // Get total count (efficient)
    let countQuery = supabase
      .from('youtube_watch_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (startDate) {
      countQuery = countQuery.gte('watched_at', startDate.toISOString());
    }

    const { count: totalVideos } = await countQuery;

    if (!totalVideos || totalVideos === 0) {
      return NextResponse.json({
        totalVideos: 0,
        uniqueVideos: 0,
        uniqueChannels: 0,
        streak: 0,
        topVideos: [],
        topChannels: [],
        watchingByHour: new Array(24).fill(0),
        watchingByDay: new Array(7).fill(0),
        timeRange: timeRange === 'all' ? 'all' : parseInt(timeRange),
        dateRange: null,
      });
    }

    // Get unique counts with pagination
    const videoIdSet = new Set<string>();
    const channelNameSet = new Set<string>();
    
    page = 0;
    hasMore = true;
    while (hasMore && page < 100) {
      let query = supabase
        .from('youtube_watch_history')
        .select('video_id, channel_name')
        .eq('user_id', userId);
      
      if (startDate) {
        query = query.gte('watched_at', startDate.toISOString());
      }

      const { data: records, error } = await query
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !records || records.length === 0) {
        hasMore = false;
        break;
      }

      records.forEach((record) => {
        videoIdSet.add(record.video_id);
        if (record.channel_name) {
          channelNameSet.add(record.channel_name);
        }
      });

      hasMore = records.length === pageSize;
      page++;
    }

    const uniqueVideos = videoIdSet.size;
    const uniqueChannels = channelNameSet.size;

    // Get top videos using aggregation query with pagination
    // Fetch all records for top videos calculation with pagination
    page = 0;
    hasMore = true;
    const videoCounts = new Map<string, {
      count: number;
      video: {
        id: string;
        title: string;
        channel_name: string | null;
        thumbnail_url: string | null;
        video_url: string;
      };
      lastWatched: Date;
    }>();

    while (hasMore && page < 100) { // Safety limit
      let query = supabase
        .from('youtube_watch_history')
        .select('video_id, video_title, channel_name, thumbnail_url, video_url, watched_at')
        .eq('user_id', userId);
      
      if (startDate) {
        query = query.gte('watched_at', startDate.toISOString());
      }

      const { data: records, error } = await query
        .order('watched_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !records || records.length === 0) {
        hasMore = false;
        break;
      }

      records.forEach((record) => {
        const existing = videoCounts.get(record.video_id);
        const watchedAt = new Date(record.watched_at);
        if (existing) {
          existing.count++;
          if (watchedAt > existing.lastWatched) {
            existing.lastWatched = watchedAt;
          }
        } else {
          videoCounts.set(record.video_id, {
            count: 1,
            video: {
              id: record.video_id,
              title: record.video_title,
              channel_name: record.channel_name,
              thumbnail_url: record.thumbnail_url,
              video_url: record.video_url,
            },
            lastWatched: watchedAt,
          });
        }
      });

      hasMore = records.length === pageSize;
      page++;
    }

    const topVideosListResult = Array.from(videoCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    // Get top channels with pagination
    const channelCounts = new Map<string, {
      count: number;
      name: string;
      channel_url: string | null;
    }>();

    page = 0;
    hasMore = true;
    while (hasMore && page < 100) {
      let query = supabase
        .from('youtube_watch_history')
        .select('channel_name, channel_url')
        .eq('user_id', userId);
      
      if (startDate) {
        query = query.gte('watched_at', startDate.toISOString());
      }

      const { data: records, error } = await query
        .order('watched_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !records || records.length === 0) {
        hasMore = false;
        break;
      }

      records.forEach((record) => {
        if (record.channel_name) {
          const existing = channelCounts.get(record.channel_name);
          if (existing) {
            existing.count++;
          } else {
            channelCounts.set(record.channel_name, {
              count: 1,
              name: record.channel_name,
              channel_url: record.channel_url,
            });
          }
        }
      });

      hasMore = records.length === pageSize;
      page++;
    }

    const topChannelsList = Array.from(channelCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    // Get watching patterns by hour and day with pagination
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    const uniqueDates = new Set<string>();

    page = 0;
    hasMore = true;
    while (hasMore && page < 100) {
      let query = supabase
        .from('youtube_watch_history')
        .select('watched_at')
        .eq('user_id', userId);
      
      if (startDate) {
        query = query.gte('watched_at', startDate.toISOString());
      }

      const { data: records, error } = await query
        .order('watched_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !records || records.length === 0) {
        hasMore = false;
        break;
      }

      records.forEach((record) => {
        const watchedAt = new Date(record.watched_at);
        const hour = watchedAt.getHours();
        const day = watchedAt.getDay();
        hourCounts[hour]++;
        dayCounts[day]++;
        uniqueDates.add(watchedAt.toDateString());
      });

      hasMore = records.length === pageSize;
      page++;
    }

    // Get watching streak
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      if (uniqueDates.has(checkDate.toDateString())) {
        streak++;
      } else {
        break;
      }
    }

    // Get date range using min/max queries
    let oldestQuery = supabase
      .from('youtube_watch_history')
      .select('watched_at')
      .eq('user_id', userId);
    
    if (startDate) {
      oldestQuery = oldestQuery.gte('watched_at', startDate.toISOString());
    }

    const { data: oldestRecord } = await oldestQuery
      .order('watched_at', { ascending: true })
      .limit(1)
      .single();

    let newestQuery = supabase
      .from('youtube_watch_history')
      .select('watched_at')
      .eq('user_id', userId);
    
    if (startDate) {
      newestQuery = newestQuery.gte('watched_at', startDate.toISOString());
    }

    const { data: newestRecord } = await newestQuery
      .order('watched_at', { ascending: false })
      .limit(1)
      .single();

    const oldestDate = oldestRecord ? new Date(oldestRecord.watched_at) : new Date();
    const newestDate = newestRecord ? new Date(newestRecord.watched_at) : new Date();
    const daysBack = Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate monthly and yearly trends
    const monthlyTrends = new Map<string, number>();
    const yearlyTrends = new Map<string, number>();
    const channelDiscovery = new Map<string, string>(); // channel -> first watched date
    const bingeSessions: Array<{ date: string; count: number; videos: string[] }> = [];
    const memoryLane: Array<{ year: number; videos: Array<{ title: string; channel: string; url: string; date: string }> }> = [];

    // Process all records for trends and additional analytics
    page = 0;
    hasMore = true;
    const todayMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const todayDay = today.getDate();
    const todayMonthNum = today.getMonth() + 1;

    // Group records by date for binge detection
    const recordsByDate = new Map<string, Array<{ video_id: string; watched_at: Date }>>();

    while (hasMore && page < 100) {
      let query = supabase
        .from('youtube_watch_history')
        .select('video_id, video_title, channel_name, video_url, watched_at')
        .eq('user_id', userId);
      
      if (startDate) {
        query = query.gte('watched_at', startDate.toISOString());
      }

      const { data: records, error } = await query
        .order('watched_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !records || records.length === 0) {
        hasMore = false;
        break;
      }

      records.forEach((record) => {
        const watchedAt = new Date(record.watched_at);
        const year = watchedAt.getFullYear();
        const month = `${year}-${String(watchedAt.getMonth() + 1).padStart(2, '0')}`;
        const dateKey = watchedAt.toDateString();

        // Monthly trends
        monthlyTrends.set(month, (monthlyTrends.get(month) || 0) + 1);
        
        // Yearly trends
        yearlyTrends.set(String(year), (yearlyTrends.get(String(year)) || 0) + 1);

        // Channel discovery (first time watching a channel)
        if (record.channel_name) {
          if (!channelDiscovery.has(record.channel_name)) {
            channelDiscovery.set(record.channel_name, watchedAt.toISOString());
          }
        }

        // Group by date for binge detection
        if (!recordsByDate.has(dateKey)) {
          recordsByDate.set(dateKey, []);
        }
        recordsByDate.get(dateKey)!.push({
          video_id: record.video_id,
          watched_at: watchedAt,
        });

        // Memory lane: videos watched on this day in previous years
        if (watchedAt.getMonth() + 1 === todayMonthNum && watchedAt.getDate() === todayDay && watchedAt.getFullYear() < today.getFullYear()) {
          const yearKey = watchedAt.getFullYear();
          if (!memoryLane.find(m => m.year === yearKey)) {
            memoryLane.push({ year: yearKey, videos: [] });
          }
          const memoryEntry = memoryLane.find(m => m.year === yearKey)!;
          if (memoryEntry.videos.length < 5) {
            memoryEntry.videos.push({
              title: record.video_title,
              channel: record.channel_name || 'Unknown',
              url: record.video_url,
              date: watchedAt.toISOString(),
            });
          }
        }
      });

      hasMore = records.length === pageSize;
      page++;
    }

    // Detect binge sessions (days with 10+ videos watched)
    recordsByDate.forEach((videos, date) => {
      if (videos.length >= 10) {
        bingeSessions.push({
          date,
          count: videos.length,
          videos: [...new Set(videos.map(v => v.video_id))],
        });
      }
    });

    // Sort binge sessions by count
    bingeSessions.sort((a, b) => b.count - a.count);

    // Get top channels by year
    const topChannelsByYear = new Map<string, Map<string, number>>();
    page = 0;
    hasMore = true;

    while (hasMore && page < 100) {
      let query = supabase
        .from('youtube_watch_history')
        .select('channel_name, watched_at')
        .eq('user_id', userId);
      
      if (startDate) {
        query = query.gte('watched_at', startDate.toISOString());
      }

      const { data: records, error } = await query
        .order('watched_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !records || records.length === 0) {
        hasMore = false;
        break;
      }

      records.forEach((record) => {
        if (record.channel_name) {
          const year = String(new Date(record.watched_at).getFullYear());
          if (!topChannelsByYear.has(year)) {
            topChannelsByYear.set(year, new Map());
          }
          const yearChannels = topChannelsByYear.get(year)!;
          yearChannels.set(record.channel_name, (yearChannels.get(record.channel_name) || 0) + 1);
        }
      });

      hasMore = records.length === pageSize;
      page++;
    }

    // Format top channels by year
    const topChannelsByYearFormatted: Record<string, Array<{ name: string; count: number }>> = {};
    topChannelsByYear.forEach((channels, year) => {
      topChannelsByYearFormatted[year] = Array.from(channels.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    });

    // Format monthly and yearly trends for charts
    const monthlyTrendsArray = Array.from(monthlyTrends.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const yearlyTrendsArray = Array.from(yearlyTrends.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year));

    // Format channel discovery timeline
    const channelDiscoveryArray = Array.from(channelDiscovery.entries())
      .map(([channel, firstWatched]) => ({ channel, firstWatched }))
      .sort((a, b) => new Date(a.firstWatched).getTime() - new Date(b.firstWatched).getTime());

    return NextResponse.json({
      totalVideos: totalVideos || 0,
      uniqueVideos,
      uniqueChannels,
      streak,
      topVideos: topVideosListResult,
      topChannels: topChannelsList,
      watchingByHour: hourCounts,
      watchingByDay: dayCounts,
      timeRange: timeRange === 'all' ? 'all' : parseInt(timeRange),
      dateRange: {
        oldest: oldestDate.toISOString(),
        newest: newestDate.toISOString(),
        daysBack,
      },
      // New analytics
      monthlyTrends: monthlyTrendsArray,
      yearlyTrends: yearlyTrendsArray,
      topChannelsByYear: topChannelsByYearFormatted,
      channelDiscovery: channelDiscoveryArray.slice(0, 50), // Last 50 discovered channels
      bingeSessions: bingeSessions.slice(0, 10), // Top 10 binge sessions
      memoryLane: memoryLane.sort((a, b) => b.year - a.year), // Most recent years first
    });
  } catch (error: any) {
    console.error('Error fetching YouTube analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

