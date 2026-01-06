export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = getSupabaseServiceRoleClient();

interface GenerateProgress {
  current: number;
  total: number;
  status: 'preparing' | 'generating' | 'completed' | 'partial' | 'error';
  message: string;
  error?: string;
}

function formatDateForTitle(date: Date): string {
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear().toString().slice(-2); // Get last 2 digits

  return `${month} ${day} '${year}`;
}

function formatWeekForTitle(weekNumber: number, year: number): string {
  const yearShort = year.toString().slice(-2); // Get last 2 digits
  return `Week ${weekNumber} '${yearShort}`;
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getStartOfWeek(year: number, weekNumber: number): Date {
  const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
  
  // Find the Monday that makes Jan 1 part of week 1 (consistent with getWeekNumber)
  // Week 1 always includes January 1st, so we need to find the Monday of that week
  const dayOfWeek = firstDayOfYear.getUTCDay();
  // Calculate days to subtract to get to the Monday of week 1
  // If Jan 1 is Monday (1): 0 days back
  // If Jan 1 is Tuesday (2): 1 day back
  // If Jan 1 is Sunday (0): 6 days back (to previous Monday)
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const firstWeekStart = new Date(firstDayOfYear);
  firstWeekStart.setUTCDate(firstDayOfYear.getUTCDate() - daysToSubtract);
  
  // Calculate the start of the specified week
  const weekStart = new Date(firstWeekStart);
  weekStart.setUTCDate(firstWeekStart.getUTCDate() + (weekNumber - 1) * 7);
  
  return weekStart;
}

function sendProgress(
  controller: ReadableStreamDefaultController,
  progress: GenerateProgress
) {
  const data = `data: ${JSON.stringify(progress)}\n\n`;
  controller.enqueue(new TextEncoder().encode(data));
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { year } = await request.json();

    if (!year || typeof year !== 'number') {
      return NextResponse.json(
        { error: 'Year is required and must be a number' },
        { status: 400 }
      );
    }

    // Get user's daily tracking database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('notion_databases')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const databases = Array.isArray(user.notion_databases)
      ? user.notion_databases
      : JSON.parse(user.notion_databases || '[]');

    // Find the daily and weekly databases
    const dailyDb = databases.find(
      (db: any) => db.period === 'daily'
    );
    const weeklyDb = databases.find(
      (db: any) => db.period === 'weekly'
    );

    if (!dailyDb) {
      return NextResponse.json(
        { error: 'Daily tracking database not connected' },
        { status: 404 }
      );
    }

    const dailyDatabaseId = dailyDb.database_id;
    const weeklyDatabaseId = weeklyDb?.database_id;

    // Calculate total days and weeks in the year (accounting for leap years)
    const totalDays = new Date(year, 1, 29).getDate() === 29 ? 366 : 365;
    const totalWeeks = 52; // Most years have 52 weeks, some have 53 but we'll use 52 for consistency
    const totalEntries = totalDays + (weeklyDatabaseId ? totalWeeks : 0);

    // Create a ReadableStream for server-sent events
    const stream = new ReadableStream({
      start(controller) {
        (async () => {
          try {
            // Send initial progress
            sendProgress(controller, {
              current: 0,
              total: totalEntries,
              status: 'preparing',
              message: `Preparing to generate ${totalDays} daily${weeklyDatabaseId ? ` and ${totalWeeks} weekly` : ''} entries...`
            });

            // Get daily database schema
            const dailyDatabase = await notion.databases.retrieve({
              database_id: dailyDatabaseId,
            });

            const dailyProperties = (dailyDatabase as any).properties;

            // Find the title property for daily
            const dailyTitlePropertyKey = Object.keys(dailyProperties).find(
              key => dailyProperties[key].type === 'title'
            );

            if (!dailyTitlePropertyKey) {
              throw new Error('No title property found in the daily database');
            }

            // Find date property if it exists for daily
            const dailyDatePropertyKey = Object.keys(dailyProperties).find(
              key => dailyProperties[key].type === 'date'
            );

            // Get weekly database schema if available
            let weeklyProperties: any = {};
            let weeklyTitlePropertyKey: string | undefined;
            let weeklyDatePropertyKey: string | undefined;

            if (weeklyDatabaseId) {
              const weeklyDatabase = await notion.databases.retrieve({
                database_id: weeklyDatabaseId,
              });

              weeklyProperties = (weeklyDatabase as any).properties;

              // Find the title property for weekly
              weeklyTitlePropertyKey = Object.keys(weeklyProperties).find(
                key => weeklyProperties[key].type === 'title'
              );

              if (!weeklyTitlePropertyKey) {
                throw new Error('No title property found in the weekly database');
              }

              // Find date property if it exists for weekly
              weeklyDatePropertyKey = Object.keys(weeklyProperties).find(
                key => weeklyProperties[key].type === 'date'
              );
            }

            // Send generating status
            sendProgress(controller, {
              current: 0,
              total: totalEntries,
              status: 'generating',
              message: 'Starting to create daily entries...'
            });

            // Generate entries for each day of the year
            let createdCount = 0;

            // Create daily entries
            for (let dayOfYear = 0; dayOfYear < totalDays; dayOfYear++) {
              const currentDate = new Date(Date.UTC(year, 0, dayOfYear + 1));
              const title = formatDateForTitle(currentDate);

              try {
                // Prepare properties for the new page
                const pageProperties: any = {};

                // Set title
                pageProperties[dailyTitlePropertyKey] = {
                  title: [
                    {
                      text: {
                        content: title,
                      },
                    },
                  ],
                };

                // Set date if date property exists
                if (dailyDatePropertyKey) {
                  pageProperties[dailyDatePropertyKey] = {
                    date: {
                      start: currentDate.toISOString().split('T')[0], // YYYY-MM-DD format
                    },
                  };
                }

                // Create the page in Notion
                await notion.pages.create({
                  parent: {
                    database_id: dailyDatabaseId,
                  },
                  properties: pageProperties,
                });

                createdCount++;

                // Send progress update every 10 entries
                if (createdCount % 10 === 0) {
                  sendProgress(controller, {
                    current: createdCount,
                    total: totalEntries,
                    status: 'generating',
                    message: `Created ${createdCount} of ${totalEntries} entries (daily: ${dayOfYear + 1}/${totalDays})...`
                  });
                }
              } catch (pageError) {
                console.error(`Error creating daily page for ${title}:`, pageError);
                // Continue with next entry
              }

              // Small delay to avoid rate limiting (Notion allows ~3 requests per second)
              await new Promise(resolve => setTimeout(resolve, 350));
            }

            // Create weekly entries if weekly database is connected
            if (weeklyDatabaseId && weeklyTitlePropertyKey) {
              sendProgress(controller, {
                current: createdCount,
                total: totalEntries,
                status: 'generating',
                message: 'Starting to create weekly entries...'
              });

              for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
                const weekTitle = formatWeekForTitle(weekNumber, year);
                const weekStartDate = getStartOfWeek(year, weekNumber);

                try {
                  // Prepare properties for the weekly page
                  const weekPageProperties: any = {};

                  // Set title
                  weekPageProperties[weeklyTitlePropertyKey] = {
                    title: [
                      {
                        text: {
                          content: weekTitle,
                        },
                      },
                    ],
                  };

                  // Set date if date property exists (use the start of the week)
                  if (weeklyDatePropertyKey) {
                    const weekEndDate = new Date(weekStartDate);
                    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6); // End of week (Sunday)

                    weekPageProperties[weeklyDatePropertyKey] = {
                      date: {
                        start: weekStartDate.toISOString().split('T')[0],
                        end: weekEndDate.toISOString().split('T')[0],
                      },
                    };
                  }

                  // Create the weekly page in Notion
                  await notion.pages.create({
                    parent: {
                      database_id: weeklyDatabaseId,
                    },
                    properties: weekPageProperties,
                  });

                  createdCount++;

                  // Send progress update every 5 weekly entries
                  if (weekNumber % 5 === 0 || weekNumber === totalWeeks) {
                    sendProgress(controller, {
                      current: createdCount,
                      total: totalEntries,
                      status: 'generating',
                      message: `Created ${createdCount} of ${totalEntries} entries (weekly: ${weekNumber}/${totalWeeks})...`
                    });
                  }
                } catch (pageError) {
                  console.error(`Error creating weekly page for ${weekTitle}:`, pageError);
                  // Continue with next entry
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 350));
              }
            }

            // Send completion
            const hasFailures = createdCount < totalEntries;
            sendProgress(controller, {
              current: createdCount,
              total: totalEntries,
              status: hasFailures ? 'partial' : 'completed',
              message: hasFailures
                ? `Created ${createdCount} of ${totalEntries} entries for ${year} (some entries failed to create). (${totalDays} daily${weeklyDatabaseId ? ` + ${totalWeeks} weekly` : ''})`
                : `Successfully created ${createdCount} entries for ${year}! (${totalDays} daily${weeklyDatabaseId ? ` + ${totalWeeks} weekly` : ''})`
            });

            controller.close();
          } catch (error) {
            console.error('Error generating entries:', error);

            sendProgress(controller, {
              current: 0,
              total: totalEntries,
              status: 'error',
              message: 'Error occurred during generation',
              error: error instanceof Error ? error.message : 'Unknown error'
            });

            controller.close();
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Error in prepare generate endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate entries' },
      { status: 500 }
    );
  }
}
