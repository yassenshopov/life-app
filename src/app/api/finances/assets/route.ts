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

    // Fetch all assets
    const { data: assets, error: assetsError } = await supabase
      .from('finances_assets')
      .select('*')
      .eq('user_id', userId);

    if (assetsError) {
      console.error('Error fetching assets:', assetsError);
      return NextResponse.json(
        { error: 'Failed to fetch assets' },
        { status: 500 }
      );
    }

    // Fetch all investments for this user with related asset and place information
    const { data: investments, error: investmentsError } = await supabase
      .from('finances_individual_investments')
      .select(`
        id, 
        name, 
        quantity, 
        purchase_price, 
        purchase_date, 
        current_price, 
        current_value, 
        currency, 
        asset_id,
        place_id,
        asset:finances_assets(current_price),
        place:finances_places(id, name, icon, icon_url)
      `)
      .eq('user_id', userId);

    if (investmentsError) {
      console.error('Error fetching investments:', investmentsError);
      // Continue without investment data
    }

    // Group investments by asset_id
    const investmentsByAsset = new Map<string, any[]>();
    investments?.forEach((investment: any) => {
      if (investment.asset_id) {
        const existing = investmentsByAsset.get(investment.asset_id) || [];
        existing.push(investment);
        investmentsByAsset.set(investment.asset_id, existing);
      }
    });

    // Debug logging
    console.log('Assets fetched:', assets?.length || 0);
    console.log('Investments fetched:', investments?.length || 0);
    console.log('Investments with asset_id:', investments?.filter((inv: any) => inv.asset_id).length || 0);
    console.log('Investments grouped by asset:', investmentsByAsset.size);

    // Calculate total worth and prepare data
    const assetsWithWorth = (assets || []).map((asset: any) => {
      const assetInvestments = investmentsByAsset.get(asset.id) || [];
      const total_worth = assetInvestments.reduce((sum: number, inv: any) => {
        // Calculate current worth: use current_value if available, otherwise current_price * quantity
        // If investment doesn't have current_price, try using asset's current_price from the relation
        let currentPrice = inv.current_price;
        if (!currentPrice && inv.asset?.current_price) {
          currentPrice = inv.asset.current_price;
        } else if (!currentPrice && asset.current_price) {
          currentPrice = asset.current_price;
        }
        
        // Calculate worth - same logic as investments API
        const currentWorth = inv.current_value !== null && inv.current_value !== undefined
          ? Number(inv.current_value) 
          : (currentPrice !== null && currentPrice !== undefined && inv.quantity !== null && inv.quantity !== undefined
              ? Number(currentPrice) * Number(inv.quantity)
              : 0);
        
        return sum + currentWorth;
      }, 0);
      
      // Debug logging for assets with investments
      if (assetInvestments.length > 0) {
        console.log(`Asset "${asset.name}": ${assetInvestments.length} investments, total_worth=${total_worth}`);
        assetInvestments.forEach((inv: any) => {
          const currentPrice = inv.current_price || inv.asset?.current_price || asset.current_price;
          const worth = inv.current_value !== null && inv.current_value !== undefined
            ? Number(inv.current_value) 
            : (currentPrice !== null && currentPrice !== undefined && inv.quantity !== null && inv.quantity !== undefined
                ? Number(currentPrice) * Number(inv.quantity)
                : 0);
          console.log(`  - "${inv.name}": current_value=${inv.current_value}, current_price=${inv.current_price || 'null'}, asset.current_price=${inv.asset?.current_price || asset.current_price || 'null'}, quantity=${inv.quantity}, worth=${worth}`);
        });
      }

      return {
        ...asset,
        investments: assetInvestments,
        total_worth: total_worth,
      };
    });

    // Sort by total worth (descending), then by name
    assetsWithWorth.sort((a: any, b: any) => {
      if (b.total_worth !== a.total_worth) {
        return b.total_worth - a.total_worth;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ data: assetsWithWorth });
  } catch (error: any) {
    console.error('Error in assets route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch assets' },
      { status: 500 }
    );
  }
}

