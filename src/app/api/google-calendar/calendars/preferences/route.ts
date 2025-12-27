import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { calendarId, selected } = body;

    if (!calendarId || typeof selected !== 'boolean') {
      return NextResponse.json(
        { error: 'calendarId and selected are required' },
        { status: 400 }
      );
    }

    // Get current user's calendar preferences
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('calendar_preferences')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" - we'll create it
      console.error('Error fetching user:', fetchError);
      return NextResponse.json({ error: 'Error fetching user data' }, { status: 500 });
    }

    const currentPreferences = user?.calendar_preferences || {};
    const updatedPreferences = {
      ...currentPreferences,
      [calendarId]: { selected },
    };

    // Update or insert user preferences
    const { error: updateError } = await supabase
      .from('users')
      .update({ calendar_preferences: updatedPreferences })
      .eq('id', userId);

    if (updateError) {
      // If user doesn't exist, try to insert (though this shouldn't happen with Clerk)
      console.error('Error updating calendar preferences:', updateError);
      return NextResponse.json(
        { error: 'Error saving calendar preference' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/google-calendar/calendars/preferences:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}



