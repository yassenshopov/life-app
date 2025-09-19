import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { databaseId } = await params;
    if (!databaseId) {
      return new NextResponse('Database ID is required', { status: 400 });
    }

    const url = new URL(request.url);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
    const startCursor = url.searchParams.get('startCursor');

    try {
      const response = await notion.databases.query({
        database_id: databaseId,
        page_size: Math.min(pageSize, 100), // Notion API limit
        start_cursor: startCursor || undefined,
        // Remove sorts to avoid property-specific errors
        // The database might not have a 'Created' property
      });

      const result = {
        pages: response.results,
        has_more: response.has_more,
        next_cursor: response.next_cursor,
      };

      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5 min cache, 10 min stale
          'CDN-Cache-Control': 'public, s-maxage=300',
        },
      });
    } catch (notionError: any) {
      console.error('Notion API error:', notionError);
      return new NextResponse(
        JSON.stringify({
          message: 'Failed to fetch database pages',
          error: notionError.message,
        }),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET /api/notion/database/[databaseId]/pages:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { databaseId } = await params;
    if (!databaseId) {
      return new NextResponse('Database ID is required', { status: 400 });
    }

    const body = await request.json();
    const { properties } = body;

    if (!properties) {
      return new NextResponse('Properties are required', { status: 400 });
    }

    try {
      const response = await notion.pages.create({
        parent: {
          database_id: databaseId,
        },
        properties: properties,
      });

      return NextResponse.json(response, {
        headers: {
          'Cache-Control': 'no-cache', // Don't cache new entries
        },
      });
    } catch (notionError: any) {
      console.error('Notion API error:', notionError);
      return new NextResponse(
        JSON.stringify({
          message: 'Failed to create page',
          error: notionError.message,
        }),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/notion/database/[databaseId]/pages:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
