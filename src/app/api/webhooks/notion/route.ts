/**
 * Notion webhook: when a media item's properties change in Notion, we sync that change to our app.
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

export const runtime = 'nodejs';

const notion = new Client({ auth: process.env.NOTION_API_KEY! });
const supabase = getSupabaseServiceRoleClient();

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
    } else if (entity.type === 'page' && (type === 'page.properties_updated' || type === 'page.created' || type === 'page.content_updated')) {
      try {
        const page = await notion.pages.retrieve({ page_id: entity.id }) as any;
        const parent = page?.parent;
        if (parent?.database_id) {
          databaseId = parent.database_id;
        }
      } catch {
        // Page may be deleted or inaccessible
      }
    }
    // For page.deleted we can't fetch the page; use parent.id if type is database, else look up in our DB
    if (!databaseId && data?.parent?.type === 'database') {
      databaseId = data.parent.id;
    }
    if (!databaseId && type === 'page.deleted') {
      const { data: row } = await supabase
        .from('media')
        .select('notion_database_id')
        .eq('notion_page_id', entity.id)
        .limit(1)
        .single();
      if (row?.notion_database_id) databaseId = row.notion_database_id;
    }

    // Only process if we resolved a database (sync/delete only affect users who have this DB in media table)
    if (!databaseId) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const pageId = entity.id;

    switch (type) {
      case 'page.properties_updated':
      case 'page.created':
      case 'page.content_updated':
        await syncSinglePageToMedia(pageId, databaseId);
        break;
      case 'page.deleted':
        await deleteMediaPageFromAllUsers(pageId, databaseId);
        break;
      default:
        break;
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('Notion webhook error:', e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
