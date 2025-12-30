export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's notion_databases
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

    // Find People database by checking database name (case-insensitive)
    // We look for databases with "people" in the name
    const peopleDb = databases.find(
      (db: any) => {
        const dbName = typeof db.database_name === 'string' 
          ? db.database_name 
          : String(db.database_name || '');
        return dbName.toLowerCase().includes('people');
      }
    );

    if (!peopleDb) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      database: {
        database_id: peopleDb.database_id,
        database_name: peopleDb.database_name,
        last_sync: peopleDb.last_sync,
        properties: peopleDb.properties,
      },
    });
  } catch (error) {
    console.error('Error checking People DB connection:', error);
    return NextResponse.json(
      { error: 'Failed to check connection' },
      { status: 500 }
    );
  }
}

