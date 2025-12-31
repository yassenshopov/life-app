export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

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

    // Apply date range filter if provided (filters on properties->'Date'->>'start' for period-based filtering)
    // Note: The Date property is stored as { start: "YYYY-MM-DD", end?: "YYYY-MM-DD" } in JSONB
    if (startDate) {
      // Filter where properties->'Date'->>'start' >= startDate
      // Using PostgREST JSONB operator syntax
      query = query.gte("properties->Date->>start", startDate);
    }
    if (endDate) {
      // Filter where properties->'Date'->>'start' <= endDate
      query = query.lte("properties->Date->>start", endDate);
    }

    // Order by the Date property from JSONB (uses GIN index on properties->'Date')
    // Fallback to created_at if Date is not available
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

