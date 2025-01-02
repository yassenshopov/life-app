import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Outfit } from 'next/font/google';
import { useEffect } from 'react';

const outfit = Outfit({ subsets: ['latin'] });

interface CalendarHeaderProps {
  view: 'month' | 'week';
  currentDate: Date;
  setView: (view: 'month' | 'week') => void;
  onTodayClick: () => void;
  onPreviousClick: () => void;
  onNextClick: () => void;
}

export const CalendarHeader = ({
  view,
  currentDate,
  setView,
  onTodayClick,
  onPreviousClick,
  onNextClick,
}: CalendarHeaderProps) => {
  const monthYear = currentDate.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  const getWeekInfo = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((date.getTime() - firstDayOfYear.getTime()) / 86400000 +
        firstDayOfYear.getDay() +
        1) /
        7
    );
    return weekNumber;
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Check if the active element is an input or textarea
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement;

      if (!isInput) {
        if (event.key.toLowerCase() === 'm') {
          setView('month');
        } else if (event.key.toLowerCase() === 'w') {
          setView('week');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [setView]);

  return (
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
        <span className={outfit.className}>
          {view === 'month'
            ? monthYear
            : `Week ${getWeekInfo(currentDate)}, ${currentDate.getFullYear()}`}
        </span>
      </h3>
      <div className="flex gap-2">
        <div className="flex mr-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <Button
            variant="ghost"
            onClick={() => setView('month')}
            className={`rounded-r-none px-4 h-9 text-sm ${
              view === 'month'
                ? 'bg-slate-100 dark:bg-slate-800'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Month (M)
          </Button>
          <Button
            variant="ghost"
            onClick={() => setView('week')}
            className={`rounded-l-none px-4 h-9 text-sm ${
              view === 'week'
                ? 'bg-slate-100 dark:bg-slate-800'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Week (W)
          </Button>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onTodayClick}
          className="w-auto border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 h-9 px-4"
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onPreviousClick}
          className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onNextClick}
          className="border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
