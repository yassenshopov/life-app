export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface WeatherResponse {
  location: string;
  temperature: number;
  description: string;
  icon: string;
  precipitation: number;
  windSpeed: number;
  feelsLike: number;
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Weather API key not configured' },
        { status: 500 }
      );
    }

    // Try to get user's location from database
    let lat = '40.7128'; // Default to NYC
    let lon = '-74.0060';
    let locationName: string | null = null;

    try {
      const { userId } = await auth();
      if (userId) {
        const { data: user } = await supabase
          .from('users')
          .select('weather_latitude, weather_longitude, weather_location_name')
          .eq('id', userId)
          .single();

        if (user?.weather_latitude && user?.weather_longitude) {
          lat = user.weather_latitude.toString();
          lon = user.weather_longitude.toString();
          locationName = user.weather_location_name;
        }
      }
    } catch (authError) {
      // Silently continue - weather is public data
    }

    // Allow query params to override user location
    const { searchParams } = new URL(request.url);
    lat = searchParams.get('lat') || lat;
    lon = searchParams.get('lon') || lon;

    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    
    const response = await fetch(weatherUrl, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Failed to fetch weather data', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    const weatherData: WeatherResponse = {
      location: locationName || `${data.name}, ${data.sys.country}`,
      temperature: Math.round(data.main.temp),
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      precipitation: data.main.humidity, // Using humidity as precipitation percentage
      windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
      feelsLike: Math.round(data.main.feels_like),
    };

    return NextResponse.json(weatherData);
  } catch (error) {
    console.error('Error fetching weather:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

