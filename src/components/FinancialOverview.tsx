import { Outfit } from 'next/font/google';
import { useEffect, useState, useRef } from 'react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const outfit = Outfit({ subsets: ['latin'] });

interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: 'stock' | 'crypto' | 'etf';
  price: number;
  units: number;
  value: number;
  avgPrice: number;
  invested: number;
  growth: number;
  pnl: number;
  portfolioPercentage: number;
  coverUrl: string | null;
}

interface AssetAllocation {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

export function FinancialOverview() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const assetRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [showZeroBalance, setShowZeroBalance] = useState(false);
  const [sortBy, setSortBy] = useState<'value' | 'growth' | 'name'>('value');

  useEffect(() => {
    async function fetchAssets() {
      try {
        const response = await fetch('/api/notion/assets');
        if (!response.ok) {
          throw new Error('Failed to fetch assets');
        }
        const data = await response.json();
        setAssets(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch assets');
      } finally {
        setLoading(false);
      }
    }

    fetchAssets();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner size="md" color="teal" label='Loading assets...' />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 bg-red-100 dark:bg-red-900/20 p-4 rounded-lg">
        Error: {error}
      </div>
    );
  }

  // Calculate total portfolio value and allocations
  const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0);
  
  const allocations: AssetAllocation[] = [
    { 
      category: 'Stocks', 
      amount: assets.filter(a => a.type === 'stock').reduce((sum, a) => sum + a.value, 0),
      percentage: 0,
      color: 'bg-blue-500'
    },
    { 
      category: 'Crypto', 
      amount: assets.filter(a => a.type === 'crypto').reduce((sum, a) => sum + a.value, 0),
      percentage: 0,
      color: 'bg-purple-500'
    },
    { 
      category: 'ETFs', 
      amount: assets.filter(a => a.type === 'etf').reduce((sum, a) => sum + a.value, 0),
      percentage: 0,
      color: 'bg-emerald-500'
    },
  ];

  // Calculate percentages
  allocations.forEach(allocation => {
    allocation.percentage = Math.round((allocation.amount / totalValue) * 100);
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const AssetCard = ({ asset }: { asset: Asset }) => (
    <div 
      ref={(el) => { assetRefs.current[asset.symbol] = el }}
      className={`bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border 
        ${selectedAsset === asset.symbol 
          ? 'border-blue-500 ring-1 ring-blue-500/50' 
          : 'border-slate-200 dark:border-slate-800'
        } transition-all duration-300`}
    >
      {asset.coverUrl && (
        <div className="w-full h-32 relative mb-3 rounded-md overflow-hidden">
          <img 
            src={asset.coverUrl} 
            alt={`${asset.name} visualization`} 
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
        </div>
      )}
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100">{asset.symbol}</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">{asset.name}</p>
          </div>
          <span className={`text-sm font-medium ${
            asset.growth >= 0 
              ? 'text-emerald-600 dark:text-emerald-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {asset.growth >= 0 ? '+' : ''}{asset.growth.toFixed(2)}%
          </span>
        </div>

        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {formatCurrency(asset.price)}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Holdings</span>
            <span className="text-slate-900 dark:text-slate-100">
              {asset.units.toFixed(8)} • {formatCurrency(asset.value)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600 dark:text-slate-400">Average</span>
            <span className="text-slate-900 dark:text-slate-100">
              {formatCurrency(asset.avgPrice)} • P/L: {formatCurrency(asset.pnl)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
            <span className="text-slate-600 dark:text-slate-400">Portfolio Weight</span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {asset.portfolioPercentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // Sort and filter assets
  const sortedAssets = [...assets].sort((a, b) => {
    switch (sortBy) {
      case 'value':
        return b.value - a.value;
      case 'growth':
        return b.growth - a.growth;
      case 'name':
        return a.symbol.localeCompare(b.symbol);
      default:
        return 0;
    }
  });

  const visibleAssets = sortedAssets.filter(asset => 
    showZeroBalance ? true : asset.value > 0
  );

  // Define consistent colors for assets
  const getAssetColor = (index: number, total: number) => {
    const hues = [210, 240, 280, 320]; // Different base hues
    const hue = hues[index % hues.length];
    const saturation = 70;
    const lightness = 55;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  // Prepare data for pie chart
  const pieData = sortedAssets.map((asset, index) => ({
    name: asset.symbol,
    value: asset.portfolioPercentage,
    color: getAssetColor(index, sortedAssets.length)
  }));

  const handlePieClick = (value: any) => {
    setSelectedAsset(value.name);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Total Assets Card */}
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
            Total Assets
          </h3>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            {formatCurrency(totalValue)}
          </p>
          <div className="space-y-3">
            {assets
              .filter(asset => asset.value > 0)
              .sort((a, b) => b.value - a.value)
              .map(asset => (
                <div key={asset.symbol} className="flex justify-between items-center">
                  <div className="flex items-center">
                    <span className="text-slate-600 dark:text-slate-400">{asset.symbol}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(asset.value)}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-500">
                      {asset.portfolioPercentage.toFixed(1)}%
                    </span>
                    <div className="w-4 h-4 relative">
                      <svg viewBox="0 0 36 36" className="w-4 h-4 rotate-180">
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#1e293b"
                          strokeWidth="3"
                          className="dark:stroke-slate-800"
                        />
                        <path
                          d="M18 2.0845
                            a 15.9155 15.9155 0 0 1 0 31.831
                            a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="3"
                          strokeDasharray={`${asset.portfolioPercentage}, 100`}
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Monthly Change Card */}
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
            Monthly Change
          </h3>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            +{formatCurrency(2450)}
          </p>
          <div className="mt-4 space-y-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <span className="inline-block w-3 h-3 bg-emerald-500 rounded-full mr-2"></span>
              1.9% increase from last month
            </div>
          </div>
        </div>

        {/* Asset Allocation Card with Pie Chart */}
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
            Portfolio Distribution
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={60}
                  label={({ name, value }) => `${name} (${value.toFixed(1)}%)`}
                  onClick={handlePieClick}
                  className="cursor-pointer"
                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      stroke={selectedAsset === entry.name ? '#3b82f6' : 'none'}
                      strokeWidth={selectedAsset === entry.name ? 2 : 0}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(1)}%`]}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '8px',
                    padding: '8px',
                    border: 'none'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Asset Cards Section */}
      <div className="mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4">
          <h3 className={`text-xl font-medium text-slate-900 dark:text-slate-100 ${outfit.className}`}>
            Your Assets
          </h3>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'value' | 'growth' | 'name')}
                className="w-full sm:w-auto bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 
                  px-3 py-1.5 pl-9 pr-8 rounded-lg text-sm font-medium border-none 
                  focus:ring-2 focus:ring-blue-500/50 outline-none cursor-pointer appearance-none"
              >
                <option value="value">Sort by Value</option>
                <option value="growth">Sort by Growth</option>
                <option value="name">Sort by Name</option>
              </select>
              <svg 
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M7 7l5-5 5 5M7 17l5 5 5-5"
                />
              </svg>
              <svg 
                className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            <button
              onClick={() => setShowZeroBalance(!showZeroBalance)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${showZeroBalance 
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }"
            >
              <span>{showZeroBalance ? 'Hide' : 'Show'} zero balance</span>
              {showZeroBalance ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleAssets.map(asset => (
            <div key={asset.symbol} className="asset-card">
              <AssetCard asset={asset} />
            </div>
          ))}
          
          {visibleAssets.length === 0 && (
            <div className="col-span-full text-center py-8 text-slate-500 dark:text-slate-400">
              No assets to display
            </div>
          )}
        </div>
      </div>
    </>
  );
} 