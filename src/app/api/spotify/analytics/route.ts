import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Get total listening time
    let totalTimeQuery = supabase
      .from('spotify_listening_history')
      .select('duration_ms')
      .eq('user_id', userId);
    
    if (startDate) {
      totalTimeQuery = totalTimeQuery.gte('played_at', startDate.toISOString());
    }
    
    const { data: totalTime } = await totalTimeQuery;

    const totalMinutes = totalTime?.reduce((sum, record) => sum + (record.duration_ms || 0), 0) / 60000 || 0;

    // Get most played tracks
    let topTracksQuery = supabase
      .from('spotify_listening_history')
      .select('track_id, track_name, artist_names, album_image_url, played_at')
      .eq('user_id', userId);
    
    if (startDate) {
      topTracksQuery = topTracksQuery.gte('played_at', startDate.toISOString());
    }
    
    const { data: topTracks } = await topTracksQuery.order('played_at', { ascending: false });

    const trackCounts = new Map<string, { count: number; track: any; lastPlayed: Date }>();
    topTracks?.forEach((record) => {
      const existing = trackCounts.get(record.track_id);
      const playedAt = new Date(record.played_at);
      if (existing) {
        existing.count++;
        if (playedAt > existing.lastPlayed) {
          existing.lastPlayed = playedAt;
        }
      } else {
        trackCounts.set(record.track_id, {
          count: 1,
          track: {
            id: record.track_id,
            name: record.track_name,
            artists: record.artist_names,
            image: record.album_image_url,
          },
          lastPlayed: playedAt,
        });
      }
    });

    const topTracksList = Array.from(trackCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get most played artists
    const artistCounts = new Map<string, { count: number; name: string }>();
    topTracks?.forEach((record) => {
      record.artist_names.forEach((artistName: string) => {
        const existing = artistCounts.get(artistName);
        if (existing) {
          existing.count++;
        } else {
          artistCounts.set(artistName, { count: 1, name: artistName });
        }
      });
    });

    const topArtistsList = Array.from(artistCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Get listening patterns by hour
    let allRecordsQuery = supabase
      .from('spotify_listening_history')
      .select('played_at')
      .eq('user_id', userId);
    
    if (startDate) {
      allRecordsQuery = allRecordsQuery.gte('played_at', startDate.toISOString());
    }
    
    const { data: allRecords } = await allRecordsQuery;

    const hourCounts = new Array(24).fill(0);
    allRecords?.forEach((record) => {
      const hour = new Date(record.played_at).getHours();
      hourCounts[hour]++;
    });

    // Get listening patterns by day of week
    const dayCounts = new Array(7).fill(0);
    allRecords?.forEach((record) => {
      const day = new Date(record.played_at).getDay();
      dayCounts[day]++;
    });

    // Get unique tracks count
    const uniqueTracks = new Set(topTracks?.map((r) => r.track_id) || []).size;

    // Get listening streak (consecutive days)
    const { data: allDates } = await supabase
      .from('spotify_listening_history')
      .select('played_at')
      .eq('user_id', userId)
      .order('played_at', { ascending: false });

    const uniqueDates = new Set(
      allDates?.map((r) => new Date(r.played_at).toDateString()) || []
    );
    
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      if (uniqueDates.has(checkDate.toDateString())) {
        streak++;
      } else {
        break;
      }
    }

    return NextResponse.json({
      totalMinutes: Math.round(totalMinutes),
      totalPlays: allRecords?.length || 0,
      uniqueTracks,
      streak,
      topTracks: topTracksList,
      topArtists: topArtistsList,
      listeningByHour: hourCounts,
      listeningByDay: dayCounts,
      timeRange: timeRange === 'all' ? 'all' : parseInt(timeRange),
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

