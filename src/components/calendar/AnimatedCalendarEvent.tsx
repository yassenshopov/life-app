'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/components/HQCalendar';
import { formatEventTime, PIXELS_PER_MINUTE } from '@/lib/calendar-utils';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import { getContrastTextColor } from '@/lib/color-utils';
import { getMatchedPeopleFromEvent, Person } from '@/lib/people-matching';
import { PersonAvatar } from './PersonAvatar';

interface AnimatedCalendarEventProps {
  event: CalendarEvent;
  style: React.CSSProperties;
  timeFormat: TimeFormat;
  onClick?: (event: CalendarEvent) => void;
  onRightClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
  currentDate?: Date; // The date of the column this event is in (for calculating absolute position)
  isPreview?: boolean;
  touchingEvents?: {
    top?: boolean; // Event touches this one from above
    bottom?: boolean; // Event touches this one from below
  };
  people?: Person[];
  onPersonClick?: (person: Person) => void;
  /** Called when user resizes the event by dragging top or bottom edge. Omit or use only in daily/weekly for timed events. */
  onResize?: (event: CalendarEvent, newStart: Date, newEnd: Date) => void;
}

/**
 * Animated calendar event component
 */
export function AnimatedCalendarEvent({
  event,
  style,
  timeFormat,
  onClick,
  onRightClick,
  currentDate,
  isPreview = false,
  touchingEvents,
  people = [],
  onPersonClick,
  onResize,
}: AnimatedCalendarEventProps) {
  const bgColor = event.color || '#4285f4';
  const MIN_DURATION_MINUTES = 15;
  const SNAP_MINUTES = 15;

  const [resizeState, setResizeState] = React.useState<null | {
    edge: 'top' | 'bottom';
    startY: number;
    currentY: number;
    startEventStart: Date;
    startEventEnd: Date;
  }>(null);

  const handleResizeStart = React.useCallback(
    (edge: 'top' | 'bottom', e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onResize || isPreview || event.isAllDay) return;
      setResizeState({
        edge,
        startY: e.clientY,
        currentY: e.clientY,
        startEventStart: new Date(event.start),
        startEventEnd: new Date(event.end),
      });
    },
    [onResize, isPreview, event.isAllDay, event.start, event.end]
  );

  React.useEffect(() => {
    if (!resizeState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setResizeState((prev) => (prev ? { ...prev, currentY: e.clientY } : null));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!resizeState) return;
      const deltaPx = e.clientY - resizeState.startY;
      const deltaMinutes = deltaPx / PIXELS_PER_MINUTE;

      const snapToMinutes = (date: Date, minutesFromMidnight: number) => {
        const snapped = Math.round(minutesFromMidnight / SNAP_MINUTES) * SNAP_MINUTES;
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        d.setMinutes(Math.max(0, Math.min(24 * 60 - 1, snapped)));
        return d;
      };

      let newStart: Date;
      let newEnd: Date;

      if (resizeState.edge === 'top') {
        const startMinutesFromMidnight =
          resizeState.startEventStart.getHours() * 60 +
          resizeState.startEventStart.getMinutes() +
          deltaMinutes;
        const endMinutesFromMidnight =
          resizeState.startEventEnd.getHours() * 60 + resizeState.startEventEnd.getMinutes();
        const snappedStart = Math.min(
          Math.max(0, Math.round(startMinutesFromMidnight / SNAP_MINUTES) * SNAP_MINUTES),
          endMinutesFromMidnight - MIN_DURATION_MINUTES
        );
        newStart = snapToMinutes(resizeState.startEventStart, snappedStart);
        newEnd = new Date(resizeState.startEventEnd);
      } else {
        const startMinutesFromMidnight =
          resizeState.startEventStart.getHours() * 60 + resizeState.startEventStart.getMinutes();
        const endMinutesFromMidnight =
          resizeState.startEventEnd.getHours() * 60 +
          resizeState.startEventEnd.getMinutes() +
          deltaMinutes;
        const snappedEnd = Math.max(
          Math.round(endMinutesFromMidnight / SNAP_MINUTES) * SNAP_MINUTES,
          startMinutesFromMidnight + MIN_DURATION_MINUTES
        );
        const dayEndMinutes = 24 * 60 - 1;
        const clampedEnd = Math.min(snappedEnd, dayEndMinutes);
        newStart = new Date(resizeState.startEventStart);
        newEnd = snapToMinutes(resizeState.startEventEnd, clampedEnd);
      }

      justResizedRef.current = true;
      onResize(event, newStart, newEnd);
      setResizeState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeState, onResize, event]);

  const canResize = Boolean(onResize && !isPreview && !event.isAllDay);
  const justResizedRef = React.useRef(false);
  const textColor = getContrastTextColor(bgColor);
  const textColorValue = textColor === 'dark' ? '#1f2937' : '#ffffff'; // gray-900 or white

  const handleClick = (e: React.MouseEvent) => {
    if (justResizedRef.current) {
      justResizedRef.current = false;
      return;
    }
    if (!isPreview) {
      onClick?.(event);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isPreview && onRightClick) {
      e.preventDefault();
      e.stopPropagation();
      onRightClick(event, e);
    }
  };

  // Calculate the actual display times for this day (handles multi-day events)
  const currentDay = currentDate || new Date(event.start);
  const dayStart = new Date(currentDay);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(currentDay);
  dayEnd.setHours(23, 59, 59, 999);

  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);

  // For multi-day events, show only the portion visible on this day
  const displayStart = eventStart > dayStart ? eventStart : dayStart;
  const displayEnd = eventEnd < dayEnd ? eventEnd : dayEnd;

  // Always show the original event start time (not the portion start time)
  const timeToDisplay = eventStart;

  // Calculate event duration in minutes to determine if we should show description/location
  const durationMinutes = (displayEnd.getTime() - displayStart.getTime()) / (1000 * 60);
  const showExtraInfo = durationMinutes > 60; // Only show if > 1 hour (not exactly 1 hour)

  // Only use linked people from database (explicitly tagged people)
  const matchedPeople = React.useMemo(() => {
    if (event.linkedPeople && event.linkedPeople.length > 0) {
      return event.linkedPeople;
    }
    return [];
  }, [event.linkedPeople]);

  // Live preview style during resize (in-between states while dragging)
  const effectiveStyle = React.useMemo(() => {
    if (!resizeState) return style;
    const startMinutes =
      resizeState.startEventStart.getHours() * 60 + resizeState.startEventStart.getMinutes();
    const endMinutes =
      resizeState.startEventEnd.getHours() * 60 + resizeState.startEventEnd.getMinutes();
    const deltaPx = resizeState.currentY - resizeState.startY;
    const deltaMinutes = deltaPx / PIXELS_PER_MINUTE;
    const minHeightPx = MIN_DURATION_MINUTES * PIXELS_PER_MINUTE;

    if (resizeState.edge === 'bottom') {
      const previewDuration = endMinutes - startMinutes + deltaMinutes;
      const clampedDuration = Math.max(previewDuration, MIN_DURATION_MINUTES);
      const heightPx = Math.max(clampedDuration * PIXELS_PER_MINUTE, minHeightPx);
      return { ...style, top: style.top, height: `${heightPx}px` };
    } else {
      const previewStart = startMinutes + deltaMinutes;
      const previewEnd = endMinutes;
      const clampedStart = Math.max(0, Math.min(previewStart, previewEnd - MIN_DURATION_MINUTES));
      const clampedDuration = Math.max(previewEnd - clampedStart, MIN_DURATION_MINUTES);
      const topPx = clampedStart * PIXELS_PER_MINUTE;
      const heightPx = clampedDuration * PIXELS_PER_MINUTE;
      return { ...style, top: `${topPx}px`, height: `${heightPx}px` };
    }
  }, [style, resizeState]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -5 }}
      animate={{
        opacity: isPreview ? 0.4 : 1,
        scale: 1,
        y: 0,
      }}
      exit={{ opacity: 0, scale: 0.95, y: -5 }}
      transition={{
        duration: 0.2,
        ease: 'easeOut',
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        'absolute left-1 right-1 px-2 text-xs pointer-events-auto overflow-hidden',
        // Less padding for short events (<=1hr)
        showExtraInfo ? 'py-1' : 'py-0.5',
        // Apply rounded corners conditionally based on touching events
        !touchingEvents?.top && !touchingEvents?.bottom && 'rounded',
        !touchingEvents?.top && touchingEvents?.bottom && 'rounded-t',
        touchingEvents?.top && !touchingEvents?.bottom && 'rounded-b',
        // No rounded corners if touching both sides
        isPreview
          ? 'cursor-default border-2 border-dashed'
          : 'cursor-pointer hover:opacity-90 transition-opacity'
      )}
      style={{
        ...effectiveStyle,
        backgroundColor: isPreview ? `${bgColor}40` : bgColor,
        color: textColorValue,
        borderColor: isPreview ? bgColor : undefined,
      }}
      title={[
        event.title,
        formatEventTime(displayStart, timeFormat),
        formatEventTime(displayEnd, timeFormat),
        event.location && `📍 ${event.location}`,
      ]
        .filter(Boolean)
        .join(' - ')}
    >
      {/* Resize handles - top and bottom borders */}
      {canResize && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="Resize event start"
            className="absolute left-0 right-0 top-0 h-2 cursor-n-resize z-10"
            style={{ marginTop: -2 }}
            onMouseDown={(e) => handleResizeStart('top', e)}
          />
          <div
            role="button"
            tabIndex={0}
            aria-label="Resize event end"
            className="absolute left-0 right-0 bottom-0 h-2 cursor-n-resize z-10"
            style={{ marginBottom: -2 }}
            onMouseDown={(e) => handleResizeStart('bottom', e)}
          />
        </>
      )}
      {/* Event content */}
      <div className="event-content overflow-hidden">
        <div
          className={cn(
            'font-medium flex items-center gap-1.5',
            showExtraInfo
              ? 'text-xs break-words' // Allow wrapping for >1hr events
              : 'text-[10px] truncate' // Single line truncate for <=1hr events
          )}
          style={{
            color: textColorValue,
            wordBreak: showExtraInfo ? 'break-word' : undefined,
            overflowWrap: showExtraInfo ? 'break-word' : undefined,
          }}
        >
          {/* Person avatars - to the left of the title, overlapping */}
          {matchedPeople.length > 0 && (
            <div className="flex items-center flex-shrink-0" style={{ marginRight: '4px' }}>
              {matchedPeople.map((person, index) => (
                <div
                  key={person.id}
                  style={{
                    marginLeft: index > 0 ? '-8px' : '0',
                    zIndex: matchedPeople.length - index,
                  }}
                  className="relative"
                >
                  <PersonAvatar person={person} size="sm" onClick={() => onPersonClick?.(person)} />
                </div>
              ))}
            </div>
          )}
          <span className={cn(showExtraInfo ? '' : 'truncate', 'flex-1')}>{event.title}</span>
        </div>
        <div
          className={cn('opacity-90 truncate', showExtraInfo ? 'text-[10px]' : 'text-[9px]')}
          style={{ color: textColorValue }}
        >
          {formatEventTime(timeToDisplay, timeFormat)}
        </div>
        {/* Location or Description - only show if event is >= 1 hour */}
        {showExtraInfo && (event.location || event.description) && (
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
