export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { google } from 'googleapis';

const supabase = getSupabaseServiceRoleClient();

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

    // Create calendar API client (reused throughout)
    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get calendar preferences and fetch calendar list
    const preferences = user.calendar_preferences || {};
    const calendarListResponse = await calendarApi.calendarList.list();
    const calendarList = calendarListResponse.data.items || [];
    
    let calendarsToFetch: string[] = [];
    if (preferences.selectedCalendars && Array.isArray(preferences.selectedCalendars)) {
      calendarsToFetch = preferences.selectedCalendars;
    } else {
      // Fetch all calendars
      calendarsToFetch = calendarList.map((cal: any) => cal.id);
    }

    // Fetch events from all calendars
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

    // Enhance events with calendar colors (reuse calendarList already fetched)
    const calendarMap = new Map(
      calendarList.map((cal: any) => [cal.id, cal.backgroundColor || '#4285f4'])
    );

    // Map colorId to hex and add calendar color
    const enhancedEvents = linkedEvents.map((event: any) => {
      const calendarId = event.organizer?.email || event.calendarId;
      const calendarColor = calendarId ? (calendarMap.get(calendarId) || '#4285f4') : '#4285f4';
      
      // Map colorId to hex color, using calendar color as fallback
      let color = calendarColor;
      if (event.colorId) {
        const colorMap: Record<string, string> = {
          '1': '#a4bdfc', '2': '#7ae7bf', '3': '#dbadff', '4': '#ff887c',
          '5': '#fbd75b', '6': '#ffb878', '7': '#46d6db', '8': '#e1e1e1',
          '9': '#5484ed', '10': '#51b749', '11': '#dc2127',
        };
        color = colorMap[event.colorId] || calendarColor;
      }
      
      return {
        ...event,
        color: color.startsWith('#') ? color : `#${color}`,
        calendarId: calendarId,
      };
    });

    return NextResponse.json({ events: enhancedEvents });
  } catch (error) {
    console.error('Error in GET /api/people/[personId]/events:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

