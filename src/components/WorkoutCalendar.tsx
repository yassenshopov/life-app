'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Calendar,
  BarChart2,
  Dumbbell as DumbbellIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  EXERCISE_LIBRARY,
  GymSessionType,
  Exercise,
} from '@/constants/exercises';
import { MuscleGroup } from '@/constants/muscle-groups';
import { WorkoutEvent, WorkoutExercise } from '@/types/workout';
import { formatGymType } from '@/lib/utils';
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Link from 'next/link';

interface WorkoutCalendarProps {
  onLoadingChange: (loading: boolean) => void;
  showGymForm: boolean;
  setShowGymForm: (show: boolean) => void;
  onMuscleClick?: (muscle: MuscleGroup) => void;
}

// Add type for activity data
type ActivityData = {
  type: 'run' | 'gym';
  title: string;
  details: {
    distance?: number;
    duration?: number;
    pace?: number;
    exercises?: Record<string, any>;
    notes?: string;
  };
};

export const WorkoutCalendar = ({
  onLoadingChange,
  showGymForm,
  setShowGymForm,
  onMuscleClick,
}: WorkoutCalendarProps) => {
  // Consolidate date-related state
  const [calendarState, setCalendarState] = useState({
    currentDate: new Date(),
    selectedDate: new Date(new Date().setHours(0, 0, 0, 0)),
    gymDate: null as string | null,
  });

  // Consolidate data-related state
  const [workoutData, setWorkoutData] = useState({
    workouts: [] as WorkoutEvent[],
    gymSessions: [] as any[],
    isLoading: true,
  });

  // Consolidate form-related state
  const [formState, setFormState] = useState({
    sessionType: '' as GymSessionType,
    selectedExercises: [] as WorkoutExercise[],
    exerciseSearch: '',
    notes: '',
    isSubmittingGym: false,
    editingWorkout: null as any,
    gymDate: null as string | null,
  });

  // Memoize collapsed exercises set
  const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(
    new Set()
  );

  // Memoize data fetching
  const fetchWorkoutData = useCallback(async () => {
    try {
      const [runsResponse, gymResponse] = await Promise.all([
        fetch(`/api/notion/running`),
        fetch(`/api/supabase/exercises`),
      ]);

      const [runs, gymData] = await Promise.all([
        runsResponse.json(),
        gymResponse.json(),
      ]);

      const formattedRuns = formatRunData(runs);
      
      // Ensure gymData is an array
      const formattedGymData = Array.isArray(gymData) ? gymData : [];

      setWorkoutData((prev) => ({
        ...prev,
        workouts: formattedRuns,
        gymSessions: formattedGymData,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error fetching data:', error);
      setWorkoutData((prev) => ({ 
        ...prev, 
        workouts: [],
        gymSessions: [],
        isLoading: false 
      }));
    }
  }, []);

  // Memoize exercise library lookup
  const findExerciseInLibrary = useCallback((name: string) => {
    for (const [_, exercises] of Object.entries(EXERCISE_LIBRARY)) {
      const exercise = exercises.find(
        (e) => e.name.toLowerCase() === name.replace(/_/g, ' ')
      );
      if (exercise) {
        return {
          primaryMuscle: exercise.primaryMuscle,
          secondaryMuscles: exercise.secondaryMuscles,
        };
      }
    }
    return undefined;
  }, []);

  // Memoize volume calculations
  const calculateVolumeChange = useCallback((current: any, previous: any) => {
    const getVolume = (session: any) =>
      Object.values(session.exercise_log).reduce(
        (acc: number, exercise: any) =>
          acc +
          exercise.sets.reduce(
            (setAcc: number, set: any) => setAcc + set.reps * set.weight,
            0
          ),
        0
      );

    const currentVolume = getVolume(current);
    const previousVolume = getVolume(previous);
    const difference = currentVolume - previousVolume;
    const percentage = ((difference / previousVolume) * 100).toFixed(1);

    return `${difference >= 0 ? '+' : ''}${percentage}%`;
  }, []);

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
    fetchWorkoutData();
  }, [fetchWorkoutData]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    // Convert Sunday (0) to 6, and shift other days back by 1
    return day === 0 ? 6 : day - 1;
  };

  const handlePreviousMonth = () => {
    setCalendarState((prev) => ({
      ...prev,
      currentDate: new Date(
        prev.currentDate.getFullYear(),
        prev.currentDate.getMonth() - 1
      ),
    }));
  };

  const handleNextMonth = () => {
    setCalendarState((prev) => ({
      ...prev,
      currentDate: new Date(
        prev.currentDate.getFullYear(),
        prev.currentDate.getMonth() + 1
      ),
    }));
  };

  const monthYear = calendarState.currentDate.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
  const daysInMonth = getDaysInMonth(calendarState.currentDate);
  const firstDayOfMonth = getFirstDayOfMonth(calendarState.currentDate);

  const handleGymSubmit = async () => {
    if (!formState.sessionType || formState.selectedExercises.length === 0)
      return;
    setFormState((prev) => ({ ...prev, isSubmittingGym: true }));

    // Get the selected date or default to today
    const selectedDate =
      formState.gymDate || new Date().toISOString().split('T')[0];

    // Transform exercises into the required format
    const exerciseLog = formState.selectedExercises.reduce(
      (acc, exercise, index) => {
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
      },
      {} as { [key: string]: any }
    );

    try {
      const endpoint = '/api/supabase/exercises';
      const method = formState.editingWorkout ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formState.editingWorkout?.id, // Include ID if editing
          type: formState.sessionType,
          date: selectedDate,
          exercise_log: exerciseLog,
          notes: formState.notes || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to save gym session');

      // Reset form
      setShowGymForm(false);
      setFormState((prev) => ({
        ...prev,
        sessionType: '' as GymSessionType,
        selectedExercises: [],
        notes: '',
        gymDate: null,
        editingWorkout: null,
      }));
    } catch (error) {
      console.error('Failed to save gym session:', error);
    } finally {
      setFormState((prev) => ({ ...prev, isSubmittingGym: false }));
    }
  };

  // Add function to handle editing a workout
  const handleEditWorkout = (workout: any) => {
    // Add validation to ensure workout exists and has required data
    if (!workout) {
      console.warn('No workout data provided');
      return;
    }

    // Ensure exercise_log exists and is an object
    const exerciseLog = workout.exercise_log || {};
    if (typeof exerciseLog !== 'object') {
      console.error('Invalid exercise log format');
      return;
    }

    setFormState((prev) => ({
      ...prev,
      editingWorkout: workout,
      sessionType: workout.type || '',
      gymDate: workout.date || null,
      notes: workout.notes || '',
      selectedExercises: Object.entries(exerciseLog).map(
        ([name, data]: [string, any]) => {
          // Validate exercise data
          const exerciseData = data || {};
          const sets = Array.isArray(exerciseData.sets) ? exerciseData.sets : [];
          
          return {
            name: name
              .split('_')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' '),
            primaryMuscle: (findExerciseInLibrary(name)?.primaryMuscle || 'full_body') as MuscleGroup,
            sets: sets.map((set: any) => ({
              reps: Number(set?.reps) || 0,
              weight: Number(set?.weight) || 0,
            })),
          };
        }
      ),
    }));

    setShowGymForm(true);
  };

  const compareExerciseCount = (current: any, previous: any) => {
    const currentCount = Object.keys(current.exercise_log).length;
    const previousCount = Object.keys(previous.exercise_log).length;
    const difference = currentCount - previousCount;

    return difference === 0
      ? 'Same'
      : `${difference > 0 ? '+' : ''}${difference}`;
  };

  const handleDayClick = (date: Date) => {
    setCalendarState((prev) => ({ ...prev, selectedDate: date }));
  };

  // Helper function to format run data
  const formatRunData = (runs: any[]): WorkoutEvent[] =>
    runs.map((run) => ({
      id: run.id,
      // Create date with timezone offset adjustment
      date: new Date(run.date + 'T00:00:00').toISOString().split('T')[0],
      type: 'run' as const,
      title: run.name,
      distance: run.distance,
      duration: run.duration,
      pace: run.pace,
      notes: run.notes,
    }));

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
              calendarState.currentDate.getFullYear(),
              calendarState.currentDate.getMonth(),
              day
            );
            const dateString = currentMonthDate.toISOString().split('T')[0];
            const workoutsForDay = workoutData.workouts.filter(
              (event) => event.date === dateString
            );
            const gymSessionsForDay = workoutData.gymSessions.filter(
              (session) => {
                const sessionDate = new Date(session.date + 'T00:00:00')
                  .toISOString()
                  .split('T')[0];
                return sessionDate === dateString;
              }
            );
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
                  exercises: session.exercise_log,
                  notes: session.notes,
                },
              })),
            ];

            return (
              <TooltipProvider key={day}>
                <TooltipUI delayDuration={200}>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => handleDayClick(currentMonthDate)}
                      className={`aspect-square p-2 border border-slate-200 dark:border-slate-700 rounded-lg relative ${
                        isToday
                          ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                          : ''
                      } ${
                        currentMonthDate.toDateString() ===
                        calendarState.selectedDate.toDateString()
                          ? 'ring-2 ring-purple-500 dark:ring-purple-400'
                          : ''
                      } cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors`}
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
                                    const formattedType = activity.title
                                      .toLowerCase()
                                      .replace(/\s*&\s*/g, '_and_')
                                      .replace(/\s+/g, '_');
                                    
                                    console.log('Looking for session with type:', formattedType);
                                    console.log('Available sessions:', gymSessionsForDay);
                                    
                                    let exerciseInfo: Exercise | undefined;
                                    for (const [_, exercises] of Object.entries(EXERCISE_LIBRARY)) {
                                      exerciseInfo = exercises.find((e: Exercise) => e.name === formattedType);
                                      if (exerciseInfo) break;
                                    }
                                    
                                    if (!exerciseInfo) {
                                      console.warn(`No matching gym session found for type: ${formattedType}`);
                                      return;
                                    }
                                    
                                    handleEditWorkout(exerciseInfo);
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
                    <TooltipContent className="p-4 space-y-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-xl shadow-lg min-w-[300px]">
                      {activitiesForDay.map((activity, index) => (
                        <div key={index} className="flex flex-col">
                          <div className="flex items-center gap-2 mb-3">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                activity.type === 'run'
                                  ? 'bg-orange-500/80'
                                  : activity.type === 'gym'
                                  ? 'bg-purple-500/80'
                                  : 'bg-blue-500/80'
                              }`}
                            />
                            <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                              {activity.type === 'gym'
                                ? formatGymType(activity.title)
                                : activity.title}
                            </span>
                          </div>

                          {activity.type === 'run' &&
                            'distance' in activity.details && (
                              <div className="space-y-2 pl-4">
                                {activity.details.distance && (
                                  <div className="grid grid-cols-[100px_1fr] text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">
                                      Distance:
                                    </span>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                      {activity.details.distance} km
                                    </span>
                                  </div>
                                )}
                                {activity.details.duration && (
                                  <div className="grid grid-cols-[100px_1fr] text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">
                                      Duration:
                                    </span>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                      {activity.details.duration} min
                                    </span>
                                  </div>
                                )}
                                {activity.details.pace && (
                                  <div className="grid grid-cols-[100px_1fr] text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">
                                      Pace:
                                    </span>
                                    <span className="font-medium text-slate-700 dark:text-slate-300">
                                      {activity.details.pace} min/km
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                          {activity.type === 'gym' &&
                            'exercises' in activity.details && (
                              <div className="pl-4">
                                <div className="space-y-2">
                                  {Object.entries(
                                    activity.details.exercises
                                  ).map(([name, data]: [string, any]) => (
                                    <div
                                      key={name}
                                      className="grid grid-cols-[1fr_80px] text-sm items-center"
                                    >
                                      <span className="text-slate-700 dark:text-slate-300">
                                        {name
                                          .split('_')
                                          .map(
                                            (word) =>
                                              word.charAt(0).toUpperCase() +
                                              word.slice(1)
                                          )
                                          .join(' ')}
                                      </span>
                                      <span className="text-slate-500 dark:text-slate-400 text-right">
                                        {data.sets?.length || 0} sets
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {activity.details?.notes && (
                                  <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                      Notes:
                                    </span>
                                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                                      {activity.details.notes}
                                    </p>
                                  </div>
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
            {calendarState.selectedDate.toDateString() ===
            new Date().toDateString()
              ? "Today's Activity"
              : `Activity for ${calendarState.selectedDate.toLocaleDateString(
                  'default',
                  {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }
                )}`}
          </h3>
          {workoutData.workouts.some(
            (event) => {
              const eventDate = new Date(event.date).toISOString().split('T')[0];
              const selectedDate = calendarState.selectedDate.toISOString().split('T')[0];
              return eventDate === selectedDate;
            }
          ) ||
          workoutData.gymSessions.some(
            (session) => {
              const sessionDate = new Date(session.date + 'T00:00:00').toISOString().split('T')[0];
              const selectedDate = calendarState.selectedDate.toISOString().split('T')[0];
              return sessionDate === selectedDate;
            }
          ) ? (
            <div className="space-y-6">
              {/* Activities List */}
              {[
                ...workoutData.workouts.map((w) => ({ ...w, activityType: 'run' })),
                ...workoutData.gymSessions.map((g) => ({ ...g, activityType: 'gym' })),
              ]
                .filter((activity) => {
                  const activityDate = activity.activityType === 'gym' 
                    ? new Date(activity.date + 'T00:00:00').toISOString().split('T')[0]
                    : new Date(activity.date).toISOString().split('T')[0];
                  const selectedDate = calendarState.selectedDate.toISOString().split('T')[0];
                  return activityDate === selectedDate;
                })
                .map((activity, index) => {
                  const isGymSession = activity.activityType === 'gym';
                  const isRun = activity.activityType === 'run';

                  const previousSession = isGymSession
                    ? workoutData.gymSessions
                        .filter(
                          (s) =>
                            new Date(s.date) < new Date(activity.date)
                        )
                        .sort(
                          (a, b) =>
                            new Date(b.date).getTime() -
                            new Date(a.date).getTime()
                        )[0]
                    : null;

                  const previousRun = isRun
                    ? workoutData.workouts
                        .filter(
                          (w) =>
                            new Date(w.date) < new Date(activity.date)
                        )
                        .sort(
                          (a, b) =>
                            new Date(b.date).getTime() -
                            new Date(a.date).getTime()
                        )[0]
                    : null;

                  return (
                    <div
                      key={index}
                      className="pb-4 border-b border-slate-200 dark:border-slate-700 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isGymSession ? 'bg-purple-500' : 'bg-orange-500'
                          }`}
                        />
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {isGymSession
                            ? formatGymType(activity.type)
                            : activity.title}
                        </span>
                      </div>

                      {isRun ? (
                        <div className="space-y-3 pl-4">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="space-y-1">
                              <div className="text-slate-500 dark:text-slate-400">
                                Distance:
                              </div>
                              <div className="font-medium text-slate-700 dark:text-slate-200">
                                {activity.distance} km
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-slate-500 dark:text-slate-400">
                                Duration:
                              </div>
                              <div className="font-medium text-slate-700 dark:text-slate-200">
                                {activity.duration} min
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="text-slate-500 dark:text-slate-400">
                                Pace:
                              </div>
                              <div className="font-medium text-slate-700 dark:text-slate-200">
                                {activity.pace} min/km
                              </div>
                            </div>
                          </div>

                          {previousRun && (
                            <div className="mt-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                                Compared to last run (
                                {Math.floor(
                                  (new Date().getTime() -
                                    new Date(previousRun.date).getTime()) /
                                    (1000 * 60 * 60 * 24)
                                )}{' '}
                                days ago):
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="text-sm">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Distance:{' '}
                                  </span>
                                  <span
                                    className={`font-medium ${
                                      previousRun?.distance &&
                                      ((activity.distance -
                                        previousRun.distance) /
                                        previousRun.distance) *
                                        100 >=
                                        0
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}
                                  >
                                    {previousRun?.distance
                                      ? (
                                          ((activity.distance -
                                            previousRun.distance) /
                                            previousRun.distance) *
                                          100
                                        ).toFixed(1) + '%'
                                      : 'N/A'}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Pace:{' '}
                                  </span>
                                  <span
                                    className={`font-medium ${
                                      previousRun?.pace &&
                                      ((Number(previousRun.pace) -
                                        Number(activity.pace)) /
                                        Number(previousRun.pace)) *
                                        100 >=
                                        0
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}
                                  >
                                    {previousRun?.pace && activity.pace
                                      ? (
                                          ((Number(previousRun.pace) -
                                            Number(activity.pace)) /
                                            Number(previousRun.pace)) *
                                          100
                                        ).toFixed(1) + '%'
                                      : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3 pl-4">
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {Object.keys(activity.exercise_log).length}{' '}
                            exercises ·{' '}
                            {String(
                              (
                                Object.values(activity.exercise_log) as {
                                  sets: any[];
                                }[]
                              ).reduce(
                                (acc: number, curr: { sets: any[] }) =>
                                  acc + curr.sets.length,
                                0
                              )
                            )}{' '}
                            total sets
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from(
                              new Set(
                                Object.keys(activity.exercise_log)
                                  .map((name) => {
                                    const exercise =
                                      findExerciseInLibrary(name);
                                    return exercise?.primaryMuscle;
                                  })
                                  .filter(Boolean)
                              )
                            ).map((muscle, index) => (
                              <Link
                                key={index}
                                href={`#${muscle}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  const element = document.getElementById(
                                    muscle as string
                                  );
                                  element?.scrollIntoView({
                                    behavior: 'smooth',
                                  });
                                  if (onMuscleClick) {
                                    onMuscleClick(muscle as MuscleGroup);
                                  }
                                }}
                                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                              >
                                {muscle
                                  ?.split('_')
                                  .map(
                                    (word) =>
                                      word.charAt(0).toUpperCase() +
                                      word.slice(1)
                                  )
                                  .join(' ')}
                              </Link>
                            ))}
                          </div>

                          {previousSession && (
                            <div className="mt-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                                Compared to last {formatGymType(activity.type)}{' '}
                                workout (
                                {Math.floor(
                                  (new Date().getTime() -
                                    new Date(previousSession.date).getTime()) /
                                    (1000 * 60 * 60 * 24)
                                )}{' '}
                                days ago):
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="text-sm">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Total Volume:{' '}
                                  </span>
                                  <span
                                    className={`font-medium ${
                                      calculateVolumeChange(
                                        activity,
                                        previousSession
                                      ).startsWith('+')
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}
                                  >
                                    {calculateVolumeChange(
                                      activity,
                                      previousSession
                                    )}
                                  </span>
                                </div>
                                <div className="text-sm">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Exercise Count:{' '}
                                  </span>
                                  <span
                                    className={`font-medium ${
                                      compareExerciseCount(
                                        activity,
                                        previousSession
                                      ).startsWith('+')
                                        ? 'text-green-600 dark:text-green-400'
                                        : compareExerciseCount(
                                            activity,
                                            previousSession
                                          ) === 'Same'
                                        ? 'text-slate-600 dark:text-slate-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}
                                  >
                                    {compareExerciseCount(
                                      activity,
                                      previousSession
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No activities recorded for this date
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
                  {formState.editingWorkout
                    ? 'Edit Gym Session'
                    : 'Add Gym Session'}
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
                    value={
                      formState.gymDate ||
                      new Date().toISOString().split('T')[0]
                    }
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        gymDate: e.target.value,
                      }))
                    }
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
                    value={formState.sessionType}
                    onValueChange={(value) =>
                      setFormState((prev) => ({
                        ...prev,
                        sessionType: value as GymSessionType,
                      }))
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
                      value={formState.exerciseSearch}
                      onValueChange={(value) => {
                        if (value) {
                          setFormState((prev) => ({
                            ...prev,
                            selectedExercises: [
                              ...prev.selectedExercises,
                              {
                                name: value,
                                primaryMuscle:
                                  'shoulders_and_arms' as MuscleGroup, // Default value
                                sets: [{ reps: 0, weight: 0 }],
                              },
                            ],
                            exerciseSearch: '',
                          }));
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an exercise" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(EXERCISE_LIBRARY).map(([type, exercises]) => (
                          <div key={type} className="px-1 mb-2">
                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 px-2 py-1.5">
                              {formatGymType(type)}
                            </div>
                            {exercises.map((exercise: Exercise) => (
                              <SelectItem
                                key={exercise.name}
                                value={exercise.name}
                                className="flex items-center justify-between px-1 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                              >
                                <span className="text-sm text-slate-900 dark:text-slate-100 mr-0">
                                  {exercise.name}
                                </span>
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                  {exercise.primaryMuscle
                                    .split('_')
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(' ')}
                                </span>
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selected Exercises List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formState.selectedExercises.map((exercise, index) => (
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
                                    const newExercises = [
                                      ...formState.selectedExercises,
                                    ];
                                    newExercises[index].sets[setIndex].reps =
                                      Number(e.target.value);
                                    setFormState((prev) => ({
                                      ...prev,
                                      selectedExercises: newExercises,
                                    }));
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
                                    const newExercises = [
                                      ...formState.selectedExercises,
                                    ];
                                    newExercises[index].sets[setIndex].weight =
                                      Number(e.target.value);
                                    setFormState((prev) => ({
                                      ...prev,
                                      selectedExercises: newExercises,
                                    }));
                                  }}
                                />
                                <span className="text-sm text-slate-500">
                                  kg
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newExercises = [
                                      ...formState.selectedExercises,
                                    ];
                                    newExercises[index].sets.splice(
                                      setIndex,
                                      1
                                    );
                                    setFormState((prev) => ({
                                      ...prev,
                                      selectedExercises: newExercises,
                                    }));
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
                                const newExercises = [
                                  ...formState.selectedExercises,
                                ];
                                newExercises[index].sets.push({
                                  reps: 0,
                                  weight: 0,
                                });
                                setFormState((prev) => ({
                                  ...prev,
                                  selectedExercises: newExercises,
                                }));
                              }}
                            >
                              Add Set
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Add New+ card after the last exercise */}
                    {formState.selectedExercises.length > 0 && (
                      <div className="border border-dashed rounded-lg p-4 dark:border-slate-700 flex items-center justify-center">
                        <Select
                          value=""
                          onValueChange={(value) => {
                            if (value) {
                              // Find exercise info by searching through all exercise types
                              let exerciseInfo: Exercise | undefined;
                              for (const [_, exercises] of Object.entries(EXERCISE_LIBRARY)) {
                                exerciseInfo = exercises.find((e: Exercise) => e.name === value);
                                if (exerciseInfo) break;
                              }
                              
                              setFormState((prev) => ({
                                ...prev,
                                selectedExercises: [
                                  ...prev.selectedExercises,
                                  {
                                    name: value,
                                    primaryMuscle: (exerciseInfo?.primaryMuscle || 'full_body') as MuscleGroup,
                                    sets: [{ reps: 0, weight: 0 }],
                                  },
                                ],
                              }));
                            }
                          }}
                        >
                          <SelectTrigger>
                            New +
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(EXERCISE_LIBRARY).map(([type, exercises]) => (
                              <div key={type} className="px-1 mb-2">
                                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 px-2 py-1.5">
                                  {formatGymType(type)}
                                </div>
                                {exercises.map((exercise: Exercise) => (
                                  <SelectItem
                                    key={exercise.name}
                                    value={exercise.name}
                                    className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                                  >
                                    <span className="text-sm text-slate-900 dark:text-slate-100 mr-4">
                                      {exercise.name}
                                    </span>
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                      {exercise.primaryMuscle
                                        .split('_')
                                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                        .join(' ')}
                                    </span>
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
                    value={formState.notes}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
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
                      !formState.sessionType ||
                      formState.selectedExercises.length === 0 ||
                      formState.isSubmittingGym
                    }
                  >
                    {formState.isSubmittingGym ? (
                      <span className="flex items-center gap-2">
                        <LoadingSpinner size="sm" />
                        Saving...
                      </span>
                    ) : formState.editingWorkout ? (
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
