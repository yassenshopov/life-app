import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Dynamic import for googleapis
let google: any;
try {
  const googleapis = await import('googleapis');
  google = googleapis.google;
} catch (error) {
  console.warn('googleapis package not installed');
}

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
        new URL(`/hq?error=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/hq?error=missing_code_or_state', req.url)
      );
    }

    // Verify the user is authenticated
    const { userId } = await auth();
    if (!userId || userId !== state) {
      return NextResponse.redirect(
        new URL('/hq?error=unauthorized', req.url)
      );
    }

    if (!google) {
      return NextResponse.redirect(
        new URL('/hq?error=api_not_configured', req.url)
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(
        new URL('/hq?error=oauth_not_configured', req.url)
      );
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Store credentials in Supabase
    const credentials = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
    };

    // First, check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, we'll create the user
      console.error('Error checking user:', fetchError);
      return NextResponse.redirect(
        new URL('/hq?error=storage_failed', req.url)
      );
    }

    // Use upsert to create or update the user
    const { error: upsertError } = await supabase
      .from('users')
      .upsert(
        {
          id: userId,
          google_calendar_credentials: credentials,
        },
        {
          onConflict: 'id',
        }
      );

    if (upsertError) {
      console.error('Error storing credentials:', upsertError);
      console.error('Error details:', {
        code: upsertError.code,
        message: upsertError.message,
        details: upsertError.details,
        hint: upsertError.hint,
      });
      return NextResponse.redirect(
        new URL(`/hq?error=storage_failed&details=${encodeURIComponent(upsertError.message)}`, req.url)
      );
    }

    // Redirect back to HQ page with success
    return NextResponse.redirect(new URL('/hq?connected=true', req.url));
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/hq?error=callback_failed', req.url)
    );
  }
}

