import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { callAIGateway, DEFAULT_MODEL } from '@/lib/ai-gateway';

const supabase = getSupabaseServiceRoleClient();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { analysisType = 'insights' } = await request.json();

    // Get watch history summary for analysis
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;
    const maxVideos = 3000; // Limit for token efficiency, but get a good sample
    
    const videos: Array<{
      title: string;
      channel: string;
      watchedAt: string;
      viewCount?: number;
      category?: string;
      tags?: string[];
    }> = [];

    // Fetch videos with pagination to avoid 1000-row limit
    while (hasMore && videos.length < maxVideos) {
      const { data: records, error } = await supabase
        .from('youtube_watch_history')
        .select('video_id, video_title, channel_name, watched_at')
        .eq('user_id', userId)
        .order('watched_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !records || records.length === 0) {
        hasMore = false;
        break;
      }

      // Get enriched data for these videos in chunks (Supabase IN query limit)
      const videoIds = records.map(r => r.video_id);
      const enrichedMap = new Map<string, any>();
      
      // Process enriched data in chunks of 1000
      const chunkSize = 1000;
      for (let i = 0; i < videoIds.length; i += chunkSize) {
        const chunk = videoIds.slice(i, i + chunkSize);
        const { data: enrichedVideos } = await supabase
          .from('youtube_videos')
          .select('video_id, view_count, category_id, tags')
          .in('video_id', chunk);
        
        if (enrichedVideos) {
          enrichedVideos.forEach((video) => {
            enrichedMap.set(video.video_id, video);
          });
        }
      }

      records.forEach((record) => {
        const enriched = enrichedMap.get(record.video_id);
        videos.push({
          title: record.video_title,
          channel: record.channel_name || 'Unknown',
          watchedAt: record.watched_at,
          viewCount: enriched?.view_count || undefined,
          category: enriched?.category_id || undefined,
          tags: enriched?.tags || undefined,
        });
      });

      hasMore = records.length === pageSize;
      page++;
      
      // Safety limit to prevent infinite loops
      if (page >= 100) {
        break;
      }
    }

    if (videos.length === 0) {
      return NextResponse.json({ error: 'No watch history found' }, { status: 404 });
    }

    // Get top channels and videos for context
    const channelCounts = new Map<string, number>();
    const videoCounts = new Map<string, number>();
    
    videos.forEach((video) => {
      channelCounts.set(video.channel, (channelCounts.get(video.channel) || 0) + 1);
      videoCounts.set(video.title, (videoCounts.get(video.title) || 0) + 1);
    });

    const topChannels = Array.from(channelCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const topVideos = Array.from(videoCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([title, count]) => ({ title, count }));

    // Get time patterns
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    
    videos.forEach((video) => {
      const date = new Date(video.watchedAt);
      hourCounts[date.getHours()]++;
      dayCounts[date.getDay()]++;
    });

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const peakDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
      dayCounts.indexOf(Math.max(...dayCounts))
    ];

    // Prepare context for LLM
    const context = {
      totalVideos: videos.length,
      dateRange: {
        oldest: videos[videos.length - 1]?.watchedAt,
        newest: videos[0]?.watchedAt,
      },
      topChannels,
      topVideos,
      peakWatchingTime: {
        hour: peakHour,
        day: peakDay,
      },
      sampleVideos: videos.slice(0, 50).map(v => ({
        title: v.title,
        channel: v.channel,
        category: v.category,
        tags: v.tags?.slice(0, 5),
      })),
    };

    // Generate analysis based on type
    let prompt = '';
    let systemPrompt = '';

    switch (analysisType) {
      case 'insights':
        systemPrompt = 'You are an insightful data analyst specializing in understanding human behavior through digital consumption patterns. Provide thoughtful, personalized insights about YouTube watching habits.';
        prompt = `Analyze this YouTube watch history data and provide personalized insights:

**Summary:**
- Total videos watched: ${context.totalVideos}
- Date range: ${new Date(context.dateRange.oldest).toLocaleDateString()} to ${new Date(context.dateRange.newest).toLocaleDateString()}
- Peak watching time: ${context.peakWatchingTime.day} at ${context.peakWatchingTime.hour}:00

**Top Channels:**
${context.topChannels.map((c, i) => `${i + 1}. ${c.name} (${c.count} videos)`).join('\n')}

**Most Watched Videos:**
${context.topVideos.map((v, i) => `${i + 1}. ${v.title} (${v.count} times)`).join('\n')}

**Sample Videos Watched:**
${context.sampleVideos.slice(0, 20).map(v => `- ${v.title} (${v.channel}${v.category ? `, Category: ${v.category}` : ''}${v.tags ? `, Tags: ${v.tags.join(', ')}` : ''})`).join('\n')}

Provide 5-7 key insights about their watching patterns, preferences, and habits. Be specific, personal, and insightful. Format as a numbered list.`;
        break;

      case 'wrapped':
        systemPrompt = 'You are a creative storyteller who creates engaging "Year in Review" style summaries. Make it fun, personal, and celebratory.';
        prompt = `Create a "YouTube Wrapped" style summary for this watch history:

**Data:**
- Total videos: ${context.totalVideos}
- Date range: ${new Date(context.dateRange.oldest).toLocaleDateString()} to ${new Date(context.dateRange.newest).toLocaleDateString()}
- Top channels: ${context.topChannels.slice(0, 5).map(c => c.name).join(', ')}
- Peak watching: ${context.peakWatchingTime.day} at ${context.peakWatchingTime.hour}:00

**Top Videos:**
${context.topVideos.slice(0, 5).map((v, i) => `${i + 1}. ${v.title}`).join('\n')}

Create a fun, engaging "YouTube Wrapped" summary with:
1. A catchy opening line
2. Top stats (3-4 key numbers)
3. Watching personality (what type of watcher they are)
4. Favorite content themes
5. A fun closing statement

Keep it light, celebratory, and personal. Use emojis sparingly.`;
        break;

      case 'recommendations':
        systemPrompt = 'You are a content recommendation expert who suggests YouTube channels and video types based on watching patterns.';
        prompt = `Based on this watch history, provide personalized recommendations:

**Watching Patterns:**
- Top channels: ${context.topChannels.slice(0, 5).map(c => c.name).join(', ')}
- Most watched: ${context.topVideos.slice(0, 3).map(v => v.title).join(', ')}
- Peak time: ${context.peakWatchingTime.day} at ${context.peakWatchingTime.hour}:00

**Sample Content:**
${context.sampleVideos.slice(0, 15).map(v => `- ${v.title} (${v.channel}${v.category ? `, ${v.category}` : ''})`).join('\n')}

Provide 5-7 specific recommendations:
1. Similar channels they might enjoy
2. Related topics/content types
3. Specific video suggestions based on patterns
4. New content areas to explore

Be specific and actionable.`;
        break;

      default:
        return NextResponse.json({ error: 'Invalid analysis type' }, { status: 400 });
    }

    try {
      const analysis = await callAIGateway(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        DEFAULT_MODEL,
        {
          temperature: 0.8,
          max_tokens: 1500,
        }
      );

      return NextResponse.json({
        analysis,
        type: analysisType,
        context: {
          totalVideos: context.totalVideos,
          dateRange: context.dateRange,
          topChannels: context.topChannels.slice(0, 5),
          topVideos: context.topVideos.slice(0, 5),
        },
      });
    } catch (error: any) {
      console.error('LLM analysis error:', error);
      return NextResponse.json(
        { error: `Analysis failed: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error analyzing YouTube data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze YouTube data' },
      { status: 500 }
    );
  }
}

