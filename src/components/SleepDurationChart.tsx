import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { ChartLoadingOverlay } from './ChartLoadingOverlay';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

interface SleepDurationChartProps {
  data: Array<{
    date: string;
    totalSleep: number;
  }>;
  isLoadingCharts: boolean;
}

export function SleepDurationChart({ data, isLoadingCharts }: SleepDurationChartProps) {
  return (
    <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
      <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
        Sleep Duration
      </h3>
      <div className={`transition-opacity duration-200 ${isLoadingCharts ? 'opacity-50' : 'opacity-100'}`}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ bottom: 50 }}>
            <defs>
              <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
              tick={{ dy: 10 }}
            />
            <YAxis
              domain={[0, 12]}
              ticks={[0, 2, 4, 6, 8, 10, 12]}
              label={{
                value: 'Hours',
                angle: -90,
                position: 'insideLeft',
              }}
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
                        Sleep Duration:{' '}
                        {typeof payload[0].value === 'number'
                          ? payload[0].value.toFixed(1)
                          : payload[0].value}
                        h
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="totalSleep"
              stroke="#a855f7"
              fill="url(#sleepGradient)"
              strokeWidth={3}
            />
            <ReferenceLine
              y={8}
              stroke="#22c55e40"
              strokeWidth={30}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {isLoadingCharts && <ChartLoadingOverlay color="purple" />}
    </div>
  );
} 