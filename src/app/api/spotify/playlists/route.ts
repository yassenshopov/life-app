import { NextResponse } from 'next/server';
import { spotifyApiRequest } from '../utils';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') || '20';
    const offset = searchParams.get('offset') || '0';

    const response = await spotifyApiRequest(
      `/me/playlists?limit=${limit}&offset=${offset}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch playlists' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching playlists:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch playlists' },
      { status: 500 }
    );
  }
}

