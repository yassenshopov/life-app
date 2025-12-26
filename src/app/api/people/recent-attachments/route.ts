export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get the most recent event date for each person (when they were last at an event)
 * This is used to sort people by most recently interacted with
 * Returns the actual event start_time, not when the relationship was created
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First, get all event_people relationships
    const { data: eventPeople, error: epError } = await supabase
      .from('event_people')
      .select('person_id, event_id')
      .eq('user_id', userId);

    if (epError || !eventPeople || eventPeople.length === 0) {
      return NextResponse.json({ recentDates: {} });
    }

    // Get unique event IDs
    const eventIds = [...new Set(eventPeople.map((ep: any) => ep.event_id))];

    // Fetch event start times from google_calendar_events
    const { data: events, error: eventsError } = await supabase
      .from('google_calendar_events')
      .select('event_id, start_time')
      .eq('user_id', userId)
      .in('event_id', eventIds);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return NextResponse.json({ recentDates: {} });
    }

    // Create a map of event_id -> start_time
    const eventDateMap = new Map<string, Date>();
    (events || []).forEach((event: any) => {
      if (event.start_time) {
        eventDateMap.set(event.event_id, new Date(event.start_time));
      }
    });

    // Group by person_id and get the most recent event date for each
    const recentDates = new Map<string, Date>();
    eventPeople.forEach((ep: any) => {
      const personId = ep.person_id;
      const eventDate = eventDateMap.get(ep.event_id);
      
      if (eventDate) {
        const existing = recentDates.get(personId);
        if (!existing || eventDate > existing) {
          recentDates.set(personId, eventDate);
        }
      }
    });

    // Convert to object for easier JSON serialization
    const result: Record<string, string> = {};
    recentDates.forEach((date, personId) => {
      result[personId] = date.toISOString();
    });

    return NextResponse.json({ recentDates: result });
  } catch (error) {
    console.error('Error in GET /api/people/recent-attachments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
