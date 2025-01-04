import { Button } from '@/components/ui/button';
import { Calendar, BarChart2, Pencil, DumbbellIcon } from 'lucide-react';
import Link from 'next/link';
import { ActivityComparison } from '@/components/workout/ActivityComparison';
import { MuscleGroup } from '@/constants/muscle-groups';
import { WorkoutEvent } from '@/types/workout';
import { formatGymType } from '@/lib/utils';

interface WorkoutDetailsProps {
  selectedDate: Date;
  workoutData: {
    workouts: WorkoutEvent[];
    gymSessions: any[];
    isLoading: boolean;
  };
  findExerciseInLibrary: (name: string) =>
    | {
        primaryMuscle: MuscleGroup;
        secondaryMuscles: MuscleGroup[] | undefined;
      }
    | undefined;
  calculateVolumeChange: (current: any, previous: any) => string;
  compareExerciseCount: (current: any, previous: any) => string;
  onMuscleClick?: (muscle: MuscleGroup) => void;
  setShowGymForm: (show: boolean) => void;
}

export const WorkoutDetails = ({
  selectedDate,
  workoutData,
  findExerciseInLibrary,
  calculateVolumeChange,
  compareExerciseCount,
  onMuscleClick,
  setShowGymForm,
}: WorkoutDetailsProps) => {
  return (
    <div className="lg:col-span-2 space-y-4">
      <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg p-6 border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
          {selectedDate.toDateString() === new Date().toDateString()
            ? "Today's Activity"
            : `Activity for ${selectedDate.toLocaleDateString('default', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}`}
        </h3>
        {workoutData.workouts.some((event) => {
          const eventDate = new Date(event.date).toISOString().split('T')[0];
          const selectedDateStr = selectedDate.toISOString().split('T')[0];
          return eventDate === selectedDateStr;
        }) ||
        workoutData.gymSessions.some((session) => {
          const sessionDate = new Date(session.date + 'T00:00:00')
            .toISOString()
            .split('T')[0];
          const selectedDateStr = selectedDate.toISOString().split('T')[0];
          return sessionDate === selectedDateStr;
        }) ? (
          <div className="space-y-6">
            {/* Activities List */}
            {[
              ...workoutData.workouts.map((w) => ({
                ...w,
                activityType: 'run',
              })),
              ...workoutData.gymSessions.map((g) => ({
                ...g,
                activityType: 'gym',
              })),
            ]
              .filter((activity) => {
                const activityDate =
                  activity.activityType === 'gym'
                    ? new Date(activity.date + 'T00:00:00')
                        .toISOString()
                        .split('T')[0]
                    : new Date(activity.date).toISOString().split('T')[0];
                const selectedDateStr = selectedDate
                  .toISOString()
                  .split('T')[0];
                return activityDate === selectedDateStr;
              })
              .map((activity, index) => {
                const isGymSession = activity.activityType === 'gym';
                const isRun = activity.activityType === 'run';

                const previousSession = isGymSession
                  ? workoutData.gymSessions
                      .filter((s) => new Date(s.date) < new Date(activity.date))
                      .sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime()
                      )[0]
                  : null;

                const previousRun = isRun
                  ? workoutData.workouts
                      .filter((w) => new Date(w.date) < new Date(activity.date))
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
                          {Object.keys(activity.exercise_log).length} exercises
                          ·{' '}
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
                                  const exercise = findExerciseInLibrary(name);
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
                                    word.charAt(0).toUpperCase() + word.slice(1)
                                )
                                .join(' ')}
                            </Link>
                          ))}
                        </div>

                        {previousSession && (
                          <ActivityComparison
                            currentActivity={activity}
                            previousActivity={previousSession}
                            activityType={activity.type}
                            daysSince={Math.floor(
                              (new Date().getTime() -
                                new Date(previousSession.date).getTime()) /
                                (1000 * 60 * 60 * 24)
                            )}
                            calculateVolumeChange={calculateVolumeChange}
                            compareExerciseCount={compareExerciseCount}
                          />
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
        <div className="flex flex-col space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setShowGymForm(true)}
          >
            {workoutData.gymSessions.some((session) => {
              const sessionDate = new Date(session.date + 'T00:00:00')
                .toISOString()
                .split('T')[0];
              const selectedDateStr = selectedDate.toISOString().split('T')[0];
              return sessionDate === selectedDateStr;
            }) ? (
              <Pencil className="mr-2 h-4 w-4" />
            ) : (
              <DumbbellIcon className="mr-2 h-4 w-4" />
            )}
            {workoutData.gymSessions.some((session) => {
              const sessionDate = new Date(session.date + 'T00:00:00')
                .toISOString()
                .split('T')[0];
              const selectedDateStr = selectedDate.toISOString().split('T')[0];
              return sessionDate === selectedDateStr;
            })
              ? 'Edit Gym Session'
              : 'Add Gym Session'}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            disabled
            onClick={() => {
              const tomorrow = new Date(selectedDate);
              tomorrow.setDate(tomorrow.getDate() + 1);
              // Add logic to schedule next workout
            }}
          >
            <Calendar className="mr-2 h-4 w-4" /> Schedule Next Workout
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
            disabled
            onClick={() => {
              // Add logic to export workout data
              const workouts = workoutData.workouts.concat(
                workoutData.gymSessions
              );
              // Implement export functionality
            }}
          >
            <BarChart2 className="mr-2 h-4 w-4" /> Export Workout Data
          </Button>
        </div>
      </div>
    </div>
  );
};
