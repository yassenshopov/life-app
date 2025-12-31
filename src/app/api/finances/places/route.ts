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

    // Fetch all places
    const { data: places, error: placesError } = await supabase
      .from('finances_places')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (placesError) {
      console.error('Error fetching places:', placesError);
      return NextResponse.json(
        { error: 'Failed to fetch places' },
        { status: 500 }
      );
    }

    // Fetch all investments to calculate total_value for each place
    const { data: investments, error: investmentsError } = await supabase
      .from('finances_individual_investments')
      .select('id, place_id, current_value, current_price, quantity')
      .eq('user_id', userId);

    if (investmentsError) {
      console.error('Error fetching investments for places:', investmentsError);
      // Continue without investment data
    }

    // Group investments by place_id and calculate total_value for each place
    const investmentsByPlace = new Map<string, any[]>();
    investments?.forEach((inv: any) => {
      if (inv.place_id) {
        const existing = investmentsByPlace.get(inv.place_id) || [];
        existing.push(inv);
        investmentsByPlace.set(inv.place_id, existing);
      }
    });

    // Calculate total_value for each place from related investments
    const placesWithTotalValue = (places || []).map((place: any) => {
      const placeInvestments = investmentsByPlace.get(place.id) || [];
      const total_value = placeInvestments.reduce((sum: number, inv: any) => {
        // Calculate current worth: use current_value if available, otherwise current_price * quantity
        const currentWorth = inv.current_value !== null 
          ? Number(inv.current_value) 
          : (inv.current_price && inv.quantity 
              ? Number(inv.current_price) * Number(inv.quantity)
              : 0);
        return sum + currentWorth;
      }, 0);

      return {
        ...place,
        total_value: total_value > 0 ? total_value : (place.total_value || null), // Use calculated value or fallback to existing
      };
    });

    return NextResponse.json({ data: placesWithTotalValue });
  } catch (error: any) {
    console.error('Error in places route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch places' },
      { status: 500 }
    );
  }
}

