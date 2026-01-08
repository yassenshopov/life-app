import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

// YouTube API quota info
const DAILY_QUOTA = 10000; // Default free quota per day
const COST_PER_VIDEO_LIST = 1; // Each videos.list call costs 1 unit

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get API usage from logs (if we're tracking it)
    // For now, we'll calculate based on enriched videos
    // Each enriched video = 1 API call = 1 quota unit
    
    const { data: enrichedVideos, error } = await supabase
      .from('youtube_videos')
      .select('video_id, updated_at')
      .not('view_count', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(10000); // Get recent enriched videos

    if (error) {
      throw new Error(`Failed to fetch enriched videos: ${error.message}`);
    }

    // Calculate today's usage (videos enriched today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEnriched = (enrichedVideos || []).filter((video) => {
      const updatedAt = new Date(video.updated_at);
      return updatedAt >= today;
    });

    const todayUsage = todayEnriched.length;
    const totalUsage = enrichedVideos?.length || 0;
    const remainingQuota = Math.max(0, DAILY_QUOTA - todayUsage);
    const quotaPercentage = (todayUsage / DAILY_QUOTA) * 100;

    return NextResponse.json({
      dailyQuota: DAILY_QUOTA,
      todayUsage,
      remainingQuota,
      quotaPercentage: Math.round(quotaPercentage * 100) / 100,
      totalEnriched: totalUsage,
      costPerRequest: COST_PER_VIDEO_LIST,
      note: 'YouTube Data API v3 is free. Quota resets daily at midnight Pacific Time.',
      quotaResetTime: 'Midnight Pacific Time (PST/PDT)',
    });
  } catch (error: any) {
    console.error('Error fetching API usage:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch API usage' },
      { status: 500 }
    );
  }
}

