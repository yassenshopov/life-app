import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export async function PATCH(request: NextRequest, { params }: { params: { entryId: string } }) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entryId } = params;
    const body = await request.json();
    const { properties } = body;

    if (!entryId) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

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
