'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarEvent } from '@/components/HQCalendar';
import { cn } from '@/lib/utils';
import { getContrastTextColor } from '@/lib/color-utils';

interface AllDayEventsProps {
  events: CalendarEvent[];
  className?: string;
}

/**
 * Component to display all-day events in the calendar header
 */
export function AllDayEvents({ events, className }: AllDayEventsProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap gap-1 px-1 py-1', className)}>
      <AnimatePresence>
        {events.map((event) => {
          const bgColor = event.color || '#4285f4';
          const textColor = getContrastTextColor(bgColor);
          const textColorValue = textColor === 'dark' ? '#1f2937' : '#ffffff'; // gray-900 or white
          
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="flex-1 min-w-[100px] max-w-full rounded px-2 py-1 text-xs cursor-pointer hover:opacity-90 transition-opacity truncate"
              style={{
                backgroundColor: bgColor,
                color: textColorValue,
              }}
              title={event.title}
            >
              <span className="truncate block" style={{ color: textColorValue }}>
                {event.title}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

