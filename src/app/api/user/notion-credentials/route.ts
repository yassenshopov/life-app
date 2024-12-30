import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase
      .from('notion_credentials')
      .select('notion_database_id')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {  // no rows returned
        return NextResponse.json({ notionDatabaseId: null });
      }
      throw error;
    }

    return NextResponse.json({
      notionDatabaseId: data.notion_database_id,
    });
  } catch (error) {
    console.error('Error fetching notion credentials:', error);
    return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { notionDatabaseId } = body;

  if (!notionDatabaseId) {
    return NextResponse.json({ error: 'Notion Database ID is required' }, { status: 400 });
  }

  try {
    // First check if an entry exists
    const { data: existingEntry } = await supabase
      .from('notion_credentials')
      .select()
      .eq('user_id', user.id)
      .single();

    let error;
    
    if (existingEntry) {
      // Update existing entry
      ({ error } = await supabase
        .from('notion_credentials')
        .update({ notion_database_id: notionDatabaseId })
        .eq('user_id', user.id));
    } else {
      // Insert new entry
      ({ error } = await supabase
        .from('notion_credentials')
        .insert({
          user_id: user.id,
          notion_database_id: notionDatabaseId,
        }));
    }

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving notion credentials:', error);
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }
} 