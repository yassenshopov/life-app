import { useState, useEffect, useMemo } from 'react';
import { format, subDays, isWithinInterval } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  Area,
} from 'recharts';
import {
  FaArrowUp,
  FaArrowDown,
  FaBed,
  FaClock,
  FaRegMoon,
  FaRegSun,
  FaChevronDown,
  FaChevronRight,
} from 'react-icons/fa';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface DailyTrackingEntry {
  id: string;
  date: string;
  name?: string;
  awoke?: number;
  steps?: number;
  vitD?: boolean;
  awokeH?: number;
  awokeM?: number;
  output?: number;
  workout?: boolean;
  symptoms?: string[];
  rhr?: number;
  sleep?: number;
  tiredness?: number;
  vitD1?: string;
  habitsPie?: number;
  loggedData?: string;
  remSleepPercent?: number;
  sleepRange?: string;
  weight?: number;
  deepSleepPercent?: number;
  goneToSleepH?: number;
  goneToSleepM?: number;
  coffeeIntake?: string;
  goneToSleep?: number;
  improvements?: string;
  remSleep?: number;
  skinRoutines?: boolean;
  deepSleep?: number;
  awakeTime?: number;
  possibleCauses?: string;
  notDrinkAlcohol?: boolean;
  coffeeIntakeNumber?: number;
}

interface SummaryStats {
  avgSleep: number;
  avgRHR: number;
  avgSteps: number;
  avgWeight: number;
  avgHabitsPie: number;
  commonSymptoms: { [key: string]: number };
}

function getAverage(arr: (number | null | undefined)[]) {
  const filtered = arr.filter((v): v is number => v !== null && v !== undefined);
  return filtered.length ? filtered.reduce((a, b) => a + b, 0) / filtered.length : null;
}

function getTrend(current: number | null, prev: number | null) {
  if (current === null || prev === null) return null;
  const diff = current - prev;
  if (Math.abs(diff) < 0.01) return null;
  return diff > 0 ? 'up' : 'down';
}

function formatTimeFromHM(h: number | null | undefined, m: number | null | undefined) {
  if (h == null || m == null) return null;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function pearsonCorrelation(arrX: number[], arrY: number[]) {
  const n = arrX.length;
  if (n === 0) return 0;
  const meanX = arrX.reduce((a, b) => a + b, 0) / n;
  const meanY = arrY.reduce((a, b) => a + b, 0) / n;
  const numerator = arrX.reduce((acc, x, i) => acc + (x - meanX) * (arrY[i] - meanY), 0);
  const denominatorX = Math.sqrt(arrX.reduce((acc, x) => acc + Math.pow(x - meanX, 2), 0));
  const denominatorY = Math.sqrt(arrY.reduce((acc, y) => acc + Math.pow(y - meanY, 2), 0));
  const denom = denominatorX * denominatorY;
  return denom === 0 ? 0 : numerator / denom;
}

function interpretCorr(value: number) {
  const abs = Math.abs(value);
  if (abs < 0.2) return 'None';
  if (abs < 0.4) return 'Weak';
  if (abs < 0.6) return 'Moderate';
  if (abs < 0.8) return 'Strong';
  return 'Very Strong';
}

export function DailyTrackingSection() {
  const [entries, setEntries] = useState<DailyTrackingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number | null }>({
    loaded: 0,
    total: null,
  });
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 30),
    end: new Date(),
  });
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
    null
  );
  const [sectionOpen, setSectionOpen] = useState<{ [key: string]: boolean }>({
    trend: true,
    weekly: true,
    symptoms: true,
  });

  // Calculate 7-day and previous 7-day averages
  const last7 = entries.slice(0, 7);
  const prev7 = entries.slice(7, 14);

  const avgRemSleep = getAverage(last7.map((e) => e.remSleepPercent));
  const prevAvgRemSleep = getAverage(prev7.map((e) => e.remSleepPercent));
  const trendRemSleep = getTrend(avgRemSleep, prevAvgRemSleep);

  const avgDeepSleep = getAverage(last7.map((e) => e.deepSleepPercent));
  const prevAvgDeepSleep = getAverage(prev7.map((e) => e.deepSleepPercent));
  const trendDeepSleep = getTrend(avgDeepSleep, prevAvgDeepSleep);

  const avgAwakeTime = getAverage(last7.map((e) => (e.awakeTime ? e.awakeTime / 60 : null)));
  const prevAvgAwakeTime = getAverage(prev7.map((e) => (e.awakeTime ? e.awakeTime / 60 : null)));
  const trendAwakeTime = getTrend(avgAwakeTime, prevAvgAwakeTime);

  // For time, use average in minutes, then convert to HH:MM
  function avgTimeHM(arr: { h: number | null | undefined; m: number | null | undefined }[]) {
    const times = arr.filter((e) => e.h != null && e.m != null).map((e) => e.h! * 60 + e.m!);
    if (!times.length) return null;
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const h = Math.floor(avg / 60);
    const m = avg % 60;
    return { h, m };
  }
  const avgBedtime = avgTimeHM(last7.map((e) => ({ h: e.goneToSleepH, m: e.goneToSleepM })));
  const prevAvgBedtime = avgTimeHM(prev7.map((e) => ({ h: e.goneToSleepH, m: e.goneToSleepM })));
  const trendBedtime =
    avgBedtime && prevAvgBedtime
      ? getTrend(avgBedtime.h * 60 + avgBedtime.m, prevAvgBedtime.h * 60 + prevAvgBedtime.m)
      : null;

  const avgWakeTime = avgTimeHM(last7.map((e) => ({ h: e.awokeH, m: e.awokeM })));
  const prevAvgWakeTime = avgTimeHM(prev7.map((e) => ({ h: e.awokeH, m: e.awokeM })));
  const trendWakeTime =
    avgWakeTime && prevAvgWakeTime
      ? getTrend(avgWakeTime.h * 60 + avgWakeTime.m, prevAvgWakeTime.h * 60 + prevAvgWakeTime.m)
      : null;

  const sleepRhrCorrelation = (() => {
    const xs: number[] = [];
    const ys: number[] = [];
    entries.forEach((e) => {
      if (e.sleep != null && e.rhr != null) {
        xs.push(e.sleep);
        ys.push(e.rhr);
      }
    });
    return pearsonCorrelation(xs, ys);
  })();
  const stepsSleepCorrelation = (() => {
    const xs: number[] = [];
    const ys: number[] = [];
    entries.forEach((e) => {
      if (e.steps != null && e.sleep != null) {
        xs.push(e.steps);
        ys.push(e.sleep);
      }
    });
    return pearsonCorrelation(xs, ys);
  })();

  const sleepRhrCorrLabel = `r = ${sleepRhrCorrelation.toFixed(2)}, ${interpretCorr(
    sleepRhrCorrelation
  )}`;
  const stepsSleepCorrLabel = `r = ${stepsSleepCorrelation.toFixed(2)}, ${interpretCorr(
    stepsSleepCorrelation
  )}`;

  const sortedEntries = useMemo(() => {
    if (!sortConfig) return entries;
    const sorted = [...entries].sort((a, b) => {
      const aVal: any = (a as any)[sortConfig.key];
      const bVal: any = (b as any)[sortConfig.key];
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortConfig.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [entries, sortConfig]);
  const requestSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchAllEntries() {
      setLoading(true);
      setError(null);
      let allEntries: DailyTrackingEntry[] = [];
      let nextCursor: string | null = null;
      let page = 0;
      const pageSize = 50;
      try {
        do {
          const url: string = `/api/notion/daily-tracking${
            nextCursor ? `?start_cursor=${nextCursor}` : ''
          }`;
          const res: Response = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch');
          const data: {
            entries: DailyTrackingEntry[];
            next_cursor: string | null;
            has_more: boolean;
          } = await res.json();
          // Convert percent values if they are in fractional form
          const convertedEntries = (data.entries || []).map((e) => ({
            ...e,
            deepSleepPercent:
              e.deepSleepPercent != null && e.deepSleepPercent <= 1
                ? e.deepSleepPercent * 100
                : e.deepSleepPercent,
            remSleepPercent:
              e.remSleepPercent != null && e.remSleepPercent <= 1
                ? e.remSleepPercent * 100
                : e.remSleepPercent,
          }));
          allEntries = [...allEntries, ...convertedEntries];
          nextCursor = data.next_cursor;
          page++;
          if (isMounted) {
            setEntries([...allEntries]);
            setProgress({
              loaded: allEntries.length,
              total: data.has_more ? null : allEntries.length,
            });
          }
        } while (nextCursor);
        if (isMounted) setLoading(false);
      } catch (err: any) {
        if (isMounted) {
          setError('Failed to load data');
          setLoading(false);
        }
      }
    }
    fetchAllEntries();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (entries.length > 0) {
      const filteredEntries = entries.filter((entry) =>
        isWithinInterval(new Date(entry.date), { start: dateRange.start, end: dateRange.end })
      );

      const stats: SummaryStats = {
        avgSleep:
          filteredEntries.reduce((acc, curr) => acc + (curr.sleep || 0), 0) /
          filteredEntries.length,
        avgRHR:
          filteredEntries.reduce((acc, curr) => acc + (curr.rhr || 0), 0) / filteredEntries.length,
        avgSteps:
          filteredEntries.reduce((acc, curr) => acc + (curr.steps || 0), 0) /
          filteredEntries.length,
        avgWeight:
          filteredEntries.reduce((acc, curr) => acc + (curr.weight || 0), 0) /
          filteredEntries.length,
        avgHabitsPie:
          filteredEntries.reduce((acc, curr) => acc + (curr.habitsPie || 0), 0) /
          filteredEntries.length,
        commonSymptoms: filteredEntries.reduce((acc, curr) => {
          curr.symptoms?.forEach((symptom) => {
            acc[symptom] = (acc[symptom] || 0) + 1;
          });
          return acc;
        }, {} as { [key: string]: number }),
      };
      setSummaryStats(stats);
    }
  }, [entries, dateRange]);

  useEffect(() => {
    if (summaryStats) {
      const newInsights: string[] = [];
      if (summaryStats.avgSleep && summaryStats.avgSleep < 7) {
        newInsights.push('Average sleep is below 7 h — consider improving sleep duration.');
      }
      if (summaryStats.avgRHR && summaryStats.avgRHR > 60) {
        newInsights.push(
          'Resting heart rate is higher than optimal — monitor cardiovascular recovery.'
        );
      }
      if (summaryStats.avgSteps && summaryStats.avgSteps < 8000) {
        newInsights.push('Average daily steps are below 8 000 — try to be more active.');
      }
      if (summaryStats.avgWeight && entries.length > 30) {
        const last30Weight = entries
          .slice(0, 30)
          .map((e) => e.weight)
          .filter(Boolean) as number[];
        const first30Weight = entries
          .slice(30, 60)
          .map((e) => e.weight)
          .filter(Boolean) as number[];
        if (last30Weight.length && first30Weight.length) {
          const diff =
            last30Weight.reduce((a, b) => a + b, 0) / last30Weight.length -
            first30Weight.reduce((a, b) => a + b, 0) / first30Weight.length;
          if (Math.abs(diff) > 1) {
            newInsights.push(
              `Weight has ${diff > 0 ? 'increased' : 'decreased'} by ${
                diff > 0 ? '+' : ''
              }${diff.toFixed(1)} kg over the last month.`
            );
          }
        }
      }
      setInsights(newInsights);
    }
  }, [summaryStats, entries]);

  const handleDateRangeChange = (days: number) => {
    setDateRange({
      start: subDays(new Date(), days),
      end: new Date(),
    });
  };

  const toggleSection = (key: string) => setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4 flex items-center justify-between">
            Daily Tracking
            <div className="space-x-2">
              {[7, 30, 90, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDateRangeChange(d)}
                  className={`px-3 py-1 rounded-md text-sm border transition-colors duration-150 ${
                    dateRange.start.getTime() === subDays(new Date(), d).getTime()
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {d === 365 ? '1Y' : `${d}D`}
                </button>
              ))}
            </div>
          </h3>

          {/* Sticky summary */}
          <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md pb-4 mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 dark:text-slate-400">Avg Sleep</span>
                <span className="text-lg font-semibold text-blue-600 dark:text-blue-300">
                  {summaryStats?.avgSleep.toFixed(1) ?? '-'}h
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 dark:text-slate-400">Avg RHR</span>
                <span className="text-lg font-semibold text-red-600 dark:text-red-300">
                  {summaryStats?.avgRHR.toFixed(0) ?? '-'} bpm
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500 dark:text-slate-400">Avg Steps</span>
                <span className="text-lg font-semibold text-green-600 dark:text-green-300">
                  {summaryStats ? summaryStats.avgSteps.toLocaleString() : '-'}
                </span>
              </div>
              <div className="hidden sm:flex flex-col items-center">
                <span className="text-xs text-gray-500 dark:text-slate-400">Avg Weight</span>
                <span className="text-lg font-semibold text-purple-600 dark:text-purple-300">
                  {summaryStats ? summaryStats.avgWeight.toFixed(1) : '-'} kg
                </span>
              </div>
            </div>
          </div>

          {loading && (
            <div className="mt-6 flex flex-col items-center">
              <div className="w-full max-w-md">
                <div className="h-2 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-purple-500 transition-all duration-300"
                    style={{
                      width: progress.total
                        ? `${(progress.loaded / progress.total) * 100}%`
                        : '100%',
                    }}
                  ></div>
                </div>
                <div className="text-center mt-2 text-sm text-gray-700 dark:text-gray-300">
                  Loaded {progress.loaded} entr{progress.loaded === 1 ? 'y' : 'ies'}...
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-64 text-red-500">
              <p>{error}</p>
            </div>
          )}
          {!loading && !error && summaryStats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-100 dark:bg-blue-900/40 px-5 py-4 rounded-2xl">
                  <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Sleep</h4>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {entries[0]?.sleep?.toFixed(1) ?? '-'}h
                  </p>
                  {entries[0]?.deepSleepPercent && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      Deep: {entries[0].deepSleepPercent.toFixed(0)}%
                    </p>
                  )}
                </div>
                <div className="bg-red-100 dark:bg-red-900/40 px-5 py-4 rounded-2xl">
                  <h4 className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">RHR</h4>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {entries[0]?.rhr ?? '-'} bpm
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/40 px-5 py-4 rounded-2xl">
                  <h4 className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Steps</h4>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {entries[0]?.steps?.toLocaleString() ?? '-'}
                  </p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900/40 px-5 py-4 rounded-2xl">
                  <h4 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                    Weight
                  </h4>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {entries[0]?.weight?.toFixed(1) ?? '-'} kg
                  </p>
                </div>
              </div>

              <div className="h-80 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...entries].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => format(new Date(date), 'MMM d')}
                    />
                    <YAxis
                      yAxisId="left"
                      domain={[0, 'dataMax + 1']}
                      tickFormatter={(value) =>
                        typeof value === 'number' ? `${value}h` : `${value}`
                      }
                    />
                    <YAxis
                      yAxisId="rhr"
                      orientation="right"
                      domain={['dataMin - 5', 'dataMax + 5']}
                      tickFormatter={(value) =>
                        typeof value === 'number' ? `${value}bpm` : `${value}`
                      }
                    />
                    <YAxis
                      yAxisId="deep"
                      orientation="right"
                      domain={[0, 100]}
                      axisLine={false}
                      tick={false}
                    />
                    <Tooltip
                      labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                      formatter={(value: number, name: string) => {
                        if (name === 'Deep Sleep %') return [`${value.toFixed(0)}%`, name];
                        if (name === 'Sleep (h)') return [value.toFixed(1), name];
                        if (name === 'RHR (bpm)') return [value.toFixed(0), name];
                        return [value, name];
                      }}
                    />
                    <defs>
                      <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="rhrGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="deepSleepGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="sleep"
                      stroke="none"
                      fill="url(#sleepGradient)"
                      fillOpacity={1}
                    />
                    <Area
                      yAxisId="rhr"
                      type="monotone"
                      dataKey="rhr"
                      stroke="none"
                      fill="url(#rhrGradient)"
                      fillOpacity={1}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="sleep"
                      stroke="#3b82f6"
                      name="Sleep (h)"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      yAxisId="rhr"
                      type="monotone"
                      dataKey="rhr"
                      stroke="#ef4444"
                      name="RHR (bpm)"
                      strokeWidth={3}
                      dot={false}
                    />
                    <Line
                      yAxisId="deep"
                      type="monotone"
                      dataKey="deepSleepPercent"
                      stroke="#1d4ed8"
                      name="Deep Sleep %"
                      strokeWidth={3}
                      dot={false}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...entries].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => format(new Date(date), 'MMM d')}
                      />
                      <YAxis
                        domain={[0, 'dataMax + 1000']}
                        tickFormatter={(value) =>
                          typeof value === 'number' ? `${(value / 1000).toFixed(0)}k` : `${value}k`
                        }
                      />
                      <Tooltip
                        labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                        formatter={(value: number) => [value.toLocaleString(), 'Steps']}
                      />
                      <Bar dataKey="steps" fill="#22c55e" name="Steps" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...entries].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(date) => format(new Date(date), 'MMM d')}
                      />
                      <YAxis
                        domain={['dataMin - 0.5', 'dataMax + 0.5']}
                        tickFormatter={(value) =>
                          typeof value === 'number' ? `${value}kg` : `${value}`
                        }
                      />
                      <Tooltip
                        labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                        formatter={(value: number) => [value.toFixed(1), 'Weight (kg)']}
                      />
                      <defs>
                        <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#9333ea" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#9333ea" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="weight"
                        stroke="none"
                        fill="url(#weightGradient)"
                        fillOpacity={1}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#9333ea"
                        name="Weight"
                        strokeWidth={3}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-lg font-medium mb-4">Sleep Quality Metrics</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                  {/* REM Sleep % */}
                  <div className="bg-indigo-900/60 p-4 rounded-lg flex flex-col justify-between relative">
                    <span className="flex items-center gap-2 text-indigo-300 text-sm font-medium">
                      <FaRegMoon /> REM Sleep
                      <span data-tooltip-id="rem-tooltip" className="ml-1 cursor-pointer">
                        ℹ️
                      </span>
                      <ReactTooltip
                        id="rem-tooltip"
                        place="top"
                        content="7-day average REM Sleep %"
                      />
                    </span>
                    <div className="flex items-center mt-2">
                      <span className="text-2xl font-bold text-indigo-100">
                        {avgRemSleep !== null ? `${avgRemSleep.toFixed(0)}%` : '-'}
                      </span>
                      {trendRemSleep && (
                        <span
                          className={`ml-2 ${
                            trendRemSleep === 'up' ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {trendRemSleep === 'up' ? <FaArrowUp /> : <FaArrowDown />}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Deep Sleep % */}
                  <div className="bg-blue-900/60 p-4 rounded-lg flex flex-col items-center justify-between relative">
                    <span className="flex items-center gap-2 text-blue-300 text-sm font-medium">
                      <FaBed /> Deep Sleep
                      <span data-tooltip-id="deep-tooltip" className="ml-1 cursor-pointer">
                        ℹ️
                      </span>
                      <ReactTooltip
                        id="deep-tooltip"
                        place="top"
                        content="7-day average Deep Sleep %"
                      />
                    </span>
                    <div className="w-16 h-16 mt-2 mb-2">
                      <CircularProgressbar
                        value={avgDeepSleep ?? 0}
                        text={avgDeepSleep !== null ? `${avgDeepSleep.toFixed(0)}%` : '-'}
                        styles={buildStyles({
                          textColor: '#fff',
                          pathColor: '#3b82f6',
                          trailColor: '#1e293b',
                        })}
                      />
                    </div>
                    {trendDeepSleep && (
                      <span
                        className={`mt-2 ${
                          trendDeepSleep === 'up' ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {trendDeepSleep === 'up' ? <FaArrowUp /> : <FaArrowDown />}
                      </span>
                    )}
                  </div>
                  {/* Awake Time */}
                  <div className="bg-cyan-900/60 p-4 rounded-lg flex flex-col justify-between relative">
                    <span className="flex items-center gap-2 text-cyan-300 text-sm font-medium">
                      <FaClock /> Awake Time
                      <span data-tooltip-id="awake-tooltip" className="ml-1 cursor-pointer">
                        ℹ️
                      </span>
                      <ReactTooltip
                        id="awake-tooltip"
                        place="top"
                        content="7-day average Awake Time (hours)"
                      />
                    </span>
                    <div className="flex items-center mt-2">
                      <span className="text-2xl font-bold text-cyan-100">
                        {avgAwakeTime !== null ? `${avgAwakeTime.toFixed(1)}h` : '-'}
                      </span>
                      {trendAwakeTime && (
                        <span
                          className={`ml-2 ${
                            trendAwakeTime === 'up' ? 'text-red-400' : 'text-green-400'
                          }`}
                        >
                          {trendAwakeTime === 'up' ? <FaArrowUp /> : <FaArrowDown />}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-lg font-medium mb-4">Sleep Schedule Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Bedtime */}
                  <div className="bg-violet-900/60 p-4 rounded-lg flex flex-col justify-between relative">
                    <span className="flex items-center gap-2 text-violet-300 text-sm font-medium">
                      <FaRegMoon /> Average Bedtime
                      <span data-tooltip-id="bedtime-tooltip" className="ml-1 cursor-pointer">
                        ℹ️
                      </span>
                      <ReactTooltip
                        id="bedtime-tooltip"
                        place="top"
                        content="7-day average bedtime"
                      />
                    </span>
                    <div className="flex items-center mt-2">
                      <span className="text-2xl font-bold text-violet-100">
                        {avgBedtime
                          ? `${avgBedtime.h.toString().padStart(2, '0')}:${avgBedtime.m
                              .toString()
                              .padStart(2, '0')}`
                          : '-'}
                      </span>
                      {trendBedtime && (
                        <span
                          className={`ml-2 ${
                            trendBedtime === 'up' ? 'text-red-400' : 'text-green-400'
                          }`}
                        >
                          {trendBedtime === 'up' ? <FaArrowUp /> : <FaArrowDown />}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Wake Time */}
                  <div className="bg-violet-900/60 p-4 rounded-lg flex flex-col justify-between relative">
                    <span className="flex items-center gap-2 text-violet-300 text-sm font-medium">
                      <FaRegSun /> Average Wake Time
                      <span data-tooltip-id="waketime-tooltip" className="ml-1 cursor-pointer">
                        ℹ️
                      </span>
                      <ReactTooltip
                        id="waketime-tooltip"
                        place="top"
                        content="7-day average wake time"
                      />
                    </span>
                    <div className="flex items-center mt-2">
                      <span className="text-2xl font-bold text-violet-100">
                        {avgWakeTime
                          ? `${avgWakeTime.h.toString().padStart(2, '0')}:${avgWakeTime.m
                              .toString()
                              .padStart(2, '0')}`
                          : '-'}
                      </span>
                      {trendWakeTime && (
                        <span
                          className={`ml-2 ${
                            trendWakeTime === 'up' ? 'text-red-400' : 'text-green-400'
                          }`}
                        >
                          {trendWakeTime === 'up' ? <FaArrowUp /> : <FaArrowDown />}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-lg font-medium mb-4">Lifestyle Metrics</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {entries[0]?.coffeeIntakeNumber !== undefined && (
                    <div className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-amber-700 dark:text-amber-300">
                        Coffee Intake
                      </h4>
                      <p className="text-xl font-bold text-amber-900 dark:text-amber-100">
                        {entries[0].coffeeIntakeNumber} cups
                      </p>
                    </div>
                  )}
                  {entries[0]?.workout !== undefined && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        Workout
                      </h4>
                      <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                        {entries[0].workout ? 'Yes' : 'No'}
                      </p>
                    </div>
                  )}
                  {entries[0]?.vitD !== undefined && (
                    <div className="bg-sky-50 dark:bg-sky-900/30 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-sky-700 dark:text-sky-300">
                        Vitamin D
                      </h4>
                      <p className="text-xl font-bold text-sky-900 dark:text-sky-100">
                        {entries[0].vitD ? 'Taken' : 'Not Taken'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Trend Analysis */}
              <div className="mt-6">
                <button
                  onClick={() => toggleSection('trend')}
                  className="w-full flex items-center justify-between text-lg font-medium mb-4 focus:outline-none"
                >
                  <span>Trend Analysis</span>
                  {sectionOpen.trend ? <FaChevronDown /> : <FaChevronRight />}
                </button>
                {sectionOpen.trend && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Sleep vs RHR ({sleepRhrCorrLabel})
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart data={entries}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="sleep"
                              name="Sleep (h)"
                              unit="h"
                              domain={[4, 'dataMax + 1']}
                              tickFormatter={(v) =>
                                typeof v === 'number' ? `${v.toFixed(1)}h` : `${v}h`
                              }
                            />
                            <YAxis
                              dataKey="rhr"
                              name="RHR"
                              unit="bpm"
                              domain={['dataMin - 5', 'dataMax + 5']}
                              tickFormatter={(v) => (typeof v === 'number' ? `${v}bpm` : `${v}`)}
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                value.toFixed(1),
                                name === 'sleep' ? 'Sleep (h)' : 'RHR (bpm)',
                              ]}
                            />
                            <Scatter name="Sleep vs RHR" fill="#3b82f6" />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Steps vs Sleep ({stepsSleepCorrLabel})
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart data={entries}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="steps"
                              name="Steps"
                              unit=""
                              domain={[0, 'dataMax + 1000']}
                              tickFormatter={(value) =>
                                typeof value === 'number'
                                  ? `${Math.round(value / 1000)}k`
                                  : `${value}k`
                              }
                            />
                            <YAxis
                              dataKey="sleep"
                              name="Sleep"
                              unit="h"
                              domain={[4, 'dataMax + 1']}
                              tickFormatter={(v) =>
                                typeof v === 'number' ? `${v.toFixed(1)}h` : `${v}h`
                              }
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                name === 'steps' ? value.toLocaleString() : value.toFixed(1),
                                name === 'steps' ? 'Steps' : 'Sleep (h)',
                              ]}
                            />
                            <Scatter name="Steps vs Sleep" fill="#22c55e" />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => toggleSection('weekly')}
                  className="w-full flex items-center justify-between text-lg font-medium mb-4 focus:outline-none"
                >
                  <span>Weekly Averages</span>
                  {sectionOpen.weekly ? <FaChevronDown /> : <FaChevronRight />}
                </button>
                {sectionOpen.weekly && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Sleep by Day of Week
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={Object.values(
                              entries.reduce((acc, entry) => {
                                const day = format(new Date(entry.date), 'EEEE');
                                if (!acc[day]) {
                                  acc[day] = { day, total: 0, count: 0 };
                                }
                                if (entry.sleep) {
                                  acc[day].total += entry.sleep;
                                  acc[day].count += 1;
                                }
                                return acc;
                              }, {} as { [key: string]: { day: string; total: number; count: number } })
                            ).map((item) => ({
                              day: item.day,
                              total: item.total / item.count,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" />
                            <YAxis
                              domain={[0, 'dataMax + 1']}
                              tickFormatter={(value) =>
                                typeof value === 'number' ? `${value}h` : `${value}`
                              }
                            />
                            <Tooltip formatter={(value: number) => [value.toFixed(1), 'Hours']} />
                            <Bar dataKey="total" fill="#3b82f6" name="Average Sleep" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Steps by Day of Week
                      </h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={Object.values(
                              entries.reduce((acc, entry) => {
                                const day = format(new Date(entry.date), 'EEEE');
                                if (!acc[day]) {
                                  acc[day] = { day, total: 0, count: 0 };
                                }
                                if (entry.steps) {
                                  acc[day].total += entry.steps;
                                  acc[day].count += 1;
                                }
                                return acc;
                              }, {} as { [key: string]: { day: string; total: number; count: number } })
                            ).map((item) => ({
                              day: item.day,
                              total: item.total / item.count,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" />
                            <YAxis
                              domain={[0, 'dataMax + 1000']}
                              tickFormatter={(value) =>
                                typeof value === 'number'
                                  ? `${(value / 1000).toFixed(0)}k`
                                  : `${value}k`
                              }
                            />
                            <Tooltip
                              formatter={(value: number) => [value.toLocaleString(), 'Steps']}
                            />
                            <Bar dataKey="total" fill="#22c55e" name="Average Steps" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => toggleSection('symptoms')}
                  className="w-full flex items-center justify-between text-lg font-medium mb-4 focus:outline-none"
                >
                  <span>Common Symptoms</span>
                  {sectionOpen.symptoms ? <FaChevronDown /> : <FaChevronRight />}
                </button>
                {sectionOpen.symptoms && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summaryStats.commonSymptoms)
                      .sort(([, a], [, b]) => b - a)
                      .map(([symptom, count]) => (
                        <span
                          key={symptom}
                          className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm"
                        >
                          {symptom} ({count})
                        </span>
                      ))}
                  </div>
                )}
              </div>

              {insights.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-lg font-medium mb-4">Automated Insights</h4>
                  <ul className="list-disc pl-6 space-y-2 text-slate-700 dark:text-slate-300">
                    {insights.map((ins, idx) => (
                      <li key={idx}>{ins}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-sm bg-white dark:bg-slate-900 rounded-md border border-gray-200 dark:border-gray-700">
                  <thead className="bg-gray-100 dark:bg-slate-800 sticky top-0 z-10">
                    <tr>
                      {[
                        { key: 'date', label: 'Date' },
                        { key: 'sleep', label: 'Sleep' },
                        { key: 'rhr', label: 'RHR' },
                        { key: 'steps', label: 'Steps' },
                        { key: 'weight', label: 'Weight' },
                        { key: 'habitsPie', label: 'Habits' },
                        { key: 'symptoms', label: 'Symptoms' },
                      ].map((col) => (
                        <th
                          key={col.key}
                          className="px-4 py-2 font-medium text-left cursor-pointer select-none text-gray-600 dark:text-gray-300 whitespace-nowrap"
                          onClick={() => requestSort(col.key)}
                        >
                          {col.label}
                          {sortConfig?.key === col.key && (
                            <span className="ml-1">
                              {sortConfig.direction === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((entry, idx) => (
                      <tr
                        key={entry.id}
                        className={
                          idx % 2 === 0
                            ? 'border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-800'
                            : 'border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-slate-800/30 hover:bg-gray-100 dark:hover:bg-slate-800'
                        }
                      >
                        <td className="px-4 py-2 whitespace-nowrap">
                          {entry.date ? format(new Date(entry.date), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {entry.sleep?.toFixed(1) ?? '-'}h
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">{entry.rhr ?? '-'} bpm</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {entry.steps?.toLocaleString() ?? '-'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {entry.weight?.toFixed(1) ?? '-'} kg
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {entry.habitsPie !== undefined
                            ? (entry.habitsPie * 100).toFixed(0) + '%'
                            : '-'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap max-w-xs truncate">
                          {entry.symptoms?.join(', ') || 'None'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
