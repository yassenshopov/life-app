import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export async function POST(request: Request) {
  console.log('POST request received for status update');
  try {
    const { habitId, status } = await request.json();
    console.log('Request params:', { habitId, status });

    if (!habitId || !status) {
      console.error('Missing required fields:', { habitId, status });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Updating habit status in Notion');
    const response = await notion.pages.update({
      page_id: habitId,
      properties: {
        Status: {
          status: {
            name: status
          }
        }
      }
    });
    console.log('Notion response:', response);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating habit status:', error);
    return NextResponse.json(
      { error: 'Failed to update status', details: error },
      { status: 500 }
    );
  }
} 