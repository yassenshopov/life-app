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

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for date range
    const { searchParams } = new URL(req.url);
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');
    const calendarIds = searchParams.get('calendarIds')?.split(',') || [];
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // Fetch user's Google Calendar credentials and preferences from Supabase
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('google_calendar_credentials, calendar_preferences')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('Error fetching user:', userError);
      return NextResponse.json(
        { error: 'User not found', events: [] },
        { status: 404 }
      );
    }

    const credentials: GoogleCalendarCredentials | null = user.google_calendar_credentials;
    const preferences = user.calendar_preferences || {};

    if (!credentials || !credentials.access_token) {
      return NextResponse.json(
        { error: 'Google Calendar not connected', events: [] },
        { status: 200 }
      );
    }

    // Determine which calendars to fetch based on preferences
    let calendarsToFetch = calendarIds;
    if (calendarsToFetch.length === 0) {
      // Get selected calendars from preferences
      const allCalendarIds = Object.keys(preferences);
      calendarsToFetch = allCalendarIds.filter((calId) => {
        const pref = preferences[calId];
        return pref?.selected !== false; // Default to selected
      });
      
      // If no preferences set, fetch all calendars from cache (user might not have set preferences yet)
      if (calendarsToFetch.length === 0) {
        // Check what calendars have cached events
        const { data: cachedCalendars } = await supabase
          .from('google_calendar_events')
          .select('calendar_id')
          .eq('user_id', userId)
          .limit(100);
        
        if (cachedCalendars && cachedCalendars.length > 0) {
          const uniqueCalendars = [...new Set(cachedCalendars.map(c => c.calendar_id))];
          calendarsToFetch = uniqueCalendars;
        }
      }
    }

    // Set default time range if not provided
    const defaultTimeMin = new Date();
    defaultTimeMin.setHours(0, 0, 0, 0);
    const defaultTimeMax = new Date();
    defaultTimeMax.setDate(defaultTimeMax.getDate() + 30);
    defaultTimeMax.setHours(23, 59, 59, 999);

    const timeMinParam = timeMin ? new Date(timeMin) : defaultTimeMin;
    const timeMaxParam = timeMax ? new Date(timeMax) : defaultTimeMax;

    // Try to fetch from cache first (unless force refresh)
    // Query events that overlap with the time range (start before timeMax and end after timeMin)
    if (!forceRefresh) {
      // Build cache query - get all events for user that overlap the time range
      let cacheQuery = supabase
        .from('google_calendar_events')
        .select('*')
        .eq('user_id', userId)
        // Events that overlap: start_time <= timeMax AND end_time >= timeMin
        .lte('start_time', timeMaxParam.toISOString())
        .gte('end_time', timeMinParam.toISOString())
        .order('start_time', { ascending: true });

      // Filter by calendar if specific calendars are requested via query param
      if (calendarIds.length > 0) {
        cacheQuery = cacheQuery.in('calendar_id', calendarIds);
      }
      // Otherwise, get ALL cached calendars (don't filter by preferences for cache query)
      // We'll filter by preferences after fetching, or show all if no preferences set

      const { data: cachedEvents, error: cacheError } = await cacheQuery;

      // Debug: Check what columns are actually returned
      if (cachedEvents && cachedEvents.length > 0) {
        const firstEvent = cachedEvents[0];
        console.log('Cache query - First event columns:', {
          event_id: firstEvent.event_id,
          has_location: 'location' in firstEvent,
          location_value: firstEvent.location,
          location_type: typeof firstEvent.location,
          has_description: 'description' in firstEvent,
          description_value: firstEvent.description,
          all_keys: Object.keys(firstEvent),
        });
      }

      console.log('Cache query result:', {
        userId,
        timeRange: { min: timeMinParam.toISOString(), max: timeMaxParam.toISOString() },
        requestedCalendarIds: calendarIds,
        calendarsToFetch,
        cachedCount: cachedEvents?.length || 0,
        error: cacheError?.message,
      });

      if (!cacheError && cachedEvents && cachedEvents.length > 0) {
        // Filter by preferences if they exist and are meaningful
        // If preferences only have one calendar, it might be incomplete - show all
        let filteredEvents = cachedEvents;
        
        // Only filter by preferences if:
        // 1. No specific calendars were requested via query param
        // 2. Preferences exist and have multiple calendars (not just one)
        // 3. This ensures we show all calendars if user hasn't set preferences properly
        const allCalendarIdsInPreferences = Object.keys(preferences);
        const hasMultiplePreferences = allCalendarIdsInPreferences.length > 1;
        
        if (calendarIds.length === 0 && calendarsToFetch.length > 0 && hasMultiplePreferences) {
          // Filter by preferences only if user has set preferences for multiple calendars
          filteredEvents = cachedEvents.filter((event) =>
            calendarsToFetch.includes(event.calendar_id)
          );
        } else if (calendarIds.length === 0 && calendarsToFetch.length === 0) {
          // No preferences set - show all cached calendars
          filteredEvents = cachedEvents;
        }

        // Return cached events
        const formattedEvents = filteredEvents.map((event: any) => {
          // Use is_all_day column if available, otherwise check event_data
          const isAllDay = event.is_all_day ?? (event.event_data?.isAllDay || false);
          
          let start: Date;
          let end: Date;
          
          if (isAllDay && event.start_date) {
            // For all-day events, use start_date/end_date
            start = new Date(event.start_date);
            start.setHours(0, 0, 0, 0);
            // End date is exclusive, so subtract 1 day
            end = new Date(event.end_date);
            end.setDate(end.getDate() - 1);
            end.setHours(23, 59, 59, 999);
          } else {
            // For timed events, use start_time/end_time
            start = new Date(event.start_time);
            end = new Date(event.end_time);
          }
          
          // Parse JSON fields from database
          let attendees = null;
          let reminders = null;
          let recurrence = null;
          let conferenceData = null;
          
          try {
            if (event.attendees) {
              attendees = typeof event.attendees === 'string' ? JSON.parse(event.attendees) : event.attendees;
            }
            if (event.reminders) {
              reminders = typeof event.reminders === 'string' ? JSON.parse(event.reminders) : event.reminders;
            }
            if (event.recurrence) {
              recurrence = typeof event.recurrence === 'string' ? JSON.parse(event.recurrence) : event.recurrence;
            }
            if (event.conference_data) {
              conferenceData = typeof event.conference_data === 'string' ? JSON.parse(event.conference_data) : event.conference_data;
            }
          } catch (e) {
            console.warn('Error parsing JSON fields from cache:', e);
          }
          
          // Fallback to event_data if columns are NULL (for events synced before migration)
          // event_data is JSONB, so it should already be parsed by Supabase, but handle both cases
          let eventDataFallback: any = {};
          try {
            if (event.event_data) {
              if (typeof event.event_data === 'string') {
                eventDataFallback = JSON.parse(event.event_data);
              } else if (typeof event.event_data === 'object' && event.event_data !== null) {
                eventDataFallback = event.event_data;
              }
            }
          } catch (e) {
            console.warn('Error parsing event_data:', e, event.event_data);
            eventDataFallback = {};
          }
          
          const eventData = {
            id: event.event_id,
            title: event.title,
            start,
            end,
            color: event.color || '#4285f4',
            calendar: event.organizer_display_name || event.calendar_id,
            calendarId: event.calendar_id, // Include the actual calendar ID
            // Use column value if available, otherwise fallback to event_data
            // Check both null and undefined, and handle empty strings
            description: (event.description != null && String(event.description).trim() !== '') 
              ? event.description 
              : (eventDataFallback.description != null && String(eventDataFallback.description).trim() !== '') 
                ? eventDataFallback.description 
                : null,
            location: (event.location != null && String(event.location).trim() !== '') 
              ? event.location 
              : (eventDataFallback.location != null && String(eventDataFallback.location).trim() !== '') 
                ? eventDataFallback.location 
                : null,
            htmlLink: event.html_link || eventDataFallback.htmlLink || null,
            hangoutLink: event.hangout_link || eventDataFallback.hangoutLink || null,
            isAllDay,
            organizer: (event.organizer_email || event.organizer_display_name || eventDataFallback.organizer) ? {
              email: event.organizer_email || eventDataFallback.organizer?.email || undefined,
              displayName: event.organizer_display_name || eventDataFallback.organizer?.displayName || undefined,
            } : undefined,
            attendees: attendees || eventDataFallback.attendees || null,
            reminders: reminders || eventDataFallback.reminders || null,
            recurrence: recurrence || eventDataFallback.recurrence || null,
            status: event.status || eventDataFallback.status || null,
            transparency: event.transparency || eventDataFallback.transparency || null,
            visibility: event.visibility || eventDataFallback.visibility || null,
            conferenceData: conferenceData || eventDataFallback.conferenceData || null,
            created: event.created ? new Date(event.created) : (eventDataFallback.created ? new Date(eventDataFallback.created) : undefined),
            updated: event.updated ? new Date(event.updated) : (eventDataFallback.updated ? new Date(eventDataFallback.updated) : undefined),
          };

          // Debug logging for events with location to see what we're getting
          if (event.location || eventDataFallback.location) {
            console.log('Event with location data:', {
              event_id: event.event_id,
              title: event.title,
              location_from_column: event.location,
              location_from_column_type: typeof event.location,
              location_from_fallback: eventDataFallback.location,
              location_from_fallback_type: typeof eventDataFallback.location,
              final_location: eventData.location,
              has_event_data: !!event.event_data,
              event_data_type: typeof event.event_data,
              event_data_keys: event.event_data && typeof event.event_data === 'object' && event.event_data !== null ? Object.keys(event.event_data) : 'N/A',
              raw_event_location: event.location,
              raw_event_keys: Object.keys(event).filter(k => k.includes('location') || k.includes('description')),
            });
          }

          return eventData;
        });

        console.log('Returning cached events:', {
          total: cachedEvents.length,
          filtered: formattedEvents.length,
          calendars: [...new Set(formattedEvents.map(e => e.calendar))],
        });
        return NextResponse.json({ events: formattedEvents, fromCache: true });
      }
    }

    if (!google) {
      return NextResponse.json(
        { error: 'Google Calendar API not configured', events: [] },
        { status: 503 }
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'OAuth credentials not configured', events: [] },
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
          { error: 'Failed to refresh access token', events: [] },
          { status: 401 }
        );
      }
    }

    // Cache miss or force refresh - fetch from Google Calendar API
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();
    const calendarListData = calendarList.data;

    // Fetch events from each calendar and cache them
    const allEvents: any[] = [];
    const eventsToCache: any[] = [];

    for (const calendarId of calendarsToFetch) {
      try {
        const response = await calendar.events.list({
          calendarId,
          timeMin: timeMinParam.toISOString(),
          timeMax: timeMaxParam.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        });

        // Try to get calendar info from cached calendars first, then from API response
        let calInfo = null;
        let backgroundColor = '#4285f4';
        
        // Check cached calendars
        const { data: cachedCalendar } = await supabase
          .from('google_calendars')
          .select('background_color, calendar_data')
          .eq('user_id', userId)
          .eq('calendar_id', calendarId)
          .single();
        
        if (cachedCalendar?.calendar_data) {
          calInfo = cachedCalendar.calendar_data;
          backgroundColor = cachedCalendar.background_color || calInfo?.backgroundColor || '#4285f4';
        } else if (calendarListData?.items) {
          calInfo = calendarListData.items.find((cal: any) => cal.id === calendarId);
          backgroundColor = calInfo?.backgroundColor || '#4285f4';
        }
        
        const color = backgroundColor.startsWith('#') ? backgroundColor : `#${backgroundColor}`;

        const events = (response.data.items || []).map((event: any) => {
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

          // Prepare for caching with enhanced fields
          eventsToCache.push({
            user_id: userId,
            calendar_id: calendarId,
            event_id: event.id || `event-${Date.now()}-${Math.random()}`,
            title: event.summary || 'No Title',
            start_time: isAllDay ? start.toISOString() : start.toISOString(), // Still store for querying
            end_time: isAllDay ? end.toISOString() : end.toISOString(),
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
          });

          // Parse JSON fields if they're strings
          let attendees = null;
          let reminders = null;
          let recurrence = null;
          let conferenceData = null;
          
          try {
            if (event.attendees) {
              attendees = Array.isArray(event.attendees) ? event.attendees : JSON.parse(event.attendees);
            }
            if (event.reminders) {
              reminders = typeof event.reminders === 'object' ? event.reminders : JSON.parse(event.reminders);
            }
            if (event.recurrence) {
              recurrence = Array.isArray(event.recurrence) ? event.recurrence : JSON.parse(event.recurrence);
            }
            if (event.conferenceData) {
              conferenceData = typeof event.conferenceData === 'object' ? event.conferenceData : JSON.parse(event.conferenceData);
            }
          } catch (e) {
            console.warn('Error parsing JSON fields:', e);
          }

          return {
            id: event.id || `event-${Date.now()}-${Math.random()}`,
            title: event.summary || 'No Title',
            start,
            end,
            color,
            calendar: event.organizer?.displayName || calendarId,
            calendarId: calendarId, // Include the actual calendar ID
            description: event.description,
            location: event.location,
            htmlLink: event.htmlLink,
            hangoutLink: event.hangoutLink,
            isAllDay,
            organizer: event.organizer ? {
              email: event.organizer.email,
              displayName: event.organizer.displayName,
            } : undefined,
            attendees,
            reminders,
            recurrence,
            status: event.status,
            transparency: event.transparency,
            visibility: event.visibility,
            conferenceData,
            created: event.created ? new Date(event.created) : undefined,
            updated: event.updated ? new Date(event.updated) : undefined,
          };
        });

        allEvents.push(...events);
      } catch (calendarError: any) {
        console.error(`Error fetching events from calendar ${calendarId}:`, calendarError);
        // Continue with other calendars
      }
    }

    // Cache the fetched events (upsert to handle updates)
    if (eventsToCache.length > 0) {
      // Delete old events for these calendars in this time range
      await supabase
        .from('google_calendar_events')
        .delete()
        .eq('user_id', userId)
        .in('calendar_id', calendarsToFetch)
        .gte('start_time', timeMinParam.toISOString())
        .lte('end_time', timeMaxParam.toISOString());

      // Insert new events in batches
      const batchSize = 100;
      for (let i = 0; i < eventsToCache.length; i += batchSize) {
        const batch = eventsToCache.slice(i, i + batchSize);
        await supabase.from('google_calendar_events').insert(batch);
      }
    }

    // Sort all events by start time
    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

    return NextResponse.json({ events: allEvents, fromCache: false });
  } catch (error) {
    console.error('Error in GET /api/google-calendar/events:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', events: [] },
      { status: 500 }
    );
  }
}

