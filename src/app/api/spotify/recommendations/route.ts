import { NextResponse } from 'next/server';
import { spotifyApiRequest } from '../utils';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const seedTracks = searchParams.get('seed_tracks');
    const seedArtists = searchParams.get('seed_artists');
    const seedGenres = searchParams.get('seed_genres');
    const limit = searchParams.get('limit') || '20';

    // Build query params
    const params = new URLSearchParams({ limit });
    if (seedTracks) params.append('seed_tracks', seedTracks);
    if (seedArtists) params.append('seed_artists', seedArtists);
    if (seedGenres) params.append('seed_genres', seedGenres);

    const response = await spotifyApiRequest(
      `/recommendations?${params.toString()}`
    );
    
    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch {
        error = { error: { message: 'Failed to fetch recommendations' } };
      }
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch recommendations' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

