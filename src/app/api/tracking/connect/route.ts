export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Client } from '@notionhq/client';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/ensure-user';

const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
});

const supabase = getSupabaseServiceRoleClient();

type TrackingPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { database_id, period } = body;

    if (!database_id) {
      return NextResponse.json(
        { error: 'Database ID is required' },
        { status: 400 }
      );
    }

    if (!period || !['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(period)) {
      return NextResponse.json(
        { error: 'Valid period is required (daily, weekly, monthly, quarterly, yearly)' },
        { status: 400 }
      );
    }

    // Fetch database info from Notion
    const database = await notion.databases.retrieve({
      database_id: database_id.replace(/-/g, ''),
    });

    const title =
      (database as any).title?.[0]?.plain_text || 'Untitled Database';

    await ensureUserExists(supabase, userId);

    // Get user's current databases
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('notion_databases')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentDatabases = Array.isArray(user.notion_databases)
      ? user.notion_databases
      : JSON.parse(user.notion_databases || '[]');

    // Check if already exists for this period
    const existingIndex = currentDatabases.findIndex(
      (db: any) => db.database_id === database_id.replace(/-/g, '') && db.period === period
    );

    const newDatabase = {
      database_id: database_id.replace(/-/g, ''),
      database_name: title,
      period: period,
      integration_id: userId,
      last_sync: null,
      sync_frequency: 'manual',
      properties: database.properties,
    };

    let updatedDatabases;
    if (existingIndex >= 0) {
      updatedDatabases = [...currentDatabases];
      updatedDatabases[existingIndex] = newDatabase;
    } else {
      updatedDatabases = [...currentDatabases, newDatabase];
    }

    // Update user's databases
    const { error: updateError } = await supabase
      .from('users')
      .update({ notion_databases: updatedDatabases })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user databases:', updateError);
      return NextResponse.json(
        { error: 'Failed to connect database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      database: newDatabase,
    });
  } catch (error: any) {
    console.error('Error connecting Tracking DB:', error);
    if (error.code === 'object_not_found') {
      return NextResponse.json(
        { error: 'Database not found in Notion' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to connect database' },
      { status: 500 }
    );
  }
}

