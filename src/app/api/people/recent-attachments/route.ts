export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get the most recent event_people attachment date for each person
 * This is used to sort people by most recently attached to an event
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the most recent created_at for each person from event_people table
    const { data: eventPeople, error } = await supabase
      .from('event_people')
      .select('person_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recent attachments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch recent attachments' },
        { status: 500 }
      );
    }

    // Group by person_id and get the most recent date for each
    const recentDates = new Map<string, Date>();
    (eventPeople || []).forEach((ep: any) => {
      const personId = ep.person_id;
      const createdAt = new Date(ep.created_at);
      const existing = recentDates.get(personId);
      if (!existing || createdAt > existing) {
        recentDates.set(personId, createdAt);
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

