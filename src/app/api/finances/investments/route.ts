import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch investments with related assets and places
    const { data, error } = await supabase
      .from('finances_individual_investments')
      .select(`
        *,
        asset:finances_assets(*),
        place:finances_places(id, name, icon, icon_url)
      `)
      .eq('user_id', userId)
      .order('purchase_date', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching investments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch investments' },
        { status: 500 }
      );
    }

    console.log(`Found ${data?.length || 0} investments for user ${userId}`);

    // Calculate current worth for each investment and populate missing current_price from asset
    const investmentsWithWorth = (data || []).map((inv: any) => {
      // If current_price is missing but we have an asset with current_price, use it
      let currentPrice = inv.current_price;
      if (!currentPrice && inv.asset?.current_price) {
        currentPrice = inv.asset.current_price;
        console.log(`Using asset current_price for investment ${inv.name}:`, currentPrice);
      }

      // Calculate current worth: use current_value if available, otherwise current_price * quantity
      const currentWorth = inv.current_value !== null
        ? Number(inv.current_value)
        : (currentPrice && inv.quantity
            ? Number(currentPrice) * Number(inv.quantity)
            : null);
      
      return {
        ...inv,
        current_price: currentPrice || inv.current_price, // Use asset price if available
        current_worth: currentWorth,
      };
    });

    return NextResponse.json({ data: investmentsWithWorth });
  } catch (error: any) {
    console.error('Error in investments route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch investments' },
      { status: 500 }
    );
  }
}

