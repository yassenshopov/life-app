import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { name, status, colorCode } = await request.json();
    const databaseId = process.env.NOTION_HABITS_DB_ID;

    if (!databaseId) {
      console.error('Database ID is undefined');
      return NextResponse.json(
        { error: 'Database ID is not configured' },
        { status: 500 }
      );
    }

    console.log('Creating habit with database ID:', databaseId);

    // Create the habit in Notion
    const response = await notion.pages.create({
      parent: {
        database_id: databaseId
      },
      properties: {
        Name: {
          title: [
            {
              text: {
                content: name,
              },
            },
          ],
        },
        Status: {
          status: {
            name: status,
          },
        },
        "Color Code": {
          rich_text: [
            {
              text: {
                content: colorCode,
              },
            },
          ],
        },
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error creating habit:', error);
    return NextResponse.json(
      { error: 'Failed to create habit' },
      { status: 500 }
    );
  }
} 