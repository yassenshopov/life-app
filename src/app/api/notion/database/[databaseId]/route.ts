import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';

// Type guards for database object properties
function hasIcon(obj: any): obj is { icon: any } {
  return obj && typeof obj === 'object' && 'icon' in obj;
}

function hasCover(obj: any): obj is { cover: any } {
  return obj && typeof obj === 'object' && 'cover' in obj;
}

function hasDescription(obj: any): obj is { description: any[] } {
  return obj && typeof obj === 'object' && 'description' in obj && Array.isArray(obj.description);
}

function hasCreatedTime(obj: any): obj is { created_time: string } {
  return (
    obj && typeof obj === 'object' && 'created_time' in obj && typeof obj.created_time === 'string'
  );
}

function hasLastEditedTime(obj: any): obj is { last_edited_time: string } {
  return (
    obj &&
    typeof obj === 'object' &&
    'last_edited_time' in obj &&
    typeof obj.last_edited_time === 'string'
  );
}

function hasCreatedBy(obj: any): obj is { created_by: any } {
  return obj && typeof obj === 'object' && 'created_by' in obj;
}

function hasLastEditedBy(obj: any): obj is { last_edited_by: any } {
  return obj && typeof obj === 'object' && 'last_edited_by' in obj;
}

interface NotionDatabaseProperties {
  title: string;
  properties: Record<
    string,
    {
      type: string;
      name: string;
    }
  >;
  icon?: any;
  cover?: any;
  description?: any[];
  created_time?: string;
  last_edited_time?: string;
  created_by?: any;
  last_edited_by?: any;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    const { databaseId } = await params;
    if (!databaseId) {
      return NextResponse.json({ error: 'Database ID is required' }, { status: 400 });
    }

    try {
      const database = await notion.databases.retrieve({
        database_id: databaseId,
      });

      // Get the database title from the first title property
      const titleProperty = Object.entries(database.properties).find(
        ([_, prop]) => prop.type === 'title'
      );
      const title = titleProperty
        ? database.properties[titleProperty[0]].name
        : 'Untitled Database';

      const response: NotionDatabaseProperties = {
        title,
        properties: database.properties,
        icon: hasIcon(database) ? database.icon : undefined,
        cover: hasCover(database) ? database.cover : undefined,
        description: hasDescription(database) ? database.description : undefined,
        created_time: hasCreatedTime(database) ? database.created_time : undefined,
        last_edited_time: hasLastEditedTime(database) ? database.last_edited_time : undefined,
        created_by: hasCreatedBy(database) ? database.created_by : undefined,
        last_edited_by: hasLastEditedBy(database) ? database.last_edited_by : undefined,
      };

      return NextResponse.json(response, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200', // 1 hour cache, 2 hours stale
          'CDN-Cache-Control': 'public, s-maxage=3600',
        },
      });
    } catch (notionError: any) {
      console.error('Notion API error:', notionError);
      if (notionError.code === 'object_not_found') {
        return NextResponse.json({ error: 'Database not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch database properties' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in GET /api/notion/database/[databaseId]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
