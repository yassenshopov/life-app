import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const supabase = getSupabaseServiceRoleClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startCursor = searchParams.get('start_cursor') || undefined;

    // Remove auth for public route, or keep if you want to check user
    // const { userId } = await auth();
    // if (!userId) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // For demo, just use the first user (or add your user logic)
    const { data, error } = await supabase
      .from('users')
      .select('notion_databases')
      .limit(1)
      .single();

    if (error || !data?.notion_databases) {
      return NextResponse.json({ error: 'Notion database not configured' }, { status: 400 });
    }

    const notionDatabases = Array.isArray(data.notion_databases)
      ? data.notion_databases
      : JSON.parse(data.notion_databases);

    const dailyTrackingDb = notionDatabases.find(
      (db: any) => db.database_name === 'Daily Tracking'
    );

    const dailyTrackingDbId = dailyTrackingDb?.database_id;
    if (!dailyTrackingDbId) {
      return NextResponse.json({ error: 'Daily Tracking DB ID not found' }, { status: 400 });
    }

    // Fetch a single page of results
    const response = await notion.databases.query({
      database_id: dailyTrackingDbId,
      sorts: [
        {
          property: 'Date',
          direction: 'descending',
        },
      ],
      filter: {
        and: [
          {
            property: 'Date',
            date: {
              on_or_after: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0],
            },
          },
          {
            property: 'Date',
            date: {
              on_or_before: new Date().toISOString().split('T')[0],
            },
          },
        ],
      },
      start_cursor: startCursor,
      page_size: 100,
    });

    // Map Notion properties to frontend format
    const entries = response.results
      .filter((page) => 'properties' in page)
      .map((page: any) => {
        const props = page.properties;
        return {
          id: page.id,
          date: props.Date?.date?.start || null,
          sleep: props['Sleep [h]']?.formula?.number ?? null,
          rhr: props['RHR [bpm]']?.number ?? null,
          steps: props['Steps']?.number ?? null,
          weight: props['Weight [kg]']?.number ?? null,
          habitsPie: props['Habits Pie']?.formula?.number ?? null,
          symptoms: props['Symptoms']?.multi_select?.map((s: any) => s.name) ?? [],
          deepSleepPercent:
            typeof props['Deep Sleep %']?.number === 'number'
              ? props['Deep Sleep %'].number
              : typeof props['Deep Sleep %']?.formula?.number === 'number'
              ? props['Deep Sleep %'].formula.number
              : null,
          remSleepPercent:
            typeof props['REM Sleep %']?.number === 'number'
              ? props['REM Sleep %'].number
              : typeof props['REM Sleep %']?.formula?.number === 'number'
              ? props['REM Sleep %'].formula.number
              : null,
          goneToSleepH: props['GoneToSleepH']?.number ?? null,
          goneToSleepM: props['GoneToSleepM']?.number ?? null,
          awokeH: props['AwokeH']?.number ?? null,
          awokeM: props['AwokeM']?.number ?? null,
          awakeTime: props['AwakeTime [min]']?.number ?? null,
          deepSleep: props['Deep Sleep [h]']?.number ?? null,
          remSleep: props['REM Sleep [h]']?.number ?? null,
          sleepRange: props['Sleep range']?.rich_text?.[0]?.plain_text ?? null,
          bfPercent:
            typeof props['BF%']?.number === 'number'
              ? props['BF%'].number
              : typeof props['BF%']?.formula?.number === 'number'
              ? props['BF%'].formula.number
              : null,
          boneMineralPercent:
            typeof props['Bone Mineral %']?.number === 'number'
              ? props['Bone Mineral %'].number
              : typeof props['Bone Mineral %']?.formula?.number === 'number'
              ? props['Bone Mineral %'].formula.number
              : null,
          musclePercent:
            typeof props['Muscle %']?.number === 'number'
              ? props['Muscle %'].number
              : typeof props['Muscle %']?.formula?.number === 'number'
              ? props['Muscle %'].formula.number
              : null,
        };
      });

    return NextResponse.json({
      entries,
      next_cursor: response.next_cursor ?? null,
      has_more: response.has_more,
    });
  } catch (error) {
    console.error('Error fetching daily tracking:', error);
    return NextResponse.json({ error: 'Failed to fetch daily tracking' }, { status: 500 });
  }
}
