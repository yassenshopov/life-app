'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts';
import { format, parseISO, subYears, subDays, startOfDay, eachDayOfInterval } from 'date-fns';
import { getDominantColor, getIconUrl } from '@/lib/notion-color';

interface Investment {
  id: string;
  purchase_date: string | null;
  purchase_price: number | null;
  quantity: number | null;
  current_price: number | null;
  current_value: number | null;
  current_worth?: number;
  currency: string | null;
  properties?: any;
}

interface AssetMiniChartProps {
  symbol: string | null;
  icon?: any | null;
  iconUrl?: string | null;
  height?: number;
  investments?: Investment[];
  colorSettings?: { primary?: string; badge?: string } | null;
  selectedCurrency: string;
  exchangeRates: Record<string, number> | null;
}

interface HistoricalPrice {
  date: string;
  price: number;
}

interface InvestmentValue {
  date: string;
  value: number;
}

export function AssetMiniChart({
  symbol,
  icon,
  iconUrl,
  height = 60,
  investments = [],
  colorSettings,
  selectedCurrency,
  exchangeRates,
}: AssetMiniChartProps) {
  const [historicalPricesMap, setHistoricalPricesMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [assetColor, setAssetColor] = useState<string>('#228B22');

  // Extract color from asset icon or use color_settings
  useEffect(() => {
    // First priority: use manual color_settings if provided
    if (colorSettings?.primary || colorSettings?.badge) {
      setAssetColor(colorSettings.primary || colorSettings.badge || '#228B22');
      return;
    }

    // Fallback: extract color from icon
    const extractColor = async () => {
      const iconUrlToUse = iconUrl || getIconUrl(icon);
      if (iconUrlToUse) {
        try {
          const color = await getDominantColor(iconUrlToUse);
          setAssetColor(color);
        } catch (error) {
          console.error('Failed to extract color for asset chart:', error);
        }
      }
    };

    extractColor();
  }, [icon, iconUrl, colorSettings]);

  // Fetch historical prices from first investment to today
  useEffect(() => {
    if (!symbol || investments.length === 0) return;

    // Skip currencies - they don't need historical data
    const isCurrency = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].includes(symbol.toUpperCase());
    if (isCurrency) {
      return;
    }

    // Find earliest investment date
    const investmentsWithDates = investments.filter((inv) => inv.purchase_date !== null);

    if (investmentsWithDates.length === 0) {
      return;
    }

    const earliestDate = investmentsWithDates.reduce((earliest, inv) => {
      const invDate = new Date(inv.purchase_date!);
      return invDate < earliest ? invDate : earliest;
    }, new Date(investmentsWithDates[0].purchase_date!));

    const fetchPrices = async () => {
      setLoading(true);
      try {
        const endDate = new Date();
        const startDate = earliestDate;

        // Limit to max 5 years back for API limits (or adjust based on your API)
        const maxYearsBack = 5;
        const maxStartDate = subYears(endDate, maxYearsBack);
        const actualStartDate = startDate < maxStartDate ? maxStartDate : startDate;

        // Determine if it's crypto or stock based on common crypto symbols
        const isCrypto = [
          'BTC',
          'ETH',
          'XRP',
          'ADA',
          'DOT',
          'LINK',
          'LTC',
          'BCH',
          'XLM',
          'EOS',
          'TRX',
          'XMR',
          'DASH',
          'ZEC',
        ].includes(symbol.toUpperCase());
        const assetType = isCrypto ? 'crypto' : 'stock';

        const response = await fetch(
          `/api/finances/historical-prices?symbol=${encodeURIComponent(symbol)}&startDate=${
            actualStartDate.toISOString().split('T')[0]
          }&endDate=${endDate.toISOString().split('T')[0]}&type=${assetType}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.length > 0) {
            // Store as a map for quick lookup
            const priceMap = new Map<string, number>();
            data.data.forEach((item: HistoricalPrice) => {
              priceMap.set(item.date, item.price);
            });
            setHistoricalPricesMap(priceMap);
          }
        }
      } catch (error) {
        console.error(`Failed to fetch historical prices for ${symbol}:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
  }, [symbol, investments]);

  // Calculate investment value over time
  const chartData = useMemo(() => {
    if (!symbol || investments.length === 0 || historicalPricesMap.size === 0) {
      return [];
    }

    const isCurrency = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].includes(symbol.toUpperCase());

    // Filter investments with purchase dates
    const investmentsWithDates = investments.filter(
      (inv) => inv.purchase_date !== null && inv.quantity !== null && inv.quantity !== undefined
    );

    if (investmentsWithDates.length === 0) {
      return [];
    }

    // Sort by purchase date
    const sortedInvestments = [...investmentsWithDates].sort((a, b) => {
      const dateA = new Date(a.purchase_date!).getTime();
      const dateB = new Date(b.purchase_date!).getTime();
      return dateA - dateB;
    });

    // Get date range from first investment to today
    const today = new Date();
    const firstInvestmentDate = new Date(sortedInvestments[0].purchase_date!);
    const startDate = firstInvestmentDate;

    // Generate date points - sample more frequently for shorter periods, less for longer
    const allDays = eachDayOfInterval({ start: startDate, end: today });
    const daysDiff = allDays.length;

    // Sample every N days based on total period length
    // For periods < 90 days: every 2 days
    // For periods < 365 days: every 5 days
    // For periods < 730 days: every 10 days
    // For longer periods: every 20 days
    let sampleInterval = 20;
    if (daysDiff < 90) {
      sampleInterval = 2;
    } else if (daysDiff < 365) {
      sampleInterval = 5;
    } else if (daysDiff < 730) {
      sampleInterval = 10;
    }

    const datePoints = allDays.filter(
      (_, index) => index % sampleInterval === 0 || index === allDays.length - 1
    );

    // Calculate cumulative value at each date point
    const valueData: InvestmentValue[] = datePoints.map((date) => {
      const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
      const isToday = dateStr === format(startOfDay(today), 'yyyy-MM-dd');

      // Get all investments made up to this date
      const investmentsUpToDate = sortedInvestments.filter((inv) => {
        const invDate = startOfDay(parseISO(inv.purchase_date!));
        return invDate.getTime() <= date.getTime();
      });

      // Calculate total value at this date
      const totalValue = investmentsUpToDate.reduce((sum, inv) => {
        if (inv.quantity === null || inv.quantity === undefined) return sum;

        let worth = 0;

        if (isCurrency) {
          // For currencies, always use the purchase amount
          worth =
            inv.properties?.['How much?'] !== undefined
              ? Number(inv.properties['How much?'])
              : inv.purchase_price !== null && inv.quantity !== null
              ? Number(inv.purchase_price) * Number(inv.quantity)
              : 0;
        } else if (isToday) {
          // For today, use current worth if available
          worth =
            inv.current_worth !== undefined
              ? inv.current_worth
              : inv.current_value !== null
              ? inv.current_value
              : inv.current_price && inv.quantity
              ? Number(inv.current_price) * Number(inv.quantity)
              : 0;
        } else {
          // Use historical price for this date
          let price = null;
          let checkDate = new Date(date);

          // Look back up to 7 days to find a price
          for (let i = 0; i < 7; i++) {
            const checkDateStr = format(checkDate, 'yyyy-MM-dd');
            if (historicalPricesMap.has(checkDateStr)) {
              price = historicalPricesMap.get(checkDateStr)!;
              break;
            }
            checkDate = subDays(checkDate, 1);
          }

          if (price !== null) {
            worth = Number(price) * Number(inv.quantity);
          } else {
            // Fallback to purchase price if no historical price found
            worth =
              inv.properties?.['How much?'] !== undefined
                ? Number(inv.properties['How much?'])
                : inv.purchase_price !== null && inv.quantity !== null
                ? Number(inv.purchase_price) * Number(inv.quantity)
                : 0;
          }
        }

        return sum + worth;
      }, 0);

      return {
        date: dateStr,
        value: totalValue,
      };
    });

    return valueData;
  }, [symbol, investments, historicalPricesMap]);

  if (!symbol || loading || chartData.length === 0) {
    return null;
  }

  // Convert currency
  const convertCurrency = (amount: number, fromCurrency: string = 'USD'): number => {
    if (amount === 0 || !exchangeRates || selectedCurrency === fromCurrency) return amount;
    if (fromCurrency === 'USD') {
      const rate = exchangeRates[selectedCurrency];
      return rate ? amount * rate : amount;
    }
    const fromRate = exchangeRates[fromCurrency];
    const toRate = exchangeRates[selectedCurrency];
    if (fromRate && toRate) {
      const usdAmount = amount / fromRate;
      return usdAmount * toRate;
    }
    return amount;
  };

  const formatCurrency = (value: number) => {
    const convertedValue = convertCurrency(value);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(convertedValue);
  };

  return (
    <div className="mt-3 h-[60px] w-full">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={assetColor} stopOpacity={0.8} />
              <stop offset="95%" stopColor={assetColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={assetColor}
            strokeWidth={1.5}
            fill={`url(#gradient-${symbol})`}
            dot={false}
            activeDot={{ r: 3, fill: assetColor }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-background border border-border rounded-lg p-2 shadow-lg text-xs">
                    <p className="font-medium mb-1">{format(parseISO(data.date), 'MMM d, yyyy')}</p>
                    <p className="text-muted-foreground">{formatCurrency(data.value)}</p>
                  </div>
                );
              }
              return null;
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
