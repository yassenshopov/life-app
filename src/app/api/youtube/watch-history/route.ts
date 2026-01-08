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
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 1000;

    // Build query
    let query = supabase
      .from('youtube_watch_history')
      .select('*')
      .eq('user_id', userId);

    // Apply date range filters
    if (timeMin) {
      query = query.gte('watched_at', timeMin);
    }
    if (timeMax) {
      query = query.lte('watched_at', timeMax);
    }

    // Order by watched_at descending (most recent first)
    query = query.order('watched_at', { ascending: false });

    // Apply limit
    if (limit) {
      query = query.limit(limit);
    }

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
