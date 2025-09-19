export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { createClient } from '@supabase/supabase-js';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

interface SyncResult {
  success: boolean;
  lastSync: string;
  changes: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  properties: Record<string, any>;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required environment variables
    const requiredEnvVars = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      NOTION_API_KEY: process.env.NOTION_API_KEY,
    };

    const missingEnvVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingEnvVars.length > 0) {
      console.error('Missing required environment variables:', missingEnvVars);
      return new NextResponse(
        `Server configuration error: Missing required environment variables: ${missingEnvVars.join(
          ', '
        )}`,
        { status: 500 }
      );
    }

    const { databaseId } = await params;
    if (!databaseId) {
      return NextResponse.json({ error: 'Database ID is required' }, { status: 400 });
    }

    // Initialize Supabase client inside the request handler
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get current user's databases
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('notion_databases')
      .eq('id', userId)
      .single();

    if (userError || !user?.notion_databases) {
      return NextResponse.json({ error: 'User databases not found' }, { status: 404 });
    }

    const databases = Array.isArray(user.notion_databases)
      ? user.notion_databases
      : JSON.parse(user.notion_databases);

    const currentDb = databases.find((db: any) => db.database_id === databaseId);
    if (!currentDb) {
      return NextResponse.json({ error: 'Database not found' }, { status: 404 });
    }

    // Fetch fresh database info from Notion
    console.log('Fetching database from Notion:', databaseId);
    const notionDb = await notion.databases.retrieve({ database_id: databaseId });
    const freshProperties = notionDb.properties;
    console.log('Successfully fetched database properties:', Object.keys(freshProperties));

    // Extract additional database metadata
    const databaseMetadata = {
      icon: notionDb.icon,
      cover: notionDb.cover,
      title: notionDb.title,
      description: notionDb.description,
      created_time: notionDb.created_time,
      last_edited_time: notionDb.last_edited_time,
      created_by: notionDb.created_by,
      last_edited_by: notionDb.last_edited_by,
    };

    // Compare with stored properties
    const oldProperties = currentDb.properties || {};
    const changes = {
      added: [],
      removed: [],
      modified: [],
    };

    // Helper function to normalize property for comparison
    const normalizeProperty = (prop: any) => {
      if (!prop) return null;

      const normalized: any = {
        type: prop.type,
        name: prop.name,
      };

      // Handle different property types with specific normalization
      if (prop.select) {
        normalized.select = {
          options:
            prop.select.options?.map((opt: any) => ({
              name: opt.name,
              color: opt.color,
            })) || [],
        };
      }

      if (prop.multi_select) {
        normalized.multi_select = {
          options:
            prop.multi_select.options?.map((opt: any) => ({
              name: opt.name,
              color: opt.color,
            })) || [],
        };
      }

      if (prop.status) {
        // For status properties, only compare the essential configuration
        normalized.status = {
          options:
            prop.status.options?.map((opt: any) => ({
              name: opt.name,
              color: opt.color,
            })) || [],
        };
      }

      if (prop.number) {
        normalized.number = {
          format: prop.number.format,
        };
      }

      if (prop.title) {
        normalized.title = {}; // Title properties don't have config
      }

      if (prop.rich_text) {
        normalized.rich_text = {}; // Rich text properties don't have config
      }

      if (prop.date) {
        normalized.date = {}; // Date properties don't have config
      }

      if (prop.people) {
        normalized.people = {}; // People properties don't have config
      }

      if (prop.checkbox) {
        normalized.checkbox = {}; // Checkbox properties don't have config
      }

      if (prop.url) {
        normalized.url = {}; // URL properties don't have config
      }

      if (prop.email) {
        normalized.email = {}; // Email properties don't have config
      }

      if (prop.phone_number) {
        normalized.phone_number = {}; // Phone properties don't have config
      }

      if (prop.relation) {
        normalized.relation = {
          database_id: prop.relation.database_id,
          type: prop.relation.type,
        };
      }

      if (prop.rollup) {
        normalized.rollup = {
          relation_property_name: prop.rollup.relation_property_name,
          rollup_property_name: prop.rollup.rollup_property_name,
          function: prop.rollup.function,
        };
      }

      if (prop.formula) {
        normalized.formula = {
          expression: prop.formula.expression,
        };
      }

      // Skip timestamp and user fields as they change frequently

      return normalized;
    };

    // Check for added properties
    for (const [key, value] of Object.entries(freshProperties)) {
      if (!oldProperties[key]) {
        changes.added.push(key);
      } else {
        const normalizedOld = normalizeProperty(oldProperties[key]);
        const normalizedNew = normalizeProperty(value);
        if (JSON.stringify(normalizedOld) !== JSON.stringify(normalizedNew)) {
          console.log(`Property ${key} changed:`, {
            old: normalizedOld,
            new: normalizedNew,
          });
          changes.modified.push(key);
        }
      }
    }

    // Check for removed properties
    for (const key of Object.keys(oldProperties)) {
      if (!freshProperties[key]) {
        changes.removed.push(key);
      }
    }

    // Update the database with fresh data
    const updatedDb = {
      ...currentDb,
      properties: freshProperties,
      last_sync: new Date().toISOString(),
      ...databaseMetadata, // Include icon, cover, title, etc.
    };

    const updatedDatabases = databases.map((db: any) =>
      db.database_id === databaseId ? updatedDb : db
    );

    // Update in Supabase
    const { error: updateError } = await supabase
      .from('users')
      .update({ notion_databases: updatedDatabases })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating database:', updateError);
      return NextResponse.json({ error: 'Failed to update database' }, { status: 500 });
    }

    const result: SyncResult = {
      success: true,
      lastSync: updatedDb.last_sync,
      changes,
      properties: freshProperties,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Sync error:', error);

    // Handle specific Notion API errors
    if (error && typeof error === 'object' && 'code' in error) {
      const notionError = error as any;
      if (notionError.code === 'object_not_found') {
        return NextResponse.json(
          {
            success: false,
            error: 'Database not found in Notion',
          },
          { status: 404 }
        );
      }
      if (notionError.code === 'unauthorized') {
        return NextResponse.json(
          {
            success: false,
            error: 'Notion API authentication failed',
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}
