import { CalendarEvent } from '@/components/HQCalendar';
import { TimeFormat } from '@/components/CalendarSettingsDialog';

/**
 * Calendar utility functions
 */

export const PIXELS_PER_HOUR = 45;
export const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60; // 0.75px per minute

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if two dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

/**
 * Check if an event overlaps with a specific day
 */
export function eventOverlapsDay(event: CalendarEvent, day: Date): boolean {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);

  // Event overlaps if it starts before day ends and ends after day starts
  return eventStart <= dayEnd && eventEnd >= dayStart;
}

/**
 * Get events for a specific day (including multi-day events)
 */
export function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((event) => eventOverlapsDay(event, day));
}

/**
 * Get all-day events for a specific day (including multi-day all-day events)
 */
export function getAllDayEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((event) => {
    if (!event.isAllDay) return false;
    return eventOverlapsDay(event, day);
  });
}

/**
 * Get timed events (non-all-day) for a specific day (including multi-day events)
 */
export function getTimedEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((event) => {
    // Exclude all-day events from timed events
    if (event.isAllDay) return false;
    return eventOverlapsDay(event, day);
  });
}

/**
 * Check if an event is an all-day event
 */
export function isAllDayEvent(event: CalendarEvent): boolean {
  return event.isAllDay === true;
}

/**
 * Check if two events overlap in time (for a specific day)
 */
export function eventsOverlap(
  event1: CalendarEvent,
  event2: CalendarEvent,
  currentDay?: Date
): boolean {
  const day = currentDay || new Date(event1.start);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const e1Start = new Date(event1.start);
  const e1End = new Date(event1.end);
  const e2Start = new Date(event2.start);
  const e2End = new Date(event2.end);

  // Calculate display times for this day
  const e1DisplayStart = e1Start > dayStart ? e1Start : dayStart;
  const e1DisplayEnd = e1End < dayEnd ? e1End : dayEnd;
  const e2DisplayStart = e2Start > dayStart ? e2Start : dayStart;
  const e2DisplayEnd = e2End < dayEnd ? e2End : dayEnd;

  // Events overlap if one starts before the other ends
  return e1DisplayStart < e2DisplayEnd && e2DisplayStart < e1DisplayEnd;
}

/**
 * Check if event1 completely contains event2 (for a specific day)
 */
export function eventContains(
  event1: CalendarEvent,
  event2: CalendarEvent,
  currentDay?: Date
): boolean {
  const day = currentDay || new Date(event1.start);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const e1Start = new Date(event1.start);
  const e1End = new Date(event1.end);
  const e2Start = new Date(event2.start);
  const e2End = new Date(event2.end);

  // Calculate display times for this day
  const e1DisplayStart = e1Start > dayStart ? e1Start : dayStart;
  const e1DisplayEnd = e1End < dayEnd ? e1End : dayEnd;
  const e2DisplayStart = e2Start > dayStart ? e2Start : dayStart;
  const e2DisplayEnd = e2End < dayEnd ? e2End : dayEnd;

  // event1 contains event2 if event1 starts before or at event2 start and ends after or at event2 end
  return e1DisplayStart <= e2DisplayStart && e1DisplayEnd >= e2DisplayEnd;
}

/**
 * Group overlapping events together
 */
export function groupOverlappingEvents(
  events: CalendarEvent[],
  currentDay?: Date
): CalendarEvent[][] {
  const groups: CalendarEvent[][] = [];
  const processed = new Set<string>();

  for (const event of events) {
    if (processed.has(event.id)) continue;

    const group: CalendarEvent[] = [event];
    processed.add(event.id);

    // Find all events that overlap with any event in this group
    let foundNew = true;
    while (foundNew) {
      foundNew = false;
      for (const otherEvent of events) {
        if (processed.has(otherEvent.id)) continue;

        // Check if this event overlaps with any event in the current group
        for (const groupEvent of group) {
          if (eventsOverlap(groupEvent, otherEvent, currentDay)) {
            group.push(otherEvent);
            processed.add(otherEvent.id);
            foundNew = true;
            break;
          }
        }
      }
    }

    if (group.length > 0) {
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Check if two events touch each other (one ends exactly where another starts)
 */
export function eventsTouch(
  event1: CalendarEvent,
  event2: CalendarEvent,
  currentDay?: Date
): { top: boolean; bottom: boolean } {
  const day = currentDay || new Date(event1.start);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const e1Start = new Date(event1.start);
  const e1End = new Date(event1.end);
  const e2Start = new Date(event2.start);
  const e2End = new Date(event2.end);

  // Calculate display times for this day
  const e1DisplayStart = e1Start > dayStart ? e1Start : dayStart;
  const e1DisplayEnd = e1End < dayEnd ? e1End : dayEnd;
  const e2DisplayStart = e2Start > dayStart ? e2Start : dayStart;
  const e2DisplayEnd = e2End < dayEnd ? e2End : dayEnd;

  // Events touch if one ends exactly when another starts (within 1 minute tolerance)
  const tolerance = 60 * 1000; // 1 minute in milliseconds
  const e1EndsAtE2Start = Math.abs(e1DisplayEnd.getTime() - e2DisplayStart.getTime()) < tolerance;
  const e2EndsAtE1Start = Math.abs(e2DisplayEnd.getTime() - e1DisplayStart.getTime()) < tolerance;

  return {
    top: e2EndsAtE1Start, // event2 ends where event1 starts (event2 is above)
    bottom: e1EndsAtE2Start, // event1 ends where event2 starts (event2 is below)
  };
}

/**
 * Calculate event position, height, width, and left offset for a specific day
 * Handles multi-day events and overlapping events
 */
export function calculateEventPosition(
  event: CalendarEvent,
  currentDay?: Date,
  overlappingEvents?: CalendarEvent[]
): {
  top: string;
  height: string;
  left?: string;
  width?: string;
} {
  const day = currentDay || new Date(event.start);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);

  // Calculate the actual start and end times for this day
  const displayStart = eventStart > dayStart ? eventStart : dayStart;
  const displayEnd = eventEnd < dayEnd ? eventEnd : dayEnd;

  // Calculate minutes from midnight
  const startMinutes = displayStart.getHours() * 60 + displayStart.getMinutes();
  const endMinutes = displayEnd.getHours() * 60 + displayEnd.getMinutes();
  const duration = endMinutes - startMinutes;

  const top = startMinutes * PIXELS_PER_MINUTE;
  const height = duration * PIXELS_PER_MINUTE;

  const baseStyle: {
    top: string;
    height: string;
    left?: string;
    width?: string;
  } = {
    top: `${top}px`,
    height: `${Math.max(height, 15)}px`, // Minimum height of 15px
  };

  // Handle overlapping events
  if (overlappingEvents && overlappingEvents.length > 1) {
    const overlappingGroup = overlappingEvents.filter((e) => e.id !== event.id);
    
    if (overlappingGroup.length > 0) {
      // Check if any event completely contains this one
      const containingEvent = overlappingGroup.find((e) =>
        eventContains(e, event, currentDay)
      );

      if (containingEvent) {
        // This event is completely contained - make it narrower and position to the right
        // The containing event stays full width, so this one goes to the right side
        baseStyle.width = 'calc(50% - 4px)';
        baseStyle.left = 'calc(50% + 4px)';
      } else {
        // Check if this event completely contains any other
        const containedEvents = overlappingGroup.filter((e) =>
          eventContains(event, e, currentDay)
        );

        if (containedEvents.length > 0) {
          // This event contains one or more events - stay full width, contained events will be positioned to the right
          // Don't set width or left - let it use the default full width
        } else {
          // Partial overlap - share width proportionally based on number of overlapping events
          const allOverlapping = [...overlappingGroup, event];
          // Sort by start time to determine order
          const sorted = allOverlapping.sort((a, b) => {
            const aStart = new Date(a.start);
            const bStart = new Date(b.start);
            // For same day, compare times
            if (isSameDay(aStart, bStart)) {
              return aStart.getTime() - bStart.getTime();
            }
            return aStart.getTime() - bStart.getTime();
          });
          
          const eventIndex = sorted.findIndex((e) => e.id === event.id);
          const totalOverlapping = sorted.length;
          const widthPercent = 100 / totalOverlapping;
          
          baseStyle.width = `calc(${widthPercent}% - ${(totalOverlapping - 1) * 4 / totalOverlapping}px)`;
          baseStyle.left = `calc(${eventIndex * widthPercent}% + ${eventIndex * 4}px)`;
        }
      }
    }
  }

  return baseStyle;
}


/**
 * Format time for display (hour labels)
 */
export function formatTime(hour: number, timeFormat: TimeFormat): string {
  if (timeFormat === '24h') {
    return `${hour.toString().padStart(2, '0')}:00`;
  }
  // 12-hour format
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

/**
 * Format time for event display
 */
export function formatEventTime(date: Date, timeFormat: TimeFormat): string {
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
}

/**
 * Generate time slots (0-23 hours)
 */
export function generateTimeSlots(): number[] {
  const slots: number[] = [];
  for (let hour = 0; hour <= 23; hour++) {
    slots.push(hour);
  }
  return slots;
}

/**
 * Get week days starting from Monday
 */
export function getWeekDays(startDate: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    date.setHours(0, 0, 0, 0);
    days.push(date);
  }
  return days;
}

/**
 * Format date header (day name)
 */
export function formatDateHeader(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

