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
      console.log(`Fetching page ${pageCount + 1} with URL: ${nextUrl}`);
      const response = await spotifyApiRequest(nextUrl!);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Failed to fetch history' } }));
        console.log(`Page ${pageCount + 1} failed:`, error);
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
      
      console.log(`Page ${pageCount + 1} results:`, {
        itemsCount: items.length,
        hasNext: !!data.next,
        nextUrl: data.next,
        oldestTimestamp: items.length > 0 ? items[items.length - 1].played_at : null,
        newestTimestamp: items.length > 0 ? items[0].played_at : null
      });
      
      if (items.length === 0) {
        console.log('No items returned, stopping pagination');
        hasMore = false;
        break;
      }

      allItems.push(...items);
      pageCount++;

      // Spotify pagination: Use the 'next' field if available, otherwise construct URL with 'before'
      if (data.next) {
        // Spotify provides the next URL - extract the path and query
        try {
          const nextUrlObj = new URL(data.next);
          // Remove /v1 prefix since spotifyApiRequest adds it
          let path = nextUrlObj.pathname;
          if (path.startsWith('/v1')) {
            path = path.substring(3); // Remove '/v1'
          }
          nextUrl = path + nextUrlObj.search;
          console.log(`Using Spotify's next URL: ${nextUrl}`);
        } catch (error) {
          console.log('Failed to parse next URL, constructing manually');
          // Fallback to manual construction
          if (items.length === 50) {
            const oldestItem = items[items.length - 1];
            // Subtract 1ms to ensure we get items before this timestamp
            const oldestTimestamp = Math.floor(new Date(oldestItem.played_at).getTime()) - 1;
            nextUrl = `/me/player/recently-played?limit=50&before=${oldestTimestamp}`;
            console.log(`Continuing to next page with before=${oldestTimestamp}`);
          } else {
            hasMore = false;
          }
        }
      } else if (items.length === 50) {
        // No 'next' field but we got a full page - construct URL manually
        const oldestItem = items[items.length - 1];
        // Subtract 1ms to ensure we get items before this timestamp
        const oldestTimestamp = Math.floor(new Date(oldestItem.played_at).getTime()) - 1;
        nextUrl = `/me/player/recently-played?limit=50&before=${oldestTimestamp}`;
        console.log(`No next URL, constructing manually with before=${oldestTimestamp}`);
      } else {
        // If we got less than 50 items and no 'next' field, we've reached the end
        console.log(`Got less than 50 items (${items.length}) and no next URL, stopping pagination`);
        hasMore = false;
      }
      
      // Safety check: prevent infinite loops by checking for duplicate data
      if (allItems.length > 50) {
        const last50Timestamps = allItems.slice(-50).map(item => item.played_at);
        const uniqueTimestamps = new Set(last50Timestamps);
        if (uniqueTimestamps.size < 10) {
          console.log('Detected too many duplicate timestamps, stopping pagination');
          hasMore = false;
        }
      }
    }
    
    console.log(`Pagination complete: ${pageCount} pages, ${allItems.length} total items`);

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
        let artistData = { id: artist.id, name: artist.name, genres: [], image_url: null, popularity: null, external_url: null };
        
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
      note: daysBack >= 49 
        ? 'Note: Spotify API only provides the last 50 tracks via recently-played. Use "Sync Top Data" to get insights from top tracks/artists across different time ranges (4 weeks, 6 months, several years).' 
        : undefined
    });
  } catch (error: any) {
    console.error('Error syncing history:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync listening history' },
      { status: 500 }
    );
  }
}

