export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Batch fetch people linked to multiple events
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { eventIds } = body;

    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return NextResponse.json({ eventPeopleMap: {} });
    }

    // Fetch all linked people for these events
    const { data: eventPeople, error } = await supabase
      .from('event_people')
      .select(`
        event_id,
        person_id,
        people (
          id,
          name,
          image,
          nicknames
        )
      `)
      .eq('user_id', userId)
      .in('event_id', eventIds);

    if (error) {
      console.error('Error fetching event people:', error);
      return NextResponse.json(
        { error: 'Failed to fetch event people' },
        { status: 500 }
      );
    }

    // Group by event_id
    const eventPeopleMap: Record<string, any[]> = {};
    
    (eventPeople || []).forEach((ep: any) => {
      if (!ep.people) return;
      
      if (!eventPeopleMap[ep.event_id]) {
        eventPeopleMap[ep.event_id] = [];
      }
      
      eventPeopleMap[ep.event_id].push({
        id: ep.people.id,
        name: ep.people.name,
        image: ep.people.image,
        nicknames: ep.people.nicknames,
      });
    });

    return NextResponse.json({ eventPeopleMap });
  } catch (error) {
    console.error('Error in POST /api/events/people/batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

