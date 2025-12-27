import { NextResponse } from 'next/server';
import { spotifyApiRequest } from '../utils';

export async function GET() {
  try {
    const response = await spotifyApiRequest('/me/player/currently-playing');
    
    if (response.status === 204) {
      // No content - user is not currently playing anything
      return NextResponse.json({ isPlaying: false });
    }

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch currently playing' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ isPlaying: true, ...data });
  } catch (error: any) {
    console.error('Error fetching currently playing:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch currently playing' },
      { status: 500 }
    );
  }
}

