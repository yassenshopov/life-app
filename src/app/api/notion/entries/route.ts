import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

interface NotionData {
  id: string;
  properties: {
    [key: string]: {
      number?: number;
      date?: { start: string };
    };
  };
}

export async function GET(request: Request) {
  console.log('GET request received'); // Debug log at the very start
  try {
    const { searchParams } = new URL(request.url);
    
    // Get the database ID from the query params
    const databaseId = searchParams.get('databaseId');
    
    // Get the full ISO string for the dates
    const endDate = searchParams.get('endDate') 
      ? new Date(searchParams.get('endDate')!).toISOString()
      : new Date().toISOString();
      
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    console.log('Fetching entries with params:', { databaseId, startDate, endDate }); // Debug log

    if (!databaseId) {
      return NextResponse.json(
        { error: 'Database ID is required' },
        { status: 400 }
      );
    }

    let allResults: NotionData[] = [];
    let hasMore = true;
    let nextCursor: string | undefined = undefined;

    // Keep fetching pages while there are more results
    while (hasMore) {
      console.log('Making Notion API request with cursor:', nextCursor); // Debug log
      
      const response = await notion.databases.query({
        database_id: databaseId,
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
        page_size: 100,
      });

      allResults = [...allResults, ...(response.results as NotionData[])];
      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;
    }

    console.log(`Found ${allResults.length} entries`); // Debug log

    const entries = allResults.map((page: NotionData) => {
      const sleepH = page.properties.GoneToSleepH?.number || 0;
      const sleepM = page.properties.GoneToSleepM?.number || 0;
      const wakeH = page.properties.AwokeH?.number || 0;
      const wakeM = page.properties.AwokeM?.number || 0;

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
    console.error('Error in GET handler:', error);
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
      databaseId,
    } = body;

    if (!databaseId) {
      return NextResponse.json(
        { error: 'Database ID is required' },
        { status: 400 }
      );
    }

    const properties = {
      GoneToSleepH: {
        number: GoneToSleepH == 0 ? 12 : GoneToSleepH,
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
      database_id: databaseId,
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
      parent: { database_id: databaseId },
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
