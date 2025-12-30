export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user ID from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch only media belonging to this authenticated user, including monthly tracking relationship
    const { data: media, error } = await supabase
      .from('media')
      .select(`
        *,
        monthly_tracking:tracking_monthly(
          id,
          title,
          properties
        )
      `)
      .eq('user_id', userId) // Filter by authenticated user ID
      .order('created', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching media:', error);
      return NextResponse.json(
        { error: 'Failed to fetch media' },
        { status: 500 }
      );
    }

    return NextResponse.json({ media: media || [] });
  } catch (error) {
    console.error('Error in GET /api/media:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


