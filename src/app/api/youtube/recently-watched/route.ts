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

    // Get the most recently watched video
    const { data, error } = await supabase
      .from('youtube_watch_history')
      .select('*')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return NextResponse.json({ video: null });
      }
      throw error;
    }

    return NextResponse.json({
      video: data
        ? {
            video_id: data.video_id,
            title: data.video_title,
            channel_name: data.channel_name,
            channel_url: data.channel_url,
            video_url: data.video_url,
            thumbnail_url: data.thumbnail_url,
            watched_at: data.watched_at,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Error fetching recently watched:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recently watched video' },
      { status: 500 }
    );
  }
}

