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
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
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
  HeartPulse,
  Users,
  ArrowUpDown,
  Activity,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { addDays, format, isSameDay, startOfMonth } from 'date-fns';
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ChartLoadingOverlay } from '@/components/ChartLoadingOverlay';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { NavigationTabs } from '@/components/NavigationTabs';
import { SectionHeader } from '@/components/SectionHeader';
import { DisplaySection } from '@/types/display-section';
import { FloatingToc } from '@/components/FloatingToc';
import { EXERCISE_LIBRARY, GymSessionType, Exercise } from '@/constants/exercises';
import { MuscleGroup } from '@/constants/muscle-groups';

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

interface SleepAnalysis {
  quality: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  qualityScore: number;
  insights: Array<{
    text: string;
    metric?: { value: number; min: number; max: number; unit: string };
  }>;
  recommendations: string[];
}

interface WorkoutCalendarProps {
  onLoadingChange: (loading: boolean) => void;
  showGymForm: boolean;
  setShowGymForm: (show: boolean) => void;
}

const formatGymType = (type: string): string => {
  switch (type.toLowerCase()) {
    case 'upper':
      return 'Upper Body';
    case 'lower':
      return 'Lower Body';
    case 'full':
      return 'Full Body';
    case 'cardio':
      return 'Cardio';
    case 'other':
      return 'Other';
    default:
      return type;
  }
};

interface WorkoutEvent {
  id: string;
  type: string;
  title: string;
  date: string;
  distance?: number;
  duration?: number;
  pace?: string;
  notes?: string;
}

interface WorkoutExercise {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
  sets: Array<{
    reps: number;
    weight: number;
  }>;
}

interface ExerciseStats {
  name: string;
  totalSets: number;
  maxWeight: number;
  avgWeight: number;
  totalReps: number;
  lastPerformed: string;
  category: keyof typeof EXERCISE_LIBRARY;
  affectedMuscles: MuscleGroup[];
}

const calculateExerciseStats = (gymSessions: any[]): ExerciseStats[] => {
  const exerciseStats = new Map<string, ExerciseStats>();

  (
    Object.entries(EXERCISE_LIBRARY) as [GymSessionType, readonly Exercise[]][]
  ).forEach(([category, exercises]) => {
    exercises.forEach((exercise) => {
      exerciseStats.set(exercise.name.toLowerCase(), {
        name: exercise.name,
        totalSets: 0,
        maxWeight: 0,
        avgWeight: 0,
        totalReps: 0,
        lastPerformed: '',
        category: category as keyof typeof EXERCISE_LIBRARY,
        affectedMuscles: [exercise.primaryMuscle, ...(exercise.secondaryMuscles || [])] as MuscleGroup[]
      });
    });
  });

  gymSessions.forEach((session) => {
    const sessionDate = new Date(session.date).toISOString().split('T')[0];
    const exerciseLog = session.exercise_log || {};

    Object.entries(exerciseLog).forEach(
      ([exerciseName, data]: [string, any]) => {
        const cleanName = exerciseName.toLowerCase().replace(/_/g, ' ');
        const stats = exerciseStats.get(cleanName);

        if (stats) {
          let sessionTotalWeight = 0;
          let sessionTotalSets = 0;

          data.sets.forEach((set: { weight: number; reps: number }) => {
            stats.totalSets++;
            stats.totalReps += set.reps;
            stats.maxWeight = Math.max(stats.maxWeight, set.weight);
            sessionTotalWeight += set.weight;
            sessionTotalSets++;
          });

          stats.avgWeight = Number(
            (
              (stats.avgWeight * (stats.totalSets - sessionTotalSets) +
                sessionTotalWeight) /
              stats.totalSets
            ).toFixed(1)
          );

          if (!stats.lastPerformed || sessionDate > stats.lastPerformed) {
            stats.lastPerformed = sessionDate;
          }
        }
      }
    );
  });

  return Array.from(exerciseStats.values()).sort((a, b) => {
    if (a.totalSets > 0 && b.totalSets === 0) return -1;
    if (a.totalSets === 0 && b.totalSets > 0) return 1;
    if (a.totalSets > 0 && b.totalSets > 0) {
      return (
        new Date(b.lastPerformed).getTime() -
        new Date(a.lastPerformed).getTime()
      );
    }
    return a.name.localeCompare(b.name);
  });
};

const ExerciseAnalysis = ({ gymSessions }: { gymSessions: any[] }) => {
  const exerciseStats = calculateExerciseStats(gymSessions);
  const [selectedCategory, setSelectedCategory] = useState<string>('legs');

  const handleMuscleClick = (e: React.MouseEvent<HTMLAnchorElement>, muscle: string) => {
    e.preventDefault();
    const element = document.getElementById(muscle);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const filteredStats = exerciseStats.filter(
    (stat) => selectedCategory === 'all' || stat.category === selectedCategory
  );

  return (
    <div className="space-y-6 mb-6">
      <div className="flex items-center gap-4 mb-6">
        <Select
          value={selectedCategory}
          onValueChange={(value: string) => setSelectedCategory(value)}
        >
          <SelectTrigger className="w-[180px] bg-white dark:bg-slate-800">
            <SelectValue placeholder="All Exercises" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Exercises</SelectItem>
            <SelectItem value="legs" className="flex items-center gap-2">
              <span>Legs</span>
            </SelectItem>
            <SelectItem
              value="back_and_chest"
              className="flex items-center gap-2"
            >
              <span>Back & Chest</span>
            </SelectItem>
            <SelectItem
              value="shoulders_and_arms"
              className="flex items-center gap-2"
            >
              <span>Shoulders & Arms</span>
            </SelectItem>
            <SelectItem value="cardio" className="flex items-center gap-2">
              <span>Cardio</span>
            </SelectItem>
            <SelectItem value="full_body" className="flex items-center gap-2">
              <span>Full Body</span>
            </SelectItem>
          </SelectContent>
        </Select>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          {filteredStats.length} exercises
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {filteredStats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                {stat.name}
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-y-4">
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Max Weight
                </div>
                <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                  {stat.maxWeight}{' '}
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    kg
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Avg Weight
                </div>
                <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                  {stat.avgWeight}{' '}
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    kg
                  </span>
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Total Sets
                </div>
                <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                  {stat.totalSets}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Total Reps
                </div>
                <div className="text-base font-medium text-slate-900 dark:text-slate-100">
                  {stat.totalReps}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Affected Muscles: 
                <div className="flex flex-wrap gap-1 mt-1">
                  {stat.affectedMuscles.map((muscle, index) => (
                    <a
                      key={index}
                      href={`#${muscle}`}
                      onClick={(e) => handleMuscleClick(e, muscle)}
                      className="px-2 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      {muscle.charAt(0).toUpperCase() + muscle.slice(1).replace('_', ' ')}
                    </a>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Last performed:{' '}
                {new Date(stat.lastPerformed).toLocaleDateString() !==
                'Invalid Date'
                  ? new Date(stat.lastPerformed).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '--:--'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const WorkoutCalendar = ({
  showGymForm,
  setShowGymForm,
}: WorkoutCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workouts, setWorkouts] = useState<WorkoutEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gymSessions, setGymSessions] = useState<any[]>([]);

  const [sessionType, setSessionType] = useState<GymSessionType>('legs');
  const [selectedExercises, setSelectedExercises] = useState<WorkoutExercise[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmittingGym, setIsSubmittingGym] = useState(false);

  const [gymDate, setGymDate] = useState<string | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<any>(null);

  const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(
    new Set()
  );

  const toggleExercise = (index: number) => {
    const newCollapsed = new Set(collapsedExercises);
    if (newCollapsed.has(index)) {
      newCollapsed.delete(index);
    } else {
      newCollapsed.add(index);
    }
    setCollapsedExercises(newCollapsed);
  };

  useEffect(() => {
    const startDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    fetch(
      `/api/notion/running?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    )
      .then((res) => res.json())
      .then((runs) => {
        const formattedRuns = runs.map((run: any) => ({
          id: run.id,
          date: new Date(run.date + 'T00:00:00').toISOString().split('T')[0],
          type: 'run' as const,
          title: run.name,
          distance: run.distance,
          duration: run.duration,
          pace: run.pace,
          notes: run.notes,
        }));
        setWorkouts(formattedRuns);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching runs:', error);
        setIsLoading(false);
      });

    fetch(
      `/api/supabase/exercises?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    )
      .then((res) => res.json())
      .then((gymData) => {
        console.log('Gym sessions:', gymData);
        setGymSessions(gymData);
      })
      .catch((error) => {
        console.error('Error fetching gym sessions:', error);
      });
  }, [currentDate]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    // Convert Sunday (0) to 6, and shift other days back by 1
    return day === 0 ? 6 : day - 1;
  };

  const handlePreviousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
  };

  const monthYear = currentDate.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(currentDate);

  const handleGymSubmit = async () => {
    if (!sessionType || selectedExercises.length === 0) return;
    setIsSubmittingGym(true);

    // Get the selected date or default to today
    const selectedDate = gymDate || new Date().toISOString().split('T')[0];

    // Transform exercises into the required format
    const exerciseLog = selectedExercises.reduce((acc, exercise, index) => {
      const exerciseName = exercise.name.toLowerCase().replace(/\s+/g, '_');
      acc[exerciseName] = {
        order: index + 1,
        sets: exercise.sets.map((set, setIndex) => ({
          reps: set.reps,
          weight: set.weight,
          order: setIndex + 1,
        })),
      };
      return acc as { [key: string]: any };
    }, {} as { [key: string]: any });

    try {
      const endpoint = '/api/supabase/exercises';
      const method = editingWorkout ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingWorkout?.id, // Include ID if editing
          type: sessionType,
          date: selectedDate,
          exercise_log: exerciseLog,
          notes: notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save gym session');

      // Reset form
      setShowGymForm(false);
      setSessionType('' as GymSessionType);
      setSelectedExercises([]);
      setNotes('');
      setGymDate(null);
      setEditingWorkout(null);
    } catch (error) {
      console.error('Failed to save gym session:', error);
    } finally {
      setIsSubmittingGym(false);
    }
  };

  // Add function to handle editing a workout
  const handleEditWorkout = (workout: any) => {
    setEditingWorkout(workout);
    setShowGymForm(true);
    setSessionType(workout.type);
    setGymDate(workout.date);
    setNotes(workout.notes || '');

    // Transform exercise_log back into selectedExercises format
    const exercises = Object.entries(workout.exercise_log).map(
      ([name, data]: [string, any]) => ({
        name: name
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        primaryMuscle:
          findExerciseInLibrary(name)?.primaryMuscle ||
          ('full_body' as MuscleGroup),
        sets: data.sets.map((set: any) => ({
          reps: set.reps,
          weight: set.weight,
        })),
      })
    );
    setSelectedExercises(exercises);
  };

  // Add this helper function
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
    <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 max-w-7xl mx-auto">
      {/* Calendar Section - Left Side */}
      <div className="lg:col-span-5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            {monthYear}
          </h3>
          {/* Calendar Navigation Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePreviousMonth}
              className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day Headers - Now starting with Monday */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-slate-600 dark:text-slate-400 p-2"
            >
              {day}
            </div>
          ))}

          {/* Empty cells for days before the first day of the month */}
          {Array.from({ length: firstDayOfMonth }, (_, i) => (
            <div key={`empty-${i}`} className="aspect-square p-2" />
          ))}

          {/* Calendar Days */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const currentMonthDate = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              day
            );
            const dateString = currentMonthDate.toISOString().split('T')[0];
            const workoutsForDay = workouts.filter(
              (event) => event.date === dateString
            );
            const gymSessionsForDay = gymSessions.filter((session) => {
              // Add T00:00:00 to the date string before creating the Date object, just like we do for runs
              const sessionDate = new Date(session.date + 'T00:00:00')
                .toISOString()
                .split('T')[0];
              return sessionDate === dateString;
            });
            const isToday =
              currentMonthDate.toDateString() === new Date().toDateString();

            // Combine both types of activities
            const activitiesForDay = [
              ...workoutsForDay.map((workout) => ({
                type: workout.type,
                title: workout.title,
                details: {
                  distance: workout.distance,
                  duration: workout.duration,
                  pace: workout.pace,
                  notes: workout.notes,
                },
              })),
              ...gymSessionsForDay.map((session) => ({
                type: 'gym',
                title: formatGymType(session.type) || 'Gym Session',
                details: {
                  exercises: session.exercises,
                  notes: session.notes,
                },
              })),
            ];

            return (
              <TooltipProvider key={day}>
                <TooltipUI delayDuration={200}>
                  <TooltipTrigger asChild>
                    <div
                      className={`aspect-square p-2 border border-slate-200 dark:border-slate-700 rounded-lg relative ${
                        isToday
                          ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                          : ''
                      } cursor-default`}
                    >
                      <span
                        className={`text-sm ${
                          isToday
                            ? 'font-medium text-purple-600 dark:text-purple-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {day}
                      </span>
                      {activitiesForDay.length > 0 && (
                        <div className="absolute bottom-1 right-1 flex gap-1">
                          {activitiesForDay.map((activity, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between"
                            >
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  activity.type === 'run'
                                    ? 'bg-orange-500'
                                    : activity.type === 'gym'
                                    ? 'bg-purple-500'
                                    : 'bg-blue-500'
                                }`}
                              />
                              {activity.type === 'gym' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditWorkout(gymSessionsForDay[index]);
                                  }}
                                  className="h-6 w-6"
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  {activitiesForDay.length > 0 && (
                    <TooltipContent className="space-y-2">
                      {activitiesForDay.map((activity, index) => (
                        <div key={index} className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                activity.type === 'run'
                                  ? 'bg-orange-500'
                                  : activity.type === 'gym'
                                  ? 'bg-purple-500'
                                  : 'bg-blue-500'
                              }`}
                            />
                            <span className="font-medium">
                              {activity.title}
                            </span>
                          </div>
                          {activity.type === 'run' && (
                            <div className="text-sm text-slate-500 dark:text-slate-400 pl-4 space-y-1">
                              {'distance' in activity.details &&
                                activity.details.distance && (
                                  <div>
                                    Distance: {activity.details.distance}km
                                  </div>
                                )}
                              {'duration' in activity.details &&
                                activity.details.duration && (
                                  <div>
                                    Duration: {activity.details.duration}min
                                  </div>
                                )}
                              {'pace' in activity.details &&
                                activity.details.pace && (
                                  <div>Pace: {activity.details.pace}min/km</div>
                                )}
                              {'notes' in activity.details &&
                                activity.details.notes && (
                                  <div>Notes: {activity.details.notes}</div>
                                )}
                            </div>
                          )}
                          {activity.type === 'gym' && (
                            <div className="text-sm text-slate-500 dark:text-slate-400 pl-4 space-y-1">
                              {'exercises' in activity.details &&
                                activity.details.exercises && (
                                  <div>
                                    Exercises: {activity.details.exercises}
                                  </div>
                                )}
                              {activity.details.notes && (
                                <div>Notes: {activity.details.notes}</div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </TooltipContent>
                  )}
                </TooltipUI>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      {/* Workout Details - Right Side */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
            Today's Workout
          </h3>
          {workouts.some(
            (event) =>
              new Date(event.date).toDateString() === new Date().toDateString()
          ) ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Upper Body + Core
                </span>
              </div>
              <Button className="w-full bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700">
                Start Workout
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No workout scheduled for today
            </p>
          )}
        </div>

        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => setShowGymForm(true)}
            >
              <DumbbellIcon className="mr-2 h-4 w-4" /> Add Gym Session
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Calendar className="mr-2 h-4 w-4" /> View Schedule
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <BarChart2 className="mr-2 h-4 w-4" /> Progress Stats
            </Button>
          </div>
        </div>
      </div>

      {showGymForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                  {editingWorkout ? 'Edit Gym Session' : 'Add Gym Session'}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowGymForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  // Handle form submission
                }}
                className="space-y-4"
              >
                {/* Add this date input */}
                <div>
                  <label
                    htmlFor="date"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Date
                  </label>
                  <input
                    type="date"
                    id="date"
                    value={gymDate || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setGymDate(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                  />
                </div>
                <div>
                  <label
                    htmlFor="sessionType"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Session Type
                  </label>
                  <Select
                    value={sessionType}
                    onValueChange={(value) =>
                      setSessionType(value as GymSessionType)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select session type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value="legs"
                        className="flex items-center gap-2"
                      >
                        <span>Legs</span>
                      </SelectItem>
                      <SelectItem
                        value="back_and_chest"
                        className="flex items-center gap-2"
                      >
                        <span>Back & Chest</span>
                      </SelectItem>
                      <SelectItem
                        value="shoulders_and_arms"
                        className="flex items-center gap-2"
                      >
                        <span>Shoulders & Arms</span>
                      </SelectItem>
                      <SelectItem
                        value="cardio"
                        className="flex items-center gap-2"
                      >
                        <span>Cardio</span>
                      </SelectItem>
                      <SelectItem
                        value="full_body"
                        className="flex items-center gap-2"
                      >
                        <span>Full Body</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label
                    htmlFor="exercises"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                  >
                    Exercises
                  </label>

                  {/* Exercise Search & Add */}
                  <div className="flex gap-2 mb-4">
                    <Select
                      value={exerciseSearch}
                      onValueChange={(value) => {
                        if (value) {
                          setSelectedExercises([
                            ...selectedExercises,
                            {
                              name: value,
                              primaryMuscle: 'shoulders_and_arms' as MuscleGroup, // Default value
                              sets: [{ reps: 0, weight: 0 }],
                            },
                          ]);
                          setExerciseSearch('');
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an exercise" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXERCISE_LIBRARY[sessionType]?.map(
                          (exercise: Exercise) => (
                            <SelectItem
                              key={exercise.name}
                              value={exercise.name}
                            >
                              {exercise.name}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selected Exercises List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedExercises.map((exercise, index) => (
                      <div
                        key={index}
                        className="border rounded-lg p-4 dark:border-slate-700"
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => toggleExercise(index)}
                        >
                          <h3 className="text-lg font-medium">
                            {exercise.name}
                          </h3>
                          <Button variant="ghost" size="sm">
                            {collapsedExercises.has(index) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        {!collapsedExercises.has(index) && (
                          <div className="mt-4">
                            {/* Existing exercise sets content */}
                            {exercise.sets.map((set, setIndex) => (
                              <div
                                key={setIndex}
                                className="flex items-center gap-2"
                              >
                                <span className="text-sm text-slate-500 w-10">
                                  Set {setIndex + 1}
                                </span>
                                <input
                                  type="number"
                                  placeholder="Reps"
                                  className="w-20 rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                                  value={set.reps || ''}
                                  onChange={(e) => {
                                    const newExercises = [...selectedExercises];
                                    newExercises[index].sets[setIndex].reps =
                                      Number(e.target.value);
                                    setSelectedExercises(newExercises);
                                  }}
                                />
                                <span className="text-sm text-slate-500">
                                  ×
                                </span>
                                <input
                                  type="number"
                                  placeholder="Weight"
                                  className="w-20 rounded-md border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 p-2"
                                  value={set.weight || ''}
                                  onChange={(e) => {
                                    const newExercises = [...selectedExercises];
                                    newExercises[index].sets[setIndex].weight =
                                      Number(e.target.value);
                                    setSelectedExercises(newExercises);
                                  }}
                                />
                                <span className="text-sm text-slate-500">
                                  kg
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newExercises = [...selectedExercises];
                                    newExercises[index].sets.splice(
                                      setIndex,
                                      1
                                    );
                                    setSelectedExercises(newExercises);
                                  }}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}

                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => {
                                const newExercises = [...selectedExercises];
                                newExercises[index].sets.push({
                                  reps: 0,
                                  weight: 0,
                                });
                                setSelectedExercises(newExercises);
                              }}
                            >
                              Add Set
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="notes"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Notes (optional)
                  </label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Enter notes"
                    className="w-full"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowGymForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGymSubmit}
                    disabled={
                      !sessionType ||
                      selectedExercises.length === 0 ||
                      isSubmittingGym
                    }
                  >
                    {isSubmittingGym ? (
                      <span className="flex items-center gap-2">
                        <LoadingSpinner size="sm" />
                        Saving...
                      </span>
                    ) : editingWorkout ? (
                      'Update Session'
                    ) : (
                      'Save Session'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default function HealthDashboard() {
  const [date, setDate] = useState<Date | undefined>(new Date());
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

  // Add this inside your Home component, with other state declarations
  const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>(
    {}
  );

  const [isCalendarLoading, setIsCalendarLoading] = useState(false);

  // Add to your existing state declarations
  const [exerciseData, setExerciseData] = useState<any[]>([]);

  // Add this to your state declarations
  const [gymSessions, setGymSessions] = useState<any[]>([]);

  const [showGymForm, setShowGymForm] = useState(false);

  // Add near your other state declarations
  const [sessionType, setSessionType] = useState<GymSessionType>('legs');
  const [selectedExercises, setSelectedExercises] = useState<WorkoutExercise[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmittingGym, setIsSubmittingGym] = useState(false);

  // Add this near your other state declarations
  const [gymDate, setGymDate] = useState<string | null>(null);

  // Add a new state for tracking the workout being edited
  const [editingWorkout, setEditingWorkout] = useState<any>(null);

  // Add state to track collapsed exercises
  const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(
    new Set()
  );

  // Add toggle function
  const toggleExercise = (index: number) => {
    const newCollapsed = new Set(collapsedExercises);
    if (newCollapsed.has(index)) {
      newCollapsed.delete(index);
    } else {
      newCollapsed.add(index);
    }
    setCollapsedExercises(newCollapsed);
  };

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

  const hasEntryForToday = entries.some((entry) => {
    const today = new Date().toISOString().split('T')[0];
    return entry.date === today;
  });

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

  const SleepPatternChart = ({ data }: { data: any[] }) => {
    const tickInterval = getTickInterval(data.length);

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
            tick={{ dy: 10, fontSize: 12 }}
            interval={tickInterval}
            angle={-45}
            textAnchor="end"
            height={60}
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
    const tickInterval = getTickInterval(data.length);

    const chartData = data.map((entry) => ({
      date: entry.date,
      rhr: entry.restingHeartRate,
    }));
    // Calculate average RHR for the period
    const validRHR = data
      .filter((entry) => entry.restingHeartRate !== null)
      .map((entry) => entry.restingHeartRate);
    const averageRHR =
      validRHR.length > 0
        ? Math.round(
            validRHR.reduce((acc, curr) => acc + curr, 0) / validRHR.length
          )
        : 0;

    // Custom tick formatter for Y-axis
    const CustomYAxisTick = (props: any) => {
      const { x, y, payload } = props;
      const isAverage = Math.abs(payload.value - averageRHR) < 0.5; // Check if this tick is close to average

      return (
        <text
          x={x}
          y={y}
          dy={4}
          textAnchor="end"
          fill={isAverage ? '#ef4444' : 'currentColor'}
          className={isAverage ? 'font-medium' : ''}
        >
          {payload.value}
        </text>
      );
    };

    // Calculate domain and ticks
    const minRHR = Math.min(...validRHR);
    const maxRHR = Math.max(...validRHR);
    const yAxisTicks = generateYAxisTicks(minRHR, maxRHR, averageRHR);

    return (
      <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
        <h3
          className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
        >
          Resting Heart Rate
        </h3>
        <div
          className={`transition-opacity duration-200 ${
            isLoadingCharts ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ bottom: 50 }}>
              <defs>
                <linearGradient id="rhrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={60}
                interval={tickInterval}
                tick={{ dy: 10, fontSize: 12 }}
              />
              <YAxis
                domain={[minRHR - 2, maxRHR + 2]}
                tick={<CustomYAxisTick />}
                ticks={yAxisTicks}
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
                          RHR: {payload[0].value} bpm
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="rhr"
                stroke="#ef4444"
                fill="url(#rhrGradient)"
                strokeWidth={3}
                name="Resting Heart Rate"
                connectNulls={false}
              />
              <ReferenceLine
                y={averageRHR}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{
                  value: `Avg: ${averageRHR} bpm`,
                  position: 'right',
                  fill: '#ef4444',
                  fontSize: 12,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {isLoadingCharts && <ChartLoadingOverlay color="red" />}
      </div>
    );
  };

  // Helper function to generate Y-axis ticks including the average
  const generateYAxisTicks = (min: number, max: number, average: number) => {
    const ticks = new Set<number>();

    // Add min and max
    ticks.add(Math.floor(min));
    ticks.add(Math.ceil(max));

    // Add average
    ticks.add(average);

    // Add intermediate values
    for (let i = Math.floor(min); i <= Math.ceil(max); i++) {
      ticks.add(i);
    }

    // Convert to array and sort
    return Array.from(ticks).sort((a, b) => a - b);
  };

  const RHRAnalytics = ({ data }: { data: any[] }) => {
    // Filter out null/undefined RHR values and map to correct format
    const validData = data
      .filter((entry) => entry.restingHeartRate != null)
      .map((entry) => ({
        rhr: entry.restingHeartRate,
      }));

    if (validData.length === 0) {
      return (
        <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <h3
            className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
          >
            RHR Analytics
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            No RHR data available for this period.
          </p>
        </div>
      );
    }

    const average = Math.round(
      validData.reduce((acc, curr) => acc + curr.rhr, 0) / validData.length
    );
    const min = Math.min(...validData.map((d) => d.rhr));
    const max = Math.max(...validData.map((d) => d.rhr));

    // Calculate trend (comparing first and last valid readings)
    const firstReading = validData[validData.length - 1].rhr;
    const lastReading = validData[0].rhr;
    const trend = lastReading - firstReading;

    // Calculate variability (standard deviation)
    const meanSquaredDiff =
      validData.reduce(
        (acc, curr) => acc + Math.pow(curr.rhr - average, 2),
        0
      ) / validData.length;
    const standardDeviation = Math.round(Math.sqrt(meanSquaredDiff) * 10) / 10;

    return (
      <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
        <h3
          className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
        >
          RHR Analytics
        </h3>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {average}{' '}
              <span className="text-sm font-normal text-slate-500">bpm</span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Average RHR
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {min}{' '}
                <span className="text-xs font-normal text-slate-500">bpm</span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Lowest
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {max}{' '}
                <span className="text-xs font-normal text-slate-500">bpm</span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Highest
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Period Trend
              </span>
              <div
                className={`flex items-center gap-1 text-sm ${
                  trend > 0
                    ? 'text-red-500'
                    : trend < 0
                    ? 'text-green-500'
                    : 'text-slate-500'
                }`}
              >
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
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Variability
              </span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                ±{standardDeviation} bpm
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const WeightChart = ({ data }: { data: any[] }) => {
    const tickInterval = getTickInterval(data.length);

    // Calculate average weight for the period
    const validWeights = data
      .filter((entry) => entry.weight !== null)
      .map((entry) => entry.weight);
    const averageWeight =
      validWeights.length > 0
        ? Number(
            (
              validWeights.reduce((acc, curr) => acc + curr, 0) /
              validWeights.length
            ).toFixed(1)
          )
        : 0;

    // Custom tick formatter for Y-axis
    const CustomYAxisTick = (props: any) => {
      const { x, y, payload } = props;
      const isAverage = Math.abs(payload.value - averageWeight) < 0.1; // Check if this tick is close to average

      return (
        <text
          x={x}
          y={y}
          dy={4}
          textAnchor="end"
          fill={isAverage ? '#14b8a6' : 'currentColor'}
          className={isAverage ? 'font-medium' : ''}
        >
          {payload.value}
        </text>
      );
    };

    // Calculate domain and ticks
    const minWeight = Math.min(...validWeights);
    const maxWeight = Math.max(...validWeights);
    const yAxisTicks = generateYAxisTicks(minWeight, maxWeight, averageWeight);

    return (
      <div className="lg:col-span-2 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
        <h3
          className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
        >
          Weight History
        </h3>
        <div
          className={`transition-opacity duration-200 ${
            isLoadingCharts ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ bottom: 50 }}>
              <defs>
                <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={60}
                interval={tickInterval}
                tick={{ dy: 10, fontSize: 12 }}
              />
              <YAxis
                domain={[minWeight - 0.5, maxWeight + 0.5]}
                tick={<CustomYAxisTick />}
                ticks={yAxisTicks}
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
                          Weight:{' '}
                          {typeof payload[0].value === 'number'
                            ? payload[0].value.toFixed(1)
                            : payload[0].value}{' '}
                          kg
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Average: {averageWeight} kg
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="weight"
                stroke="#14b8a6"
                fill="url(#weightGradient)"
                name="Weight (kg)"
                strokeWidth={3}
              />
              <ReferenceLine
                y={averageWeight}
                stroke="#14b8a6"
                strokeDasharray="3 3"
                label={{
                  value: `Avg: ${averageWeight} kg`,
                  position: 'right',
                  fill: '#14b8a6',
                  fontSize: 12,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {isLoadingCharts && <ChartLoadingOverlay color="teal" />}
      </div>
    );
  };

  const WeightAnalytics = ({ data }: { data: any[] }) => {
    const validData = data.filter((entry) => entry.weight !== null);

    if (validData.length === 0) {
      return (
        <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <h3
            className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
          >
            Weight Analytics
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            No weight data available for this period.
          </p>
        </div>
      );
    }

    const average =
      validData.reduce((acc, curr) => acc + curr.weight, 0) / validData.length;
    const min = Math.min(...validData.map((d) => d.weight));
    const max = Math.max(...validData.map((d) => d.weight));
    const firstReading = validData[validData.length - 1].weight;
    const lastReading = validData[0].weight;
    const trend = lastReading - firstReading;

    return (
      <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
        <h3
          className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
        >
          Weight Analytics
        </h3>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {average.toFixed(1)}{' '}
              <span className="text-sm font-normal text-slate-500">kg</span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Average Weight
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {min.toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-500">kg</span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Lowest
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {max.toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-500">kg</span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Highest
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Period Trend
              </span>
              <div
                className={`flex items-center gap-1 text-sm ${
                  trend > 0
                    ? 'text-red-500'
                    : trend < 0
                    ? 'text-green-500'
                    : 'text-slate-500'
                }`}
              >
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
                {Math.abs(trend).toFixed(1)} kg
              </div>
            </div>
          </div>
        </div>
      </div>
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

  const analyzeSleepData = (entry: DayEntry): SleepAnalysis => {
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
    todayEntry: DayEntry,
    recentEntries: DayEntry[]
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

  const SleepAnalysisCard = ({ entry }: { entry: DayEntry }) => {
    // If no entry is provided, show the prompt message
    if (!entry) {
      return (
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <div className="mb-4">
              <svg
                className="w-12 h-12 text-purple-500 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No Sleep Data for Today
            </h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-md">
              Track your sleep by logging today's data using the form above.
              Regular tracking helps you understand your sleep patterns better.
            </p>
          </div>
        </div>
      );
    }

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
        <div className="h-6 w-full sm:w-48 md:w-64 lg:w-96 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
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
          <div className="flex flex-col">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 opacity-50 mb-2">
              Today's Sleep Analysis (
              {format(new Date(entry.date), 'MMM do yyyy')})
            </h2>
            <p className="text-2xl font-medium text-slate-900 dark:text-slate-100">
              {entry.sleepTime} - {entry.wakeTime}
            </p>
          </div>
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
                    // Update the layout to be more responsive
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {insight.text.split(':')[0]}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {formatPercentage(insight.metric.value)}
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
    // Round to 1 decimal place and remove trailing .0 if present
    const formatted = Number(value.toFixed(1));
    return formatted + '%';
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

  const StepsChart = ({ data }: { data: any[] }) => {
    const tickInterval = getTickInterval(data.length);

    // Calculate average steps for the period
    const validSteps = data
      .filter((entry) => entry.steps !== null)
      .map((entry) => entry.steps);
    const averageSteps =
      validSteps.length > 0
        ? Math.round(
            validSteps.reduce((acc, curr) => acc + curr, 0) / validSteps.length
          )
        : 0;

    return (
      <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
        <h3
          className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
        >
          Daily Steps
        </h3>
        <div
          className={`transition-opacity duration-200 ${
            isLoadingCharts ? 'opacity-50' : 'opacity-100'
          }`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ bottom: 50 }}>
              <defs>
                <linearGradient id="stepsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                angle={-45}
                textAnchor="end"
                height={60}
                interval={tickInterval}
                tick={{ dy: 10, fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {label}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Steps: {payload[0].value?.toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Average: {averageSteps.toLocaleString()}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="steps"
                stroke="#eab308"
                fill="url(#stepsGradient)"
                name="Steps"
                strokeWidth={3}
              />
              {/* Add ReferenceLine for average */}
              <ReferenceLine
                y={averageSteps}
                stroke="#eab308"
                strokeDasharray="3 3"
                label={{
                  value: `Avg: ${averageSteps.toLocaleString()}`,
                  position: 'right',
                  fill: '#eab308',
                  fontSize: 12,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {isLoadingCharts && <ChartLoadingOverlay color="yellow" />}
      </div>
    );
  };

  const StepsAnalytics = ({ data }: { data: any[] }) => {
    // Filter out null values
    const validData = data.filter((entry) => entry.steps !== null);

    if (validData.length === 0) {
      return (
        <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
          <h3
            className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
          >
            Steps Analytics
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            No steps data available for this period.
          </p>
        </div>
      );
    }

    const average = Math.round(
      validData.reduce((acc, curr) => acc + curr.steps, 0) / validData.length
    );
    const min = Math.min(...validData.map((d) => d.steps));
    const max = Math.max(...validData.map((d) => d.steps));

    // Calculate trend (comparing first and last valid readings)
    const firstReading = validData[validData.length - 1].steps;
    const lastReading = validData[0].steps;
    const trend = lastReading - firstReading;

    // Calculate variability (standard deviation)
    const meanSquaredDiff =
      validData.reduce(
        (acc, curr) => acc + Math.pow(curr.steps - average, 2),
        0
      ) / validData.length;
    const standardDeviation = Math.round(Math.sqrt(meanSquaredDiff));

    return (
      <div className="lg:col-span-1 bg-white/50 dark:bg-slate-900/50 backdrop-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800">
        <h3
          className={`text-lg font-medium mb-4 text-slate-900 dark:text-slate-100 ${outfit.className}`}
        >
          Steps Analytics
        </h3>
        <div className="space-y-4">
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {average.toLocaleString()}{' '}
              <span className="text-sm font-normal text-slate-500">steps</span>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Average Daily Steps
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {min.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">
                  steps
                </span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Lowest
              </div>
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {max.toLocaleString()}{' '}
                <span className="text-xs font-normal text-slate-500">
                  steps
                </span>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Highest
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Period Trend
              </span>
              <div
                className={`flex items-center gap-1 text-sm ${
                  trend > 0
                    ? 'text-green-500'
                    : trend < 0
                    ? 'text-red-500'
                    : 'text-slate-500'
                }`}
              >
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
                {Math.abs(trend).toLocaleString()} steps
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Variability
              </span>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                ±{standardDeviation.toLocaleString()} steps
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const formatDuration = (hours: number | null) => {
    if (!hours) return '0h 0m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const SleepCompositionChart = ({ data }: { data: any[] }) => {
    const [showAwakeTime, setShowAwakeTime] = useState(true);

    return (
      <div className="lg:col-span-3 bg-white/50 dark:bg-slate-900/50 backdrop-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative mb-8">
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
              data={data.map((entry) => {
                const totalSleepHours = entry.totalSleep;
                return {
                  ...entry,
                  deepSleepHours: (totalSleepHours * entry.deepSleep) / 100,
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
    );
  };

  const ExerciseProgressChart = ({ data }: { data: any[] }) => {
    const [selectedExercise, setSelectedExercise] = useState<string>('');

    // Get unique exercises from all logs
    const exercises = useMemo(() => {
      if (!data || !Array.isArray(data)) return [];

      const exerciseSet = new Set<string>();
      data.forEach((log) => {
        if (log.exercise_log) {
          Object.keys(log.exercise_log).forEach((exercise) => {
            exerciseSet.add(exercise);
          });
        }
      });
      return Array.from(exerciseSet);
    }, [data]);

    // Prepare data for the selected exercise
    const chartData = useMemo(() => {
      if (!selectedExercise) return [];

      return data
        .filter((log) => log.exercise_log[selectedExercise])
        .map((log) => {
          const exerciseData = log.exercise_log[selectedExercise];
          const maxWeight = Math.max(
            ...exerciseData.sets.map((set: any) => set.weight)
          );
          const totalVolume = exerciseData.sets.reduce(
            (acc: number, set: any) => {
              return acc + set.weight * set.reps;
            },
            0
          );

          return {
            date: new Date(log.date).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            }),
            maxWeight,
            totalVolume,
            sets: exerciseData.sets,
          };
        });
    }, [data, selectedExercise]);

    return (
      <div className="lg:col-span-4 bg-white/50 dark:bg-slate-900/50 backdrop-sm rounded-lg p-4 border border-slate-200 dark:border-slate-800 relative">
        <div className="flex items-center justify-between mb-4">
          <h3
            className={`text-lg font-medium text-slate-900 dark:text-slate-100 ${outfit.className}`}
          >
            Exercise Progress
          </h3>
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-1 text-sm"
          >
            <option value="">Select Exercise</option>
            {exercises.map((exercise) => (
              <option key={exercise} value={exercise}>
                {exercise
                  .replace(/_/g, ' ')
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {selectedExercise && (
          <div
            className={`transition-opacity duration-200 ${
              isLoadingCharts ? 'opacity-50' : 'opacity-100'
            }`}
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ bottom: 50 }}>
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
                  yAxisId="weight"
                  label={{
                    value: 'Weight (kg)',
                    angle: -90,
                    position: 'insideLeft',
                  }}
                />
                <YAxis
                  yAxisId="volume"
                  orientation="right"
                  label={{
                    value: 'Volume (kg)',
                    angle: 90,
                    position: 'insideRight',
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                          <p className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                            {label}
                          </p>
                          <div className="space-y-1">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Max Weight: {data.maxWeight}kg
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Total Volume: {data.totalVolume}kg
                            </p>
                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                              {data.sets.map((set: any, index: number) => (
                                <p
                                  key={index}
                                  className="text-sm text-slate-600 dark:text-slate-400"
                                >
                                  Set {set.order}: {set.weight}kg × {set.reps}{' '}
                                  reps
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  yAxisId="weight"
                  dataKey="maxWeight"
                  fill="#a855f7"
                  name="Max Weight"
                />
                <Line
                  yAxisId="volume"
                  type="monotone"
                  dataKey="totalVolume"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ fill: '#14b8a6' }}
                  name="Total Volume"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  const handleGymSubmit = async () => {
    if (!sessionType || selectedExercises.length === 0) return;
    setIsSubmittingGym(true);

    // Get the selected date or default to today
    const selectedDate = gymDate || new Date().toISOString().split('T')[0];

    // Transform exercises into the required format
    const exerciseLog = selectedExercises.reduce((acc, exercise, index) => {
      const exerciseName = exercise.name.toLowerCase().replace(/\s+/g, '_');
      acc[exerciseName] = {
        order: index + 1,
        sets: exercise.sets.map((set, setIndex) => ({
          reps: set.reps,
          weight: set.weight,
          order: setIndex + 1,
        })),
      };
      return acc as { [key: string]: any };
    }, {} as { [key: string]: any });

    try {
      const endpoint = '/api/supabase/exercises';
      const method = editingWorkout ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingWorkout?.id, // Include ID if editing
          type: sessionType,
          date: selectedDate,
          exercise_log: exerciseLog,
          notes: notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save gym session');

      // Reset form
      setShowGymForm(false);
      setSessionType('' as GymSessionType);
      setSelectedExercises([]);
      setNotes('');
      setGymDate(null);
      setEditingWorkout(null);
    } catch (error) {
      console.error('Failed to save gym session:', error);
    } finally {
      setIsSubmittingGym(false);
    }
  };

  // Add function to handle editing a workout
  const handleEditWorkout = (workout: any) => {
    setEditingWorkout(workout);
    setShowGymForm(true);
    setSessionType(workout.type);
    setGymDate(workout.date);
    setNotes(workout.notes || '');

    // Transform exercise_log back into selectedExercises format
    const exercises = Object.entries(workout.exercise_log).map(
      ([name, data]: [string, any]) => ({
        name: name
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        primaryMuscle:
          findExerciseInLibrary(name)?.primaryMuscle ||
          ('shoulders_and_arms' as MuscleGroup),
        sets: data.sets.map((set: any) => ({
          reps: set.reps,
          weight: set.weight,
        })),
      })
    );
    setSelectedExercises(exercises);
  };

  // Create a sortable exercise component
  const SortableExercise = ({
    exercise,
    index,
    isCollapsed,
    onToggle,
    children,
  }: {
    exercise: { name: string; sets: Array<{ reps: number; weight: number }> };
    index: number;
    isCollapsed: boolean;
    onToggle: (index: number) => void;
    children?: React.ReactNode;
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: exercise.name });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 1 : 0,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`border rounded-lg p-4 dark:border-slate-700 ${
          isDragging ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div
            {...attributes}
            {...listeners}
            className="flex items-center gap-2 cursor-move"
          >
            <GripVertical className="h-4 w-4 text-slate-400" />
            <h3 className="text-lg font-medium">{exercise.name}</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onToggle(index)}>
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>

        {!isCollapsed && <div className="mt-4">{children}</div>}
      </div>
    );
  };

  // Update the exercises container
  const ExercisesGrid = ({
    selectedExercises,
    setSelectedExercises,
    handleSetChange,
    handleRemoveSet,
    ...props
  }: {
    selectedExercises: Array<{
      name: string;
      sets: Array<{ reps: number; weight: number }>;
    }>;
    setSelectedExercises: React.Dispatch<
      React.SetStateAction<typeof selectedExercises>
    >;
    handleSetChange: (
      exerciseIndex: number,
      setIndex: number,
      field: 'reps' | 'weight',
      value: number
    ) => void;
    handleRemoveSet: (exerciseIndex: number, setIndex: number) => void;
    collapsedExercises: Set<number>;
    onToggleExercise: (index: number) => void;
  }) => {
    const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;

      if (active.id !== over?.id && over) {
        setSelectedExercises((exercises) => {
          const oldIndex = exercises.findIndex((e) => e.name === active.id);
          const newIndex = exercises.findIndex((e) => e.name === over.id);

          return arrayMove(exercises, oldIndex, newIndex);
        });
      }
    };

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SortableContext
            items={selectedExercises.map((e) => e.name)}
            strategy={verticalListSortingStrategy}
          >
            {selectedExercises.map((exercise, index) => (
              <SortableExercise
                key={exercise.name}
                exercise={exercise}
                index={index}
                isCollapsed={props.collapsedExercises.has(index)}
                onToggle={props.onToggleExercise}
              >
                {/* Existing exercise sets content */}
                {exercise.sets.map((set, setIndex) => (
                  // ... existing set inputs
                  <div key={setIndex}>
                    <input
                      type="number"
                      value={set.reps}
                      onChange={(e) =>
                        handleSetChange(
                          index,
                          setIndex,
                          'reps',
                          parseInt(e.target.value)
                        )
                      }
                    />
                    <input
                      type="number"
                      value={set.weight}
                      onChange={(e) =>
                        handleSetChange(
                          index,
                          setIndex,
                          'weight',
                          parseInt(e.target.value)
                        )
                      }
                    />
                    <button onClick={() => handleRemoveSet(index, setIndex)}>
                      Remove
                    </button>
                  </div>
                ))}
              </SortableExercise>
            ))}
          </SortableContext>
        </div>
      </DndContext>
    );
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
  ):
    | Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles'>
    | undefined => {
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

  // Add this new component before ExerciseAnalysis
  const MuscleGroupAnalysis = ({ gymSessions }: { gymSessions: any[] }) => {
    const [expandedCategories, setExpandedCategories] = useState<string[]>(['all']);
    
    // Group muscles by category
    const muscleCategories = {
      back: {
        label: 'Back',
        muscles: ['lats', 'traps', 'rhomboids', 'lower_back'],
      },
      legs: {
        label: 'Legs',
        muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors'],
      },
      chest: {
        label: 'Chest',
        muscles: ['upper_chest', 'mid_chest', 'lower_chest'],
      },
      shoulders: {
        label: 'Shoulders',
        muscles: ['front_delts', 'side_delts', 'rear_delts'],
      },
      arms: {
        label: 'Arms',
        muscles: ['biceps', 'triceps', 'forearms'],
      },
      core: {
        label: 'Core',
        muscles: ['rectus_abdominis', 'obliques', 'transverse_abdominis'],
      },
    };

    // Calculate weekly sets per muscle group
    const muscleGroupStats = useMemo(() => {
      const stats = new Map<MuscleGroup, { sets: number; volume: number }>();
      
      // Get sessions from the last 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const weeklyGymSessions = gymSessions.filter(session => 
        new Date(session.date) >= oneWeekAgo
      );

      weeklyGymSessions.forEach(session => {
        Object.entries(session.exercise_log).forEach(([exerciseName, data]: [string, any]) => {
          const exercise = findExerciseInLibrary(exerciseName);
          if (!exercise) return;

          // Count sets for primary muscle
          const primaryStats = stats.get(exercise.primaryMuscle) || { sets: 0, volume: 0 };
          stats.set(exercise.primaryMuscle, {
            sets: primaryStats.sets + data.sets.length,
            volume: primaryStats.volume + data.sets.reduce((acc: number, set: any) => 
              acc + (set.weight * set.reps), 0
            )
          });

          // Count half sets for secondary muscles
          exercise.secondaryMuscles?.forEach(muscle => {
            const secondaryStats = stats.get(muscle) || { sets: 0, volume: 0 };
            stats.set(muscle, {
              sets: secondaryStats.sets + Math.ceil(data.sets.length * 0.5),
              volume: secondaryStats.volume + (data.sets.reduce((acc: number, set: any) => 
                acc + (set.weight * set.reps), 0) * 0.5
              )
            });
          });
        });
      });

      return stats;
    }, [gymSessions]);

    // Define recommended weekly sets per muscle group
    const recommendedSets: Record<MuscleGroup, number> = {
      // Back muscles
      lats: 10,
      traps: 8,
      rhomboids: 8,
      lower_back: 6,
      
      // Leg muscles
      quadriceps: 12,
      hamstrings: 10,
      glutes: 10,
      calves: 8,
      adductors: 6,
      
      // Chest muscles
      upper_chest: 8,
      mid_chest: 8,
      lower_chest: 6,
      
      // Shoulder muscles
      front_delts: 6,
      side_delts: 8,
      rear_delts: 8,
      
      // Arm muscles
      biceps: 10,
      triceps: 10,
      forearms: 6,
      
      // Core muscles
      rectus_abdominis: 8,
      obliques: 6,
      transverse_abdominis: 6,
      
      // Other
      cardio: 0
    };

    const toggleCategory = (category: string) => {
      setExpandedCategories(prev => 
        prev.includes(category)
          ? prev.filter(c => c !== category)
          : [...prev, category]
      );
    };

    return (
      <div className="space-y-4 mb-8">
        {Object.entries(muscleCategories).map(([category, { label, muscles }]) => (
          <div key={category} className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg border border-slate-200 dark:border-slate-800">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <h3 className={`text-lg font-medium text-slate-900 dark:text-slate-100 ${outfit.className}`}>
                {label}
              </h3>
              <ChevronDown 
                className={`w-5 h-5 text-slate-500 transition-transform ${
                  expandedCategories.includes(category) ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Muscle Groups Grid */}
            {expandedCategories.includes(category) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border-t border-slate-200 dark:border-slate-700">
                {muscles.map((muscle) => {
                  const stats = muscleGroupStats.get(muscle as MuscleGroup) || { sets: 0, volume: 0 };
                  const recommended = recommendedSets[muscle as MuscleGroup];
                  const percentage = Math.min((stats.sets / recommended) * 100, 100);

                  return (
                    <div 
                      key={muscle}
                      className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
                      id={muscle}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-slate-900 dark:text-slate-100 capitalize">
                          {muscle.replace(/_/g, ' ')}
                        </h4>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {stats.sets}/{recommended} sets
                        </span>
                      </div>
                      
                      <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
                            percentage >= 100 
                              ? 'bg-green-500' 
                              : percentage >= 75 
                                ? 'bg-blue-500'
                                : percentage >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                        <div className="flex justify-between items-center">
                          <span>Weekly Volume:</span>
                          <span className="font-medium">
                            {Math.round(stats.volume).toLocaleString()} kg
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
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
                    <SleepAnalysisCard entry={todayEntry} />
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
                <RHRChart data={prepareChartData()} />
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
              <StepsAnalytics data={prepareChartData()} />
              <div className="lg:col-span-3 relative">
                <StepsChart data={prepareChartData()} />
              </div>
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
              <WeightChart data={prepareChartData()} />
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
