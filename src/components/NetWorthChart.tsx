'use client';

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { format, parseISO, startOfDay, subDays, subMonths, subYears, eachDayOfInterval, addDays, startOfYear, eachYearOfInterval } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getDominantColor, getIconUrl } from '@/lib/notion-color';
import { AreaChart as AreaChartIcon, BarChart3 } from 'lucide-react';

interface IndividualInvestment {
  id: string;
  purchase_date: string | null;
  purchase_price: number | null;
  quantity: number | null;
  current_price: number | null;
  current_value: number | null;
  current_worth?: number;
  currency: string | null;
  properties?: any;
  asset?: {
    id: string;
    symbol: string | null;
    name: string;
    icon?: any | null;
    icon_url?: string | null;
    color_settings?: { primary?: string; badge?: string } | null;
  } | null;
}

interface NetWorthChartProps {
  investments: IndividualInvestment[];
  selectedCurrency: string;
  exchangeRates: Record<string, number> | null;
}

interface HistoricalPrice {
  date: string;
  price: number;
}

type TimePeriod = 30 | 90 | 180 | 365 | 730 | 'all';

const TIME_PERIODS: { period: TimePeriod; label: string }[] = [
  { period: 30, label: '30d' },
  { period: 90, label: '90d' },
  { period: 180, label: '180d' },
  { period: 365, label: '1y' },
  { period: 730, label: '2y' },
  { period: 'all', label: 'All' },
];

type ChartMode = 'area' | 'bar';

export function NetWorthChart({ investments, selectedCurrency, exchangeRates }: NetWorthChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all');
  const [chartMode, setChartMode] = useState<ChartMode>('area');
  const [historicalPrices, setHistoricalPrices] = useState<Map<string, Map<string, number>>>(new Map());
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [assetColors, setAssetColors] = useState<Map<string, string>>(new Map());

  // Extract colors from asset icons or use color_settings
  React.useEffect(() => {
    const extractAssetColors = async () => {
      const colorMap = new Map<string, string>();
      const uniqueAssets = new Map<string, { 
        icon?: any; 
        icon_url?: string | null;
        color_settings?: { primary?: string; badge?: string } | null;
      }>();

      investments.forEach((inv) => {
        if (inv.asset?.id && inv.asset?.symbol) {
          const assetId = inv.asset.id;
          if (!uniqueAssets.has(assetId)) {
            uniqueAssets.set(assetId, {
              icon: inv.asset.icon,
              icon_url: inv.asset.icon_url,
              color_settings: inv.asset.color_settings,
            });
          }
        }
      });

      const colorPromises = Array.from(uniqueAssets.entries()).map(async ([assetId, asset]) => {
        // First priority: use manual color_settings if provided
        if (asset.color_settings?.primary || asset.color_settings?.badge) {
          colorMap.set(assetId, asset.color_settings.primary || asset.color_settings.badge || '#8b5cf6');
          return;
        }

        // Fallback: extract color from icon
        const iconUrl = asset.icon_url || getIconUrl(asset.icon);
        if (iconUrl) {
          try {
            const color = await getDominantColor(iconUrl);
            colorMap.set(assetId, color);
          } catch (error) {
            console.error(`Failed to extract color for asset ${assetId}:`, error);
            colorMap.set(assetId, '#8b5cf6'); // Default purple
          }
        } else {
          colorMap.set(assetId, '#8b5cf6'); // Default purple
        }
      });

      await Promise.all(colorPromises);
      setAssetColors(colorMap);
    };

    extractAssetColors();
  }, [investments]);

  // Fetch historical prices for assets with symbols
  React.useEffect(() => {
    const fetchHistoricalPrices = async () => {
      // Get unique assets with symbols
      const assetsWithSymbols = new Map<string, { symbol: string; earliestDate: Date }>();
      
      investments.forEach((inv) => {
        if (inv.asset?.symbol && inv.purchase_date) {
          const symbol = inv.asset.symbol.toUpperCase();
          // Skip USD and other currencies - they don't need historical prices (1 USD = 1 USD always)
          if (symbol === 'USD' || symbol === 'EUR' || symbol === 'GBP' || symbol === 'JPY' || symbol === 'CAD' || symbol === 'AUD') {
            return;
          }
          const purchaseDate = new Date(inv.purchase_date);
          
          if (!assetsWithSymbols.has(symbol) || purchaseDate < assetsWithSymbols.get(symbol)!.earliestDate) {
            assetsWithSymbols.set(symbol, {
              symbol,
              earliestDate: purchaseDate,
            });
          }
        }
      });

      if (assetsWithSymbols.size === 0) return;

      setLoadingPrices(true);
      const priceMap = new Map<string, Map<string, number>>();

      // Calculate date range
      const today = new Date();
      let startDate = new Date();
      
      // Find earliest investment date
      investments.forEach((inv) => {
        if (inv.purchase_date) {
          const date = new Date(inv.purchase_date);
          if (date < startDate) {
            startDate = date;
          }
        }
      });

      // Fetch prices for each asset
      const fetchPromises = Array.from(assetsWithSymbols.entries()).map(async ([symbol, { earliestDate }]) => {
        try {
          const response = await fetch(
            `/api/finances/historical-prices?symbol=${encodeURIComponent(symbol)}&startDate=${earliestDate.toISOString().split('T')[0]}&endDate=${today.toISOString().split('T')[0]}&type=stock`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.length > 0) {
              const datePriceMap = new Map<string, number>();
              data.data.forEach((item: HistoricalPrice) => {
                datePriceMap.set(item.date, item.price);
              });
              priceMap.set(symbol, datePriceMap);
            }
          }
        } catch (error) {
          console.error(`Failed to fetch historical prices for ${symbol}:`, error);
        }
      });

      await Promise.all(fetchPromises);
      setHistoricalPrices(priceMap);
      setLoadingPrices(false);
    };

    fetchHistoricalPrices();
  }, [investments]);

  const chartData = useMemo(() => {
    // Filter investments with purchase dates
    const investmentsWithDates = investments.filter(
      (inv) => inv.purchase_date !== null && inv.purchase_date !== undefined
    );

    if (investmentsWithDates.length === 0) {
      return [];
    }

    // Sort investments by purchase date
    const sortedInvestments = [...investmentsWithDates].sort((a, b) => {
      const dateA = new Date(a.purchase_date!).getTime();
      const dateB = new Date(b.purchase_date!).getTime();
      return dateA - dateB;
    });

    // Calculate date range based on selected period
    const today = new Date();
    let cutoffDate: Date | null = null;
    
    if (selectedPeriod !== 'all') {
      if (selectedPeriod <= 365) {
        cutoffDate = subDays(today, selectedPeriod);
      } else {
        cutoffDate = subYears(today, selectedPeriod / 365);
      }
    }

    // Get unique dates based on selected period
    let dateKeys: string[] = [];
    
    if (cutoffDate) {
      // For shorter periods, add more granularity (daily points)
      // For longer periods, use investment dates only
      const startDate = startOfDay(cutoffDate);
      const endDate = startOfDay(today);
      
      if (selectedPeriod === 30 || selectedPeriod === 90) {
        // For 30d and 90d: show daily data points
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        dateKeys = allDays.map(day => format(day, 'yyyy-MM-dd'));
      } else if (selectedPeriod === 180) {
        // For 180d: show every 2-3 days
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        dateKeys = allDays.filter((_, index) => index % 2 === 0).map(day => format(day, 'yyyy-MM-dd'));
      } else {
        // For 1y+: use all dates in the range (daily for better X-axis coverage)
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        // Sample every N days based on period length to keep performance reasonable
        let sampleInterval = 1;
        if (selectedPeriod === 365) {
          sampleInterval = 7; // Weekly for 1y
        } else if (selectedPeriod === 730) {
          sampleInterval = 14; // Bi-weekly for 2y
        }
        dateKeys = allDays
          .filter((_, index) => index % sampleInterval === 0 || index === allDays.length - 1)
          .map(day => format(day, 'yyyy-MM-dd'));
        
        // Ensure investment dates are included
        sortedInvestments.forEach((inv) => {
          const date = startOfDay(parseISO(inv.purchase_date!));
          if (date >= cutoffDate) {
            const dateStr = format(date, 'yyyy-MM-dd');
            if (!dateKeys.includes(dateStr)) {
              dateKeys.push(dateStr);
            }
          }
        });
        
        // Ensure start and end dates are included
        const startDateStr = format(startDate, 'yyyy-MM-dd');
        const endDateStr = format(endDate, 'yyyy-MM-dd');
        if (!dateKeys.includes(startDateStr)) dateKeys.push(startDateStr);
        if (!dateKeys.includes(endDateStr)) dateKeys.push(endDateStr);
        
        // Sort and deduplicate
        dateKeys = Array.from(new Set(dateKeys)).sort();
      }
    } else {
      // For "All": use all dates from first investment to today
      const firstInvDate = sortedInvestments[0] 
        ? startOfDay(parseISO(sortedInvestments[0].purchase_date!)) 
        : today;
      const startDate = firstInvDate;
      const endDate = startOfDay(today);
      
      // Generate all dates in the range (sample every 7 days for performance)
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      dateKeys = allDays
        .filter((_, index) => index % 7 === 0 || index === allDays.length - 1)
        .map(day => format(day, 'yyyy-MM-dd'));
      
      // Ensure all investment dates are included
      sortedInvestments.forEach((inv) => {
        const date = startOfDay(parseISO(inv.purchase_date!));
        const dateStr = format(date, 'yyyy-MM-dd');
        if (!dateKeys.includes(dateStr)) {
          dateKeys.push(dateStr);
        }
      });
      
      // Ensure start and end dates are included
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      if (!dateKeys.includes(startDateStr)) dateKeys.push(startDateStr);
      if (!dateKeys.includes(endDateStr)) dateKeys.push(endDateStr);
      
      // Sort and deduplicate
      dateKeys = Array.from(new Set(dateKeys)).sort();
    }

    // Get unique assets for bar chart breakdown
    const uniqueAssets = new Map<string, { id: string; name: string; symbol: string | null }>();
    sortedInvestments.forEach((inv) => {
      if (inv.asset?.id) {
        if (!uniqueAssets.has(inv.asset.id)) {
          uniqueAssets.set(inv.asset.id, {
            id: inv.asset.id,
            name: inv.asset.name,
            symbol: inv.asset.symbol,
          });
        }
      }
    });

    // For each date, calculate cumulative net worth and asset breakdowns
    const finalData: Array<{ date: string; netWorth: number; [assetId: string]: number | string }> = [];

    for (const dateKey of dateKeys) {
      const date = parseISO(dateKey);
      
      // Get all investments made up to and including this date
      const investmentsUpToDate = sortedInvestments.filter((inv) => {
        const invDate = startOfDay(parseISO(inv.purchase_date!));
        return invDate.getTime() <= date.getTime();
      });

      // Calculate net worth at this date point using historical prices when available
      const isToday = dateKey === format(startOfDay(today), 'yyyy-MM-dd');
      
      // Track per-asset worth for bar chart
      const assetWorthMap = new Map<string, number>();
      
      const totalNetWorth = investmentsUpToDate.reduce((sum, inv) => {
        // Skip only if quantity is null/undefined, not if it's negative (negative = sale)
        if (inv.quantity === null || inv.quantity === undefined) return sum;

        let worth = 0;

        // Check if this is USD or another currency (cash) - these don't change value
        const isCurrency = inv.asset?.symbol && ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].includes(inv.asset.symbol.toUpperCase());
        
        if (isCurrency) {
          // For currencies, always use the purchase amount (1 USD = 1 USD always)
          worth = inv.properties?.["How much?"] !== undefined
            ? Number(inv.properties["How much?"])
            : (inv.purchase_price !== null && inv.quantity !== null
                ? Number(inv.purchase_price) * Number(inv.quantity)
                : 0);
        } else if (isToday) {
          // For today, use current prices
          worth = inv.current_worth !== undefined
            ? inv.current_worth
            : (inv.current_value !== null
                ? inv.current_value
                : (inv.current_price && inv.quantity
                    ? Number(inv.current_price) * Number(inv.quantity)
                    : 0));
        } else if (inv.asset?.symbol) {
          // Try to use historical price for this date
          const symbol = inv.asset.symbol.toUpperCase();
          const symbolPrices = historicalPrices.get(symbol);
          
          if (symbolPrices) {
            // Find closest price on or before this date
            let price = null;
            let checkDate = new Date(dateKey);
            
            // Look back up to 7 days to find a price (handles weekends/holidays)
            for (let i = 0; i < 7; i++) {
              const checkDateStr = format(checkDate, 'yyyy-MM-dd');
              if (symbolPrices.has(checkDateStr)) {
                price = symbolPrices.get(checkDateStr);
                break;
              }
              checkDate = subDays(checkDate, 1);
            }
            
            if (price !== null) {
              worth = Number(price) * Number(inv.quantity);
            } else {
              // Fallback to purchase price if no historical price found
              worth = inv.properties?.["How much?"] !== undefined
                ? Number(inv.properties["How much?"])
                : (inv.purchase_price !== null && inv.quantity !== null
                    ? Number(inv.purchase_price) * Number(inv.quantity)
                    : 0);
            }
          } else {
            // No historical prices available, use purchase price
            worth = inv.properties?.["How much?"] !== undefined
              ? Number(inv.properties["How much?"])
              : (inv.purchase_price !== null && inv.quantity !== null
                  ? Number(inv.purchase_price) * Number(inv.quantity)
                  : 0);
          }
        } else {
          // No asset symbol, use purchase price
          worth = inv.properties?.["How much?"] !== undefined
            ? Number(inv.properties["How much?"])
            : (inv.purchase_price !== null && inv.quantity !== null
                ? Number(inv.purchase_price) * Number(inv.quantity)
                : 0);
        }

        // Track per-asset worth for bar chart (include negative values for sales)
        if (inv.asset?.id && worth !== 0) {
          const currentAssetWorth = assetWorthMap.get(inv.asset.id) || 0;
          assetWorthMap.set(inv.asset.id, currentAssetWorth + worth);
        }

        // Add worth to total (negative values for sales will subtract)
        return sum + worth;
      }, 0);

      const dataPoint: { date: string; netWorth: number; [assetId: string]: number | string } = {
        date: dateKey,
        netWorth: totalNetWorth,
      };

      // Add asset breakdowns for bar chart
      uniqueAssets.forEach((asset) => {
        dataPoint[asset.id] = assetWorthMap.get(asset.id) || 0;
      });

      finalData.push(dataPoint);
    }

    // Filter data points based on selected period
    const filteredData = cutoffDate
      ? finalData.filter((point) => {
          const pointDate = parseISO(point.date);
          return pointDate >= cutoffDate!;
        })
      : finalData;

    return { data: filteredData, assets: Array.from(uniqueAssets.values()) };
  }, [investments, selectedPeriod, historicalPrices]);

  const chartDataArray = Array.isArray(chartData) ? [] : (chartData.data || []);
  const chartAssets = Array.isArray(chartData) ? [] : (chartData.assets || []);

  // Calculate Jan 1st dates for reference lines (using closest date in chart data)
  const jan1stDates = useMemo(() => {
    if (chartDataArray.length === 0) return [];
    
    const dates = chartDataArray.map(d => parseISO(d.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Get all Jan 1st dates between min and max date, finding closest chart date for each
    const jan1stLines: string[] = [];
    const startYear = minDate.getFullYear();
    const endYear = maxDate.getFullYear();
    
    for (let year = startYear; year <= endYear; year++) {
      const jan1st = new Date(year, 0, 1);
      
      // Only include if Jan 1st is within the date range
      if (jan1st >= minDate && jan1st <= maxDate) {
        // Find the closest date in chart data to this Jan 1st
        const jan1stTime = jan1st.getTime();
        let closestDate: Date | null = null;
        let minDiff = Infinity;
        
        for (const chartDate of dates) {
          const diff = Math.abs(chartDate.getTime() - jan1stTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestDate = chartDate;
          }
        }
        
        // Use the closest date from chart data
        if (closestDate) {
          const closestDateStr = format(closestDate, 'yyyy-MM-dd');
          // Only add if not already in the list (to avoid duplicates)
          if (!jan1stLines.includes(closestDateStr)) {
            jan1stLines.push(closestDateStr);
          }
        }
      }
    }
    
    return jan1stLines;
  }, [chartDataArray]);

  if (chartDataArray.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Net Worth Over Time</h3>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {loadingPrices ? 'Loading historical data...' : 'No investment data available'}
        </div>
      </Card>
    );
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

  // Format currency for tooltip
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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Net Worth Over Time</h3>
          {loadingPrices && (
            <span className="text-xs text-muted-foreground">Loading historical data...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border-r border-border pr-2">
            <Button
              variant={chartMode === 'area' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartMode('area')}
              className={cn(
                'h-7 px-2',
                chartMode === 'area' && 'bg-primary text-primary-foreground'
              )}
            >
              <AreaChartIcon className="w-4 h-4" />
            </Button>
            <Button
              variant={chartMode === 'bar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setChartMode('bar')}
              className={cn(
                'h-7 px-2',
                chartMode === 'bar' && 'bg-primary text-primary-foreground'
              )}
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {TIME_PERIODS.map(({ period, label }) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  'h-7 px-2 text-xs',
                  selectedPeriod === period && 'bg-primary text-primary-foreground'
                )}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        {chartMode === 'area' ? (
          <AreaChart data={chartDataArray} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#228B22" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#228B22" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'MMM d')}
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
              className="text-xs"
              stroke="currentColor"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                      <p className="text-sm font-medium mb-1">
                        {format(parseISO(data.date), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Net Worth: </span>
                        <span className="font-semibold">{formatCurrency(data.netWorth)}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="#228B22"
              fillOpacity={1}
              fill="url(#colorNetWorth)"
            />
            {/* Vertical lines for each Jan 1st */}
            {jan1stDates.map((dateStr) => (
              <ReferenceLine
                key={`jan1-area-${dateStr}`}
                x={dateStr}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                strokeOpacity={0.6}
              />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={chartDataArray} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              {chartAssets.map((asset) => {
                const color = assetColors.get(asset.id) || '#8b5cf6';
                return (
                  <linearGradient key={`gradient-${asset.id}`} id={`gradient-bar-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                  </linearGradient>
                );
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'MMM d')}
              className="text-xs"
              stroke="currentColor"
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value)}
              className="text-xs"
              stroke="currentColor"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const total = data.netWorth || 0;
                  return (
                    <div className="bg-background border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
                      <p className="text-sm font-medium mb-2">
                        {format(parseISO(data.date), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm mb-2">
                        <span className="text-muted-foreground">Net Worth: </span>
                        <span className="font-semibold">{formatCurrency(total)}</span>
                      </p>
                      <div className="space-y-1 border-t border-border pt-2">
                        {chartAssets
                          .map((asset) => {
                            const value = data[asset.id] || 0;
                            return { asset, value };
                          })
                          .filter(({ value }) => value !== 0) // Include both positive and negative values
                          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)) // Sort by absolute value descending
                          .map(({ asset, value }) => {
                            const color = assetColors.get(asset.id) || '#8b5cf6';
                            return (
                              <div key={asset.id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="text-muted-foreground">
                                    {asset.symbol || asset.name}
                                  </span>
                                </div>
                                <span className={cn(
                                  "font-medium",
                                  value < 0 && "text-red-600 dark:text-red-400"
                                )}>
                                  {formatCurrency(value)}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            {chartAssets.map((asset) => {
              const color = assetColors.get(asset.id) || '#8b5cf6';
              return (
                <Bar
                  key={asset.id}
                  dataKey={asset.id}
                  stackId="netWorth"
                  fill={`url(#gradient-bar-${asset.id})`}
                  stroke={color}
                  strokeWidth={0}
                />
              );
            })}
            {/* Vertical lines for each Jan 1st */}
            {jan1stDates.map((dateStr) => (
              <ReferenceLine
                key={`jan1-bar-${dateStr}`}
                x={dateStr}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                strokeOpacity={0.6}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </Card>
  );
}

