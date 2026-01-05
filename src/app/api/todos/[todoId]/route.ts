export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { getPropertyValue } from '@/lib/notion-helpers';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = getSupabaseServiceRoleClient();

// PATCH: Update a todo
export async function PATCH(
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
    const { title, status, priority, do_date, due_date } = body;

    // Get the todo from Supabase to find the Notion page ID
    const { data: todo, error: todoError } = await supabase
      .from('todos')
      .select('*')
      .eq('id', todoId)
      .eq('user_id', userId)
      .single();

    if (todoError || !todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // Get user's databases
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

    // Find To-Do List database
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
          error: 'To-Do List database not connected',
        },
        { status: 404 }
      );
    }

    const databaseId = todosDb.database_id;

    // Get database properties to find property keys
    const database = await notion.databases.retrieve({ database_id: databaseId });
    const properties = (database as any).properties || {};

    // Find property keys
    const titleProp = Object.entries(properties).find(
      ([_, prop]: [string, any]) => prop.type === 'title'
    );
    const titlePropertyKey = titleProp ? titleProp[0] : 'Action Item';

    // Build Notion properties for update
    const notionProperties: Record<string, any> = {};

    if (title !== undefined) {
      notionProperties[titlePropertyKey] = {
        title: [{ text: { content: title.trim() } }],
      };
    }

    if (status !== undefined) {
      const statusProp = Object.entries(properties).find(
        ([_, prop]: [string, any]) => prop.name === 'Status' || prop.type === 'status'
      );
      if (statusProp) {
        notionProperties[statusProp[0]] = status
          ? { status: { name: status } }
          : { status: null };
      }
    }

    if (priority !== undefined) {
      const priorityProp = Object.entries(properties).find(
        ([_, prop]: [string, any]) => prop.name === 'Priority' || (prop.type === 'select' && prop.name?.toLowerCase().includes('priority'))
      );
      if (priorityProp) {
        notionProperties[priorityProp[0]] = priority
          ? { select: { name: priority } }
          : { select: null };
      }
    }

    if (do_date !== undefined) {
      const doDateProp = Object.entries(properties).find(
        ([_, prop]: [string, any]) => prop.name === 'Do-Date' || (prop.type === 'date' && prop.name?.toLowerCase().includes('do'))
      );
      if (doDateProp) {
        notionProperties[doDateProp[0]] = do_date
          ? { date: { start: do_date } }
          : { date: null };
      }
    }

    if (due_date !== undefined) {
      const dueDateProp = Object.entries(properties).find(
        ([_, prop]: [string, any]) => prop.name === 'Due-Date' || (prop.type === 'date' && prop.name?.toLowerCase().includes('due'))
      );
      if (dueDateProp) {
        notionProperties[dueDateProp[0]] = due_date
          ? { date: { start: due_date } }
          : { date: null };
      }
    }

    // Validate notion_page_id before calling Notion API
    const notionPageId = todo.notion_page_id;
    
    // Check if notion_page_id exists
    if (!notionPageId) {
      console.error('Todo missing notion_page_id:', { todoId, userId });
      return NextResponse.json(
        { error: 'Todo is missing a Notion page ID' },
        { status: 400 }
      );
    }

    // Validate UUID format (32 chars without hyphens or 36 chars with hyphens)
    const uuidPattern = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(notionPageId)) {
      console.error('Invalid notion_page_id format:', { todoId, userId, notion_page_id: notionPageId });
      return NextResponse.json(
        { error: `Invalid Notion page ID format: ${notionPageId}` },
        { status: 400 }
      );
    }

    // Update page in Notion with error handling
    let notionPage;
    try {
      notionPage = await notion.pages.update({
        page_id: notionPageId,
        properties: notionProperties,
      });
    } catch (notionError: any) {
      console.error('Error updating Notion page:', {
        todoId,
        userId,
        notion_page_id: notionPageId,
        error: notionError.message || notionError,
        errorCode: notionError.code,
      });
      
      // Handle specific Notion API errors
      if (notionError.code === 'object_not_found' || notionError.status === 404) {
        return NextResponse.json(
          { error: `Notion page not found or deleted: ${notionPageId}` },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to update Notion page ${notionPageId}: ${notionError.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Fetch the updated page to get all properties (including formulas)
    const updatedPage = await notion.pages.retrieve({ page_id: notionPage.id });
    const pageProperties = (updatedPage as any).properties || {};

    // Map properties to our database schema
    const todoData: any = {
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    // Extract all properties
    Object.entries(properties).forEach(([key, prop]: [string, any]) => {
      const propertyValue = pageProperties[key];
      if (!propertyValue) return;

      const value = getPropertyValue(propertyValue, prop.type);
      const propName = (prop.name || key).toLowerCase();

      // Use fuzzy matching for property names to handle variations
      if (key === titlePropertyKey || prop.type === 'title') {
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
          const date = new Date(value);
          todoData.do_date = isNaN(date.getTime()) ? null : date.toISOString();
        } else {
          todoData.do_date = null;
        }
      } else if (prop.type === 'date' && propName.includes('due')) {
        if (value) {
          const date = new Date(value);
          todoData.due_date = isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
        } else {
          todoData.due_date = null;
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
        if (!todoData.properties) {
          todoData.properties = {};
        }
        todoData.properties[key] = {
          type: prop.type,
          value: value,
        };
      }
    });

    // Update in Supabase
    const { data: updatedTodo, error: updateError } = await supabase
      .from('todos')
      .update(todoData)
      .eq('id', todoId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating todo in Supabase:', updateError);
      return NextResponse.json(
        { error: 'Failed to update todo in database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      todo: updatedTodo,
    });
  } catch (error: any) {
    console.error('Error updating todo:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update todo',
      },
      { status: 500 }
    );
  }
}



