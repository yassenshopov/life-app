'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow, isFuture } from 'date-fns';
import { Clock, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

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

interface ConnectedCalendarEventsProps {
  events: CalendarEvent[];
  isLoading?: boolean;
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

export function ConnectedCalendarEvents({ events, isLoading = false }: ConnectedCalendarEventsProps) {
  const [showFutureEvents, setShowFutureEvents] = useState(false);

  // Sort events chronologically (most recent at top)
  const sortedEvents = useMemo(() => {
    const now = new Date();
    return [...events]
      .map((event) => {
        const startDate = parseEventStart(event);
        return { event, startDate };
      })
      .filter(({ startDate }) => startDate !== null)
      .filter(({ startDate }) => {
        // Filter out future events unless showFutureEvents is true
        if (!showFutureEvents && isFuture(startDate!)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Most recent first (descending order)
        return b.startDate!.getTime() - a.startDate!.getTime();
      })
      .map(({ event }) => event);
  }, [events, showFutureEvents]);

  // Count future events
  const futureEventsCount = useMemo(() => {
    const now = new Date();
    return events.filter((event) => {
      const startDate = parseEventStart(event);
      return startDate !== null && isFuture(startDate);
    }).length;
  }, [events]);

  // Get the most recent PAST event for the disclaimer (not future events)
  const mostRecentPastEvent = useMemo(() => {
    const now = new Date();
    return events
      .map((event) => {
        const startDate = parseEventStart(event);
        return { event, startDate };
      })
      .filter(({ startDate }) => startDate !== null && !isFuture(startDate!))
      .sort((a, b) => b.startDate!.getTime() - a.startDate!.getTime())[0];
  }, [events]);

  const mostRecentEventStart = mostRecentPastEvent?.startDate || null;
  const timeSinceLastEvent = mostRecentEventStart 
    ? formatDistanceToNow(mostRecentEventStart, { addSuffix: true })
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Connected Calendar Events</div>
        {futureEventsCount > 0 && !isLoading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFutureEvents(!showFutureEvents)}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            {showFutureEvents ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                Hide {futureEventsCount} upcoming
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                Show {futureEventsCount} upcoming
              </>
            )}
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">
          {showFutureEvents || futureEventsCount === 0
            ? 'No connected calendar events found.'
            : `No past events found. ${futureEventsCount} upcoming event${futureEventsCount !== 1 ? 's' : ''} available.`}
        </div>
      ) : (
        <div className="space-y-2">
          {timeSinceLastEvent && (
            <div className="text-xs text-muted-foreground pb-1 border-b border-border/50">
              Last interaction: {timeSinceLastEvent}
            </div>
          )}
          <div className="space-y-1">
        {sortedEvents.map((event) => {
          const eventStart = parseEventStart(event);
          
          // Skip invalid events
          if (!eventStart || isNaN(eventStart.getTime())) {
            return null;
          }

          const dateStr = eventStart.toISOString().split('T')[0];
          const isAllDay = 
            (typeof event.start === 'object' && event.start?.date) || 
            !(typeof event.start === 'object' && event.start?.dateTime);
          
          const eventColor = getEventColor(event);
          const timeAgo = formatDistanceToNow(eventStart, { addSuffix: true });

          return (
            <Link
              key={event.id}
              href={`/hq?date=${dateStr}`}
              className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors group"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: eventColor }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {event.summary || event.title || 'Untitled Event'}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {isAllDay 
                        ? format(eventStart, 'MMM d, yyyy')
                        : `${format(eventStart, 'MMM d, yyyy')} at ${format(eventStart, 'h:mm a')}`
                      }
                    </span>
                  </div>
                  <span className="text-muted-foreground/70">
                    {timeAgo}
                  </span>
                  {event.location && (
                    <div className="flex items-center gap-1 min-w-0 max-w-[120px]">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate text-xs">{event.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
          </div>
        </div>
      )}
    </div>
  );
}

