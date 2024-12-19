import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString();
    const endDate = searchParams.get('endDate') || new Date().toISOString();

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
    });

    const entries = response.results.map((page: any) => {
      let sleepH = page.properties.GoneToSleepH?.number || 0;
      let sleepM = page.properties.GoneToSleepM?.number || 0;
      let wakeH = page.properties.AwokeH?.number || 0;
      let wakeM = page.properties.AwokeM?.number || 0;

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
    } = body;

    // If pageId is provided, update existing entry
    if (pageId) {
      const response = await notion.pages.update({
        page_id: pageId,
        properties: {
          GoneToSleepH: {
            type: 'number',
            number: GoneToSleepH + 12,
          },
          GoneToSleepM: {
            type: 'number',
            number: GoneToSleepM,
          },
          AwokeH: {
            type: 'number',
            number: AwokeH,
          },
          AwokeM: {
            type: 'number',
            number: AwokeM,
          },
          'Deep Sleep %': {
            type: 'number',
            number: deepSleepPercentage / 100,
          },
          'REM Sleep %': {
            type: 'number',
            number: remSleepPercentage / 100,
          },
          'AwakeTime [min]': {
            type: 'number',
            number: awakeTimeMinutes || 0,
          },
        },
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
        properties: {
          GoneToSleepH: { type: 'number', number: GoneToSleepH + 12 },
          GoneToSleepM: { type: 'number', number: GoneToSleepM },
          AwokeH: { type: 'number', number: AwokeH },
          AwokeM: { type: 'number', number: AwokeM },
          'Deep Sleep %': { type: 'number', number: deepSleepPercentage / 100 },
          'REM Sleep %': { type: 'number', number: remSleepPercentage / 100 },
          'AwakeTime [min]': { type: 'number', number: awakeTimeMinutes || 0 },
        },
      });
      return NextResponse.json(response);
    }

    // If no existing entry found, create new one
    const response = await notion.pages.create({
      parent: { database_id: DATABASE_ID! },
      properties: {
        Date: {
          type: 'date',
          date: { start: date },
        },
        GoneToSleepH: {
          type: 'number',
          number: GoneToSleepH + 12,
        },
        GoneToSleepM: {
          type: 'number',
          number: GoneToSleepM,
        },
        AwokeH: {
          type: 'number',
          number: AwokeH,
        },
        AwokeM: {
          type: 'number',
          number: AwokeM,
        },
        'Deep Sleep %': {
          type: 'number',
          number: deepSleepPercentage / 100,
        },
        'REM Sleep %': {
          type: 'number',
          number: remSleepPercentage / 100,
        },
        'AwakeTime [min]': {
          type: 'number',
          number: awakeTimeMinutes || 0,
        },
      },
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
