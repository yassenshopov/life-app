import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get total unique videos from watch history with pagination
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;
    const videoIdSet = new Set<string>();

    while (hasMore && page < 100) { // Safety limit
      const { data: watchHistory, error: historyError } = await supabase
        .from('youtube_watch_history')
        .select('video_id')
        .eq('user_id', userId)
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (historyError) {
        throw new Error(`Failed to fetch watch history: ${historyError.message}`);
      }

      if (!watchHistory || watchHistory.length === 0) {
        hasMore = false;
        break;
      }

      watchHistory.forEach((record) => {
        videoIdSet.add(record.video_id);
      });

      hasMore = watchHistory.length === pageSize;
      page++;
    }

    const uniqueVideoIds = Array.from(videoIdSet);

    if (uniqueVideoIds.length === 0) {
      return NextResponse.json({
        total: 0,
        enriched: 0,
        notEnriched: 0,
        percentage: 0,
      });
    }

    // Get enriched videos (those with view_count not null) with pagination
    // Since Supabase has a limit on IN queries, we'll process in chunks
    const chunkSize = 1000;
    const enrichedVideoIds = new Set<string>();
    
    for (let i = 0; i < uniqueVideoIds.length; i += chunkSize) {
      const chunk = uniqueVideoIds.slice(i, i + chunkSize);
      
      const { data: enrichedVideos, error: enrichedError } = await supabase
        .from('youtube_videos')
        .select('video_id, view_count')
        .in('video_id', chunk)
        .not('view_count', 'is', null);

      if (enrichedError) {
        throw new Error(`Failed to fetch enriched videos: ${enrichedError.message}`);
      }

      if (enrichedVideos) {
        enrichedVideos.forEach((video) => {
          enrichedVideoIds.add(video.video_id);
        });
      }
    }

    const enrichedCount = enrichedVideoIds.size;
    const totalCount = uniqueVideoIds.length;
    const notEnrichedCount = totalCount - enrichedCount;
    const percentage = totalCount > 0 ? Math.round((enrichedCount / totalCount) * 100) : 0;

    return NextResponse.json({
      total: totalCount,
      enriched: enrichedCount,
      notEnriched: notEnrichedCount,
      percentage,
    });
  } catch (error: any) {
    console.error('Error fetching enrichment stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch enrichment stats' },
      { status: 500 }
    );
  }
}
