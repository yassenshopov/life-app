export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { getNotionClient } from '@/lib/notion-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Media Ground database ID
const MEDIA_DATABASE_ID = '32638dcb058e4ebeaf325136ce8f3ec4';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mediaId } = await params;
    if (!mediaId) {
      return NextResponse.json({ error: 'Media ID is required' }, { status: 400 });
    }

    // Get the media entry from Supabase to get the Notion page ID
    const { data: mediaEntry, error: fetchError } = await supabase
      .from('media')
      .select('id, notion_page_id, thumbnail_url')
      .eq('id', mediaId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !mediaEntry) {
      return NextResponse.json(
        { error: 'Media entry not found' },
        { status: 404 }
      );
    }

    // Delete from Notion first
    if (mediaEntry.notion_page_id) {
      try {
        const notion = getNotionClient();
        await notion.pages.update({
          page_id: mediaEntry.notion_page_id,
          archived: true, // Archive instead of delete (Notion doesn't support hard delete via API)
        });
      } catch (notionError: any) {
        console.error('Error archiving Notion page:', notionError);
        // Continue with Supabase deletion even if Notion fails
      }
    }

    // Delete thumbnail from Supabase Storage if it exists
    if (mediaEntry.thumbnail_url) {
      try {
        // Extract file path from URL
        const urlParts = mediaEntry.thumbnail_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        const filePath = `${userId}/${fileName}`;
        
        await supabase.storage
          .from('media-thumbnails')
          .remove([filePath]);
      } catch (storageError) {
        console.warn('Error deleting thumbnail from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete from Supabase
    const { error: deleteError } = await supabase
      .from('media')
      .delete()
      .eq('id', mediaId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting from Supabase:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete media entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Media entry deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting media:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete media entry' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { mediaId } = await params;
    if (!mediaId) {
      return NextResponse.json({ error: 'Media ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, ai_synopsis, status } = body;

    // Get the media entry from Supabase to get the Notion page ID and category
    const { data: mediaEntry, error: fetchError } = await supabase
      .from('media')
      .select('id, notion_page_id, category')
      .eq('id', mediaId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !mediaEntry) {
      return NextResponse.json(
        { error: 'Media entry not found' },
        { status: 404 }
      );
    }

    // Fetch database schema to get correct property names
    let propertyMap: Record<string, string> = {};
    let existingProperties: Set<string> = new Set();
    const notion = getNotionClient();
    
    try {
      const database = await notion.databases.retrieve({
        database_id: MEDIA_DATABASE_ID,
      });
      const properties = (database as any).properties || {};
      Object.entries(properties).forEach(([key, prop]: [string, any]) => {
        const propName = prop.name || key;
        propertyMap[propName] = key;
        existingProperties.add(propName);
      });
    } catch (error) {
      console.warn('Failed to fetch database schema, using defaults:', error);
      propertyMap = {
        'Name': 'Name',
        'Status': 'Status',
        'Synopsys': 'Synopsys',
      };
      Object.keys(propertyMap).forEach(key => existingProperties.add(key));
    }

    // Prepare Notion properties update
    const notionProperties: any = {};

    if (name !== undefined && existingProperties.has('Name')) {
      const nameProp = propertyMap['Name'] || 'Name';
      notionProperties[nameProp] = {
        title: [{ text: { content: name } }],
      };
    }

    if (status !== undefined && existingProperties.has('Status')) {
      const statusProp = propertyMap['Status'] || 'Status';
      // Normalize "To-do" back to "Not started" for Notion
      const notionStatus = status === 'To-do' ? 'Not started' : status;
      notionProperties[statusProp] = {
        status: { name: notionStatus },
      };
    }

    if (ai_synopsis !== undefined) {
      // Try to find the Synopsys property with common variations
      const possibleNames = ['Synopsys', 'AI Synopsis', 'Synopsis', 'Description', 'AI Description'];
      let synopsisProp: string | null = null;
      
      for (const name of possibleNames) {
        if (existingProperties.has(name)) {
          synopsisProp = propertyMap[name] || name;
          break;
        }
      }
      
      // If not found, try using 'Synopsys' as fallback (Notion will error if it doesn't exist)
      if (!synopsisProp) {
        synopsisProp = propertyMap['Synopsys'] || 'Synopsys';
      }
      
      notionProperties[synopsisProp] = {
        rich_text: ai_synopsis ? [{ text: { content: ai_synopsis } }] : [],
      };
    }

    // Update Notion page if there are properties to update
    if (Object.keys(notionProperties).length > 0 && mediaEntry.notion_page_id) {
      try {
        const pageUpdate: any = {
          page_id: mediaEntry.notion_page_id,
          properties: notionProperties,
        };
        
        // Update icon for books when status changes
        if (status !== undefined && mediaEntry.category === 'Book') {
          // Use book icon if Done, empty bookmark otherwise - PNG format for better compatibility
          const isDone = status === 'Done';
          pageUpdate.icon = { 
            type: 'external', 
            external: { 
              url: isDone 
                ? 'https://api.iconify.design/lucide/book.png?width=280&height=280' 
                : 'https://api.iconify.design/lucide/bookmark.png?width=280&height=280' 
            } 
          };
        }
        
        await notion.pages.update(pageUpdate);
      } catch (notionError: any) {
        console.error('Error updating Notion page:', notionError);
        // Continue with Supabase update even if Notion fails
      }
    } else if (status !== undefined && mediaEntry.category === 'Book' && mediaEntry.notion_page_id) {
      // Update icon even if no other properties are being updated
      try {
        const isDone = status === 'Done';
        await notion.pages.update({
          page_id: mediaEntry.notion_page_id,
          icon: { 
            type: 'external', 
            external: { 
              url: isDone 
                ? 'https://api.iconify.design/lucide/book.png?width=280&height=280' 
                : 'https://api.iconify.design/lucide/bookmark.png?width=280&height=280' 
            } 
          },
        });
      } catch (notionError: any) {
        console.error('Error updating Notion page icon:', notionError);
        // Continue with Supabase update even if Notion fails
      }
    }

    // Update Supabase
    const supabaseUpdate: any = {
      updated_at: new Date().toISOString(),
    };
    
    if (name !== undefined) supabaseUpdate.name = name;
    if (ai_synopsis !== undefined) supabaseUpdate.ai_synopsis = ai_synopsis;
    if (status !== undefined) {
      // Normalize "To-do" back to "Not started" for database
      supabaseUpdate.status = status === 'To-do' ? 'Not started' : status;
    }

    const { data: updatedMedia, error: updateError } = await supabase
      .from('media')
      .update(supabaseUpdate)
      .eq('id', mediaId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating Supabase:', updateError);
      return NextResponse.json(
        { error: 'Failed to update media entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      media: updatedMedia,
    });
  } catch (error: any) {
    console.error('Error updating media:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update media entry' },
      { status: 500 }
    );
  }
}

