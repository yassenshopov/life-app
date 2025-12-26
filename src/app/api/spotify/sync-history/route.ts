import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { spotifyApiRequest } from '../utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let allItems: any[] = [];
    let nextUrl: string | null = '/me/player/recently-played?limit=50';
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 100; // Safety limit to prevent infinite loops

    // Fetch all available history using pagination
    while (hasMore && pageCount < maxPages) {
      const response = await spotifyApiRequest(nextUrl!);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Failed to fetch history' } }));
        // If we got some data before the error, continue with what we have
        if (allItems.length === 0) {
          return NextResponse.json(
            { error: error.error?.message || 'Failed to fetch listening history' },
            { status: response.status }
          );
        }
        break;
      }

      const data = await response.json();
      const items = data.items || [];
      
      if (items.length === 0) {
        hasMore = false;
        break;
      }

      allItems.push(...items);
      pageCount++;

      // Spotify pagination: Check for 'next' field or use 'before' parameter
      // The response may include a 'next' field with the next page URL
      if (data.next) {
        // Extract the URL from the 'next' field (it's a full URL, we need just the path)
        try {
          const nextUrlObj = new URL(data.next);
          nextUrl = nextUrlObj.pathname + nextUrlObj.search;
        } catch {
          // If parsing fails, try to extract the 'before' parameter manually
          const oldestItem = items[items.length - 1];
          const oldestTimestamp = Math.floor(new Date(oldestItem.played_at).getTime());
          nextUrl = `/me/player/recently-played?limit=50&before=${oldestTimestamp}`;
        }
      } else if (items.length === 50) {
        // If we got a full page but no 'next' field, try using 'before' parameter
        const oldestItem = items[items.length - 1];
        const oldestTimestamp = Math.floor(new Date(oldestItem.played_at).getTime());
        nextUrl = `/me/player/recently-played?limit=50&before=${oldestTimestamp}`;
      } else {
        // If we got less than 50 items and no 'next' field, we've reached the end
        hasMore = false;
      }
      
      // Safety check: if we're getting duplicate timestamps, we've likely reached the end
      if (allItems.length > 50) {
        const lastTwoTimestamps = [
          allItems[allItems.length - 1].played_at,
          allItems[allItems.length - 2].played_at
        ];
        if (lastTwoTimestamps[0] === lastTwoTimestamps[1]) {
          hasMore = false;
        }
      }
    }

    if (allItems.length === 0) {
      return NextResponse.json({ message: 'No tracks to sync', synced: 0, total: 0 });
    }

    let syncedCount = 0;

    // Process each track
    for (const item of allItems) {
      const track = item.track;
      const playedAt = new Date(item.played_at);

      // Check if already synced
      const { data: existing } = await supabase
        .from('spotify_listening_history')
        .select('id')
        .eq('user_id', userId)
        .eq('track_id', track.id)
        .eq('played_at', playedAt.toISOString())
        .single();

      if (existing) continue; // Skip if already synced

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

      // Upsert artist metadata
      for (const artist of track.artists) {
        // Fetch artist details if we don't have them
        let artistData = { id: artist.id, name: artist.name, genres: [], image_url: null, popularity: null };
        
        try {
          const artistResponse = await spotifyApiRequest(`/artists/${artist.id}`);
          if (artistResponse.ok) {
            const artistInfo = await artistResponse.json();
            artistData = {
              id: artistInfo.id,
              name: artistInfo.name,
              genres: artistInfo.genres || [],
              image_url: artistInfo.images[0]?.url || artistInfo.images[1]?.url,
              popularity: artistInfo.popularity,
              external_url: artistInfo.external_urls.spotify,
            };
          }
        } catch {
          // Continue with basic data if fetch fails
        }

        await supabase.from('spotify_artists').upsert({
          id: artistData.id,
          name: artistData.name,
          genres: artistData.genres,
          image_url: artistData.image_url,
          popularity: artistData.popularity,
          external_url: artistData.external_url,
        }, { onConflict: 'id' });

        // Link track to artist
        await supabase.from('spotify_track_artists').upsert({
          track_id: track.id,
          artist_id: artist.id,
        }, { onConflict: 'track_id,artist_id' });
      }

      // Insert listening history record
      const { error: historyError } = await supabase
        .from('spotify_listening_history')
        .insert({
          user_id: userId,
          track_id: track.id,
          track_name: track.name,
          artist_names: track.artists.map((a: any) => a.name),
          album_name: track.album.name,
          album_image_url: track.album.images[0]?.url || track.album.images[1]?.url,
          played_at: playedAt.toISOString(),
          duration_ms: track.duration_ms,
          popularity: track.popularity,
        });

      if (!historyError) {
        syncedCount++;
      }
    }

    // Get the date range of fetched data
    const oldestDate = allItems.length > 0 
      ? new Date(allItems[allItems.length - 1].played_at)
      : null;
    const newestDate = allItems.length > 0 
      ? new Date(allItems[0].played_at)
      : null;
    
    const daysBack = oldestDate && newestDate
      ? Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return NextResponse.json({ 
      message: `Synced ${syncedCount} new tracks from ${allItems.length} total fetched`,
      synced: syncedCount,
      total: allItems.length,
      pages: pageCount,
      dateRange: {
        oldest: oldestDate?.toISOString(),
        newest: newestDate?.toISOString(),
        daysBack
      },
      note: daysBack >= 49 ? 'Note: Spotify API only provides data for the last ~50 days. Sync regularly to build a complete history over time.' : undefined
    });
  } catch (error: any) {
    console.error('Error syncing history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync listening history' },
      { status: 500 }
    );
  }
}

