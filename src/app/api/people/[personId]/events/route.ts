export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface GoogleCalendarCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
}

/**
 * Fetch calendar events linked to a specific person
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { personId } = await params;

    // Fetch event IDs linked to this person
    const { data: eventPeople, error } = await supabase
      .from('event_people')
      .select('event_id')
      .eq('user_id', userId)
      .eq('person_id', personId);

    if (error) {
      console.error('Error fetching person events:', error);
      return NextResponse.json(
        { error: 'Failed to fetch person events' },
        { status: 500 }
      );
    }

    const eventIds = (eventPeople || []).map((ep: any) => ep.event_id);

    if (eventIds.length === 0) {
      return NextResponse.json({ events: [] });
    }

    // Fetch user's Google Calendar credentials
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('google_calendar_credentials, calendar_preferences')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const credentials: GoogleCalendarCredentials | null = user.google_calendar_credentials;
    if (!credentials || !credentials.access_token) {
      return NextResponse.json({ events: [] });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'OAuth credentials not configured' },
        { status: 500 }
      );
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token,
      expiry_date: credentials.expiry_date,
    });

    // Refresh token if needed
    if (credentials.expiry_date && credentials.expiry_date <= Date.now()) {
      try {
        const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
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
          { error: 'Failed to refresh access token' },
          { status: 401 }
        );
      }
    }

    // Get calendar preferences
    const preferences = user.calendar_preferences || {};
    let calendarsToFetch: string[] = [];
    if (preferences.selectedCalendars && Array.isArray(preferences.selectedCalendars)) {
      calendarsToFetch = preferences.selectedCalendars;
    } else {
      // Fetch all calendars
      const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });
      const calendarList = await calendarApi.calendarList.list();
      calendarsToFetch = (calendarList.data.items || []).map((cal: any) => cal.id);
    }

    // Fetch events from all calendars
    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });
    const timeMin = new Date();
    timeMin.setFullYear(timeMin.getFullYear() - 1);
    const timeMax = new Date();
    timeMax.setFullYear(timeMax.getFullYear() + 1);

    const allEvents: any[] = [];
    for (const calendarId of calendarsToFetch) {
      try {
        let pageToken: string | undefined = undefined;
        do {
          const response = await calendarApi.events.list({
            calendarId,
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            maxResults: 2500,
            singleEvents: true,
            orderBy: 'startTime',
            pageToken,
          });
          const items = response.data.items || [];
          allEvents.push(...items);
          pageToken = response.data.nextPageToken;
        } while (pageToken);
      } catch (error: any) {
        console.error(`Error fetching events from calendar ${calendarId}:`, error);
      }
    }

    // Filter to only events linked to this person
    const linkedEvents = allEvents.filter((event: any) =>
      eventIds.includes(event.id)
    );

    return NextResponse.json({ events: linkedEvents });
  } catch (error) {
    console.error('Error in GET /api/people/[personId]/events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

