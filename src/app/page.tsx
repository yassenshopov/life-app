'use client';

import { useEffect, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  LineChart,
  AreaChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Inter, Outfit } from 'next/font/google';
import { Pencil, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const inter = Inter({ subsets: ['latin'] });
const outfit = Outfit({ subsets: ['latin'] });

interface SleepEntry {
  id: string;
  date: string;
  sleepTime: string;
  wakeTime: string;
  totalSleepHours: number;
  totalSleepMinutes: number;
  deepSleepPercentage: number;
  remSleepPercentage: number;
  awakeTimeMinutes: number;
  restingHeartRate: number | null;
}

interface SleepAnalysis {
  quality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  qualityScore: number;
  insights: Array<{
    text: string;
    metric?: { value: number; min: number; max: number; unit: string };
  }>;
  recommendations: string[];
}

export default function Home() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [sleepTime, setSleepTime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [dateRange, setDateRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
  });
  const [deepSleep, setDeepSleep] = useState('');
  const [remSleep, setRemSleep] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [awakeTime, setAwakeTime] = useState('');
  const [restingHeartRate, setRestingHeartRate] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>("30");

  useEffect(() => {
    const fetchEntries = async () => {
      setIsLoadingCharts(true);
      try {
        const response = await fetch(
          `/api/notion/entries?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`
        );
        const data = await response.json();
        setEntries(data);
      } catch (error) {
        console.error('Failed to fetch entries:', error);
      } finally {
        setLoading(false);
        setIsLoadingCharts(false);
      }
    };

    fetchEntries();
  }, [dateRange]);

  const hasEntryForToday = entries.some((entry) => {
    const today = new Date().toISOString().split('T')[0];
    return entry.date === today;
  });

  const renderManualEntryForm = () => {
    const [showUpdateForm, setShowUpdateForm] = useState(false);
    const todayEntry = entries.find(
      (entry) => entry.date === new Date().toISOString().split('T')[0]
    );

    return (
      <div className="mb-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
        {todayEntry ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                <svg
                  className="w-5 h-5 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-slate-600 dark:text-slate-400">
                  Today's sleep data has been recorded:{' '}
                  {todayEntry.totalSleepHours}h {todayEntry.totalSleepMinutes}m
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpdateForm(!showUpdateForm)}
              >
                {showUpdateForm ? (
                  <>
                    <X className="w-4 h-4 inline-block mr-1" />
                    Cancel edit
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4 inline-block mr-1" />
                    Edit entry
                  </>
                )}
              </Button>
            </div>

            {showUpdateForm && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
                  Update Today's Sleep
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400">
                      Sleep Time
                    </label>
                    <input
                      type="time"
                      value={sleepTime}
                      onChange={(e) => setSleepTime(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400">
                      Wake Time
                    </label>
                    <input
                      type="time"
                      value={wakeTime}
                      onChange={(e) => setWakeTime(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400">
                      Deep Sleep %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={deepSleep}
                      onChange={(e) => setDeepSleep(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400">
                      REM Sleep %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={remSleep}
                      onChange={(e) => setRemSleep(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400">
                      Awake Time (minutes)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={awakeTime}
                      onChange={(e) => setAwakeTime(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400">
                      Resting Heart Rate (bpm)
                    </label>
                    <input
                      type="number"
                      min="30"
                      max="200"
                      value={restingHeartRate}
                      onChange={(e) => setRestingHeartRate(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
              Record Today's Sleep
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Sleep Time
                </label>
                <input
                  type="time"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Wake Time
                </label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Deep Sleep %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={deepSleep}
                  onChange={(e) => setDeepSleep(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  REM Sleep %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={remSleep}
                  onChange={(e) => setRemSleep(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Awake Time (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  value={awakeTime}
                  onChange={(e) => setAwakeTime(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Resting Heart Rate (bpm)
                </label>
                <input
                  type="number"
                  min="30"
                  max="200"
                  value={restingHeartRate}
                  onChange={(e) => setRestingHeartRate(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                />
              </div>
            </div>
          </>
        )}

        {(!todayEntry || showUpdateForm) && (
          <div className="mt-4 flex items-center gap-4">
            <Button
              onClick={handleSubmit}
              disabled={
                !sleepTime ||
                !wakeTime ||
                !deepSleep ||
                !remSleep ||
                !awakeTime ||
                !restingHeartRate ||
                isSubmitting
              }
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </span>
              ) : (
                `${todayEntry ? 'Update' : 'Save'} Entry`
              )}
            </Button>
            {submitSuccess && (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Entry {todayEntry ? 'updated' : 'saved'} successfully!
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleSubmit = async () => {
    if (!sleepTime || !wakeTime || !deepSleep || !remSleep || !awakeTime || !restingHeartRate)
      return;

    setIsSubmitting(true);
    setSubmitSuccess(false);

    const [sleepHour, sleepMinute] = sleepTime.split(':');
    const [wakeHour, wakeMinute] = wakeTime.split(':');

    // Find today's entry
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = entries.find((entry) => entry.date === today);

    try {
      const response = await fetch('/api/notion/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: today,
          pageId: todayEntry?.id, // Include the page ID if entry exists
          GoneToSleepH: parseInt(sleepHour),
          GoneToSleepM: parseInt(sleepMinute),
          AwokeH: parseInt(wakeHour),
          AwokeM: parseInt(wakeMinute),
          deepSleepPercentage: parseInt(deepSleep),
          remSleepPercentage: parseInt(remSleep),
          awakeTimeMinutes: parseInt(awakeTime),
          restingHeartRate: restingHeartRate ? parseInt(restingHeartRate) : null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save entry');

      // Clear form and show success
      setSleepTime('');
      setWakeTime('');
      setDeepSleep('');
      setRemSleep('');
      setAwakeTime('');
      setRestingHeartRate('');
      setSubmitSuccess(true);

      // Refresh entries
      const updatedEntries = await fetch(
        `/api/notion/entries?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`
      ).then((res) => res.json());
      setEntries(updatedEntries);
    } catch (error) {
      console.error('Failed to save entry:', error);
    } finally {
      setIsSubmitting(false);
      // Hide success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
    }
  };

  const prepareChartData = () => {
    return entries
      .filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= dateRange.from && entryDate <= dateRange.to;
      })
      .reverse()
      .map((entry) => ({
        date: new Date(entry.date).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short'
        }).replace(/(\d+)/, (match) => {
          const day = parseInt(match);
          const suffix = ['th', 'st', 'nd', 'rd'][(day % 10 > 3 ? 0 : day % 10)] || 'th';
          return `${day}${suffix}`;
        }),
        totalSleep: Number(
          (entry.totalSleepHours + entry.totalSleepMinutes / 60).toFixed(2)
        ),
        deepSleep: entry.deepSleepPercentage,
        remSleep: entry.remSleepPercentage,
        awakeTime: entry.awakeTimeMinutes,
        restingHeartRate: entry.restingHeartRate,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const prepareSleepPatternData = () => {
    return entries
      .filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= dateRange.from && entryDate <= dateRange.to;
      })
      .map((entry) => {
        const [sleepHour, sleepMin] = entry.sleepTime.split(':').map(Number);
        const [wakeHour, wakeMin] = entry.wakeTime.split(':').map(Number);

        // Convert to decimal hours relative to 6PM (18:00)
        let sleepDecimal = sleepHour + sleepMin / 60;
        if (sleepDecimal >= 18) {
          sleepDecimal = sleepDecimal - 18; // Hours after 6PM
        } else {
          sleepDecimal = sleepDecimal + 6; // Hours after midnight + 6
        }

        let wakeDecimal = wakeHour + wakeMin / 60;
        if (wakeDecimal >= 18) {
          wakeDecimal = wakeDecimal - 18;
        } else {
          wakeDecimal = wakeDecimal + 6;
        }

        return {
          date: new Date(entry.date).toLocaleDateString(),
          fullDate: entry.date,
          sleepStart: sleepDecimal,
          sleepEnd: wakeDecimal,
          duration: (wakeDecimal - sleepDecimal + 24) % 24,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime()
      );
  };

  const SleepPatternChart = ({ data }: { data: any[] }) => {
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={data}
          margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            scale="point"
            padding={{ left: 20, right: 20 }}
            tick={{ dy: 10 }}
            interval="preserveStartEnd"
            minTickGap={30}
          />
          <YAxis
            domain={[16, 0]}
            ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16]}
            tickFormatter={(value) => {
              const hour = (value - 4) % 24;
              return hour.toString().padStart(2, '0') + ':00';
            }}
            label={{
              value: 'Time of Day (24H)',
              angle: -90,
              position: 'insideLeft',
            }}
            reversed={true}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                const formatTime = (decimal: number) => {
                  const hour = Math.floor((decimal + 18) % 24);
                  const minute = Math.floor((decimal % 1) * 60);
                  const period = hour >= 12 ? 'PM' : 'AM';
                  const displayHour = hour % 12 || 12;
                  return `${displayHour}:${minute
                    .toString()
                    .padStart(2, '0')} ${period}`;
                };

                const formatPercentage = (value: number) => {
                  const formatted = value.toFixed(1);
                  return formatted.endsWith('.0')
                    ? Math.floor(value) + '%'
                    : formatted + '%';
                };

                // Find the original entry data for additional stats
                const entry = entries.find((e) => e.date === data.fullDate);

                return (
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                    <p className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                      {data.date}
                    </p>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Sleep: {formatTime(data.sleepStart)}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Wake: {formatTime(data.sleepEnd)}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Duration: {data.duration.toFixed(1)}h
                      </p>
                      {entry && (
                        <>
                          <div className="my-2 border-t border-slate-200 dark:border-slate-700"></div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Deep Sleep:{' '}
                            {formatPercentage(entry.deepSleepPercentage)}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            REM Sleep:{' '}
                            {formatPercentage(entry.remSleepPercentage)}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Awake Time: {entry.awakeTimeMinutes}m
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Line
            type="step"
            dataKey="sleepStart"
            stroke="transparent"
            dot={false}
            activeDot={false}
          />
          {data.map((entry, index) => {
            const xPercent = 9 + index * 3.005;
            return (
              <line
                key={index}
                x1={`${xPercent}%`}
                x2={`${xPercent}%`}
                y1={entry.sleepStart * (400 / 24)}
                y2={entry.sleepEnd * (400 / 24)}
                strokeWidth="16"
                stroke="#a855f7"
                strokeOpacity={0.9}
                strokeLinecap="round"
                className="transition-opacity hover:opacity-100"
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const RHRChart = ({ data }: { data: any[] }) => {
    return (
      <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
        <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
          Resting Heart Rate
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ bottom: 50 }}>
            <defs>
              <linearGradient id="rhrGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
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
            <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{label}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        RHR: {payload[0].value} bpm
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine 
              y={data
                .filter(entry => entry.rhr && entry.rhr > 0)
                .reduce((acc, curr) => acc + curr.rhr, 0) / 
                data.filter(entry => entry.rhr && entry.rhr > 0).length}
              stroke="#ef4444"
              strokeOpacity={0.5}
              label={{ 
                value: 'Avg RHR',
                position: 'right',
                fill: '#ef4444',
                opacity: 0.5
              }}
            />
            <Area
              type="monotone"
              dataKey="rhr"
              stroke="#ef4444"
              fill="url(#rhrGradient)"
              name="RHR (bpm)"
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const RHRAnalytics = ({ data }: { data: any[] }) => {
    // Filter out null values
    const validData = data.filter(entry => entry.rhr !== null);
    
    if (validData.length === 0) {
      return (
        <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}>
            RHR Analytics
          </h3>
          <p className="text-slate-600 dark:text-slate-400">No RHR data available for this period.</p>
        </div>
      );
    }

    const average = Math.round(validData.reduce((acc, curr) => acc + curr.rhr, 0) / validData.length);
    const min = Math.min(...validData.map(d => d.rhr));
    const max = Math.max(...validData.map(d => d.rhr));
    
    // Calculate trend (comparing first and last valid readings)
    const firstReading = validData[validData.length - 1].rhr;
    const lastReading = validData[0].rhr;
    const trend = lastReading - firstReading;
    
    // Calculate variability (standard deviation)
    const meanSquaredDiff = validData.reduce((acc, curr) => 
      acc + Math.pow(curr.rhr - average, 2), 0) / validData.length;
    const standardDeviation = Math.round(Math.sqrt(meanSquaredDiff) * 10) / 10;

    return (
      <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
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
              <span className="text-sm text-slate-600 dark:text-slate-400">Period Trend</span>
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
              <span className="text-sm text-slate-600 dark:text-slate-400">Variability</span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                ±{standardDeviation} bpm
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleDateRangeFilter = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    setDateRange({ from, to });
  };

  const analyzeSleepData = (entry: SleepEntry): SleepAnalysis => {
    const insights: Array<{
      text: string;
      metric?: { value: number; min: number; max: number; unit: string };
    }> = [];
    const recommendations: string[] = [];
    let qualityScore = 100;

    // Calculate total sleep duration in hours
    const totalSleep = entry.totalSleepHours + entry.totalSleepMinutes / 60;

    // Analyze sleep duration (without progress bar)
    if (totalSleep < 7) {
      qualityScore -= 20;
      insights.push({
        text: `You slept ${totalSleep.toFixed(
          1
        )} hours, which is below the recommended 7-9 hours`,
      });
      recommendations.push(
        'Try to get to bed earlier to reach at least 7 hours of sleep'
      );
    } else if (totalSleep > 9) {
      qualityScore -= 10;
      insights.push({
        text: `You slept ${totalSleep.toFixed(
          1
        )} hours, which is above the recommended range`,
      });
      recommendations.push(
        'Consider adjusting your sleep schedule to avoid oversleeping'
      );
    } else {
      insights.push({
        text: `Your sleep duration of ${totalSleep.toFixed(
          1
        )} hours is within the ideal range`,
      });
    }

    // Add Light sleep analysis (before Deep sleep)
    const lightSleepPercentage =
      100 - entry.deepSleepPercentage - entry.remSleepPercentage;
    insights.push({
      text: `Light sleep`,
      metric: { value: lightSleepPercentage, min: 20, max: 60, unit: '%' },
    });

    // Analyze deep sleep
    insights.push({
      text: `Deep sleep`,
      metric: { value: entry.deepSleepPercentage, min: 20, max: 40, unit: '%' },
    });

    // Analyze REM sleep
    insights.push({
      text: `REM sleep`,
      metric: { value: entry.remSleepPercentage, min: 10, max: 30, unit: '%' },
    });

    // Enhanced awake time analysis
    if (entry.awakeTimeMinutes > 0) {
      if (entry.awakeTimeMinutes > 60) {
        qualityScore -= 25;
        insights.push({
          text: `Significant sleep disruption: ${entry.awakeTimeMinutes} minutes spent awake`,
          metric: { value: entry.awakeTimeMinutes, min: 0, max: 60, unit: 'm' },
        });
        recommendations.push(
          'Consider checking for environmental disturbances (noise, light, temperature)'
        );
        recommendations.push(
          'Evaluate if stress or anxiety might be affecting your sleep'
        );
      } else if (entry.awakeTimeMinutes > 30) {
        qualityScore -= 15;
        insights.push({
          text: `Moderate sleep disruption: ${entry.awakeTimeMinutes} minutes spent awake`,
          metric: { value: entry.awakeTimeMinutes, min: 0, max: 60, unit: 'm' },
        });
        recommendations.push(
          'Try to minimize evening screen time and create a more sleep-friendly environment'
        );
      } else {
        qualityScore -= 5;
        insights.push({
          text: `Minor sleep disruption: ${entry.awakeTimeMinutes} minutes spent awake`,
          metric: { value: entry.awakeTimeMinutes, min: 0, max: 60, unit: 'm' },
        });
        recommendations.push(
          'Consider your evening routine to minimize sleep disruptions'
        );
      }
    }

    // Determine quality label
    let quality: SleepAnalysis['quality'] = 'Poor';
    if (qualityScore >= 90) quality = 'Excellent';
    else if (qualityScore >= 75) quality = 'Good';
    else if (qualityScore >= 60) quality = 'Fair';

    return { quality, qualityScore, insights, recommendations };
  };

  const getHistoricalInsights = (
    todayEntry: SleepEntry,
    recentEntries: SleepEntry[]
  ) => {
    if (!todayEntry || recentEntries.length < 2) return [];

    const insights: string[] = [];
    const last7Days = recentEntries
      .filter((entry) => entry.date !== todayEntry.date)
      .slice(0, 7);

    // Calculate averages
    const avgSleepTime =
      last7Days.reduce(
        (sum, entry) =>
          sum + entry.totalSleepHours + entry.totalSleepMinutes / 60,
        0
      ) / last7Days.length;

    const avgDeepSleep =
      last7Days.reduce((sum, entry) => sum + entry.deepSleepPercentage, 0) /
      last7Days.length;

    const avgRemSleep =
      last7Days.reduce((sum, entry) => sum + entry.remSleepPercentage, 0) /
      last7Days.length;

    const todayTotalSleep =
      todayEntry.totalSleepHours + todayEntry.totalSleepMinutes / 60;

    // Compare with today
    if (Math.abs(todayTotalSleep - avgSleepTime) > 1) {
      const comparison = todayTotalSleep > avgSleepTime ? 'more' : 'less';
      insights.push(
        `You slept ${Math.abs(todayTotalSleep - avgSleepTime).toFixed(
          1
        )} hours ${comparison} than your 7-day average`
      );
    }

    if (Math.abs(todayEntry.deepSleepPercentage - avgDeepSleep) > 5) {
      const comparison =
        todayEntry.deepSleepPercentage > avgDeepSleep ? 'higher' : 'lower';
      insights.push(
        `Deep sleep was ${Math.abs(
          todayEntry.deepSleepPercentage - avgDeepSleep
        ).toFixed(1)}% ${comparison} than your recent average`
      );
    }

    if (Math.abs(todayEntry.remSleepPercentage - avgRemSleep) > 5) {
      const comparison =
        todayEntry.remSleepPercentage > avgRemSleep ? 'higher' : 'lower';
      insights.push(
        `REM sleep was ${Math.abs(
          todayEntry.remSleepPercentage - avgRemSleep
        ).toFixed(1)}% ${comparison} than your recent average`
      );
    }

    return insights;
  };

  const SleepAnalysisCard = ({ entry }: { entry: SleepEntry }) => {
    const analysis = analyzeSleepData(entry);
    const historicalInsights = getHistoricalInsights(entry, entries);

    const getProgressColor = (metricType: string) => {
      switch (metricType) {
        case 'deep':
          return 'bg-blue-700';
        case 'light':
          return 'bg-blue-500';
        case 'rem':
          return 'bg-teal-400';
        default:
          return 'bg-blue-500';
      }
    };

    const getProgressBarContent = (
      value: number,
      min: number,
      max: number,
      metricType: string
    ) => {
      return (
        <div className="h-6 w-96 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
          {/* Target range indicator (striped) */}
          <div
            className="absolute h-full bg-stripes"
            style={{
              left: `${min}%`,
              width: `${max - min}%`,
              background: `repeating-linear-gradient(
                45deg,
                rgba(255, 255, 255, 0.2),
                rgba(255, 255, 255, 0.2) 10px,
                rgba(255, 255, 255, 0.3) 10px,
                rgba(255, 255, 255, 0.3) 20px
              )`,
            }}
          />
          {/* Actual value bar */}
          <div
            className={`h-full transition-all ${getProgressColor(metricType)}`}
            style={{
              width: `${value}%`,
            }}
          />
        </div>
      );
    };

    return (
      <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Today's Sleep Analysis
          </h3>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              analysis.quality === 'Excellent'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : analysis.quality === 'Good'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                : analysis.quality === 'Fair'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {analysis.quality} ({analysis.qualityScore}%)
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
              Key Insights
            </h4>
            <ul className="space-y-4">
              {analysis.insights.map((insight, index) => (
                <li key={index} className="text-sm">
                  {insight.metric ? (
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {insight.text.split(':')[0]}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {insight.metric.value}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getProgressBarContent(
                          insight.metric.value,
                          insight.metric.min,
                          insight.metric.max,
                          insight.text.toLowerCase().includes('deep')
                            ? 'deep'
                            : insight.text.toLowerCase().includes('light')
                            ? 'light'
                            : insight.text.toLowerCase().includes('rem')
                            ? 'rem'
                            : 'default'
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {insight.metric.min}-{insight.metric.max}
                          {insight.metric.unit}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-600 dark:text-slate-400">
                      {insight.text}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {analysis.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                Recommendations
              </h4>
              <ul className="space-y-2">
                {analysis.recommendations.map((rec, index) => (
                  <li
                    key={index}
                    className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {historicalInsights.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                Compared to Last 7 Days
              </h4>
              <ul className="space-y-2">
                {historicalInsights.map((insight, index) => (
                  <li
                    key={index}
                    className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const formatPercentage = (value: number) => {
    const formatted = value.toFixed(1);
    return formatted.endsWith('.0') ? Math.floor(value) + '%' : formatted + '%';
  };

  const calculateStats = (entries: SleepEntry[]) => {
    if (entries.length === 0) return null;

    // Filter out entries with zero total sleep
    const validEntries = entries.filter(
      (entry) => entry.totalSleepHours + entry.totalSleepMinutes / 60 > 0
    );

    if (validEntries.length === 0) return null;

    const totalSleep = validEntries.reduce(
      (acc, entry) =>
        acc + entry.totalSleepHours + entry.totalSleepMinutes / 60,
      0
    );
    const avgSleep = totalSleep / validEntries.length;

    const avgDeepSleep =
      validEntries.reduce((acc, entry) => acc + entry.deepSleepPercentage, 0) /
      validEntries.length;

    const avgRemSleep =
      validEntries.reduce((acc, entry) => acc + entry.remSleepPercentage, 0) /
      validEntries.length;

    const avgAwakeTime =
      validEntries.reduce((acc, entry) => acc + entry.awakeTimeMinutes, 0) /
      validEntries.length;

    return {
      avgSleep,
      avgDeepSleep,
      avgRemSleep,
      avgAwakeTime,
      totalEntries: validEntries.length, // Now shows count of valid entries only
    };
  };

  const ChartLoadingOverlay = () => (
    <div className="absolute inset-0 top-[52px] flex items-center justify-center">
      {/* Semi-opaque background */}
      <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80" />
      {/* Loading spinner and text */}
      <div className="flex flex-col items-center gap-2 z-10">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-600 dark:text-slate-400">Loading data...</span>
      </div>
    </div>
  );

  return (
    <div
      className={`min-h-screen p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 ${inter.className}`}
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <main className="max-w-7xl mx-auto pt-12">
        <h1
          className={`text-3xl font-bold mb-8 text-center bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 text-transparent bg-clip-text ${outfit.className}`}
        >
          Sleep Tracker
        </h1>

        {renderManualEntryForm()}

        {entries.length > 0 &&
          entries[0].date === new Date().toISOString().split('T')[0] && (
            <div className="mb-8">
              <SleepAnalysisCard entry={entries[0]} />
            </div>
          )}

        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2
              className={`text-xl font-semibold text-slate-900 dark:text-slate-100 ${outfit.className}`}
            >
              Sleep History
            </h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <Tabs value={activeTab || ""} onValueChange={(value) => {
                setActiveTab(value);
                if (value === "3") handleDateRangeFilter(3);
                if (value === "7") handleDateRangeFilter(7);
                if (value === "30") handleDateRangeFilter(30);
                if (value === "90") handleDateRangeFilter(90);
                if (value === "365") {
                  // Set range to exactly 1 year back from today
                  const to = new Date();
                  const from = new Date();
                  from.setFullYear(from.getFullYear() - 1);
                  from.setDate(from.getDate() + 1); // Add one day to make it exactly 1 year
                  setDateRange({ from, to });
                }
                if (value === "year") {
                  // Set range from January 1st of current year to today
                  const to = new Date();
                  const from = new Date(to.getFullYear(), 0, 1); // January 1st of current year
                  setDateRange({ from, to });
                }
              }}>
                <TabsList>
                  <TabsTrigger value="3">3D</TabsTrigger>
                  <TabsTrigger value="7">7D</TabsTrigger>
                  <TabsTrigger value="30">30D</TabsTrigger>
                  <TabsTrigger value="90">90D</TabsTrigger>
                  <TabsTrigger value="365">1Y</TabsTrigger>
                  <TabsTrigger value="year">YTD</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex gap-2 items-center">
                <label htmlFor="from" className="text-sm text-slate-600 dark:text-slate-400">From:</label>
                <div className="flex flex-col">
                  <input
                    id="from"
                    type="date"
                    value={dateRange.from.toISOString().split('T')[0]}
                    onChange={(e) => {
                      setActiveTab(null);
                      setDateRange((prev) => ({
                        ...prev,
                        from: new Date(e.target.value),
                      }));
                    }}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2 cursor-pointer"
                  />
                </div>
                <label htmlFor="to" className="text-sm text-slate-600 dark:text-slate-400">To:</label>
                <div className="flex flex-col">
                  <input
                    id="to"
                    type="date"
                    value={dateRange.to.toISOString().split('T')[0]}
                    onChange={(e) => {
                      setActiveTab(null);
                      setDateRange((prev) => ({
                        ...prev,
                        to: new Date(e.target.value),
                      }));
                    }}
                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <p className="text-slate-600 dark:text-slate-400">
              Loading entries...
            </p>
          ) : entries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-white/50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
                <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 bg-white/50 dark:bg-slate-900/50 ${outfit.className}`}>
                  Sleep Duration Over Time
                </h3>
                <div className={`transition-opacity duration-200 ${isLoadingCharts ? 'opacity-50' : 'opacity-100'}`}>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={prepareChartData()} margin={{ bottom: 50, right: 20 }}>
                      <defs>
                        <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
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
                        minTickGap={-200}
                      />
                      <YAxis 
                        domain={[0, 'auto']}
                        allowDataOverflow={true}
                      />
                      <Tooltip />
                      <Legend />
                      <ReferenceLine 
                        y={prepareChartData()
                          .filter(entry => entry.totalSleep > 0)
                          .reduce((acc, curr) => acc + curr.totalSleep, 0) / 
                          prepareChartData().filter(entry => entry.totalSleep > 0).length}
                        stroke="#8884d8"
                        strokeOpacity={0.5}
                        label={{ 
                          value: 'Avg Sleep',
                          position: 'right',
                          fill: '#8884d8',
                          opacity: 0.5
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="totalSleep"
                        stroke="#8884d8"
                        fill="url(#sleepGradient)"
                        name="Total Sleep (hours)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {isLoadingCharts && <ChartLoadingOverlay />}
              </div>

              <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                <h3
                  className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
                >
                  Period Statistics
                </h3>
                {(() => {
                  const filteredEntries = entries.filter((entry) => {
                    const entryDate = new Date(entry.date);
                    return (
                      entryDate >= dateRange.from && entryDate <= dateRange.to
                    );
                  });
                  const stats = calculateStats(filteredEntries);

                  if (!stats)
                    return (
                      <p className="text-slate-600 dark:text-slate-400">
                        No data available
                      </p>
                    );

                  return (
                    <div className="space-y-4">
                      <div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                          {stats.avgSleep.toFixed(1)}h
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          Average Sleep Duration
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {stats.avgDeepSleep.toFixed(1)}%
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Avg Deep Sleep
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {stats.avgRemSleep.toFixed(1)}%
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Avg REM Sleep
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {stats.avgAwakeTime.toFixed(0)}m
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Avg Awake Time
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {stats.totalEntries}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Total Entries
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
                <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 bg-white/50 dark:bg-slate-900/50 ${outfit.className}`}>
                  Sleep Quality Metrics
                </h3>
                <div className={`transition-opacity duration-200 ${isLoadingCharts ? 'opacity-50' : 'opacity-100'}`}>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={prepareChartData()} margin={{ bottom: 50, right: 20 }}>
                      <defs>
                        <linearGradient id="deepSleepGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="remSleepGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="awakeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ffc658" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#ffc658" stopOpacity={0}/>
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
                        minTickGap={-200}
                      />
                      <YAxis 
                        domain={[0, 100]}
                        allowDataOverflow={true}
                      />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="deepSleep"
                        stroke="#1d4ed8"
                        fill="url(#deepSleepGradient)"
                        name="Deep Sleep %"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="remSleep"
                        stroke="#2dd4bf"
                        fill="url(#remSleepGradient)"
                        name="REM Sleep %"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="awakeTime"
                        stroke="#ffc658"
                        fill="url(#awakeGradient)"
                        name="Awake Time (min)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {isLoadingCharts && <ChartLoadingOverlay />}
              </div>

              <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
                <h3 className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 bg-white/50 dark:bg-slate-900/50 ${outfit.className}`}>
                  Sleep Patterns
                </h3>
                <div className={`transition-opacity duration-200 ${isLoadingCharts ? 'opacity-50' : 'opacity-100'}`}>
                  <SleepPatternChart data={prepareSleepPatternData()} />
                </div>
                {isLoadingCharts && <ChartLoadingOverlay />}
              </div>

              <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-3 relative">
                  <RHRChart
                    data={prepareChartData().map(entry => ({
                      date: entry.date,
                      rhr: entry.restingHeartRate,
                    }))}
                  />
                </div>
                <RHRAnalytics
                  data={prepareChartData().map(entry => ({
                    date: entry.date,
                    rhr: entry.restingHeartRate,
                  }))}
                />
              </div>

              <div className="lg:col-span-3">
                <div className="relative">
                  <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex gap-4 py-2 px-4">
                      {entries
                        .filter((entry) => {
                          const entryDate = new Date(entry.date);
                          return (
                            entryDate >= dateRange.from &&
                            entryDate <= dateRange.to
                          );
                        })
                        .sort(
                          (a, b) =>
                            new Date(b.date).getTime() -
                            new Date(a.date).getTime()
                        )
                        .slice(0, 7)
                        .map((entry) => (
                          <div
                            key={entry.id}
                            className="w-64 flex-shrink-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 transition-all hover:scale-105"
                          >
                            <div className="flex flex-col mb-4">
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(entry.date).toLocaleDateString(
                                  undefined,
                                  { weekday: 'long' }
                                )}
                              </div>
                              <div className="font-medium text-lg text-slate-900 dark:text-slate-100">
                                {new Date(entry.date).toLocaleDateString(
                                  undefined,
                                  {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  }
                                )}
                              </div>
                              <div className="text-sm mt-1 font-medium text-slate-600 dark:text-slate-400">
                                {entry.sleepTime} - {entry.wakeTime}
                              </div>
                            </div>
                            <div className="space-y-3 text-sm">
                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>Total Sleep</span>
                                <span className="font-medium">
                                  {entry.totalSleepHours}h{' '}
                                  {entry.totalSleepMinutes}m
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>Awake Time</span>
                                <span className="font-medium">
                                  {entry.awakeTimeMinutes}m
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>Deep Sleep</span>
                                <span className="font-medium">
                                  {formatPercentage(entry.deepSleepPercentage)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                                <span>REM Sleep</span>
                                <span className="font-medium">
                                  {formatPercentage(entry.remSleepPercentage)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-950 pointer-events-none" />
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950 pointer-events-none" />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-400">
              No entries found.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
