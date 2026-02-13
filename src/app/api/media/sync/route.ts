export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/ensure-user';
import {
  getMediaDatabaseIdForUser,
  getPropertyValue,
  getThumbnailUrl,
} from '@/lib/notion-media-sync';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = getSupabaseServiceRoleClient();

// Helper function to upload image to Supabase Storage
async function uploadThumbnailToStorage(
  imageUrl: string,
  userId: string,
  mediaId: string
): Promise<string | null> {
  try {
    // Download the image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.warn(`Failed to download image from ${imageUrl}: ${imageResponse.status}`);
      return null;
    }

    // Check if response is XML (error response from S3)
    const contentType = imageResponse.headers.get('content-type') || '';
    if (contentType.includes('xml') || contentType.includes('text')) {
      console.warn(`Image URL returned XML/text instead of image: ${imageUrl}`);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    // Get file extension from URL or content-type
    const urlPath = new URL(imageUrl).pathname;
    const extension = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i)?.[1]?.toLowerCase() || 
                     (contentType.includes('jpeg') ? 'jpg' : 
                      contentType.includes('png') ? 'png' : 
                      contentType.includes('gif') ? 'gif' : 
                      contentType.includes('webp') ? 'webp' : 'jpg');

    // Upload to Supabase Storage
    const fileName = `${userId}/${mediaId}.${extension}`;
    const { data, error } = await supabase.storage
      .from('media-thumbnails')
      .upload(fileName, buffer, {
        contentType: imageResponse.headers.get('content-type') || `image/${extension}`,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      // If bucket doesn't exist, log it but don't fail the sync
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        console.warn('Storage bucket "media-thumbnails" not found. Please create it in Supabase dashboard.');
      } else {
        console.error(`Error uploading thumbnail to storage:`, error);
      }
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('media-thumbnails')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error(`Error uploading thumbnail:`, error);
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

    await ensureUserExists(supabase, userId);

    const MEDIA_DATABASE_ID = await getMediaDatabaseIdForUser(supabase, userId);
    if (!MEDIA_DATABASE_ID) {
      return NextResponse.json(
        { error: 'Media database not connected. Add a Notion database whose name contains "Media" in Settings.' },
        { status: 404 }
      );
    }

    // Fetch current database schema from Notion
    let currentProperties: Record<string, any> = {};
    try {
      const currentDatabase = await notion.databases.retrieve({
        database_id: MEDIA_DATABASE_ID,
      });
      const dbProperties = (currentDatabase as any).properties || {};
      currentProperties = Object.entries(dbProperties).reduce((acc, [key, prop]: [string, any]) => {
        acc[key] = { type: prop.type, name: prop.name || key };
        return acc;
      }, {} as Record<string, any>);
    } catch (error) {
      console.error('Error fetching database schema:', error);
      return NextResponse.json(
        { error: 'Failed to fetch database schema' },
        { status: 500 }
      );
    }

    // Fetch all pages from Notion
    let allPages: any[] = [];
    let hasMore = true;
    let cursor: string | undefined = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: MEDIA_DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      allPages = [...allPages, ...response.results];
      hasMore = response.has_more;
      cursor = response.next_cursor || undefined;
    }

    // Get existing media from Supabase
    const { data: existingMedia, error: fetchError } = await supabase
      .from('media')
      .select('notion_page_id')
      .eq('user_id', userId)
      .eq('notion_database_id', MEDIA_DATABASE_ID);

    if (fetchError) {
      console.error('Error fetching existing media:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch existing media' },
        { status: 500 }
      );
    }

    const existingPageIds = new Set(
      existingMedia?.map((m) => m.notion_page_id) || []
    );
    const newPageIds = new Set(allPages.map((p) => p.id));

    // Find added and removed pages
    const added = allPages.filter((p) => !existingPageIds.has(p.id));
    const removed = Array.from(existingPageIds).filter(
      (id) => !newPageIds.has(id)
    );

    // Process and insert/update media
    const mediaToUpsert = await Promise.all(
      allPages.map(async (page: any) => {
        const pageProperties = page.properties || {};
        
        // Find name property (title type)
        const nameProp = Object.entries(currentProperties).find(
          ([_, p]: [string, any]) => p.type === 'title'
        );
        const name = nameProp
          ? getPropertyValue(pageProperties[nameProp[0]], 'title')
          : 'Untitled';

        const mediaData: any = {
          user_id: userId,
          notion_page_id: page.id,
          notion_database_id: MEDIA_DATABASE_ID,
          name,
          updated_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        };

        // Map each property
        for (const [key, prop] of Object.entries(currentProperties)) {
          const propertyValue = pageProperties[key];
          if (!propertyValue) continue;

          const value = getPropertyValue(propertyValue, prop.type);
          
          // Map to database column names based on property name
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
              // Upload thumbnail to Supabase Storage
              const thumbnailUrl = getThumbnailUrl(value);
              if (thumbnailUrl) {
                // We'll upload after we have the media ID, so store the URL for now
                mediaData._thumbnailUrl = thumbnailUrl;
              }
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
              // Handle relation properties (could be named "Month", "Monthly Tracking", etc.)
              if (prop.type === 'relation' && Array.isArray(value) && value.length > 0) {
                // Get the first related page ID (assuming single relation)
                const relatedNotionPageId = value[0];
                // Look up the tracking_monthly entry by notion_page_id
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
      })
    );

    // Upsert media first to get IDs
    if (mediaToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('media')
        .upsert(mediaToUpsert.map(({ _thumbnailUrl, ...data }) => data), {
          onConflict: 'user_id,notion_page_id',
        });

      if (upsertError) {
        console.error('Error upserting media:', upsertError);
        return NextResponse.json(
          { error: 'Failed to sync media' },
          { status: 500 }
        );
      }
    }

    // Now upload thumbnails and update with Supabase Storage URLs
    for (const mediaItem of mediaToUpsert) {
      if (mediaItem._thumbnailUrl) {
        // Get the media ID from the database
        const { data: existingMedia } = await supabase
          .from('media')
          .select('id')
          .eq('user_id', userId)
          .eq('notion_page_id', mediaItem.notion_page_id)
          .single();

        if (existingMedia?.id) {
          const storageUrl = await uploadThumbnailToStorage(
            mediaItem._thumbnailUrl,
            userId,
            existingMedia.id
          );

          if (storageUrl) {
            // Update with Supabase Storage URL
            await supabase
              .from('media')
              .update({ thumbnail_url: storageUrl })
              .eq('id', existingMedia.id);
          }
        }
      }
    }

    // Delete removed entries (also delete their thumbnails from storage)
    if (removed.length > 0) {
      // Get media IDs for removed entries to delete their thumbnails
      const { data: removedMedia } = await supabase
        .from('media')
        .select('id, thumbnail_url')
        .eq('user_id', userId)
        .eq('notion_database_id', MEDIA_DATABASE_ID)
        .in('notion_page_id', removed);

      // Delete thumbnails from storage
      if (removedMedia) {
        for (const media of removedMedia) {
          if (media.thumbnail_url) {
            const urlParts = media.thumbnail_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const filePath = `${userId}/${fileName}`;
            await supabase.storage
              .from('media-thumbnails')
              .remove([filePath]);
          }
        }
      }

      const { error: deleteError } = await supabase
        .from('media')
        .delete()
        .eq('user_id', userId)
        .eq('notion_database_id', MEDIA_DATABASE_ID)
        .in('notion_page_id', removed);

      if (deleteError) {
        console.error('Error deleting removed media:', deleteError);
      }
    }

    return NextResponse.json({
      success: true,
      synced: mediaToUpsert.length,
      added: added.length,
      removed: removed.length,
      last_sync: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error syncing Media DB:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync media',
      },
      { status: 500 }
    );
  }
}

