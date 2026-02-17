'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../HQCalendar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { isAllDayEvent } from '@/lib/calendar-utils';

interface AnnualCalendarViewProps {
  currentYear: Date;
  events: CalendarEvent[];
  onNavigate: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventRightClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
}

export function AnnualCalendarView({
  currentYear,
  events,
  onNavigate,
  onEventClick,
  onEventRightClick,
}: AnnualCalendarViewProps) {
  const months = [
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

  const getDaysInMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const adjustedStart = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

    const days: (number | null)[] = [];
    for (let i = 0; i < adjustedStart; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const getEventsForDay = (year: number, month: number, day: number | null) => {
    if (!day) return [];
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === month &&
        eventDate.getFullYear() === year
      );
    });
  };

  const isToday = (year: number, month: number, day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const formatEventTimeForTooltip = (event: CalendarEvent) => {
    if (isAllDayEvent(event)) return 'All day';
    const start = event.start instanceof Date ? event.start : new Date(event.start);
    const end = event.end instanceof Date ? event.end : new Date(event.end);
    return `${start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  };

  const year = currentYear.getFullYear();

  return (
    <div className="flex flex-col h-full">
      <TooltipProvider delayDuration={300}>
        <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="grid grid-cols-3 gap-4 p-4">
            {months.map((monthName, monthIndex) => {
              const days = getDaysInMonth(year, monthIndex);
              const weeks: (number | null)[][] = [];
              for (let i = 0; i < days.length; i += 7) {
                weeks.push(days.slice(i, i + 7));
              }

              return (
                <div key={monthIndex} className="p-2">
                  <div className="text-sm font-semibold mb-2 text-center">{monthName}</div>
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {weekDays.map((day, index) => (
                      <div
                        key={index}
                        className="text-[0.65rem] text-muted-foreground font-normal text-center"
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-0.5">
                    {weeks.map((week, weekIndex) => (
                      <div key={weekIndex} className="grid grid-cols-7 gap-0.5">
                        {week.map((day, dayIndex) => {
                          const dayEvents = getEventsForDay(year, monthIndex, day);
                          const dayDate = day
                            ? new Date(year, monthIndex, day)
                            : null;
                          return (
                            <Tooltip key={dayIndex}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => {
                                    if (day) {
                                      onNavigate(new Date(year, monthIndex, day));
                                    }
                                  }}
                                  disabled={!day}
                                  className={cn(
                                    'h-6 w-6 p-0 text-[0.65rem] font-normal rounded-sm transition-colors',
                                    'hover:bg-accent hover:text-accent-foreground',
                                    'disabled:opacity-0 disabled:cursor-default',
                                    isToday(year, monthIndex, day) &&
                                      'bg-blue-500 text-white font-semibold hover:bg-blue-600',
                                    dayEvents.length > 0 && !isToday(year, monthIndex, day) && 'bg-primary/20'
                                  )}
                                >
                                  {day}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="max-w-[240px] p-2"
                              >
                                {dayDate ? (
                                  <>
                                    <div className="font-medium mb-1.5 border-b border-primary-foreground/20 pb-1">
                                      {format(dayDate, 'EEE, MMM d')}
                                    </div>
                                    {dayEvents.length === 0 ? (
                                      <p className="text-muted-foreground text-xs">No events</p>
                                    ) : (
                                      <ul className="space-y-1 text-xs">
                                        {dayEvents.map((event) => (
                                          <li
                                            key={event.id}
                                            className="flex flex-col gap-0.5 truncate pl-1.5"
                                            style={{
                                              borderLeft: `3px solid ${event.color || 'var(--primary)'}`,
                                            }}
                                          >
                                            <span className="font-medium truncate" title={event.title}>
                                              {event.title}
                                            </span>
                                            <span className="text-muted-foreground">
                                              {formatEventTimeForTooltip(event)}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </>
                                ) : null}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}

