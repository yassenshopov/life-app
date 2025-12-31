import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { spotifyApiRequest } from '../utils';

const supabase = getSupabaseServiceRoleClient();

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const timeRanges = ['short_term', 'medium_term', 'long_term'] as const;
    const results: any = {
      tracks: { short_term: 0, medium_term: 0, long_term: 0 },
      artists: { short_term: 0, medium_term: 0, long_term: 0 },
    };

    // Fetch top tracks for all time ranges
    for (const timeRange of timeRanges) {
      try {
        // Fetch all pages of top tracks (up to 50 per page)
        let offset = 0;
        let hasMore = true;
        const limit = 50;

        while (hasMore && offset < 50) {
          const response = await spotifyApiRequest(
            `/me/top/tracks?time_range=${timeRange}&limit=${limit}&offset=${offset}`
          );

          if (!response.ok) {
            console.error(`Failed to fetch top tracks for ${timeRange}:`, response.status);
            break;
          }

          const data = await response.json();
          const tracks = data.items || [];

          if (tracks.length === 0) {
            hasMore = false;
            break;
          }

          // Store each track
          for (let index = 0; index < tracks.length; index++) {
            const track = tracks[index];
            // Upsert track metadata
            await supabase.from('spotify_tracks').upsert({
              id: track.id,
              name: track.name,
              artist_names: track.artists.map((a: any) => a.name),
              album_name: track.album.name,
              album_image_url: track.album.images[0]?.url || track.album.images[1]?.url,
              duration_ms: track.duration_ms,
              popularity: track.popularity,
              external_url: track.external_urls.spotify,
            }, { onConflict: 'id' });

            // Store top track ranking
            await supabase.from('spotify_top_tracks').upsert({
              user_id: userId,
              track_id: track.id,
              time_range: timeRange,
              rank: offset + index + 1,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,track_id,time_range' });

            results.tracks[timeRange]++;
          }

          if (tracks.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }
        }
      } catch (error) {
        console.error(`Error syncing top tracks for ${timeRange}:`, error);
      }
    }

    // Fetch top artists for all time ranges
    for (const timeRange of timeRanges) {
      try {
        // Fetch all pages of top artists (up to 50 per page)
        let offset = 0;
        let hasMore = true;
        const limit = 50;

        while (hasMore && offset < 50) {
          const response = await spotifyApiRequest(
            `/me/top/artists?time_range=${timeRange}&limit=${limit}&offset=${offset}`
          );

          if (!response.ok) {
            console.error(`Failed to fetch top artists for ${timeRange}:`, response.status);
            break;
          }

          const data = await response.json();
          const artists = data.items || [];

          if (artists.length === 0) {
            hasMore = false;
            break;
          }

          // Store each artist
          for (let index = 0; index < artists.length; index++) {
            const artist = artists[index];
            // Upsert artist metadata
            await supabase.from('spotify_artists').upsert({
              id: artist.id,
              name: artist.name,
              genres: artist.genres || [],
              image_url: artist.images[0]?.url || artist.images[1]?.url,
              popularity: artist.popularity,
              external_url: artist.external_urls.spotify,
            }, { onConflict: 'id' });

            // Store top artist ranking
            await supabase.from('spotify_top_artists').upsert({
              user_id: userId,
              artist_id: artist.id,
              time_range: timeRange,
              rank: offset + index + 1,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,artist_id,time_range' });

            results.artists[timeRange]++;
          }

          if (artists.length < limit) {
            hasMore = false;
          } else {
            offset += limit;
          }
        }
      } catch (error) {
        console.error(`Error syncing top artists for ${timeRange}:`, error);
      }
    }

    return NextResponse.json({
      message: 'Synced top tracks and artists',
      results,
    });
  } catch (error: any) {
    console.error('Error syncing top data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync top data' },
      { status: 500 }
    );
  }
}

