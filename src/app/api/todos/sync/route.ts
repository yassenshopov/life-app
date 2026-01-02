export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = getSupabaseServiceRoleClient();

// Helper function to extract property value
function getPropertyValue(property: any, propertyType: string): any {
  if (!property) return null;

  switch (propertyType) {
    case 'title':
      return property.title?.[0]?.plain_text || '';
    case 'rich_text':
      return property.rich_text?.[0]?.plain_text || '';
    case 'select':
      return property.select?.name || null;
    case 'multi_select':
      return property.multi_select?.map((item: any) => item.name) || [];
    case 'status':
      return property.status?.name || null;
    case 'date':
      // Handle both date-only and datetime
      if (property.date?.start) {
        return property.date.start;
      }
      return null;
    case 'number':
      return property.number;
    case 'checkbox':
      return property.checkbox || false;
    case 'people':
      return property.people || [];
    case 'relation':
      return property.relation || [];
    case 'formula':
      // Extract value from formula based on formula type
      if (property.formula?.type === 'date' && property.formula.date) {
        return property.formula.date.start || null;
      }
      if (property.formula?.type === 'number') {
        return property.formula.number;
      }
      if (property.formula?.type === 'string') {
        return property.formula.string;
      }
      return null;
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user ID from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    let allPages: any[] = [];
    let hasMore = true;
    let cursor: string | undefined = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: databaseId,
        start_cursor: cursor,
        page_size: 100,
      });

      allPages = [...allPages, ...response.results];
      hasMore = response.has_more;
      cursor = response.next_cursor || undefined;
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

        // Map to database column names
        switch (key) {
          case 'Action Item':
            todoData.title = value;
            break;
          case 'Status':
            todoData.status = value;
            break;
          case 'Priority':
            todoData.priority = value;
            break;
          case 'Do-Date':
            if (value) {
              // Parse date string to DateTime
              const date = new Date(value);
              todoData.do_date = isNaN(date.getTime()) ? null : date.toISOString();
            }
            break;
          case 'Due-Date':
            if (value) {
              // Parse date string to Date (date-only)
              const date = new Date(value);
              todoData.due_date = isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
            }
            break;
          case 'Mega Tag':
            todoData.mega_tags = Array.isArray(value) ? value : [];
            break;
          case 'Assignee':
            todoData.assignee = value;
            break;
          case 'GCal_ID':
            todoData.gcal_id = value;
            break;
          case 'Duration (h)':
            if (value !== null && value !== undefined) {
              todoData.duration_hours = parseFloat(value);
            }
            break;
          case 'Start':
            if (value) {
              const date = new Date(value);
              todoData.start_date = isNaN(date.getTime()) ? null : date.toISOString();
            }
            break;
          case 'End':
            if (value) {
              const date = new Date(value);
              todoData.end_date = isNaN(date.getTime()) ? null : date.toISOString();
            }
            break;
          case 'Projects':
            todoData.projects = value;
            break;
          default:
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
    if (removed.length > 0) {
      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .eq('user_id', userId)
        .eq('notion_database_id', databaseId)
        .in('notion_page_id', removed);

      if (deleteError) {
        console.error('Error deleting removed todos:', deleteError);
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
