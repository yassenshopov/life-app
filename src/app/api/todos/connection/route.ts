export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';
import { ensureUserExists } from '@/lib/ensure-user';

const supabase = getSupabaseServiceRoleClient();

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserExists(supabase, userId);

    // Get user's notion_databases
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('notion_databases')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let databases: any[] = [];
    if (Array.isArray(user.notion_databases)) {
      databases = user.notion_databases;
    } else if (typeof user.notion_databases === 'string' && user.notion_databases.trim()) {
      try {
        const parsed = JSON.parse(user.notion_databases);
        databases = Array.isArray(parsed) ? parsed : [];
      } catch {
        databases = [];
      }
    }

    // Find To-Do List database by checking database name (case-insensitive)
    // We look for databases with "to-do", "todo", "action", or "task" in the name
    const todosDb = databases.find(
      (db: any) => {
        const dbName = typeof db.database_name === 'string' 
          ? db.database_name 
          : String(db.database_name || '');
        const nameLower = dbName.toLowerCase();
        return nameLower.includes('to-do') || 
               nameLower.includes('todo') || 
               nameLower.includes('action') ||
               nameLower.includes('task');
      }
    );

    if (!todosDb) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      database: {
        database_id: todosDb.database_id,
        database_name: todosDb.database_name,
        last_sync: todosDb.last_sync,
        properties: todosDb.properties,
      },
    });
  } catch (error) {
    console.error('Error checking To-Do List DB connection:', error);
    return NextResponse.json(
      { error: 'Failed to check connection' },
      { status: 500 }
    );
  }
}

