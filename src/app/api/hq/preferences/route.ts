import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/ensure-user';

const supabase = getSupabaseServiceRoleClient();

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserExists(supabase, userId);

    // Get current user's HQ section preferences
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('hq_section_preferences')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      return NextResponse.json({ error: 'Error fetching user data' }, { status: 500 });
    }

    const preferences = user?.hq_section_preferences || {};
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error in GET /api/hq/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { preferences } = body;

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { error: 'preferences object is required' },
        { status: 400 }
      );
    }

    await ensureUserExists(supabase, userId);

    // Update user preferences
    const { error: updateError } = await supabase
      .from('users')
      .update({ hq_section_preferences: preferences })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating HQ section preferences:', updateError);
      return NextResponse.json(
        { error: 'Error saving preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/hq/preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

