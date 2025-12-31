export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

// GET: Fetch user's location
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('weather_latitude, weather_longitude, weather_location_name')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user location:', error);
      return NextResponse.json(
        { error: 'Failed to fetch location' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      latitude: user?.weather_latitude,
      longitude: user?.weather_longitude,
      locationName: user?.weather_location_name,
    });
  } catch (error) {
    console.error('Error in GET /api/weather/location:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Update user's location
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { latitude, longitude, locationName } = body;

    // Validate coordinates: check for null/undefined and ensure they are finite numbers
    // Note: 0 is a valid coordinate (e.g., equator/prime meridian intersection)
    const latNum = typeof latitude === 'string' ? Number(latitude) : latitude;
    const lonNum = typeof longitude === 'string' ? Number(longitude) : longitude;

    if (latitude == null || longitude == null || !Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required and must be valid numbers' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('users')
      .update({
        weather_latitude: latNum,
        weather_longitude: lonNum,
        weather_location_name: locationName || null,
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user location:', error);
      return NextResponse.json(
        { error: 'Failed to update location' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/weather/location:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

