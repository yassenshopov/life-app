'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MiniCalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
}

export function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const date = selectedDate || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  const today = new Date();
  const selected = selectedDate || today;

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    // Adjust for Monday as first day (0 = Sunday, so we shift)
    const adjustedStart = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

    const days: (number | null)[] = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < adjustedStart; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getWeekNumber = (date: Date, day: number): number => {
    const d = new Date(date.getFullYear(), date.getMonth(), day);
    // ISO week number calculation (Monday as first day of week)
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7; // Convert to Monday = 0
    target.setDate(target.getDate() - dayNr + 3); // Thursday of the week
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3);
    const weekNumber = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000) / 7);
    return weekNumber;
  };

  const days = getDaysInMonth(currentMonth);

  const handleDateClick = (day: number) => {
    if (day) {
      const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      onDateSelect?.(newDate);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number | null) => {
    if (!day) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return (
      date.getDate() === selected.getDate() &&
      date.getMonth() === selected.getMonth() &&
      date.getFullYear() === selected.getFullYear()
    );
  };

  // Group days into weeks
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="w-full">
      <div className="p-2">
        {/* Header with month and navigation */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-medium">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousMonth}
              className="h-4 w-4 p-0 opacity-50 hover:opacity-100"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextMonth}
              className="h-4 w-4 p-0 opacity-50 hover:opacity-100"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-8 gap-0.5 mb-1">
          <div className="text-[0.65rem] text-muted-foreground font-normal text-center"></div>
          {weekDays.map((day, index) => (
            <div key={index} className="text-[0.65rem] text-muted-foreground font-normal text-center">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="space-y-0.5">
          {weeks.map((week, weekIndex) => {
            const firstDay = week.find((day) => day !== null);
            const weekNumber = firstDay
              ? getWeekNumber(currentMonth, firstDay)
              : weekIndex + 1;

            return (
              <div key={weekIndex} className="grid grid-cols-8 gap-0.5">
                {/* Week number */}
                <div className="text-[0.65rem] text-muted-foreground font-normal flex items-center justify-center">
                  {weekNumber}
                </div>
                {/* Days */}
                {week.map((day, dayIndex) => (
                  <button
                    key={dayIndex}
                    onClick={() => handleDateClick(day || 0)}
                    disabled={!day}
                    className={cn(
                      'h-6 w-6 p-0 text-[0.65rem] font-normal rounded-sm transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'disabled:opacity-0 disabled:cursor-default',
                      isToday(day) && 'bg-blue-500 text-white font-semibold hover:bg-blue-600',
                      isSelected(day) && !isToday(day) && 'bg-primary text-primary-foreground'
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

