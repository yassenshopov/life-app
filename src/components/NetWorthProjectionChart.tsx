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
import { format, parseISO, startOfDay, startOfMonth, subDays, addDays, addYears, addMonths, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { getDominantColor, getIconUrl } from '@/lib/notion-color';
import { PageIcon } from '@/components/PageIcon';
import { AreaChart as AreaChartIcon, BarChart3, Calendar, Filter, Building2, DollarSign, TrendingUp } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

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

interface NetWorthProjectionChartProps {
  investments: IndividualInvestment[];
  selectedCurrency: string;
  exchangeRates: Record<string, number> | null;
}

interface HistoricalPrice {
  date: string;
  price: number;
}

type ChartMode = 'area' | 'bar';

// Cookie helper functions
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, days: number = 365) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
}

export function NetWorthProjectionChart({ investments, selectedCurrency, exchangeRates }: NetWorthProjectionChartProps) {
  // Initialize state from cookies
  const [chartMode, setChartMode] = useState<ChartMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('projection-chart-mode');
      return (saved === 'area' || saved === 'bar') ? saved : 'area';
    }
    return 'area';
  });
  const [viewMode, setViewMode] = useState<'networth' | 'contributions'>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('projection-view-mode');
      return (saved === 'networth' || saved === 'contributions') ? saved : 'networth';
    }
    return 'networth';
  });
  const [historicalPrices, setHistoricalPrices] = useState<Map<string, Map<string, number>>>(new Map());
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [assetColors, setAssetColors] = useState<Map<string, string>>(new Map());
  const [projectionDate, setProjectionDate] = useState<Date | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('projection-date');
      if (saved) {
        try {
          const date = new Date(saved);
          if (!isNaN(date.getTime()) && date > new Date()) {
            return date;
          }
        } catch (e) {
          console.warn('Failed to parse projection date from cookie:', e);
        }
      }
    }
    return null;
  });
  const [projectedPrices, setProjectedPrices] = useState<Map<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('projection-prices');
      if (saved) {
        try {
          const prices = JSON.parse(saved);
          return new Map(Object.entries(prices).map(([k, v]) => [k, Number(v)]));
        } catch (e) {
          console.warn('Failed to parse projected prices from cookie:', e);
        }
      }
    }
    return new Map();
  });
  const [showProjectionSettings, setShowProjectionSettings] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('projection-selected-assets');
      if (saved) {
        try {
          const ids = JSON.parse(saved);
          return new Set(Array.isArray(ids) ? ids : []);
        } catch (e) {
          console.warn('Failed to parse selected assets from cookie:', e);
        }
      }
    }
    return new Set();
  });
  const [showAssetFilter, setShowAssetFilter] = useState(false);
  const [localProjectedPrices, setLocalProjectedPrices] = useState<Map<string, number>>(new Map());
  const debounceTimerRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [selectedContributionYear, setSelectedContributionYear] = useState(1);
  
  // Reset selected year when projection date changes
  React.useEffect(() => {
    if (projectionDate) {
      const daysDiff = Math.ceil((projectionDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const yearsDiff = daysDiff / 365;
      const maxYear = Math.ceil(yearsDiff);
      if (selectedContributionYear > maxYear) {
        setSelectedContributionYear(1);
      }
    }
  }, [projectionDate]);
  
  // Funding mode state
  const [continueFunding, setContinueFunding] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('projection-continue-funding');
      return saved === 'true';
    }
    return false;
  });
  const [monthlyContribution, setMonthlyContribution] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('projection-monthly-contribution');
      return saved ? parseFloat(saved) : 0;
    }
    return 0;
  });
  const [progressiveGrowth, setProgressiveGrowth] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('projection-progressive-growth');
      return saved === 'true';
    }
    return false;
  });
  const [growthRate, setGrowthRate] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('projection-growth-rate');
      return saved ? parseFloat(saved) : 0;
    }
    return 0;
  });

  // Get unique assets
  const uniqueAssets = useMemo(() => {
    const assetsMap = new Map<string, {
      id: string;
      symbol: string | null;
      name: string;
      icon?: any | null;
      icon_url?: string | null;
      color_settings?: { primary?: string; badge?: string } | null;
    }>();
    
    investments.forEach((inv) => {
      if (inv.asset?.id && inv.asset?.symbol) {
        if (!assetsMap.has(inv.asset.id)) {
          assetsMap.set(inv.asset.id, {
            id: inv.asset.id,
            symbol: inv.asset.symbol,
            name: inv.asset.name,
            icon: inv.asset.icon,
            icon_url: inv.asset.icon_url,
            color_settings: inv.asset.color_settings,
          });
        }
      }
    });
    
    return Array.from(assetsMap.values());
  }, [investments]);

  // Initialize and validate selectedAssetIds
  React.useEffect(() => {
    const availableAssetIds = new Set(uniqueAssets.map(a => a.id));
    
    if (selectedAssetIds.size === 0 && uniqueAssets.length > 0) {
      // Initialize with all assets if none selected
      setSelectedAssetIds(availableAssetIds);
      setCookie('projection-selected-assets', JSON.stringify(Array.from(availableAssetIds)));
    } else if (selectedAssetIds.size > 0) {
      // Validate: remove any selected assets that no longer exist
      const validSelectedIds = new Set<string>();
      selectedAssetIds.forEach(id => {
        if (availableAssetIds.has(id)) {
          validSelectedIds.add(id);
        }
      });
      
      // If no valid assets remain, select all available
      if (validSelectedIds.size === 0 && availableAssetIds.size > 0) {
        setSelectedAssetIds(availableAssetIds);
        setCookie('projection-selected-assets', JSON.stringify(Array.from(availableAssetIds)));
      } else if (validSelectedIds.size !== selectedAssetIds.size) {
        // Some assets were removed, update selection
        setSelectedAssetIds(validSelectedIds);
        setCookie('projection-selected-assets', JSON.stringify(Array.from(validSelectedIds)));
      }
    }
  }, [uniqueAssets]);

  // Save chart mode to cookie
  React.useEffect(() => {
    setCookie('projection-chart-mode', chartMode);
  }, [chartMode]);
  
  // Save view mode to cookie
  React.useEffect(() => {
    setCookie('projection-view-mode', viewMode);
  }, [viewMode]);

  // Save selected assets to cookie
  React.useEffect(() => {
    if (selectedAssetIds.size > 0) {
      setCookie('projection-selected-assets', JSON.stringify(Array.from(selectedAssetIds)));
    }
  }, [selectedAssetIds]);

  // Save projection date to cookie
  React.useEffect(() => {
    if (projectionDate) {
      setCookie('projection-date', projectionDate.toISOString());
    } else {
      // Clear cookie if projection date is removed
      setCookie('projection-date', '');
    }
  }, [projectionDate]);

  // Initialize localProjectedPrices from projectedPrices (only when projectedPrices changes externally)
  React.useEffect(() => {
    // Sync local prices with projected prices when they change externally (e.g., from Recalculate button)
    // Only sync if there are actual differences to avoid interfering with user typing
    setLocalProjectedPrices(prev => {
      let hasChanges = false;
      const newMap = new Map(prev);
      
      // Update with new prices
      projectedPrices.forEach((price, assetId) => {
        const currentPrice = prev.get(assetId);
        if (currentPrice === undefined || Math.abs(currentPrice - price) > 0.01) {
          newMap.set(assetId, price);
          hasChanges = true;
        }
      });
      
      // Remove prices for assets that no longer exist
      prev.forEach((_, assetId) => {
        if (!projectedPrices.has(assetId)) {
          newMap.delete(assetId);
          hasChanges = true;
        }
      });
      
      return hasChanges ? newMap : prev;
    });
  }, [projectedPrices]);

  // Debounced function to update projected prices
  const updateProjectedPriceDebounced = React.useCallback((assetId: string, price: number) => {
    // Update local state immediately for UI responsiveness
    setLocalProjectedPrices(prev => {
      const newMap = new Map(prev);
      newMap.set(assetId, price);
      return newMap;
    });

    // Clear existing timer for this asset
    const existingTimer = debounceTimerRef.current.get(assetId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer to update actual state
    const timer = setTimeout(() => {
      const newProjectedPrices = new Map(projectedPrices);
      newProjectedPrices.set(assetId, price);
      setProjectedPrices(newProjectedPrices);
      debounceTimerRef.current.delete(assetId);
    }, 500); // 500ms debounce

    debounceTimerRef.current.set(assetId, timer);
  }, [projectedPrices]);

  // Cleanup timers on unmount
  React.useEffect(() => {
    return () => {
      debounceTimerRef.current.forEach(timer => clearTimeout(timer));
      debounceTimerRef.current.clear();
    };
  }, []);

  // Clean up projected prices for assets that no longer exist
  React.useEffect(() => {
    const availableAssetIds = new Set(uniqueAssets.map(a => a.id));
    const cleanedPrices = new Map<string, number>();
    
    projectedPrices.forEach((price, assetId) => {
      if (availableAssetIds.has(assetId)) {
        cleanedPrices.set(assetId, price);
      }
    });
    
    // Update prices if cleanup was needed
    if (cleanedPrices.size !== projectedPrices.size) {
      setProjectedPrices(cleanedPrices);
    }
  }, [uniqueAssets]); // Only depend on uniqueAssets, not projectedPrices

  // Save projected prices to cookie
  React.useEffect(() => {
    if (projectedPrices.size > 0) {
      const pricesObj = Object.fromEntries(projectedPrices);
      setCookie('projection-prices', JSON.stringify(pricesObj));
    } else {
      // Clear cookie if prices are cleared
      setCookie('projection-prices', '');
    }
  }, [projectedPrices]);

  // Save funding settings to cookies
  React.useEffect(() => {
    setCookie('projection-continue-funding', continueFunding ? 'true' : 'false');
  }, [continueFunding]);
  React.useEffect(() => {
    setCookie('projection-monthly-contribution', monthlyContribution.toString());
  }, [monthlyContribution]);
  React.useEffect(() => {
    setCookie('projection-progressive-growth', progressiveGrowth ? 'true' : 'false');
  }, [progressiveGrowth]);
  React.useEffect(() => {
    setCookie('projection-growth-rate', growthRate.toString());
  }, [growthRate]);

  // Filter investments based on selected assets
  const filteredInvestments = useMemo(() => {
    if (selectedAssetIds.size === 0) return investments;
    return investments.filter(inv => 
      !inv.asset?.id || selectedAssetIds.has(inv.asset.id)
    );
  }, [investments, selectedAssetIds]);

  // Helper function to get current price for an asset
  const getCurrentPrice = (assetId: string): number | null => {
    const assetInvestments = filteredInvestments.filter(inv => inv.asset?.id === assetId);
    if (assetInvestments.length === 0) return null;
    
    // Get the most recent investment for this asset
    const latestInv = assetInvestments[assetInvestments.length - 1];
    const currentPrice = latestInv.current_price || 
      (latestInv.current_worth && latestInv.quantity 
        ? latestInv.current_worth / Math.abs(Number(latestInv.quantity))
        : null);
    
    return currentPrice !== null ? Number(currentPrice) : null;
  };

  // Extract colors from asset icons or use color_settings
  React.useEffect(() => {
    const extractAssetColors = async () => {
      const colorMap = new Map<string, string>();
      
      const colorPromises = uniqueAssets.filter(a => selectedAssetIds.has(a.id)).map(async (asset) => {
        // First priority: use manual color_settings if provided
        if (asset.color_settings?.primary || asset.color_settings?.badge) {
          colorMap.set(asset.id, asset.color_settings.primary || asset.color_settings.badge || '#8b5cf6');
          return;
        }

        // Fallback: extract color from icon
        const iconUrl = asset.icon_url || getIconUrl(asset.icon);
        if (iconUrl) {
          try {
            const color = await getDominantColor(iconUrl);
            colorMap.set(asset.id, color);
          } catch (error) {
            console.error(`Failed to extract color for asset ${asset.id}:`, error);
            colorMap.set(asset.id, '#8b5cf6'); // Default purple
          }
        } else {
          colorMap.set(asset.id, '#8b5cf6'); // Default purple
        }
      });

      await Promise.all(colorPromises);
      setAssetColors(colorMap);
    };

    extractAssetColors();
  }, [uniqueAssets, selectedAssetIds]);

  // Initialize projected prices with current prices or calculate growth estimates
  React.useEffect(() => {
    if (uniqueAssets.length === 0) return;
    
    const newProjectedPrices = new Map<string, number>();
    
    uniqueAssets.forEach((asset) => {
      if (!projectedPrices.has(asset.id)) {
        // Find current price from investments
        const assetInvestments = investments.filter(inv => inv.asset?.id === asset.id);
        if (assetInvestments.length > 0) {
          // Use the most recent current_price or current_worth
          const latestInv = assetInvestments[assetInvestments.length - 1];
          const currentPrice = latestInv.current_price || 
            (latestInv.current_worth && latestInv.quantity 
              ? latestInv.current_worth / Math.abs(Number(latestInv.quantity))
              : null);
          
          if (currentPrice !== null) {
            // Default projection: assume 10% annual growth (can be modified by user)
            newProjectedPrices.set(asset.id, currentPrice);
          }
        }
      } else {
        // Keep existing projected price
        newProjectedPrices.set(asset.id, projectedPrices.get(asset.id)!);
      }
    });
    
    setProjectedPrices(newProjectedPrices);
  }, [uniqueAssets, investments]);

  // Fetch historical prices for assets with symbols
  React.useEffect(() => {
    const fetchHistoricalPrices = async () => {
      const assetsWithSymbols = new Map<string, { symbol: string; earliestDate: Date }>();
      
      filteredInvestments.forEach((inv) => {
        if (inv.asset?.symbol && inv.purchase_date) {
          const symbol = inv.asset.symbol.toUpperCase();
          // Skip currencies
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
      const today = new Date();

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
  }, [filteredInvestments]);

  const chartData = useMemo(() => {
    const investmentsWithDates = filteredInvestments.filter(
      (inv) => inv.purchase_date !== null && inv.purchase_date !== undefined
    );

    if (investmentsWithDates.length === 0) {
      return [];
    }

    const sortedInvestments = [...investmentsWithDates].sort((a, b) => {
      const dateA = new Date(a.purchase_date!).getTime();
      const dateB = new Date(b.purchase_date!).getTime();
      return dateA - dateB;
    });

    const today = new Date();
    const todayStr = format(startOfDay(today), 'yyyy-MM-dd');
    const endDate = projectionDate && projectionDate > today ? projectionDate : today;
    
    // Get date range from first investment to end date (today or projection date)
    const firstInvDate = sortedInvestments[0] 
      ? startOfDay(parseISO(sortedInvestments[0].purchase_date!)) 
      : today;
    const startDate = firstInvDate;
    const finalEndDate = startOfDay(endDate);

    // Generate date points
    const dateKeys: string[] = [];
    
    // For historical period (up to today), use daily/weekly granularity
    // BUT exclude today from historical dates if we have a projection (today will be added separately)
    const historicalEndDate = projectionDate && projectionDate > today 
      ? subDays(startOfDay(today), 1) // End historical at yesterday if we have projection
      : startOfDay(today);
    const historicalEndStr = format(historicalEndDate, 'yyyy-MM-dd');
    
    const historicalDays = eachDayOfInterval({ start: startDate, end: historicalEndDate });
    const historicalDaysDiff = historicalDays.length;
    
    // Sample every N days based on period length for historical data
    let sampleInterval = 1;
    if (historicalDaysDiff < 90) {
      sampleInterval = 1; // Daily for short periods
    } else if (historicalDaysDiff < 365) {
      sampleInterval = 3; // Every 3 days
    } else if (historicalDaysDiff < 730) {
      sampleInterval = 7; // Weekly
    } else {
      sampleInterval = 14; // Bi-weekly
    }

    const historicalDateKeys = historicalDays
      .filter((_, index) => index % sampleInterval === 0 || index === historicalDays.length - 1)
      .map(day => format(day, 'yyyy-MM-dd'))
      .filter(dateStr => dateStr <= historicalEndStr); // Only include dates up to historical end
    
    dateKeys.push(...historicalDateKeys);

    // For projection period (from today to projection date), use monthly granularity ONLY
    if (projectionDate && projectionDate > today) {
      const projectionEndDate = startOfDay(projectionDate);
      const projectionEndStr = format(projectionEndDate, 'yyyy-MM-dd');
      
      // Always include today as the transition point
      if (!dateKeys.includes(todayStr)) {
        dateKeys.push(todayStr);
      }
      
      // Get all months between today and projection end date
      // Start from next month (or current month if today is the first)
      const todayMonthStart = startOfMonth(today);
      const isTodayFirstOfMonth = todayStr === format(todayMonthStart, 'yyyy-MM-dd');
      
      // If today is not the first of the month, start from next month
      // If today IS the first of the month, include this month
      const projectionStartMonth = isTodayFirstOfMonth 
        ? todayMonthStart 
        : startOfMonth(addMonths(today, 1));
      
      // Get all months between start and end
      const projectionMonths = eachMonthOfInterval({ 
        start: projectionStartMonth, 
        end: projectionEndDate 
      });
      
      // Add first day of each month (monthly granularity)
      // Exclude today if it's already added
      projectionMonths.forEach(month => {
        const monthStart = startOfMonth(month);
        const monthStr = format(monthStart, 'yyyy-MM-dd');
        // Only add if it's after today and before/equal to projection end date
        if (monthStr > todayStr && monthStr <= projectionEndStr && !dateKeys.includes(monthStr)) {
          dateKeys.push(monthStr);
        }
      });
      
      // Ensure projection end date is included (if not already added as a month start)
      if (!dateKeys.includes(projectionEndStr)) {
        dateKeys.push(projectionEndStr);
      }
    } else {
      // No projection - ensure today is included in historical dates
      if (!dateKeys.includes(todayStr)) {
        dateKeys.push(todayStr);
      }
    }

    // Ensure investment dates are included (only for historical period)
    sortedInvestments.forEach((inv) => {
      const date = startOfDay(parseISO(inv.purchase_date!));
      const dateStr = format(date, 'yyyy-MM-dd');
      // Only add investment dates that are in the historical period (before today if projection exists)
      if (dateStr <= historicalEndStr && !dateKeys.includes(dateStr)) {
        dateKeys.push(dateStr);
      }
    });

    // Ensure start date is included (only if it's in historical period)
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    if (startDateStr <= historicalEndStr && !dateKeys.includes(startDateStr)) {
      dateKeys.push(startDateStr);
    }
    
    // Ensure end date is included
    const endDateStr = format(finalEndDate, 'yyyy-MM-dd');
    if (!dateKeys.includes(endDateStr)) {
      dateKeys.push(endDateStr);
    }

    // Sort and deduplicate
    const sortedDateKeys = Array.from(new Set(dateKeys)).sort();

    // Get unique assets for bar chart breakdown
    const uniqueAssetsMap = new Map<string, { id: string; name: string; symbol: string | null }>();
    sortedInvestments.forEach((inv) => {
      if (inv.asset?.id) {
        if (!uniqueAssetsMap.has(inv.asset.id)) {
          uniqueAssetsMap.set(inv.asset.id, {
            id: inv.asset.id,
            name: inv.asset.name,
            symbol: inv.asset.symbol,
          });
        }
      }
    });

    // For each date, calculate cumulative net worth
    const finalData: Array<{ date: string; netWorth: number; isProjection?: boolean; [assetId: string]: number | string | boolean | undefined }> = [];
    const projectionDateStr = projectionDate ? format(startOfDay(projectionDate), 'yyyy-MM-dd') : null;
    
    // Pre-calculate contributions for each investment (independent of historical prices)
    // This ensures contributions don't change when historical prices load
    const investmentContributions = new Map<string, number>();
    // Also pre-calculate contributions per asset for bar chart breakdown
    const assetContributionsMap = new Map<string, Map<string, number>>(); // assetId -> investmentId -> contribution
    
    sortedInvestments.forEach((inv) => {
      if (inv.quantity === null || inv.quantity === undefined || !inv.asset?.id) return;
      
      // Calculate contribution for this investment (only based on purchase price)
      let contribution = 0;
      if (inv.properties?.["How much?"] !== undefined) {
        contribution = Number(inv.properties["How much?"]);
      } else if (inv.purchase_price !== null && inv.quantity !== null) {
        contribution = Number(inv.purchase_price) * Math.abs(Number(inv.quantity));
      }
      
      const finalContribution = Number(inv.quantity) >= 0 ? contribution : -Math.abs(contribution);
      
      // Store contribution with investment ID for easy lookup
      investmentContributions.set(inv.id, finalContribution);
      
      // Store contribution per asset for breakdown
      if (!assetContributionsMap.has(inv.asset.id)) {
        assetContributionsMap.set(inv.asset.id, new Map());
      }
      assetContributionsMap.get(inv.asset.id)!.set(inv.id, finalContribution);
    });
    
    // First, calculate today's actual net worth and projected end net worth
    let todayNetWorth: number | null = null;
    let projectedEndNetWorth: number | null = null;
    
    // Calculate today's net worth using current prices
    const investmentsUpToToday = sortedInvestments.filter((inv) => {
      const invDate = startOfDay(parseISO(inv.purchase_date!));
      return invDate.getTime() <= today.getTime();
    });
    
    todayNetWorth = investmentsUpToToday.reduce((sum, inv) => {
      if (inv.quantity === null || inv.quantity === undefined) return sum;
      const worth = inv.current_worth !== undefined
        ? inv.current_worth
        : (inv.current_value !== null
            ? inv.current_value
            : (inv.current_price && inv.quantity
                ? Number(inv.current_price) * Number(inv.quantity)
                : 0));
      return sum + worth;
    }, 0);
    
    // Calculate projected net worth at end date using projected prices
    // NOTE: Include negative values from sales in total net worth
    if (projectionDate) {
      if (continueFunding && monthlyContribution > 0) {
        // Calculate with monthly contributions
        const daysDiff = Math.ceil((projectionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const monthsDiff = daysDiff / 30.44; // Average days per month
        
        // Calculate total contributions over the period
        let totalContributions = 0;
        if (progressiveGrowth && growthRate > 0) {
          // Progressive growth: contributions increase each month
          // Formula: sum of geometric series
          const monthlyGrowthFactor = 1 + (growthRate / 100) / 12; // Convert annual rate to monthly
          for (let month = 0; month < monthsDiff; month++) {
            totalContributions += monthlyContribution * Math.pow(monthlyGrowthFactor, month);
          }
        } else {
          // Fixed monthly contribution
          totalContributions = monthlyContribution * monthsDiff;
        }
        
        // Calculate asset distribution weights based on current holdings
        const assetWeights = new Map<string, number>();
        let totalCurrentWorth = 0;
        
        investmentsUpToToday.forEach((inv) => {
          if (inv.quantity === null || inv.quantity === undefined || !inv.asset?.id) return;
          const isCurrency = inv.asset?.symbol && ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].includes(inv.asset.symbol.toUpperCase());
          if (isCurrency) return; // Don't distribute to currencies
          
          const currentWorth = inv.current_worth !== undefined
            ? inv.current_worth
            : (inv.current_value !== null
                ? inv.current_value
                : (inv.current_price && inv.quantity
                    ? Number(inv.current_price) * Number(inv.quantity)
                    : 0));
          
          if (currentWorth > 0) {
            const existingWeight = assetWeights.get(inv.asset.id) || 0;
            assetWeights.set(inv.asset.id, existingWeight + currentWorth);
            totalCurrentWorth += currentWorth;
          }
        });
        
        // Calculate projected net worth with contributions
        projectedEndNetWorth = investmentsUpToToday.reduce((sum, inv) => {
          if (inv.quantity === null || inv.quantity === undefined) return sum;
          
          const isCurrency = inv.asset?.symbol && ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].includes(inv.asset.symbol.toUpperCase());
          
          if (isCurrency) {
            // Currencies don't change value - use current worth (can be negative for sales)
            const currentWorth = inv.current_worth !== undefined
              ? inv.current_worth
              : (inv.current_value !== null
                  ? inv.current_value
                  : (inv.current_price && inv.quantity
                      ? Number(inv.current_price) * Number(inv.quantity)
                      : 0));
            return sum + currentWorth; // Include negative values
          }
          
          // Calculate base projected worth from current holdings
          const projectedPrice = projectedPrices.get(inv.asset?.id || '');
          let baseProjectedWorth = 0;
          if (projectedPrice !== undefined && projectedPrice !== null && projectedPrice >= 0) {
            baseProjectedWorth = Number(projectedPrice) * Number(inv.quantity);
          } else {
            const currentWorth = inv.current_worth !== undefined
              ? inv.current_worth
              : (inv.current_value !== null
                  ? inv.current_value
                  : (inv.current_price && inv.quantity
                      ? Number(inv.current_price) * Number(inv.quantity)
                      : 0));
            baseProjectedWorth = currentWorth;
          }
          
          // Add contribution portion for this asset
          if (totalCurrentWorth > 0 && inv.asset?.id) {
            const assetWeight = assetWeights.get(inv.asset.id) || 0;
            const contributionPortion = totalContributions * (assetWeight / totalCurrentWorth);
            // Apply price appreciation to contributions
            const currentPrice = getCurrentPrice(inv.asset.id);
            if (currentPrice !== null && currentPrice > 0 && projectedPrice !== undefined && projectedPrice > 0) {
              const priceGrowth = projectedPrice / currentPrice;
              baseProjectedWorth += contributionPortion * priceGrowth;
            } else {
              baseProjectedWorth += contributionPortion;
            }
          }
          
          return sum + baseProjectedWorth; // Include negative values from sales in base
        }, 0);
      } else {
        // No additional funding - use original logic
        projectedEndNetWorth = investmentsUpToToday.reduce((sum, inv) => {
          if (inv.quantity === null || inv.quantity === undefined) return sum;
          
          const isCurrency = inv.asset?.symbol && ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].includes(inv.asset.symbol.toUpperCase());
          
          if (isCurrency) {
            // Currencies don't change value - use current worth (can be negative for sales)
            const currentWorth = inv.current_worth !== undefined
              ? inv.current_worth
              : (inv.current_value !== null
                  ? inv.current_value
                  : (inv.current_price && inv.quantity
                      ? Number(inv.current_price) * Number(inv.quantity)
                      : 0));
            return sum + currentWorth; // Include negative values
          }
          
          // Use projected price for the end date
          const projectedPrice = projectedPrices.get(inv.asset?.id || '');
          if (projectedPrice !== undefined && projectedPrice !== null && projectedPrice >= 0) {
            // Use actual quantity (can be negative for sales) - this affects total net worth
            const projectedWorth = Number(projectedPrice) * Number(inv.quantity);
            return sum + projectedWorth; // Include negative values from sales
          }
          
          // Fallback to current worth if no projection set (can be negative for sales)
          const currentWorth = inv.current_worth !== undefined
            ? inv.current_worth
            : (inv.current_value !== null
                ? inv.current_value
                : (inv.current_price && inv.quantity
                    ? Number(inv.current_price) * Number(inv.quantity)
                    : 0));
          return sum + currentWorth; // Include negative values
        }, 0);
      }
    }

    for (const dateKey of sortedDateKeys) {
      const date = parseISO(dateKey);
      const isProjectionDate = projectionDate && dateKey > todayStr;
      const isToday = dateKey === todayStr;
      
      const investmentsUpToDate = sortedInvestments.filter((inv) => {
        const invDate = startOfDay(parseISO(inv.purchase_date!));
        return invDate.getTime() <= date.getTime();
      });

      const assetWorthMap = new Map<string, number>();
      
      let totalNetWorth = 0;
      
      if (isProjectionDate && projectionDate && projectedEndNetWorth !== null && todayNetWorth !== null) {
        // Check if this is exactly the end date - use exact projected values
        const isEndDate = projectionDateStr && dateKey === projectionDateStr;
        
        // Calculate interpolation factor (needed for both total and asset breakdown)
        const todayTime = today.getTime();
        const projectionTime = projectionDate.getTime();
        const currentTime = date.getTime();
        const progress = (currentTime - todayTime) / (projectionTime - todayTime);
        const clampedProgress = Math.max(0, Math.min(1, progress));
        
        if (isEndDate) {
          // At the end date, use exact projected net worth (can be negative from sales)
          totalNetWorth = projectedEndNetWorth;
        } else {
          // For other projection dates, linearly interpolate between today's actual value and projected end value
          // The projectedEndNetWorth already includes contributions if continueFunding is enabled
          totalNetWorth = todayNetWorth + (projectedEndNetWorth - todayNetWorth) * clampedProgress;
        }
        
        // Also calculate asset breakdowns for bar chart (linearly interpolated)
        // Group investments by asset and sum them up
        if (projectionDate) {
          const investmentsUpToToday = sortedInvestments.filter((inv) => {
            const invDate = startOfDay(parseISO(inv.purchase_date!));
            return invDate.getTime() <= today.getTime();
          });
          
          // Group investments by asset ID and calculate totals
          const assetTodayWorthMap = new Map<string, number>();
          const assetProjectedEndWorthMap = new Map<string, number>();
          
          investmentsUpToToday.forEach((inv) => {
            if (inv.quantity === null || inv.quantity === undefined || !inv.asset?.id) return;
            
            const isCurrency = inv.asset?.symbol && ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].includes(inv.asset.symbol.toUpperCase());
            
            // Calculate today's worth for this investment
            const todayWorthRaw = inv.current_worth !== undefined
              ? inv.current_worth
              : (inv.current_value !== null
                  ? inv.current_value
                  : (inv.current_price && inv.quantity
                      ? Number(inv.current_price) * Number(inv.quantity)
                      : 0));
            
            // Sum up today's worth per asset (for visualization, clamp individual investments to 0)
            const todayWorthForBreakdown = Math.max(0, todayWorthRaw);
            const currentTodayWorth = assetTodayWorthMap.get(inv.asset.id) || 0;
            assetTodayWorthMap.set(inv.asset.id, currentTodayWorth + todayWorthForBreakdown);
            
            // Calculate projected end worth for this investment
            let projectedEndWorthForInv = todayWorthForBreakdown;
            if (!isCurrency) {
              const projectedPrice = projectedPrices.get(inv.asset.id);
              if (projectedPrice !== undefined && projectedPrice !== null && projectedPrice >= 0) {
                // Use absolute quantity (you can't have negative holdings for visualization)
                const absQuantity = Math.abs(Number(inv.quantity));
                projectedEndWorthForInv = Math.max(0, Number(projectedPrice) * absQuantity);
              }
            }
            
            // Sum up projected end worth per asset
            const currentProjectedWorth = assetProjectedEndWorthMap.get(inv.asset.id) || 0;
            assetProjectedEndWorthMap.set(inv.asset.id, currentProjectedWorth + projectedEndWorthForInv);
          });
          
          // Add contributions to projected end worth if funding is enabled
          if (continueFunding && monthlyContribution > 0) {
            const daysDiff = Math.ceil((projectionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const monthsDiff = daysDiff / 30.44;
            
            // Calculate total contributions
            let totalContributions = 0;
            if (progressiveGrowth && growthRate > 0) {
              const monthlyGrowthFactor = 1 + (growthRate / 100) / 12;
              for (let month = 0; month < monthsDiff; month++) {
                totalContributions += monthlyContribution * Math.pow(monthlyGrowthFactor, month);
              }
            } else {
              totalContributions = monthlyContribution * monthsDiff;
            }
            
            // Distribute contributions proportionally based on current holdings
            const totalCurrentWorth = Array.from(assetTodayWorthMap.values()).reduce((sum, val) => sum + val, 0);
            if (totalCurrentWorth > 0) {
              assetTodayWorthMap.forEach((todayWorth, assetId) => {
                if (todayWorth > 0) {
                  const contributionPortion = totalContributions * (todayWorth / totalCurrentWorth);
                  const currentPrice = getCurrentPrice(assetId);
                  const projectedPrice = projectedPrices.get(assetId);
                  
                  // Apply price appreciation to contributions
                  if (currentPrice !== null && currentPrice > 0 && projectedPrice !== undefined && projectedPrice > 0) {
                    const priceGrowth = projectedPrice / currentPrice;
                    const currentProjectedWorth = assetProjectedEndWorthMap.get(assetId) || 0;
                    assetProjectedEndWorthMap.set(assetId, currentProjectedWorth + contributionPortion * priceGrowth);
                  } else {
                    const currentProjectedWorth = assetProjectedEndWorthMap.get(assetId) || 0;
                    assetProjectedEndWorthMap.set(assetId, currentProjectedWorth + contributionPortion);
                  }
                }
              });
            }
          }
          
          // Now interpolate each asset's worth
          assetTodayWorthMap.forEach((todayWorth, assetId) => {
            // If asset has 0 worth today (not held), don't project it forward - keep it at 0
            if (todayWorth === 0 || Math.abs(todayWorth) < 0.01) {
              assetWorthMap.set(assetId, 0);
              return;
            }
            
            const projectedEndWorth = assetProjectedEndWorthMap.get(assetId) || todayWorth;
            
            let interpolatedWorth: number;
            if (isEndDate) {
              // At the end date, use exact projected worth
              interpolatedWorth = projectedEndWorth;
            } else {
              // Interpolate from today's worth to projected end worth
              interpolatedWorth = todayWorth + (projectedEndWorth - todayWorth) * clampedProgress;
            }
            
            // Ensure we never go below 0
            assetWorthMap.set(assetId, Math.max(0, interpolatedWorth));
          });
        }
      } else {
        // For historical dates and today, calculate normally
        totalNetWorth = investmentsUpToDate.reduce((sum, inv) => {
          if (inv.quantity === null || inv.quantity === undefined) return sum;

          let worth = 0;
          const isCurrency = inv.asset?.symbol && ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].includes(inv.asset.symbol.toUpperCase());
          
          if (isCurrency) {
            // Currencies don't change value
            worth = inv.properties?.["How much?"] !== undefined
              ? Number(inv.properties["How much?"])
              : (inv.purchase_price !== null && inv.quantity !== null
                  ? Number(inv.purchase_price) * Number(inv.quantity)
                  : 0);
          } else if (isToday) {
            // Use current prices for today
            worth = inv.current_worth !== undefined
              ? inv.current_worth
              : (inv.current_value !== null
                  ? inv.current_value
                  : (inv.current_price && inv.quantity
                      ? Number(inv.current_price) * Number(inv.quantity)
                      : 0));
          } else if (inv.asset?.symbol) {
            // Use historical price for past dates
            const symbol = inv.asset.symbol.toUpperCase();
            const symbolPrices = historicalPrices.get(symbol);
            
            if (symbolPrices) {
              let price = null;
              let checkDate = new Date(dateKey);
              
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
                worth = inv.properties?.["How much?"] !== undefined
                  ? Number(inv.properties["How much?"])
                  : (inv.purchase_price !== null && inv.quantity !== null
                      ? Number(inv.purchase_price) * Number(inv.quantity)
                      : 0);
              }
            } else {
              worth = inv.properties?.["How much?"] !== undefined
                ? Number(inv.properties["How much?"])
                : (inv.purchase_price !== null && inv.quantity !== null
                    ? Number(inv.purchase_price) * Number(inv.quantity)
                    : 0);
            }
          } else {
            worth = inv.properties?.["How much?"] !== undefined
              ? Number(inv.properties["How much?"])
              : (inv.purchase_price !== null && inv.quantity !== null
                  ? Number(inv.purchase_price) * Number(inv.quantity)
                  : 0);
          }

          // For total net worth: include negative values from sales
          // For asset breakdown (bar chart): clamp individual assets to 0 for visualization
          const clampedWorthForBreakdown = Math.max(0, worth);
          
          if (inv.asset?.id && clampedWorthForBreakdown !== 0) {
            const currentAssetWorth = assetWorthMap.get(inv.asset.id) || 0;
            assetWorthMap.set(inv.asset.id, currentAssetWorth + clampedWorthForBreakdown);
          }

          // Return actual worth (including negatives) for total net worth
          return sum + worth;
        }, 0);
      }

      // Calculate contributions (money invested) for this date
      // Use pre-calculated contributions map to ensure stability (not affected by historical prices)
      let totalContributions = 0;
      // Sum up contributions from all investments up to this date using pre-calculated map
      investmentsUpToDate.forEach((inv) => {
        const contribution = investmentContributions.get(inv.id) || 0;
        totalContributions += contribution;
      });
      
      // Store base contributions before adding projected ones
      const contributionsUpToDate = totalContributions;
      
      if (isProjectionDate && projectionDate && continueFunding && monthlyContribution > 0) {
        // Add projected contributions
        const daysDiff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const monthsDiff = Math.max(0, daysDiff / 30.44);
        
        let projectedContributions = 0;
        if (progressiveGrowth && growthRate > 0) {
          const monthlyGrowthFactor = 1 + (growthRate / 100) / 12;
          for (let month = 0; month < monthsDiff; month++) {
            projectedContributions += monthlyContribution * Math.pow(monthlyGrowthFactor, month);
          }
        } else {
          projectedContributions = monthlyContribution * monthsDiff;
        }
        
        totalContributions = contributionsUpToDate + projectedContributions;
      } else {
        totalContributions = contributionsUpToDate;
      }

      const dataPoint: { date: string; netWorth: number; projectedNetWorth?: number; contributions?: number; projectedContributions?: number; isProjection?: boolean; [assetId: string]: number | string | boolean | undefined } = {
        date: dateKey,
        netWorth: isProjectionDate ? totalNetWorth : totalNetWorth,
        projectedNetWorth: isProjectionDate ? totalNetWorth : (isToday && projectionDate ? totalNetWorth : undefined),
        contributions: isProjectionDate ? undefined : totalContributions,
        projectedContributions: isProjectionDate ? totalContributions : (isToday && projectionDate ? totalContributions : undefined),
        isProjection: isProjectionDate,
      };

      // Only include selected assets in the data point
      uniqueAssetsMap.forEach((asset) => {
        if (selectedAssetIds.size === 0 || selectedAssetIds.has(asset.id)) {
          if (viewMode === 'contributions') {
            // For contributions mode, calculate contributions per asset (not affected by historical prices)
            const assetContributions = assetContributionsMap.get(asset.id);
            let assetContributionTotal = 0;
            if (assetContributions) {
              investmentsUpToDate.forEach((inv) => {
                if (inv.asset?.id === asset.id) {
                  const contribution = assetContributions.get(inv.id) || 0;
                  assetContributionTotal += contribution;
                }
              });
            }
            
            // Add projected contributions if in projection period and funding is enabled
            if (isProjectionDate && projectionDate && continueFunding && monthlyContribution > 0) {
              // Calculate projected contributions up to this date
              const daysDiff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const monthsDiff = Math.max(0, daysDiff / 30.44);
              
              let projectedContributionsUpToDate = 0;
              if (progressiveGrowth && growthRate > 0) {
                const monthlyGrowthFactor = 1 + (growthRate / 100) / 12;
                for (let month = 0; month < monthsDiff; month++) {
                  projectedContributionsUpToDate += monthlyContribution * Math.pow(monthlyGrowthFactor, month);
                }
              } else {
                projectedContributionsUpToDate = monthlyContribution * monthsDiff;
              }
              
              // Distribute projected contributions proportionally based on current asset contributions
              const investmentsUpToToday = sortedInvestments.filter((inv) => {
                const invDate = startOfDay(parseISO(inv.purchase_date!));
                return invDate.getTime() <= today.getTime();
              });
              
              // Calculate total contributions across all assets up to today
              let totalContributionsToday = 0;
              const assetContributionsToday = new Map<string, number>();
              investmentsUpToToday.forEach((inv) => {
                if (inv.asset?.id) {
                  const assetContribs = assetContributionsMap.get(inv.asset.id);
                  if (assetContribs) {
                    const contrib = assetContribs.get(inv.id) || 0;
                    const currentTotal = assetContributionsToday.get(inv.asset.id) || 0;
                    assetContributionsToday.set(inv.asset.id, currentTotal + contrib);
                    totalContributionsToday += contrib;
                  }
                }
              });
              
              // Distribute projected contributions proportionally
              if (totalContributionsToday > 0) {
                const assetContributionToday = assetContributionsToday.get(asset.id) || 0;
                const contributionPortion = projectedContributionsUpToDate * (assetContributionToday / totalContributionsToday);
                assetContributionTotal += contributionPortion;
              }
            }
            
            dataPoint[asset.id] = Math.max(0, assetContributionTotal); // Clamp to 0 for visualization
          } else {
            // For net worth mode, use asset worth map (uses historical prices)
            dataPoint[asset.id] = assetWorthMap.get(asset.id) || 0;
          }
        }
      });

      finalData.push(dataPoint);
    }

    // Filter assets to only include selected ones
    const filteredAssets = Array.from(uniqueAssetsMap.values()).filter(asset =>
      selectedAssetIds.size === 0 || selectedAssetIds.has(asset.id)
    );
    
    return { 
      data: finalData,
      assets: filteredAssets
    };
  }, [filteredInvestments, historicalPrices, projectionDate, projectedPrices, continueFunding, monthlyContribution, progressiveGrowth, growthRate, selectedCurrency, exchangeRates, viewMode, selectedAssetIds]);

  const chartDataArray = Array.isArray(chartData) ? [] : (chartData.data || []);
  const chartAssets = Array.isArray(chartData) ? [] : (chartData.assets || []);

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

  // Calculate projected price based on growth rate and historical performance
  const calculateProjectedPrice = (assetId: string, currentPrice: number | null, years: number = 1): number | null => {
    if (!currentPrice || !projectionDate) return currentPrice;
    
    const asset = uniqueAssets.find(a => a.id === assetId);
    if (!asset || !asset.symbol) return currentPrice;
    
    const symbol = asset.symbol.toUpperCase();
    const isCurrency = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'].includes(symbol);
    
    // Currencies don't grow
    if (isCurrency) return currentPrice;
    
    // Try to calculate historical growth rate from available data
    const symbolPrices = historicalPrices.get(symbol);
    let annualGrowthRate = 0.10; // Default 10% annual growth
    
    if (symbolPrices && symbolPrices.size > 0) {
      // Get prices from 1 year ago and today to calculate growth rate
      const today = new Date();
      const oneYearAgo = subDays(today, 365);
      
      // Find closest prices
      let priceToday: number | null = null;
      let priceOneYearAgo: number | null = null;
      
      // Look for today's price (or most recent)
      for (let i = 0; i < 30; i++) {
        const checkDate = subDays(today, i);
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        if (symbolPrices.has(dateStr)) {
          priceToday = symbolPrices.get(dateStr)!;
          break;
        }
      }
      
      // Look for price from ~1 year ago
      for (let i = 0; i < 60; i++) {
        const checkDate = subDays(oneYearAgo, i);
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        if (symbolPrices.has(dateStr)) {
          priceOneYearAgo = symbolPrices.get(dateStr)!;
          break;
        }
      }
      
      // Calculate historical growth rate if we have both prices
      if (priceToday && priceOneYearAgo && priceOneYearAgo > 0) {
        const historicalGrowth = (priceToday - priceOneYearAgo) / priceOneYearAgo;
        // Use historical growth rate, but cap it at reasonable values (-50% to +200%)
        annualGrowthRate = Math.max(-0.5, Math.min(2.0, historicalGrowth));
      }
    }
    
    // Calculate projected price using compound growth
    const projectedPrice = currentPrice * Math.pow(1 + annualGrowthRate, years);
    
    return projectedPrice;
  };

  // Handle preset selection
  const handlePresetSelect = (years: number) => {
    const today = new Date();
    const futureDate = addYears(today, years);
    setProjectionDate(futureDate);
    
    // Auto-calculate and set projected prices for selected assets only
    const newProjectedPrices = new Map(projectedPrices); // Keep existing prices
    uniqueAssets.filter(a => selectedAssetIds.has(a.id)).forEach((asset) => {
      const currentPrice = getCurrentPrice(asset.id);
      if (currentPrice !== null) {
        const projectedPrice = calculateProjectedPrice(asset.id, currentPrice, years);
        if (projectedPrice !== null) {
          newProjectedPrices.set(asset.id, projectedPrice);
        }
      }
    });
    setProjectedPrices(newProjectedPrices);
  };

  if (chartDataArray.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{viewMode === 'contributions' ? 'Contributions' : 'Net Worth'} Projection</h3>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {loadingPrices ? 'Loading historical data...' : 'No investment data available'}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Net Worth Projection</h3>
          {loadingPrices && (
            <span className="text-xs text-muted-foreground">Loading historical data...</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border-r border-border pr-2">
            <Button
              variant={viewMode === 'networth' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('networth')}
              className={cn(
                'h-7 px-2',
                viewMode === 'networth' && 'bg-primary text-primary-foreground'
              )}
              title="Net Worth"
            >
              <TrendingUp className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'contributions' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('contributions')}
              className={cn(
                'h-7 px-2',
                viewMode === 'contributions' && 'bg-primary text-primary-foreground'
              )}
              title="Contributions"
            >
              <DollarSign className="w-4 h-4" />
            </Button>
          </div>
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
          <Popover open={showAssetFilter} onOpenChange={setShowAssetFilter}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2">
                <Filter className="w-4 h-4 mr-1" />
                Assets ({selectedAssetIds.size}/{uniqueAssets.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Select Assets</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      if (selectedAssetIds.size === uniqueAssets.length) {
                        setSelectedAssetIds(new Set());
                      } else {
                        setSelectedAssetIds(new Set(uniqueAssets.map(a => a.id)));
                      }
                    }}
                  >
                    {selectedAssetIds.size === uniqueAssets.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {uniqueAssets.map((asset) => {
                    const isSelected = selectedAssetIds.has(asset.id);
                    return (
                      <div
                        key={asset.id}
                        className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                        onClick={() => {
                          const newSet = new Set(selectedAssetIds);
                          if (isSelected) {
                            // Ensure at least one asset is selected
                            if (newSet.size > 1) {
                              newSet.delete(asset.id);
                              setSelectedAssetIds(newSet);
                            }
                          } else {
                            newSet.add(asset.id);
                            setSelectedAssetIds(newSet);
                          }
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(selectedAssetIds);
                            if (checked) {
                              newSet.add(asset.id);
                            } else {
                              // Ensure at least one asset is selected
                              if (newSet.size > 1) {
                                newSet.delete(asset.id);
                              }
                            }
                            setSelectedAssetIds(newSet);
                          }}
                        />
                        <div className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center overflow-hidden">
                          <PageIcon 
                            icon={asset.icon} 
                            iconUrl={asset.icon_url}
                            assetId={asset.id}
                            className="w-5 h-5" 
                            fallbackIcon={<Building2 className="w-5 h-5 text-muted-foreground" />}
                          />
                        </div>
                        <Label className="flex-1 cursor-pointer text-sm">
                          {asset.symbol || asset.name}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Popover open={showProjectionSettings} onOpenChange={setShowProjectionSettings}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2">
                <Calendar className="w-4 h-4 mr-1" />
                Projection Settings
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
              <div className="space-y-4">
                <div>
                  <Label>Time Period</Label>
                  <div className="grid grid-cols-5 gap-1.5 mt-2">
                    {[1, 2, 5, 10, 15, 20, 25, 30, 35, 40].map((years) => {
                      const isSelected = projectionDate && (() => {
                        const today = new Date();
                        const expectedDate = addYears(today, years);
                        const daysDiff = Math.abs(projectionDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24);
                        return daysDiff < 30; // Within 30 days of the preset
                      })();
                      
                      return (
                        <Button
                          key={years}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handlePresetSelect(years)}
                        >
                          {years}Y
                        </Button>
                      );
                    })}
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="projection-date">Or Custom Date</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      type="date"
                      id="projection-date"
                      value={projectionDate ? format(projectionDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const dateValue = e.target.value;
                        if (dateValue) {
                          const selectedDate = new Date(dateValue);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          if (selectedDate >= today) {
                            setProjectionDate(selectedDate);
                            // Auto-calculate prices for custom date (only for selected assets)
                            const daysDiff = Math.ceil((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            const years = daysDiff / 365;
                            const newProjectedPrices = new Map(projectedPrices); // Keep existing prices
                            uniqueAssets.filter(a => selectedAssetIds.has(a.id)).forEach((asset) => {
                              const currentPrice = getCurrentPrice(asset.id);
                              if (currentPrice !== null) {
                                const projectedPrice = calculateProjectedPrice(asset.id, currentPrice, years);
                                if (projectedPrice !== null) {
                                  newProjectedPrices.set(asset.id, projectedPrice);
                                }
                              }
                            });
                            setProjectedPrices(newProjectedPrices);
                          }
                        } else {
                          setProjectionDate(null);
                          setProjectedPrices(new Map());
                        }
                      }}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      className="flex-1"
                    />
                    {projectionDate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => {
                          setProjectionDate(null);
                          setProjectedPrices(new Map());
                        }}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                  {projectionDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {format(projectionDate, "PPP")}
                    </p>
                  )}
                </div>
                
                {projectionDate && (
                  <>
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="continue-funding">Continue Funding</Label>
                          <p className="text-xs text-muted-foreground">
                            Project monthly contributions to investments
                          </p>
                        </div>
                        <Switch
                          id="continue-funding"
                          checked={continueFunding}
                          onCheckedChange={setContinueFunding}
                        />
                      </div>
                      
                      {continueFunding && (
                        <div className="space-y-3 pl-4 border-l-2">
                          <div>
                            <Label htmlFor="monthly-contribution">Monthly Contribution</Label>
                            <Input
                              id="monthly-contribution"
                              type="number"
                              step="0.01"
                              min="0"
                              value={monthlyContribution}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value >= 0) {
                                  setMonthlyContribution(value);
                                }
                              }}
                              className="mt-1"
                              placeholder="0.00"
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="progressive-growth">Progressive Growth</Label>
                              <p className="text-xs text-muted-foreground">
                                Increase contributions over time
                              </p>
                            </div>
                            <Switch
                              id="progressive-growth"
                              checked={progressiveGrowth}
                              onCheckedChange={setProgressiveGrowth}
                              disabled={!continueFunding || monthlyContribution <= 0}
                            />
                          </div>
                          
                          {progressiveGrowth && (
                            <div>
                              <Label htmlFor="growth-rate">Annual Growth Rate (%)</Label>
                              <Input
                                id="growth-rate"
                                type="number"
                                step="0.1"
                                min="0"
                                value={growthRate}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value);
                                  if (!isNaN(value) && value >= 0) {
                                    setGrowthRate(value);
                                  }
                                }}
                                className="mt-1"
                                placeholder="0.0"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Monthly contributions will increase by {(growthRate / 12).toFixed(2)}% each month
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {uniqueAssets.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Expected Asset Prices</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => {
                              // Recalculate all prices for selected assets
                              const today = new Date();
                              const daysDiff = Math.ceil((projectionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              const years = daysDiff / 365;
                              const newProjectedPrices = new Map(projectedPrices);
                              uniqueAssets.filter(a => selectedAssetIds.has(a.id)).forEach((asset) => {
                                const currentPrice = getCurrentPrice(asset.id);
                                if (currentPrice !== null) {
                                  const projectedPrice = calculateProjectedPrice(asset.id, currentPrice, years);
                                  if (projectedPrice !== null) {
                                    newProjectedPrices.set(asset.id, projectedPrice);
                                  }
                                }
                              });
                              setProjectedPrices(newProjectedPrices);
                            }}
                          >
                            Recalculate
                          </Button>
                        </div>
                        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                          {uniqueAssets.filter(a => selectedAssetIds.has(a.id)).map((asset) => {
                        const currentPrice = getCurrentPrice(asset.id);
                        const daysDiff = projectionDate ? Math.ceil((projectionDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
                        const years = daysDiff / 365;
                        const suggestedPrice = currentPrice !== null ? calculateProjectedPrice(asset.id, currentPrice, years) : null;
                        
                        // Use local price for display (immediate UI feedback), fallback to projected or suggested
                        const localPrice = localProjectedPrices.get(asset.id);
                        const displayPrice = localPrice !== undefined 
                          ? localPrice 
                          : (projectedPrices.get(asset.id) ?? suggestedPrice ?? currentPrice ?? 0);
                        
                        // Calculate growth percentage based on display price
                        const growthPercent = currentPrice && currentPrice > 0 
                          ? ((displayPrice - currentPrice) / currentPrice) * 100 
                          : 0;
                        
                        return (
                          <div key={asset.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{asset.symbol || asset.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {currentPrice !== null && (
                                  <>
                                    <span>Current: {formatCurrency(currentPrice)}</span>
                                    {growthPercent !== 0 && (
                                      <span className={cn(
                                        growthPercent > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                      )}>
                                        ({growthPercent > 0 ? '+' : ''}{growthPercent.toFixed(1)}%)
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            <Input
                              type="number"
                              step="0.01"
                              value={displayPrice.toFixed(2)}
                              onChange={(e) => {
                                const newPrice = parseFloat(e.target.value);
                                if (!isNaN(newPrice) && newPrice >= 0) {
                                  updateProjectedPriceDebounced(asset.id, newPrice);
                                }
                              }}
                              className="w-28 h-8 text-xs"
                              placeholder="0.00"
                            />
                          </div>
                        );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        {chartMode === 'area' ? (
          <AreaChart data={chartDataArray} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorNetWorthProjection" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#228B22" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#228B22" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorNetWorthProjectionFuture" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'MMM d')}
              className="text-xs"
              stroke="currentColor"
              ticks={chartDataArray.map(d => d.date)}
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
                  if (viewMode === 'contributions') {
                    const contributionsValue = data.projectedContributions !== undefined ? data.projectedContributions : data.contributions;
                    return (
                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-medium mb-1">
                          {format(parseISO(data.date), 'MMM d, yyyy')}
                          {data.isProjection && (
                            <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(Projected)</span>
                          )}
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Contributions: </span>
                          <span className="font-semibold">{formatCurrency(contributionsValue || 0)}</span>
                        </p>
                      </div>
                    );
                  } else {
                    // Calculate net worth from selected assets only
                    let netWorthValue = 0;
                    if (selectedAssetIds.size === 0) {
                      // All assets selected - use total
                      netWorthValue = data.projectedNetWorth !== undefined ? data.projectedNetWorth : (data.netWorth || 0);
                    } else {
                      // Sum only selected assets
                      chartAssets.forEach((asset) => {
                        if (selectedAssetIds.has(asset.id)) {
                          netWorthValue += data[asset.id] || 0;
                        }
                      });
                    }
                    return (
                      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-medium mb-1">
                          {format(parseISO(data.date), 'MMM d, yyyy')}
                          {data.isProjection && (
                            <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(Projected)</span>
                          )}
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Net Worth: </span>
                          <span className="font-semibold">{formatCurrency(netWorthValue)}</span>
                        </p>
                      </div>
                    );
                  }
                }
                return null;
              }}
            />
            {/* Historical data */}
            <Area
              type="monotone"
              dataKey={viewMode === 'contributions' ? 'contributions' : 'netWorth'}
              stroke="#228B22"
              fillOpacity={1}
              fill="url(#colorNetWorthProjection)"
              dot={false}
              connectNulls={true}
            />
            {/* Projected data overlay */}
            {projectionDate && (
              <>
                <Area
                  type="monotone"
                  dataKey={viewMode === 'contributions' ? 'projectedContributions' : 'projectedNetWorth'}
                  stroke="#8b5cf6"
                  fillOpacity={0.3}
                  fill="url(#colorNetWorthProjectionFuture)"
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls={true}
                />
                <ReferenceLine
                  x={format(startOfDay(new Date()), 'yyyy-MM-dd')}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                  label={{ value: "Today", position: "top", fill: "hsl(var(--muted-foreground))" }}
                />
              </>
            )}
          </AreaChart>
        ) : (
          <BarChart data={chartDataArray} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              {chartAssets.map((asset) => {
                const color = assetColors.get(asset.id) || '#8b5cf6';
                return (
                  <linearGradient key={`gradient-${asset.id}`} id={`gradient-bar-proj-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
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
              ticks={chartDataArray.map(d => d.date)}
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
                  
                  // Calculate total based on selected assets
                  let total = 0;
                  if (viewMode === 'contributions') {
                    total = data.projectedContributions !== undefined ? data.projectedContributions : (data.contributions || 0);
                  } else {
                    // For net worth, sum only selected assets
                    if (selectedAssetIds.size === 0) {
                      // All assets selected - use total
                      total = data.projectedNetWorth !== undefined ? data.projectedNetWorth : (data.netWorth || 0);
                    } else {
                      // Sum only selected assets
                      selectedAssetIds.forEach(assetId => {
                        total += data[assetId] || 0;
                      });
                    }
                  }
                  
                  return (
                    <div className="bg-background border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
                      <p className="text-sm font-medium mb-2">
                        {format(parseISO(data.date), 'MMM d, yyyy')}
                        {data.isProjection && (
                          <span className="ml-2 text-xs text-purple-600 dark:text-purple-400">(Projected)</span>
                        )}
                      </p>
                      <p className="text-sm mb-2">
                        <span className="text-muted-foreground">{viewMode === 'contributions' ? 'Total Contributions: ' : 'Total Net Worth: '}</span>
                        <span className="font-semibold">{formatCurrency(total)}</span>
                      </p>
                      {viewMode === 'networth' && (
                        <p className="text-sm mb-2">
                          <span className="text-muted-foreground">Net Worth: </span>
                          <span className="font-semibold">{formatCurrency(total)}</span>
                        </p>
                      )}
                      <div className="space-y-1 border-t border-border pt-2">
                        {chartAssets
                          .map((asset) => {
                            const value = data[asset.id] || 0;
                            return { asset, value };
                          })
                          .filter(({ value }) => value !== 0)
                          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
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
                  fill={`url(#gradient-bar-proj-${asset.id})`}
                  stroke={color}
                  strokeWidth={0}
                />
              );
            })}
            {projectionDate && (
              <ReferenceLine
                x={format(startOfDay(new Date()), 'yyyy-MM-dd')}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                strokeOpacity={0.6}
                label={{ value: "Today", position: "top", fill: "hsl(var(--muted-foreground))" }}
              />
            )}
          </BarChart>
        )}
      </ResponsiveContainer>
      
      {/* Projection Analysis */}
      {projectionDate && chartDataArray.length > 0 && (() => {
        const todayData = chartDataArray.find(d => d.date === format(startOfDay(new Date()), 'yyyy-MM-dd'));
        const endData = chartDataArray[chartDataArray.length - 1];
        
        if (!todayData || !endData) return null;
        
        // Calculate net worth/contributions only for selected assets
        const calculateSelectedValue = (dataPoint: any, isContributions: boolean) => {
          if (isContributions) {
            return dataPoint.projectedContributions !== undefined 
              ? dataPoint.projectedContributions 
              : (dataPoint.contributions || 0);
          } else {
            // For net worth, sum up selected assets from the data point
            // The dataPoint only contains assets that are selected (or all if none selected)
            let total = 0;
            // Sum all asset values in the data point (they're already filtered by selection)
            chartAssets.forEach((asset) => {
              if (selectedAssetIds.size === 0 || selectedAssetIds.has(asset.id)) {
                total += dataPoint[asset.id] || 0;
              }
            });
            return total;
          }
        };
        
        const todayNetWorth = calculateSelectedValue(todayData, viewMode === 'contributions');
        const endNetWorth = calculateSelectedValue(endData, viewMode === 'contributions');
        
        // For contributions, use the total (not filtered by assets)
        const todayContributions = Number(chartDataArray.find(d => d.date === format(startOfDay(new Date()), 'yyyy-MM-dd'))?.contributions) || 0;
        const endContributions = chartDataArray[chartDataArray.length - 1].projectedContributions !== undefined 
          ? Number(chartDataArray[chartDataArray.length - 1].projectedContributions) 
          : (Number(chartDataArray[chartDataArray.length - 1].contributions) || 0);
        
        // For net worth value, calculate from selected assets
        const todayNetWorthValue = calculateSelectedValue(todayData, false);
        const endNetWorthValue = calculateSelectedValue(endData, false);
        
        const daysDiff = Math.ceil((projectionDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const yearsDiff = daysDiff / 365;
        const totalYears = Math.ceil(yearsDiff);
        
        const totalGrowth = endNetWorth - todayNetWorth;
        const growthPercent = todayNetWorth > 0 ? ((endNetWorth - todayNetWorth) / todayNetWorth) * 100 : 0;
        const annualizedGrowth = yearsDiff > 0 ? (Math.pow(endNetWorth / todayNetWorth, 1 / yearsDiff) - 1) * 100 : 0;
        
        // Calculate contributions growth
        const contributionsGrowth = endContributions - todayContributions;
        const contributionsGrowthPercent = todayContributions > 0 ? ((endContributions - todayContributions) / todayContributions) * 100 : 0;
        
        // Calculate return on contributions (if viewing net worth)
        const returnOnContributions = viewMode === 'networth' && endContributions > 0 
          ? ((endNetWorthValue - endContributions) / endContributions) * 100 
          : null;
        
        // Calculate total contributions if funding is enabled
        const totalProjectedContributions = continueFunding && monthlyContribution > 0 ? contributionsGrowth : 0;
        
        return (
          <div className="mt-6 pt-6 border-t space-y-4">
            <h4 className="text-sm font-semibold">Projection Analysis</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Growth Summary */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Projected {viewMode === 'contributions' ? 'Contributions' : 'Net Worth'} Growth</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    totalGrowth >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {totalGrowth >= 0 ? '+' : ''}{formatCurrency(totalGrowth)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Growth Percentage</span>
                  <span className={cn(
                    "text-sm font-semibold",
                    growthPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {growthPercent >= 0 ? '+' : ''}{growthPercent.toFixed(1)}%
                  </span>
                </div>
                {yearsDiff > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Annualized Growth Rate</span>
                    <span className={cn(
                      "text-sm font-semibold",
                      annualizedGrowth >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {annualizedGrowth >= 0 ? '+' : ''}{annualizedGrowth.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
              
              {/* Contributions Summary */}
              {viewMode === 'networth' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Today's Contributions</span>
                    <span className="text-sm font-semibold">{formatCurrency(todayContributions)}</span>
                  </div>
                  {continueFunding && monthlyContribution > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Projected Additional Contributions</span>
                        <span className="text-sm font-semibold">{formatCurrency(totalProjectedContributions)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total Contributions at End</span>
                        <span className="text-sm font-semibold">{formatCurrency(endContributions)}</span>
                      </div>
                    </>
                  )}
                  {returnOnContributions !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Return on Contributions</span>
                      <span className={cn(
                        "text-sm font-semibold",
                        returnOnContributions >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      )}>
                        {returnOnContributions >= 0 ? '+' : ''}{returnOnContributions.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {viewMode === 'contributions' && continueFunding && monthlyContribution > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Today's Contributions</span>
                    <span className="text-sm font-semibold">{formatCurrency(todayContributions)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Projected Additional Contributions</span>
                    <span className="text-sm font-semibold">{formatCurrency(totalProjectedContributions)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total Contributions at End</span>
                    <span className="text-sm font-semibold">{formatCurrency(endContributions)}</span>
                  </div>
                  {progressiveGrowth && growthRate > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Contribution Growth Rate</span>
                      <span className="text-sm font-semibold">+{growthRate.toFixed(1)}% annually</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Monthly/Yearly Contribution Breakdown */}
            {continueFunding && monthlyContribution > 0 && (() => {
              const maxYear = Math.min(Math.ceil(yearsDiff), 40);
              const currentSelectedYear = Math.min(selectedContributionYear, maxYear);
              
              // Calculate contribution breakdown for selected year
              const yearStartMonth = (currentSelectedYear - 1) * 12;
              const isLastYear = currentSelectedYear === Math.ceil(yearsDiff);
              const monthsInYear = isLastYear ? Math.ceil((yearsDiff - (currentSelectedYear - 1)) * 12) : 12;
              
              const monthlyBreakdown = Array.from({ length: monthsInYear }, (_, i) => {
                let monthlyAmount = monthlyContribution;
                if (progressiveGrowth && growthRate > 0) {
                  const monthlyGrowthFactor = 1 + (growthRate / 100) / 12;
                  monthlyAmount = monthlyContribution * Math.pow(monthlyGrowthFactor, yearStartMonth + i);
                }
                return monthlyAmount;
              });
              
              const yearTotal = monthlyBreakdown.reduce((sum, val) => sum + val, 0);
              
              return (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xs font-semibold text-muted-foreground">Contribution Schedule</h5>
                    {maxYear > 1 && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setSelectedContributionYear(Math.max(1, currentSelectedYear - 1))}
                          disabled={currentSelectedYear === 1}
                        >
                          ←
                        </Button>
                        <div className="flex items-center gap-1 px-2">
                          {Array.from({ length: Math.min(maxYear, 10) }, (_, i) => i + 1).map((year) => (
                            <Button
                              key={year}
                              variant={currentSelectedYear === year ? "default" : "ghost"}
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => setSelectedContributionYear(year)}
                            >
                              Y{year}
                            </Button>
                          ))}
                          {maxYear > 10 && (
                            <>
                              <span className="text-xs text-muted-foreground px-1">...</span>
                              <Button
                                variant={currentSelectedYear > 10 ? "default" : "ghost"}
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => setSelectedContributionYear(maxYear)}
                              >
                                Y{maxYear}
                              </Button>
                            </>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setSelectedContributionYear(Math.min(maxYear, currentSelectedYear + 1))}
                          disabled={currentSelectedYear === maxYear}
                        >
                          →
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {/* Selected Year Monthly Breakdown */}
                    <div>
                      <h6 className="text-xs font-medium mb-2">Year {currentSelectedYear} Monthly Contributions</h6>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {monthlyBreakdown.map((monthlyAmount, i) => {
                          const month = i + 1;
                          return (
                            <div key={month} className="flex items-center justify-between p-2 rounded bg-muted/50">
                              <span className="text-muted-foreground">Month {month}</span>
                              <span className="font-medium">{formatCurrency(monthlyAmount)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 pt-2 border-t">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Year {currentSelectedYear} Total</span>
                          <span className="font-semibold">{formatCurrency(yearTotal)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Yearly Totals Summary */}
                    {maxYear > 1 && (
                      <div>
                        <h6 className="text-xs font-medium mb-2">All Years Summary</h6>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {Array.from({ length: maxYear }, (_, i) => {
                            const year = i + 1;
                            const yearStartMonth = i * 12;
                            const isLastYear = year === maxYear;
                            const monthsInYear = isLastYear ? Math.ceil((yearsDiff - i) * 12) : 12;
                            
                            let yearTotal = 0;
                            if (progressiveGrowth && growthRate > 0) {
                              const monthlyGrowthFactor = 1 + (growthRate / 100) / 12;
                              for (let month = 0; month < monthsInYear; month++) {
                                yearTotal += monthlyContribution * Math.pow(monthlyGrowthFactor, yearStartMonth + month);
                              }
                            } else {
                              yearTotal = monthlyContribution * monthsInYear;
                            }
                            
                            return (
                              <div 
                                key={year} 
                                className={cn(
                                  "flex items-center justify-between p-1.5 rounded text-xs cursor-pointer",
                                  currentSelectedYear === year ? "bg-primary/10" : "hover:bg-muted/50"
                                )}
                                onClick={() => setSelectedContributionYear(year)}
                              >
                                <span className="text-muted-foreground">Year {year}</span>
                                <span className="font-medium">{formatCurrency(yearTotal)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            
            {/* Portfolio Distribution */}
            {viewMode === 'networth' && endData && (
              <div className="mt-4 pt-4 border-t">
                <h5 className="text-xs font-semibold mb-3 text-muted-foreground">Portfolio Distribution</h5>
                <div className="space-y-3">
                  {/* Today's Distribution */}
                  <div>
                    <h6 className="text-xs font-medium mb-2">Today's Distribution</h6>
                    <div className="space-y-1.5">
                      {chartAssets
                        .map((asset) => {
                          const value = Number(todayData[asset.id]) || 0;
                          return { asset, value };
                        })
                        .filter(({ value }) => value > 0)
                        .sort((a, b) => b.value - a.value)
                        .map(({ asset, value }) => {
                          const percentage = todayNetWorthValue > 0 ? (value / todayNetWorthValue) * 100 : 0;
                          const color = assetColors.get(asset.id) || '#8b5cf6';
                          return (
                            <div key={asset.id} className="flex items-center gap-2 text-xs">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                              <span className="flex-1 text-muted-foreground">{asset.symbol || asset.name}</span>
                              <span className="font-medium w-20 text-right">{formatCurrency(value)}</span>
                              <span className="text-muted-foreground w-12 text-right">{percentage.toFixed(1)}%</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                  
                  {/* Projected End Distribution */}
                  <div>
                    <h6 className="text-xs font-medium mb-2">Projected End Distribution</h6>
                    <div className="space-y-1.5">
                      {chartAssets
                        .map((asset) => {
                          const value = Number(endData[asset.id]) || 0;
                          return { asset, value };
                        })
                        .filter(({ value }) => value > 0)
                        .sort((a, b) => b.value - a.value)
                        .map(({ asset, value }) => {
                          const percentage = endNetWorthValue > 0 ? (value / endNetWorthValue) * 100 : 0;
                          const todayValue = Number(todayData[asset.id]) || 0;
                          const change = todayValue > 0 ? ((value - todayValue) / todayValue) * 100 : 0;
                          const color = assetColors.get(asset.id) || '#8b5cf6';
                          return (
                            <div key={asset.id} className="flex items-center gap-2 text-xs">
                              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                              <span className="flex-1 text-muted-foreground">{asset.symbol || asset.name}</span>
                              <span className="font-medium w-20 text-right">{formatCurrency(value)}</span>
                              <span className="text-muted-foreground w-12 text-right">{percentage.toFixed(1)}%</span>
                              {change !== 0 && (
                                <span className={cn(
                                  "text-xs w-16 text-right",
                                  change > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                )}>
                                  {change > 0 ? '+' : ''}{change.toFixed(1)}%
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Key Insights */}
            <div className="mt-4 pt-4 border-t">
              <h5 className="text-xs font-semibold mb-2 text-muted-foreground">Key Insights</h5>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {viewMode === 'networth' && returnOnContributions !== null && returnOnContributions > 0 && (
                  <li>• Your investments are projected to generate a {returnOnContributions.toFixed(1)}% return on contributions</li>
                )}
                {continueFunding && monthlyContribution > 0 && (
                  <>
                    <li>• {progressiveGrowth && growthRate > 0 
                      ? `Monthly contributions will increase by ${(growthRate / 12).toFixed(2)}% each month`
                      : `You'll contribute ${formatCurrency(monthlyContribution)} monthly`} over {yearsDiff.toFixed(1)} years</li>
                    <li>• Total projected contributions: {formatCurrency(totalProjectedContributions)}</li>
                    {progressiveGrowth && growthRate > 0 && (
                      <li>• Final monthly contribution: {formatCurrency(
                        monthlyContribution * Math.pow(1 + (growthRate / 100) / 12, Math.ceil(yearsDiff * 12) - 1)
                      )}</li>
                    )}
                  </>
                )}
                {yearsDiff > 0 && annualizedGrowth > 0 && (
                  <li>• Projected annualized growth rate of {annualizedGrowth.toFixed(1)}%</li>
                )}
                {viewMode === 'networth' && endContributions > 0 && (
                  <li>• Net worth will be {((endNetWorthValue / endContributions - 1) * 100).toFixed(1)}% above total contributions</li>
                )}
                {viewMode === 'networth' && endNetWorthValue > todayNetWorthValue && (
                  <li>• Average monthly growth: {formatCurrency((endNetWorthValue - todayNetWorthValue) / Math.max(1, yearsDiff * 12))}</li>
                )}
                {!continueFunding && (
                  <li>• Projection assumes no additional contributions (only price appreciation)</li>
                )}
                {continueFunding && monthlyContribution > 0 && yearsDiff > 0 && (
                  <li>• Average monthly contribution: {formatCurrency(totalProjectedContributions / Math.max(1, yearsDiff * 12))}</li>
                )}
              </ul>
            </div>
          </div>
        );
      })()}
    </Card>
  );
}

