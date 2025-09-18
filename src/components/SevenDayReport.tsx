import { useMemo } from 'react';
import { Outfit } from 'next/font/google';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { DayEntry } from '@/types/day-entry';
import { WorkoutEvent } from '@/types/workout';

const outfit = Outfit({ subsets: ['latin'] });

interface SevenDayReportProps {
  entries: DayEntry[];
  gymSessions: WorkoutEvent[];
}

export function SevenDayReport({ entries, gymSessions }: SevenDayReportProps) {
  const sevenDayStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const last7DaysEntries = (entries || [])
      .filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= sevenDaysAgo && entryDate < today;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const last7DaysWorkouts = (gymSessions || []).filter((session) => {
      const sessionDate = new Date(session.date);
      return sessionDate >= sevenDaysAgo && sessionDate < today;
    }).length;

    if (last7DaysEntries.length === 0) return null;

    const averages = last7DaysEntries.reduce(
      (acc, entry) => ({
        sleep: acc.sleep + (entry.totalSleepHours + entry.totalSleepMinutes / 60),
        rhr: acc.rhr + (entry.restingHeartRate ?? 0),
        steps: acc.steps + (entry.steps ?? 0),
        weight: acc.weight + (entry.weight || 0),
        weightCount: acc.weightCount + (entry.weight ? 1 : 0),
      }),
      { sleep: 0, rhr: 0, steps: 0, weight: 0, weightCount: 0 }
    );

    console.log(last7DaysEntries);

    return {
      sleep: averages.sleep / last7DaysEntries.length,
      rhr: averages.rhr / last7DaysEntries.length,
      steps: averages.steps / last7DaysEntries.length,
      weight: averages.weightCount > 0 ? averages.weight / averages.weightCount : null,
      workouts: last7DaysWorkouts,
    };
  }, [entries, gymSessions]);

  if (!sevenDayStats) return null;

  const metrics = [
    {
      label: 'Avg Sleep',
      value: `${sevenDayStats.sleep.toFixed(1)}h`,
      target: 8,
      isGood: sevenDayStats.sleep >= 7,
    },
    {
      label: 'Avg RHR',
      value: `${Math.round(sevenDayStats.rhr)}`,
      target: 56,
      isGood: sevenDayStats.rhr < 65,
    },
    {
      label: 'Avg Steps',
      value: `${Math.round(sevenDayStats.steps).toLocaleString()}`,
      target: 10000,
      isGood: sevenDayStats.steps >= 10000,
    },
    {
      label: 'Workouts',
      value: sevenDayStats.workouts.toString(),
      target: 4,
      isGood: sevenDayStats.workouts >= 3,
    },
  ];

  return (
    <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 mt-16 md:mt-0">
      <h3
        className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
      >
        7-Day Overview <br />(
        {new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
        })}{' '}
        - {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })})
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-1">
            <div className="text-sm text-slate-600 dark:text-slate-400">{metric.label}</div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {metric.value}
            </div>
            <div className="flex items-center gap-1 text-sm">
              {metric.isGood ? (
                <ArrowUp className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDown className="w-4 h-4 text-red-500" />
              )}
              <span className={metric.isGood ? 'text-green-500' : 'text-red-500'}>
                {metric.isGood ? 'On Track' : 'Below Target'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
