export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/ensure-user';
import { getPropertyValue } from '@/lib/notion-helpers';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = getSupabaseServiceRoleClient();

export async function POST(request: NextRequest) {
  try {
    const internalSecret = request.headers.get('x-internal-sync');
    const syncSecret = process.env.NOTION_WEBHOOK_SECRET || process.env.INTERNAL_SYNC_SECRET;
    let userId: string | null = null;
    if (internalSecret && syncSecret && internalSecret === syncSecret) {
      const body = await request.json().catch(() => ({}));
      userId = body?.userId ?? null;
    }
    if (!userId) {
      const authResult = await auth();
      userId = authResult.userId;
    }
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserExists(supabase, userId);

    // Get user's databases from their notion_databases array
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('notion_databases')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const databases = Array.isArray(user.notion_databases)
      ? user.notion_databases
      : JSON.parse(user.notion_databases || '[]');

    // Find To-Do List database by checking database name (case-insensitive)
    const todosDb = databases.find((db: any) => {
      const dbName =
        typeof db.database_name === 'string' ? db.database_name : String(db.database_name || '');
      const nameLower = dbName.toLowerCase();
      return (
        nameLower.includes('to-do') ||
        nameLower.includes('todo') ||
        nameLower.includes('action') ||
        nameLower.includes('task')
      );
    });

    if (!todosDb) {
      return NextResponse.json(
        {
          error:
            'To-Do List database not connected. Please connect your To-Do List database in settings.',
        },
        { status: 404 }
      );
    }

    const databaseId = todosDb.database_id;

    // Fetch current database schema from Notion
    let currentProperties: Record<string, any> = {};
    try {
      const currentDatabase = await notion.databases.retrieve({
        database_id: databaseId,
      });
      const dbProperties = (currentDatabase as any).properties || {};
      currentProperties = Object.entries(dbProperties).reduce((acc, [key, prop]: [string, any]) => {
        acc[key] = { type: prop.type, name: prop.name || key };
        return acc;
      }, {} as Record<string, any>);
    } catch (error) {
      console.error('Error fetching database schema:', error);
      return NextResponse.json(
        { error: 'Failed to fetch database schema from Notion' },
        { status: 500 }
      );
    }

    const properties = currentProperties;

    // Fetch all pages from Notion
    const MAX_PAGES = 1000;
    let allPages: any[] = [];
    let hasMore = true;
    let cursor: string | undefined = undefined;
    let previousCursor: string | undefined = undefined;
    let pageCounter = 0;

    while (hasMore) {
      // Guard against infinite loops
      if (pageCounter >= MAX_PAGES) {
        const error = new Error(
          `Pagination exceeded maximum pages (${MAX_PAGES}). Possible infinite loop detected.`
        );
        console.error('Pagination error:', error.message, {
          databaseId,
          pageCounter,
          currentCursor: cursor,
          previousCursor,
        });
        throw error;
      }

      // Check if cursor hasn't changed (no progress)
      if (cursor !== undefined && cursor === previousCursor) {
        const error = new Error(
          'Pagination cursor did not change between iterations. Possible infinite loop detected.'
        );
        console.error('Pagination error:', error.message, {
          databaseId,
          pageCounter,
          cursor,
        });
        throw error;
      }

      const response = await notion.databases.query({
        database_id: databaseId,
        start_cursor: cursor,
        page_size: 100,
      });

      allPages = [...allPages, ...response.results];
      hasMore = response.has_more;
      previousCursor = cursor;
      cursor = response.next_cursor || undefined;
      pageCounter++;
    }

    // Get existing todos from Supabase
    const { data: existingTodos, error: fetchError } = await supabase
      .from('todos')
      .select('notion_page_id')
      .eq('user_id', userId)
      .eq('notion_database_id', databaseId);

    if (fetchError) {
      console.error('Error fetching existing todos:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch existing todos' }, { status: 500 });
    }

    const existingPageIds = new Set(existingTodos?.map((t) => t.notion_page_id) || []);
    const newPageIds = new Set(allPages.map((p) => p.id));

    // Find added and removed pages
    const added = allPages.filter((p) => !existingPageIds.has(p.id));
    const removed = Array.from(existingPageIds).filter((id) => !newPageIds.has(id));

    // Process and insert/update todos
    const todosToUpsert = allPages.map((page: any) => {
      const pageProperties = page.properties || {};

      // Find title property
      const titleProp = Object.entries(properties).find(
        ([_, p]: [string, any]) => p.type === 'title'
      );
      const title = titleProp
        ? getPropertyValue(pageProperties[titleProp[0]], 'title')
        : 'Untitled';

      const todoData: any = {
        user_id: userId,
        notion_page_id: page.id,
        notion_database_id: databaseId,
        title,
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        properties: {} as Record<string, any>,
      };

      // Map each property
      Object.entries(properties).forEach(([key, prop]: [string, any]) => {
        const propertyValue = pageProperties[key];
        if (!propertyValue) return;

        const value = getPropertyValue(propertyValue, prop.type);
        const propName = (prop.name || key).toLowerCase();

        // Use fuzzy matching for property names to handle variations
        if (prop.type === 'title') {
          todoData.title = value;
        } else if (prop.type === 'status' || propName.includes('status')) {
          todoData.status = value;
        } else if (
          prop.type === 'select' &&
          propName.includes('priority')
        ) {
          todoData.priority = value;
        } else if (
          prop.type === 'date' &&
          propName.includes('do') &&
          !propName.includes('due')
        ) {
          if (value) {
            // Parse date string to DateTime
            const date = new Date(value);
            todoData.do_date = isNaN(date.getTime()) ? null : date.toISOString();
          }
        } else if (prop.type === 'date' && propName.includes('due')) {
          if (value) {
            // Parse date string to Date (date-only)
            const date = new Date(value);
            todoData.due_date = isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
          }
        } else if (
          prop.type === 'multi_select' &&
          propName.includes('tag')
        ) {
          todoData.mega_tags = Array.isArray(value) ? value : [];
        } else if (
          prop.type === 'people' &&
          propName.includes('assign')
        ) {
          todoData.assignee = value;
        } else if (propName.includes('gcal') || propName.includes('gcal_id')) {
          todoData.gcal_id = value;
        } else if (
          prop.type === 'formula' &&
          (propName.includes('duration') || propName.includes('hour'))
        ) {
          if (value !== null && value !== undefined) {
            todoData.duration_hours = parseFloat(value);
          }
        } else if (
          prop.type === 'formula' &&
          propName.includes('start') &&
          !propName.includes('end')
        ) {
          if (value) {
            const date = new Date(value);
            todoData.start_date = isNaN(date.getTime()) ? null : date.toISOString();
          }
        } else if (prop.type === 'formula' && propName.includes('end')) {
          if (value) {
            const date = new Date(value);
            todoData.end_date = isNaN(date.getTime()) ? null : date.toISOString();
          }
        } else if (prop.type === 'relation' && propName.includes('project')) {
          todoData.projects = value;
        } else {
          // Store other properties in the properties JSON field
          todoData.properties[key] = {
            type: prop.type,
            value: value,
          };
        }
      });

      return todoData;
    });

    // Delete removed entries
    let deletionStatus: 'success' | 'error' = 'success';
    let deletionError: any = null;
    if (removed.length > 0) {
      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .eq('user_id', userId)
        .eq('notion_database_id', databaseId)
        .in('notion_page_id', removed);

      if (deleteError) {
        console.error('Error deleting removed todos:', deleteError);
        deletionStatus = 'error';
        deletionError = deleteError;
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to delete removed todos',
            deletions: {
              status: 'error',
              error: deleteError.message,
              details: deleteError,
            },
          },
          { status: 500 }
        );
      }
    }

    // Upsert todos
    if (todosToUpsert.length > 0) {
      const { error: upsertError } = await supabase.from('todos').upsert(todosToUpsert, {
        onConflict: 'user_id,notion_page_id',
      });

      if (upsertError) {
        console.error('Error upserting todos:', upsertError);
        return NextResponse.json(
          { error: 'Failed to sync todos', details: upsertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      synced: todosToUpsert.length,
      added: added.length,
      removed: removed.length,
      deletions: {
        status: deletionStatus,
        count: removed.length,
        ...(deletionError && { error: deletionError.message }),
      },
      last_synced_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error syncing todos:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}
