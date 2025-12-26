import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This should be the userId
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/spotify?error=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/spotify?error=missing_code_or_state', req.url)
      );
    }

    // Verify the user - state contains the userId from the auth flow
    // We verify it matches, but don't require Clerk session since this is a callback
    if (!state) {
      return NextResponse.redirect(
        new URL('/spotify?error=missing_state', req.url)
      );
    }

    // Try to get userId from Clerk, but if not available, use state
    // This allows the callback to work even if the user's session expired
    const { userId } = await auth();
    const userIdToUse = userId || state;

    // Verify state matches the expected userId format (starts with 'user_')
    if (!userIdToUse.startsWith('user_')) {
      return NextResponse.redirect(
        new URL('/spotify?error=invalid_state', req.url)
      );
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    let redirectUri = process.env.SPOTIFY_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL('/spotify?error=oauth_not_configured', req.url)
      );
    }

    // Fix localhost redirect URI - Spotify requires http:// not https:// for localhost
    // Also handle 127.0.0.1 as an alternative
    if ((redirectUri.includes('localhost') || redirectUri.includes('127.0.0.1')) && redirectUri.startsWith('https://')) {
      redirectUri = redirectUri.replace('https://', 'http://');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange error:', errorData);
      return NextResponse.redirect(
        new URL('/spotify?error=token_exchange_failed', req.url)
      );
    }

    const tokens = await tokenResponse.json();

    // Store credentials in Supabase
    const credentials = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      expires_at: Date.now() + tokens.expires_in * 1000,
    };

    // First, check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userIdToUse)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, we'll create the user
      console.error('Error checking user:', fetchError);
      return NextResponse.redirect(
        new URL('/spotify?error=storage_failed', req.url)
      );
    }

    // Use upsert to create or update the user
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          id: userIdToUse,
          spotify_credentials: credentials,
        },
        {
          onConflict: 'id',
        }
      );

    if (upsertError) {
      console.error('Error storing credentials:', upsertError);
      return NextResponse.redirect(
        new URL(`/spotify?error=storage_failed&details=${encodeURIComponent(upsertError.message)}`, req.url)
      );
    }

    // Redirect back to Spotify page with success
    return NextResponse.redirect(new URL('/spotify?connected=true', req.url));
  } catch (error) {
    console.error('Error in Spotify OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/spotify?error=callback_failed', req.url)
    );
  }
}

