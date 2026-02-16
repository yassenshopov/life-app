export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/ensure-user';
import { google } from 'googleapis';
import pLimit from 'p-limit';

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

    // Fetch event IDs (and calendar_id when stored) linked to this person
    const { data: eventPeople, error } = await supabase
      .from('event_people')
      .select('event_id, calendar_id')
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
    const eventToCalendar = new Map<string, string>();
    for (const ep of eventPeople || []) {
      if (ep.calendar_id) eventToCalendar.set(ep.event_id, ep.calendar_id);
    }

    if (eventIds.length === 0) {
      return NextResponse.json({ events: [] });
    }

    await ensureUserExists(supabase, userId);

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

    const preferences = user.calendar_preferences || {};
    const eventIdSet = new Set(eventIds);
    const linkedEvents: any[] = [];
    const foundEventIds = new Set<string>();
    const eventCalendarMap = new Map<string, string>();

    // Start calendar list fetch immediately (needed for colors; and for calendar ids if no preferences)
    const calendarListPromise = calendarApi.calendarList.list();

    let calendarsToFetch: string[] = [];
    let calendarList: any[] = [];
    const hasSelectedCalendars =
      preferences.selectedCalendars && Array.isArray(preferences.selectedCalendars);

    if (hasSelectedCalendars) {
      calendarsToFetch = preferences.selectedCalendars!;
    } else {
      const calendarListResponse = await calendarListPromise;
      calendarList = calendarListResponse.data.items || [];
      calendarsToFetch = calendarList.map((cal: any) => cal.id);
    }

    const MAX_DIRECT_FETCH_EVENTS = 50;
    const MAX_CALENDARS_FOR_DIRECT = 15;

    if (eventIds.length <= MAX_DIRECT_FETCH_EVENTS && calendarsToFetch.length <= MAX_CALENDARS_FOR_DIRECT) {
      // Direct fetch: when we have calendar_id in event_people, one get per event; else one per (calendar, eventId).
      // Use a concurrency limiter to avoid hitting Google rate limits.
      const CONCURRENCY = 8;
      const limit = pLimit(CONCURRENCY);

      type Task = { calendarId: string; eventId: string };
      const tasks: Task[] = [];
      for (const eventId of eventIds) {
        const knownCal = eventToCalendar.get(eventId);
        if (knownCal) {
          tasks.push({ calendarId: knownCal, eventId });
        } else {
          for (const calendarId of calendarsToFetch) {
            tasks.push({ calendarId, eventId });
          }
        }
      }

      const eventById = new Map<string, any>();
      const promises: Promise<void>[] = tasks.map(({ calendarId, eventId }) =>
        limit(async () => {
          if (foundEventIds.has(eventId)) return;
          return calendarApi.events
            .get({ calendarId, eventId })
            .then((response) => {
              const event = response.data;
              if (event?.id && eventIdSet.has(event.id) && !eventById.has(event.id)) {
                eventById.set(event.id, event);
                linkedEvents.push(event);
                foundEventIds.add(event.id);
                eventCalendarMap.set(event.id, calendarId);
              }
            })
            .catch((error: any) => {
              if (error?.code !== 404) {
                console.error(`Error fetching event ${eventId} from calendar ${calendarId}:`, error?.message);
              }
            });
        })
      );

      // Run calendar list (for colors) and all event gets in parallel when we already have calendar ids
      if (hasSelectedCalendars) {
        const [listRes] = await Promise.all([calendarListPromise, ...promises]);
        calendarList = listRes?.data?.items || [];
      } else {
        await Promise.all(promises);
      }
    } else {
      // For many events, use optimized list approach with early exit
      const timeMin = new Date();
      timeMin.setFullYear(timeMin.getFullYear() - 2);
      const timeMax = new Date();
      timeMax.setFullYear(timeMax.getFullYear() + 1);

      for (const calendarId of calendarsToFetch) {
        // Early exit if we've found all events
        if (foundEventIds.size === eventIds.length) break;

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
            for (const event of items) {
              if (eventIdSet.has(event.id)) {
                linkedEvents.push(event);
                foundEventIds.add(event.id);
                eventCalendarMap.set(event.id, calendarId);
                
                // Early exit if we found all events
                if (foundEventIds.size === eventIds.length) {
                  pageToken = undefined;
                  break;
                }
              }
            }
            
            pageToken = response.data.nextPageToken;
          } while (pageToken && foundEventIds.size < eventIds.length);
        } catch (error: any) {
          console.error(`Error fetching events from calendar ${calendarId}:`, error);
        }
      }
      // Ensure we have calendar list for colors (if we used list path with selectedCalendars we didn't await yet)
      if (hasSelectedCalendars && calendarList.length === 0) {
        const listRes = await calendarListPromise;
        calendarList = listRes?.data?.items || [];
      }
    }

    // If we used direct fetch and didn't find all events, try a fallback search
    // (This handles cases where events might be in calendars not in our selected list)
    const missingEventIds = eventIds.filter((id) => !foundEventIds.has(id));
    
    if (missingEventIds.length > 0 && eventIds.length <= MAX_DIRECT_FETCH_EVENTS) {
      // Only a few events missing from direct fetch - try a targeted search as fallback
      const timeMin = new Date();
      timeMin.setFullYear(timeMin.getFullYear() - 2);
      const timeMax = new Date();
      timeMax.setFullYear(timeMax.getFullYear() + 1);

      const missingEventIdSet = new Set(missingEventIds);
      
      for (const calendarId of calendarsToFetch) {
        // Skip if we've found all events
        if (missingEventIdSet.size === 0) break;

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
            for (const event of items) {
              if (missingEventIdSet.has(event.id)) {
                linkedEvents.push(event);
                foundEventIds.add(event.id);
                eventCalendarMap.set(event.id, calendarId);
                missingEventIdSet.delete(event.id);
                
                // Early exit if we found all missing events
                if (missingEventIdSet.size === 0) {
                  pageToken = undefined;
                  break;
                }
              }
            }
            
            pageToken = response.data.nextPageToken;
          } while (pageToken && missingEventIdSet.size > 0);
        } catch (error: any) {
          console.error(`Error fetching events from calendar ${calendarId}:`, error);
        }
      }
    }

    // Enhance events with calendar colors (reuse calendarList already fetched)
    const calendarMap = new Map(
      calendarList.map((cal: any) => [cal.id, cal.backgroundColor || '#4285f4'])
    );

    // Map colorId to hex and add calendar color
    const enhancedEvents = linkedEvents.map((event: any) => {
      // Use the calendar we found the event in, or fallback to organizer email
      const eventCalendarId = eventCalendarMap.get(event.id) || event.organizer?.email || event.calendarId;
      const calendarColor = eventCalendarId ? (calendarMap.get(eventCalendarId) || '#4285f4') : '#4285f4';
      
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
        calendarId: eventCalendarId,
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

