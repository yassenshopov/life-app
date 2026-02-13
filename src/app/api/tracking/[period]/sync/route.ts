export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/ensure-user';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = getSupabaseServiceRoleClient();

type TrackingPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const PERIOD_TABLES: Record<TrackingPeriod, string> = {
  daily: 'tracking_daily',
  weekly: 'tracking_weekly',
  monthly: 'tracking_monthly',
  quarterly: 'tracking_quarterly',
  yearly: 'tracking_yearly',
};

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
    case 'date':
      // Return full date object to preserve date ranges (start/end)
      return property.date || null;
    case 'number':
      return property.number;
    case 'checkbox':
      return property.checkbox || false;
    case 'files':
      return property.files || [];
    case 'formula':
      return property.formula;
    case 'relation':
      return property.relation?.map((rel: any) => rel.id) || [];
    case 'rollup':
      return property.rollup;
    case 'created_time':
      return property.created_time || null;
    case 'last_edited_time':
      return property.last_edited_time || null;
    default:
      return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ period: string }> }
) {
  let period: string | undefined;
  try {
    const resolvedParams = await params;
    period = resolvedParams.period;

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

    if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period' },
        { status: 400 }
      );
    }

    const tableName = PERIOD_TABLES[period as TrackingPeriod];

    await ensureUserExists(supabase, userId);

    // Get user's tracking database for this period
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

    // Find the database for this period
    const trackingDb = databases.find(
      (db: any) => db.period === period
    );

    if (!trackingDb) {
      return NextResponse.json(
        { error: `${period} database not connected` },
        { status: 404 }
      );
    }

    const databaseId = trackingDb.database_id;

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
      // Fallback to stored properties
      currentProperties = trackingDb.properties || {};
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

    // Get existing entries from Supabase
    const { data: existingEntries, error: fetchError } = await supabase
      .from(tableName)
      .select('notion_page_id')
      .eq('user_id', userId)
      .eq('notion_database_id', databaseId);

    if (fetchError) {
      console.error(`Error fetching existing ${period} entries:`, fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch existing entries' },
        { status: 500 }
      );
    }

    const existingPageIds = new Set(
      existingEntries?.map((e) => e.notion_page_id) || []
    );
    const newPageIds = new Set(allPages.map((p) => p.id));

    // Find added and removed pages
    const added = allPages.filter((p) => !existingPageIds.has(p.id));
    const removed = Array.from(existingPageIds).filter(
      (id) => !newPageIds.has(id)
    );

    // Process and insert/update entries
    const entriesToUpsert = allPages.map((page: any) => {
      const pageProperties = page.properties || {};
      
      // Find title property
      const titleProp = Object.entries(properties).find(
        ([_, p]: [string, any]) => p.type === 'title'
      );
      const title = titleProp
        ? getPropertyValue(pageProperties[titleProp[0]], 'title')
        : 'Untitled';

      // Base entry data
      const entryData: any = {
        user_id: userId,
        notion_page_id: page.id,
        notion_database_id: databaseId,
        period: period,
        title: title,
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
        // Store all properties as JSONB for flexibility
        properties: {},
      };

      // Map each property to the properties JSONB field
      Object.entries(properties).forEach(([key, prop]: [string, any]) => {
        const propertyValue = pageProperties[key];
        if (!propertyValue) return;

        let value = getPropertyValue(propertyValue, prop.type);
        
        // For complex types, extract meaningful values
        if (prop.type === 'formula' && value && typeof value === 'object') {
          // Extract formula result based on its type
          if (value.type === 'string' && value.string) {
            value = value.string;
          } else if (value.type === 'number' && value.number !== undefined) {
            value = value.number;
          } else if (value.type === 'boolean' && value.boolean !== undefined) {
            value = value.boolean;
          } else if (value.type === 'date' && value.date) {
            value = value.date;
          }
        } else if (prop.type === 'rollup' && value && typeof value === 'object') {
          // Extract rollup result based on its type
          if (value.type === 'number' && value.number !== undefined) {
            value = value.number;
          } else if (value.type === 'date' && value.date) {
            value = value.date;
          } else if (value.type === 'array' && Array.isArray(value.array)) {
            value = value.array;
          }
        } else if (prop.type === 'date' && value && typeof value === 'object' && value.start) {
          // Keep date object with start/end for date ranges
        } else if (prop.type === 'relation' && Array.isArray(value)) {
          // Store relation IDs as array
        }
        
        entryData.properties[key] = {
          type: prop.type,
          value: value,
        };
      });

      return entryData;
    });

    // Delete removed entries
    if (removed.length > 0) {
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('user_id', userId)
        .eq('notion_database_id', databaseId)
        .in('notion_page_id', removed);

      if (deleteError) {
        console.error(`Error deleting removed ${period} entries:`, deleteError);
      }
    }

    // Upsert entries
    if (entriesToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(entriesToUpsert, {
          onConflict: 'user_id,notion_page_id',
        });

      if (upsertError) {
        console.error(`Error upserting ${period} entries:`, upsertError);
        return NextResponse.json(
          { error: `Failed to sync ${period} entries` },
          { status: 500 }
        );
      }
    }

    // Update last_sync in user's notion_databases
    const updatedDatabases = databases.map((db: any) =>
      db.database_id === databaseId && db.period === period
        ? { ...db, last_sync: new Date().toISOString() }
        : db
    );

    await supabase
      .from('users')
      .update({ notion_databases: updatedDatabases })
      .eq('id', userId);

    return NextResponse.json({
      success: true,
      synced: entriesToUpsert.length,
      added: added.length,
      removed: removed.length,
      last_sync: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(`Error syncing ${period || 'unknown'} tracking DB:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || `Failed to sync ${period || 'unknown'} entries`,
      },
      { status: 500 }
    );
  }
}

