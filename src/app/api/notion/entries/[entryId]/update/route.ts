import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  try {
    // Validate required environment variables
    if (!process.env.NOTION_API_KEY) {
      console.error('Missing required environment variable: NOTION_API_KEY');
      return NextResponse.json(
        { error: 'Server configuration error: Missing Notion API key' },
        { status: 500 }
      );
    }

    // Normalize ALLOWED_DATABASE_IDS
    const allowedDatabaseIds = process.env.ALLOWED_DATABASE_IDS
      ? process.env.ALLOWED_DATABASE_IDS.split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : [];

    // Initialize Notion client after validation
    const notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entryId } = await params;

    if (!entryId) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    // CSRF Protection: Check Origin header against allowlist
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const currentHost = request.headers.get('host');

    // Normalize ALLOWED_ORIGINS
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      : [];

    const requestOrigin = origin || referer;
    if (requestOrigin && allowedOrigins.length > 0) {
      try {
        // Parse the request origin to get the actual origin
        const parsedOrigin = new URL(requestOrigin);
        const requestOriginValue = parsedOrigin.origin;

        // Create current host origin for comparison
        const currentHostOrigin = currentHost ? `https://${currentHost}` : null;

        // Check for exact match against allowed origins or current host
        const isAllowedOrigin = allowedOrigins.some((allowedOrigin) => {
          const trimmedAllowedOrigin = allowedOrigin.trim();
          return (
            requestOriginValue === trimmedAllowedOrigin ||
            (currentHostOrigin && requestOriginValue === currentHostOrigin)
          );
        });

        if (!isAllowedOrigin) {
          return NextResponse.json({ error: 'Forbidden: Invalid origin' }, { status: 403 });
        }
      } catch (urlError) {
        // If URL parsing fails, reject the request
        return NextResponse.json({ error: 'Forbidden: Invalid origin' }, { status: 403 });
      }
    }

    // Resource-level Authorization: Verify user has access to the entry
    let page;
    try {
      page = await notion.pages.retrieve({ page_id: entryId });
    } catch (retrieveError) {
      return NextResponse.json(
        { error: 'Forbidden: Entry not found or not accessible' },
        { status: 403 }
      );
    }

    // Check if the page belongs to an allowed database

    if ((page as any).parent && (page as any).parent.type === 'database_id') {
      const databaseId = (page as any).parent.database_id;

      // Check against allowed database IDs
      if (allowedDatabaseIds.length > 0 && !allowedDatabaseIds.includes(databaseId)) {
        return NextResponse.json({ error: 'Forbidden: Database not authorized' }, { status: 403 });
      }

      // Additional check: Verify the database exists and is accessible
      try {
        await notion.databases.retrieve({ database_id: databaseId });
      } catch (dbError) {
        return NextResponse.json({ error: 'Forbidden: Database not accessible' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'Forbidden: Invalid resource type' }, { status: 403 });
    }

    // Optional: Check for owner/relation property if it exists
    // This would require knowing the property name that contains the owner
    const ownerPropertyName = process.env.OWNER_PROPERTY_NAME; // e.g., 'Owner', 'Assigned To'
    if (ownerPropertyName && (page as any).properties[ownerPropertyName]) {
      const ownerProperty = (page as any).properties[ownerPropertyName];
      if (ownerProperty.type === 'people' && ownerProperty.people) {
        const ownerIds = ownerProperty.people.map((person: any) => person.id);
        if (!ownerIds.includes(userId)) {
          return NextResponse.json(
            { error: 'Forbidden: Not the owner of this entry' },
            { status: 403 }
          );
        }
      }
    }

    const body = await request.json();
    const { properties } = body;

    if (!properties) {
      return NextResponse.json({ error: 'Properties are required' }, { status: 400 });
    }

    // Update the page in Notion
    const updatedPage = await notion.pages.update({
      page_id: entryId,
      properties,
    });

    return NextResponse.json({ success: true, page: updatedPage });
  } catch (error) {
    console.error('Error updating entry:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update entry' },
      { status: 500 }
    );
  }
}
