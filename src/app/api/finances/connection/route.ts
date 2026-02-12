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

    // Check if all three finances databases are connected
    const hasAssets = databases.some((db: any) => db.type === 'finances_assets');
    const hasInvestments = databases.some((db: any) => db.type === 'finances_investments');
    const hasPlaces = databases.some((db: any) => db.type === 'finances_places');

    const connected = hasAssets && hasInvestments && hasPlaces;

    return NextResponse.json({
      connected,
      databases: {
        assets: hasAssets,
        investments: hasInvestments,
        places: hasPlaces,
      },
    });
  } catch (error: any) {
    console.error('Error checking finances connection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check connection' },
      { status: 500 }
    );
  }
}

