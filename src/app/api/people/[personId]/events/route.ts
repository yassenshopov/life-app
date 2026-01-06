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

    // OPTIMIZATION: Instead of fetching ALL events and filtering,
    // try to fetch each event directly by ID from each calendar in parallel
    // This is much faster when a person has only a few linked events
    
    // If we have too many events, use a more efficient strategy
    const MAX_DIRECT_FETCH_EVENTS = 50; // Threshold for direct fetch vs list approach
    const eventIdSet = new Set(eventIds);
    const linkedEvents: any[] = [];
    const foundEventIds = new Set<string>();
    const eventCalendarMap = new Map<string, string>();

    // Strategy: If few events, fetch directly by ID. If many events, use optimized list approach.
    if (eventIds.length <= MAX_DIRECT_FETCH_EVENTS && calendarsToFetch.length <= 10) {
      // Direct fetch approach: Try each event ID in each calendar
      // Batch requests to avoid overwhelming the API (max 20 concurrent)
      const BATCH_SIZE = 20;
      const fetchPromises: Promise<void>[] = [];
      const eventById = new Map<string, any>();
      
      for (const calendarId of calendarsToFetch) {
        for (const eventId of eventIds) {
          fetchPromises.push(
            calendarApi.events
              .get({
                calendarId,
                eventId,
              })
              .then((response) => {
                const event = response.data;
                if (event && event.id && eventIdSet.has(event.id)) {
                  // Atomically check and add - only process if this is the first time we see this event.id
                  if (!eventById.has(event.id)) {
                    eventById.set(event.id, event);
                    linkedEvents.push(event);
                    foundEventIds.add(event.id);
                    eventCalendarMap.set(event.id, calendarId);
                  }
                }
              })
              .catch((error: any) => {
                // Event not found in this calendar - this is expected and fine
                // Only log if it's not a 404
                if (error.code !== 404) {
                  console.error(`Error fetching event ${eventId} from calendar ${calendarId}:`, error.message);
                }
              })
          );

          // Process in batches to avoid overwhelming the API
          if (fetchPromises.length >= BATCH_SIZE) {
            await Promise.allSettled(fetchPromises);
            fetchPromises.length = 0; // Clear array
          }
        }
      }

      // Wait for remaining fetch attempts
      if (fetchPromises.length > 0) {
        await Promise.allSettled(fetchPromises);
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

