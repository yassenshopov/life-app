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
  let period: string | undefined;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    period = resolvedParams.period;
    
    if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period' },
        { status: 400 }
      );
    }

    const tableName = PERIOD_TABLES[period as TrackingPeriod];
    const { searchParams } = new URL(request.url);
    
    // Optional date range filtering for performance
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit');

    // Build query with optimized filtering
    let query = supabase
      .from(tableName)
      .select('*')
      .eq('user_id', userId);

    // Apply date range filter if provided (uses created_at index)
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Order by created_at (uses composite index)
    query = query.order('created_at', { ascending: false });

    // Apply limit if provided (reduces data transfer)
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum);
      }
    }

    const { data: entries, error: fetchError } = await query;

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
    console.error(`Error fetching ${period ?? 'unknown period'} entries:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch entries' },
      { status: 500 }
    );
  }
}

