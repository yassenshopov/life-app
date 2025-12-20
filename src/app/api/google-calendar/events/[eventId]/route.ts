import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Dynamic import for googleapis
let google: any;
try {
  google = require('googleapis').google;
} catch (error) {
  console.warn('googleapis package not installed');
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

/**
 * Map Google Calendar colorId to hex color
 * Google Calendar uses predefined color IDs (1-11) that map to specific colors
 */
function getColorFromColorId(colorId: string | undefined | null, calendarColor: string): string {
  if (!colorId) {
    return calendarColor; // Fall back to calendar color if no event-specific color
  }

  // Google Calendar color ID to hex mapping
  const colorMap: Record<string, string> = {
    '1': '#a4bdfc', // Lavender
    '2': '#7ae7bf', // Sage
    '3': '#dbadff', // Grape
    '4': '#ff887c', // Flamingo
    '5': '#fbd75b', // Banana
    '6': '#ffb878', // Tangerine
    '7': '#46d6db', // Peacock
    '8': '#e1e1e1', // Graphite
    '9': '#5484ed', // Blueberry
    '10': '#51b749', // Basil
    '11': '#dc2127', // Tomato
  };

  return colorMap[colorId] || calendarColor; // Fall back to calendar color if colorId not recognized
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const body = await req.json();
    const { calendarId, startTime, endTime, isAllDay } = body;

    if (!calendarId || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'calendarId, startTime, and endTime are required' },
        { status: 400 }
      );
    }

    // Validate dates
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (newStart >= newEnd) {
      return NextResponse.json(
        { error: 'Start time must be before end time' },
        { status: 400 }
      );
    }

    // Fetch user's Google Calendar credentials
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('google_calendar_credentials')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const credentials: GoogleCalendarCredentials | null = user.google_calendar_credentials;

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
        oauth2Client.setCredentials(newCredentials);

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
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        return NextResponse.json(
          { error: 'Failed to refresh access token' },
          { status: 401 }
        );
      }
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // First, get the existing event to preserve other fields
    let existingEvent;
    try {
      const eventResponse = await calendar.events.get({
        calendarId,
        eventId,
      });
      existingEvent = eventResponse.data;
    } catch (error: any) {
      console.error('Error fetching event from Google Calendar:', error);
      return NextResponse.json(
        { error: 'Failed to fetch event from Google Calendar' },
        { status: 404 }
      );
    }

    // Update the event with new start/end times
    // Use the isAllDay parameter if provided, otherwise detect from existing event
    const shouldBeAllDay = isAllDay !== undefined ? isAllDay : (existingEvent.start?.date ? true : false);

    const updatedEvent = {
      ...existingEvent,
      start: shouldBeAllDay
        ? { date: newStart.toISOString().split('T')[0] }
        : { dateTime: newStart.toISOString(), timeZone: existingEvent.start?.timeZone || 'UTC' },
      end: shouldBeAllDay
        ? { date: newEnd.toISOString().split('T')[0] }
        : { dateTime: newEnd.toISOString(), timeZone: existingEvent.end?.timeZone || 'UTC' },
    };

    // Update event in Google Calendar
    let googleEvent;
    try {
      const updateResponse = await calendar.events.update({
        calendarId,
        eventId,
        requestBody: updatedEvent,
      });
      googleEvent = updateResponse.data;
    } catch (error: any) {
      console.error('Error updating event in Google Calendar:', error);
      return NextResponse.json(
        { error: 'Failed to update event in Google Calendar', details: error.message },
        { status: 500 }
      );
    }

    // Get calendar color for fallback
    let calendarColor = '#4285f4';
    try {
      const { data: cachedCalendar } = await supabase
        .from('google_calendars')
        .select('background_color')
        .eq('user_id', userId)
        .eq('calendar_id', calendarId)
        .single();
      
      if (cachedCalendar?.background_color) {
        calendarColor = cachedCalendar.background_color.startsWith('#') 
          ? cachedCalendar.background_color 
          : `#${cachedCalendar.background_color}`;
      }
    } catch (error) {
      console.warn('Could not fetch calendar color for event update response:', error);
    }

    // Update event in Supabase cache
    const isAllDayEvent = !!googleEvent.start?.date;
    const eventStartTime = isAllDayEvent
      ? new Date(googleEvent.start.date + 'T00:00:00Z')
      : new Date(googleEvent.start.dateTime);
    const eventEndTime = isAllDayEvent
      ? new Date(googleEvent.end.date + 'T00:00:00Z')
      : new Date(googleEvent.end.dateTime);

    const eventColor = getColorFromColorId(googleEvent.colorId, calendarColor);

    const { error: updateError } = await supabase
      .from('google_calendar_events')
      .update({
        start_time: eventStartTime.toISOString(),
        end_time: eventEndTime.toISOString(),
        is_all_day: isAllDayEvent,
        start_date: isAllDayEvent ? googleEvent.start.date : null,
        end_date: isAllDayEvent ? googleEvent.end.date : null,
        color: eventColor, // Update with event-specific color if available
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        event_data: googleEvent, // Update full event data
      })
      .eq('user_id', userId)
      .eq('calendar_id', calendarId)
      .eq('event_id', eventId);

    if (updateError) {
      console.error('Error updating event in Supabase:', updateError);
      // Don't fail the request if Supabase update fails - Google Calendar update succeeded
    }

    // Return updated event in the same format as GET /api/google-calendar/events
    const responseEvent = {
      id: googleEvent.id,
      title: googleEvent.summary || 'No Title',
      start: eventStartTime,
      end: eventEndTime,
      color: eventColor,
      calendar: calendarId,
      description: googleEvent.description || null,
      location: googleEvent.location || null,
      htmlLink: googleEvent.htmlLink || null,
      hangoutLink: googleEvent.hangoutLink || null,
      isAllDay: isAllDayEvent,
      organizer: googleEvent.organizer
        ? {
            email: googleEvent.organizer.email,
            displayName: googleEvent.organizer.displayName,
          }
        : undefined,
      attendees: googleEvent.attendees || null,
      reminders: googleEvent.reminders || null,
      recurrence: googleEvent.recurrence || null,
      status: googleEvent.status || null,
      transparency: googleEvent.transparency || null,
      visibility: googleEvent.visibility || null,
      conferenceData: googleEvent.conferenceData || null,
      created: googleEvent.created ? new Date(googleEvent.created) : undefined,
      updated: googleEvent.updated ? new Date(googleEvent.updated) : undefined,
    };

    return NextResponse.json({ event: responseEvent, success: true });
  } catch (error: any) {
    console.error('Error in PATCH /api/google-calendar/events/[eventId]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

