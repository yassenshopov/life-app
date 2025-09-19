import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';

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
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    const { databaseId } = await params;
    if (!databaseId) {
      return new NextResponse('Database ID is required', { status: 400 });
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
        icon: (database as any).icon,
        cover: (database as any).cover,
        description: (database as any).description,
        created_time: (database as any).created_time,
        last_edited_time: (database as any).last_edited_time,
        created_by: (database as any).created_by,
        last_edited_by: (database as any).last_edited_by,
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
        return new NextResponse('Database not found', { status: 404 });
      }
      return new NextResponse('Failed to fetch database properties', { status: 500 });
    }
  } catch (error) {
    console.error('Error in GET /api/notion/database/[databaseId]:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
