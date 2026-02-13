/**
 * Shared logic for syncing a single Notion media page to our app.
 * Used by the manual media sync and by the Notion webhook when a media item changes.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { Client } from '@notionhq/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = getSupabaseServiceRoleClient();

/**
 * Get the Media database ID for a user from their notion_databases (by name containing "media").
 * Same pattern as People sync (database_name includes 'people').
 */
export async function getMediaDatabaseIdForUser(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: user, error } = await supabaseClient
    .from('users')
    .select('notion_databases')
    .eq('id', userId)
    .single();

  if (error || !user?.notion_databases) return null;

  const databases = Array.isArray(user.notion_databases)
    ? user.notion_databases
    : JSON.parse(user.notion_databases || '[]');

  const mediaDb = databases.find((db: any) => {
    const name = typeof db.database_name === 'string' ? db.database_name : String(db.database_name ?? '');
    return name.toLowerCase().includes('media');
  });

  return mediaDb?.database_id ?? null;
}

export function getPropertyValue(property: any, propertyType: string): any {
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
      return property.date?.start || null;
    case 'created_time':
      return property.created_time || null;
    case 'status':
      return property.status?.name || null;
    case 'url':
      return property.url || null;
    case 'files':
      return property.files || [];
    case 'relation':
      return property.relation?.map((rel: any) => rel.id) || [];
    default:
      return null;
  }
}

export function getThumbnailUrl(thumbnail: any): string | null {
  if (!thumbnail || !Array.isArray(thumbnail) || thumbnail.length === 0) {
    return null;
  }
  const firstFile = thumbnail[0];
  if (firstFile.type === 'external' && firstFile.external?.url) {
    return firstFile.external.url;
  }
  if (firstFile.type === 'file' && firstFile.file?.url) {
    return firstFile.file.url;
  }
  return null;
}

async function uploadThumbnailToStorage(
  imageUrl: string,
  userId: string,
  mediaId: string
): Promise<string | null> {
  try {
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) return null;

    const contentType = imageResponse.headers.get('content-type') || '';
    if (contentType.includes('xml') || contentType.includes('text')) return null;

    const imageBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    const urlPath = new URL(imageUrl).pathname;
    const extension =
      urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[1]?.toLowerCase() ||
      (contentType.includes('jpeg') ? 'jpg' : contentType.includes('png') ? 'png' : 'jpg');

    const fileName = `${userId}/${mediaId}.${extension}`;
    const { error } = await supabase.storage.from('media-thumbnails').upload(fileName, buffer, {
      contentType: imageResponse.headers.get('content-type') || `image/${extension}`,
      upsert: true,
    });

    if (error) return null;

    const { data: urlData } = supabase.storage.from('media-thumbnails').getPublicUrl(fileName);
    return urlData.publicUrl;
  } catch {
    return null;
  }
}

/** Build a single media row from a Notion page for a given user. */
async function buildMediaRowFromPage(
  page: any,
  databaseId: string,
  currentProperties: Record<string, { type: string; name?: string }>,
  userId: string
): Promise<Record<string, any>> {
  const pageProperties = page.properties || {};
  const nameProp = Object.entries(currentProperties).find(
    ([_, p]) => (p as any).type === 'title'
  );
  const name = nameProp
    ? getPropertyValue(pageProperties[nameProp[0]], 'title')
    : 'Untitled';

  const mediaData: any = {
    user_id: userId,
    notion_page_id: page.id,
    notion_database_id: databaseId,
    name,
    updated_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  };

  for (const [key, prop] of Object.entries(currentProperties)) {
    const propertyValue = pageProperties[key];
    if (!propertyValue) continue;

    const value = getPropertyValue(propertyValue, prop.type);
    const propName = prop.name || key;

    switch (propName) {
      case 'Name':
        mediaData.name = value;
        break;
      case 'Category':
        mediaData.category = value;
        break;
      case 'Status':
        mediaData.status = value;
        break;
      case 'URL':
        mediaData.url = value;
        break;
      case 'By':
        mediaData.by = Array.isArray(value) ? value : [];
        break;
      case 'Topic':
        mediaData.topic = Array.isArray(value) ? value : [];
        break;
      case 'Thumbnail':
        mediaData.thumbnail = Array.isArray(value) ? value : [];
        const thumbnailUrl = getThumbnailUrl(value);
        if (thumbnailUrl) mediaData._thumbnailUrl = thumbnailUrl;
        break;
      case 'Synopsys':
      case 'AI synopsis':
        mediaData.ai_synopsis = value;
        break;
      case 'Created':
        mediaData.created = value ? new Date(value).toISOString() : null;
        break;
      case 'Related':
        mediaData.related_notion_page_ids = Array.isArray(value) ? value : [];
        break;
      default:
        if (prop.type === 'relation' && Array.isArray(value) && value.length > 0) {
          const relatedNotionPageId = value[0];
          const { data: monthlyTracking } = await supabase
            .from('tracking_monthly')
            .select('id')
            .eq('user_id', userId)
            .eq('notion_page_id', relatedNotionPageId)
            .single();
          if (monthlyTracking?.id) {
            mediaData.monthly_tracking_id = monthlyTracking.id;
          }
        }
        break;
    }
  }

  return mediaData;
}

/**
 * Find all user_ids that have at least one media row for this database (they've synced from it).
 */
async function getUserIdsForMediaDatabase(databaseId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('media')
    .select('user_id')
    .eq('notion_database_id', databaseId);

  if (error) return [];
  const ids = (data || []).map((r) => r.user_id);
  return [...new Set(ids)];
}

/**
 * Sync a single Notion page (media item) to our app for all users who have this database synced.
 * Call this when we receive page.properties_updated, page.created, or page.content_updated.
 */
export async function syncSinglePageToMedia(pageId: string, databaseId: string): Promise<void> {
  const userIds = await getUserIdsForMediaDatabase(databaseId);
  if (userIds.length === 0) return;

  let currentProperties: Record<string, any> = {};
  try {
    const currentDatabase = await notion.databases.retrieve({ database_id: databaseId });
    const dbProperties = (currentDatabase as any).properties || {};
    currentProperties = Object.entries(dbProperties).reduce(
      (acc, [key, prop]: [string, any]) => {
        acc[key] = { type: prop.type, name: prop.name || key };
        return acc;
      },
      {} as Record<string, any>
    );
  } catch (err) {
    console.error('Notion webhook: failed to fetch database schema', err);
    return;
  }

  let page: any;
  try {
    page = await notion.pages.retrieve({ page_id: pageId });
  } catch (err) {
    console.error('Notion webhook: failed to retrieve page', pageId, err);
    return;
  }

  const rowsToUpsert: Array<Record<string, any>> = [];
  for (const userId of userIds) {
    const row = await buildMediaRowFromPage(page, databaseId, currentProperties, userId);
    rowsToUpsert.push(row);
  }

  const toUpsert = rowsToUpsert.map(({ _thumbnailUrl, ...data }) => data);
  const { error: upsertError } = await supabase.from('media').upsert(toUpsert, {
    onConflict: 'user_id,notion_page_id',
  });

  if (upsertError) {
    console.error('Notion webhook: failed to upsert media', upsertError);
    return;
  }

  for (const item of rowsToUpsert) {
    if (item._thumbnailUrl) {
      const { data: existing } = await supabase
        .from('media')
        .select('id')
        .eq('user_id', item.user_id)
        .eq('notion_page_id', item.notion_page_id)
        .single();

      if (existing?.id) {
        const storageUrl = await uploadThumbnailToStorage(
          item._thumbnailUrl,
          item.user_id,
          existing.id
        );
        if (storageUrl) {
          await supabase.from('media').update({ thumbnail_url: storageUrl }).eq('id', existing.id);
        }
      }
    }
  }
}

/**
 * Remove a media page for all users (e.g. when the page is deleted in Notion).
 */
export async function deleteMediaPageFromAllUsers(pageId: string, databaseId: string): Promise<void> {
  const { data: removedMedia } = await supabase
    .from('media')
    .select('id, user_id, thumbnail_url')
    .eq('notion_database_id', databaseId)
    .eq('notion_page_id', pageId);

  if (!removedMedia?.length) return;

  for (const media of removedMedia) {
    if (media.thumbnail_url) {
      const urlParts = media.thumbnail_url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `${media.user_id}/${fileName}`;
      await supabase.storage.from('media-thumbnails').remove([filePath]);
    }
  }

  await supabase
    .from('media')
    .delete()
    .eq('notion_database_id', databaseId)
    .eq('notion_page_id', pageId);
}

/**
 * Verify Notion webhook payload using X-Notion-Signature (HMAC-SHA256 with verification_token).
 */
export function verifyNotionWebhookSignature(
  body: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!secret || !signatureHeader?.startsWith('sha256=')) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}
