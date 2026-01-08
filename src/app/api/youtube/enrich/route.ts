import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { google } from 'googleapis';

const supabase = getSupabaseServiceRoleClient();

// YouTube Data API v3 client
function getYouTubeClient() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY environment variable is not set');
  }
  return google.youtube({
    version: 'v3',
    auth: apiKey,
  });
}

// Convert ISO 8601 duration (PT4M13S) to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Extract channel ID from channel URL
function extractChannelId(channelUrl: string | null): string | null {
  if (!channelUrl) return null;
  try {
    // Handle different YouTube URL formats
    // https://www.youtube.com/channel/UC...
    // https://www.youtube.com/@channelname
    // https://youtube.com/c/channelname
    const url = new URL(channelUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (pathParts[0] === 'channel' && pathParts[1]) {
      return pathParts[1];
    }
    // For @username or /c/ formats, we'd need to resolve them via API
    // For now, return null and let the API handle it
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const limit = Math.min(body.limit || 5000, 5000); // Max 5K non-enriched videos per session
    const batchSize = 50; // YouTube API allows up to 50 videos per request
    const pageSize = 1000; // Supabase pagination size

    // First, get all enriched video IDs to skip them
    console.log('Fetching already enriched videos...');
    const enrichedVideoIds = new Set<string>();
    let enrichedPage = 0;
    let hasMoreEnriched = true;

    while (hasMoreEnriched && enrichedPage < 100) {
      const { data: enrichedVideos, error: enrichedError } = await supabase
        .from('youtube_videos')
        .select('video_id')
        .not('view_count', 'is', null)
        .range(enrichedPage * pageSize, (enrichedPage + 1) * pageSize - 1);

      if (enrichedError) {
        console.error('Error fetching enriched videos:', enrichedError);
        break;
      }

      if (!enrichedVideos || enrichedVideos.length === 0) {
        hasMoreEnriched = false;
        break;
      }

      enrichedVideos.forEach((video) => {
        enrichedVideoIds.add(video.video_id);
      });

      hasMoreEnriched = enrichedVideos.length === pageSize;
      enrichedPage++;
    }

    console.log(`Found ${enrichedVideoIds.size} already enriched videos to skip`);

    // Now paginate through watch history and collect non-enriched videos until we have 5K
    const videosNeedingEnrichment: string[] = [];
    const seenVideoIds = new Set<string>();
    let page = 0;
    let hasMore = true;

    while (hasMore && videosNeedingEnrichment.length < limit && page < 100) {
      const { data: watchHistory, error: fetchError } = await supabase
        .from('youtube_watch_history')
        .select('video_id')
        .eq('user_id', userId)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchError) {
        throw new Error(`Failed to fetch videos: ${fetchError.message}`);
      }

      if (!watchHistory || watchHistory.length === 0) {
        hasMore = false;
        break;
      }

      // Process each video ID
      for (const record of watchHistory) {
        const videoId = record.video_id;
        
        // Skip if we've already seen this video ID or if it's already enriched
        if (seenVideoIds.has(videoId) || enrichedVideoIds.has(videoId)) {
          continue;
        }

        seenVideoIds.add(videoId);
        videosNeedingEnrichment.push(videoId);

        // Stop if we've reached the limit
        if (videosNeedingEnrichment.length >= limit) {
          hasMore = false;
          break;
        }
      }

      hasMore = watchHistory.length === pageSize;
      page++;
    }

    if (videosNeedingEnrichment.length === 0) {
      return NextResponse.json({
        message: 'All videos are already enriched',
        enriched: 0,
        total: 0,
        skipped: enrichedVideoIds.size,
      });
    }

    console.log(`Enriching ${videosNeedingEnrichment.length} videos (limited to ${limit} per session)`);

    const youtube = getYouTubeClient();
    let enrichedCount = 0;
    let errorCount = 0;
    let apiCallsMade = 0; // Track API usage
    const errors: string[] = [];

    // Process in batches of 50 (YouTube API limit)
    for (let i = 0; i < videosNeedingEnrichment.length; i += batchSize) {
      const batch = videosNeedingEnrichment.slice(i, i + batchSize);
      
      try {
        // Fetch video details from YouTube API
        // Each videos.list call costs 1 quota unit
        apiCallsMade++;
        const response = await youtube.videos.list({
          part: ['snippet', 'statistics', 'contentDetails'],
          id: batch,
          maxResults: batchSize,
        });

        if (!response.data.items) {
          continue;
        }

        // Process each video
        for (const video of response.data.items) {
          try {
            const videoId = video.id;
            if (!videoId) continue;

            const snippet = video.snippet;
            const statistics = video.statistics;
            const contentDetails = video.contentDetails;

            // Extract channel ID from snippet
            let channelId = snippet?.channelId || null;
            
            // If we don't have channel ID, try to get it from existing data
            if (!channelId) {
              const { data: existing } = await supabase
                .from('youtube_watch_history')
                .select('channel_url')
                .eq('video_id', videoId)
                .limit(1)
                .single();
              
              if (existing?.channel_url) {
                channelId = extractChannelId(existing.channel_url);
              }
            }

            // Get existing video data to preserve channel_url
            const { data: existingVideo } = await supabase
              .from('youtube_videos')
              .select('channel_url')
              .eq('video_id', videoId)
              .single();

            // Prepare enriched data
            const enrichedData: any = {
              video_id: videoId,
              title: snippet?.title || null,
              channel_name: snippet?.channelTitle || null,
              channel_id: channelId,
              channel_url: existingVideo?.channel_url || null, // Preserve existing channel_url
              thumbnail_url: snippet?.thumbnails?.maxres?.url || 
                           snippet?.thumbnails?.high?.url || 
                           snippet?.thumbnails?.medium?.url || 
                           null,
              duration_seconds: contentDetails?.duration 
                ? parseDuration(contentDetails.duration) 
                : null,
              view_count: statistics?.viewCount ? parseInt(statistics.viewCount, 10) : null,
              like_count: statistics?.likeCount ? parseInt(statistics.likeCount, 10) : null,
              comment_count: statistics?.commentCount ? parseInt(statistics.commentCount, 10) : null,
              published_at: snippet?.publishedAt ? new Date(snippet.publishedAt).toISOString() : null,
              description: snippet?.description || null,
              category_id: snippet?.categoryId || null,
              tags: snippet?.tags || null,
            };

            // Upsert enriched data
            const { error: upsertError } = await supabase
              .from('youtube_videos')
              .upsert(enrichedData, { onConflict: 'video_id' });

            if (upsertError) {
              errors.push(`Failed to upsert ${videoId}: ${upsertError.message}`);
              errorCount++;
            } else {
              enrichedCount++;
            }
          } catch (error: any) {
            errors.push(`Error processing video: ${error.message}`);
            errorCount++;
          }
        }

        // Rate limiting: YouTube API allows 10,000 units per day
        // Each videos.list call costs 1 unit, so we can make many calls
        // But we'll add a small delay to be safe
        if (i + batchSize < videosNeedingEnrichment.length) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between batches
        }
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        errors.push(`Batch error: ${errorMessage}`);
        errorCount += batch.length;
        console.error(`Error fetching batch:`, error);
      }
    }

    // Calculate quota usage
    const dailyQuota = 10000; // Default free quota per day
    const quotaUsed = apiCallsMade; // Each videos.list call = 1 unit

    return NextResponse.json({
      message: `Enriched ${enrichedCount} videos${enrichedVideoIds.size > 0 ? ` (${enrichedVideoIds.size} already enriched, skipped)` : ''}`,
      enriched: enrichedCount,
      total: videosNeedingEnrichment.length,
      processed: videosNeedingEnrichment.length,
      skipped: enrichedVideoIds.size,
      errors: errorCount,
      errorDetails: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit error details
      apiUsage: {
        callsMade: apiCallsMade,
        quotaUsed: quotaUsed,
        dailyQuota: dailyQuota,
        note: 'Quota resets daily at midnight Pacific Time. YouTube API is free.',
      },
    });
  } catch (error: any) {
    console.error('Error enriching YouTube videos:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enrich YouTube videos' },
      { status: 500 }
    );
  }
}

