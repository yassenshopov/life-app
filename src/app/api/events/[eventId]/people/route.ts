export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: Fetch people linked to an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const decodedEventId = decodeURIComponent(eventId);

    // Fetch people linked to this event
    const { data: eventPeople, error } = await supabase
      .from('event_people')
      .select(`
        id,
        person_id,
        people (
          id,
          name,
          image,
          image_url,
          nicknames
        )
      `)
      .eq('user_id', userId)
      .eq('event_id', decodedEventId);

    if (error) {
      console.error('Error fetching event people:', error);
      return NextResponse.json(
        { error: 'Failed to fetch event people' },
        { status: 500 }
      );
    }

    // Transform the data to flatten the people object
    const people = (eventPeople || []).map((ep: any) => ({
      id: ep.people.id,
      name: ep.people.name,
      image: ep.people.image,
      image_url: ep.people.image_url,
      nicknames: ep.people.nicknames,
      linkId: ep.id, // The junction table ID for deletion
    }));

    return NextResponse.json({ people });
  } catch (error) {
    console.error('Error in GET /api/events/[eventId]/people:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Add a person to an event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const decodedEventId = decodeURIComponent(eventId);
    const body = await request.json();
    const { personId } = body;

    if (!personId) {
      return NextResponse.json(
        { error: 'Person ID is required' },
        { status: 400 }
      );
    }

    // Check if person exists and belongs to user
    const { data: person, error: personError } = await supabase
      .from('people')
      .select('id')
      .eq('id', personId)
      .eq('user_id', userId)
      .single();

    if (personError || !person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    // Insert the relationship (unique constraint will prevent duplicates)
    const { data, error } = await supabase
      .from('event_people')
      .insert({
        user_id: userId,
        event_id: decodedEventId,
        person_id: personId,
      })
      .select(`
        id,
        people (
          id,
          name,
          image,
          image_url,
          nicknames
        )
      `)
      .single();

    if (error) {
      // If it's a unique constraint error, the relationship already exists
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Person already linked to this event' },
          { status: 409 }
        );
      }
      console.error('Error adding person to event:', error);
      return NextResponse.json(
        { error: 'Failed to add person to event' },
        { status: 500 }
      );
    }

    // Handle the nested people object (Supabase returns it as an object when using .single())
    const peopleData = Array.isArray(data.people) ? data.people[0] : data.people;
    
    if (!peopleData) {
      return NextResponse.json(
        { error: 'Failed to fetch person data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      person: {
        id: peopleData.id,
        name: peopleData.name,
        image: peopleData.image,
        image_url: peopleData.image_url,
        nicknames: peopleData.nicknames,
        linkId: data.id,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/events/[eventId]/people:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a person from an event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId } = await params;
    const decodedEventId = decodeURIComponent(eventId);
    const { searchParams } = new URL(request.url);
    const personId = searchParams.get('personId');

    if (!personId) {
      return NextResponse.json(
        { error: 'Person ID is required' },
        { status: 400 }
      );
    }

    // Delete the relationship
    const { error } = await supabase
      .from('event_people')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', decodedEventId)
      .eq('person_id', personId);

    if (error) {
      console.error('Error removing person from event:', error);
      return NextResponse.json(
        { error: 'Failed to remove person from event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/events/[eventId]/people:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

