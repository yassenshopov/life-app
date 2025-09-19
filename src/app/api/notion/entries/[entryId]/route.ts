import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export async function DELETE(request: NextRequest, { params }: { params: { entryId: string } }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entryId } = params;

    if (!entryId) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    // CSRF Protection: Check Origin header for browser requests
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    if (origin && host && !origin.includes(host)) {
      return NextResponse.json({ error: 'Forbidden: Invalid origin' }, { status: 403 });
    }

    // Resource-level Authorization: Verify user has access to the entry
    try {
      const page = await notion.pages.retrieve({ page_id: entryId });

      // Check if the page belongs to a database the user has access to
      // This is a basic check - in a production app, you'd want to verify
      // the user has specific permissions on the parent database
      if (!page.parent || page.parent.type !== 'database_id') {
        return NextResponse.json({ error: 'Forbidden: Invalid resource' }, { status: 403 });
      }

      // Additional check: Verify the database exists and is accessible
      try {
        await notion.databases.retrieve({ database_id: page.parent.database_id });
      } catch (dbError) {
        return NextResponse.json({ error: 'Forbidden: Database not accessible' }, { status: 403 });
      }
    } catch (retrieveError) {
      return NextResponse.json(
        { error: 'Forbidden: Entry not found or not accessible' },
        { status: 403 }
      );
    }

    // Archive the page in Notion (soft delete)
    await notion.pages.update({
      page_id: entryId,
      archived: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting entry:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete entry' },
      { status: 500 }
    );
  }
}
