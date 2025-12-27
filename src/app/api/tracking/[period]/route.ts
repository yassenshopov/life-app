export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type TrackingPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const PERIOD_TABLES: Record<TrackingPeriod, string> = {
  daily: 'tracking_daily',
  weekly: 'tracking_weekly',
  monthly: 'tracking_monthly',
  quarterly: 'tracking_quarterly',
  yearly: 'tracking_yearly',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ period: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { period } = await params;
    
    if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period' },
        { status: 400 }
      );
    }

    const tableName = PERIOD_TABLES[period as TrackingPeriod];

    // Fetch entries from the appropriate table
    const { data: entries, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error(`Error fetching ${period} entries:`, fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch entries' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      entries: entries || [],
    });
  } catch (error: any) {
    console.error(`Error fetching ${period} entries:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch entries' },
      { status: 500 }
    );
  }
}

