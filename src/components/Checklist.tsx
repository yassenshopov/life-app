import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckSquare, RefreshCw } from 'lucide-react';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

interface ChecklistProps {
  entries: any[];
  dateRange: { from: Date; to: Date };
  isLoadingCharts: boolean;
  setIsLoadingCharts: (loading: boolean) => void;
  setEntries: (entries: any[]) => void;
}

export function Checklist({
  entries,
  dateRange,
  isLoadingCharts,
  setIsLoadingCharts,
  setEntries,
}: ChecklistProps) {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const todayEntry = entries.find((entry) => entry.date === today);
  const yesterdayEntry = entries.find((entry) => entry.date === yesterday);

  const hasTodaySleepData =
    todayEntry &&
    (todayEntry.totalSleepHours > 0 || todayEntry.totalSleepMinutes > 0);

  const hasYesterdayRHR = yesterdayEntry?.restingHeartRate != null;
  const hasYesterdaySteps = yesterdayEntry?.steps != null;
  const hasTodayWeight = todayEntry?.weight != null;

  const isComplete =
    hasTodaySleepData && hasYesterdayRHR && hasYesterdaySteps && hasTodayWeight;

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

  return (
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
        {isComplete && (
          <div className="mb-6 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-4 py-2 rounded-lg border border-green-200 dark:border-green-900 flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            <span className="text-sm font-medium">
              Great job! You've completed all your health tracking tasks for today!
              🎉
            </span>
          </div>
        )}
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
          {checklistItems.map((item) => (
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
          ))}
        </div>
      </div>
    </div>
  );
} 