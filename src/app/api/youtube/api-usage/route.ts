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

    // Calculate start of today in Pacific Time (YouTube quota resets at midnight PT)
    const now = new Date();
    const pacificParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    }).formatToParts(now);

    const getPart = (type: string) =>
      parseInt(pacificParts.find((p) => p.type === type)?.value || '0');

    const pacificHour = getPart('hour');
    const pacificMinute = getPart('minute');
    const pacificSecond = getPart('second');

    // Calculate milliseconds since midnight Pacific Time today
    const msSinceMidnightPT =
      (pacificHour * 3600 + pacificMinute * 60 + pacificSecond) * 1000 + now.getMilliseconds();

    // Subtract from current time to get start of today in Pacific Time as UTC Date
    const startOfTodayPT = new Date(now.getTime() - msSinceMidnightPT);
    const todayISOString = startOfTodayPT.toISOString();

    // Use server-side counts instead of fetching all rows
    const [totalCountResult, todayCountResult] = await Promise.all([
      // Total enriched videos for this user
      supabase
        .from('youtube_videos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('view_count', 'is', null),
      // Videos enriched today for this user
      supabase
        .from('youtube_videos')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('view_count', 'is', null)
        .gte('updated_at', todayISOString),
    ]);

    if (totalCountResult.error) {
      throw new Error(`Failed to fetch total enriched count: ${totalCountResult.error.message}`);
    }

    if (todayCountResult.error) {
      throw new Error(`Failed to fetch today's enriched count: ${todayCountResult.error.message}`);
    }

    const todayUsage = todayCountResult.count || 0;
    const totalUsage = totalCountResult.count || 0;
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
