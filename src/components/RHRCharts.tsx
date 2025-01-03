import { useEffect } from 'react';
import {
  LineChart,
  AreaChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Outfit } from 'next/font/google';
import { ChartLoadingOverlay } from '@/components/ChartLoadingOverlay';

const outfit = Outfit({ subsets: ['latin'] });

interface RHRData {
  date: string;
  restingHeartRate: number | null;
}

// Helper function to generate Y-axis ticks including the average
const generateYAxisTicks = (min: number, max: number, average: number) => {
  const ticks = new Set<number>();
  ticks.add(Math.floor(min));
  ticks.add(Math.ceil(max));
  ticks.add(average);
  for (let i = Math.floor(min); i <= Math.ceil(max); i++) {
    ticks.add(i);
  }
  return Array.from(ticks).sort((a, b) => a - b);
};

interface RHRChartProps {
  data: RHRData[];
  isLoadingCharts: boolean;
  tickInterval: number;
}

export const RHRChart = ({ data, isLoadingCharts, tickInterval }: RHRChartProps) => {
  const chartData = data.map((entry) => ({
    date: entry.date,
    rhr: entry.restingHeartRate,
  }));

  const validRHR = data
    .filter((entry) => entry.restingHeartRate !== null)
    .map((entry) => entry.restingHeartRate as number);

  const averageRHR = validRHR.length > 0
    ? Math.round(validRHR.reduce((acc, curr) => acc + curr, 0) / validRHR.length)
    : 0;

  const CustomYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const isAverage = Math.abs(payload.value - averageRHR) < 0.5;

    return (
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fill={isAverage ? '#ef4444' : 'currentColor'}
        className={isAverage ? 'font-medium' : ''}
      >
        {payload.value}
      </text>
    );
  };

  const minRHR = Math.min(...validRHR);
  const maxRHR = Math.max(...validRHR);
  const yAxisTicks = generateYAxisTicks(minRHR, maxRHR, averageRHR);

  return (
    <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
      <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
        Resting Heart Rate
      </h3>
      <div className={`transition-opacity duration-200 ${isLoadingCharts ? 'opacity-50' : 'opacity-100'}`}>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart 
            data={chartData} 
            margin={{ bottom: 15, left: 5, right: 15, top: 5 }}
          >
            <defs>
              <linearGradient id="rhrGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              angle={-45}
              textAnchor="end"
              height={60}
              interval={tickInterval}
              tick={{ 
                dy: 10, 
                fontSize: '0.7rem',
                fill: 'currentColor' 
              }}
              scale="point"
              padding={{ left: 10, right: 10 }}
            />
            <YAxis
              domain={[minRHR - 2, maxRHR + 2]}
              tick={<CustomYAxisTick />}
              ticks={yAxisTicks}
              width={35}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {label}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        RHR: {payload[0].value} bpm
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="rhr"
              stroke="#ef4444"
              fill="url(#rhrGradient)"
              strokeWidth={3}
              name="Resting Heart Rate"
              connectNulls={false}
            />
            <ReferenceLine
              y={averageRHR}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{
                value: `Average`,
                position: 'insideRight',
                fill: '#ef4444',
                fontSize: 16,
                offset: -10,
                fontWeight: 600,
                opacity: 0.8,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {isLoadingCharts && <ChartLoadingOverlay color="red" />}
    </div>
  );
};

interface RHRAnalyticsProps {
  data: RHRData[];
}

export const RHRAnalytics = ({ data }: RHRAnalyticsProps) => {
  const validData = data
    .filter((entry) => entry.restingHeartRate != null)
    .map((entry) => ({
      rhr: entry.restingHeartRate as number,
    }));

  if (validData.length === 0) {
    return (
      <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
        <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
          RHR Analytics
        </h3>
        <p className="text-slate-600 dark:text-slate-400">
          No RHR data available for this period.
        </p>
      </div>
    );
  }

  const average = Math.round(validData.reduce((acc, curr) => acc + curr.rhr, 0) / validData.length);
  const min = Math.min(...validData.map((d) => d.rhr));
  const max = Math.max(...validData.map((d) => d.rhr));
  const firstReading = validData[validData.length - 1].rhr;
  const lastReading = validData[0].rhr;
  const trend = lastReading - firstReading;

  const meanSquaredDiff = validData.reduce((acc, curr) => acc + Math.pow(curr.rhr - average, 2), 0) / validData.length;
  const standardDeviation = Math.round(Math.sqrt(meanSquaredDiff) * 10) / 10;

  return (
    <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
      {/* ... existing analytics JSX ... */}
      <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
        RHR Analytics
      </h3>
      <div className="space-y-4">
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {average} <span className="text-sm font-normal text-slate-500">bpm</span>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Average RHR
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {min} <span className="text-xs font-normal text-slate-500">bpm</span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Lowest
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {max} <span className="text-xs font-normal text-slate-500">bpm</span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Highest
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Period Trend
            </span>
            <div className={`flex items-center gap-1 text-sm ${
              trend > 0 ? 'text-red-500' : trend < 0 ? 'text-green-500' : 'text-slate-500'
            }`}>
              {trend !== 0 && (
                <svg
                  className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              )}
              {Math.abs(trend)} bpm
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Variability
            </span>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              ±{standardDeviation} bpm
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}; 