import { Pencil } from 'lucide-react';
import { WorkoutEvent } from '@/types/workout';

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
  const workoutsForDay = workouts.filter((event) => event.date === dateString);
  const gymSessionsForDay = gymSessions.filter((session) => {
    const sessionDate = new Date(session.date);
    sessionDate.setDate(sessionDate.getDate() - 1);
    return sessionDate.toISOString().split('T')[0] === dateString;
  });

  const isSelected = date.toDateString() === selectedDate.toDateString();
  const isPreviousOrNext = month !== 'current';

  return (
    <div
      onClick={() => onDayClick(date)}
      className={`aspect-square p-2 border border-slate-200 dark:border-slate-700 rounded-lg relative 
        ${
          isToday
            ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
            : ''
        }
        ${
          isSelected
            ? 'ring-2 ring-purple-500 dark:ring-purple-400'
            : ''
        }
        ${
          isPreviousOrNext
            ? 'opacity-40 cursor-pointer hover:opacity-60'
            : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }
        transition-colors`}
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
        <div className="absolute bottom-1 right-1 flex gap-1">
          {workoutsForDay.map((_, index) => (
            <div
              key={index}
              className="w-2 h-2 rounded-full bg-orange-500"
            />
          ))}
          {gymSessionsForDay.map((_, index) => (
            <div
              key={index}
              className="w-2 h-2 rounded-full bg-purple-500"
            />
          ))}
        </div>
      )}
    </div>
  );
}; 