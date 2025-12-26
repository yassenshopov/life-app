import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Dynamic import for googleapis
let google: any;
try {
  const googleapis = await import('googleapis');
  google = googleapis.google;
} catch (error) {
  console.warn('googleapis package not installed');
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!google) {
      return NextResponse.json(
        { error: 'Google Calendar API not configured' },
        { status: 503 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'Google OAuth credentials not configured' },
        { status: 500 }
      );
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Generate the auth URL
    // Request all calendar scopes to avoid insufficient authentication errors
    const scopes = [
      'https://www.googleapis.com/auth/calendar', // Full calendar access (read/write)
      'https://www.googleapis.com/auth/calendar.events', // Full event access (read/write)
      'https://www.googleapis.com/auth/calendar.readonly', // Read-only access (for compatibility)
      'https://www.googleapis.com/auth/calendar.settings.readonly', // Calendar settings read
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to get refresh token
      state: userId, // Pass userId as state for verification
    });

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate OAuth URL' },
      { status: 500 }
    );
  }
}

