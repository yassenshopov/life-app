'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/components/HQCalendar';
import { formatEventTime } from '@/lib/calendar-utils';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import { getContrastTextColor } from '@/lib/color-utils';

interface AnimatedCalendarEventProps {
  event: CalendarEvent;
  style: React.CSSProperties;
  timeFormat: TimeFormat;
}

/**
 * Animated calendar event component
 */
export function AnimatedCalendarEvent({
  event,
  style,
  timeFormat,
}: AnimatedCalendarEventProps) {
  const bgColor = event.color || '#4285f4';
  const textColor = getContrastTextColor(bgColor);
  const textColorValue = textColor === 'dark' ? '#1f2937' : '#ffffff'; // gray-900 or white
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -5 }}
      transition={{
        duration: 0.2,
        ease: 'easeOut',
      }}
      whileHover={{ scale: 1.02 }}
      className="absolute left-1 right-1 rounded px-2 py-1 text-xs pointer-events-auto cursor-pointer"
      style={{
        ...style,
        backgroundColor: bgColor,
        color: textColorValue,
      }}
      title={`${event.title} - ${formatEventTime(event.start, timeFormat)} - ${formatEventTime(event.end, timeFormat)}`}
    >
      <div className="font-medium truncate" style={{ color: textColorValue }}>
        {event.title}
      </div>
      <div className="text-[10px] opacity-90" style={{ color: textColorValue }}>
        {formatEventTime(event.start, timeFormat)}
      </div>
    </motion.div>
  );
}

