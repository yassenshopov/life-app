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

interface StepsData {
  date: string;
  steps: number | null;
}

interface StepsChartProps {
  data: StepsData[];
  isLoadingCharts: boolean;
  tickInterval: number;
}

export const StepsChart = ({ data, isLoadingCharts, tickInterval }: StepsChartProps) => {
  // Calculate average steps for the period
  const validSteps = data
    .filter((entry) => entry.steps !== null)
    .map((entry) => entry.steps as number);
  
  const averageSteps = validSteps.length > 0
    ? Math.round(validSteps.reduce((acc, curr) => acc + curr, 0) / validSteps.length)
    : 0;

  const CustomYAxisTick = (props: any) => {
    const { x, y, payload } = props;
    const value = Number(payload.value).toLocaleString();
    
    return (
      <text
        x={x}
        y={y}
        dy={4}
        dx={-2}
        textAnchor="end"
        fill="currentColor"
        fontSize="0.7rem"  // Match x-axis font size
      >
        {value}
      </text>
    );
  };

  return (
    <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
      <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
        Daily Steps
      </h3>
      <div className={`transition-opacity duration-200 ${isLoadingCharts ? 'opacity-50' : 'opacity-100'}`}>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart 
            data={data} 
            margin={{ bottom: 15, left: 5, right: 15, top: 5 }}
          >
            <defs>
              <linearGradient id="stepsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
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
              width={50}  // Slightly wider to ensure no cutoff
              tick={<CustomYAxisTick />}
              tickFormatter={(value) => value.toLocaleString()}
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
                        Steps: {payload[0].value?.toLocaleString()}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Average: {averageSteps.toLocaleString()}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="steps"
              stroke="#eab308"
              fill="url(#stepsGradient)"
              name="Steps"
              strokeWidth={3}
            />
            <ReferenceLine
              y={averageSteps}
              stroke="#eab308"
              strokeDasharray="3 3"
              label={{
                value: `Average`,
                position: 'insideRight',
                fill: '#eab308',
                fontSize: 16,
                offset: -10,
                fontWeight: 600,
                opacity: 0.8,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {isLoadingCharts && <ChartLoadingOverlay color="yellow" />}
    </div>
  );
};

interface StepsAnalyticsProps {
  data: StepsData[];
}

export const StepsAnalytics = ({ data }: StepsAnalyticsProps) => {
  const validData = data
    .filter((entry) => entry.steps !== null)
    .map((entry) => ({
      steps: entry.steps as number,
    }));

  if (validData.length === 0) {
    return (
      <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
        <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
          Steps Analytics
        </h3>
        <p className="text-slate-600 dark:text-slate-400">
          No steps data available for this period.
        </p>
      </div>
    );
  }

  const average = Math.round(validData.reduce((acc, curr) => acc + curr.steps, 0) / validData.length);
  const min = Math.min(...validData.map((d) => d.steps));
  const max = Math.max(...validData.map((d) => d.steps));
  const firstReading = validData[validData.length - 1].steps;
  const lastReading = validData[0].steps;
  const trend = lastReading - firstReading;

  const meanSquaredDiff = validData.reduce((acc, curr) => acc + Math.pow(curr.steps - average, 2), 0) / validData.length;
  const standardDeviation = Math.round(Math.sqrt(meanSquaredDiff));

  return (
    <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
      <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
        Steps Analytics
      </h3>
      <div className="space-y-4">
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {average.toLocaleString()} <span className="text-sm font-normal text-slate-500">steps</span>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Average Daily Steps
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {min.toLocaleString()} <span className="text-xs font-normal text-slate-500">steps</span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Lowest
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {max.toLocaleString()} <span className="text-xs font-normal text-slate-500">steps</span>
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
              trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-slate-500'
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
              {Math.abs(trend).toLocaleString()} steps
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Variability
            </span>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              ±{standardDeviation.toLocaleString()} steps
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}; 