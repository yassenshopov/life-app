import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dateFilters = [];
    if (startDate) {
      dateFilters.push({
        property: 'Date',
        date: { on_or_after: startDate }
      });
    }
    if (endDate) {
      dateFilters.push({
        property: 'Date',
        date: { on_or_before: endDate }
      });
    }

    const response = await notion.databases.query({
      database_id: process.env.NOTION_RUNNING_DATABASE_ID!,
      filter: dateFilters.length > 0 ? { and: dateFilters } : undefined,
      sorts: [{ property: 'Date', direction: 'descending' }],
    });

    const runs = response.results.map((page: any) => ({
      id: page.id,
      name: page.properties['Name']?.title[0]?.plain_text || null,
      date: page.properties['Date'].date?.start,
      distance: page.properties['Distance (km)']?.formula?.number || null,
      duration: page.properties['Duration (min)']?.formula?.number || null,
      pace: page.properties['Pace (min/km)']?.formula?.string || null,
      type: page.properties['Type']?.select?.name || null,
      notes: page.properties['Notes']?.rich_text[0]?.plain_text || null,
    }));

    return NextResponse.json(runs);
  } catch (error) {
    console.error('Error fetching running data:', error);
    return NextResponse.json({ error: 'Failed to fetch running data' }, { status: 500 });
  }
} 