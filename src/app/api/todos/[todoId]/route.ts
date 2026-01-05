export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = getSupabaseServiceRoleClient();

// Helper function to extract property value (same as in sync route)
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

    // Update page in Notion
    const notionPage = await notion.pages.update({
      page_id: todo.notion_page_id,
      properties: notionProperties,
    });

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

      switch (key) {
        case titlePropertyKey:
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
            const date = new Date(value);
            todoData.do_date = isNaN(date.getTime()) ? null : date.toISOString();
          } else {
            todoData.do_date = null;
          }
          break;
        case 'Due-Date':
          if (value) {
            const date = new Date(value);
            todoData.due_date = isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
          } else {
            todoData.due_date = null;
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



