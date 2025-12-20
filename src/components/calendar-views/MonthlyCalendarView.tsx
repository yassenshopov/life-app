'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../HQCalendar';

interface MonthlyCalendarViewProps {
  currentMonth: Date;
  events: CalendarEvent[];
  onNavigate: (date: Date) => void;
}

export function MonthlyCalendarView({
  currentMonth,
  events,
  onNavigate,
}: MonthlyCalendarViewProps) {
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    // Adjust for Monday as first day (0 = Sunday, so we shift)
    const adjustedStart = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

    const days: (Date | null)[] = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < adjustedStart; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const days = React.useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

  // Group days into weeks
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const getEventsForDay = (day: Date | null) => {
    if (!day) return [];
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return (
        eventDate.getDate() === day.getDate() &&
        eventDate.getMonth() === day.getMonth() &&
        eventDate.getFullYear() === day.getFullYear()
      );
    });
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date | null) => {
    if (!date) return false;
    return (
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear()
    );
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Weekday headers - Fixed */}
          <div
            className="grid border-b sticky top-0 z-10 bg-background"
            style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
          >
            {weekDays.map((day, index) => (
              <div
                key={index}
                className="border-r p-2 text-center text-xs text-muted-foreground font-medium"
              >
                {day}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar grid - Scrollable */}
      <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="min-w-[800px]">
            <div className="grid relative" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {weeks.map((week, weekIndex) =>
                week.map((day, dayIndex) => {
                  const dayEvents = getEventsForDay(day);
                  return (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className={cn(
                        'border-r border-b min-h-[100px] p-2 relative',
                        isToday(day) && 'bg-blue-50 dark:bg-blue-950/20'
                      )}
                    >
                      <div
                        className={cn(
                          'text-sm font-semibold mb-1',
                          isToday(day) && 'text-blue-600 dark:text-blue-400',
                          !isCurrentMonth(day) && 'text-muted-foreground opacity-50'
                        )}
                      >
                        {day ? day.getDate() : ''}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className="text-xs px-2 py-0.5 rounded text-white truncate cursor-pointer hover:opacity-90"
                            style={{ backgroundColor: event.color || '#4285f4' }}
                            title={`${event.title} - ${event.start.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

