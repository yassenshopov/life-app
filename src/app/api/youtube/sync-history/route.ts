import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

interface YouTubeHistoryItem {
  header: string;
  title: string;
  titleUrl: string;
  subtitles?: Array<{
    name: string;
    url: string;
  }>;
  time: string;
  products: string[];
  activityControls: string[];
}

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const videoId = urlObj.searchParams.get('v');
    return videoId;
  } catch {
    // Try regex fallback
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
  }
}

// Extract video title (remove "Watched " prefix)
function extractVideoTitle(title: string): string {
  return title.replace(/^Watched\s+/i, '').trim();
}

// Get YouTube thumbnail URL from video ID
function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const historyItems: YouTubeHistoryItem[] = Array.isArray(body) ? body : body.items || [];

    if (historyItems.length === 0) {
      return NextResponse.json({ message: 'No history items to sync', synced: 0, total: 0 });
    }

    // Filter only YouTube items
    const youtubeItems = historyItems.filter(
      (item) => item.header === 'YouTube' && item.titleUrl && item.titleUrl.includes('youtube.com')
    );

    if (youtubeItems.length === 0) {
      return NextResponse.json({
        message: 'No YouTube items found in history',
        synced: 0,
        total: 0,
      });
    }

    let syncedCount = 0;
    const errors: string[] = [];

    // Process each video
    for (const item of youtubeItems) {
      try {
        const videoId = extractVideoId(item.titleUrl);
        if (!videoId) {
          errors.push(`Failed to extract video ID from: ${item.titleUrl}`);
          continue;
        }

        const videoTitle = extractVideoTitle(item.title);
        const channelName = item.subtitles?.[0]?.name || null;
        const channelUrl = item.subtitles?.[0]?.url || null;
        const watchedAt = new Date(item.time);

        // Check if already synced
        const { data: existing } = await supabase
          .from('youtube_watch_history')
          .select('id')
          .eq('user_id', userId)
          .eq('video_id', videoId)
          .eq('watched_at', watchedAt.toISOString())
          .single();

        if (existing) continue; // Skip if already synced

        const thumbnailUrl = getYouTubeThumbnail(videoId);

        // Upsert video metadata
        const { error: videoUpsertError } = await supabase.from('youtube_videos').upsert(
          {
            video_id: videoId,
            title: videoTitle,
            channel_name: channelName,
            channel_url: channelUrl,
            thumbnail_url: thumbnailUrl,
          },
          { onConflict: 'video_id' }
        );

        if (videoUpsertError) {
          console.error(`Failed to upsert video ${videoId}:`, videoUpsertError);
          errors.push(`Failed to upsert video ${videoTitle}: ${videoUpsertError.message}`);
          continue; // Skip watch history insert if video upsert failed
        }

        // Insert watch history record
        const { error: historyError } = await supabase.from('youtube_watch_history').insert({
          user_id: userId,
          video_id: videoId,
          video_title: videoTitle,
          channel_name: channelName,
          channel_url: channelUrl,
          video_url: item.titleUrl,
          watched_at: watchedAt.toISOString(),
          thumbnail_url: thumbnailUrl,
        });

        if (!historyError) {
          syncedCount++;
        } else {
          errors.push(`Failed to insert history for ${videoTitle}: ${historyError.message}`);
        }
      } catch (error: any) {
        errors.push(`Error processing item: ${error.message}`);
      }
    }

    // Get the date range of synced data
    const watchedDates = youtubeItems
      .map((item) => new Date(item.time))
      .filter((date) => !isNaN(date.getTime()));

    const oldestDate =
      watchedDates.length > 0 ? new Date(Math.min(...watchedDates.map((d) => d.getTime()))) : null;
    const newestDate =
      watchedDates.length > 0 ? new Date(Math.max(...watchedDates.map((d) => d.getTime()))) : null;

    const daysBack =
      oldestDate && newestDate
        ? Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return NextResponse.json({
      message: `Synced ${syncedCount} new videos from ${youtubeItems.length} total YouTube items`,
      synced: syncedCount,
      total: youtubeItems.length,
      errors: errors.length > 0 ? errors : undefined,
      dateRange: {
        oldest: oldestDate?.toISOString(),
        newest: newestDate?.toISOString(),
        daysBack,
      },
    });
  } catch (error: any) {
    console.error('Error syncing YouTube history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync YouTube history' },
      { status: 500 }
    );
  }
}
