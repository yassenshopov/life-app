import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';

interface NotionDatabase {
  database_id: string;
  database_name: string;
  integration_id: string;
  last_sync: string | null;
  sync_frequency: string;
  properties: Record<string, any>;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('notion_databases')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return new NextResponse('Error fetching user data', { status: 500 });
    }

    return NextResponse.json(user?.notion_databases || []);
  } catch (error) {
    console.error('Error in GET /api/user/notion-credentials:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { database_id, database_name, properties } = body;

    if (!database_id) {
      return new NextResponse('Database ID is required', { status: 400 });
    }

    // Get current user's notion_databases
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('notion_databases')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user:', fetchError);
      return new NextResponse('Error fetching user data', { status: 500 });
    }

    const currentDatabases = user?.notion_databases || [];
    const existingIndex = currentDatabases.findIndex(
      (db: NotionDatabase) => db.database_id === database_id
    );

    const newDatabase = {
      database_id,
      database_name: database_name || 'Untitled Database',
      integration_id: userId,
      last_sync: null,
      sync_frequency: 'daily',
      properties,
    };

    let updatedDatabases;
    if (existingIndex >= 0) {
      // Update existing database
      updatedDatabases = [...currentDatabases];
      updatedDatabases[existingIndex] = newDatabase;
    } else {
      // Add new database
      updatedDatabases = [...currentDatabases, newDatabase];
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ notion_databases: updatedDatabases })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return new NextResponse('Error updating user data', { status: 500 });
    }

    return NextResponse.json(newDatabase);
  } catch (error) {
    console.error('Error in POST /api/user/notion-credentials:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { database_id } = body;

    if (!database_id) {
      return new NextResponse('Database ID is required', { status: 400 });
    }

    // Get current user's notion_databases
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('notion_databases')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Error fetching user:', fetchError);
      return new NextResponse('Error fetching user data', { status: 500 });
    }

    const currentDatabases = user?.notion_databases || [];
    const updatedDatabases = currentDatabases.filter(
      (db: NotionDatabase) => db.database_id !== database_id
    );

    const { error: updateError } = await supabase
      .from('users')
      .update({ notion_databases: updatedDatabases })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return new NextResponse('Error updating user data', { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/user/notion-credentials:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
