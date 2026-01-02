export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user ID from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('todos')
      .select('*')
      .eq('user_id', userId);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (priority) {
      query = query.eq('priority', priority);
    }

    // Order by do_date (ascending, nulls last), then by priority
    query = query.order('do_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    const { data: todos, error } = await query;

    if (error) {
      console.error('Error fetching todos:', error);
      return NextResponse.json(
        { error: 'Failed to fetch todos' },
        { status: 500 }
      );
    }

    // Apply search filter if provided
    let filteredTodos = todos || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTodos = filteredTodos.filter(
        (todo) =>
          todo.title?.toLowerCase().includes(searchLower) ||
          todo.mega_tags?.some((tag: string) =>
            tag.toLowerCase().includes(searchLower)
          )
      );
    }

    return NextResponse.json({ todos: filteredTodos });
  } catch (error) {
    console.error('Error in GET /api/todos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

