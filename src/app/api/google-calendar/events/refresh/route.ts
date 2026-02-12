import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/ensure-user';

// Dynamic import for googleapis
let google: any;
try {
  const googleapis = await import('googleapis');
  google = googleapis.google;
} catch (error) {
  console.warn('googleapis package not installed');
}

const supabase = getSupabaseServiceRoleClient();

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

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const calendarId = searchParams.get('calendarId');
    const yearsBack = parseInt(searchParams.get('yearsBack') || '10');
    const yearsForward = parseInt(searchParams.get('yearsForward') || '10');

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    }

    await ensureUserExists(supabase, userId);

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
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
    }

    if (!google) {
      return NextResponse.json({ error: 'Google Calendar API not configured' }, { status: 503 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({ error: 'OAuth credentials not configured' }, { status: 500 });
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
        return NextResponse.json({ error: 'Failed to refresh access token' }, { status: 401 });
      }
    }

    // Fetch events from Google Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Fetch calendar list for color info
    const calendarList = await calendar.calendarList.list();
    let effectiveIdForInfo = calendarId;

    // Fetch ALL events - use a wide time range (configurable, default: 10 years past to 10 years future)
    // Google Calendar API requires timeMin and timeMax, so we use a wide range
    // You can customize the range via query params: ?yearsBack=10&yearsForward=10
    const timeMin = new Date();
    timeMin.setFullYear(timeMin.getFullYear() - yearsBack);
    timeMin.setHours(0, 0, 0, 0);
    const timeMax = new Date();
    timeMax.setFullYear(timeMax.getFullYear() + yearsForward);
    timeMax.setHours(23, 59, 59, 999);

    // Fetch events with pagination to get all events
    let allEvents: any[] = [];
    let pageToken: string | undefined = undefined;
    let apiCalendarId = calendarId;

    try {
      do {
        let response: Awaited<ReturnType<typeof calendar.events.list>>;
        try {
          response = await calendar.events.list({
            calendarId: apiCalendarId,
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 2500, // Maximum allowed by Google Calendar API
            pageToken: pageToken,
          });
        } catch (listErr: any) {
          // Primary calendar may be stored by email in UI but API expects "primary". Retry once.
          if ((listErr.code === 404 || listErr.response?.status === 404) && apiCalendarId !== 'primary') {
            apiCalendarId = 'primary';
            effectiveIdForInfo = 'primary';
            pageToken = undefined;
            response = await calendar.events.list({
              calendarId: 'primary',
              timeMin: timeMin.toISOString(),
              timeMax: timeMax.toISOString(),
              singleEvents: true,
              orderBy: 'startTime',
              maxResults: 2500,
              pageToken: undefined,
            });
          } else {
            throw listErr;
          }
        }

        if (response.data.items) {
          allEvents = [...allEvents, ...response.data.items];
        }

        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);
    } catch (listError: any) {
      // Handle 404 errors for calendars that don't support event fetching
      // (e.g., locale/holiday calendars like "en-gb.bulgarian")
      if (listError.code === 404 || listError.response?.status === 404) {
        console.warn(
          `Calendar ${calendarId} not found or doesn't support event fetching. Skipping.`
        );
        return NextResponse.json({
          success: true,
          eventsCount: 0,
          calendarId,
          warning: 'Calendar not found or does not support event fetching',
          skipped: true,
        });
      }
      // Re-throw other errors
      throw listError;
    }

    const calInfo = calendarList.data.items?.find((cal: any) => cal.id === effectiveIdForInfo) ?? calendarList.data.items?.find((cal: any) => cal.id === calendarId);
    const backgroundColor = calInfo?.backgroundColor || '#4285f4';
    const calendarColor = backgroundColor.startsWith('#') ? backgroundColor : `#${backgroundColor}`;

    // Delete existing events for this calendar (all events, not just a time range)
    await supabase
      .from('google_calendar_events')
      .delete()
      .eq('user_id', userId)
      .eq('calendar_id', calendarId);

    // Insert new events
    if (allEvents.length > 0) {
      const eventsToInsert = allEvents.map((event: any) => {
        // Check if it's an all-day event (has date but no dateTime)
        const isAllDay = !event.start?.dateTime && !!event.start?.date;

        let start: Date;
        let end: Date;
        let startDate: string | null = null;
        let endDate: string | null = null;

        if (isAllDay) {
          // For all-day events, use date strings (no time)
          startDate = event.start.date;
          endDate = event.end.date; // End date is exclusive in GCal
          // Create Date objects for display (set to start of day)
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          end = new Date(endDate);
          // End date is exclusive, so subtract 1 day for display
          end.setDate(end.getDate() - 1);
          end.setHours(23, 59, 59, 999);
        } else {
          // For timed events, use dateTime
          start = new Date(event.start.dateTime);
          end = new Date(event.end.dateTime);
        }

        // Get color for the event
        const color = getColorFromColorId(event.colorId, calendarColor);

        return {
          user_id: userId,
          calendar_id: calendarId,
          event_id: event.id || `event-${Date.now()}-${Math.random()}`,
          title: event.summary || 'No Title',
          start_time: start.toISOString(), // Still store for querying
          end_time: end.toISOString(),
          start_date: startDate,
          end_date: endDate,
          is_all_day: isAllDay,
          color,
          description: event.description || null,
          location: event.location || null,
          organizer_email: event.organizer?.email || null,
          organizer_display_name: event.organizer?.displayName || null,
          attendees: event.attendees ? JSON.stringify(event.attendees) : null,
          recurrence: event.recurrence ? JSON.stringify(event.recurrence) : null,
          status: event.status || null,
          html_link: event.htmlLink || null,
          hangout_link: event.hangoutLink || null,
          conference_data: event.conferenceData ? JSON.stringify(event.conferenceData) : null,
          reminders: event.reminders ? JSON.stringify(event.reminders) : null,
          transparency: event.transparency || null,
          visibility: event.visibility || null,
          i_cal_uid: event.iCalUID || null,
          sequence: event.sequence || 0,
          created: event.created ? new Date(event.created).toISOString() : null,
          updated: event.updated ? new Date(event.updated).toISOString() : null,
          event_data: event, // Store full event data as backup
          last_synced_at: new Date().toISOString(),
        };
      });

      // Insert in batches to avoid payload size issues
      const batchSize = 100;
      for (let i = 0; i < eventsToInsert.length; i += batchSize) {
        const batch = eventsToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase.from('google_calendar_events').insert(batch);

        if (insertError) {
          console.error('Error inserting events batch:', insertError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      eventsCount: allEvents.length,
      calendarId,
      timeRange: {
        from: timeMin.toISOString(),
        to: timeMax.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error refreshing calendar events:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: (error as Error).message },
      { status: 500 }
    );
  }
}
