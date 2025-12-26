import { NextResponse } from 'next/server';
import { spotifyApiRequest } from '../utils';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get('time_range') || 'medium_term'; // short_term, medium_term, long_term
    const limit = searchParams.get('limit') || '20';

    const response = await spotifyApiRequest(
      `/me/top/artists?time_range=${timeRange}&limit=${limit}`
    );
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch top artists' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching top artists:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch top artists' },
      { status: 500 }
    );
  }
}

