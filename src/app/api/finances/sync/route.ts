export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/ensure-user';
import { secureCompareSecrets } from '@/lib/secure-compare';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = getSupabaseServiceRoleClient();

// Helper function to get database IDs from user's connected databases
async function getFinancesDatabaseIds(userId: string): Promise<{
  assets: string | null;
  investments: string | null;
  places: string | null;
}> {
  const { data: user } = await supabase
    .from('users')
    .select('notion_databases')
    .eq('id', userId)
    .single();

  if (!user) {
    return { assets: null, investments: null, places: null };
  }

  const databases = Array.isArray(user.notion_databases)
    ? user.notion_databases
    : JSON.parse(user.notion_databases || '[]');

  const assetsDb = databases.find((db: any) => db.type === 'finances_assets');
  const investmentsDb = databases.find((db: any) => db.type === 'finances_investments');
  const placesDb = databases.find((db: any) => db.type === 'finances_places');

  return {
    assets: assetsDb?.database_id || null,
    investments: investmentsDb?.database_id || null,
    places: placesDb?.database_id || null,
  };
}

// Helper function to get icon URL from Notion icon object
function getIconUrl(icon: any): string | null {
  if (!icon) return null;
  if (icon.type === 'emoji') return null; // Emojis don't have URLs
  if (icon.type === 'external' && icon.external?.url) {
    return icon.external.url;
  }
  if (icon.type === 'file' && icon.file?.url) {
    return icon.file.url;
  }
  return null;
}

// Helper function to upload icon to Supabase Storage (for assets)
async function uploadIconToStorage(
  imageUrl: string,
  userId: string,
  assetId: string,
  updatedAt?: string
): Promise<string | null> {
  try {
    // Download the image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.warn(`Failed to download icon from ${imageUrl}: ${imageResponse.status}`);
      return null;
    }

    // Check if response is XML (error response from S3)
    const contentType = imageResponse.headers.get('content-type') || '';
    if (contentType.includes('xml') || contentType.includes('text')) {
      console.warn(`Icon URL returned XML/text instead of image: ${imageUrl}`);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    // Get file extension from URL or content-type
    const urlPath = new URL(imageUrl).pathname;
    const extension = urlPath.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)?.[1]?.toLowerCase() || 
                     (contentType.includes('jpeg') ? 'jpg' : 
                      contentType.includes('png') ? 'png' : 
                      contentType.includes('gif') ? 'gif' : 
                      contentType.includes('webp') ? 'webp' :
                      contentType.includes('svg') ? 'svg' : 'jpg');

    // Upload to Supabase Storage
    const fileName = `${userId}/${assetId}.${extension}`;
    const { data, error } = await supabase.storage
      .from('finances-icons')
      .upload(fileName, buffer, {
        contentType: imageResponse.headers.get('content-type') || `image/${extension}`,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      // If bucket doesn't exist, log it but don't fail the sync
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        console.warn('Storage bucket "finances-icons" not found. Please create it in Supabase dashboard.');
      } else {
        console.error(`Error uploading icon to storage:`, error);
      }
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('finances-icons')
      .getPublicUrl(fileName);

    // Add cache-busting query parameter using updated_at timestamp or current time
    const cacheBuster = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    return `${urlData.publicUrl}?t=${cacheBuster}`;
  } catch (error) {
    console.error(`Error uploading icon:`, error);
    return null;
  }
}

// Helper function to upload place icon to Supabase Storage
async function uploadPlaceIconToStorage(
  imageUrl: string,
  userId: string,
  placeId: string,
  updatedAt?: string
): Promise<string | null> {
  try {
    // Download the image
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!imageResponse.ok) {
      console.warn(`Failed to download place icon from ${imageUrl}: ${imageResponse.status}`);
      return null;
    }

    // Check if response is XML (error response from S3)
    const contentType = imageResponse.headers.get('content-type') || '';
    if (contentType.includes('xml') || contentType.includes('text')) {
      console.warn(`Place icon URL returned XML/text instead of image: ${imageUrl}`);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(imageBuffer);

    // Get file extension from URL or content-type
    const urlPath = new URL(imageUrl).pathname;
    const extension = urlPath.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)?.[1]?.toLowerCase() || 
                     (contentType.includes('jpeg') ? 'jpg' : 
                      contentType.includes('png') ? 'png' : 
                      contentType.includes('gif') ? 'gif' : 
                      contentType.includes('webp') ? 'webp' :
                      contentType.includes('svg') ? 'svg' : 'jpg');

    // Upload to Supabase Storage
    const fileName = `${userId}/${placeId}.${extension}`;
    const { data, error } = await supabase.storage
      .from('finances-place-icons')
      .upload(fileName, buffer, {
        contentType: imageResponse.headers.get('content-type') || `image/${extension}`,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      // If bucket doesn't exist, log it but don't fail the sync
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        console.warn('Storage bucket "finances-place-icons" not found. Please create it in Supabase dashboard.');
      } else {
        console.error(`Error uploading place icon to storage:`, error);
      }
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('finances-place-icons')
      .getPublicUrl(fileName);

    // Add cache-busting query parameter using updated_at timestamp or current time
    const cacheBuster = updatedAt ? new Date(updatedAt).getTime() : Date.now();
    return `${urlData.publicUrl}?t=${cacheBuster}`;
  } catch (error) {
    console.error(`Error uploading place icon:`, error);
    return null;
  }
}

// Helper function to extract property value
function getPropertyValue(property: any, propertyType: string): any {
  if (!property) return null;

  switch (propertyType) {
    case 'title':
      return property.title?.[0]?.plain_text || '';
    case 'rich_text':
      return property.rich_text?.[0]?.plain_text || '';
    case 'number':
      return property.number;
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
    case 'checkbox':
      return property.checkbox || false;
    case 'relation':
      return property.relation?.map((rel: any) => rel.id) || [];
    case 'formula':
      // Formula can return different types, check the result
      const formulaResult = property.formula;
      if (!formulaResult) return null;
      if (formulaResult.type === 'number') return formulaResult.number;
      if (formulaResult.type === 'string') return formulaResult.string;
      if (formulaResult.type === 'boolean') return formulaResult.boolean;
      if (formulaResult.type === 'date') return formulaResult.date?.start || null;
      return null;
    case 'rollup':
      // Rollup can return different types
      const rollupResult = property.rollup;
      if (!rollupResult) return null;
      if (rollupResult.type === 'number') return rollupResult.number;
      if (rollupResult.type === 'date') return rollupResult.date?.start || null;
      if (rollupResult.type === 'array') {
        // For array rollups, extract the first number if available
        const array = rollupResult.array || [];
        if (array.length > 0) {
          // If first item is a number, return just that number (not an array)
          if (array[0].type === 'number') {
            return array[0].number;
          }
          // If it's a relation rollup showing original, try to get the value
          if (array[0].type === 'relation') {
            // For relation rollups, we might need to return the relation ID
            return array.map((item: any) => item.id || item);
          }
        }
        return null;
      }
      return null;
    default:
      return null;
  }
}

async function syncDatabase(
  userId: string,
  databaseId: string,
  tableName: string,
  dbName: string
) {
  try {
    // Fetch current database schema from Notion
    let currentProperties: Record<string, any> = {};
    try {
      const currentDatabase = await notion.databases.retrieve({
        database_id: databaseId,
      });
      const dbProperties = (currentDatabase as any).properties || {};
      currentProperties = Object.entries(dbProperties).reduce(
        (acc, [key, prop]: [string, any]) => {
          acc[key] = { type: prop.type, name: prop.name || key };
          return acc;
        },
        {} as Record<string, any>
      );
    } catch (error) {
      console.error(`Error fetching ${dbName} database schema:`, error);
      return {
        success: false,
        error: `Failed to fetch ${dbName} database schema`,
      };
    }

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
      console.error(`Error fetching existing ${dbName}:`, fetchError);
      return {
        success: false,
        error: `Failed to fetch existing ${dbName}`,
      };
    }

    const existingPageIds = new Set(
      existingEntries?.map((e) => e.notion_page_id) || []
    );
    const newPageIds = new Set(allPages.map((p) => p.id.replace(/-/g, '')));

    // Find added and removed pages
    const added = allPages.filter((p) => !existingPageIds.has(p.id.replace(/-/g, '')));
    const removed = Array.from(existingPageIds).filter(
      (id) => !newPageIds.has(id)
    );

    // Process and insert/update entries
    const entriesToUpsert = await Promise.all(
      allPages.map(async (page: any) => {
        const pageProperties = page.properties || {};

        // Find name property (title type)
        const nameProp = Object.entries(currentProperties).find(
          ([_, p]: [string, any]) => p.type === 'title'
        );
        const name = nameProp
          ? getPropertyValue(pageProperties[nameProp[0]], 'title')
          : 'Untitled';

        const entryData: any = {
          user_id: userId,
          notion_page_id: page.id.replace(/-/g, ''), // Normalize Notion page ID (remove dashes)
          notion_database_id: databaseId,
          name,
          updated_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          properties: {},
        };

        // Add icon for assets and places tables
        if (tableName === 'finances_assets' || tableName === 'finances_places') {
          const pageIcon = (page as any).icon || null;
          
          // Only save icon JSONB for assets (places only use icon_url)
          if (tableName === 'finances_assets') {
            entryData.icon = pageIcon;
          }
          
          // Extract icon URL for later upload to Supabase Storage
          const iconUrl = getIconUrl(pageIcon);
          if (iconUrl) {
            entryData._iconUrl = iconUrl; // Temporary field, will be removed before upsert
            console.log(`Found icon URL for ${tableName === 'finances_assets' ? 'asset' : 'place'} "${name}": ${iconUrl}`);
          } else {
            console.log(`No icon URL found for ${tableName === 'finances_assets' ? 'asset' : 'place'} "${name}" (icon type: ${pageIcon?.type || 'none'})`);
          }
        }

        // Map each property
        for (const [key, prop] of Object.entries(currentProperties)) {
          const propertyValue = pageProperties[key];
          if (!propertyValue) continue;

          const value = getPropertyValue(propertyValue, prop.type);
          const propName = prop.name || key;

          // Store all properties in JSONB for flexibility
          entryData.properties[propName] = value;

          // Map common properties to columns based on property name (case-insensitive)
          const propNameLower = propName.toLowerCase();

          // Assets-specific mappings
          if (tableName === 'finances_assets') {
            if (propNameLower === 'ticker') {
              entryData.symbol = value;
            } else if (propNameLower === 'current price') {
              entryData.current_price = value;
            } else if (propNameLower === 'summary') {
              entryData.summary = value;
            }
          }

          // Individual Investments-specific mappings
          if (tableName === 'finances_individual_investments') {
            if (propNameLower === 'asset') {
              // Handle relation to assets
              if (prop.type === 'relation') {
                if (!Array.isArray(value) || value.length === 0) {
                  console.log(`Investment "${name}" has no Asset relation`);
                } else {
                  const relatedNotionPageId = value[0];
                  console.log(`Looking up asset for investment "${name}" with Notion page ID: ${relatedNotionPageId}`);
                  
                  // Normalize Notion page ID (remove dashes for comparison)
                  const normalizedPageId = relatedNotionPageId.replace(/-/g, '');
                  
                  // Try to find the asset by normalized page ID with retry logic
                  const assetResult = await retryLookup(async () => {
                    return await supabase
                      .from('finances_assets')
                      .select('id, name, notion_page_id')
                      .eq('user_id', userId)
                      .eq('notion_page_id', normalizedPageId)
                      .single();
                  });

                  if (assetResult.data?.id) {
                    entryData.asset_id = assetResult.data.id;
                    console.log(`✓ Linked investment "${name}" to asset "${assetResult.data.name}" (ID: ${assetResult.data.id}, Notion page: ${relatedNotionPageId})`);
                  } else {
                    // Try without normalization in case the asset was stored with dashes (with retry)
                    const assetWithDashesResult = await retryLookup(async () => {
                      return await supabase
                        .from('finances_assets')
                        .select('id, name, notion_page_id')
                        .eq('user_id', userId)
                        .eq('notion_page_id', relatedNotionPageId)
                        .single();
                    });
                    
                    if (assetWithDashesResult.data?.id) {
                      entryData.asset_id = assetWithDashesResult.data.id;
                      console.log(`✓ Linked investment "${name}" to asset "${assetWithDashesResult.data.name}" (ID: ${assetWithDashesResult.data.id}, Notion page with dashes: ${relatedNotionPageId})`);
                    } else {
                      console.warn(`⚠ Asset not found for investment "${name}". Notion page ID: ${relatedNotionPageId} (normalized: ${normalizedPageId})`);
                      // Log available assets for debugging
                      const { data: availableAssets } = await supabase
                        .from('finances_assets')
                        .select('id, notion_page_id, name')
                        .eq('user_id', userId)
                        .limit(10);
                      console.warn(`Available assets (${availableAssets?.length || 0}):`, availableAssets);
                    }
                  }
                }
              } else {
                console.warn(`Investment "${name}" has Asset property but it's not a relation type: ${prop.type}`);
              }
            } else if (propNameLower === 'units' || propNameLower === 'quantity' || propNameLower === 'qty') {
              entryData.quantity = value;
              console.log(`Mapped ${propName} to quantity:`, value);
            } else if (propNameLower === 'price at buy' || propNameLower === 'purchase price' || propNameLower === 'buy price') {
              entryData.purchase_price = value;
              console.log(`Mapped ${propName} to purchase_price:`, value);
            } else if (propNameLower === 'date' || propNameLower === 'purchase date' || propNameLower === 'buy date') {
              entryData.purchase_date = value ? new Date(value).toISOString() : null;
              console.log(`Mapped ${propName} to purchase_date:`, value);
            } else if (propNameLower === 'result' || propNameLower === 'current value' || propNameLower === 'value') {
              entryData.current_value = value;
              console.log(`Mapped ${propName} to current_value:`, value);
            } else if (propNameLower === 'current price' || propNameLower === 'price') {
              entryData.current_price = value;
              console.log(`Mapped ${propName} to current_price:`, value);
            } else if (propNameLower === 'facet in nw' || propNameLower === 'facets in nw') {
              // Handle relation to places
              if (prop.type === 'relation') {
                if (!Array.isArray(value) || value.length === 0) {
                  console.log(`Investment "${name}" has no Facet in NW relation`);
                } else {
                  const relatedNotionPageId = value[0];
                  console.log(`Looking up place for investment "${name}" with Notion page ID: ${relatedNotionPageId}`);
                  
                  // Normalize Notion page ID (remove dashes for comparison)
                  const normalizedPageId = relatedNotionPageId.replace(/-/g, '');
                  
                  // Try to find the place by normalized page ID with retry logic
                  const placeResult = await retryLookup(async () => {
                    return await supabase
                      .from('finances_places')
                      .select('id, name, notion_page_id')
                      .eq('user_id', userId)
                      .eq('notion_page_id', normalizedPageId)
                      .single();
                  });

                  if (placeResult.data?.id) {
                    entryData.place_id = placeResult.data.id;
                    console.log(`✓ Linked investment "${name}" to place "${placeResult.data.name}" (ID: ${placeResult.data.id}, Notion page: ${relatedNotionPageId})`);
                  } else {
                    // Try without normalization in case the place was stored with dashes (with retry)
                    const placeWithDashesResult = await retryLookup(async () => {
                      return await supabase
                        .from('finances_places')
                        .select('id, name, notion_page_id')
                        .eq('user_id', userId)
                        .eq('notion_page_id', relatedNotionPageId)
                        .single();
                    });
                    
                    if (placeWithDashesResult.data?.id) {
                      entryData.place_id = placeWithDashesResult.data.id;
                      console.log(`✓ Linked investment "${name}" to place "${placeWithDashesResult.data.name}" (ID: ${placeWithDashesResult.data.id}, Notion page with dashes: ${relatedNotionPageId})`);
                    } else {
                      console.warn(`⚠ Place not found for investment "${name}". Notion page ID: ${relatedNotionPageId} (normalized: ${normalizedPageId})`);
                      // Log available places for debugging
                      const { data: availablePlaces } = await supabase
                        .from('finances_places')
                        .select('id, notion_page_id, name')
                        .eq('user_id', userId)
                        .limit(10);
                      console.warn(`Available places (${availablePlaces?.length || 0}):`, availablePlaces);
                    }
                  }
                }
              } else {
                console.warn(`Investment "${name}" has Facet in NW property but it's not a relation type: ${prop.type}`);
              }
            } else if (propNameLower === 'how much?') {
              // Store purchase amount in properties
              entryData.properties[propName] = value;
            } else if (propNameLower === 'fees') {
              entryData.properties[propName] = value;
            }
          }

          // Places-specific mappings
          if (tableName === 'finances_places') {
            if (propNameLower === 'tags') {
              // Tags is multi_select, use first tag as place_type
              if (Array.isArray(value) && value.length > 0) {
                entryData.place_type = value[0];
              }
            } else if (propNameLower === 'value [bank]') {
              entryData.balance = value;
            } else if (propNameLower === 'value [usd]') {
              entryData.total_value = value;
            }
          }
        }

        // For investments, if current_price is not set but we have an asset_id, try to get it from the asset
        if (tableName === 'finances_individual_investments' && !entryData.current_price && entryData.asset_id) {
          const { data: asset } = await supabase
            .from('finances_assets')
            .select('current_price')
            .eq('id', entryData.asset_id)
            .single();
          
          if (asset?.current_price) {
            entryData.current_price = asset.current_price;
            console.log(`Set current_price from asset for investment ${entryData.name}:`, asset.current_price);
          }
        }

        return entryData;
      })
    );

    // Upsert entries first to get IDs
    if (entriesToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from(tableName)
        .upsert(entriesToUpsert.map(({ _iconUrl, ...data }) => data), {
          onConflict: 'user_id,notion_page_id',
        });

      if (upsertError) {
        console.error(`Error upserting ${dbName}:`, upsertError);
        return {
          success: false,
          error: `Failed to sync ${dbName}`,
        };
      }
    }

    // Upload icons to Supabase Storage for assets
    if (tableName === 'finances_assets') {
      console.log(`Processing ${entriesToUpsert.length} assets for icon upload`);
      let uploadedCount = 0;
      for (const assetItem of entriesToUpsert) {
        if (assetItem._iconUrl) {
          console.log(`Uploading icon for asset ${assetItem.name}: ${assetItem._iconUrl}`);
          // Get the asset ID from the database
          const { data: existingAsset } = await supabase
            .from('finances_assets')
            .select('id, updated_at')
            .eq('user_id', userId)
            .eq('notion_page_id', assetItem.notion_page_id)
            .single();

          if (existingAsset?.id) {
            const storageUrl = await uploadIconToStorage(
              assetItem._iconUrl,
              userId,
              existingAsset.id,
              existingAsset.updated_at
            );

            if (storageUrl) {
              console.log(`Successfully uploaded icon for ${assetItem.name}, storage URL: ${storageUrl}`);
              // Update with Supabase Storage URL
              const { error: updateError } = await supabase
                .from('finances_assets')
                .update({ icon_url: storageUrl })
                .eq('id', existingAsset.id);
              
              if (updateError) {
                console.error(`Error updating icon_url for ${assetItem.name}:`, updateError);
              } else {
                uploadedCount++;
              }
            } else {
              console.warn(`Failed to upload icon for ${assetItem.name}`);
            }
          } else {
            console.warn(`Asset not found for icon upload: ${assetItem.name} (page_id: ${assetItem.notion_page_id})`);
          }
        } else {
          console.log(`No icon URL found for asset ${assetItem.name}`);
        }
      }
      console.log(`Icon upload complete: ${uploadedCount}/${entriesToUpsert.length} assets`);
    }

    // Upload icons to Supabase Storage for places
    if (tableName === 'finances_places') {
      console.log(`\n=== PLACES ICON UPLOAD ===`);
      console.log(`Processing ${entriesToUpsert.length} places for icon upload`);
      let uploadedCount = 0;
      let placesWithIcons = 0;
      for (const placeItem of entriesToUpsert) {
        console.log(`Checking place "${placeItem.name}": has _iconUrl: ${!!placeItem._iconUrl}`);
        if (placeItem._iconUrl) {
          placesWithIcons++;
          console.log(`Uploading icon for place "${placeItem.name}": ${placeItem._iconUrl}`);
          // Get the place ID from the database
          const { data: existingPlace, error: lookupError } = await supabase
            .from('finances_places')
            .select('id, notion_page_id, updated_at')
            .eq('user_id', userId)
            .eq('notion_page_id', placeItem.notion_page_id)
            .single();

          if (lookupError) {
            console.error(`Error looking up place "${placeItem.name}":`, lookupError);
          }

          if (existingPlace?.id) {
            console.log(`Found place in DB: ${existingPlace.id} (page_id: ${existingPlace.notion_page_id})`);
            const storageUrl = await uploadPlaceIconToStorage(
              placeItem._iconUrl,
              userId,
              existingPlace.id,
              existingPlace.updated_at
            );

            if (storageUrl) {
              console.log(`✓ Successfully uploaded icon for "${placeItem.name}", storage URL: ${storageUrl}`);
              // Update with Supabase Storage URL
              const { error: updateError } = await supabase
                .from('finances_places')
                .update({ icon_url: storageUrl })
                .eq('id', existingPlace.id);
              
              if (updateError) {
                console.error(`✗ Error updating icon_url for "${placeItem.name}":`, updateError);
              } else {
                uploadedCount++;
                console.log(`✓ Updated icon_url for "${placeItem.name}"`);
              }
            } else {
              console.warn(`✗ Failed to upload icon for "${placeItem.name}"`);
            }
          } else {
            console.warn(`✗ Place not found for icon upload: "${placeItem.name}" (page_id: ${placeItem.notion_page_id})`);
            // Debug: list all places
            const { data: allPlaces } = await supabase
              .from('finances_places')
              .select('id, name, notion_page_id')
              .eq('user_id', userId);
            console.log(`Available places in DB:`, allPlaces);
          }
        } else {
          console.log(`No icon URL found for place "${placeItem.name}"`);
        }
      }
      console.log(`Icon upload summary: ${uploadedCount}/${placesWithIcons} places with icons uploaded successfully (out of ${entriesToUpsert.length} total places)`);
      console.log(`=== END PLACES ICON UPLOAD ===\n`);
    }

    // Delete removed entries
    if (removed.length > 0) {
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('user_id', userId)
        .eq('notion_database_id', databaseId)
        .in('notion_page_id', removed);

      if (deleteError) {
        console.error(`Error deleting removed ${dbName}:`, deleteError);
        // Don't fail the whole sync if deletion fails
      }
    }

    return {
      success: true,
      added: added.length,
      removed: removed.length,
      total: entriesToUpsert.length,
    };
  } catch (error: any) {
    console.error(`Error syncing ${dbName}:`, error);
    return {
      success: false,
      error: error.message || `Failed to sync ${dbName}`,
    };
  }
}

// Helper function to retry database lookups with exponential backoff
async function retryLookup<T>(
  lookupFn: () => Promise<{ data: T | null; error: any }>,
  maxRetries: number = 3,
  initialDelay: number = 100
): Promise<{ data: T | null; error: any }> {
  let lastError: any = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await lookupFn();
    
    if (result.data || !result.error) {
      return result;
    }
    
    lastError = result.error;
    
    // If this isn't the last attempt, wait before retrying
    if (attempt < maxRetries - 1) {
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return { data: null, error: lastError };
}

export async function POST(request: NextRequest) {
  try {
    const internalSecret = request.headers.get('x-internal-sync');
    const syncSecret = process.env.NOTION_WEBHOOK_SECRET || process.env.INTERNAL_SYNC_SECRET;
    let userId: string | null = null;
    let bodyDbType: 'finances_assets' | 'finances_places' | 'finances_investments' | undefined;
    if (secureCompareSecrets(internalSecret, syncSecret)) {
      const body = await request.json().catch(() => ({}));
      userId = body?.userId ?? null;
      const t = body?.dbType;
      if (t === 'finances_assets' || t === 'finances_places' || t === 'finances_investments') {
        bodyDbType = t;
      }
    }
    if (!userId) {
      const authResult = await auth();
      userId = authResult.userId;
    }
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserExists(supabase, userId);

    // Get database IDs from user's connected databases
    const dbIds = await getFinancesDatabaseIds(userId);

    if (bodyDbType) {
      // Webhook dispatch: sync only the triggered finance type
      const config = {
        finances_assets: { id: dbIds.assets, table: 'finances_assets' as const, label: 'Assets' },
        finances_places: { id: dbIds.places, table: 'finances_places' as const, label: 'Places' },
        finances_investments: {
          id: dbIds.investments,
          table: 'finances_individual_investments' as const,
          label: 'Individual Investments',
        },
      }[bodyDbType];
      if (!config.id) {
        return NextResponse.json(
          { error: `Finances database (${bodyDbType}) not connected. Please connect it first.` },
          { status: 400 }
        );
      }
      const result = await syncDatabase(userId, config.id, config.table, config.label);
      return NextResponse.json({
        success: true,
        results: { [bodyDbType]: result },
      });
    }

    // No dbType: full sync (e.g. manual or legacy call) — require all three
    if (!dbIds.assets || !dbIds.investments || !dbIds.places) {
      return NextResponse.json(
        { error: 'Finances databases not connected. Please connect them first.' },
        { status: 400 }
      );
    }

    // Sync in order: Assets first, then Places (so investments can reference them), then Investments
    // The syncDatabase calls are awaited sequentially, and retry logic inside syncDatabase handles replication lag
    const assetsResult = await syncDatabase(userId, dbIds.assets, 'finances_assets', 'Assets');

    const placesResult = await syncDatabase(userId, dbIds.places, 'finances_places', 'Places');

    const investmentsResult = await syncDatabase(
      userId,
      dbIds.investments,
      'finances_individual_investments',
      'Individual Investments'
    );

    return NextResponse.json({
      success: true,
      results: {
        assets: assetsResult,
        individual_investments: investmentsResult,
        places: placesResult,
      },
    });
  } catch (error: any) {
    console.error('Error in finances sync:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync finances' },
      { status: 500 }
    );
  }
}

