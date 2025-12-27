'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { X } from 'lucide-react';
import { EXERCISE_LIBRARY, GymSessionType, Exercise } from '@/constants/exercises';
import { MuscleGroup } from '@/constants/muscle-groups';
import { WorkoutEvent, WorkoutExercise } from '@/types/workout';
import { formatGymType } from '@/lib/utils';
import { ExerciseFormSection } from '@/components/workout/ExerciseFormSection';
import { CalendarHeader } from '@/components/workout/CalendarHeader';
import { CalendarDay } from '@/components/workout/CalendarDay';
import { WorkoutDetails } from '@/components/workout/WorkoutDetails';

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
  // Consolidate date-related state
  const [calendarState, setCalendarState] = useState({
    currentDate: new Date(),
    selectedDate: new Date(new Date().setHours(0, 0, 0, 0)),
    gymDate: null as string | null,
    view: 'month' as 'month' | 'week',
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
  const [collapsedExercises, setCollapsedExercises] = useState<Set<number>>(new Set());

  // Add near other state declarations
  const [userWeight, setUserWeight] = useState<number>(75); // Default to 75kg
  const [exerciseHistory, setExerciseHistory] = useState<
    Record<
      string,
      {
        date: Date;
        sets: { reps: number; weight: number }[];
      }
    >
  >({});

  // Add processExerciseHistory before fetchWorkoutData
  const processExerciseHistory = useCallback((gymSessions: any[]) => {
    const history: Record<string, { date: Date; sets: { reps: number; weight: number }[] }> = {};

    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedSessions = [...gymSessions]
      .filter((session) => new Date(session.date) < today) // Filter out today's sessions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sortedSessions.forEach((session) => {
      Object.entries(session.exercise_log || {}).forEach(([exerciseName, data]: [string, any]) => {
        const formattedName = exerciseName
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        // Only store if we haven't seen this exercise yet (first occurrence will be most recent)
        if (!history[formattedName]) {
          history[formattedName] = {
            date: new Date(session.date),
            sets: data.sets.map((set: any) => ({
              reps: Number(set.reps),
              weight: Number(set.weight),
            })),
          };
        }
      });
    });

    return history;
  }, []);

  // Memoize data fetching
  const fetchWorkoutData = useCallback(async () => {
    try {
      const [runsResponse, gymResponse] = await Promise.all([
        fetch(`/api/notion/running`),
        fetch(`/api/supabase/exercises`),
      ]);

      const [runs, gymData] = await Promise.all([runsResponse.json(), gymResponse.json()]);

      const formattedRuns = formatRunData(runs);
      const formattedGymData = Array.isArray(gymData) ? gymData : [];

      // Add this line to process exercise history
      const history = processExerciseHistory(formattedGymData);
      setExerciseHistory(history);

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
        isLoading: false,
      }));
    }
  }, [processExerciseHistory]);

  // Memoize exercise library lookup
  const findExerciseInLibrary = useCallback((name: string) => {
    for (const [_, exercises] of Object.entries(EXERCISE_LIBRARY)) {
      const exercise = exercises.find((e) => e.name.toLowerCase() === name.replace(/_/g, ' '));
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
          exercise.sets.reduce((setAcc: number, set: any) => setAcc + set.reps * set.weight, 0),
        0
      );

    const currentVolume = getVolume(current) as number;
    const previousVolume = getVolume(previous) as number;
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

  const getPreviousMonthDays = (date: Date) => {
    const firstDay = getFirstDayOfMonth(date);
    if (firstDay === 0) return [];

    const previousMonth = new Date(date.getFullYear(), date.getMonth() - 1);
    const daysInPreviousMonth = getDaysInMonth(previousMonth);

    return Array.from({ length: firstDay }, (_, i) => ({
      day: daysInPreviousMonth - firstDay + i + 1,
      month: 'previous',
    }));
  };

  const getNextMonthDays = (date: Date) => {
    const daysInMonth = getDaysInMonth(date);
    const firstDay = getFirstDayOfMonth(date);
    const remainingDays = 42 - (firstDay + daysInMonth); // 42 = 6 rows * 7 days

    return Array.from({ length: remainingDays }, (_, i) => ({
      day: i + 1,
      month: 'next',
    }));
  };

  const handlePreviousMonth = () => {
    setCalendarState((prev) => ({
      ...prev,
      currentDate: new Date(
        prev.currentDate.getFullYear(),
        prev.currentDate.getMonth() - (prev.view === 'month' ? 1 : 0),
        prev.view === 'week' ? prev.currentDate.getDate() - 7 : 1
      ),
    }));
  };

  const handleNextMonth = () => {
    setCalendarState((prev) => ({
      ...prev,
      currentDate: new Date(
        prev.currentDate.getFullYear(),
        prev.currentDate.getMonth() + (prev.view === 'month' ? 1 : 0),
        prev.view === 'week' ? prev.currentDate.getDate() + 7 : 1
      ),
    }));
  };

  const handleTodayClick = () => {
    const today = new Date();
    setCalendarState((prev) => ({
      ...prev,
      currentDate: today,
      selectedDate: new Date(today.setHours(0, 0, 0, 0)),
    }));
  };

  const daysInMonth = getDaysInMonth(calendarState.currentDate);

  const handleGymSubmit = async () => {
    if (!formState.sessionType || formState.selectedExercises.length === 0) return;
    setFormState((prev) => ({ ...prev, isSubmittingGym: true }));

    // Get the selected date or default to today
    const selectedDate = formState.gymDate || new Date().toISOString().split('T')[0];

    // Transform exercises into the required format
    const exerciseLog = formState.selectedExercises.reduce((acc, exercise, index) => {
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
      selectedExercises: Object.entries(exerciseLog).map(([name, data]: [string, any]) => {
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
      }),
    }));

    setShowGymForm(true);
  };

  const compareExerciseCount = (current: any, previous: any) => {
    const currentCount = Object.keys(current.exercise_log).length;
    const previousCount = Object.keys(previous.exercise_log).length;
    const difference = currentCount - previousCount;

    return difference === 0 ? 'Same' : `${difference > 0 ? '+' : ''}${difference}`;
  };

  const handleDayClick = (date: Date) => {
    const standardizedDate = new Date(date);
    standardizedDate.setHours(0, 0, 0, 0);
    setCalendarState((prev) => ({ ...prev, selectedDate: standardizedDate }));

    // If the gym form is shown, update the date
    if (showGymForm) {
      setFormState((prev) => ({
        ...prev,
        gymDate: standardizedDate.toISOString().split('T')[0],
      }));
    }
  };

  // Helper function to format run data
  const formatRunData = (runs: any[]): WorkoutEvent[] =>
    runs
      .map((run): WorkoutEvent | null => {
        try {
          // Ensure the date is valid before creating a new Date object
          const dateStr = run.date?.trim();
          if (!dateStr) {
            console.warn(`Invalid date for run: ${run.id}`);
            return null;
          }

          // Create date object and validate
          const date = new Date(`${dateStr}T00:00:00`);
          if (isNaN(date.getTime())) {
            console.warn(`Invalid date format for run: ${run.id}, date: ${dateStr}`);
            return null;
          }

          return {
            id: run.id,
            date: date.toISOString().split('T')[0],
            type: 'run' as const,
            title: run.name,
            distance: run.distance,
            duration: run.duration,
            pace: run.pace,
            notes: run.notes,
          };
        } catch (error) {
          console.warn(`Error processing run: ${run.id}`, error);
          return null;
        }
      })
      .filter((run): run is WorkoutEvent => run !== null);

  const getWeekDays = (date: Date) => {
    const curr = new Date(date);
    const firstDay = new Date(
      curr.setDate(curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1))
    );
    firstDay.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(firstDay);
      day.setDate(firstDay.getDate() + i);
      return day;
    });
  };

  // Add useRef at the top with other hooks
  const modalRef = useRef<HTMLDivElement>(null);

  // Add this function near other helper functions
  const findPreviousSessionExercises = useCallback(
    (type: GymSessionType, currentDate: string) => {
      if (!workoutData.gymSessions?.length) return null;

      // Find the most recent session of the same type before the current date
      const previousSession = [...workoutData.gymSessions]
        .filter((session) => session.type === type && session.date < currentDate)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (!previousSession?.exercise_log) return null;

      // Transform the exercise log back into our WorkoutExercise format
      return Object.entries(previousSession.exercise_log).map(([name, data]: [string, any]) => ({
        name: name
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        primaryMuscle: (findExerciseInLibrary(name)?.primaryMuscle || 'full_body') as MuscleGroup,
        sets: data.sets.map((set: any) => ({
          reps: Number(set.reps),
          weight: Number(set.weight),
        })),
      }));
    },
    [workoutData.gymSessions, findExerciseInLibrary]
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 max-w-7xl mx-auto">
      {/* Calendar Section - Left Side */}
      <div className="lg:col-span-5 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-2 sm:p-6 border border-slate-200 dark:border-slate-800">
        <CalendarHeader
          view={calendarState.view}
          currentDate={calendarState.currentDate}
          setView={(view) => setCalendarState((prev) => ({ ...prev, view }))}
          onTodayClick={handleTodayClick}
          onPreviousClick={handlePreviousMonth}
          onNextClick={handleNextMonth}
        />

        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {/* Day headers with responsive text */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              key={day}
              className="text-center text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 p-1 sm:p-2"
            >
              {/* Show shorter version on mobile */}
              <span className="sm:hidden">{day.slice(0, 1)}</span>
              <span className="hidden sm:inline">{day}</span>
            </div>
          ))}

          {/* Calendar days with adjusted padding and text sizes */}
          {calendarState.view === 'month' ? (
            <>
              {getPreviousMonthDays(calendarState.currentDate).map(({ day }) => (
                <CalendarDay
                  key={`prev-${day}`}
                  day={day}
                  month="previous"
                  date={
                    new Date(
                      calendarState.currentDate.getFullYear(),
                      calendarState.currentDate.getMonth() - 1,
                      day
                    )
                  }
                  selectedDate={calendarState.selectedDate}
                  workouts={workoutData.workouts}
                  gymSessions={workoutData.gymSessions}
                  onDayClick={handleDayClick}
                  onEditGymSession={handleEditWorkout}
                />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const currentMonthDate = new Date(
                  calendarState.currentDate.getFullYear(),
                  calendarState.currentDate.getMonth(),
                  day
                );
                const dateString = currentMonthDate.toISOString().split('T')[0];

                const isToday = currentMonthDate.toDateString() === new Date().toDateString();

                return (
                  <CalendarDay
                    key={day}
                    day={day}
                    month="current"
                    date={currentMonthDate}
                    selectedDate={calendarState.selectedDate}
                    workouts={workoutData.workouts}
                    gymSessions={workoutData.gymSessions}
                    onDayClick={handleDayClick}
                    onEditGymSession={handleEditWorkout}
                    isToday={isToday}
                  />
                );
              })}
              {getNextMonthDays(calendarState.currentDate).map(({ day }) => {
                const nextMonthDate = new Date(
                  calendarState.currentDate.getFullYear(),
                  calendarState.currentDate.getMonth() + 1,
                  day
                );

                return (
                  <CalendarDay
                    key={`next-${day}`}
                    day={day}
                    month="next"
                    date={nextMonthDate}
                    selectedDate={calendarState.selectedDate}
                    workouts={workoutData.workouts}
                    gymSessions={workoutData.gymSessions}
                    onDayClick={handleDayClick}
                    onEditGymSession={handleEditWorkout}
                  />
                );
              })}
            </>
          ) : (
            // Weekly view with same responsive adjustments
            getWeekDays(calendarState.currentDate).map((date) => (
              <CalendarDay
                key={date.toISOString()}
                day={date.getDate()}
                month="current"
                date={date}
                selectedDate={calendarState.selectedDate}
                workouts={workoutData.workouts}
                gymSessions={workoutData.gymSessions}
                onDayClick={handleDayClick}
                onEditGymSession={handleEditWorkout}
                isToday={date.toDateString() === new Date().toDateString()}
              />
            ))
          )}
        </div>
      </div>

      {/* Replace the entire right side with WorkoutDetails component */}
      <WorkoutDetails
        selectedDate={calendarState.selectedDate}
        workoutData={workoutData}
        findExerciseInLibrary={findExerciseInLibrary}
        calculateVolumeChange={calculateVolumeChange}
        compareExerciseCount={compareExerciseCount}
        onMuscleClick={onMuscleClick}
        setShowGymForm={setShowGymForm}
      />

      {/* Keep the gym form modal */}
      {showGymForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowGymForm(false)} // Close on overlay click
        >
          <div
            ref={modalRef}
            className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking modal content
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                  {formState.editingWorkout ? 'Edit Gym Session' : 'Add Gym Session'}
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setShowGymForm(false)}>
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
                      formState.gymDate || calendarState.selectedDate.toISOString().split('T')[0]
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
                      <SelectItem value="legs" className="flex items-center gap-2">
                        <span>Legs</span>
                      </SelectItem>
                      <SelectItem value="back_and_chest" className="flex items-center gap-2">
                        <span>Back & Chest</span>
                      </SelectItem>
                      <SelectItem value="shoulders_and_arms" className="flex items-center gap-2">
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
                                primaryMuscle: 'shoulders_and_arms' as MuscleGroup, // Default value
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
                                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
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
                  <ExerciseFormSection
                    selectedExercises={formState.selectedExercises}
                    setFormState={setFormState}
                    collapsedExercises={collapsedExercises}
                    toggleExercise={toggleExercise}
                    userWeight={userWeight}
                    exerciseHistory={exerciseHistory}
                    previousSessionExercises={
                      formState.sessionType
                        ? findPreviousSessionExercises(
                            formState.sessionType,
                            formState.gymDate || new Date().toISOString().split('T')[0]
                          ) || undefined
                        : undefined
                    }
                  />
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
                  <Button variant="outline" onClick={() => setShowGymForm(false)}>
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
                        <Spinner size="sm" />
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
