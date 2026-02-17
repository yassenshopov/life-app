'use client';

import React, { useMemo, useState } from 'react';
import { Outfit } from 'next/font/google';
import {
  format,
  formatDistanceToNow,
  isFuture,
  isToday,
  startOfMonth,
  endOfMonth,
  getDay,
} from 'date-fns';
import { Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const outfit = Outfit({ subsets: ['latin'] });

interface CalendarEvent {
  id: string;
  summary?: string;
  title?: string;
  start?: {
    dateTime?: string;
    date?: string;
  } | string | Date;
  location?: string;
  color?: string;
  colorId?: string;
  organizer?: {
    email?: string;
    displayName?: string;
  };
  calendarId?: string;
}

/** People linked to an event (from event_people). Used for tooltip "People" row when > 1. */
export type EventPeopleEntry = { id: string; name: string; image_url?: string | null; image?: unknown };
export type EventPeopleMap = Record<string, EventPeopleEntry[]>;

function getPersonImageUrl(p: EventPeopleEntry): string | null {
  if (p.image_url) return p.image_url;
  const imageData = p.image;
  if (!imageData || !Array.isArray(imageData) || imageData.length === 0) return null;
  const first = imageData[0];
  if (first?.type === 'external' && first?.external?.url) return first.external.url;
  if (first?.type === 'file' && first?.file?.url) return first.file.url;
  return null;
}

interface ConnectedCalendarEventsProps {
  events: CalendarEvent[];
  isLoading?: boolean;
  /** Map event id -> list of people linked to that event. Optional; when present, tooltip shows a People row if more than one. */
  eventPeopleMap?: EventPeopleMap;
}

/**
 * Map Google Calendar colorId to hex color
 * Google Calendar uses predefined color IDs (1-11) that map to specific colors
 */
function getColorFromColorId(colorId: string | undefined | null, defaultColor: string = '#4285f4'): string {
  if (!colorId) {
    return defaultColor;
  }

  // Google Calendar color ID to hex mapping
  const colorMap: Record<string, string> = {
    '1': '#a4bdfc', // Lavender
    '2': '#7ae7bf', // Sage
    '3': '#dbadff', // Grape
    '4': '#ff887c', // Flamingo
    '5': '#fbd75b', // Banana
    '6': '#ffb878', // Tangerine
    '7': '#46d6db', // Peacock
    '8': '#e1e1e1', // Graphite
    '9': '#5484ed', // Blueberry
    '10': '#51b749', // Basil
    '11': '#dc2127', // Tomato
  };

  return colorMap[colorId] || defaultColor;
}

/**
 * Parse event start date from various formats
 */
function parseEventStart(event: CalendarEvent): Date | null {
  if (!event.start) {
    return null;
  }

  // Handle Date object
  if (event.start instanceof Date) {
    return event.start;
  }

  // Handle string (ISO string or timestamp)
  if (typeof event.start === 'string') {
    const parsed = new Date(event.start);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Handle Google Calendar API format
  if (typeof event.start === 'object') {
    if (event.start.dateTime) {
      return new Date(event.start.dateTime);
    }
    if (event.start.date) {
      return new Date(event.start.date + 'T00:00:00');
    }
  }

  return null;
}

/**
 * Get event color, handling both color property and colorId
 * Falls back to calendar color if available, otherwise uses default
 */
function getEventColor(event: CalendarEvent, calendarColor?: string): string {
  // If color is already set (from cached events), use it
  if (event.color) {
    return event.color;
  }

  // Otherwise, try to map colorId with calendar color as fallback
  const defaultColor = calendarColor || '#4285f4';
  if (event.colorId) {
    return getColorFromColorId(event.colorId, defaultColor);
  }

  // Default fallback
  return defaultColor;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Monday-first week
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface MonthGridProps {
  year: number;
  monthIndex: number;
  eventsByDate: Map<string, Array<{ event: CalendarEvent; startDate: Date }>>;
  getEventColor: (event: CalendarEvent, calendarColor?: string) => string;
  isCurrentMonth: boolean;
  isFutureMonth: boolean;
  eventPeopleMap?: EventPeopleMap;
}

function MonthGrid({
  year,
  monthIndex,
  eventsByDate,
  getEventColor,
  isCurrentMonth,
  isFutureMonth,
  eventPeopleMap,
}: MonthGridProps) {
  const first = startOfMonth(new Date(year, monthIndex));
  const last = endOfMonth(first);
  // Monday = 0 (same as MiniCalendar)
  const startPad = getDay(first) === 0 ? 6 : getDay(first) - 1;
  const daysInMonth = last.getDate();

  // 6 weeks of 7 days
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);

  return (
    <div
      className={cn(
        'p-2',
        isCurrentMonth && 'rounded-md bg-primary/5',
        isFutureMonth && 'opacity-50'
      )}
    >
      <div
        className={cn(
          'text-xs font-medium mb-2',
          isCurrentMonth ? 'text-primary font-semibold' : 'text-muted-foreground'
        )}
      >
        {MONTH_NAMES[monthIndex]}
      </div>
      {/* Weekday headers - match MiniCalendar */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DOW.map((d, i) => (
          <div key={i} className="text-[0.65rem] text-muted-foreground font-normal text-center">
            {d}
          </div>
        ))}
      </div>
      {/* Calendar grid - match MiniCalendar cell style */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} className="h-6 w-6 opacity-0" aria-hidden />;
          }
          const date = new Date(year, monthIndex, day);
          const dateKey = format(date, 'yyyy-MM-dd');
          const dayEvents = eventsByDate.get(dateKey) ?? [];
          const hasEvents = dayEvents.length > 0;
          const today = isToday(date);

          const cellClassName = cn(
            'h-6 w-6 p-0 text-[0.65rem] font-normal rounded-sm flex items-center justify-center cursor-default transition-colors',
            !hasEvents && !today && 'hover:bg-accent hover:text-accent-foreground',
            today && 'bg-blue-500 text-white font-semibold hover:bg-blue-600',
            hasEvents && !today && 'bg-primary text-primary-foreground hover:bg-primary/90',
            hasEvents && today && 'bg-blue-600 text-white font-semibold hover:bg-blue-700 ring-1 ring-primary'
          );

          if (hasEvents) {
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div className={cellClassName} role="button" tabIndex={0}>
                    {day}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className={cn('z-[10002] max-w-[240px] p-2 space-y-1.5 text-left', outfit.className)}
                  sideOffset={6}
                >
                  {dayEvents.map(({ event, startDate }) => {
                    const isAllDay =
                      typeof event.start === 'object' &&
                      !(event.start instanceof Date) &&
                      event.start &&
                      'date' in event.start;
                    const eventColor = getEventColor(event);
                    return (
                      <div key={event.id} className="flex gap-2">
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                          style={{ backgroundColor: eventColor }}
                        />
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {event.summary || event.title || 'Untitled Event'}
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span>
                              {isAllDay
                                ? format(startDate, 'MMM d')
                                : format(startDate, 'h:mm a')}
                            </span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                          {eventPeopleMap?.[event.id] && eventPeopleMap[event.id].length > 1 && (
                            <div className="flex flex-wrap items-center">
                              {eventPeopleMap[event.id].map((p, i) => {
                                const src = getPersonImageUrl(p);
                                const initials = p.name
                                  .split(/\s+/)
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2);
                                return (
                                  <div
                                    key={p.id}
                                    className={cn(
                                      'h-6 w-6 rounded-full overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center text-[10px] font-medium',
                                      i > 0 && '-ml-2'
                                    )}
                                    title={p.name}
                                  >
                                    {src ? (
                                      <img
                                        src={src}
                                        alt={p.name}
                                        className="h-full w-full object-cover"
                                        unoptimized
                                      />
                                    ) : (
                                      <span className="text-muted-foreground">{initials}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </TooltipContent>
              </Tooltip>
            );
          }
          return (
            <div key={i} className={cellClassName}>
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConnectedCalendarEvents({ events, isLoading = false, eventPeopleMap }: ConnectedCalendarEventsProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // All events (past + future) with parsed start date
  const filteredEvents = useMemo(() => {
    return events
      .map((event) => ({ event, startDate: parseEventStart(event) }))
      .filter(
        (item): item is { event: CalendarEvent; startDate: Date } => item.startDate !== null
      );
  }, [events]);

  // Map date string (YYYY-MM-DD) -> events on that day (for grid highlights + tooltips)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Array<{ event: CalendarEvent; startDate: Date }>>();
    filteredEvents.forEach(({ event, startDate }) => {
      const key = format(startDate, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ event, startDate });
    });
    map.forEach((list) => list.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()));
    return map;
  }, [filteredEvents]);

  // Years to choose from: event years + current year (so we can always view current year)
  const availableYears = useMemo(() => {
    const fromEvents = new Set(filteredEvents.map(({ startDate }) => startDate.getFullYear()));
    fromEvents.add(currentYear);
    return Array.from(fromEvents).sort((a, b) => b - a);
  }, [filteredEvents, currentYear]);

  const [selectedYear, setSelectedYear] = useState(() => currentYear);

  // Show selected year if available, otherwise current year or first available
  const displayYear = availableYears.includes(selectedYear)
    ? selectedYear
    : (availableYears[0] ?? currentYear);
  const yearIndex = availableYears.indexOf(displayYear);
  const canPrev = yearIndex < availableYears.length - 1;
  const canNext = yearIndex > 0;

  // Get the most recent PAST event for "Last interaction"
  const mostRecentPastEvent = useMemo(() => {
    return events
      .map((event) => ({ event, startDate: parseEventStart(event) }))
      .filter(
        (item): item is { event: CalendarEvent; startDate: Date } =>
          item.startDate !== null && !isFuture(item.startDate)
      )
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0];
  }, [events]);

  const mostRecentEventStart = mostRecentPastEvent?.startDate || null;
  const timeSinceLastEvent = mostRecentEventStart
    ? formatDistanceToNow(mostRecentEventStart, { addSuffix: true })
    : null;

  return (
    <div className={cn('space-y-2', outfit.className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Connected Calendar Events</div>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : availableYears.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">
          No connected calendar events found.
        </div>
      ) : (
        <TooltipProvider delayDuration={300}>
          <div className="space-y-3">
            {timeSinceLastEvent && (
              <div className="text-xs text-muted-foreground pb-1 border-b border-border/50">
                Last interaction: {timeSinceLastEvent}
              </div>
            )}
            <div
              className="flex items-center justify-between gap-2 relative z-10"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                onClick={() => canPrev && setSelectedYear(availableYears[yearIndex + 1] ?? displayYear)}
                disabled={!canPrev}
                aria-label="Previous year"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold tabular-nums select-none">{displayYear}</span>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                onClick={() => canNext && setSelectedYear(availableYears[yearIndex - 1] ?? displayYear)}
                disabled={!canNext}
                aria-label="Next year"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((monthIndex) => {
                const isCurrentMonth =
                  displayYear === currentYear && monthIndex === currentMonth;
                const isFutureMonth =
                  displayYear > currentYear ||
                  (displayYear === currentYear && monthIndex > currentMonth);
                return (
                  <MonthGrid
                    key={`${displayYear}-${monthIndex}`}
                    year={displayYear}
                    monthIndex={monthIndex}
                    eventsByDate={eventsByDate}
                    getEventColor={getEventColor}
                    isCurrentMonth={isCurrentMonth}
                    isFutureMonth={isFutureMonth}
                    eventPeopleMap={eventPeopleMap}
                  />
                );
              })}
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

