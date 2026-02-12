export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/ensure-user';
import { google } from 'googleapis';

const supabase = getSupabaseServiceRoleClient();

interface GoogleCalendarCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
}

/**
 * Fetch activity summary - events grouped by month with people connections
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all event_people relationships with person info
    const { data: eventPeople, error: eventPeopleError } = await supabase
      .from('event_people')
      .select(
        `
        event_id,
        person_id,
        people (
          id,
          name,
          image_url,
          image
        )
      `
      )
      .eq('user_id', userId);

    if (eventPeopleError) {
      console.error('Error fetching event people:', eventPeopleError);
      return NextResponse.json({ error: 'Failed to fetch event people' }, { status: 500 });
    }

    if (!eventPeople || eventPeople.length === 0) {
      return NextResponse.json({
        activity: {},
        months: [],
      });
    }

    // Get unique event IDs
    const eventIds = [...new Set(eventPeople.map((ep: any) => ep.event_id))];

    await ensureUserExists(supabase, userId);

    // Fetch user's Google Calendar credentials
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('google_calendar_credentials, calendar_preferences')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const credentials: GoogleCalendarCredentials | null = user.google_calendar_credentials;
    if (!credentials || !credentials.access_token) {
      return NextResponse.json({
        activity: {},
        months: [],
      });
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

    // Create calendar API client
    const calendarApi = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get calendar preferences
    const preferences = user.calendar_preferences || {};
    const calendarListResponse = await calendarApi.calendarList.list();
    const calendarList = calendarListResponse.data.items || [];

    let calendarsToFetch: string[] = [];
    if (preferences.selectedCalendars && Array.isArray(preferences.selectedCalendars)) {
      calendarsToFetch = preferences.selectedCalendars;
    } else {
      calendarsToFetch = calendarList.map((cal: any) => cal.id);
    }

    // Fetch events from all calendars (going back 2 years, forward 1 year)
    const timeMin = new Date();
    timeMin.setFullYear(timeMin.getFullYear() - 2);
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

    // Filter to only events that have people linked
    const linkedEvents = allEvents.filter((event: any) => eventIds.includes(event.id));

    // Create a map of event_id -> people
    const eventPeopleMap = new Map<string, any[]>();
    eventPeople.forEach((ep: any) => {
      if (!ep.people) return;
      if (!eventPeopleMap.has(ep.event_id)) {
        eventPeopleMap.set(ep.event_id, []);
      }
      eventPeopleMap.get(ep.event_id)!.push({
        id: ep.people.id,
        name: ep.people.name,
        image_url: ep.people.image_url,
        image: ep.people.image,
      });
    });

    // Group events by month-year and person, counting unique days
    // Format: { "2024-01": { "personId1": [events...], "personId2": [events...] } }
    // Events are grouped by day - multiple events on the same day count as one
    const activityByMonth: Record<string, Record<string, any[]>> = {};
    const monthsSet = new Set<string>();

    // Track unique days per person per month to avoid duplicates
    const daysByPersonMonth = new Map<string, Set<string>>(); // key: "monthKey-personId", value: Set of day keys (YYYY-MM-DD)

    linkedEvents.forEach((event: any) => {
      const people = eventPeopleMap.get(event.id) || [];
      if (people.length === 0) return;

      // Get event start date
      const startDate = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
        ? new Date(event.start.date)
        : null;

      if (!startDate) return;

      // Format as YYYY-MM and YYYY-MM-DD
      const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(
        2,
        '0'
      )}`;
      const dayKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(startDate.getDate()).padStart(2, '0')}`;
      monthsSet.add(monthKey);

      if (!activityByMonth[monthKey]) {
        activityByMonth[monthKey] = {};
      }

      // Add event to each person's list for this month, but only if we haven't seen this day yet
      people.forEach((person: any) => {
        const personMonthKey = `${monthKey}-${person.id}`;

        // Initialize the set for this person-month if needed
        if (!daysByPersonMonth.has(personMonthKey)) {
          daysByPersonMonth.set(personMonthKey, new Set());
        }

        const daysSet = daysByPersonMonth.get(personMonthKey)!;

        // Only add if this day hasn't been seen yet for this person
        if (!daysSet.has(dayKey)) {
          daysSet.add(dayKey);

          if (!activityByMonth[monthKey][person.id]) {
            activityByMonth[monthKey][person.id] = [];
          }

          // Store one representative event per day
          activityByMonth[monthKey][person.id].push({
            id: event.id,
            title: event.summary || 'No Title',
            start: startDate.toISOString(),
            htmlLink: event.htmlLink,
            dayKey: dayKey, // Store day key for reference
          });
        }
      });
    });

    // Sort months chronologically
    const months = Array.from(monthsSet).sort();

    return NextResponse.json({
      activity: activityByMonth,
      months,
    });
  } catch (error) {
    console.error('Error in GET /api/people/activity-summary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
