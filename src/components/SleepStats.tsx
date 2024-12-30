import { Outfit } from 'next/font/google';
import { DayEntry } from '@/types/day-entry';
import { useMemo } from 'react';
import { DateRange } from 'react-day-picker';

const outfit = Outfit({ subsets: ['latin'] });

interface SleepStatsProps {
  entries: DayEntry[];
  dateRange: DateRange;
}

export function SleepStats({ entries, dateRange }: SleepStatsProps) {
  const calculateStats = (entries: DayEntry[], dateRange: DateRange) => {
    if (!Array.isArray(entries)) return null;

    const filteredEntries = entries.filter((entry) => {
      const entryDate = new Date(entry.date);
      if (!dateRange.from || !dateRange.to) return false;
      return entryDate >= dateRange.from && entryDate <= dateRange.to;
    });

    if (filteredEntries.length === 0) return null;

    const validEntries = filteredEntries.filter(
      (entry) => entry.totalSleepHours + entry.totalSleepMinutes / 60 > 0
    );

    if (validEntries.length === 0) return null;

    const totalSleep = validEntries.reduce(
      (acc, entry) =>
        acc + entry.totalSleepHours + entry.totalSleepMinutes / 60,
      0
    );
    const avgSleep = totalSleep / validEntries.length;

    const validSleepTimeEntries = validEntries.filter(
      (entry) => entry.sleepTime !== '00:00'
    );
    const validWakeTimeEntries = validEntries.filter(
      (entry) => entry.wakeTime !== '00:00'
    );

    const avgSleepTimeMinutes =
      validSleepTimeEntries.length > 0
        ? validSleepTimeEntries.reduce((acc, entry) => {
            const [hours, minutes] = entry.sleepTime.split(':').map(Number);
            const adjustedHours = hours < 12 ? hours + 24 : hours;
            return acc + adjustedHours * 60 + minutes;
          }, 0) / validSleepTimeEntries.length
        : 0;

    const avgSleepHours = Math.floor(avgSleepTimeMinutes / 60) % 24;
    const avgSleepMins = Math.round(avgSleepTimeMinutes % 60);

    const avgWakeTimeMinutes =
      validWakeTimeEntries.length > 0
        ? validWakeTimeEntries.reduce((acc, entry) => {
            const [hours, minutes] = entry.wakeTime.split(':').map(Number);
            return acc + hours * 60 + minutes;
          }, 0) / validWakeTimeEntries.length
        : 0;

    const avgWakeHours = Math.floor(avgWakeTimeMinutes / 60);
    const avgWakeMins = Math.round(avgWakeTimeMinutes % 60);

    const avgSleepDurationHours = Math.floor(avgSleep);
    const avgSleepDurationMins = Math.round(
      (avgSleep - avgSleepDurationHours) * 60
    );

    const avgDeepSleep =
      validEntries.reduce((acc, entry) => acc + entry.deepSleepPercentage, 0) /
      validEntries.length;

    const avgRemSleep =
      validEntries.reduce((acc, entry) => acc + entry.remSleepPercentage, 0) /
      validEntries.length;

    return {
      avgSleepDurationHours,
      avgSleepDurationMins,
      avgSleepTime: { hours: avgSleepHours, minutes: avgSleepMins },
      avgWakeTime: { hours: avgWakeHours, minutes: avgWakeMins },
      avgDeepSleep,
      avgRemSleep,
    };
  };

  const stats = useMemo(() => calculateStats(entries, dateRange), [entries, dateRange]);

  if (!stats) return null;

  return (
    <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
      <h3
        className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
      >
        Sleep Stats
      </h3>
      {(() => {
        return (
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stats.avgSleepDurationHours}h {stats.avgSleepDurationMins}m
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Average Sleep Duration
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {stats.avgSleepTime.hours.toString().padStart(2, '0')}:
                  {stats.avgSleepTime.minutes.toString().padStart(2, '0')}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Avg. Bedtime
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {stats.avgWakeTime.hours.toString().padStart(2, '0')}:
                  {stats.avgWakeTime.minutes.toString().padStart(2, '0')}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Avg. Wake Time
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {stats.avgDeepSleep.toFixed(1)}%
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Avg. Deep Sleep
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {stats.avgRemSleep.toFixed(1)}%
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Avg. REM Sleep
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
