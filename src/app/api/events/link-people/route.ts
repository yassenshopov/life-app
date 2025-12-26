export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getMatchedPeopleFromEvent } from '@/lib/people-matching';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Dynamic import for googleapis
let google: any;
try {
  google = (await import('googleapis')).google;
} catch (error) {
  console.warn('googleapis package not installed');
}

interface GoogleCalendarCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
}

/**
 * One-time endpoint to link existing calendar events to people based on title matching
 * This should be called once to populate the event_people junction table
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { timeMin, timeMax } = body;

    if (!timeMin || !timeMax) {
      return NextResponse.json(
        { error: 'timeMin and timeMax are required' },
        { status: 400 }
      );
    }

    // Fetch all people for this user
    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('id, name, nicknames')
      .eq('user_id', userId);

    if (peopleError) {
      console.error('Error fetching people:', peopleError);
      return NextResponse.json(
        { error: 'Failed to fetch people' },
        { status: 500 }
      );
    }

    if (!people || people.length === 0) {
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'No people found to link',
      });
    }

    // Fetch user's Google Calendar credentials and preferences from Supabase
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('google_calendar_credentials, calendar_preferences')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const credentials: GoogleCalendarCredentials | null = user.google_calendar_credentials;
    const preferences = user.calendar_preferences || {};

    if (!credentials || !credentials.access_token) {
      return NextResponse.json(
        { error: 'Google Calendar not connected' },
        { status: 400 }
      );
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
          { error: 'Failed to refresh access token' },
          { status: 401 }
        );
      }
    }

    // Determine which calendars to fetch based on preferences
    let calendarsToFetch: string[] = [];
    if (preferences.selectedCalendars && Array.isArray(preferences.selectedCalendars)) {
      calendarsToFetch = preferences.selectedCalendars;
    } else {
      // If no preferences, fetch all calendars
      const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });
      const calendarList = await calendarApi.calendarList.list();
      calendarsToFetch = (calendarList.data.items || []).map((cal: any) => cal.id);
    }

    if (calendarsToFetch.length === 0) {
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'No calendars selected',
      });
    }

    // Fetch events from Google Calendar API
    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });
    const allEvents: Array<{ event: any; calendarId: string }> = [];

    for (const calendarId of calendarsToFetch) {
      try {
        let pageToken: string | undefined = undefined;
        do {
          const response = await calendarApi.events.list({
            calendarId,
            timeMin: timeMin,
            timeMax: timeMax,
            maxResults: 2500,
            singleEvents: true,
            orderBy: 'startTime',
            pageToken,
          });

          const items = response.data.items || [];
          // Store events with their calendar ID
          allEvents.push(...items.map((event: any) => ({ event, calendarId })));
          pageToken = response.data.nextPageToken;
        } while (pageToken);
      } catch (error: any) {
        console.error(`Error fetching events from calendar ${calendarId}:`, error);
        // Continue with other calendars
      }
    }

    // Format events to match the expected structure
    const events = allEvents.map(({ event, calendarId: eventCalendarId }) => {
      const startDate = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
        ? new Date(event.start.date + 'T00:00:00')
        : new Date();
      const endDate = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
        ? new Date(event.end.date + 'T00:00:00')
        : new Date();

      return {
        id: event.id,
        title: event.summary || 'No title',
        start: startDate,
        end: endDate,
        calendar: event.organizer?.displayName || eventCalendarId,
        calendarId: eventCalendarId,
      };
    });

    if (events.length === 0) {
      return NextResponse.json({
        success: true,
        linked: 0,
        message: 'No events found in the specified time range',
      });
    }

    // Process each event and link people
    let linkedCount = 0;
    const errors: string[] = [];

    for (const event of events) {
      const matchedPeople = getMatchedPeopleFromEvent(event.title, people);

      for (const person of matchedPeople) {
        // Check if relationship already exists
        const { data: existing } = await supabase
          .from('event_people')
          .select('id')
          .eq('user_id', userId)
          .eq('event_id', event.id)
          .eq('person_id', person.id)
          .single();

        if (existing) {
          continue; // Already linked
        }

        // Insert the relationship
        const { error } = await supabase
          .from('event_people')
          .insert({
            user_id: userId,
            event_id: event.id,
            person_id: person.id,
          });

        if (error) {
          if (error.code !== '23505') {
            // Ignore unique constraint errors (already exists)
            errors.push(`Event ${event.id}: ${error.message}`);
          }
        } else {
          linkedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      linked: linkedCount,
      totalEvents: events.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error linking events to people:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

