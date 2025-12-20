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

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for force refresh parameter
    const { searchParams } = new URL(req.url);
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

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

    // Try to fetch from cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cachedCalendars, error: cacheError } = await supabase
        .from('google_calendars')
        .select('*')
        .eq('user_id', userId)
        .order('primary_calendar', { ascending: false })
        .order('summary', { ascending: true });

      // If we have cached calendars and they're recent (within 1 hour), return them
      if (!cacheError && cachedCalendars && cachedCalendars.length > 0) {
        const oldestSync = Math.min(
          ...cachedCalendars.map((cal) => new Date(cal.last_synced_at).getTime())
        );
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        if (oldestSync > oneHourAgo) {
          console.log('Returning cached calendars:', cachedCalendars.length);
          const formattedCalendars = cachedCalendars.map((cal) => ({
            id: cal.calendar_id,
            summary: cal.summary,
            color: cal.background_color || undefined,
            selected: cal.selected !== false,
          }));

          return NextResponse.json({ calendars: formattedCalendars, fromCache: true });
        }
      }
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

      const calendarItems = response.data.items || [];
      const now = new Date().toISOString();

      // Prepare calendars for response and caching
      const calendarsToReturn = calendarItems.map((cal: any) => ({
        id: cal.id || '',
        summary: cal.summary || 'Untitled Calendar',
        color: cal.backgroundColor || undefined,
        selected: cal.selected !== false, // Default to selected
      }));

      // Cache calendars in database
      if (calendarItems.length > 0) {
        // Delete existing calendars for this user (to handle deleted calendars)
        await supabase
          .from('google_calendars')
          .delete()
          .eq('user_id', userId);

        // Insert new calendars
        const calendarsToInsert = calendarItems.map((cal: any) => ({
          user_id: userId,
          calendar_id: cal.id || '',
          summary: cal.summary || 'Untitled Calendar',
          description: cal.description || null,
          time_zone: cal.timeZone || null,
          background_color: cal.backgroundColor || null,
          foreground_color: cal.foregroundColor || null,
          access_role: cal.accessRole || null,
          selected: cal.selected !== false,
          primary_calendar: cal.primary === true,
          calendar_data: cal, // Store full calendar data
          last_synced_at: now,
        }));

        // Insert in batches to avoid payload size issues
        const batchSize = 50;
        for (let i = 0; i < calendarsToInsert.length; i += batchSize) {
          const batch = calendarsToInsert.slice(i, i + batchSize);
          await supabase.from('google_calendars').insert(batch);
        }

        console.log('Cached calendars:', calendarsToInsert.length);
      }

      return NextResponse.json({ calendars: calendarsToReturn, fromCache: false });
    } catch (calendarError: any) {
      console.error('Error fetching calendars:', calendarError);
      
      // If API fails, try to return cached calendars as fallback
      const { data: cachedCalendars } = await supabase
        .from('google_calendars')
        .select('*')
        .eq('user_id', userId)
        .order('primary_calendar', { ascending: false })
        .order('summary', { ascending: true });

      if (cachedCalendars && cachedCalendars.length > 0) {
        console.log('API failed, returning cached calendars as fallback');
        const formattedCalendars = cachedCalendars.map((cal) => ({
          id: cal.calendar_id,
          summary: cal.summary,
          color: cal.background_color || undefined,
          selected: cal.selected !== false,
        }));
        return NextResponse.json({ 
          calendars: formattedCalendars, 
          fromCache: true,
          warning: 'Using cached data due to API error'
        });
      }

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

