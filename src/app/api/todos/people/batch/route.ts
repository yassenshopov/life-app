export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

/**
 * Batch fetch people linked to multiple todos
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { todoIds } = body;

    if (!Array.isArray(todoIds) || todoIds.length === 0) {
      return NextResponse.json({ todoPeopleMap: {} });
    }

    // Filter out any invalid IDs
    const validTodoIds = todoIds.filter((id: any) => id && typeof id === 'string' && id.length > 0);

    if (validTodoIds.length === 0) {
      return NextResponse.json({ todoPeopleMap: {} });
    }

    // Group by todo_id
    const todoPeopleMap: Record<string, any[]> = {};

    // Chunk the requests to avoid potential issues with large arrays or Supabase limits
    const chunkSize = 100;
    for (let i = 0; i < validTodoIds.length; i += chunkSize) {
      const chunk = validTodoIds.slice(i, i + chunkSize);
      
      // Fetch all linked people for this chunk of todos
      const { data: todoPeople, error } = await supabase
        .from('todo_people')
        .select(`
          todo_id,
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
        .in('todo_id', chunk);

      if (error) {
        console.error('Error fetching todo people:', error);
        console.error('Todo IDs chunk:', chunk);
        // Continue with other chunks even if one fails
        continue;
      }

      // Process results
      (todoPeople || []).forEach((tp: any) => {
        if (!tp.people) return;
        
        if (!todoPeopleMap[tp.todo_id]) {
          todoPeopleMap[tp.todo_id] = [];
        }
        
        todoPeopleMap[tp.todo_id].push({
          id: tp.people.id,
          name: tp.people.name,
          image: tp.people.image,
          image_url: tp.people.image_url,
          nicknames: tp.people.nicknames,
        });
      });
    }

    return NextResponse.json({ todoPeopleMap });
  } catch (error) {
    console.error('Error in POST /api/todos/people/batch:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

