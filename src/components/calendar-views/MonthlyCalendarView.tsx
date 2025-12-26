'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../HQCalendar';
import { getEventsForDay } from '@/lib/calendar-utils';
import { getContrastTextColor } from '@/lib/color-utils';
import { Person, getMatchedPeopleFromEvent } from '@/lib/people-matching';
import { PersonAvatar } from '@/components/calendar/PersonAvatar';

interface MonthlyCalendarViewProps {
  currentMonth: Date;
  events: CalendarEvent[];
  onNavigate: (date: Date, switchToWeekly?: boolean) => void;
  onEventClick?: (event: CalendarEvent) => void;
  people?: Person[];
  onPersonClick?: (person: Person) => void;
}

export function MonthlyCalendarView({
  currentMonth,
  events,
  onNavigate,
  onEventClick,
  people = [],
  onPersonClick,
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

  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

  // Group days into weeks
  const weeks = useMemo(() => {
    const result: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];


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
            style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
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
            <div className="grid relative" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {weeks.map((week, weekIndex) =>
                week.map((day, dayIndex) => {
                  const dayEvents = day ? getEventsForDay(events, day) : [];
                  return (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className={cn(
                        'border-r border-b min-h-[100px] p-2 relative min-w-0',
                        isToday(day) && 'bg-blue-50 dark:bg-blue-950/20'
                      )}
                    >
                      <div
                        className={cn(
                          'text-sm font-semibold mb-1 cursor-pointer hover:underline',
                          isToday(day) && 'text-blue-600 dark:text-blue-400',
                          !isCurrentMonth(day) && 'text-muted-foreground opacity-50'
                        )}
                        onClick={(e) => {
                          if (day) {
                            e.stopPropagation();
                            // Pass a second parameter to indicate we want to switch to weekly view
                            onNavigate(day, true);
                          }
                        }}
                      >
                        {day ? day.getDate() : ''}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => {
                          const eventColor = event.color || '#4285f4';
                          const textColor = getContrastTextColor(eventColor);
                          const textColorValue = textColor === 'dark' ? '#1f2937' : '#ffffff';
                          // Use linked people from database, fallback to title matching
                          const matchedPeople = event.linkedPeople && event.linkedPeople.length > 0
                            ? event.linkedPeople
                            : (people.length > 0 ? getMatchedPeopleFromEvent(event.title, people) : []);
                          
                          return (
                            <div
                              key={event.id}
                              className="text-xs px-2 py-0.5 rounded truncate cursor-pointer hover:opacity-90 flex items-center gap-1"
                              style={{ 
                                backgroundColor: eventColor,
                                color: textColorValue,
                              }}
                              title={`${event.title} - ${event.start.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onEventClick?.(event);
                              }}
                            >
                              {matchedPeople.length > 0 && (
                                <div className="flex items-center flex-shrink-0">
                                  {matchedPeople.map((person: Person, index: number) => (
                                    <div
                                      key={person.id}
                                      style={{
                                        marginLeft: index > 0 ? '-8px' : '0',
                                        zIndex: matchedPeople.length - index,
                                      }}
                                      className="relative"
                                    >
                                      <PersonAvatar
                                        person={person}
                                        size="sm"
                                        onClick={() => onPersonClick?.(person)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                              <span className="truncate flex-1">{event.title}</span>
                            </div>
                          );
                        })}
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

