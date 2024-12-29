'use client';

import { useState, useEffect } from 'react';
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

export const WorkoutCalendar = ({
  showGymForm,
  setShowGymForm,
  onMuscleClick,
}: WorkoutCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workouts, setWorkouts] = useState<WorkoutEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gymSessions, setGymSessions] = useState<any[]>([]);

  const [sessionType, setSessionType] = useState<GymSessionType>('legs');
  const [selectedExercises, setSelectedExercises] = useState<WorkoutExercise[]>(
    []
  );
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

  const calculateVolumeChange = (current: any, previous: any) => {
    const getCurrentVolume = (session: any) => {
      return Object.values(session.exercise_log).reduce(
        (acc: number, exercise: any) => {
          return (
            acc +
            exercise.sets.reduce((setAcc: number, set: any) => {
              return setAcc + set.reps * set.weight;
            }, 0)
          );
        },
        0
      );
    };

    const currentVolume = getCurrentVolume(current);
    const previousVolume = getCurrentVolume(previous);
    const difference = currentVolume - previousVolume;
    const percentage = ((difference / previousVolume) * 100).toFixed(1);

    return `${difference >= 0 ? '+' : ''}${percentage}%`;
  };

  const compareExerciseCount = (current: any, previous: any) => {
    const currentCount = Object.keys(current.exercise_log).length;
    const previousCount = Object.keys(previous.exercise_log).length;
    const difference = currentCount - previousCount;

    return difference === 0
      ? 'Same'
      : `${difference > 0 ? '+' : ''}${difference}`;
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
            Today's Activity
          </h3>
          {workouts.some(
            (event) =>
              new Date(event.date).toDateString() === new Date().toDateString()
          ) ||
          gymSessions.some(
            (session) =>
              new Date(session.date).toDateString() ===
              new Date().toDateString()
          ) ? (
            <div className="space-y-6">
              {/* Today's Activities List */}
              {[...workouts, ...gymSessions]
                .filter(
                  (activity) =>
                    new Date(activity.date).toDateString() ===
                    new Date().toDateString()
                )
                .map((activity, index) => {
                  const isGymSession =
                    'type' in activity && activity.type !== 'run';
                  const previousSession = isGymSession
                    ? gymSessions
                        .filter(
                          (s) =>
                            s.type === activity.type &&
                            new Date(s.date) < new Date(activity.date)
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

                      {isGymSession ? (
                        <div className="space-y-3 pl-4">
                          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
                            <div>
                              {Object.keys(activity.exercise_log).length} exercises · {
                                String((Object.values(activity.exercise_log) as { sets: any[] }[]).reduce((acc: number, curr: { sets: any[] }) => 
                                  acc + curr.sets.length, 0
                                ))} total sets
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {Array.from(new Set(
                                Object.keys(activity.exercise_log)
                                  .map(name => {
                                    const exercise = findExerciseInLibrary(name);
                                    return exercise?.primaryMuscle;
                                  })
                                  .filter(Boolean)
                              )).map((muscle, index) => (
                                <Link 
                                  key={index}
                                  href={`#${muscle}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    const element = document.getElementById(muscle as string);
                                    element?.scrollIntoView({ behavior: 'smooth' });
                                    if (onMuscleClick) {
                                      onMuscleClick(muscle as MuscleGroup);
                                    }
                                  }}
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                >
                                  {muscle?.split('_')
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(' ')}
                                </Link>
                              ))}
                            </div>
                          </div>

                          {previousSession && (
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-3">
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                                Compared to last {formatGymType(activity.type)}{' '}
                                (
                                {new Date(
                                  previousSession.date
                                ).toLocaleDateString()}
                                ):
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Total Volume:{' '}
                                  </span>
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
                                    {calculateVolumeChange(
                                      activity,
                                      previousSession
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Exercise Count:{' '}
                                  </span>
                                  <span className="font-medium text-slate-700 dark:text-slate-200">
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
                      ) : (
                        <div className="space-y-2 pl-4">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">
                                Distance:{' '}
                              </span>
                              <span className="font-medium text-slate-700 dark:text-slate-200">
                                {activity.distance} km
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">
                                Pace:{' '}
                              </span>
                              <span className="font-medium text-slate-700 dark:text-slate-200">
                                {activity.pace} min/km
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No activities recorded today
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
                              primaryMuscle:
                                'shoulders_and_arms' as MuscleGroup, // Default value
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
