export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ForecastDay {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  description: string;
  icon: string;
  precipitation: number;
  windSpeed: number;
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

    try {
      const { userId } = await auth();
      if (userId) {
        const { data: user } = await supabase
          .from('users')
          .select('weather_latitude, weather_longitude')
          .eq('id', userId)
          .single();

        if (user?.weather_latitude && user?.weather_longitude) {
          lat = user.weather_latitude.toString();
          lon = user.weather_longitude.toString();
        }
      }
    } catch (authError) {
      // Silently continue
    }

    // Allow query params to override user location
    const { searchParams } = new URL(request.url);
    lat = searchParams.get('lat') || lat;
    lon = searchParams.get('lon') || lon;

    // Fetch 7-day forecast (OpenWeatherMap One Call API 3.0 or 5-day/3-hour forecast)
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&cnt=40`; // 40 = 5 days * 8 (3-hour intervals)
    
    const response = await fetch(forecastUrl, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Failed to fetch forecast data', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Group forecasts by day
    const dailyForecasts = new Map<string, any[]>();
    
    data.list.forEach((item: any) => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!dailyForecasts.has(dateKey)) {
        dailyForecasts.set(dateKey, []);
      }
      dailyForecasts.get(dateKey)!.push(item);
    });

    // Process each day to get min/max temps and most common conditions
    const forecast: ForecastDay[] = Array.from(dailyForecasts.entries())
      .slice(0, 7) // Get 7 days
      .map(([dateKey, items]) => {
        const temps = items.map((item: any) => item.main.temp);
        const descriptions = items.map((item: any) => item.weather[0].description);
        const icons = items.map((item: any) => item.weather[0].icon);
        const precipitations = items.map((item: any) => item.main.humidity); // Using humidity as precipitation percentage
        const windSpeeds = items.map((item: any) => item.wind.speed);

        // Get most common description and icon (use midday item if available)
        const middayItem = items.find((item: any) => {
          const hour = new Date(item.dt * 1000).getHours();
          return hour >= 12 && hour <= 14;
        }) || items[Math.floor(items.length / 2)];

        return {
          date: dateKey,
          temperature: {
            min: Math.round(Math.min(...temps)),
            max: Math.round(Math.max(...temps)),
          },
          description: middayItem.weather[0].description,
          icon: middayItem.weather[0].icon,
          precipitation: Math.round(precipitations.reduce((a: number, b: number) => a + b, 0) / precipitations.length),
          windSpeed: Math.round(windSpeeds.reduce((a: number, b: number) => a + b, 0) / windSpeeds.length * 3.6),
        };
      });

    return NextResponse.json({ forecast });
  } catch (error) {
    console.error('Error fetching forecast:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

