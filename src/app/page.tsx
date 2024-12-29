'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Inter, Outfit } from 'next/font/google';
import {
  Moon,
  Heart,
  Footprints,
  X,
  Pencil,
  Dumbbell,
  Calendar,
  BarChart2,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ChartLoadingOverlay } from '@/components/ChartLoadingOverlay';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { NavigationTabs } from '@/components/NavigationTabs';
import { SectionHeader } from '@/components/SectionHeader';
import { DisplaySection } from '@/types/display-section';
import { FloatingToc } from '@/components/FloatingToc';
import { EXERCISE_LIBRARY, Exercise } from '@/constants/exercises';
import { RHRChart, RHRAnalytics } from '@/components/RHRCharts';
import { WeightChart, WeightAnalytics } from '@/components/WeightCharts';
import { StepsChart, StepsAnalytics } from '@/components/StepsCharts';
import { SleepAnalysisCard } from '@/components/SleepAnalysis';
import { SleepPatternChart } from '@/components/SleepPatternChart';
import { MuscleGroupAnalysis } from '@/components/MuscleGroupAnalysis';
import { WorkoutCalendar } from '@/components/WorkoutCalendar';
import { ExerciseAnalysis } from '@/components/ExerciseAnalysis';
import { Checklist } from '@/components/Checklist';
import { SleepCompositionChart } from '@/components/SleepCompositionChart';
import { SleepStats } from '@/components/SleepStats';
import { SleepDurationChart } from '@/components/SleepDurationChart';
import { DayEntry } from '@/types/day-entry';
import { ManualEntryForm } from '@/components/ManualEntryForm';
const inter = Inter({ subsets: ['latin'] });
const outfit = Outfit({ subsets: ['latin'] });

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

            {/* Add Sleep Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
              <SleepDurationChart
                data={prepareChartData()}
                isLoadingCharts={isLoadingCharts}
              />
              <SleepStats entries={entries} />
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
            <SleepCompositionChart
              data={prepareChartData()}
              isLoadingCharts={isLoadingCharts}
              showAwakeTime={showAwakeTime}
              setShowAwakeTime={setShowAwakeTime}
            />
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
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-3 relative">
                <StepsChart
                  data={prepareChartData()}
                  isLoadingCharts={isLoadingCharts}
                  tickInterval={getTickInterval(entries.length)}
                />
              </div>
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
            isLoadingCharts={isLoadingCharts}
            setIsLoadingCharts={setIsLoadingCharts}
            setEntries={setEntries}
          />
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
            </div>
          </>
        )}
      </main>
    </div>
  );
}
