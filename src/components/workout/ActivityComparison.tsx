interface ActivityComparisonProps {
  currentActivity: any;
  previousActivity: any;
  activityType: string;
  daysSince: number;
  calculateVolumeChange: (current: any, previous: any) => string;
  compareExerciseCount: (current: any, previous: any) => string;
}

export const ActivityComparison = ({
  currentActivity,
  previousActivity,
  activityType,
  daysSince,
  calculateVolumeChange,
  compareExerciseCount,
}: ActivityComparisonProps) => {
  return (
    <div className="mt-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
      <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
        Compared to last {activityType} workout ({daysSince} days ago):
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Total Volume:{' '}
          </span>
          <span
            className={`font-medium ${
              calculateVolumeChange(currentActivity, previousActivity).startsWith('+')
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {calculateVolumeChange(currentActivity, previousActivity)}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Exercise Count:{' '}
          </span>
          <span
            className={`font-medium ${
              compareExerciseCount(currentActivity, previousActivity).startsWith('+')
                ? 'text-green-600 dark:text-green-400'
                : compareExerciseCount(currentActivity, previousActivity) === 'Same'
                ? 'text-slate-600 dark:text-slate-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {compareExerciseCount(currentActivity, previousActivity)}
          </span>
        </div>
      </div>
    </div>
  );
}; 