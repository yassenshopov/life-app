'use client';

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { PageIcon } from '@/components/PageIcon';
import { Building2, Wallet } from 'lucide-react';
import { getDominantColor, getIconUrl } from '@/lib/notion-color';
import { motion } from 'framer-motion';

interface Asset {
  id: string;
  name: string;
  symbol: string | null;
  total_worth?: number;
  icon: any | null;
  icon_url: string | null;
  color_settings?: { primary?: string; badge?: string } | null;
  investments?: Array<{
    place?: {
      id: string;
      name: string;
      icon: any | null;
      icon_url: string | null;
    } | null;
  }>;
}

interface Place {
  id: string;
  name: string;
  total_value: number | null;
  balance: number | null;
  icon: any | null;
  icon_url: string | null;
}

interface IndividualInvestment {
  id: string;
  asset_id: string | null;
  current_worth?: number | null;
}

interface AssetDistributionChartProps {
  assets: Asset[];
  places: Place[];
  investments: IndividualInvestment[]; // Add investments to calculate total_worth
  balanceVisible: boolean;
  selectedCurrency: string;
  exchangeRates: Record<string, number> | null;
}

interface PieDataItem {
  name: string;
  value: number;
  color: string;
  type: 'asset' | 'account';
  asset?: Asset;
  accounts?: Place[]; // For account type items
}

// Generate colors for pie chart segments
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

export function AssetDistributionChart({ assets, places, investments, balanceVisible, selectedCurrency, exchangeRates }: AssetDistributionChartProps) {
  const pieData = useMemo(() => {
    const data: PieDataItem[] = [];

    // Calculate total_worth for each asset from investments and group investments by asset
    const assetWorthMap = new Map<string, number>();
    const investmentsByAsset = new Map<string, IndividualInvestment[]>();
    
    investments.forEach((inv) => {
      if (inv.asset_id) {
        // Calculate worth
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
        
        // Group investments by asset
        const existing = investmentsByAsset.get(inv.asset_id) || [];
        existing.push(inv);
        investmentsByAsset.set(inv.asset_id, existing);
      }
    });

    // Add assets (investments)
    assets.forEach((asset) => {
      // Use calculated worth from investments, or fallback to asset.total_worth, or 0
      const calculatedWorth = assetWorthMap.get(asset.id) || 0;
      const worth = calculatedWorth > 0 ? calculatedWorth : (asset.total_worth !== undefined ? asset.total_worth : 0);
      
      // Debug: Log assets that are being filtered out
      if (worth <= 0) {
        console.log(`AssetDistributionChart - Skipping asset "${asset.name}": calculatedWorth=${calculatedWorth}, asset.total_worth=${asset.total_worth}`);
      }
      
      // Only include assets with positive worth (exclude zero and negative)
      if (worth > 0) {
        // Try to get color from color_settings or derive from icon
        let color = asset.color_settings?.primary || null;
        if (!color && asset.icon_url) {
          // We'll use a default color for now, but could extract from icon
          color = COLORS[data.length % COLORS.length];
        } else if (!color) {
          color = COLORS[data.length % COLORS.length];
        }
        
        // Attach investments to asset for account icon display
        const assetInvestments = investmentsByAsset.get(asset.id) || [];
        
        data.push({
          name: asset.symbol ? `${asset.name} (${asset.symbol})` : asset.name,
          value: worth,
          color: color,
          type: 'asset',
          asset: {
            ...asset,
            investments: assetInvestments, // Attach investments so account icons can be displayed
          },
        });
      }
    });

    // Calculate pure account balance (cash only, excluding investments)
    // places.total_value includes investments, so we use balance field for pure cash
    const accountsWithCash = places.filter(place => 
      place.balance !== null && place.balance !== undefined && place.balance > 0
    );
    const pureAccountValue = accountsWithCash.reduce((sum, place) => {
      return sum + (place.balance || 0);
    }, 0);

    if (pureAccountValue > 0) {
      data.push({
        name: 'Cash',
        value: pureAccountValue,
        color: '#87CEEB', // light sky blue for accounts
        type: 'account',
        accounts: accountsWithCash, // Store account references for icon display
      });
    }

    // Sort by value descending
    data.sort((a, b) => b.value - a.value);

    return data;
  }, [assets, places]);

  const totalValue = useMemo(() => {
    return pieData.reduce((sum, item) => sum + item.value, 0);
  }, [pieData]);

  if (pieData.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Asset Distribution</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Breakdown of investments and accounts
        </p>
      </div>
      <div className="flex flex-col md:flex-row gap-6 items-center">
        {/* Donut Chart */}
        <motion.div 
          className="h-[500px] w-full md:w-1/2 flex-shrink-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={180}
                innerRadius={90}
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {pieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    stroke="none"
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string, props: any) => {
                  const percent = ((value / totalValue) * 100).toFixed(2);
                  
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
                  
                  const formatCurrency = (amount: number) => {
                    const convertedAmount = convertCurrency(amount);
                    return new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: selectedCurrency,
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(convertedAmount);
                  };
                  return [
                    balanceVisible 
                      ? `${formatCurrency(value)} (${percent}%)`
                      : `•••• (${percent}%)`,
                    name
                  ];
                }}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Asset List */}
        <div className="flex-1 space-y-2">
          {pieData
            .sort((a, b) => b.value - a.value) // Sort by value descending
            .map((item, index) => {
              const percent = ((item.value / totalValue) * 100).toFixed(2);
              
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
              
              const formatCurrency = (amount: number) => {
                const convertedAmount = convertCurrency(amount);
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: selectedCurrency,
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(convertedAmount);
              };
              
              if (item.type === 'asset' && item.asset) {
                // Get unique places for this asset's investments
                const uniquePlaces = new Map<string, { id: string; name: string; icon: any | null; icon_url: string | null }>();
                if (item.asset.investments) {
                  item.asset.investments.forEach((inv) => {
                    if (inv.place && !uniquePlaces.has(inv.place.id)) {
                      uniquePlaces.set(inv.place.id, {
                        id: inv.place.id,
                        name: inv.place.name,
                        icon: null, // Places don't have icon column, only icon_url
                        icon_url: inv.place.icon_url,
                      });
                    }
                  });
                }
                const placesArray = Array.from(uniquePlaces.values());
                
                return (
                  <div 
                    key={index} 
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      <PageIcon 
                        icon={item.asset.icon} 
                        iconUrl={item.asset.icon_url}
                        className="w-5 h-5" 
                        fallbackIcon={<Building2 className="w-5 h-5 text-muted-foreground" />}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{item.asset.name}</span>
                      {placesArray.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {placesArray.map((place) => (
                            <div key={place.id} className="relative group">
                              <PageIcon 
                                icon={place.icon} 
                                iconUrl={place.icon_url} 
                                className="w-3 h-3 rounded-full" 
                                fallbackIcon={<Building2 className="w-3 h-3 text-muted-foreground" />}
                              />
                              <span className="absolute z-10 invisible group-hover:visible bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md shadow-md -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                {place.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-auto">
                      <span className="text-xs text-muted-foreground block">
                        {balanceVisible ? formatCurrency(item.value) : '••••'}
                      </span>
                      <span className="text-xs text-muted-foreground">{percent}%</span>
                    </div>
                  </div>
                );
              } else if (item.type === 'account' && item.accounts) {
                return (
                  <div 
                    key={index} 
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {item.accounts.length === 1 ? (
                        <PageIcon 
                          icon={item.accounts[0].icon} 
                          iconUrl={item.accounts[0].icon_url}
                          className="w-5 h-5" 
                          fallbackIcon={<Building2 className="w-5 h-5 text-muted-foreground" />}
                        />
                      ) : (
                        <Wallet className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                     <div className="flex-1 min-w-0">
                       <span className="text-sm font-medium">Cash</span>
                       {item.accounts.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          {item.accounts.map((account) => (
                            <div key={account.id} className="relative group">
                              <PageIcon 
                                icon={account.icon} 
                                iconUrl={account.icon_url} 
                                className="w-3 h-3 rounded-full" 
                                fallbackIcon={<Building2 className="w-3 h-3 text-muted-foreground" />}
                              />
                              <span className="absolute z-10 invisible group-hover:visible bg-popover text-popover-foreground text-xs px-2 py-1 rounded-md shadow-md -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                {account.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-auto">
                      <span className="text-xs text-muted-foreground block">
                        {balanceVisible ? formatCurrency(item.value) : '••••'}
                      </span>
                      <span className="text-xs text-muted-foreground">{percent}%</span>
                    </div>
                  </div>
                );
              }
              return null;
            })}
        </div>
      </div>
    </Card>
  );
}

