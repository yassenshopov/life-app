'use client';

import { useEffect, useState, useMemo } from 'react';
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
  ResponsiveContainer,
  ReferenceLine,
  Bar,
  ComposedChart,
} from 'recharts';
import { Inter, Outfit } from 'next/font/google';
import {
  Menu,
  Moon,
  Heart,
  Footprints,
  Weight,
  X,
  Pencil,
  CheckSquare,
  RefreshCw,
  Dumbbell,
  Plus,
  Calendar,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Dumbbell as DumbbellIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { addDays, format, isSameDay, startOfMonth } from 'date-fns';
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ChartLoadingOverlay } from '@/components/ChartLoadingOverlay';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { NavigationTabs } from '@/components/NavigationTabs';
import { SectionHeader } from '@/components/SectionHeader';
import { DisplaySection } from '@/types/display-section';
import { FloatingToc } from '@/components/FloatingToc';
import {
  EXERCISE_LIBRARY,
  GymSessionType,
  Exercise,
} from '@/constants/exercises';
import { MuscleGroup } from '@/constants/muscle-groups';
import { WorkoutEvent, WorkoutExercise, ExerciseStats } from '@/types/workout';
import { RHRChart, RHRAnalytics } from '@/components/RHRCharts';
import { Checkbox } from '@/components/ui/checkbox';
import { WeightChart, WeightAnalytics } from '@/components/WeightCharts';
import { StepsChart, StepsAnalytics } from '@/components/StepsCharts';
import { SleepAnalysisCard } from '@/components/SleepAnalysis';
import { SleepPatternChart } from '@/components/SleepPatternChart';
import { MuscleGroupAnalysis } from '@/components/MuscleGroupAnalysis';
import { WorkoutCalendar } from '@/components/WorkoutCalendar';
import { ExerciseAnalysis } from '@/components/ExerciseAnalysis';

const inter = Inter({ subsets: ['latin'] });
const outfit = Outfit({ subsets: ['latin'] });

interface DayEntry {
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
  steps: number | null;
  weight: number | null;
}

export default function Dashboard() {
  const [entries, setEntries] = useState<DayEntry[]>([]);
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
  const [activeTab, setActiveTab] = useState<string | null>('30D'); // Changed from '30'
  const [steps, setSteps] = useState('');
  const [weight, setWeight] = useState('');

  // Add initial loading state
  const [initialLoading, setInitialLoading] = useState(true);
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  // Add this state variable with other useState declarations
  const [activeSection, setActiveSection] = useState<DisplaySection>('all');

  // Add this state variable with other useState declarations
  const [showAwakeTime, setShowAwakeTime] = useState(true);

  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  // Add to your existing state declarations
  const [exerciseData, setExerciseData] = useState<any[]>([]);

  // Add this to your state declarations
  const [gymSessions, setGymSessions] = useState<any[]>([]);

  const [showGymForm, setShowGymForm] = useState(false);

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
        setInitialLoading(false); // Add this line
      }
    };

    fetchEntries();
  }, [dateRange]);

  // Add to your useEffect that fetches data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingCharts(true);
      try {
        // Fetch exercise data
        const exerciseResponse = await fetch(
          `/api/supabase/exercises?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`
        );
        const exerciseData = await exerciseResponse.json();
        console.log('Exercise data:', exerciseResponse);
        setExerciseData(exerciseData);

        // Fetch gym sessions
        const gymResponse = await fetch(
          `/api/supabase/exercises?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`
        );
        const gymData = await gymResponse.json();
        console.log('Gym sessions:', gymData); // Debug log
        setGymSessions(gymData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoadingCharts(false);
      }
    };

    fetchData();
  }, [dateRange]);

  // Add initial loading screen
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <LoadingSpinner size="lg" label="Loading your data..." />
      </div>
    );
  }

  const renderManualEntryForm = () => {
    const todayEntry = entries.find(
      (entry) => entry.date === new Date().toISOString().split('T')[0]
    );

    const hasMeaningfulSleepData =
      todayEntry &&
      (todayEntry.totalSleepHours > 0 || todayEntry.totalSleepMinutes > 0);

    const setFormValues = (entry: DayEntry | undefined) => {
      if (entry) {
        // Convert times to 24-hour format
        const convertTo24Hour = (time: string) => {
          const [hours, minutes] = time.split(':').map(Number);
          return `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}`;
        };

        setSleepTime(convertTo24Hour(entry.sleepTime));
        setWakeTime(convertTo24Hour(entry.wakeTime));
        setDeepSleep(Math.round(entry.deepSleepPercentage).toString());
        setRemSleep(Math.round(entry.remSleepPercentage).toString());
        setAwakeTime(Math.round(entry.awakeTimeMinutes).toString());
        setRestingHeartRate(entry.restingHeartRate?.toString() || '');
        setSteps(entry.steps?.toString() || '');
        setWeight(entry.weight?.toString() || '');
      }
    };

    const handleEditClick = () => {
      if (!showUpdateForm) {
        setFormValues(todayEntry);
      } else {
        setSleepTime('');
        setWakeTime('');
        setDeepSleep('');
        setRemSleep('');
        setAwakeTime('');
        setRestingHeartRate('');
        setSteps('');
        setWeight('');
      }
      setShowUpdateForm(!showUpdateForm);
    };

    return (
      <div className="mb-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
        {todayEntry && hasMeaningfulSleepData ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-wrap gap-3 flex-grow">
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md flex items-center gap-3">
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
                    Today&apos;s sleep data has been recorded:{' '}
                    {todayEntry.totalSleepHours}h {todayEntry.totalSleepMinutes}
                    m
                  </span>
                </div>
                {todayEntry.restingHeartRate ? (
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md flex items-center gap-3">
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
                      RHR recorded: {todayEntry.restingHeartRate} bpm
                    </span>
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-yellow-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span className="text-slate-600 dark:text-slate-400">
                      RHR not yet recorded
                    </span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditClick}
                className="whitespace-nowrap"
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
                      Sleep Time (24h)
                    </label>
                    <input
                      type="time"
                      value={sleepTime}
                      onChange={(e) => setSleepTime(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                      required
                      step="60"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400">
                      Wake Time (24h)
                    </label>
                    <input
                      type="time"
                      value={wakeTime}
                      onChange={(e) => setWakeTime(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                      required
                      step="60"
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
                      Resting Heart Rate (bpm) - Optional
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
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400">
                      Steps
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={steps}
                      onChange={(e) => setSteps(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400">
                      Weight (kg) - Optional
                    </label>
                    <input
                      type="number"
                      min="30"
                      max="200"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      !sleepTime ||
                      !wakeTime ||
                      !deepSleep ||
                      !remSleep ||
                      !awakeTime ||
                      isSubmitting
                    }
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <LoadingSpinner size="sm" />
                        Saving...
                      </span>
                    ) : (
                      'Update Sleep'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
              Record Today's Sleep
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Sleep Time (24h)
                </label>
                <input
                  type="time"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                  required
                  step="60"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Wake Time (24h)
                </label>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                  required
                  step="60"
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
                  Resting Heart Rate (bpm) - Optional
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
              <div className="space-y-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Steps
                </label>
                <input
                  type="number"
                  min="0"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-600 dark:text-slate-400">
                  Weight (kg) - Optional
                </label>
                <input
                  type="number"
                  min="30"
                  max="200"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                />
              </div>
            </div>
            {/* Add the button below the grid of inputs */}
            <div className="mt-6">
              <Button
                onClick={handleSubmit}
                disabled={
                  !sleepTime ||
                  !wakeTime ||
                  !deepSleep ||
                  !remSleep ||
                  !awakeTime ||
                  isSubmitting
                }
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Saving...
                  </span>
                ) : (
                  'Record Sleep'
                )}
              </Button>
              {submitSuccess && (
                <span className="ml-4 text-green-600 dark:text-green-400 flex items-center gap-2">
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
                  Entry saved successfully!
                </span>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const handleSubmit = async () => {
    if (!sleepTime || !wakeTime || !deepSleep || !remSleep || !awakeTime)
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
          restingHeartRate: restingHeartRate
            ? parseInt(restingHeartRate)
            : null,
          steps: steps ? parseInt(steps) : null,
          weight: weight ? parseFloat(weight) : null,
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
      setSteps('');
      setWeight('');
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
        date: new Date(entry.date)
          .toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
          })
          .replace(/(\d+)/, (match) => {
            const day = parseInt(match);
            const suffix =
              ['th', 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : day % 10] || 'th';
            return `${day}${suffix}`;
          }),
        totalSleep: Number(
          (entry.totalSleepHours + entry.totalSleepMinutes / 60).toFixed(2)
        ),
        deepSleep: entry.deepSleepPercentage,
        remSleep: entry.remSleepPercentage,
        awakeTime: entry.awakeTimeMinutes,
        restingHeartRate: entry.restingHeartRate,
        steps: entry.steps,
        weight: entry.weight,
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

  const handleDateRangeFilter = (days: number | string) => {
    const to = new Date();
    const from = new Date();

    if (days === '1Y') {
      // Set from date to 1 year ago from today
      from.setFullYear(from.getFullYear() - 1);
    } else {
      // Handle numeric days as before
      from.setDate(from.getDate() - Number(days));
    }

    setDateRange({ from, to });
  };

  const calculateStats = (entries: DayEntry[]) => {
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

    // Calculate average sleep and wake times - filter out entries with "00:00" times
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
            // Adjust for times after midnight (e.g., 1:00 should be treated as 25:00)
            const adjustedHours = hours < 12 ? hours + 24 : hours;
            return acc + adjustedHours * 60 + minutes;
          }, 0) / validSleepTimeEntries.length
        : 0;

    // Convert back to 24-hour format
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

    // Convert average sleep duration to hours and minutes
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

    const avgAwakeTime =
      validEntries.reduce((acc, entry) => acc + entry.awakeTimeMinutes, 0) /
      validEntries.length;

    return {
      avgSleepDurationHours,
      avgSleepDurationMins,
      avgSleepTime: {
        hours: avgSleepHours,
        minutes: avgSleepMins,
      },
      avgWakeTime: {
        hours: avgWakeHours,
        minutes: avgWakeMins,
      },
      avgDeepSleep,
      avgRemSleep,
      avgAwakeTime,
      totalEntries: validEntries.length,
    };
  };

  // Inside your HealthDashboard component, add this constant:
  const sections = [
    {
      id: 'sleep-analysis',
      title: 'Sleep Analysis',
      icon: <Moon className="w-4 h-4" />,
    },
    {
      id: 'heart-rate',
      title: 'Heart Rate',
      icon: <Heart className="w-4 h-4" />,
    },
    {
      id: 'steps',
      title: 'Steps',
      icon: <Footprints className="w-4 h-4" />,
    },
    {
      id: 'weight',
      title: 'Weight',
      icon: <BarChart2 className="w-4 h-4" />,
    },
    {
      id: 'workouts',
      title: 'Workouts',
      icon: <Dumbbell className="w-4 h-4" />,
    },
    {
      id: 'calendar',
      title: 'Calendar',
      icon: <Calendar className="w-4 h-4" />,
    },
  ];

  // Add this helper function before SleepPatternChart
  const getTickInterval = (dataLength: number) => {
    if (dataLength <= 7) return 0;
    if (dataLength <= 14) return 1;
    if (dataLength <= 31) return 2;
    return Math.floor(dataLength / 15);
  };

  // Add before the component definitions
  const findExerciseInLibrary = (
    name: string
  ): Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles'> | undefined => {
    for (const [_, exercises] of Object.entries(EXERCISE_LIBRARY)) {
      const exercise = exercises.find(
        (e) => e.name.toLowerCase() === name.replace(/_/g, ' ')
      );
      if (exercise)
        return {
          primaryMuscle: exercise.primaryMuscle,
          secondaryMuscles: exercise.secondaryMuscles,
        };
    }
    return undefined;
  };

  return (
    <div
      className={`min-h-screen p-4 sm:p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 ${inter.className}`}
    >
      {/* Update the header section styling */}
      <div className="fixed top-0 right-0 left-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm text-slate-900 dark:text-slate-200 shadow-sm">
        <NavigationTabs
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          entries={entries}
        />

        <DateRangeFilter
          dateRange={dateRange}
          setDateRange={setDateRange}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          handleDateRangeFilter={handleDateRangeFilter}
        />
      </div>

      {activeSection === 'all' ? <FloatingToc sections={sections} /> : null}

      {/* Update the main content top padding to account for the fixed header */}
      <main className="max-w-7xl mx-auto pt-32">
        {/* Sleep Section */}
        {(activeSection === 'all' || activeSection === 'sleep') && (
          <>
            <SectionHeader title="Sleep Analysis" />
            {renderManualEntryForm()}
            {entries.length > 0 &&
              (() => {
                const todayEntry = entries.find(
                  (e) => e.date === new Date().toISOString().split('T')[0]
                );
                const hasMeaningfulSleepData =
                  todayEntry &&
                  (todayEntry.totalSleepHours > 0 ||
                    todayEntry.totalSleepMinutes > 0);

                return hasMeaningfulSleepData ? (
                  <div className="mb-8">
                    <SleepAnalysisCard entry={todayEntry} entries={entries} />
                  </div>
                ) : null;
              })()}

            {/* Add Sleep Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
              <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
                <h3
                  className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
                >
                  Sleep Duration
                </h3>
                <div
                  className={`transition-opacity duration-200 ${
                    isLoadingCharts ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={prepareChartData()}
                      margin={{ bottom: 50 }}
                    >
                      <defs>
                        <linearGradient
                          id="sleepGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#a855f7"
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="95%"
                            stopColor="#a855f7"
                            stopOpacity={0}
                          />
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
                      <ReferenceLine // This the recommended band of 7-9 hours
                        y={8}
                        stroke="#22c55e40"
                        strokeWidth={30}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {isLoadingCharts && <ChartLoadingOverlay color="purple" />}
              </div>

              <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                <h3
                  className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
                >
                  Sleep Stats
                </h3>
                {(() => {
                  const stats = calculateStats(entries);
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
                          {stats.avgSleepDurationHours}h{' '}
                          {stats.avgSleepDurationMins}m
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          Average Sleep Duration
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {stats.avgSleepTime.hours
                              .toString()
                              .padStart(2, '0')}
                            :
                            {stats.avgSleepTime.minutes
                              .toString()
                              .padStart(2, '0')}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Avg. Bedtime
                          </div>
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {stats.avgWakeTime.hours
                              .toString()
                              .padStart(2, '0')}
                            :
                            {stats.avgWakeTime.minutes
                              .toString()
                              .padStart(2, '0')}
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
            </div>

            {/* Sleep Pattern Chart */}
            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
              <h3
                className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
              >
                Sleep Pattern
              </h3>
              <div
                className={`transition-opacity duration-200 ${
                  isLoadingCharts ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <SleepPatternChart data={prepareSleepPatternData()} />
              </div>
              {isLoadingCharts && <ChartLoadingOverlay color="purple" />}
            </div>

            {/* Sleep Composition Chart */}
            <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3
                  className={`text-lg font-medium text-slate-900 dark:text-slate-100 ${outfit.className}`}
                >
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
                  <label
                    htmlFor="showAwakeTime"
                    className="text-sm text-slate-600 dark:text-slate-400"
                  >
                    Show Awake Time
                  </label>
                </div>
              </div>
              <div
                className={`transition-opacity duration-200 ${
                  isLoadingCharts ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart
                    data={prepareChartData().map((entry) => {
                      const totalSleepHours = entry.totalSleep;
                      return {
                        ...entry,
                        deepSleepHours:
                          (totalSleepHours * entry.deepSleep) / 100,
                        remSleepHours: (totalSleepHours * entry.remSleep) / 100,
                        lightSleepHours:
                          (totalSleepHours *
                            (100 - entry.deepSleep - entry.remSleep)) /
                          100,
                      };
                    })}
                    margin={{ bottom: 50 }}
                  >
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
                      yAxisId="left"
                      label={{
                        value: 'Sleep Duration (hours)',
                        angle: -90,
                        position: 'insideLeft',
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
                        }}
                        domain={[0, 'auto']}
                      />
                    )}
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const formatDuration = (hours: number) => {
                            const h = Math.floor(hours);
                            const m = Math.round((hours - h) * 60);
                            return `${h}h ${m}m`;
                          };

                          const entry = payload[0].payload; // Get the full data point
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
                              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  Light Sleep:{' '}
                                  {100 - entry.deepSleep - entry.remSleep}%
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  Deep Sleep: {entry.deepSleep}%
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  REM Sleep: {entry.remSleep}%
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="deepSleepHours"
                      stackId="a"
                      fill="#3b82f6"
                      name="Deep Sleep"
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="remSleepHours"
                      stackId="a"
                      fill="#14b8a6"
                      name="REM Sleep"
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="lightSleepHours"
                      stackId="a"
                      fill="#60a5fa"
                      name="Light Sleep"
                    />
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
          </>
        )}

        {/* Heart Rate Section */}
        {(activeSection === 'all' || activeSection === 'rhr') && (
          <>
            <SectionHeader
              title="Heart Rate Analysis"
              className={activeSection === 'all' ? 'mt-12' : ''}
            />
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3 relative">
                <RHRChart
                  data={prepareChartData()}
                  isLoadingCharts={isLoadingCharts}
                  tickInterval={getTickInterval(prepareChartData().length)}
                />
              </div>
              <RHRAnalytics data={prepareChartData()} />
            </div>
          </>
        )}

        {/* Steps Section */}
        {(activeSection === 'all' || activeSection === 'steps') && (
          <>
            <SectionHeader
              title="Steps Analysis"
              className={activeSection === 'all' ? 'mt-12' : ''}
            />
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <StepsChart
                data={prepareChartData()}
                isLoadingCharts={isLoadingCharts}
                tickInterval={getTickInterval(entries.length)}
              />
              <StepsAnalytics data={prepareChartData()} />
            </div>
          </>
        )}

        {/* Weight Section */}
        {(activeSection === 'all' || activeSection === 'weight') && (
          <>
            <SectionHeader
              title="Weight Analysis"
              className={activeSection === 'all' ? 'mt-12' : ''}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <WeightAnalytics data={prepareChartData()} />
              <WeightChart
                data={prepareChartData()}
                isLoadingCharts={isLoadingCharts}
                tickInterval={getTickInterval(prepareChartData().length)}
              />
            </div>
          </>
        )}

        {/* Exercise Section */}
        {(activeSection === 'all' || activeSection === 'gym') && (
          <>
            <SectionHeader
              title="Muscle Group Analysis"
              className={activeSection === 'all' ? 'mt-12' : ''}
            />
            <MuscleGroupAnalysis gymSessions={gymSessions} />

            <SectionHeader
              title="Exercise Analysis"
              className={activeSection === 'all' ? 'mt-12' : ''}
            />
            <ExerciseAnalysis gymSessions={gymSessions} />
          </>
        )}
      </main>

      {activeSection === 'checklist' && (
        <div className="space-y-8 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2
              className={`text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 text-transparent bg-clip-text ${outfit.className}`}
            >
              Daily Health Checklist
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setIsLoadingCharts(true);
                fetch(
                  `/api/notion/entries?startDate=${dateRange.from.toISOString()}&endDate=${dateRange.to.toISOString()}`
                )
                  .then((res) => res.json())
                  .then((data) => {
                    setEntries(data);
                  })
                  .finally(() => {
                    setIsLoadingCharts(false);
                  });
              }}
              className="h-10 w-10"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800 relative">
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const yesterday = new Date(Date.now() - 86400000)
                .toISOString()
                .split('T')[0];

              const todayEntry = entries.find((entry) => entry.date === today);
              const yesterdayEntry = entries.find(
                (entry) => entry.date === yesterday
              );

              const hasTodaySleepData =
                todayEntry &&
                (todayEntry.totalSleepHours > 0 ||
                  todayEntry.totalSleepMinutes > 0);

              const hasYesterdayRHR = yesterdayEntry?.restingHeartRate != null;
              const hasYesterdaySteps = yesterdayEntry?.steps != null;
              const hasTodayWeight = todayEntry?.weight != null;

              const isComplete =
                hasTodaySleepData &&
                hasYesterdayRHR &&
                hasYesterdaySteps &&
                hasTodayWeight;

              return (
                isComplete && (
                  <div className="mb-6 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-4 py-2 rounded-lg border border-green-200 dark:border-green-900 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Great job! You've completed all your health tracking tasks
                      for today! 🎉
                    </span>
                  </div>
                )
              );
            })()}
            {isLoadingCharts && (
              <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg flex items-center justify-center z-50">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full animate-pulse bg-purple-600"></div>
                  <div className="w-4 h-4 rounded-full animate-pulse bg-purple-600"></div>
                  <div className="w-4 h-4 rounded-full animate-pulse bg-purple-600"></div>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {(() => {
                const today = new Date().toISOString().split('T')[0];
                const yesterday = new Date(Date.now() - 86400000)
                  .toISOString()
                  .split('T')[0];

                const todayEntry = entries.find(
                  (entry) => entry.date === today
                );
                const yesterdayEntry = entries.find(
                  (entry) => entry.date === yesterday
                );

                const hasTodaySleepData =
                  todayEntry &&
                  (todayEntry.totalSleepHours > 0 ||
                    todayEntry.totalSleepMinutes > 0);

                const hasYesterdayRHR =
                  yesterdayEntry?.restingHeartRate != null;
                const hasYesterdaySteps = yesterdayEntry?.steps != null;
                const hasTodayWeight = todayEntry?.weight != null;

                const checklistItems = [
                  {
                    id: 'sleep',
                    label: "Record today's sleep data",
                    checked: hasTodaySleepData,
                    autoCheck: true,
                  },
                  {
                    id: 'rhr',
                    label: "Record yesterday's resting heart rate",
                    checked: hasYesterdayRHR,
                    autoCheck: true,
                  },
                  {
                    id: 'steps',
                    label: "Record yesterday's steps",
                    checked: hasYesterdaySteps,
                    autoCheck: true,
                  },
                  {
                    id: 'weight',
                    label: "Record today's weight",
                    checked: hasTodayWeight,
                    autoCheck: true,
                  },
                ];

                return checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 transition-opacity ${
                      item.checked ? 'opacity-60' : ''
                    }`}
                  >
                    <Checkbox
                      id={item.id}
                      className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                      checked={item.checked}
                      disabled={item.autoCheck}
                    />
                    <label
                      htmlFor={item.id}
                      className={`flex-grow text-slate-700 dark:text-slate-300 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                        item.checked ? 'line-through' : ''
                      }`}
                    >
                      {item.label}
                    </label>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'gym' && (
        <>
          <SectionHeader title="Gym Planner" />
          <div className="relative">
            <div
              className={`transition-opacity duration-200 ${
                isLoadingCharts || isCalendarLoading
                  ? 'opacity-50'
                  : 'opacity-100'
              }`}
            >
              <WorkoutCalendar
                onLoadingChange={(loading) => setIsCalendarLoading(loading)}
                showGymForm={showGymForm}
                setShowGymForm={setShowGymForm}
              />
            </div>
            {(isLoadingCharts || isCalendarLoading) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80" />
                <div className="flex flex-col items-center gap-2 z-10">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Loading data...
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
