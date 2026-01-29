import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

// Cache TTL in seconds based on time range
function getCacheTTL(timeRange: string): number {
  if (timeRange === 'all') return 300; // 5 minutes for full history
  const days = parseInt(timeRange);
  if (days <= 7) return 60; // 1 minute for weekly
  if (days <= 30) return 120; // 2 minutes for monthly
  return 180; // 3 minutes for longer ranges
}

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

    // Pagination variables
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;
    const today = new Date(); // Used for streak and memory lane calculations
    const todayDay = today.getDate();
    const todayMonthNum = today.getMonth() + 1;

    // Get total count (efficient HEAD request)
    let countQuery = supabase
      .from('youtube_watch_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (startDate) {
      countQuery = countQuery.gte('watched_at', startDate.toISOString());
    }

    const { count: totalVideos } = await countQuery;

    if (!totalVideos || totalVideos === 0) {
      const emptyResponse = NextResponse.json({
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
      emptyResponse.headers.set('Cache-Control', `public, s-maxage=${getCacheTTL(timeRange)}, stale-while-revalidate=60`);
      return emptyResponse;
    }

    // ============================================
    // SINGLE PAGINATED LOOP - Aggregate everything in memory
    // ============================================
    
    // Unique sets
    const videoIdSet = new Set<string>();
    const channelNameSet = new Set<string>();
    
    // Video counts for top videos
    const videoCounts = new Map<
      string,
      {
        count: number;
        video: {
          id: string;
          title: string;
          channel_name: string | null;
          thumbnail_url: string | null;
          video_url: string;
        };
        lastWatched: Date;
      }
    >();
    
    // Channel counts for top channels
    const channelCounts = new Map<
      string,
      {
        count: number;
        name: string;
        channel_url: string | null;
      }
    >();
    
    // Watching patterns
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    const uniqueDates = new Set<string>();
    
    // Trends
    const monthlyTrends = new Map<string, number>();
    const yearlyTrends = new Map<string, number>();
    const channelDiscovery = new Map<string, string>(); // channel -> first watched date
    const topChannelsByYear = new Map<string, Map<string, number>>();
    
    // Binge detection
    const recordsByDate = new Map<string, Array<{ video_id: string; watched_at: Date }>>();
    
    // Memory lane
    const memoryLane: Array<{
      year: number;
      videos: Array<{ title: string; channel: string; url: string; date: string }>;
    }> = [];
    
    // Date range tracking
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;
    
    // Single paginated loop fetching all required columns
    while (hasMore && page < 100) {
      let query = supabase
        .from('youtube_watch_history')
        .select('video_id, video_title, channel_name, channel_url, thumbnail_url, video_url, watched_at')
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

      // Process each record once, aggregating all metrics
      for (const record of records) {
        const watchedAt = new Date(record.watched_at);
        const year = watchedAt.getFullYear();
        const yearStr = String(year);
        const month = `${year}-${String(watchedAt.getMonth() + 1).padStart(2, '0')}`;
        const dateKey = watchedAt.toDateString();
        const hour = watchedAt.getHours();
        const day = watchedAt.getDay();

        // Track unique videos and channels
        videoIdSet.add(record.video_id);
        if (record.channel_name) {
          channelNameSet.add(record.channel_name);
        }

        // Video counts (for top videos)
        const existingVideo = videoCounts.get(record.video_id);
        if (existingVideo) {
          existingVideo.count++;
          if (watchedAt > existingVideo.lastWatched) {
            existingVideo.lastWatched = watchedAt;
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

        // Channel counts (for top channels)
        if (record.channel_name) {
          const existingChannel = channelCounts.get(record.channel_name);
          if (existingChannel) {
            existingChannel.count++;
          } else {
            channelCounts.set(record.channel_name, {
              count: 1,
              name: record.channel_name,
              channel_url: record.channel_url,
            });
          }
        }

        // Watching patterns
        hourCounts[hour]++;
        dayCounts[day]++;
        uniqueDates.add(dateKey);

        // Monthly and yearly trends
        monthlyTrends.set(month, (monthlyTrends.get(month) || 0) + 1);
        yearlyTrends.set(yearStr, (yearlyTrends.get(yearStr) || 0) + 1);

        // Channel discovery (track earliest watch date per channel)
        if (record.channel_name) {
          const existingDate = channelDiscovery.get(record.channel_name);
          if (!existingDate || watchedAt < new Date(existingDate)) {
            channelDiscovery.set(record.channel_name, watchedAt.toISOString());
          }
        }

        // Top channels by year
        if (record.channel_name) {
          if (!topChannelsByYear.has(yearStr)) {
            topChannelsByYear.set(yearStr, new Map());
          }
          const yearChannels = topChannelsByYear.get(yearStr)!;
          yearChannels.set(record.channel_name, (yearChannels.get(record.channel_name) || 0) + 1);
        }

        // Binge detection grouping
        if (!recordsByDate.has(dateKey)) {
          recordsByDate.set(dateKey, []);
        }
        recordsByDate.get(dateKey)!.push({
          video_id: record.video_id,
          watched_at: watchedAt,
        });

        // Memory lane: videos watched on this day in previous years
        if (
          watchedAt.getMonth() + 1 === todayMonthNum &&
          watchedAt.getDate() === todayDay &&
          watchedAt.getFullYear() < today.getFullYear()
        ) {
          const yearKey = watchedAt.getFullYear();
          let memoryEntry = memoryLane.find((m) => m.year === yearKey);
          if (!memoryEntry) {
            memoryEntry = { year: yearKey, videos: [] };
            memoryLane.push(memoryEntry);
          }
          if (memoryEntry.videos.length < 5) {
            memoryEntry.videos.push({
              title: record.video_title,
              channel: record.channel_name || 'Unknown',
              url: record.video_url,
              date: watchedAt.toISOString(),
            });
          }
        }

        // Track date range (since results are ordered desc, first is newest, last is oldest)
        if (!newestDate) {
          newestDate = watchedAt;
        }
        oldestDate = watchedAt;
      }

      hasMore = records.length === pageSize;
      page++;
    }

    // ============================================
    // Post-processing: Format aggregated data
    // ============================================

    const uniqueVideos = videoIdSet.size;
    const uniqueChannels = channelNameSet.size;

    // Top videos
    const topVideosListResult = Array.from(videoCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    // Top channels
    const topChannelsList = Array.from(channelCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    // Watching streak
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

    // Date range
    const finalOldestDate = oldestDate || new Date();
    const finalNewestDate = newestDate || new Date();
    const daysBack = Math.ceil(
      (finalNewestDate.getTime() - finalOldestDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Binge sessions (days with 10+ videos)
    const bingeSessions: Array<{ date: string; count: number; videos: string[] }> = [];
    recordsByDate.forEach((videos, date) => {
      if (videos.length >= 10) {
        bingeSessions.push({
          date,
          count: videos.length,
          videos: [...new Set(videos.map((v) => v.video_id))],
        });
      }
    });
    bingeSessions.sort((a, b) => b.count - a.count);

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

    // Get enriched data insights
    const enrichedInsights: any = {};

    // Get ALL unique video IDs from watch history (not just top videos)
    const allUniqueVideoIds = Array.from(videoIdSet);

    if (allUniqueVideoIds.length > 0) {
      // Fetch enriched data for all unique videos in chunks
      const chunkSize = 1000;
      const enrichedVideoData = new Map<string, any>();

      for (let i = 0; i < allUniqueVideoIds.length; i += chunkSize) {
        const chunk = allUniqueVideoIds.slice(i, i + chunkSize);
        const { data: enrichedVideos } = await supabase
          .from('youtube_videos')
          .select(
            'video_id, view_count, like_count, comment_count, duration_seconds, category_id, tags, published_at'
          )
          .in('video_id', chunk);

        if (enrichedVideos) {
          enrichedVideos.forEach((video) => {
            enrichedVideoData.set(video.video_id, video);
          });
        }
      }

      // Calculate watch time (sum of duration * watch count)
      let totalWatchTimeSeconds = 0;
      let videosWithDuration = 0;
      const categoryCounts = new Map<string, number>();
      const tagCounts = new Map<string, number>();
      const popularVideos: Array<{
        video_id: string;
        title: string;
        channel_name: string | null;
        thumbnail_url: string | null;
        video_url: string;
        view_count: number;
        like_count: number | null;
        comment_count: number | null;
      }> = [];

      // Process all unique videos to calculate insights
      allUniqueVideoIds.forEach((videoId) => {
        const enriched = enrichedVideoData.get(videoId);
        const watchCount = videoCounts.get(videoId)?.count || 1;
        const videoInfo = videoCounts.get(videoId);

        if (enriched?.duration_seconds) {
          totalWatchTimeSeconds += enriched.duration_seconds * watchCount;
          videosWithDuration++;
        }

        if (enriched?.category_id) {
          categoryCounts.set(
            enriched.category_id,
            (categoryCounts.get(enriched.category_id) || 0) + watchCount
          );
        }

        if (enriched?.tags && Array.isArray(enriched.tags)) {
          enriched.tags.forEach((tag: string) => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + watchCount);
          });
        }

        // Collect popular videos (by view count)
        if (enriched?.view_count && videoInfo) {
          popularVideos.push({
            video_id: videoId,
            title: videoInfo.video.title,
            channel_name: videoInfo.video.channel_name,
            thumbnail_url: videoInfo.video.thumbnail_url,
            video_url: videoInfo.video.video_url,
            view_count: enriched.view_count,
            like_count: enriched.like_count,
            comment_count: enriched.comment_count,
          });
        }
      });

      // Format watch time helper
      const formatWatchTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
          return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
      };

      // Calculate average watch time
      const averageWatchTimeSeconds =
        videosWithDuration > 0 ? Math.round(totalWatchTimeSeconds / videosWithDuration) : 0;

      // Top categories
      const topCategories = Array.from(categoryCounts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Top tags
      const topTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      // Most popular videos (by view count)
      const mostPopularVideos = popularVideos
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 10);

      // Calculate engagement metrics
      let totalLikes = 0;
      let totalComments = 0;
      let videosWithEngagement = 0;

      popularVideos.forEach((video) => {
        if (video.like_count !== null) {
          totalLikes += video.like_count;
          videosWithEngagement++;
        }
        if (video.comment_count !== null) {
          totalComments += video.comment_count;
        }
      });

      enrichedInsights.watchTime = {
        totalSeconds: totalWatchTimeSeconds,
        totalFormatted: formatWatchTime(totalWatchTimeSeconds),
        averageSeconds: averageWatchTimeSeconds,
        averageFormatted: formatWatchTime(averageWatchTimeSeconds),
        videosWithDuration,
      };

      enrichedInsights.mostPopularVideos = mostPopularVideos;
      enrichedInsights.topCategories = topCategories;
      enrichedInsights.topTags = topTags;
      enrichedInsights.engagement = {
        totalLikes,
        totalComments,
        averageLikes: videosWithEngagement > 0 ? Math.round(totalLikes / videosWithEngagement) : 0,
        averageComments:
          videosWithEngagement > 0 ? Math.round(totalComments / videosWithEngagement) : 0,
        videosWithEngagement,
      };
    }

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
      // Enriched data insights
      enrichedInsights: Object.keys(enrichedInsights).length > 0 ? enrichedInsights : undefined,
    });
  } catch (error: any) {
    console.error('Error fetching YouTube analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
