'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useCurrentTime } from '@/hooks/useCurrentTime';
import { isToday, PIXELS_PER_MINUTE } from '@/lib/calendar-utils';
import { cn } from '@/lib/utils';

interface CurrentTimeIndicatorProps {
  currentDate: Date;
  columnIndex?: number;
  totalColumns?: number;
  className?: string;
}

/**
 * Current time indicator line for daily and weekly calendar views
 */
export function CurrentTimeIndicator({
  currentDate,
  columnIndex = 0,
  totalColumns = 1,
  className,
}: CurrentTimeIndicatorProps) {
  const currentTime = useCurrentTime();
  const [position, setPosition] = React.useState(0);
  const isCurrentDay = isToday(currentDate);

  // Calculate position based on current time
  React.useEffect(() => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    setPosition(minutes * PIXELS_PER_MINUTE);
  }, [currentTime]);

  // Only show on today
  if (!isCurrentDay) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'absolute z-20 pointer-events-none',
        className
      )}
      style={{
        top: `${position}px`,
        left: 0,
        right: 0,
      }}
    >
      {/* Time line - spans full width of column, accounting for borders */}
      <div 
        className="h-0.5 bg-red-500 dark:bg-red-400" 
        style={{ 
          width: 'calc(100% + 1px)', // Extend slightly to cover border
          marginLeft: '-1px', // Offset to account for border
        }}
      >
        {/* Time dot - positioned on the left edge */}
        <motion.div
          className={cn(
            'absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500 dark:bg-red-400',
            'ring-2 ring-background'
          )}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
    </motion.div>
  );
}

