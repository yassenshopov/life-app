import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { habitId, color } = await request.json();

    if (!habitId || !color) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await notion.pages.update({
      page_id: habitId,
      properties: {
        'Color Code': {
          rich_text: [
            {
              text: {
                content: color,
              },
            },
          ],
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating habit color:', error);
    return NextResponse.json(
      { error: 'Failed to update habit color' },
      { status: 500 }
    );
  }
} 