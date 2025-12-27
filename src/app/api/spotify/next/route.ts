import { NextResponse } from 'next/server';
import { spotifyApiRequest } from '../utils';

export async function POST() {
  try {
    const response = await spotifyApiRequest('/me/player/next', {
      method: 'POST',
    });

    if (response.status === 204) {
      return NextResponse.json({ success: true });
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Failed to skip to next track' } }));
      const errorMessage = error.error?.message || 'Failed to skip to next track';
      // Check if it's a permissions error
      if (response.status === 401 || errorMessage.toLowerCase().includes('permission')) {
        return NextResponse.json(
          { error: 'Permissions missing. Please reconnect to Spotify to enable playback control.', needsReconnect: true },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to skip to next track' },
      { status: 500 }
    );
  }
}

