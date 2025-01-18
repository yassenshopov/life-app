import { Client } from '@notionhq/client';
import { NextResponse } from 'next/server';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

interface Asset {
  id: string;
  // symbol: string;
  name: string;
  ticker: string;
  price: number;
  // change: number;
  units: number;
  // value: number;
}

export async function GET() {
  try {
    const databaseId = process.env.NOTION_FINANCES_ASSETS_DB_ID;
    
    if (!databaseId) {
      return NextResponse.json(
        { error: 'Database ID is required' },
        { status: 400 }
      );
    }

    let allResults: Asset[] = [];
    let hasMore = true;
    let nextCursor: string | undefined = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: databaseId,
        sorts: [
          {
            property: 'Units Sum',
            direction: 'descending',
          },
        ],
        start_cursor: nextCursor,
      });

      const assets = response.results.map((page: any) => {
        const price = page.properties["Current Price"]?.number || 0;
        const units = page.properties["Units Sum"]?.rollup?.number || 0;
        const avgPrice = page.properties["AVG Price"]?.rollup?.number || 0;
        const invested = page.properties["Money invested"]?.rollup?.number || 0;
        const growth = (page.properties["Growth"]?.formula?.number || 0) * 100;
        const pnl = page.properties["P/L"]?.formula?.number || 0;
        const portfolioPercentage = (page.properties["% of portfolio"]?.formula?.number || 0) * 100;
        
        return {
          id: page.id,
          name: page.properties.Name?.title[0]?.plain_text || '',
          ticker: page.properties.Ticker?.select?.name?.toLowerCase() || '',
          price,
          units,
          value: price * units,
          avgPrice,
          invested,
          growth,
          pnl,
          portfolioPercentage,
          type: 'stock',
          symbol: page.properties.Ticker?.select?.name?.toUpperCase() || '',
          coverUrl: page.cover?.external?.url || page.cover?.file?.url || null,
        };
      });

      allResults = [...allResults, ...assets];
      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;
    }

    return NextResponse.json(allResults);
  } catch (error) {
    console.error('Error fetching assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    );
  }
} 