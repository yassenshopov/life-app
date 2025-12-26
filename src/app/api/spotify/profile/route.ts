import { NextResponse } from 'next/server';
import { spotifyApiRequest } from '../utils';

export async function GET() {
  try {
    const response = await spotifyApiRequest('/me');
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error?.message || 'Failed to fetch profile' },
        { status: response.status }
      );
    }

    const profile = await response.json();
    return NextResponse.json(profile);
  } catch (error: any) {
    console.error('Error fetching Spotify profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

