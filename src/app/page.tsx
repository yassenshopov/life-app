'use client';

import { useEffect, useState, useMemo } from 'react';
import { Inter, Outfit } from 'next/font/google';

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

// Form Components
import { ManualEntryForm } from '@/components/ManualEntryForm';
import { Checklist } from '@/components/Checklist';

const inter = Inter({ subsets: ['latin'] });
const outfit = Outfit({ subsets: ['latin'] });

export default function Dashboard() {
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
  const [activeSection, setActiveSection] = useState<DisplaySection>('all');
  const [showAwakeTime, setShowAwakeTime] = useState(true);
  const [showGymForm, setShowGymForm] = useState(false);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  const {
    entries,
    setEntries,
    loading: healthLoading,
  } = useHealthData(dateRange);
  const {
    exerciseData,
    gymSessions,
    loading: gymLoading,
  } = useGymData(dateRange);

  const isLoading = healthLoading || gymLoading;

  const prepareChartData = useMemo(() => {
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
  }, [entries, dateRange]);

  const prepareSleepPatternData = useMemo(() => {
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
    const to = new Date();
    const from = new Date();

    if (days === '1Y') {
      from.setFullYear(from.getFullYear() - 1);
    } else {
      from.setDate(from.getDate() - Number(days));
    }

    setDateRange({ from, to });
  };

  const getTickInterval = (dataLength: number) => {
    if (dataLength <= 7) return 0;
    if (dataLength <= 14) return 1;
    if (dataLength <= 31) return 2;
    return Math.floor(dataLength / 15);
  };

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

      {activeSection === 'all' && <FloatingToc sections={sections} />}

      <main className="max-w-7xl mx-auto pt-32">
        {(activeSection === 'all' || activeSection === 'sleep') && (
          <>
            <SectionHeader title="Sleep Analysis" />
            <ManualEntryForm
              entries={entries}
              dateRange={dateRange}
              setEntries={setEntries}
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
                isLoadingCharts={isLoading}
              />
              <SleepStats entries={entries} />
            </div>

            <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
              <h3
                className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
              >
                Sleep Pattern
              </h3>
              <div
                className={`transition-opacity duration-200 ${
                  isLoading ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <SleepPatternChart
                  data={entries.length > 0 ? prepareSleepPatternData : []}
                />
              </div>
            </div>

            <SleepCompositionChart
              data={prepareChartData}
              isLoadingCharts={isLoading}
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
                  isLoadingCharts={isLoading}
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
                  isLoadingCharts={isLoading}
                  tickInterval={getTickInterval(entries.length)}
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
                isLoadingCharts={isLoading}
                tickInterval={getTickInterval(prepareChartData.length)}
              />
            </div>
          </>
        )}

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

        {activeSection === 'checklist' && (
          <Checklist
            entries={entries}
            dateRange={dateRange}
            isLoadingCharts={isLoading}
            setIsLoadingCharts={() => {}}
            setEntries={setEntries}
          />
        )}

        {activeSection === 'gym' && (
          <>
            <SectionHeader title="Gym Planner" />
            <div className="relative">
              <div
                className={`transition-opacity duration-200 ${
                  isLoading || isCalendarLoading ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <WorkoutCalendar
                  onLoadingChange={setIsCalendarLoading}
                  showGymForm={showGymForm}
                  setShowGymForm={setShowGymForm}
                />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
