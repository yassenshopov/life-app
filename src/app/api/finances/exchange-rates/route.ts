import { NextRequest, NextResponse } from 'next/server';

// Free exchange rate API - exchangerate-api.com
// No API key needed for basic usage
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const baseCurrency = searchParams.get('base') || 'USD';

    // Fetch exchange rates
    const response = await fetch(`${EXCHANGE_RATE_API.replace('/USD', `/${baseCurrency}`)}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();
    
    return NextResponse.json({ 
      base: data.base,
      rates: data.rates,
      date: data.date 
    });
  } catch (error: any) {
    console.error('Error fetching exchange rates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch exchange rates' },
      { status: 500 }
    );
  }
}

