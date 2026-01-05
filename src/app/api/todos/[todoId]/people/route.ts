export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

// GET: Fetch people linked to a todo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ todoId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { todoId } = await params;

    // Fetch people linked to this todo
    const { data: todoPeople, error } = await supabase
      .from('todo_people')
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
      .eq('todo_id', todoId);

    if (error) {
      console.error('Error fetching todo people:', error);
      return NextResponse.json(
        { error: 'Failed to fetch todo people' },
        { status: 500 }
      );
    }

    // Transform the data to flatten the people object
    // Filter out entries where tp.people is null to prevent null reference errors
    const people = (todoPeople || [])
      .filter((tp: any) => tp.people != null)
      .map((tp: any) => ({
        id: tp.people.id,
        name: tp.people.name,
        image: tp.people.image,
        image_url: tp.people.image_url,
        nicknames: tp.people.nicknames,
        linkId: tp.id, // The junction table ID for deletion
      }));

    return NextResponse.json({ people });
  } catch (error) {
    console.error('Error in GET /api/todos/[todoId]/people:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Add a person to a todo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ todoId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { todoId } = await params;
    const body = await request.json();
    const { personId } = body;

    if (!personId) {
      return NextResponse.json(
        { error: 'Person ID is required' },
        { status: 400 }
      );
    }

    // Check if todo exists and belongs to user
    const { data: todo, error: todoError } = await supabase
      .from('todos')
      .select('id')
      .eq('id', todoId)
      .eq('user_id', userId)
      .single();

    if (todoError || !todo) {
      return NextResponse.json(
        { error: 'Todo not found' },
        { status: 404 }
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
      .from('todo_people')
      .insert({
        user_id: userId,
        todo_id: todoId,
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
          { error: 'Person already linked to this todo' },
          { status: 409 }
        );
      }
      console.error('Error adding person to todo:', error);
      return NextResponse.json(
        { error: 'Failed to add person to todo' },
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
    console.error('Error in POST /api/todos/[todoId]/people:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a person from a todo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ todoId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { todoId } = await params;
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
      .from('todo_people')
      .delete()
      .eq('user_id', userId)
      .eq('todo_id', todoId)
      .eq('person_id', personId);

    if (error) {
      console.error('Error removing person from todo:', error);
      return NextResponse.json(
        { error: 'Failed to remove person from todo' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/todos/[todoId]/people:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



