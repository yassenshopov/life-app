/**
 * Notion webhook: sync page changes to our app (Media, People, Finances, Tracking, To-Do).
 *
 * Setup in Notion:
 * 1. Integration settings → Webhooks → Create subscription
 * 2. Webhook URL: https://your-domain.com/api/webhooks/notion (must be HTTPS, no localhost)
 * 3. Subscribe to: page.properties_updated, page.created, page.deleted, page.content_updated
 * 4. After creation, Notion sends a verification_token in one POST; paste it into .env as NOTION_WEBHOOK_SECRET
 * 5. In integration UI click Verify and paste the same token
 */
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import {
  syncSinglePageToMedia,
  deleteMediaPageFromAllUsers,
  verifyNotionWebhookSignature,
} from '@/lib/notion-media-sync';
import {
  getUsersAndTypesForDatabase,
  deletePageForType,
  triggerSyncForType,
  type NotionDbType,
} from '@/lib/notion-webhook-dispatch';

export const runtime = 'nodejs';

const notion = new Client({ auth: process.env.NOTION_API_KEY! });
const supabase = getSupabaseServiceRoleClient();

const TABLES_FOR_DELETE_LOOKUP: Array<{ table: string; dbType: NotionDbType }> = [
  { table: 'people', dbType: 'people' },
  { table: 'media', dbType: 'media' },
  { table: 'finances_assets', dbType: 'finances_assets' },
  { table: 'finances_places', dbType: 'finances_places' },
  { table: 'finances_individual_investments', dbType: 'finances_investments' },
  { table: 'tracking_daily', dbType: 'tracking_daily' },
  { table: 'tracking_weekly', dbType: 'tracking_weekly' },
  { table: 'tracking_monthly', dbType: 'tracking_monthly' },
  { table: 'tracking_quarterly', dbType: 'tracking_quarterly' },
  { table: 'tracking_yearly', dbType: 'tracking_yearly' },
  { table: 'todos', dbType: 'todos' },
];

/** Notion sends POST to this URL for verification and for events. */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody) as Record<string, unknown>;

    // Step 1: Subscription verification — Notion sends a one-time payload with verification_token
    if (body.verification_token != null && Object.keys(body).length <= 2) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Step 2: Validate signature for real events (recommended for production)
    const secret = process.env.NOTION_WEBHOOK_SECRET;
    const signature = request.headers.get('x-notion-signature');
    if (secret && signature) {
      const valid = verifyNotionWebhookSignature(rawBody, signature, secret);
      if (!valid) {
        console.warn('Notion webhook: invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const type = body.type as string | undefined;
    const entity = body.entity as { id: string; type: string } | undefined;
    const data = body.data as {
      parent?: { id: string; type: string };
      updated_properties?: string[];
    } | undefined;

    if (!type || !entity?.id) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Resolve the database id: payload parent can be "database" or "space"; for DB rows we may need to fetch the page
    let databaseId: string | null = null;
    if (data?.parent?.type === 'database') {
      databaseId = data.parent.id;
    } else if (
      entity.type === 'page' &&
      (type === 'page.properties_updated' || type === 'page.created' || type === 'page.content_updated')
    ) {
      try {
        const page = (await notion.pages.retrieve({ page_id: entity.id })) as any;
        const parent = page?.parent;
        if (parent?.database_id) {
          databaseId = parent.database_id;
        }
      } catch {
        // Page may be deleted or inaccessible
      }
    }

    const pageId = entity.id;
    const isDelete = type === 'page.deleted';
    const isCreateOrUpdate =
      type === 'page.properties_updated' || type === 'page.created' || type === 'page.content_updated';

    // For page.deleted without databaseId: find affected rows in our tables and delete them
    if (isDelete && !databaseId) {
      for (const { table, dbType } of TABLES_FOR_DELETE_LOOKUP) {
        const { data: rows } = await supabase
          .from(table)
          .select('user_id, notion_database_id')
          .eq('notion_page_id', pageId);
        if (!rows?.length) continue;
        if (dbType === 'media') {
          await deleteMediaPageFromAllUsers(pageId, rows[0].notion_database_id);
        } else {
          for (const row of rows) {
            await deletePageForType(
              supabase,
              dbType,
              row.user_id,
              pageId,
              row.notion_database_id
            );
          }
        }
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (!databaseId) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const usersAndTypes = await getUsersAndTypesForDatabase(supabase, databaseId);

    if (usersAndTypes.length === 0) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (isDelete) {
      const hasMedia = usersAndTypes.some((u) => u.dbType === 'media');
      if (hasMedia) {
        await deleteMediaPageFromAllUsers(pageId, databaseId);
      }
      for (const { userId, dbType } of usersAndTypes) {
        if (dbType === 'media') continue;
        await deletePageForType(supabase, dbType, userId, pageId, databaseId);
      }
    } else if (isCreateOrUpdate) {
      const hasMedia = usersAndTypes.some((u) => u.dbType === 'media');
      if (hasMedia) {
        await syncSinglePageToMedia(pageId, databaseId);
      }
      for (const { userId, dbType } of usersAndTypes) {
        if (dbType === 'media') continue;
        await triggerSyncForType(dbType, userId, pageId, databaseId);
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('Notion webhook error:', e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
