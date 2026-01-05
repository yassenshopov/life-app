export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { uploadFileToNotion } from '@/lib/notion-api';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = getSupabaseServiceRoleClient();

// Helper function to upload image to Supabase Storage
async function uploadImageToStorage(
  fileBuffer: ArrayBuffer,
  userId: string,
  personId: string,
  contentType: string
): Promise<string | null> {
  try {
    // Get file extension from content-type
    const extension =
      contentType.includes('jpeg') || contentType.includes('jpg')
        ? 'jpg'
        : contentType.includes('png')
          ? 'png'
          : contentType.includes('gif')
            ? 'gif'
            : contentType.includes('webp')
              ? 'webp'
              : 'jpg';

    const buffer = Buffer.from(fileBuffer);

    // Upload to Supabase Storage
    const fileName = `${userId}/${personId}.${extension}`;
    const { data, error } = await supabase.storage
      .from('people-images')
      .upload(fileName, buffer, {
        contentType: contentType || `image/${extension}`,
        upsert: true, // Overwrite if exists
      });

    if (error) {
      // If bucket doesn't exist, log it but don't fail
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

// Helper function to extract property value
function getPropertyValue(property: any, propertyType: string, propertyName?: string): any {
  if (!property) return null;

  switch (propertyType) {
    case 'title':
      return property.title?.[0]?.plain_text || '';
    case 'rich_text':
      return property.rich_text?.[0]?.plain_text || '';
    case 'select':
      return property.select?.name || null;
    case 'multi_select':
      // For Tier property, return objects with name and color
      if (propertyName === 'Tier') {
        return property.multi_select?.map((item: any) => ({
          name: item.name,
          color: item.color || 'default',
        })) || [];
      }
      // For all other multi_select properties, return just the names
      return property.multi_select?.map((item: any) => item.name) || [];
    case 'date':
      return property.date?.start || null;
    case 'files':
      return property.files || [];
    case 'formula':
      return property.formula;
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const originOfConnection = formData.get('origin_of_connection') as string;
    const starSign = formData.get('star_sign') as string;
    const currentlyAt = formData.get('currently_at') as string;
    const tier = formData.get('tier') as string;
    const occupation = formData.get('occupation') as string;
    const contactFreq = formData.get('contact_freq') as string;
    const fromLocation = formData.get('from_location') as string;
    const birthDate = formData.get('birth_date') as string;
    const imageFile = formData.get('image') as File | null;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get user's databases
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

    // Find People database
    const peopleDb = databases.find((db: any) => {
      const dbName =
        typeof db.database_name === 'string' ? db.database_name : String(db.database_name || '');
      return dbName.toLowerCase().includes('people');
    });

    if (!peopleDb) {
      return NextResponse.json(
        { error: 'People database not connected' },
        { status: 404 }
      );
    }

    const databaseId = peopleDb.database_id;
    const properties = peopleDb.properties || {};

    // Build Notion properties
    const notionProperties: Record<string, any> = {};

    // Find the name property (title)
    const nameProp = Object.entries(properties).find(
      ([_, p]: [string, any]) => p.type === 'title'
    );
    if (nameProp) {
      notionProperties[nameProp[0]] = {
        title: [{ text: { content: name.trim() } }],
      };
    }

    // Handle image upload to Notion first (before other properties)
    if (imageFile) {
      const imageProp = Object.entries(properties).find(
        ([key]) => key === 'Image'
      );
      if (imageProp) {
        const imageBuffer = await imageFile.arrayBuffer();
        const fileUploadId = await uploadFileToNotion(
          imageBuffer,
          imageFile.name,
          imageFile.type
        );

        if (fileUploadId) {
          notionProperties['Image'] = {
            files: [
              {
                type: 'file_upload',
                file_upload: {
                  id: fileUploadId,
                },
              },
            ],
          };
        }
      }
    }

    // Map other properties
    for (const [key, prop] of Object.entries(properties)) {
      const typedProp = prop as any;
      if (typedProp.type === 'title') continue; // Already handled
      if (key === 'Image') continue; // Already handled

      switch (key) {
        case 'Origin of connection':
          if (originOfConnection) {
            const values = originOfConnection.split(',').map((v) => v.trim()).filter(Boolean);
            if (values.length > 0) {
              if (typedProp.type === 'multi_select') {
                notionProperties[key] = {
                  multi_select: values.map((v) => ({ name: v })),
                };
              } else if (typedProp.type === 'select') {
                notionProperties[key] = {
                  select: { name: values[0] },
                };
              }
            }
          }
          break;
        case 'Star sign':
          if (starSign) {
            if (typedProp.type === 'select') {
              notionProperties[key] = {
                select: { name: starSign },
              };
            }
          }
          break;
        case 'Currently at':
          if (currentlyAt) {
            if (typedProp.type === 'rich_text') {
              notionProperties[key] = {
                rich_text: [{ text: { content: currentlyAt } }],
              };
            }
          }
          break;
        case 'Tier':
          if (tier) {
            const tierValues = tier.split(',').map((v) => v.trim()).filter(Boolean);
            if (tierValues.length > 0 && typedProp.type === 'multi_select') {
              notionProperties[key] = {
                multi_select: tierValues.map((v) => ({ name: v })),
              };
            }
          }
          break;
        case 'Occupation':
          if (occupation) {
            if (typedProp.type === 'rich_text') {
              notionProperties[key] = {
                rich_text: [{ text: { content: occupation } }],
              };
            }
          }
          break;
        case 'Contact Freq.':
        case 'Contact Freq':
          if (contactFreq) {
            if (typedProp.type === 'rich_text') {
              notionProperties[key] = {
                rich_text: [{ text: { content: contactFreq } }],
              };
            } else if (typedProp.type === 'select') {
              notionProperties[key] = {
                select: { name: contactFreq },
              };
            }
          }
          break;
        case 'From':
          if (fromLocation) {
            if (typedProp.type === 'rich_text') {
              notionProperties[key] = {
                rich_text: [{ text: { content: fromLocation } }],
              };
            }
          }
          break;
        case 'Birth Date':
        case 'Birth date':
          if (birthDate) {
            if (typedProp.type === 'date') {
              notionProperties[key] = {
                date: { start: birthDate },
              };
            }
          }
          break;
      }
    }

    // Create page in Notion
    const notionPage = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: notionProperties,
    });

    // Fetch the created page to get all properties (including formulas)
    const createdPage = await notion.pages.retrieve({ page_id: notionPage.id });
    const pageProperties = (createdPage as any).properties || {};

    // Map properties to our database schema
    const personData: any = {
      user_id: userId,
      notion_page_id: notionPage.id,
      notion_database_id: databaseId,
      name: name.trim(),
      updated_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    };

    // Extract all properties from the created page
    Object.entries(properties).forEach(([key, prop]: [string, any]) => {
      const propertyValue = pageProperties[key];
      if (!propertyValue) return;

      const value = getPropertyValue(propertyValue, prop.type, key);

      // Map to database column names
      switch (key) {
        case 'Name':
          personData.name = value;
          break;
        case 'Origin of connection':
          personData.origin_of_connection = Array.isArray(value) ? value : [];
          break;
        case 'Star sign':
          personData.star_sign = value;
          break;
        case 'Image':
          personData.image = value;
          break;
        case 'Currently at':
          personData.currently_at = value;
          break;
        case 'Age':
          personData.age = value;
          break;
        case 'Tier':
          personData.tier = Array.isArray(value)
            ? value.map((v: any) => (typeof v === 'string' ? v : v.name))
            : [];
          break;
        case 'Occupation':
          personData.occupation = value;
          break;
        case 'Birthday':
          personData.birthday = value;
          break;
        case 'Contact Freq.':
        case 'Contact Freq':
          personData.contact_freq = value;
          break;
        case 'From':
          personData.from_location = value;
          break;
        case 'Birth Date':
        case 'Birth date':
          personData.birth_date = value;
          break;
        case 'Nicknames':
        case 'Nickname':
          personData.nicknames = Array.isArray(value) ? value : value ? [value] : [];
          break;
      }
    });

    // Insert into Supabase
    const { data: insertedPerson, error: insertError } = await supabase
      .from('people')
      .insert(personData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting person:', insertError);
      return NextResponse.json(
        { error: 'Failed to create person in database' },
        { status: 500 }
      );
    }

    // Upload image to Supabase Storage if provided
    let imageUrl: string | null = null;
    if (imageFile && insertedPerson) {
      const imageBuffer = await imageFile.arrayBuffer();
      imageUrl = await uploadImageToStorage(
        imageBuffer,
        userId,
        insertedPerson.id,
        imageFile.type
      );

      if (imageUrl) {
        // Update person with Supabase Storage URL
        const { error: updateError } = await supabase
          .from('people')
          .update({ image_url: imageUrl })
          .eq('id', insertedPerson.id);

        if (updateError) {
          console.error(
            `Failed to update person with image URL. Person ID: ${insertedPerson.id}, Image URL: ${imageUrl}`,
            updateError
          );

          // Attempt rollback: delete the previously inserted person
          const { error: deleteError } = await supabase
            .from('people')
            .delete()
            .eq('id', insertedPerson.id);

          if (deleteError) {
            console.error(
              `Failed to rollback person creation. Person ID: ${insertedPerson.id}`,
              deleteError
            );
          }

          return NextResponse.json(
            {
              error: 'Failed to save image URL',
              details: {
                personId: insertedPerson.id,
                imageUrl: imageUrl,
                updateError: updateError.message,
              },
            },
            { status: 500 }
          );
        }
      }
    }

    // Return the created person with image_url
    return NextResponse.json({
      success: true,
      person: {
        ...insertedPerson,
        image_url: imageUrl || insertedPerson.image_url,
      },
    });
  } catch (error: any) {
    console.error('Error creating person:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create person' },
      { status: 500 }
    );
  }
}

