'use client';

import { useEffect, useState, useMemo } from 'react';
import { Inter, Outfit } from 'next/font/google';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { Analytics } from '@vercel/analytics/react';

// Icons
import {
  Moon,
  Heart,
  Footprints,
  BarChart2,
  Dumbbell,
  Calendar,
} from 'lucide-react';

// Hooks
import { useHealthData } from '@/hooks/useHealthData';
import { useGymData } from '@/hooks/useGymData';

// Types
import { DisplaySection } from '@/types/display-section';

// Layout Components
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { NavigationTabs } from '@/components/NavigationTabs';
import { SectionHeader } from '@/components/SectionHeader';
import { FloatingToc } from '@/components/FloatingToc';

// Sleep-related Components
import { SleepAnalysisCard } from '@/components/SleepAnalysis';
import { SleepPatternChart } from '@/components/SleepPatternChart';
import { SleepCompositionChart } from '@/components/SleepCompositionChart';
import { SleepStats } from '@/components/SleepStats';
import { SleepDurationChart } from '@/components/SleepDurationChart';

// Health Metric Components
import { RHRChart, RHRAnalytics } from '@/components/RHRCharts';
import { WeightChart, WeightAnalytics } from '@/components/WeightCharts';
import { StepsChart, StepsAnalytics } from '@/components/StepsCharts';

// Workout-related Components
import { MuscleGroupAnalysis } from '@/components/MuscleGroupAnalysis';
import { WorkoutCalendar } from '@/components/WorkoutCalendar';
import { ExerciseAnalysis } from '@/components/ExerciseAnalysis';
import { MuscleGroup } from '@/constants/muscle-groups';

// Form Components
import { ManualEntryForm } from '@/components/ManualEntryForm';
import { Checklist } from '@/components/Checklist';
import { SevenDayReport } from '@/components/SevenDayReport';
import { FinancialOverview } from '@/components/FinancialOverview';
import { HabitsOverview } from '@/components/HabitsOverview';

const inter = Inter({ subsets: ['latin'] });
const outfit = Outfit({ subsets: ['latin'] });

export default function Dashboard() {
  const [isChartLoading, setIsChartLoading] = useState(false);

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
    { id: 'steps', title: 'Steps', icon: <Footprints className="w-4 h-4" /> },
    { id: 'weight', title: 'Weight', icon: <BarChart2 className="w-4 h-4" /> },
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

  const [dateRange, setDateRange] = useState(() => ({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  }));

  const [activeTab, setActiveTab] = useState<string | null>('30D');
  const [activeSection, setActiveSection] = useState<DisplaySection>('sleep');
  const [showAwakeTime, setShowAwakeTime] = useState(true);
  const [showGymForm, setShowGymForm] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(
    null
  );
  const [autoOpenManualEntry, setAutoOpenManualEntry] = useState(true);

  const {
    entries,
    setEntries,
    isLoading: healthLoading,
    error,
  } = useHealthData(dateRange);
  const { gymSessions, loading: gymLoading } = useGymData(dateRange);

  const isLoading = healthLoading || gymLoading;

  const prepareChartData = useMemo(() => {
    if (!Array.isArray(entries)) return [];

    return entries
      .filter((entry) => {
        const entryDate = new Date(entry.date);
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        
        return entryDate >= fromDate && entryDate <= toDate;
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
  }, [entries, dateRange]);

  const prepareSleepPatternData = useMemo(() => {
    if (!Array.isArray(entries)) return [];

    return entries
      .filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= dateRange.from && entryDate <= dateRange.to;
      })
      .map((entry) => {
        const [sleepHour, sleepMin] = entry.sleepTime.split(':').map(Number);
        const [wakeHour, wakeMin] = entry.wakeTime.split(':').map(Number);

        const sleepDecimal = sleepHour + sleepMin / 60;
        const wakeDecimal = wakeHour + wakeMin / 60;

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
  }, [entries, dateRange]);

  const handleDateRangeFilter = (days: number | string) => {
    setIsChartLoading(true);
    
    const now = new Date();
    const to = new Date(now);
    let from = new Date(now);

    // Set end of day for 'to'
    to.setHours(23, 59, 59, 999);

    if (days === 'YTD') {
      from = new Date(now.getFullYear(), 0, 1);
    } else {
      from.setDate(from.getDate() - Number(days));
    }

    // Set start of day for 'from'
    from.setHours(0, 0, 0, 0);

    setDateRange({ from, to });
    
    // Adjust timeout based on date range
    const timeout = 
      days === 'YTD' || Number(days) >= 365 ? 1500 :
      Number(days) >= 90 ? 1000 :
      500;

    setTimeout(() => {
      setIsChartLoading(false);
    }, timeout);
  };

  const getTickInterval = (dataLength: number) => {
    if (dataLength <= 7) return 0;
    if (dataLength <= 14) return 1;
    if (dataLength <= 31) return 2;
    if (dataLength <= 90) return 7;
    return Math.floor(dataLength / 12); // Show roughly monthly ticks for yearly view
  };

  const handleMuscleClick = (muscle: MuscleGroup) => {
    setSelectedMuscle(muscle);

    // Add a small delay to ensure the category expands before scrolling
    setTimeout(() => {
      const element = document.getElementById(muscle);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 100);
  };

  const router = useRouter();
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        router.push('/login');
        return;
      }

      setUser(session.user);
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login');
      } else if (session) {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  useEffect(() => {
    if (!entries.length) return;

    const today = new Date().toISOString().split('T')[0];
    const todayEntry = entries.find((entry) => entry.date === today);

    // If there's no entry at all for today, show the form
    if (!todayEntry) {
      setAutoOpenManualEntry(true);
    } else {
      setAutoOpenManualEntry(false);
    }
  }, [entries]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950">
        <LoadingSpinner size="lg" label="Authenticating..." />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950">
        <LoadingSpinner size="lg" label="Loading your data..." />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen p-4 sm:p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 ${inter.className}`}
    >
      <Analytics />
      <div className="fixed top-0 right-0 left-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm text-slate-900 dark:text-slate-200 shadow-sm">
        <NavigationTabs
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          entries={entries}
          user={user}
        />
        <DateRangeFilter
          dateRange={dateRange}
          setDateRange={setDateRange}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          handleDateRangeFilter={handleDateRangeFilter}
        />
      </div>

      {activeSection === 'all' && <FloatingToc sections={sections} />}

      <main className="max-w-7xl mx-auto pt-16">
        {activeSection === 'all' && (
          <div className="mb-8">
            <SevenDayReport entries={entries} gymSessions={gymSessions} />
          </div>
        )}

        {(activeSection === 'all' || activeSection === 'sleep') && (
          <>
            <SectionHeader title="Sleep Analysis" />
            <ManualEntryForm
              entries={entries}
              dateRange={dateRange}
              setEntries={setEntries}
              autoOpen={autoOpenManualEntry}
            />
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
              <SleepDurationChart
                data={prepareChartData}
                isLoadingCharts={isChartLoading}
              />
              <SleepStats entries={entries} dateRange={dateRange} />
            </div>

            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
              <h3
                className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
              >
                Sleep Pattern
              </h3>
              <div
                className={`transition-opacity duration-200 ${
                  isChartLoading ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <SleepPatternChart
                  data={entries.length > 0 ? prepareSleepPatternData : []}
                />
              </div>
            </div>

            <SleepCompositionChart
              data={prepareChartData}
              isLoadingCharts={isChartLoading}
              showAwakeTime={showAwakeTime}
              setShowAwakeTime={setShowAwakeTime}
            />
          </>
        )}

        {(activeSection === 'all' || activeSection === 'rhr') && (
          <>
            <SectionHeader
              title="Heart Rate Analysis"
              className={activeSection === 'all' ? 'mt-12' : ''}
            />
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3 relative">
                <RHRChart
                  data={prepareChartData}
                  isLoadingCharts={isChartLoading}
                  tickInterval={getTickInterval(prepareChartData.length)}
                />
              </div>
              <RHRAnalytics data={prepareChartData} />
            </div>
          </>
        )}

        {(activeSection === 'all' || activeSection === 'steps') && (
          <>
            <SectionHeader
              title="Steps Analysis"
              className={activeSection === 'all' ? 'mt-12' : ''}
            />
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3 relative">
                <StepsChart
                  data={prepareChartData}
                  isLoadingCharts={isChartLoading}
                  tickInterval={getTickInterval(prepareChartData.length)}
                />
              </div>
              <StepsAnalytics data={prepareChartData} />
            </div>
          </>
        )}

        {(activeSection === 'all' || activeSection === 'weight') && (
          <>
            <SectionHeader
              title="Weight Analysis"
              className={activeSection === 'all' ? 'mt-12' : ''}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <WeightAnalytics data={prepareChartData} />
              <WeightChart
                data={prepareChartData}
                isLoadingCharts={isChartLoading}
                tickInterval={getTickInterval(prepareChartData.length)}
              />
            </div>
          </>
        )}

        {(activeSection === 'all' || activeSection === 'gym') && (
          <>
            {activeSection === 'gym' && (
              <FloatingToc
                sections={[
                  {
                    id: 'gym-planner',
                    title: 'Calendar',
                    icon: <Calendar className="w-4 h-4" />,
                  },
                  {
                    id: 'muscle-group-analysis',
                    title: 'Muscle Groups',
                    icon: <BarChart2 className="w-4 h-4" />,
                  },
                  {
                    id: 'exercise-analysis',
                    title: 'Exercises',
                    icon: <Dumbbell className="w-4 h-4" />,
                  },
                ]}
              />
            )}

            <div id="gym-planner">
              <SectionHeader
                title="Gym Planner"
                className={activeSection === 'all' ? 'mt-12' : ''}
              />
              <div className="relative">
                <div
                  className={`transition-opacity duration-200 ${
                    isChartLoading || isCalendarLoading
                      ? 'opacity-50'
                      : 'opacity-100'
                  }`}
                >
                  <WorkoutCalendar
                    onLoadingChange={setIsCalendarLoading}
                    showGymForm={showGymForm}
                    setShowGymForm={setShowGymForm}
                    onMuscleClick={handleMuscleClick}
                  />
                </div>
              </div>
            </div>

            <div id="muscle-group-analysis">
              <SectionHeader
                title="Muscle Group Analysis"
                className={activeSection === 'all' ? 'mt-12' : ''}
              />
              <MuscleGroupAnalysis
                gymSessions={gymSessions}
                onMuscleClick={handleMuscleClick}
                selectedMuscle={selectedMuscle}
              />
            </div>

            <div id="exercise-analysis">
              <SectionHeader
                title="Exercise Analysis"
                className={activeSection === 'all' ? 'mt-12' : ''}
              />
              <ExerciseAnalysis
                gymSessions={gymSessions}
                onMuscleClick={handleMuscleClick}
              />
            </div>
          </>
        )}

        {activeSection === 'finances' && (
          <>
            <SectionHeader title="Financial Overview" />
            <FinancialOverview />
          </>
        )}

        {activeSection === 'checklist' && (
          <Checklist
            entries={entries}
            dateRange={dateRange}
            isLoadingCharts={isChartLoading}
            setIsLoadingCharts={() => {}}
            setEntries={setEntries}
          />
        )}

        {activeSection === 'habits' && (
          <>
            <SectionHeader title="Habits Tracker" />
            <HabitsOverview 
              dateRange={dateRange}
              activeTab={activeTab}
            />
          </>
        )}
      </main>
    </div>
  );
}
