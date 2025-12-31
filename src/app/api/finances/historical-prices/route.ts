import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * Fetch historical stock prices from Yahoo Finance
 * This is a free alternative that doesn't require an API key
 */
async function fetchYahooFinanceHistory(symbol: string, startDate: Date, endDate: Date) {
  try {
    // Yahoo Finance API endpoint (free, no API key needed)
    // Format: https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?period1={start}&period2={end}&interval=1d
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      return null;
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    
    // Map timestamps to close prices
    const prices: Array<{ date: string; price: number }> = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] !== null && closes[i] !== undefined) {
        const date = new Date(timestamps[i] * 1000);
        prices.push({
          date: date.toISOString().split('T')[0], // YYYY-MM-DD format
          price: closes[i],
        });
      }
    }

    return prices;
  } catch (error) {
    console.error(`Error fetching Yahoo Finance data for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch historical crypto prices from CoinGecko (free API)
 */
async function fetchCoinGeckoHistory(symbol: string, startDate: Date, endDate: Date) {
  try {
    // CoinGecko free API - map common symbols
    const coinIdMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'XRP': 'ripple',
      'USDC': 'usd-coin',
      'DOGE': 'dogecoin',
      'ADA': 'cardano',
      'TRX': 'tron',
    };

    const coinId = coinIdMap[symbol.toUpperCase()] || symbol.toLowerCase();
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${startTimestamp}&to=${endTimestamp}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.prices || data.prices.length === 0) {
      return null;
    }

    // Convert to daily prices (take first price of each day)
    const dailyPrices = new Map<string, number>();
    data.prices.forEach(([timestamp, price]: [number, number]) => {
      const date = new Date(timestamp);
      const dateKey = date.toISOString().split('T')[0];
      if (!dailyPrices.has(dateKey)) {
        dailyPrices.set(dateKey, price);
      }
    });

    return Array.from(dailyPrices.entries()).map(([date, price]) => ({
      date,
      price,
    }));
  } catch (error) {
    console.error(`Error fetching CoinGecko data for ${symbol}:`, error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const assetType = searchParams.get('type') || 'stock'; // 'stock' or 'crypto'

    if (!symbol || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: symbol, startDate, endDate' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    let prices;
    if (assetType === 'crypto') {
      prices = await fetchCoinGeckoHistory(symbol, start, end);
    } else {
      prices = await fetchYahooFinanceHistory(symbol, start, end);
    }

    if (!prices || prices.length === 0) {
      return NextResponse.json(
        { error: 'No historical data found for this symbol' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: prices });
  } catch (error: any) {
    console.error('Error fetching historical prices:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch historical prices' },
      { status: 500 }
    );
  }
}

