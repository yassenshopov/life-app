export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Weather API key not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    // Check if the query is coordinates (lat,lon format)
    const coordinatePattern = /^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/;
    const coordinateMatch = query.match(coordinatePattern);

    let location;
    let response;

    if (coordinateMatch) {
      // Parse coordinates
      const latitude = parseFloat(coordinateMatch[1]);
      const longitude = parseFloat(coordinateMatch[2]);

      // Validate coordinate ranges
      if (latitude < -90 || latitude > 90) {
        return NextResponse.json(
          { error: 'Invalid latitude. Must be between -90 and 90.' },
          { status: 400 }
        );
      }
      if (longitude < -180 || longitude > 180) {
        return NextResponse.json(
          { error: 'Invalid longitude. Must be between -180 and 180.' },
          { status: 400 }
        );
      }

      // Use OpenWeatherMap Reverse Geocoding API for coordinates
      const reverseGeocodeUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${apiKey}`;
      
      response = await fetch(reverseGeocodeUrl, {
        next: { revalidate: 86400 }, // Cache for 24 hours
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json(
          { error: 'Failed to reverse geocode coordinates', details: errorData },
          { status: response.status }
        );
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        return NextResponse.json(
          { error: 'Location not found for coordinates' },
          { status: 404 }
        );
      }

      location = data[0];
    } else {
      // Use OpenWeatherMap Direct Geocoding API for city names
      const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${apiKey}`;
      
      response = await fetch(geocodeUrl, {
        next: { revalidate: 86400 }, // Cache for 24 hours
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json(
          { error: 'Failed to geocode location', details: errorData },
          { status: response.status }
        );
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        return NextResponse.json(
          { error: 'Location not found' },
          { status: 404 }
        );
      }

      location = data[0];
    }

    return NextResponse.json({
      latitude: location.lat,
      longitude: location.lon,
      name: location.name,
      country: location.country,
      state: location.state,
    });
  } catch (error) {
    console.error('Error geocoding location:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

