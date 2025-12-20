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

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, startTime, endTime, isAllDay, description, location, calendarId } = body;

    if (!title || !startTime || !endTime || !calendarId) {
      return NextResponse.json(
        { error: 'title, startTime, endTime, and calendarId are required' },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (start >= end) {
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

    // Create the event
    const eventData: any = {
      summary: title,
      description: description || undefined,
      location: location || undefined,
      start: isAllDay
        ? { date: start.toISOString().split('T')[0] }
        : { dateTime: start.toISOString(), timeZone: 'UTC' },
      end: isAllDay
        ? { date: end.toISOString().split('T')[0] }
        : { dateTime: end.toISOString(), timeZone: 'UTC' },
    };

    let googleEvent;
    try {
      const createResponse = await calendar.events.insert({
        calendarId,
        requestBody: eventData,
      });
      googleEvent = createResponse.data;
    } catch (error: any) {
      console.error('Error creating event in Google Calendar:', error);
      return NextResponse.json(
        { error: 'Failed to create event in Google Calendar', details: error.message },
        { status: 500 }
      );
    }

    // Cache the event in Supabase
    const isAllDayEvent = !!googleEvent.start?.date;
    const eventStartTime = isAllDayEvent
      ? new Date(googleEvent.start.date + 'T00:00:00Z')
      : new Date(googleEvent.start.dateTime);
    const eventEndTime = isAllDayEvent
      ? new Date(googleEvent.end.date + 'T00:00:00Z')
      : new Date(googleEvent.end.dateTime);

    // Get calendar color - try from cached calendars first to avoid extra API call
    let color = '#4285f4';
    try {
      const { data: cachedCalendar } = await supabase
        .from('google_calendars')
        .select('background_color')
        .eq('user_id', userId)
        .eq('calendar_id', calendarId)
        .single();
      
      if (cachedCalendar?.background_color) {
        color = cachedCalendar.background_color;
      } else {
        // Fallback: try to get from API (but don't fail if it doesn't work)
        try {
          const calendarList = await calendar.calendarList.list();
          const calendarInfo = calendarList.data.items?.find((cal: any) => cal.id === calendarId);
          color = calendarInfo?.backgroundColor || '#4285f4';
        } catch (error) {
          console.warn('Could not fetch calendar color from API, using default:', error);
          // Use default color, don't fail the request
        }
      }
    } catch (error) {
      console.warn('Could not fetch calendar color, using default:', error);
      // Use default color, don't fail the request
    }

    const { error: insertError } = await supabase
      .from('google_calendar_events')
      .insert({
        user_id: userId,
        calendar_id: calendarId,
        event_id: googleEvent.id,
        title: googleEvent.summary || 'No Title',
        start_time: eventStartTime.toISOString(),
        end_time: eventEndTime.toISOString(),
        is_all_day: isAllDayEvent,
        start_date: isAllDayEvent ? googleEvent.start.date : null,
        end_date: isAllDayEvent ? googleEvent.end.date : null,
        color,
        description: googleEvent.description || null,
        location: googleEvent.location || null,
        event_data: googleEvent,
        last_synced_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error caching event in Supabase:', insertError);
      // Don't fail the request if Supabase insert fails - Google Calendar event was created
    }

    // Return created event in the same format as GET /api/google-calendar/events
    const responseEvent = {
      id: googleEvent.id,
      title: googleEvent.summary || 'No Title',
      start: eventStartTime,
      end: eventEndTime,
      color,
      calendar: calendarId,
      calendarId,
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
    console.error('Error in POST /api/google-calendar/events/create:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

