export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user ID from Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch only people belonging to this authenticated user
    // The user_id column ensures data isolation - each user only sees their own people
    const { data: people, error } = await supabase
      .from('people')
      .select('*')
      .eq('user_id', userId) // Filter by authenticated user ID
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching people:', error);
      return NextResponse.json(
        { error: 'Failed to fetch people' },
        { status: 500 }
      );
    }

    return NextResponse.json({ people: people || [] });
  } catch (error) {
    console.error('Error in GET /api/people:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

