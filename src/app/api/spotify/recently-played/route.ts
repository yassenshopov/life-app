import { NextResponse } from 'next/server';
import { spotifyApiRequest } from '../utils';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get('limit') || '20';

    const response = await spotifyApiRequest(
      `/me/player/recently-played?limit=${limit}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch recently played' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching recently played:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recently played' },
      { status: 500 }
    );
  }
}

