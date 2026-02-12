export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/ensure-user';

const supabase = getSupabaseServiceRoleClient();

type TrackingPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserExists(supabase, userId);

    // Get user's databases
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

    // Initialize connections for all periods
    const connections: Record<TrackingPeriod, { connected: boolean; database?: any }> = {
      daily: { connected: false },
      weekly: { connected: false },
      monthly: { connected: false },
      quarterly: { connected: false },
      yearly: { connected: false },
    };

    // Find tracking databases by checking for period property
    databases.forEach((db: any) => {
      if (db.period && ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(db.period)) {
        const period = db.period as TrackingPeriod;
        connections[period] = {
          connected: true,
          database: db,
        };
      }
    });

    return NextResponse.json({ connections });
  } catch (error: any) {
    console.error('Error checking connections:', error);
    return NextResponse.json(
      { error: 'Failed to check connections' },
      { status: 500 }
    );
  }
}

