import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    let redirectUri = process.env.SPOTIFY_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'Spotify OAuth credentials not configured' },
        { status: 500 }
      );
    }

    // Fix localhost redirect URI - Spotify requires http:// not https:// for localhost
    // Also handle 127.0.0.1 as an alternative
    if ((redirectUri.includes('localhost') || redirectUri.includes('127.0.0.1')) && redirectUri.startsWith('https://')) {
      redirectUri = redirectUri.replace('https://', 'http://');
    }

    // Spotify OAuth scopes
    const scopes = [
      'user-read-private',
      'user-read-email',
      'user-read-currently-playing',
      'user-read-playback-state',
      'user-modify-playback-state', // Required for play/pause control
      'user-top-read',
      'user-read-recently-played',
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-library-read',
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      state: userId, // Pass userId as state for verification
      show_dialog: 'true', // Force consent to get refresh token
    });

    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating Spotify OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate OAuth URL' },
      { status: 500 }
    );
  }
}

