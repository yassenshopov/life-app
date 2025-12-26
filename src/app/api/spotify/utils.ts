import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SpotifyCredentials {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
}

export async function getSpotifyAccessToken(): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return null;
    }

    // Fetch user's Spotify credentials
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('spotify_credentials')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return null;
    }

    const credentials: SpotifyCredentials | null = user.spotify_credentials;

    if (!credentials || !credentials.access_token) {
      return null;
    }

    // Check if token is expired and refresh if needed
    if (credentials.expires_at && credentials.expires_at <= Date.now()) {
      const newToken = await refreshSpotifyToken(credentials.refresh_token, userId);
      return newToken;
    }

    return credentials.access_token;
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
    return null;
  }
}

async function refreshSpotifyToken(refreshToken: string, userId: string): Promise<string | null> {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return null;
    }

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      return null;
    }

    const tokens = await tokenResponse.json();

    // Update stored credentials
    const credentials = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken, // Keep old refresh token if not provided
      expires_in: tokens.expires_in,
      expires_at: Date.now() + tokens.expires_in * 1000,
    };

    await supabase.from('users').update({ spotify_credentials: credentials }).eq('id', userId);

    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    return null;
  }
}

export async function spotifyApiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = await getSpotifyAccessToken();

  if (!accessToken) {
    throw new Error('No Spotify access token available');
  }

  return fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}
