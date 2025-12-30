'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedCalendarViewProps {
  children: React.ReactNode;
  viewKey: string;
  className?: string;
}

/**
 * Wrapper component for animated calendar view transitions
 */
export function AnimatedCalendarView({
  children,
  viewKey,
  className,
}: AnimatedCalendarViewProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{
          duration: 0.3,
          ease: 'easeInOut',
        }}
        className={className}
        style={{ height: '100%', minHeight: 0 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

