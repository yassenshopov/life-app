'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../HQCalendar';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import { MapPin, Users, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { getContrastTextColor } from '@/lib/color-utils';

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
                  {dayEvents.map((event) => {
                    const eventColor = event.color || '#4285f4';
                    const textColor = getContrastTextColor(eventColor);
                    const textColorValue = textColor === 'dark' ? '#1f2937' : '#ffffff';
                    const isAllDay = event.isAllDay || false;
                    
                    // Calculate duration
                    const durationMs = event.end.getTime() - event.start.getTime();
                    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
                    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                    const durationText = durationHours > 0 
                      ? `${durationHours}h ${durationMinutes > 0 ? `${durationMinutes}m` : ''}`.trim()
                      : `${durationMinutes}m`;

                    return (
                      <div
                        key={event.id}
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all group hover:shadow-md"
                        style={{
                          borderLeftWidth: '4px',
                          borderLeftColor: eventColor,
                          backgroundColor: `${eventColor}08`, // Very light tint
                        }}
                        onClick={() => onNavigate(new Date(event.start))}
                      >
                        {/* Colored indicator bar */}
                        <div
                          className="flex-shrink-0 w-1 h-full rounded-full"
                          style={{ backgroundColor: eventColor }}
                        />
                        
                        {/* Time column */}
                        <div className="flex-shrink-0 w-20 text-xs mt-0.5">
                          {isAllDay ? (
                            <div className="font-medium text-muted-foreground">All day</div>
                          ) : (
                            <>
                              <div className="font-semibold" style={{ color: eventColor }}>
                                {formatEventTime(event.start)}
                              </div>
                              {event.end && (
                                <div className="text-muted-foreground text-[10px]">
                                  {formatEventTime(event.end)}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* Event details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Title and calendar */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm truncate">{event.title}</div>
                              {event.calendar && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <CalendarIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground truncate">
                                    {event.calendar}
                                  </span>
                                </div>
                              )}
                            </div>
                            {/* Duration badge */}
                            {!isAllDay && (
                              <div
                                className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                style={{
                                  backgroundColor: eventColor,
                                  color: textColorValue,
                                }}
                              >
                                {durationText}
                              </div>
                            )}
                          </div>
                          
                          {/* Additional info row */}
                          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                            {/* Location */}
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[200px]">{event.location}</span>
                              </div>
                            )}
                            
                            {/* Attendees count */}
                            {event.attendees && event.attendees.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}</span>
                              </div>
                            )}
                            
                            {/* All-day indicator */}
                            {isAllDay && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>All day</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Description preview (truncated) */}
                          {event.description && (
                            <div 
                              className="text-xs text-muted-foreground line-clamp-2 mt-1"
                              dangerouslySetInnerHTML={{ 
                                __html: event.description.replace(/<[^>]*>/g, '').substring(0, 100) + (event.description.length > 100 ? '...' : '')
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
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

