import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from 'recharts';
import { ChartLoadingOverlay } from './ChartLoadingOverlay';
import { Outfit } from 'next/font/google';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
  setShowAwakeTime,
}: SleepCompositionChartProps) {
  return (
    <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 mt-8 border border-slate-200 dark:border-slate-800 relative mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3
          className={`text-lg font-medium text-slate-900 dark:text-slate-100 ${outfit.className}`}
        >
          Sleep Composition
        </h3>
        <div className="flex items-center space-x-2">
          <Switch id="showAwakeTime" checked={showAwakeTime} onCheckedChange={setShowAwakeTime} />
          <Label htmlFor="showAwakeTime" className="text-sm text-slate-600 dark:text-slate-400">
            Show Awake Time
          </Label>
        </div>
      </div>
      <div
        className={`transition-opacity duration-200 ${
          isLoadingCharts ? 'opacity-50' : 'opacity-100'
        }`}
      >
        <ResponsiveContainer width="100%" height={600}>
          <ComposedChart
            data={data.map((entry) => ({
              ...entry,
              deepSleepHours: entry.totalSleep * (entry.deepSleep / 100),
              remSleepHours: entry.totalSleep * (entry.remSleep / 100),
              lightSleepHours: entry.totalSleep * ((100 - entry.deepSleep - entry.remSleep) / 100),
              awakeHours: entry.awakeTime / 60, // Convert minutes to hours
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
              label={{
                value: 'Sleep Duration (hours)',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                style: { textAnchor: 'middle' },
              }}
              domain={[0, 'auto']}
            />
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
                          Light Sleep:{' '}
                          {(100 - entry.deepSleep - entry.remSleep).toFixed(1).replace('.0', '')}%
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Deep Sleep: {entry.deepSleep.toFixed(1).replace('.0', '')}%
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          REM Sleep: {entry.remSleep.toFixed(1).replace('.0', '')}%
                        </p>
                        {showAwakeTime && (
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Awake Time: {entry.awakeTime} minutes
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="deepSleepHours" stackId="a" fill="#3b82f6" name="Deep Sleep" />
            <Bar dataKey="remSleepHours" stackId="a" fill="#14b8a6" name="REM Sleep" />
            <Bar dataKey="lightSleepHours" stackId="a" fill="#60a5fa" name="Light Sleep" />
            {showAwakeTime && (
              <Bar dataKey="awakeHours" stackId="a" fill="#ef4444" name="Awake Time" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {isLoadingCharts && <ChartLoadingOverlay color="purple" />}
    </div>
  );
}
