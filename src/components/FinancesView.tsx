'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, TrendingUp, Building2, RefreshCw, Eye, EyeOff, ArrowUpRight, ArrowDownRight, ExternalLink, Database, ChevronRight } from 'lucide-react';
import { PageIcon } from '@/components/PageIcon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { format, startOfMonth, parseISO } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { ConnectFinancesDbDialog } from '@/components/dialogs/ConnectFinancesDbDialog';
import { getDominantColor, getIconUrl } from '@/lib/notion-color';
import { NetWorthChart } from '@/components/NetWorthChart';
import { AssetMiniChart } from '@/components/AssetMiniChart';
import { AssetDistributionChart } from '@/components/AssetDistributionChart';

interface Asset {
  id: string;
  name: string;
  symbol: string | null;
  current_price: number | null;
  summary: string | null;
  currency: string | null;
  icon: any | null;
  icon_url: string | null;
  color_settings?: { primary?: string; badge?: string } | null; // Manual color override
  total_worth?: number; // Total worth from related investments
  investments?: IndividualInvestment[]; // Related investments
  properties: any;
}

interface IndividualInvestment {
  id: string;
  name: string;
  asset_id: string | null;
  place_id: string | null;
  quantity: number | null;
  purchase_price: number | null;
  purchase_date: string | null;
  current_price: number | null;
  current_value: number | null;
  currency: string | null;
  properties: any;
  asset?: Asset | null;
  place?: Place | null; // Related place/account
  current_worth?: number; // Calculated total current worth from API
}

interface Place {
  id: string;
  name: string;
  place_type: string | null;
  balance: number | null;
  total_value: number | null;
  currency: string | null;
  icon: any | null;
  icon_url: string | null;
  properties: any;
}


// Symbol Badge Component with color extraction
function SymbolBadge({ 
  symbol, 
  icon, 
  iconUrl, 
  colorSettings 
}: { 
  symbol: string; 
  icon: any; 
  iconUrl?: string | null;
  colorSettings?: { primary?: string; badge?: string } | null;
}) {
  const [bgColor, setBgColor] = React.useState<string | null>(null);

  React.useEffect(() => {
    // First priority: use manual color_settings if provided
    if (colorSettings?.badge || colorSettings?.primary) {
      setBgColor(colorSettings.badge || colorSettings.primary || null);
      return;
    }

    // Fallback: extract color from icon
    const imageUrl = iconUrl || getIconUrl(icon);
    if (imageUrl) {
      getDominantColor(imageUrl)
        .then((color) => {
          setBgColor(color);
        })
        .catch((error) => {
          console.error('SymbolBadge - error extracting color:', error);
          setBgColor(null);
        });
    } else {
      setBgColor(null);
    }
  }, [icon, iconUrl, symbol, colorSettings]);

  return (
    <Badge 
      variant="outline" 
      className="flex-shrink-0"
      style={bgColor ? {
        backgroundColor: `${bgColor}20`,
        borderColor: `${bgColor}40`,
        color: bgColor,
      } : undefined}
    >
      {symbol}
    </Badge>
  );
}

// Animated Number Component
function AnimatedNumber({ 
  value, 
  formatFn, 
  className = '',
  duration = 1000,
  animateKey = '' // Key to trigger re-animation (e.g., tab change, visibility toggle)
}: { 
  value: number | null; 
  formatFn: (val: number) => string;
  className?: string;
  duration?: number;
  animateKey?: string | number | boolean; // Trigger re-animation when this changes
}) {
  const [displayValue, setDisplayValue] = React.useState(0);
  const animationRef = React.useRef<number | null>(null);
  const startValueRef = React.useRef(0);
  const startTimeRef = React.useRef<number | null>(null);
  const previousAnimateKeyRef = React.useRef<string | number | boolean | undefined>(undefined);

  React.useEffect(() => {
    if (value === null || value === undefined) {
      setDisplayValue(0);
      previousAnimateKeyRef.current = animateKey;
      return;
    }

    // Reset animation when animateKey changes (tab change, visibility toggle)
    const animateKeyChanged = previousAnimateKeyRef.current !== animateKey;
    if (animateKeyChanged) {
      startValueRef.current = 0;
      setDisplayValue(0);
      previousAnimateKeyRef.current = animateKey;
    } else {
      startValueRef.current = displayValue;
    }

    const targetValue = value;
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValueRef.current + (targetValue - startValueRef.current) * easeOut;

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, animateKey]);

  return (
    <span className={className}>
      {formatFn(displayValue)}
    </span>
  );
}

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

export function FinancesView() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [investments, setInvestments] = useState<IndividualInvestment[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const { toast } = useToast();

  // Supported currencies
  const currencies = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
  ];

  // Collapsed groups state (from cookies)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = getCookie('finances-collapsed-groups');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch (error) {
          console.warn('Failed to parse collapsed groups from cookie:', error);
          return new Set();
        }
      }
      return new Set();
    }
    return new Set();
  });

  // Save collapsed state to cookies
  useEffect(() => {
    setCookie('finances-collapsed-groups', JSON.stringify(Array.from(collapsedGroups)));
  }, [collapsedGroups]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  const fetchFinances = async () => {
    try {
      setLoading(true);
      
      // Fetch all three tables
      const [assetsRes, investmentsRes, placesRes] = await Promise.all([
        fetch('/api/finances/assets'),
        fetch('/api/finances/investments'),
        fetch('/api/finances/places'),
      ]);

      console.log('API Responses:', {
        assets: { ok: assetsRes.ok, status: assetsRes.status },
        investments: { ok: investmentsRes.ok, status: investmentsRes.status },
        places: { ok: placesRes.ok, status: placesRes.status },
      });

      if (assetsRes.ok) {
        const assetsData = await assetsRes.json();
        console.log('Assets data received:', assetsData);
        setAssets(assetsData.data || []);
      } else {
        const errorData = await assetsRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Assets API error:', errorData);
        toast({
          title: 'Error loading assets',
          description: errorData.error || 'Failed to fetch assets',
          variant: 'destructive',
        });
      }

      if (investmentsRes.ok) {
        const investmentsData = await investmentsRes.json();
        console.log('Investments data received:', investmentsData);
        setInvestments(investmentsData.data || []);
      } else {
        const errorData = await investmentsRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Investments API error:', errorData);
      }

      if (placesRes.ok) {
        const placesData = await placesRes.json();
        console.log('Places data received:', placesData);
        setPlaces(placesData.data || []);
      } else {
        const errorData = await placesRes.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Places API error:', errorData);
      }
    } catch (error) {
      console.error('Error fetching finances:', error);
      toast({
        title: 'Error',
        description: 'Failed to load finances data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/finances/sync', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();
      toast({
        title: 'Sync Complete',
        description: `Synced ${result.results?.assets?.total || 0} assets, ${result.results?.individual_investments?.total || 0} investments, ${result.results?.places?.total || 0} places`,
      });

      // Refresh data
      await fetchFinances();
    } catch (error) {
      console.error('Error syncing:', error);
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync finances from Notion',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  // Fetch exchange rates when currency changes
  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        const response = await fetch('/api/finances/exchange-rates?base=USD');
        if (response.ok) {
          const data = await response.json();
          setExchangeRates(data.rates);
        }
      } catch (error) {
        console.error('Error fetching exchange rates:', error);
      }
    };
    fetchExchangeRates();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/finances/connection');
      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.connected);
        if (data.connected) {
          fetchFinances();
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const handleConnected = () => {
    setIsConnected(true);
    fetchFinances();
  };

  // Calculate total net worth from active places only (sum of all active place total_value)
  const activePlacesForNetWorth = places.filter(place => {
    const value = place.total_value !== null && place.total_value !== undefined ? place.total_value : (place.balance || 0);
    return value > 0;
  });
  
  const totalBalance = activePlacesForNetWorth.reduce((sum, place) => {
    // Use total_value (calculated from investments) if available, otherwise fallback to balance
    return sum + (place.total_value !== null && place.total_value !== undefined ? place.total_value : (place.balance || 0));
  }, 0);

  // Calculate total investment value
  const totalInvestmentValue = investments.reduce((sum, inv) => {
    // Use current_worth if available (from API), otherwise calculate it
    const currentWorth = inv.current_worth !== undefined
      ? inv.current_worth
      : (inv.current_value !== null
          ? Number(inv.current_value)
          : (inv.current_price && inv.quantity
              ? Number(inv.current_price) * Number(inv.quantity)
              : 0));
    return sum + (currentWorth || 0);
  }, 0);

  // Convert amount from USD to selected currency
  const convertCurrency = (amount: number | null, fromCurrency: string = 'USD'): number => {
    if (amount === null || amount === 0) return 0;
    if (selectedCurrency === fromCurrency || !exchangeRates) return amount;
    
    // If converting from USD, use the rate directly
    if (fromCurrency === 'USD') {
      const rate = exchangeRates[selectedCurrency];
      return rate ? amount * rate : amount;
    }
    
    // If converting from another currency, convert to USD first, then to target
    const fromRate = exchangeRates[fromCurrency];
    const toRate = exchangeRates[selectedCurrency];
    if (fromRate && toRate) {
      // Convert to USD first, then to target currency
      const usdAmount = amount / fromRate;
      return usdAmount * toRate;
    }
    
    return amount;
  };

  // Format currency - converts and displays in selected currency
  const formatCurrency = (amount: number | null, originalCurrency: string | null = null) => {
    const value = amount === null ? 0 : amount;
    // Convert from original currency (default USD) to selected currency
    const convertedAmount = convertCurrency(value, originalCurrency || 'USD');
    const currencyToUse = selectedCurrency;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyToUse,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto pt-12">
          <Card className="p-12 text-center">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">Connect Your Finances Databases</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Connect your three Notion databases for finances: Assets, Individual Investments, and Net Worth (Places).
              Once connected, you can view and manage your financial data.
            </p>
            <Button onClick={() => setShowConnectDialog(true)} size="lg">
              <Database className="w-4 h-4 mr-2" />
              Connect Databases
            </Button>
          </Card>
        </div>

        <ConnectFinancesDbDialog
          isOpen={showConnectDialog}
          onClose={() => setShowConnectDialog(false)}
          onConnected={handleConnected}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Finances</h1>
          <p className="text-muted-foreground mt-1">Manage your assets, investments, and accounts</p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync from Notion
            </>
          )}
        </Button>
      </div>

      {/* Net Worth Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-sm font-medium text-muted-foreground">Net Worth</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Currency Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                >
                  {currencies.find(c => c.code === selectedCurrency)?.code || 'USD'}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {currencies.map((currency) => (
                  <DropdownMenuItem
                    key={currency.code}
                    onClick={() => setSelectedCurrency(currency.code)}
                    className={selectedCurrency === currency.code ? 'bg-accent' : ''}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{currency.name}</span>
                      <span className="text-muted-foreground ml-2">{currency.code}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Conversion Rate Display */}
            {exchangeRates && selectedCurrency !== 'USD' && exchangeRates[selectedCurrency] && (
              <div className="text-xs text-muted-foreground">
                1 USD = {exchangeRates[selectedCurrency].toFixed(4)} {selectedCurrency}
              </div>
            )}
            {/* Visibility Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setBalanceVisible(!balanceVisible)}
              className="h-8 w-8"
            >
              {balanceVisible ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-4xl font-bold">
            {balanceVisible ? (
              <AnimatedNumber
                value={totalBalance}
                formatFn={(val) => formatCurrency(val)}
                animateKey={`${activeTab}-${balanceVisible}`}
              />
            ) : (
              '••••••'
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Total across {activePlacesForNetWorth.length} active account{activePlacesForNetWorth.length !== 1 ? 's' : ''}
          </div>
        </div>
      </Card>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="investments">Investments</TabsTrigger>
          <TabsTrigger value="places">Accounts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net Worth</p>
                  <p className="text-2xl font-bold mt-1">
                    {balanceVisible ? (
                      <AnimatedNumber
                        value={totalBalance}
                        formatFn={(val) => formatCurrency(val)}
                        animateKey={`${activeTab}-${balanceVisible}`}
                      />
                    ) : (
                      '••••••'
                    )}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Investments</p>
                  <p className="text-2xl font-bold mt-1">
                    {balanceVisible ? (
                      <AnimatedNumber
                        value={totalInvestmentValue}
                        formatFn={(val) => formatCurrency(val)}
                        animateKey={`${activeTab}-${balanceVisible}`}
                      />
                    ) : (
                      '••••••'
                    )}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Assets</p>
                  <p className="text-2xl font-bold mt-1">{assets.length}</p>
                </div>
                <Building2 className="w-8 h-8 text-purple-500" />
              </div>
            </Card>
          </div>

          {/* Net Worth Chart */}
          <NetWorthChart investments={investments} />

          {/* Asset Distribution Pie Chart */}
          <AssetDistributionChart 
            assets={assets} 
            places={places}
            investments={investments}
            balanceVisible={balanceVisible}
          />

          {/* All Investments Grouped by Month */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">All Investments</h2>
            </div>
            {(() => {
              // Group investments by month
              const groupedByMonth = investments.reduce((acc, investment) => {
                if (!investment.purchase_date) {
                  const noDateKey = 'No Date';
                  if (!acc[noDateKey]) acc[noDateKey] = [];
                  acc[noDateKey].push(investment);
                  return acc;
                }
                
                const date = new Date(investment.purchase_date);
                const monthKey = format(startOfMonth(date), 'MMMM yyyy');
                if (!acc[monthKey]) acc[monthKey] = [];
                acc[monthKey].push(investment);
                return acc;
              }, {} as Record<string, typeof investments>);

              // Sort months descending (newest first)
              const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => {
                if (a === 'No Date') return 1;
                if (b === 'No Date') return -1;
                // Parse month strings like "January 2024" to dates for comparison
                try {
                  const dateA = new Date(a + ' 1');
                  const dateB = new Date(b + ' 1');
                  return dateB.getTime() - dateA.getTime();
                } catch {
                  return 0;
                }
              });

              return (
                <div className="space-y-6">
                  {sortedMonths.map((monthKey) => (
                    <div key={monthKey} className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {monthKey}
                      </h3>
                      <div className="space-y-2">
                        {groupedByMonth[monthKey].map((investment) => (
                          <div
                            key={investment.id}
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              {/* Asset Icon with Buy/Sell indicator */}
                              {(() => {
                                // Check if it's a sale (negative purchase_price or quantity)
                                const isSale = (investment.purchase_price !== null && investment.purchase_price < 0) ||
                                              (investment.quantity !== null && investment.quantity < 0);
                                
                                return investment.asset ? (
                                  <div className="flex-shrink-0 relative w-10 h-10">
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                                      <PageIcon 
                                        icon={investment.asset.icon} 
                                        iconUrl={investment.asset.icon_url}
                                        className="w-6 h-6" 
                                        fallbackIcon={<Building2 className="w-6 h-6 text-muted-foreground" />}
                                      />
                                    </div>
                                    {/* Buy/Sell indicator icon in bottom right corner */}
                                    <div className={cn(
                                      "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-background",
                                      isSale 
                                        ? "bg-red-500 dark:bg-red-600" 
                                        : "bg-green-500 dark:bg-green-600"
                                    )}>
                                      {isSale ? (
                                        <ArrowDownRight className="w-2.5 h-2.5 text-white" />
                                      ) : (
                                        <ArrowUpRight className="w-2.5 h-2.5 text-white" />
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex-shrink-0 relative w-10 h-10">
                                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                                      <TrendingUp className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    {/* Buy/Sell indicator icon in bottom right corner */}
                                    <div className={cn(
                                      "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-background",
                                      isSale 
                                        ? "bg-red-500 dark:bg-red-600" 
                                        : "bg-green-500 dark:bg-green-600"
                                    )}>
                                      {isSale ? (
                                        <ArrowDownRight className="w-2.5 h-2.5 text-white" />
                                      ) : (
                                        <ArrowUpRight className="w-2.5 h-2.5 text-white" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{investment.name}</p>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
                                  <span>{investment.asset?.name || 'Unknown Asset'}</span>
                                  {investment.place && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                                          <PageIcon 
                                            icon={investment.place.icon} 
                                            iconUrl={investment.place.icon_url}
                                            className="w-3 h-3" 
                                            fallbackIcon={<Building2 className="w-3 h-3" />}
                                          />
                                        </div>
                                        {investment.place.name}
                                      </span>
                                    </>
                                  )}
                                  {investment.purchase_date && (
                                    <>
                                      <span>•</span>
                                      <span>{format(new Date(investment.purchase_date), 'MMM d, yyyy')}</span>
                                    </>
                                  )}
                                  {investment.quantity !== null && (
                                    <>
                                      <span>•</span>
                                      <span>
                                        {(() => {
                                          const qty = Math.abs(Number(investment.quantity));
                                          // Format without forcing decimals - show decimals only if needed
                                          const formattedQty = qty % 1 === 0 ? qty.toLocaleString() : qty.toLocaleString(undefined, { maximumFractionDigits: 8 });
                                          return `${formattedQty} ${investment.asset?.symbol || 'units'}`;
                                        })()}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {/* Trade summary */}
                                {(() => {
                                  const isSale = (investment.purchase_price !== null && investment.purchase_price < 0) ||
                                                (investment.quantity !== null && investment.quantity < 0);
                                  const action = isSale ? 'Sold' : 'Bought';
                                  const qty = investment.quantity !== null ? Math.abs(Number(investment.quantity)) : null;
                                  const price = investment.purchase_price !== null ? Math.abs(Number(investment.purchase_price)) : null;
                                  const totalAmount = investment.properties?.["How much?"] !== undefined
                                    ? Math.abs(Number(investment.properties["How much?"]))
                                    : (price !== null && qty !== null ? price * qty : null);
                                  
                                  if (qty !== null && price !== null && totalAmount !== null) {
                                    const qtyFormatted = qty % 1 === 0 ? qty.toLocaleString() : qty.toLocaleString(undefined, { maximumFractionDigits: 8 });
                                    return (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {action} {qtyFormatted} {investment.asset?.symbol || 'units'} at {balanceVisible ? formatCurrency(price, investment.currency) : '••••'} each for {balanceVisible ? formatCurrency(totalAmount, investment.currency) : '••••'}
                                        {investment.purchase_date && ` on ${format(new Date(investment.purchase_date), 'MMM d, yyyy')}`}.
                                      </p>
                                    );
                                  }
                                  return null;
                                })()}
                                {/* Additional financial details */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                                  {(() => {
                                    // Get total purchase amount - prefer "How much?" from properties, otherwise calculate
                                    const totalPurchaseAmount = investment.properties?.["How much?"] !== undefined
                                      ? Math.abs(Number(investment.properties["How much?"]))
                                      : (investment.purchase_price !== null && investment.quantity !== null
                                          ? Math.abs(Number(investment.purchase_price) * Number(investment.quantity))
                                          : null);
                                    
                                    // Purchase price per unit
                                    const purchasePricePerUnit = investment.purchase_price !== null
                                      ? Math.abs(Number(investment.purchase_price))
                                      : null;
                                    
                                    return (
                                      <>
                                        {totalPurchaseAmount !== null && purchasePricePerUnit !== null && (
                                          <span>
                                            Purchase: {balanceVisible ? formatCurrency(totalPurchaseAmount, investment.currency) : '••••'} @ {balanceVisible ? formatCurrency(purchasePricePerUnit, investment.currency) : '••••'}
                                          </span>
                                        )}
                                        {investment.current_price !== null && (
                                          <span>
                                            Current: {balanceVisible ? formatCurrency(investment.current_price, investment.currency) : '••••'}
                                          </span>
                                        )}
                                      </>
                                    );
                                  })()}
                                  {(() => {
                                    // Calculate purchase worth - prefer "How much?" from properties (total amount invested)
                                    const purchaseWorth = investment.properties?.["How much?"] !== undefined
                                      ? Math.abs(Number(investment.properties["How much?"]))
                                      : (investment.purchase_price !== null && investment.quantity !== null
                                          ? Math.abs(Number(investment.purchase_price) * Number(investment.quantity))
                                          : null);
                                    
                                    // For ROI, use absolute values to handle sales correctly
                                    // Calculate current worth: prefer current_value, otherwise current_price * |quantity|
                                    const currentWorth = investment.current_value !== null
                                      ? Math.abs(Number(investment.current_value))
                                      : (investment.current_price !== null && investment.quantity !== null
                                          ? Math.abs(Number(investment.current_price) * Math.abs(Number(investment.quantity)))
                                          : (investment.current_worth !== undefined && investment.current_worth !== null
                                              ? Math.abs(Number(investment.current_worth))
                                              : null));
                                    
                                    // ROI calculation: (current_worth - purchase_amount) / purchase_amount * 100
                                    // Use absolute values for both to handle sales correctly
                                    if (purchaseWorth !== null && currentWorth !== null && purchaseWorth > 0) {
                                      const roi = ((currentWorth - purchaseWorth) / purchaseWorth) * 100;
                                      return (
                                        <span className={cn(
                                          roi > 0 ? "text-green-600 dark:text-green-400" : roi < 0 ? "text-red-600 dark:text-red-400" : ""
                                        )}>
                                          ROI: {roi > 0 ? '+' : ''}
                                          <AnimatedNumber
                                            value={roi}
                                            formatFn={(val) => val.toFixed(2) + '%'}
                                            animateKey={`${activeTab}-${balanceVisible}-${investment.id}-roi`}
                                          />
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              {(() => {
                                // Calculate current worth - keep original sign for display (negative for sales)
                                const currentWorthRaw = investment.current_worth !== undefined
                                  ? investment.current_worth
                                  : (investment.current_value !== null 
                                      ? investment.current_value 
                                      : (investment.current_price && investment.quantity 
                                          ? Number(investment.current_price) * Number(investment.quantity)
                                          : null));
                                
                                // Use absolute value for P/L calculation (handles sales correctly)
                                const currentWorthAbs = currentWorthRaw !== null ? Math.abs(currentWorthRaw) : null;
                                
                                // Calculate purchase worth - keep original sign for display (negative for sales)
                                const purchaseWorthRaw = investment.properties?.["How much?"] !== undefined
                                  ? Number(investment.properties["How much?"])
                                  : (investment.purchase_price !== null && investment.quantity !== null
                                      ? Number(investment.purchase_price) * Number(investment.quantity)
                                      : null);
                                
                                // Use absolute value for P/L calculation
                                const purchaseWorthAbs = purchaseWorthRaw !== null ? Math.abs(purchaseWorthRaw) : null;
                                
                                return currentWorthRaw !== null ? (
                                  <>
                                    <p className="font-semibold">
                                      {balanceVisible ? (
                                        <AnimatedNumber
                                          value={currentWorthRaw}
                                          formatFn={(val) => formatCurrency(val, investment.currency)}
                                          animateKey={`${activeTab}-${balanceVisible}-${investment.id}`}
                                        />
                                      ) : (
                                        '••••'
                                      )}
                                    </p>
                                    {purchaseWorthRaw !== null && currentWorthAbs !== null && purchaseWorthAbs !== null && (
                                      <>
                                        <p className="text-xs text-muted-foreground">
                                          Invested: {balanceVisible ? (
                                            <AnimatedNumber
                                              value={purchaseWorthRaw}
                                              formatFn={(val) => formatCurrency(val, investment.currency)}
                                              animateKey={`${activeTab}-${balanceVisible}-${investment.id}-invested`}
                                            />
                                          ) : (
                                            '••••'
                                          )}
                                        </p>
                                        <p className={cn(
                                          "text-sm font-medium",
                                          currentWorthAbs > purchaseWorthAbs
                                            ? "text-green-600 dark:text-green-400"
                                            : currentWorthAbs < purchaseWorthAbs
                                            ? "text-red-600 dark:text-red-400"
                                            : "text-muted-foreground"
                                        )}>
                                          {currentWorthAbs > purchaseWorthAbs ? '+' : ''}
                                          {balanceVisible ? (
                                            <AnimatedNumber
                                              value={currentWorthAbs - purchaseWorthAbs}
                                              formatFn={(val) => formatCurrency(val, investment.currency)}
                                              animateKey={`${activeTab}-${balanceVisible}-${investment.id}-pl`}
                                            />
                                          ) : (
                                            '••••'
                                          )}
                                        </p>
                                      </>
                                    )}
                                  </>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {investments.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No investments yet</p>
                  )}
                </div>
              );
            })()}
          </Card>
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets" className="space-y-6">
          {(() => {
            // Calculate total_worth for each asset from investments (client-side calculation)
            const assetWorthMap = new Map<string, number>();
            investments.forEach((inv) => {
              if (inv.asset_id) {
                // Use current_worth if available, otherwise calculate it
                const currentWorth = inv.current_worth !== null && inv.current_worth !== undefined
                  ? inv.current_worth
                  : (inv.current_value !== null 
                      ? Number(inv.current_value)
                      : (inv.current_price && inv.quantity 
                          ? Number(inv.current_price) * Number(inv.quantity)
                          : 0));
                
                if (currentWorth !== 0) {
                  const existing = assetWorthMap.get(inv.asset_id) || 0;
                  assetWorthMap.set(inv.asset_id, existing + currentWorth);
                }
              }
            });

            // Debug logging
            console.log('Assets tab - Total investments:', investments.length);
            console.log('Assets tab - Investments with asset_id:', investments.filter(inv => inv.asset_id).length);
            console.log('Assets tab - Asset worth map size:', assetWorthMap.size);
            assetWorthMap.forEach((worth, assetId) => {
              const asset = assets.find(a => a.id === assetId);
              console.log(`Assets tab - Asset "${asset?.name || assetId}": calculated worth = ${worth}`);
            });

            // Enhance assets with calculated worth from investments and attach investments
            const assetsWithCalculatedWorth = assets.map((asset) => {
              const calculatedWorth = assetWorthMap.get(asset.id) || 0;
              const finalWorth = calculatedWorth > 0 ? calculatedWorth : (asset.total_worth !== undefined ? asset.total_worth : 0);
              
              // Attach investments to asset for AssetMiniChart
              const assetInvestments = investments.filter(inv => inv.asset_id === asset.id);
              
              // Debug logging for assets
              if (calculatedWorth === 0 && asset.total_worth === 0) {
                console.log(`Assets tab - Asset "${asset.name}" has ${assetInvestments.length} investments but worth is 0`);
                assetInvestments.forEach(inv => {
                  console.log(`  - Investment "${inv.name}": current_worth=${inv.current_worth}, current_value=${inv.current_value}, current_price=${inv.current_price}, quantity=${inv.quantity}`);
                });
              }
              
              return {
                ...asset,
                total_worth: finalWorth,
                investments: assetInvestments.length > 0 ? assetInvestments : (asset.investments || []), // Use calculated investments or fallback to asset.investments
              };
            });

            // Sort assets by total_worth descending, then by name
            assetsWithCalculatedWorth.sort((a, b) => {
              if (b.total_worth !== a.total_worth) {
                return b.total_worth - a.total_worth;
              }
              return a.name.localeCompare(b.name);
            });

            // Group assets into active and inactive
            const activeAssets = assetsWithCalculatedWorth.filter(asset => 
              (asset.total_worth !== undefined && asset.total_worth > 0) || 
              (asset.total_worth === undefined && asset.current_price !== null)
            );
            const inactiveAssets = assetsWithCalculatedWorth.filter(asset => 
              asset.total_worth === 0 || 
              (asset.total_worth === undefined && asset.current_price === null)
            );

            return (
              <>
                {/* Active Assets */}
                {activeAssets.length > 0 && (() => {
                  const isCollapsed = collapsedGroups.has('active');
                  return (
                    <div className="space-y-3">
                      <motion.button
                        onClick={() => toggleGroup('active')}
                        className="flex items-center gap-2 text-lg font-semibold text-foreground hover:text-foreground/80 transition-colors w-full text-left"
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.div
                          animate={{ rotate: isCollapsed ? 0 : 90 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </motion.div>
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span>
                          Active Assets{' '}
                          <span className="text-sm text-muted-foreground font-normal">
                            ({activeAssets.length})
                          </span>
                        </span>
                      </motion.button>
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {activeAssets.map((asset) => (
              <Card key={asset.id} className="p-4">
                <div className="flex items-start space-x-3 mb-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <PageIcon 
                      icon={asset.icon} 
                      className="w-6 h-6" 
                      fallbackIcon={<Building2 className="w-6 h-6 text-muted-foreground" />}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold truncate">{asset.name}</h3>
                      {asset.symbol && (
                        <SymbolBadge 
                          symbol={asset.symbol} 
                          icon={asset.icon} 
                          iconUrl={asset.icon_url}
                          colorSettings={asset.color_settings}
                        />
                      )}
                    </div>
                    {/* Account icons for this asset */}
                    {asset.investments && asset.investments.length > 0 && (() => {
                      // Get unique places from investments
                      const uniquePlaces = new Map<string, Place>();
                      asset.investments.forEach((inv) => {
                        if (inv.place && !uniquePlaces.has(inv.place.id)) {
                          uniquePlaces.set(inv.place.id, inv.place);
                        }
                      });
                      const placesArray = Array.from(uniquePlaces.values());
                      
                      if (placesArray.length > 0) {
                        return (
                          <div className="flex items-center gap-1.5 mb-2">
                            {placesArray.map((place) => (
                              <div 
                                key={place.id} 
                                className="w-5 h-5 rounded flex items-center justify-center overflow-hidden flex-shrink-0"
                                title={place.name}
                              >
                                <PageIcon 
                                  icon={place.icon} 
                                  iconUrl={place.icon_url}
                                  className="w-5 h-5" 
                                  fallbackIcon={<Building2 className="w-5 h-5 text-muted-foreground" />}
                                />
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {asset.total_worth !== undefined ? (
                      // If total_worth is calculated (even if 0), show it
                      // 0 means they don't hold this asset anymore
                      <div>
                        <p className="text-lg font-bold">
                          {balanceVisible ? (
                            <AnimatedNumber
                              value={asset.total_worth}
                              formatFn={(val) => formatCurrency(val, asset.currency)}
                              animateKey={`${activeTab}-${balanceVisible}-${asset.id}`}
                            />
                          ) : (
                            '••••••'
                          )}
                        </p>
                        {/* ROI Calculation */}
                        {asset.investments && asset.investments.length > 0 && (() => {
                          // Calculate total invested amount
                          const totalInvested = asset.investments.reduce((sum, inv) => {
                            const purchaseAmount = inv.properties?.["How much?"] !== undefined
                              ? Number(inv.properties["How much?"])
                              : (inv.purchase_price !== null && inv.quantity !== null
                                  ? Number(inv.purchase_price) * Number(inv.quantity)
                                  : 0);
                            return sum + Math.abs(purchaseAmount); // Use absolute value for ROI calculation
                          }, 0);

                          // Calculate ROI
                          if (totalInvested > 0 && asset.total_worth !== undefined) {
                            const roi = ((asset.total_worth - totalInvested) / totalInvested) * 100;
                            return (
                              <p className={cn(
                                "text-sm font-medium mt-1",
                                roi > 0 ? "text-green-600 dark:text-green-400" : roi < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                              )}>
                                ROI: {roi > 0 ? '+' : ''}
                                {balanceVisible ? (
                                  <AnimatedNumber
                                    value={roi}
                                    formatFn={(val) => `${val.toFixed(2)}%`}
                                    animateKey={`${activeTab}-${balanceVisible}-${asset.id}-roi`}
                                  />
                                ) : (
                                  '••••'
                                )}
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    ) : asset.current_price !== null ? (
                      // Only fallback to current_price if total_worth hasn't been calculated yet
                      <p className="text-lg font-bold">
                        {balanceVisible ? (
                          <AnimatedNumber
                            value={asset.current_price}
                            formatFn={(val) => formatCurrency(val, asset.currency)}
                            animateKey={`${activeTab}-${balanceVisible}-${asset.id}`}
                          />
                        ) : (
                          '••••••'
                        )}
                      </p>
                    ) : null}
                    {asset.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{asset.summary}</p>
                    )}
                    {/* Mini 1Y Chart */}
                    {asset.symbol && asset.investments && asset.investments.length > 0 && (
                      <AssetMiniChart 
                        symbol={asset.symbol} 
                        icon={asset.icon}
                        iconUrl={asset.icon_url}
                        investments={asset.investments}
                        colorSettings={asset.color_settings}
                      />
                    )}
                  </div>
                </div>

                {/* Related Investments */}
                {asset.investments && asset.investments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Investments ({asset.investments.length})
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {[...asset.investments]
                        .sort((a, b) => {
                          // Sort by purchase_date descending (newest first)
                          if (!a.purchase_date && !b.purchase_date) return 0;
                          if (!a.purchase_date) return 1;
                          if (!b.purchase_date) return -1;
                          return new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime();
                        })
                        .map((investment) => (
                          <div
                            key={investment.id}
                            className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-accent transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{investment.name}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                                {investment.purchase_date && (
                                  <span>{format(new Date(investment.purchase_date), 'MMM d, yyyy')}</span>
                                )}
                              </div>
                            </div>
                            {(() => {
                              // Calculate current worth: use current_worth from API if available, otherwise calculate
                              const currentWorth = investment.current_worth !== undefined
                                ? investment.current_worth
                                : (investment.current_value !== null 
                                    ? investment.current_value 
                                    : (investment.current_price && investment.quantity 
                                        ? Number(investment.current_price) * Number(investment.quantity)
                                        : null));
                              
                              return currentWorth !== null ? (
                                <div className="text-right ml-2">
                                  <p className="font-semibold text-xs">
                                    {balanceVisible ? (
                                      <AnimatedNumber
                                        value={currentWorth}
                                        formatFn={(val) => formatCurrency(val, investment.currency)}
                                        animateKey={`${activeTab}-${balanceVisible}-${investment.id}-asset-list`}
                                      />
                                    ) : (
                                      '••••'
                                    )}
                                  </p>
                                  {investment.quantity && investment.current_price && (
                                    <p className="text-xs text-muted-foreground">
                                      {investment.quantity.toLocaleString()} @ {formatCurrency(investment.current_price, investment.currency)}
                                    </p>
                                  )}
                                </div>
                              ) : null;
                            })()}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </Card>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })()}

                {/* Inactive Assets */}
                {inactiveAssets.length > 0 && (() => {
                  const isCollapsed = collapsedGroups.has('inactive');
                  return (
                    <div className="space-y-3">
                      <motion.button
                        onClick={() => toggleGroup('inactive')}
                        className="flex items-center gap-2 text-lg font-semibold text-foreground hover:text-foreground/80 transition-colors w-full text-left"
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.div
                          animate={{ rotate: isCollapsed ? 0 : 90 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </motion.div>
                        <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                        <span>
                          Inactive Assets{' '}
                          <span className="text-sm text-muted-foreground font-normal">
                            ({inactiveAssets.length})
                          </span>
                        </span>
                      </motion.button>
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {inactiveAssets.map((asset) => (
                    <Card key={asset.id} className="p-4 opacity-60">
                      <div className="flex items-start space-x-3 mb-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <PageIcon 
                            icon={asset.icon} 
                            className="w-6 h-6" 
                            fallbackIcon={<Building2 className="w-6 h-6 text-muted-foreground" />}
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold truncate">{asset.name}</h3>
                            {asset.symbol && (
                              <SymbolBadge 
                                symbol={asset.symbol} 
                                icon={asset.icon} 
                                iconUrl={asset.icon_url}
                                colorSettings={asset.color_settings}
                              />
                            )}
                          </div>
                          {/* Account icons for this asset */}
                          {asset.investments && asset.investments.length > 0 && (() => {
                            // Get unique places from investments
                            const uniquePlaces = new Map<string, Place>();
                            asset.investments.forEach((inv) => {
                              if (inv.place && !uniquePlaces.has(inv.place.id)) {
                                uniquePlaces.set(inv.place.id, inv.place);
                              }
                            });
                            const placesArray = Array.from(uniquePlaces.values());
                            
                            if (placesArray.length > 0) {
                              return (
                                <div className="flex items-center gap-1.5 mb-2">
                                  {placesArray.map((place) => (
                                    <div 
                                      key={place.id} 
                                      className="w-5 h-5 rounded flex items-center justify-center overflow-hidden flex-shrink-0"
                                      title={place.name}
                                    >
                                      <PageIcon 
                                        icon={place.icon} 
                                        iconUrl={place.icon_url}
                                        className="w-5 h-5" 
                                        fallbackIcon={<Building2 className="w-5 h-5 text-muted-foreground" />}
                                      />
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {asset.total_worth !== undefined ? (
                            <div>
                              <p className="text-lg font-bold">
                                {balanceVisible ? (
                                  <AnimatedNumber
                                    value={asset.total_worth}
                                    formatFn={(val) => formatCurrency(val, asset.currency)}
                                    animateKey={`${activeTab}-${balanceVisible}-${asset.id}-inactive`}
                                  />
                                ) : (
                                  '••••••'
                                )}
                              </p>
                              {/* ROI Calculation */}
                              {asset.investments && asset.investments.length > 0 && (() => {
                                // Calculate total invested amount
                                const totalInvested = asset.investments.reduce((sum, inv) => {
                                  const purchaseAmount = inv.properties?.["How much?"] !== undefined
                                    ? Number(inv.properties["How much?"])
                                    : (inv.purchase_price !== null && inv.quantity !== null
                                        ? Number(inv.purchase_price) * Number(inv.quantity)
                                        : 0);
                                  return sum + Math.abs(purchaseAmount); // Use absolute value for ROI calculation
                                }, 0);

                                // Calculate ROI
                                if (totalInvested > 0 && asset.total_worth !== undefined) {
                                  const roi = ((asset.total_worth - totalInvested) / totalInvested) * 100;
                                  return (
                                    <p className={cn(
                                      "text-sm font-medium mt-1",
                                      roi > 0 ? "text-green-600 dark:text-green-400" : roi < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                                    )}>
                                      ROI: {roi > 0 ? '+' : ''}
                                      {balanceVisible ? (
                                        <AnimatedNumber
                                          value={roi}
                                          formatFn={(val) => `${val.toFixed(2)}%`}
                                          animateKey={`${activeTab}-${balanceVisible}-${asset.id}-inactive-roi`}
                                        />
                                      ) : (
                                        '••••'
                                      )}
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          ) : null}
                          {asset.summary && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{asset.summary}</p>
                          )}
                          {/* Mini 1Y Chart */}
                          {asset.symbol && asset.investments && asset.investments.length > 0 && (
                            <AssetMiniChart 
                              symbol={asset.symbol} 
                              icon={asset.icon}
                              iconUrl={asset.icon_url}
                              investments={asset.investments}
                              colorSettings={asset.color_settings}
                            />
                          )}
                        </div>
                      </div>
                    </Card>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })()}

                {assets.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No assets found. Sync from Notion to get started.
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* Investments Tab */}
        <TabsContent value="investments" className="space-y-4">
          <div className="space-y-3">
            {investments.map((investment) => (
              <Card key={investment.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {/* Asset Icon */}
                      {investment.asset ? (
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                          <PageIcon 
                            icon={investment.asset.icon} 
                            className="w-6 h-6" 
                            fallbackIcon={<Building2 className="w-6 h-6 text-muted-foreground" />}
                          />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{investment.name}</h3>
                        {investment.asset && (
                          <SymbolBadge 
                            symbol={investment.asset.symbol || investment.asset.name} 
                            icon={investment.asset.icon}
                            iconUrl={investment.asset.icon_url}
                            colorSettings={investment.asset.color_settings}
                          />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Quantity</p>
                        <p className="font-medium">{investment.quantity || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Purchase Price</p>
                        <p className="font-medium">
                          {balanceVisible ? formatCurrency(investment.purchase_price, investment.currency) : '••••'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Current Price</p>
                        <p className="font-medium">
                          {balanceVisible ? formatCurrency(investment.current_price, investment.currency) : '••••'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Current Worth</p>
                        <p className="font-medium">
                          {(() => {
                            // Calculate current worth: use current_worth from API if available, otherwise calculate
                            const currentWorth = investment.current_worth !== undefined
                              ? investment.current_worth
                              : (investment.current_value !== null 
                                  ? investment.current_value 
                                  : (investment.current_price && investment.quantity 
                                      ? Number(investment.current_price) * Number(investment.quantity)
                                      : null));
                            return balanceVisible && currentWorth !== null 
                              ? (
                                <AnimatedNumber
                                  value={currentWorth}
                                  formatFn={(val) => formatCurrency(val, investment.currency)}
                                  animateKey={`${activeTab}-${balanceVisible}-${investment.id}-worth`}
                                />
                              )
                              : 'N/A';
                          })()}
                        </p>
                        {(() => {
                          // Show gain/loss if we can calculate it
                          const currentWorth = investment.current_worth !== undefined
                            ? investment.current_worth
                            : (investment.current_value !== null 
                                ? investment.current_value 
                                : (investment.current_price && investment.quantity 
                                    ? Number(investment.current_price) * Number(investment.quantity)
                                    : null));
                          const purchaseWorth = investment.purchase_price && investment.quantity
                            ? Number(investment.purchase_price) * Number(investment.quantity)
                            : null;
                          
                          if (currentWorth !== null && purchaseWorth !== null && balanceVisible) {
                            const gainLoss = currentWorth - purchaseWorth;
                            return (
                              <p className={cn(
                                "text-xs mt-0.5",
                                gainLoss > 0
                                  ? "text-green-600 dark:text-green-400"
                                  : gainLoss < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-muted-foreground"
                              )}>
                                {gainLoss > 0 ? '+' : ''}
                                <AnimatedNumber
                                  value={gainLoss}
                                  formatFn={(val) => formatCurrency(val, investment.currency)}
                                  animateKey={`${activeTab}-${balanceVisible}-${investment.id}-gainloss`}
                                />
                              </p>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {investments.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No investments found. Sync from Notion to get started.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Places Tab */}
        <TabsContent value="places" className="space-y-6">
          {(() => {
            // Sort places by total_value (descending), then by name
            const sortedPlaces = [...places].sort((a, b) => {
              const aValue = a.total_value !== null && a.total_value !== undefined ? a.total_value : (a.balance || 0);
              const bValue = b.total_value !== null && b.total_value !== undefined ? b.total_value : (b.balance || 0);
              if (bValue !== aValue) {
                return bValue - aValue;
              }
              return a.name.localeCompare(b.name);
            });

            // Group places into active (total_value > 0) and inactive (total_value === 0 or null)
            const activePlaces = sortedPlaces.filter(place => {
              const value = place.total_value !== null && place.total_value !== undefined ? place.total_value : (place.balance || 0);
              return value > 0;
            });
            const inactivePlaces = sortedPlaces.filter(place => {
              const value = place.total_value !== null && place.total_value !== undefined ? place.total_value : (place.balance || 0);
              return value === 0;
            });

            return (
              <>
                {/* Active Places */}
                {activePlaces.length > 0 && (() => {
                  const isCollapsed = collapsedGroups.has('active-places');
                  return (
                    <div className="space-y-3">
                      <motion.button
                        onClick={() => toggleGroup('active-places')}
                        className="flex items-center gap-2 text-lg font-semibold text-foreground hover:text-foreground/80 transition-colors w-full text-left"
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.div
                          animate={{ rotate: isCollapsed ? 0 : 90 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </motion.div>
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span>
                          Active Accounts{' '}
                          <span className="text-sm text-muted-foreground font-normal">
                            ({activePlaces.length})
                          </span>
                        </span>
                      </motion.button>
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {activePlaces.map((place) => {
                                const placeValue = place.total_value !== null && place.total_value !== undefined ? place.total_value : (place.balance || 0);
                                return (
                                  <Card key={place.id} className="p-4">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                                            <PageIcon 
                                              icon={place.icon} 
                                              iconUrl={place.icon_url}
                                              className="w-5 h-5" 
                                              fallbackIcon={<Building2 className="w-5 h-5 text-muted-foreground" />}
                                            />
                                          </div>
                                          <h3 className="font-semibold">{place.name}</h3>
                                        </div>
                                        {place.institution && (
                                          <p className="text-sm text-muted-foreground mb-2">{place.institution}</p>
                                        )}
                                        {place.place_type && (
                                          <Badge variant="outline" className="mb-2">{place.place_type}</Badge>
                                        )}
                                        <div className="mt-3">
                                          <p className="text-sm text-muted-foreground">
                                            {place.total_value !== null ? 'Total Value' : 'Balance'}
                                          </p>
                                          <p className="text-2xl font-bold">
                                            {balanceVisible 
                                              ? (
                                                <AnimatedNumber
                                                  value={placeValue}
                                                  formatFn={(val) => formatCurrency(val, place.currency)}
                                                  animateKey={`${activeTab}-${balanceVisible}-${place.id}`}
                                                />
                                              )
                                              : '••••••'}
                                          </p>
                                          {place.total_value !== null && place.balance !== null && place.balance !== 0 && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Bank: {formatCurrency(place.balance, place.currency)}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })()}

                {/* Inactive Places */}
                {inactivePlaces.length > 0 && (() => {
                  const isCollapsed = collapsedGroups.has('inactive-places');
                  return (
                    <div className="space-y-3">
                      <motion.button
                        onClick={() => toggleGroup('inactive-places')}
                        className="flex items-center gap-2 text-lg font-semibold text-foreground hover:text-foreground/80 transition-colors w-full text-left"
                        whileHover={{ x: 4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.div
                          animate={{ rotate: isCollapsed ? 0 : 90 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className="w-5 h-5" />
                        </motion.div>
                        <div className="h-2 w-2 rounded-full bg-muted-foreground"></div>
                        <span>
                          Inactive Accounts{' '}
                          <span className="text-sm text-muted-foreground font-normal">
                            ({inactivePlaces.length})
                          </span>
                        </span>
                      </motion.button>
                      <AnimatePresence>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {inactivePlaces.map((place) => {
                                const placeValue = place.total_value !== null && place.total_value !== undefined ? place.total_value : (place.balance || 0);
                                return (
                                  <Card key={place.id} className="p-4 opacity-60">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                                            <PageIcon 
                                              icon={place.icon} 
                                              iconUrl={place.icon_url}
                                              className="w-5 h-5" 
                                              fallbackIcon={<Building2 className="w-5 h-5 text-muted-foreground" />}
                                            />
                                          </div>
                                          <h3 className="font-semibold">{place.name}</h3>
                                        </div>
                                        {place.institution && (
                                          <p className="text-sm text-muted-foreground mb-2">{place.institution}</p>
                                        )}
                                        {place.place_type && (
                                          <Badge variant="outline" className="mb-2">{place.place_type}</Badge>
                                        )}
                                        <div className="mt-3">
                                          <p className="text-sm text-muted-foreground">
                                            {place.total_value !== null ? 'Total Value' : 'Balance'}
                                          </p>
                                          <p className="text-2xl font-bold">
                                            {balanceVisible 
                                              ? (
                                                <AnimatedNumber
                                                  value={placeValue}
                                                  formatFn={(val) => formatCurrency(val, place.currency)}
                                                  animateKey={`${activeTab}-${balanceVisible}-${place.id}`}
                                                />
                                              )
                                              : '••••••'}
                                          </p>
                                          {place.total_value !== null && place.balance !== null && place.balance !== 0 && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Bank: {formatCurrency(place.balance, place.currency)}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })()}

                {places.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No accounts found. Sync from Notion to get started.
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

