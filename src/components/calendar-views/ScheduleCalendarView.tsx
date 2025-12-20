'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../HQCalendar';
import { TimeFormat } from '@/components/CalendarSettingsDialog';

interface ScheduleCalendarViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  timeFormat: TimeFormat;
  onNavigate: (date: Date) => void;
}

export function ScheduleCalendarView({
  currentDate,
  events,
  timeFormat,
  onNavigate,
}: ScheduleCalendarViewProps) {
  // Get events for the next 30 days, grouped by day
  const groupedEvents = React.useMemo(() => {
    const startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 30);

    const grouped: Map<string, CalendarEvent[]> = new Map();

    // Initialize all days in range
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      grouped.set(dateKey, []);
    }

    // Add events to their respective days
    events
      .filter((event) => {
        const eventDate = new Date(event.start);
        return eventDate >= startDate && eventDate < endDate;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .forEach((event) => {
        const eventDate = new Date(event.start);
        const dateKey = eventDate.toISOString().split('T')[0];
        const dayEvents = grouped.get(dateKey) || [];
        dayEvents.push(event);
        grouped.set(dateKey, dayEvents);
      });

    return grouped;
  }, [events, currentDate]);

  // Format time for event display
  const formatEventTime = (date: Date) => {
    if (timeFormat === '24h') {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDateHeader = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const dateStr = date.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateStr === todayStr) {
      return 'Today';
    } else if (dateStr === tomorrowStr) {
      return 'Tomorrow';
    } else if (dateStr === yesterdayStr) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const sortedDates = Array.from(groupedEvents.keys()).sort();

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="p-4 space-y-6">
          {sortedDates.map((dateKey) => {
            const date = new Date(dateKey);
            const dayEvents = groupedEvents.get(dateKey) || [];

            if (dayEvents.length === 0) {
              return null;
            }

            return (
              <div key={dateKey} className="space-y-2">
                <div
                  className={cn(
                    'text-sm font-semibold mb-2 pb-2 border-b',
                    isToday(date) && 'text-blue-600 dark:text-blue-400'
                  )}
                >
                  {formatDateHeader(date)}
                </div>
                <div className="space-y-2">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors group"
                      onClick={() => onNavigate(new Date(event.start))}
                    >
                      <div
                        className={cn(
                          'flex-shrink-0 w-1 rounded-full',
                          event.color || 'bg-blue-500'
                        )}
                      />
                      <div className="flex-shrink-0 w-16 text-xs text-muted-foreground mt-0.5">
                        {formatEventTime(event.start)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{event.title}</div>
                        {event.end && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatEventTime(event.start)} - {formatEventTime(event.end)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {sortedDates.every((dateKey) => groupedEvents.get(dateKey)?.length === 0) && (
            <div className="text-center text-muted-foreground py-8">
              No upcoming events in the next 30 days
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

