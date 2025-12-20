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
 * Get events for a specific day
 */
export function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((event) => {
    const eventDate = new Date(event.start);
    return isSameDay(eventDate, day);
  });
}

/**
 * Get all-day events for a specific day
 */
export function getAllDayEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((event) => {
    if (!event.isAllDay) return false;
    const eventDate = new Date(event.start);
    return isSameDay(eventDate, day);
  });
}

/**
 * Get timed events (non-all-day) for a specific day
 */
export function getTimedEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((event) => {
    // Exclude all-day events from timed events
    if (event.isAllDay) return false;
    const eventDate = new Date(event.start);
    return isSameDay(eventDate, day);
  });
}

/**
 * Check if an event is an all-day event
 */
export function isAllDayEvent(event: CalendarEvent): boolean {
  return event.isAllDay === true;
}

/**
 * Calculate event position and height in pixels
 */
export function calculateEventPosition(event: CalendarEvent): {
  top: string;
  height: string;
} {
  const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
  const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
  const duration = endMinutes - startMinutes;
  const startHour = 0; // First time slot (midnight)

  const top = (startMinutes - startHour * 60) * PIXELS_PER_MINUTE;
  const height = duration * PIXELS_PER_MINUTE;

  return {
    top: `${top}px`,
    height: `${Math.max(height, 15)}px`, // Minimum height of 15px
  };
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

