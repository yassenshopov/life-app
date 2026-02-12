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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { assets_database_id, investments_database_id, places_database_id } = body;

    if (!assets_database_id || !investments_database_id || !places_database_id) {
      return NextResponse.json(
        { error: 'All three database IDs are required' },
        { status: 400 }
      );
    }

    // Fetch database info from Notion for all three
    const [assetsDb, investmentsDb, placesDb] = await Promise.all([
      notion.databases.retrieve({
        database_id: assets_database_id.replace(/-/g, ''),
      }),
      notion.databases.retrieve({
        database_id: investments_database_id.replace(/-/g, ''),
      }),
      notion.databases.retrieve({
        database_id: places_database_id.replace(/-/g, ''),
      }),
    ]);

    const assetsTitle = (assetsDb as any).title?.[0]?.plain_text || 'Assets';
    const investmentsTitle = (investmentsDb as any).title?.[0]?.plain_text || 'Investments';
    const placesTitle = (placesDb as any).title?.[0]?.plain_text || 'Net Worth';

    // Ensure user row exists (e.g. if Clerk webhook didn't run in production)
    const ensured = await ensureUserExists(supabase, userId);
    if (!ensured) {
      return NextResponse.json(
        { error: 'Failed to initialize user. Please try again.' },
        { status: 500 }
      );
    }

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

    // Create database entries for finances
    const financesDatabases = [
      {
        database_id: assets_database_id.replace(/-/g, ''),
        database_name: assetsTitle,
        type: 'finances_assets',
        integration_id: userId,
        last_sync: null,
        sync_frequency: 'manual',
        properties: (assetsDb as any).properties,
      },
      {
        database_id: investments_database_id.replace(/-/g, ''),
        database_name: investmentsTitle,
        type: 'finances_investments',
        integration_id: userId,
        last_sync: null,
        sync_frequency: 'manual',
        properties: (investmentsDb as any).properties,
      },
      {
        database_id: places_database_id.replace(/-/g, ''),
        database_name: placesTitle,
        type: 'finances_places',
        integration_id: userId,
        last_sync: null,
        sync_frequency: 'manual',
        properties: (placesDb as any).properties,
      },
    ];

    // Remove existing finances databases and add new ones
    const updatedDatabases = [
      ...currentDatabases.filter((db: any) => !db.type?.startsWith('finances_')),
      ...financesDatabases,
    ];

    // Update user's databases
    const { error: updateError } = await supabase
      .from('users')
      .update({ notion_databases: updatedDatabases })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user databases:', updateError);
      return NextResponse.json(
        { error: 'Failed to connect databases' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      databases: financesDatabases,
    });
  } catch (error: any) {
    console.error('Error connecting Finances DBs:', error);
    if (error.code === 'object_not_found') {
      return NextResponse.json(
        { error: 'One or more databases not found in Notion' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to connect databases' },
      { status: 500 }
    );
  }
}

