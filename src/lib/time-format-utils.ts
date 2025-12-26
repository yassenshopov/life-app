import { TimeFormat } from '@/components/CalendarSettingsDialog';

/**
 * Format time for HTML time input (HH:mm format)
 * Converts Date to 24-hour format string
 */
export function formatTimeForInput(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Parse time input value to Date
 * Handles both 12h and 24h formats
 */
export function parseTimeInput(timeString: string, date: Date, timeFormat: TimeFormat): Date {
  const result = new Date(date);
  
  if (timeFormat === '12h') {
    // For 12h format, we need to parse "HH:mm" and convert
    // But HTML time input always uses 24h format internally
    // So we just parse it as 24h
    const [hours, minutes] = timeString.split(':').map(Number);
    result.setHours(hours, minutes || 0, 0, 0);
  } else {
    // 24h format - direct parse
    const [hours, minutes] = timeString.split(':').map(Number);
    result.setHours(hours, minutes || 0, 0, 0);
  }
  
  return result;
}

/**
 * Format time for display in input placeholder or label
 * Shows format hint based on timeFormat setting
 */
export function getTimeInputPlaceholder(timeFormat: TimeFormat): string {
  return timeFormat === '12h' ? '10:30 AM' : '14:30';
}

