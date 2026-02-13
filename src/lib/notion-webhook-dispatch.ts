/**
 * Notion webhook: find which users and DB types are affected by a databaseId,
 * delete a page from the right table, or trigger full sync for that type.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  syncSinglePageToMedia,
  deleteMediaPageFromAllUsers,
} from '@/lib/notion-media-sync';

export type NotionDbType =
  | 'people'
  | 'media'
  | 'finances_assets'
  | 'finances_places'
  | 'finances_investments'
  | 'tracking_daily'
  | 'tracking_weekly'
  | 'tracking_monthly'
  | 'tracking_quarterly'
  | 'tracking_yearly'
  | 'todos';

function normalizeId(id: string): string {
  return id.replace(/-/g, '');
}

function getDatabaseNameString(databaseName: unknown): string {
  if (typeof databaseName === 'string') return databaseName;
  if (databaseName && typeof databaseName === 'object' && !Array.isArray(databaseName)) {
    const obj = databaseName as { plain_text?: string };
    if (typeof obj.plain_text === 'string') return obj.plain_text;
  }
  if (Array.isArray(databaseName)) {
    return (databaseName as Array<{ plain_text?: string }>)
      .map((seg) => seg?.plain_text ?? '')
      .join('')
      .trim();
  }
  return '';
}

/** Infer DB type from a notion_databases entry. */
export function getDbTypeFromEntry(db: any): NotionDbType | null {
  const name = getDatabaseNameString(db.database_name).toLowerCase();
  if (db.type === 'finances_assets') return 'finances_assets';
  if (db.type === 'finances_places') return 'finances_places';
  if (db.type === 'finances_investments') return 'finances_investments';
  if (db.period === 'daily') return 'tracking_daily';
  if (db.period === 'weekly') return 'tracking_weekly';
  if (db.period === 'monthly') return 'tracking_monthly';
  if (db.period === 'quarterly') return 'tracking_quarterly';
  if (db.period === 'yearly') return 'tracking_yearly';
  if (name.includes('people')) return 'people';
  if (name.includes('media')) return 'media';
  if (
    name.includes('to-do') ||
    name.includes('todo') ||
    name.includes('action') ||
    name.includes('task')
  )
    return 'todos';
  if (name.includes('daily') && name.includes('tracking')) return 'tracking_daily';
  if (name.includes('weekly') && name.includes('tracking')) return 'tracking_weekly';
  if (name.includes('monthly') && name.includes('tracking')) return 'tracking_monthly';
  if (name.includes('quarterly') && name.includes('tracking')) return 'tracking_quarterly';
  if (name.includes('yearly') && name.includes('tracking')) return 'tracking_yearly';
  if (name.includes('asset')) return 'finances_assets';
  if (name.includes('place') || name.includes('net worth')) return 'finances_places';
  if (name.includes('investment')) return 'finances_investments';
  return null;
}

/** Check if an entry's database_id matches (with or without dashes). */
function entryMatchesDatabaseId(entry: any, databaseId: string): boolean {
  const id = entry.database_id;
  if (!id) return false;
  return normalizeId(id) === normalizeId(databaseId) || id === databaseId;
}

/** Find Media DB from relation props (e.g. "Media this month"). */
function getMediaDatabaseIdFromDatabases(databases: any[]): string | null {
  for (const db of databases) {
    const props = db.properties as Record<string, any> | undefined;
    if (!props) continue;
    for (const [key, prop] of Object.entries(props)) {
      if (!prop || prop.type !== 'relation') continue;
      const propName = (prop.name || key || '').toLowerCase();
      if (!propName.includes('media')) continue;
      const targetId = prop.relation?.database_id ?? prop.relation?.data_source_id;
      if (targetId) return targetId;
    }
  }
  return null;
}

/**
 * Find all users who have this databaseId in their notion_databases, and the type of that DB for each.
 */
export async function getUsersAndTypesForDatabase(
  supabaseClient: SupabaseClient,
  databaseId: string
): Promise<Array<{ userId: string; dbType: NotionDbType }>> {
  const { data: users, error } = await supabaseClient
    .from('users')
    .select('id, notion_databases');

  if (error || !users?.length) return [];

  const normalizedTarget = normalizeId(databaseId);
  const results: Array<{ userId: string; dbType: NotionDbType }> = [];

  for (const user of users) {
    const raw = user.notion_databases;
    const databases = Array.isArray(raw) ? raw : raw ? JSON.parse(raw || '[]') : [];
    let added = false;
    for (const db of databases) {
      if (entryMatchesDatabaseId(db, databaseId)) {
        const dbType = getDbTypeFromEntry(db);
        if (dbType) {
          results.push({ userId: user.id, dbType });
          added = true;
        }
        break;
      }
    }
    if (!added) {
      const mediaTargetId = getMediaDatabaseIdFromDatabases(databases);
      if (mediaTargetId && (normalizeId(mediaTargetId) === normalizedTarget || mediaTargetId === databaseId)) {
        results.push({ userId: user.id, dbType: 'media' });
      }
    }
  }

  return results;
}

const TABLE_BY_TYPE: Record<NotionDbType, string> = {
  people: 'people',
  media: 'media',
  finances_assets: 'finances_assets',
  finances_places: 'finances_places',
  finances_investments: 'finances_individual_investments',
  tracking_daily: 'tracking_daily',
  tracking_weekly: 'tracking_weekly',
  tracking_monthly: 'tracking_monthly',
  tracking_quarterly: 'tracking_quarterly',
  tracking_yearly: 'tracking_yearly',
  todos: 'todos',
};

/**
 * Delete a page from the Supabase table for the given DB type and user.
 */
export async function deletePageForType(
  supabaseClient: SupabaseClient,
  dbType: NotionDbType,
  userId: string,
  pageId: string,
  databaseId: string
): Promise<void> {
  if (dbType === 'media') {
    await deleteMediaPageFromAllUsers(pageId, databaseId);
    return;
  }

  const table = TABLE_BY_TYPE[dbType];
  const normalized = normalizeId(databaseId);
  const idsToMatch = normalized === databaseId ? [databaseId] : [databaseId, normalized];

  await supabaseClient
    .from(table)
    .delete()
    .eq('user_id', userId)
    .eq('notion_page_id', pageId)
    .in('notion_database_id', idsToMatch);
}

/**
 * Trigger full sync for the given DB type and user (for create/update events).
 * Media uses single-page sync; others call the app's sync API internally.
 */
export async function triggerSyncForType(
  dbType: NotionDbType,
  userId: string,
  pageId: string,
  databaseId: string
): Promise<void> {
  if (dbType === 'media') {
    await syncSinglePageToMedia(pageId, databaseId);
    return;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000';
  const base = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  const secret = process.env.NOTION_WEBHOOK_SECRET || process.env.INTERNAL_SYNC_SECRET;

  const endpoints: Partial<Record<NotionDbType, string>> = {
    people: '/api/people/sync',
    finances_assets: '/api/finances/sync',
    finances_places: '/api/finances/sync',
    finances_investments: '/api/finances/sync',
    tracking_daily: '/api/tracking/daily/sync',
    tracking_weekly: '/api/tracking/weekly/sync',
    tracking_monthly: '/api/tracking/monthly/sync',
    tracking_quarterly: '/api/tracking/quarterly/sync',
    tracking_yearly: '/api/tracking/yearly/sync',
    todos: '/api/todos/sync',
  };

  const path = endpoints[dbType];
  if (!path) return;

  try {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-internal-sync': secret } : {}),
      },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      console.warn(`Notion webhook: sync ${dbType} for user ${userId} failed: ${res.status}`);
    }
  } catch (err) {
    console.error(`Notion webhook: trigger sync ${dbType} for user ${userId}`, err);
  }
}
