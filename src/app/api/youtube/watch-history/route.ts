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
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');

    // Parse and validate limit parameter
    const DEFAULT_LIMIT = 1000;
    const MAX_LIMIT = 10000;
    const limitParam = searchParams.get('limit');
    let limit = DEFAULT_LIMIT;

    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_LIMIT) {
        limit = parsed;
      }
      // Invalid values (NaN, negative, zero, or exceeds max) fall back to DEFAULT_LIMIT
    }

    // Build query
    let query = supabase.from('youtube_watch_history').select('*').eq('user_id', userId);

    // Apply date range filters
    if (timeMin) {
      query = query.gte('watched_at', timeMin);
    }
    if (timeMax) {
      query = query.lte('watched_at', timeMax);
    }

    // Order by watched_at descending (most recent first)
    query = query.order('watched_at', { ascending: false });

    // Apply limit (always valid positive integer)
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      videos: data || [],
      count: data?.length || 0,
    });
  } catch (error: any) {
    console.error('Error fetching watch history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch watch history' },
      { status: 500 }
    );
  }
}
