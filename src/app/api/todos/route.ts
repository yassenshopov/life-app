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

    // Fetch all todos with pagination (Supabase default limit is 1000)
    const MAX_PAGES = 1000;
    let allTodos: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      // Guard against infinite loops
      if (page >= MAX_PAGES) {
        const error = new Error(
          `Pagination exceeded maximum pages (${MAX_PAGES}). Possible infinite loop detected.`
        );
        console.error('Pagination error:', error.message, {
          userId,
          page,
          pageSize,
          allTodosCount: allTodos.length,
          hasMore,
        });
        // Return partial results with a warning
        return NextResponse.json(
          {
            todos: allTodos,
            warning: `Pagination limit reached. Returning partial results (${allTodos.length} todos).`,
          },
          { status: 206 } // 206 Partial Content
        );
      }

      // Build query for each page
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

      // Order by do_date (ascending, nulls last), then by created_at (descending)
      query = query.order('do_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      // Apply pagination
      const { data: todos, error } = await query
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Error fetching todos:', error);
        return NextResponse.json(
          { error: 'Failed to fetch todos' },
          { status: 500 }
        );
      }

      if (todos && todos.length > 0) {
        allTodos = [...allTodos, ...todos];
        hasMore = todos.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }

    const todos = allTodos;

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

