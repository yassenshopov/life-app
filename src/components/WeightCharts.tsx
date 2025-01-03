import { useEffect } from 'react';
import {
  AreaChart,
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

interface WeightData {
  date: string;
  weight: number | null;
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

interface WeightChartProps {
  data: WeightData[];
  isLoadingCharts: boolean;
  tickInterval: number;
}

export const WeightChart = ({
  data,
  isLoadingCharts,
  tickInterval,
}: WeightChartProps) => {
  // Calculate average weight for the period
  const validWeights = data
    .filter((entry) => entry.weight !== null)
    .map((entry) => entry.weight as number);

  const averageWeight =
    validWeights.length > 0
      ? Number(
          (
            validWeights.reduce((acc, curr) => acc + curr, 0) /
            validWeights.length
          ).toFixed(1)
        )
      : 0;

  // Custom tick formatter for Y-axis
  const CustomYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const isAverage = Math.abs(payload.value - averageWeight) < 0.1;

    return (
      <text
        x={x}
        y={y}
        dy={4}
        textAnchor="end"
        fill={isAverage ? '#14b8a6' : 'currentColor'}
        className={isAverage ? 'font-medium' : ''}
      >
        {payload.value}
      </text>
    );
  };

  // Calculate domain and ticks
  const minWeight = Math.min(...validWeights);
  const maxWeight = Math.max(...validWeights);
  const yAxisTicks = generateYAxisTicks(minWeight, maxWeight, averageWeight);

  return (
    <div className="lg:col-span-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
      <h3
        className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
      >
        Weight History
      </h3>
      <div
        className={`transition-opacity duration-200 ${
          isLoadingCharts ? 'opacity-50' : 'opacity-100'
        }`}
      >
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data} margin={{ bottom:15, left: 5, right: 15, top: 5 }}>
            <defs>
              <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
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
              domain={[minWeight - 0.5, maxWeight + 0.5]}
              tick={<CustomYAxisTick />}
              ticks={yAxisTicks}
              width={35}  // Fixed width for Y-axis
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
                        Weight:{' '}
                        {typeof payload[0].value === 'number'
                          ? payload[0].value.toFixed(1)
                          : payload[0].value}{' '}
                        kg
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Average: {averageWeight} kg
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="weight"
              stroke="#14b8a6"
              fill="url(#weightGradient)"
              name="Weight (kg)"
              strokeWidth={3}
            />
            <ReferenceLine
              y={averageWeight}
              stroke="#14b8a6"
              strokeDasharray="3 3"
              label={{
                value: `Average`,
                position: 'insideRight',
                fill: '#14b8a6',
                fontSize: 16,
                offset: -10,
                fontWeight: 600,
                opacity: 0.8,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {isLoadingCharts && <ChartLoadingOverlay color="teal" />}
    </div>
  );
};

interface WeightAnalyticsProps {
  data: WeightData[];
  isLoadingCharts?: boolean;
  tickInterval?: number;
}

export const WeightAnalytics = ({ data }: WeightAnalyticsProps) => {
  const validData = data
    .filter((entry) => entry.weight !== null)
    .map((entry) => ({
      weight: entry.weight as number,
    }));

  if (validData.length === 0) {
    return (
      <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
        <h3
          className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
        >
          Weight Analytics
        </h3>
        <p className="text-slate-600 dark:text-slate-400">
          No weight data available for this period.
        </p>
      </div>
    );
  }

  const average =
    validData.reduce((acc, curr) => acc + curr.weight, 0) / validData.length;
  const min = Math.min(...validData.map((d) => d.weight));
  const max = Math.max(...validData.map((d) => d.weight));
  const firstReading = validData[validData.length - 1].weight;
  const lastReading = validData[0].weight;
  const trend = lastReading - firstReading;

  return (
    <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
      <h3
        className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
      >
        Weight Analytics
      </h3>
      <div className="space-y-4">
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {average.toFixed(1)}{' '}
            <span className="text-sm font-normal text-slate-500">kg</span>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Average Weight
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {min.toFixed(1)}{' '}
              <span className="text-xs font-normal text-slate-500">kg</span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Lowest
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {max.toFixed(1)}{' '}
              <span className="text-xs font-normal text-slate-500">kg</span>
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
            <div
              className={`flex items-center gap-1 text-sm ${
                trend > 0
                  ? 'text-red-500'
                  : trend < 0
                  ? 'text-green-500'
                  : 'text-slate-500'
              }`}
            >
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
              {Math.abs(trend).toFixed(1)} kg
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
