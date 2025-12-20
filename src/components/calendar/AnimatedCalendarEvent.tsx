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
  onClick?: (event: CalendarEvent) => void;
  currentDate?: Date; // The date of the column this event is in (for calculating absolute position)
}

/**
 * Animated calendar event component
 */
export function AnimatedCalendarEvent({
  event,
  style,
  timeFormat,
  onClick,
  currentDate,
}: AnimatedCalendarEventProps) {
  const bgColor = event.color || '#4285f4';
  const textColor = getContrastTextColor(bgColor);
  const textColorValue = textColor === 'dark' ? '#1f2937' : '#ffffff'; // gray-900 or white

  const handleClick = (e: React.MouseEvent) => {
    onClick?.(event);
  };

  const displayStart = event.start;
  const displayEnd = event.end;

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
      onClick={handleClick}
      className={cn(
        "absolute left-1 right-1 rounded px-2 py-1 text-xs pointer-events-auto cursor-pointer",
        "hover:opacity-90 transition-opacity"
      )}
      style={{
        ...style,
        backgroundColor: bgColor,
        color: textColorValue,
      }}
      title={[
        event.title,
        formatEventTime(displayStart, timeFormat),
        formatEventTime(displayEnd, timeFormat),
        event.location && `📍 ${event.location}`,
      ].filter(Boolean).join(' - ')}
    >
      {/* Event content */}
      <div className="event-content">
        <div className="font-medium truncate" style={{ color: textColorValue }}>
          {event.title}
        </div>
        <div className="text-[10px] opacity-90" style={{ color: textColorValue }}>
          {formatEventTime(displayStart, timeFormat)}
        </div>
        {/* Location or Description */}
        {(event.location || event.description) && (
          <div className="text-[10px] opacity-75 mt-0.5 truncate" style={{ color: textColorValue }}>
            {event.location ? (
              <span className="flex items-center gap-1">
                <span>📍</span>
                <span className="truncate">{event.location}</span>
              </span>
            ) : event.description ? (
              <span className="truncate">{event.description}</span>
            ) : null}
          </div>
        )}
      </div>
    </motion.div>
  );
}
