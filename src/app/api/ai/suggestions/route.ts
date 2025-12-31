export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { generateUnscheduledTimeSuggestions } from '@/lib/ai-gateway';

const supabase = getSupabaseServiceRoleClient();

/**
 * API route for generating unscheduled time suggestions
 * POST /api/ai/suggestions
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user ID
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      currentTime,
      recentEvents,
      upcomingEvents,
      timeUntilNextEvent,
      availableTimeBlocks,
    } = body;

    // Validate required fields
    if (!currentTime) {
      return NextResponse.json(
        { error: 'currentTime is required' },
        { status: 400 }
      );
    }

    // Fetch media items with "To Do" status (including "Not started" which is normalized to "To-do")
    let mediaItems: Array<{ name: string; category: string | null; by: string[] | null }> = [];
    try {
      const { data: media, error: mediaError } = await supabase
        .from('media')
        .select('name, category, by, status')
        .eq('user_id', userId)
        .in('status', ['Not started', 'To-do', 'To Do', 'to do', 'TODO', 'todo'])
        .limit(20); // Limit to 20 items

      if (!mediaError && media) {
        mediaItems = media.map((item: any) => ({
          name: item.name,
          category: item.category,
          by: item.by || [],
        }));
      }
    } catch (mediaError) {
      console.error('Error fetching media items:', mediaError);
      // Continue without media items if fetch fails
    }

    // Convert date strings to Date objects
    const currentTimeDate = new Date(currentTime);
    const recentEventsParsed = (recentEvents || []).map((event: any) => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
    }));
    const upcomingEventsParsed = (upcomingEvents || []).map((event: any) => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
    }));
    const availableTimeBlocksParsed = (availableTimeBlocks || []).map((block: any) => ({
      ...block,
      start: new Date(block.start),
      end: new Date(block.end),
    }));

    const suggestions = await generateUnscheduledTimeSuggestions({
      currentTime: currentTimeDate,
      recentEvents: recentEventsParsed,
      upcomingEvents: upcomingEventsParsed,
      timeUntilNextEvent,
      availableTimeBlocks: availableTimeBlocksParsed,
      mediaItems,
    });

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

