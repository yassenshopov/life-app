export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { createClient } from '@supabase/supabase-js';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      return property.date?.start || null;
    case 'number':
      return property.number;
    case 'checkbox':
      return property.checkbox || false;
    case 'files':
      return property.files || [];
    case 'formula':
      return property.formula;
    default:
      return null;
  }
}

// Helper function to extract image URL from Notion files JSONB
function getImageUrl(imageData: any): string | null {
  if (!imageData || !Array.isArray(imageData) || imageData.length === 0) {
    return null;
  }
  const firstFile = imageData[0];
  if (firstFile.type === 'external' && firstFile.external?.url) {
    return firstFile.external.url;
  }
  if (firstFile.type === 'file' && firstFile.file?.url) {
    return firstFile.file.url;
  }
  return null;
}

// Helper function to upload image to Supabase Storage
async function uploadImageToStorage(
  imageUrl: string,
  userId: string,
  personId: string
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
    const fileName = `${userId}/${personId}.${extension}`;
    const { data, error } = await supabase.storage
      .from('people-images')
      .upload(fileName, buffer, {
        contentType: imageResponse.headers.get('content-type') || `image/${extension}`,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      // If bucket doesn't exist, log it but don't fail the sync
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        console.warn('Storage bucket "people-images" not found. Please create it in Supabase dashboard.');
      } else {
        console.error(`Error uploading image to storage:`, error);
      }
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('people-images')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error(`Error uploading image:`, error);
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

    // Get user's People database from their notion_databases array
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

    // Find People database by checking database name (case-insensitive)
    const peopleDb = databases.find(
      (db: any) => {
        const dbName = typeof db.database_name === 'string' 
          ? db.database_name 
          : String(db.database_name || '');
        return dbName.toLowerCase().includes('people');
      }
    );

    if (!peopleDb) {
      return NextResponse.json(
        { error: 'People database not connected' },
        { status: 404 }
      );
    }

    const databaseId = peopleDb.database_id;
    
    // Fetch current database schema from Notion to get all properties (including newly added ones)
    let currentProperties: Record<string, any> = {};
    try {
      const currentDatabase = await notion.databases.retrieve({
        database_id: databaseId,
      });
      // Extract property types from current database schema
      const dbProperties = (currentDatabase as any).properties || {};
      currentProperties = Object.entries(dbProperties).reduce((acc, [key, prop]: [string, any]) => {
        acc[key] = { type: prop.type };
        return acc;
      }, {} as Record<string, any>);
      
      // Log available properties for debugging
      console.log('Available properties in Notion:', Object.keys(currentProperties));
      if (currentProperties['Nicknames'] || currentProperties['Nickname']) {
        console.log('Nicknames property found:', currentProperties['Nicknames'] || currentProperties['Nickname']);
      } else {
        console.log('⚠️ Nicknames property not found in Notion schema. Available properties:', Object.keys(currentProperties));
      }
    } catch (error) {
      console.error('Error fetching current database schema:', error);
      // Fallback to stored properties if fetch fails
      currentProperties = peopleDb.properties || {};
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

    // Get existing people from Supabase
    const { data: existingPeople, error: fetchError } = await supabase
      .from('people')
      .select('notion_page_id')
      .eq('user_id', userId)
      .eq('notion_database_id', databaseId);

    if (fetchError) {
      console.error('Error fetching existing people:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch existing people' },
        { status: 500 }
      );
    }

    const existingPageIds = new Set(
      existingPeople?.map((p) => p.notion_page_id) || []
    );
    const newPageIds = new Set(allPages.map((p) => p.id));

    // Find added, removed, and modified pages
    const added = allPages.filter((p) => !existingPageIds.has(p.id));
    const removed = Array.from(existingPageIds).filter(
      (id) => !newPageIds.has(id)
    );

    // Process and insert/update people
    const peopleToUpsert = allPages.map((page: any) => {
      const pageProperties = page.properties || {};
      const nameProp = Object.entries(properties).find(
        ([_, p]: [string, any]) => p.type === 'title'
      );
      const name = nameProp
        ? getPropertyValue(pageProperties[nameProp[0]], 'title')
        : 'Untitled';

      // Map all properties
      // IMPORTANT: user_id comes from authenticated Clerk user - ensures data isolation per user
      const personData: any = {
        user_id: userId, // Clerk user ID - ensures each user only sees their own people
        notion_page_id: page.id,
        notion_database_id: databaseId,
        name,
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      };

      // Store original image data temporarily for upload
      let _imageUrl: string | null = null;

      // Map each property
      Object.entries(properties).forEach(([key, prop]: [string, any]) => {
        const propertyValue = pageProperties[key];
        if (!propertyValue) return;

        const value = getPropertyValue(propertyValue, prop.type);
        
        // Map to database column names
        switch (key) {
          case 'Name':
            personData.name = value;
            break;
          case 'Origin of connection':
            personData.origin_of_connection = value;
            break;
          case 'Star sign':
            personData.star_sign = value;
            break;
          case 'Image':
            personData.image = value;
            // Extract image URL for upload
            _imageUrl = getImageUrl(value);
            break;
          case 'Currently at':
            personData.currently_at = value;
            break;
          case 'Age':
            personData.age = value;
            break;
          case 'Tier':
            personData.tier = value;
            break;
          case 'Occupation':
            personData.occupation = value;
            break;
          case 'Birthday':
            personData.birthday = value;
            break;
          case 'Contact Freq.':
            personData.contact_freq = value;
            break;
          case 'From':
            personData.from_location = value;
            break;
          case 'Birth Date':
            personData.birth_date = value;
            break;
          case 'Nicknames':
          case 'Nickname':
          case 'nicknames':
          case 'nickname':
            // Ensure it's an array for multi_select
            personData.nicknames = Array.isArray(value) ? value : (value ? [value] : []);
            if (personData.nicknames && personData.nicknames.length > 0) {
              console.log(`✓ Synced nicknames for ${personData.name}:`, personData.nicknames);
            }
            break;
          default:
            // Fallback: convert key to snake_case
            const columnName = key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            personData[columnName] = value;
        }
      });

      // Store image URL temporarily for upload after upsert
      (personData as any)._imageUrl = _imageUrl;

      return personData;
    });

    // Delete removed entries (also delete their images from storage)
    if (removed.length > 0) {
      // Get people to delete to clean up their images
      const { data: peopleToDelete } = await supabase
        .from('people')
        .select('id, image_url')
        .eq('user_id', userId)
        .eq('notion_database_id', databaseId)
        .in('notion_page_id', removed);

      // Delete images from storage
      if (peopleToDelete) {
        for (const person of peopleToDelete) {
          if (person.image_url) {
            try {
              const urlParts = person.image_url.split('/');
              const fileName = urlParts.slice(-2).join('/'); // Get userId/personId.ext
              await supabase.storage
                .from('people-images')
                .remove([fileName]);
            } catch (error) {
              console.warn(`Failed to delete image for person ${person.id}:`, error);
            }
          }
        }
      }

      const { error: deleteError } = await supabase
        .from('people')
        .delete()
        .eq('user_id', userId)
        .eq('notion_database_id', databaseId)
        .in('notion_page_id', removed);

      if (deleteError) {
        console.error('Error deleting removed people:', deleteError);
      }
    }

    // Upsert people first to get IDs
    if (peopleToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('people')
        .upsert(peopleToUpsert.map(({ _imageUrl, ...data }) => data), {
          onConflict: 'user_id,notion_page_id',
        });

      if (upsertError) {
        console.error('Error upserting people:', upsertError);
        return NextResponse.json(
          { error: 'Failed to sync people' },
          { status: 500 }
        );
      }
    }

    // Now upload images and update with Supabase Storage URLs
    for (const personItem of peopleToUpsert) {
      if (personItem._imageUrl) {
        // Get the person ID from the database
        const { data: existingPerson } = await supabase
          .from('people')
          .select('id')
          .eq('user_id', userId)
          .eq('notion_page_id', personItem.notion_page_id)
          .single();

        if (existingPerson?.id) {
          const storageUrl = await uploadImageToStorage(
            personItem._imageUrl,
            userId,
            existingPerson.id
          );

          if (storageUrl) {
            // Update with Supabase Storage URL
            await supabase
              .from('people')
              .update({ image_url: storageUrl })
              .eq('id', existingPerson.id);
          }
        }
      }
    }

    // Update last_sync in user's notion_databases
    const updatedDatabases = databases.map((db: any) =>
      db.database_id === databaseId
        ? { ...db, last_sync: new Date().toISOString() }
        : db
    );

    await supabase
      .from('users')
      .update({ notion_databases: updatedDatabases })
      .eq('id', userId);

    return NextResponse.json({
      success: true,
      synced: peopleToUpsert.length,
      added: added.length,
      removed: removed.length,
      last_sync: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error syncing People DB:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync people',
      },
      { status: 500 }
    );
  }
}

