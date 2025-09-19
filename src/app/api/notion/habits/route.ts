import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface HabitResponse {
  id: string;
  name: string;
  status: string;
  colorCode: string;
  days: { id: string; date: string }[];
}

type Relation = { id: string };

export async function GET() {
  try {
    const habitsDbId = process.env.NOTION_HABITS_DB_ID;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's Notion database ID
    const { data, error } = await supabase
      .from('notion_credentials')
      .select('notion_database_daily_tracking_id')
      .eq('user_id', userId)
      .single();

    if (error || !data?.notion_database_daily_tracking_id) {
      return NextResponse.json({ error: 'Notion database not configured' }, { status: 400 });
    }

    const dailyTrackingDbId = data.notion_database_daily_tracking_id;

    if (!habitsDbId || !dailyTrackingDbId) {
      return NextResponse.json({ error: 'Database IDs are required' }, { status: 400 });
    }

    // Fetch all habits with pagination
    let allHabitResults: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const habitsResponse = await notion.databases.query({
        database_id: habitsDbId,
        sorts: [
          {
            property: 'Status',
            direction: 'ascending',
          },
        ],
        start_cursor: startCursor,
        page_size: 100,
      });

      allHabitResults = [...allHabitResults, ...habitsResponse.results];
      hasMore = habitsResponse.has_more;
      startCursor = habitsResponse.next_cursor || undefined;
    }

    // Process habits and their related days
    const habits = await Promise.all(
      allHabitResults.map(async (habit: any) => {
        const daysRelation = habit.properties.Days?.relation || [];

        // Fetch related days if there are any
        const daysDetails =
          daysRelation.length > 0
            ? await Promise.all(
                daysRelation.map(async (relation: { id: string }) => {
                  const pageResponse = await notion.pages.retrieve({
                    page_id: relation.id,
                  });
                  const date = (pageResponse as any).properties.Date?.date?.start;

                  // Convert the date to user's local timezone
                  const localDate = new Date(date);
                  const userTimezoneDate = new Date(
                    localDate.getTime() - localDate.getTimezoneOffset() * 60000
                  );
                  return {
                    id: relation.id,
                    date: userTimezoneDate.toISOString().split('T')[0],
                  };
                })
              )
            : [];

        return {
          id: habit.id,
          name: habit.properties.Name?.title[0]?.plain_text || 'Unnamed Habit',
          status: habit.properties.Status?.status?.name || 'Unplanned',
          colorCode: habit.properties['Color Code']?.rich_text[0]?.plain_text || '#22c55e', // Default to green if no color specified
          days: daysDetails,
        };
      })
    );

    return NextResponse.json(habits);
  } catch (error) {
    console.error('Error fetching habits:', error);
    return NextResponse.json({ error: 'Failed to fetch habits' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  console.log('POST request received for habit toggle');
  try {
    const { habitId, date, completed } = await request.json();
    console.log('Request params:', { habitId, date, completed });

    const { userId } = await auth();

    if (!userId) {
      console.error('No user ID found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('notion_credentials')
      .select('notion_database_daily_tracking_id')
      .eq('user_id', userId)
      .single();

    if (error || !data?.notion_database_daily_tracking_id) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Notion database not configured' }, { status: 400 });
    }

    const dailyTrackingDbId = data.notion_database_daily_tracking_id;
    console.log('Found dailyTrackingDbId:', dailyTrackingDbId);

    if (!habitId || !date || !dailyTrackingDbId) {
      console.error('Missing required fields:', { habitId, date, dailyTrackingDbId });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Find or create the daily entry
    console.log('Querying for existing entry with date:', date);
    const existingEntries = await notion.databases.query({
      database_id: dailyTrackingDbId,
      filter: {
        property: 'Date',
        date: {
          equals: date,
        },
      },
    });

    let dayPageId;
    if (existingEntries.results.length > 0) {
      dayPageId = existingEntries.results[0].id;
      console.log('Found existing entry:', dayPageId);
    } else {
      console.log('Creating new day entry for date:', date);
      const newDayPage = await notion.pages.create({
        parent: { database_id: dailyTrackingDbId },
        properties: {
          Date: {
            date: {
              start: date,
            },
          },
        },
      });
      dayPageId = newDayPage.id;
      console.log('Created new entry:', dayPageId);
    }

    // Get current relations
    console.log('Fetching current habit relations');
    const habitPage = await notion.pages.retrieve({ page_id: habitId });
    const currentRelations = (habitPage as any).properties.Days?.relation || [];
    console.log('Current relations structure:', JSON.stringify(currentRelations, null, 2));

    // Create new relation array based on completed status
    const newRelations = !completed
      ? currentRelations.filter((rel: Relation) => rel.id !== dayPageId) // Remove if uncompleting
      : [...currentRelations, { id: dayPageId }]; // Add if completing

    console.log('dayPageId to add/remove:', dayPageId);
    console.log('New relations structure:', JSON.stringify(newRelations, null, 2));

    // Update the habit
    try {
      const updateResponse = await notion.pages.update({
        page_id: habitId,
        properties: {
          Days: {
            relation: newRelations,
          },
        },
      });
      console.log('Notion update response:', JSON.stringify(updateResponse, null, 2));
    } catch (error) {
      console.error('Notion update error:', error);
      throw error;
    }

    console.log('Successfully updated habit');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating habit:', error);
    return NextResponse.json({ error: 'Failed to update habit' }, { status: 500 });
  }
}
