import { Pencil } from 'lucide-react';
import { WorkoutEvent } from '@/types/workout';
import { cn } from '@/lib/utils';

interface CalendarDayProps {
  day: number;
  month: 'previous' | 'current' | 'next';
  date: Date;
  selectedDate: Date;
  workouts: WorkoutEvent[];
  gymSessions: any[];
  onDayClick: (date: Date) => void;
  onEditGymSession: (session: any) => void;
  isToday?: boolean;
}

export const CalendarDay = ({
  day,
  month,
  date,
  selectedDate,
  workouts,
  gymSessions,
  onDayClick,
  onEditGymSession,
  isToday = false,
}: CalendarDayProps) => {
  const dateString = date.toISOString().split('T')[0];
  const workoutsForDay = (workouts || []).filter((event) => event.date === dateString);
  const gymSessionsForDay = (gymSessions || []).filter((session) => {
    const sessionDate = new Date(session.date);
    sessionDate.setDate(sessionDate.getDate() - 1);
    return sessionDate.toISOString().split('T')[0] === dateString;
  });

  const isSelected = date.toDateString() === selectedDate.toDateString();
  const isPreviousOrNext = month !== 'current';

  return (
    <div
      onClick={() => onDayClick(date)}
      className={cn(
        'min-h-[60px] sm:min-h-[80px] p-1 sm:p-2 relative cursor-pointer rounded-sm border border-slate-100 dark:border-slate-900',
        {
          'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800': isToday,
          'ring-2 ring-purple-500 dark:ring-purple-400': isSelected,
          'opacity-40 cursor-pointer hover:opacity-60': isPreviousOrNext,
          'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50': !isPreviousOrNext,
        }
      )}
    >
      <span
        className={cn('text-xs sm:text-sm font-medium', {
          'text-purple-600 dark:text-purple-400': isToday,
          'text-slate-600 dark:text-slate-400': !isToday,
        })}
      >
        {day}
      </span>
      {gymSessionsForDay.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditGymSession(gymSessionsForDay[0]);
          }}
          className="absolute top-1 right-1 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      {(workoutsForDay.length > 0 || gymSessionsForDay.length > 0) && (
        <div className="absolute bottom-1 left-1 right-1 flex flex-col gap-0.5 sm:gap-1">
          {workoutsForDay.map((_, index) => (
            <div key={index} className="w-2 h-2 rounded-full bg-orange-500" />
          ))}
          {gymSessionsForDay.map((_, index) => (
            <div key={index} className="w-2 h-2 rounded-full bg-purple-500" />
          ))}
        </div>
      )}
    </div>
  );
};
