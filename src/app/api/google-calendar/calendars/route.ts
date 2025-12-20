import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Dynamic import for googleapis (install with: npm install googleapis)
let google: any;
try {
  google = require('googleapis').google;
} catch (error) {
  console.warn('googleapis package not installed. Install it with: npm install googleapis');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GoogleCalendarCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's Google Calendar credentials from Supabase
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('google_calendar_credentials')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return NextResponse.json(
        { 
          error: 'User not found or credentials not set up',
          message: userError.message,
          calendars: [] 
        },
        { status: 404 }
      );
    }

    if (!user) {
      console.error('User not found for userId:', userId);
      return NextResponse.json(
        { 
          error: 'User not found',
          calendars: [] 
        },
        { status: 404 }
      );
    }

    const credentials: GoogleCalendarCredentials | null = user.google_calendar_credentials;

    console.log('User credentials check:', {
      hasCredentials: !!credentials,
      hasAccessToken: !!credentials?.access_token,
      userId,
    });

    if (!credentials || !credentials.access_token) {
      return NextResponse.json(
        { error: 'Google Calendar not connected', calendars: [] },
        { status: 200 }
      );
    }

    if (!google) {
      return NextResponse.json(
        {
          error: 'Google Calendar API not configured',
          message: 'Please install googleapis package: npm install googleapis',
          calendars: [],
        },
        { status: 503 }
      );
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      expiry_date: credentials.expiry_date,
    });

    // Refresh token if needed
    if (credentials.expiry_date && credentials.expiry_date <= Date.now()) {
      try {
        const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
        
        // Update stored credentials
        await supabase
          .from('users')
          .update({
            google_calendar_credentials: {
              ...credentials,
              access_token: newCredentials.access_token,
              expiry_date: newCredentials.expiry_date,
            },
          })
          .eq('id', userId);

        oauth2Client.setCredentials(newCredentials);
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        return NextResponse.json(
          { error: 'Failed to refresh access token. Please reconnect your Google Calendar.' },
          { status: 401 }
        );
      }
    }

    // Fetch calendars from Google Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    try {
      const response = await calendar.calendarList.list({
        minAccessRole: 'reader',
      });

      const calendars = (response.data.items || []).map((cal) => ({
        id: cal.id || '',
        summary: cal.summary || 'Untitled Calendar',
        color: cal.backgroundColor || undefined,
        selected: cal.selected !== false, // Default to selected
      }));

      return NextResponse.json({ calendars });
    } catch (calendarError: any) {
      console.error('Error fetching calendars:', calendarError);
      return NextResponse.json(
        {
          error: 'Failed to fetch calendars',
          message: calendarError.message,
          calendars: [],
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET /api/google-calendar/calendars:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', calendars: [] },
      { status: 500 }
    );
  }
}

