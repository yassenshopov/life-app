import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

type NotionResponse = {
  properties: {
    [key: string]: {
      type: string;
      [key: string]: unknown;
    };
  };
  id: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString();
    const endDate = searchParams.get('endDate') || new Date().toISOString();

    let allResults: any[] = [];
    let hasMore = true;
    let nextCursor: string | undefined = undefined;

    // Keep fetching pages while there are more results
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID!,
        filter: {
          and: [
            {
              property: 'Date',
              date: {
                on_or_after: startDate,
              },
            },
            {
              property: 'Date',
              date: {
                on_or_before: endDate,
              },
            },
          ],
        },
        sorts: [
          {
            property: 'Date',
            direction: 'descending',
          },
        ],
        start_cursor: nextCursor,
        page_size: 100, // Maximum allowed by Notion
      });

      allResults = [...allResults, ...response.results];
      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;
    }

    const entries = allResults.map((page: any) => {
      const sleepH = parseInt(page.properties.GoneToSleepH?.number || 0);
      const sleepM = parseInt(page.properties.GoneToSleepM?.number || 0);
      const wakeH = parseInt(page.properties.AwokeH?.number || 0);
      const wakeM = parseInt(page.properties.AwokeM?.number || 0);

      // Convert to minutes since midnight for calculations
      const sleepTimeInMinutes = sleepH * 60 + sleepM;
      const wakeTimeInMinutes = wakeH * 60 + wakeM;

      // Calculate total sleep time in minutes
      let totalSleepMinutes;
      if (wakeTimeInMinutes >= sleepTimeInMinutes) {
        totalSleepMinutes = wakeTimeInMinutes - sleepTimeInMinutes - 12 * 60;
      } else {
        totalSleepMinutes =
          24 * 60 - sleepTimeInMinutes + wakeTimeInMinutes - 12 * 60;
      }

      // Format display times in 24h format
      const formatTime = (h: number, m: number) => {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      return {
        id: page.id,
        date: page.properties.Date?.date?.start,
        sleepTime:
          sleepH || sleepM
            ? formatTime(
                sleepH + 12 > 24 ? sleepH + 12 - 24 : sleepH + 12,
                sleepM
              )
            : '--:--',
        wakeTime: wakeH || wakeM ? formatTime(wakeH, wakeM) : '--:--',
        totalSleepHours:
          totalSleepMinutes > 0 ? Math.floor(totalSleepMinutes / 60) : 0,
        totalSleepMinutes: totalSleepMinutes > 0 ? totalSleepMinutes % 60 : 0,
        deepSleepPercentage: Math.max(
          0,
          (page.properties['Deep Sleep %']?.number || 0) * 100
        ),
        remSleepPercentage: Math.max(
          0,
          (page.properties['REM Sleep %']?.number || 0) * 100
        ),
        awakeTimeMinutes: Math.max(
          0,
          page.properties['AwakeTime [min]']?.number || 0
        ),
        restingHeartRate: page.properties['RHR [bpm]']?.number || null,
        steps: page.properties['Steps']?.number || null,
        weight: page.properties['Weight [kg]']?.number || null,
      };
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Failed to fetch Notion data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      date,
      GoneToSleepH,
      GoneToSleepM,
      AwokeH,
      AwokeM,
      deepSleepPercentage,
      remSleepPercentage,
      pageId,
      awakeTimeMinutes,
      restingHeartRate,
      steps,
      weight,
    } = body;

    const properties = {
      GoneToSleepH: {
        number: GoneToSleepH + 12,
      },
      GoneToSleepM: {
        number: GoneToSleepM,
      },
      AwokeH: {
        number: AwokeH,
      },
      AwokeM: {
        number: AwokeM,
      },
      'Deep Sleep %': {
        number: deepSleepPercentage / 100,
      },
      'REM Sleep %': {
        number: remSleepPercentage / 100,
      },
      'AwakeTime [min]': {
        number: awakeTimeMinutes || 0,
      },
      'RHR [bpm]': {
        number: restingHeartRate || null,
      },
      Steps: {
        number: steps || null,
      },
      'Weight [kg]': {
        number: weight || null,
      },
    };

    // If pageId is provided, update existing entry
    if (pageId) {
      const response = await notion.pages.update({
        page_id: pageId,
        properties: properties,
      });
      return NextResponse.json(response);
    }

    // Check for existing entry with today's date
    const today = new Date().toISOString().split('T')[0];
    const existingEntries = await notion.databases.query({
      database_id: DATABASE_ID!,
      filter: {
        property: 'Date',
        date: {
          equals: today,
        },
      },
    });

    if (existingEntries.results.length > 0) {
      // Update existing entry
      const existingPageId = existingEntries.results[0].id;
      const response = await notion.pages.update({
        page_id: existingPageId,
        properties: properties,
      });
      return NextResponse.json(response);
    }

    // If no existing entry found, create new one
    const response = await notion.pages.create({
      parent: { database_id: DATABASE_ID! },
      properties: properties,
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to update Notion entry:', error);
    return NextResponse.json(
      { error: 'Failed to update entry' },
      { status: 500 }
    );
  }
}
