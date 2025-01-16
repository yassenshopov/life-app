import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line } from 'recharts';
import { ChartLoadingOverlay } from './ChartLoadingOverlay';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

interface SleepCompositionChartProps {
  data: any[];
  isLoadingCharts: boolean;
  showAwakeTime: boolean;
  setShowAwakeTime: (show: boolean) => void;
}

export function SleepCompositionChart({ 
  data, 
  isLoadingCharts, 
  showAwakeTime, 
  setShowAwakeTime 
}: SleepCompositionChartProps) {
  return (
    <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 mt-8 border border-slate-200 dark:border-slate-800 relative mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-medium text-slate-900 dark:text-slate-100 ${outfit.className}`}>
          Sleep Composition
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showAwakeTime"
            checked={showAwakeTime}
            onChange={(e) => setShowAwakeTime(e.target.checked)}
            className="rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
          />
          <label htmlFor="showAwakeTime" className="text-sm text-slate-600 dark:text-slate-400">
            Show Awake Time
          </label>
        </div>
      </div>
      <div className={`transition-opacity duration-200 ${isLoadingCharts ? 'opacity-50' : 'opacity-100'}`}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={data.map((entry) => ({
              ...entry,
              deepSleepHours: entry.totalSleep * (entry.deepSleep / 100),
              remSleepHours: entry.totalSleep * (entry.remSleep / 100),
              lightSleepHours: entry.totalSleep * ((100 - entry.deepSleep - entry.remSleep) / 100),
            }))}
            margin={{ bottom: 50 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              angle={-45} 
              textAnchor="end" 
              height={60} 
              interval="preserveStartEnd"
              tick={{ dy: 10 }} 
            />
            <YAxis
              yAxisId="left"
              label={{ 
                value: 'Sleep Duration (hours)', 
                angle: -90, 
                position: 'insideLeft',
                offset: 10,
                style: { textAnchor: 'middle' }
              }}
              domain={[0, 'auto']}
            />
            {showAwakeTime && (
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ 
                  value: 'Awake Time (minutes)', 
                  angle: 90, 
                  position: 'insideRight',
                  offset: 10,
                  style: { textAnchor: 'middle' }
                }}
                domain={[0, 'auto']}
              />
            )}
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const entry = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{label}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Sleep Duration: {entry.totalSleep.toFixed(1)}h
                      </p>
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Light Sleep: {((100 - entry.deepSleep - entry.remSleep).toFixed(1)).replace('.0', '')}%
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Deep Sleep: {entry.deepSleep.toFixed(1).replace('.0', '')}%
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          REM Sleep: {entry.remSleep.toFixed(1).replace('.0', '')}%
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar yAxisId="left" dataKey="deepSleepHours" stackId="a" fill="#3b82f6" name="Deep Sleep" />
            <Bar yAxisId="left" dataKey="remSleepHours" stackId="a" fill="#14b8a6" name="REM Sleep" />
            <Bar yAxisId="left" dataKey="lightSleepHours" stackId="a" fill="#60a5fa" name="Light Sleep" />
            {showAwakeTime && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="awakeTime"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444' }}
                name="Awake Time"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {isLoadingCharts && <ChartLoadingOverlay color="purple" />}
    </div>
  );
} 