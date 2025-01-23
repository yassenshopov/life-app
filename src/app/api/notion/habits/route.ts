import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

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
    const runningDbId = process.env.NOTION_RUNNING_DATABASE_ID;

    if (!habitsDbId || !runningDbId) {
      return NextResponse.json(
        { error: 'Database IDs are required' },
        { status: 400 }
      );
    }

    // Fetch all habits
    const habitsResponse = await notion.databases.query({
      database_id: habitsDbId,
      sorts: [
        {
          property: 'Status',
          direction: 'ascending',
        },
      ],
    });

    // Process habits and their related days
    const habits = await Promise.all(
      habitsResponse.results.map(async (habit: any) => {
        const daysRelation = habit.properties.Days?.relation || [];
        
        // Fetch related days if there are any
        const daysDetails = daysRelation.length > 0
          ? await Promise.all(
              daysRelation.map(async (relation: { id: string }) => {
                const pageResponse = await notion.pages.retrieve({
                  page_id: relation.id,
                });
                return {
                  id: relation.id,
                  date: (pageResponse as any).properties.Date?.date?.start,
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
    return NextResponse.json(
      { error: 'Failed to fetch habits' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  console.log('POST request received for habit toggle');
  try {
    const { habitId, date, completed } = await request.json();
    const runningDbId = process.env.NOTION_RUNNING_DATABASE_ID;

    console.log('Request params:', { habitId, date, completed, runningDbId });

    if (!habitId || !date || !runningDbId) {
      console.error('Missing required fields:', { habitId, date, runningDbId });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Find or create the daily entry
    console.log('Querying for existing entry with date:', date);
    const existingEntries = await notion.databases.query({
      database_id: runningDbId,
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
        parent: { database_id: runningDbId },
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

    // Create new relation array
    const newRelations = !completed
      ? [{ id: dayPageId }]  // Just add the new day directly
      : [];  // Remove all relations

    // Log before update to verify
    console.log('dayPageId to add/remove:', dayPageId);
    console.log('New relations structure:', JSON.stringify(newRelations, null, 2));

    // Update the habit with explicit logging
    try {
      const updateResponse = await notion.pages.update({
        page_id: habitId,
        properties: {
          Days: {
            relation: [{ id: dayPageId }]  // Direct relation update
          }
        }
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
    return NextResponse.json(
      { error: 'Failed to update habit' },
      { status: 500 }
    );
  }
} 