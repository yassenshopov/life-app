'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
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
  /** Called when user moves the event by dragging the block. Omit or use only in daily/weekly for timed events. */
  onMove?: (event: CalendarEvent, newStart: Date, newEnd: Date) => void;
  /** Optional: map (clientX, clientY) to drop target (e.g. for weekly view to resolve day + time). If omitted, move uses same day + vertical delta. */
  getDropTarget?: (clientX: number, clientY: number) => { date: Date; minutes: number } | null;
  /** Optional: return viewport (left, top) and optional width for the ghost at a snapped grid cell. When provided, ghost snaps to grid instead of following cursor. */
  getGhostPosition?: (
    date: Date,
    minutes: number
  ) => { left: number; top: number; width?: number } | null;
  /** Called when drag starts (so parent can hide all instances of this event in multi-column views). */
  onMoveStart?: (eventId: string) => void;
  /** Called when drag ends. */
  onMoveEnd?: () => void;
  /** When true, this instance is hidden (e.g. same event is being dragged from another column). */
  isBeingDragged?: boolean;
}

const MIN_DURATION_MINUTES = 15;
const SNAP_MINUTES = 15;
const DRAG_THRESHOLD_PX = 6;

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
  onMove,
  getDropTarget,
  getGhostPosition,
  onMoveStart,
  onMoveEnd,
  isBeingDragged = false,
}: AnimatedCalendarEventProps) {
  const bgColor = event.color || '#4285f4';

  /** Set on mousedown; drag only starts after pointer moves past DRAG_THRESHOLD_PX */
  const [pendingDrag, setPendingDrag] = React.useState<null | {
    startX: number;
    startY: number;
    startEventStart: Date;
    startEventEnd: Date;
    offsetX: number;
    offsetY: number;
    ghostWidth: number;
    ghostHeight: number;
  }>(null);

  const [moveState, setMoveState] = React.useState<null | {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    startEventStart: Date;
    startEventEnd: Date;
    /** Offset from event top-left to mousedown point (so ghost stays under cursor) */
    offsetX: number;
    offsetY: number;
    ghostWidth: number;
    ghostHeight: number;
  }>(null);

  /** Mutable ref for drag position so move listeners don't re-attach on every mousemove */
  const dragRef = React.useRef<null | {
    currentX: number;
    currentY: number;
    startX: number;
    startY: number;
    startEventStart: Date;
    startEventEnd: Date;
    offsetX: number;
    offsetY: number;
    ghostWidth: number;
    ghostHeight: number;
  }>(null);

  const [resizeState, setResizeState] = React.useState<null | {
    edge: 'top' | 'bottom';
    startY: number;
    currentY: number;
    startEventStart: Date;
    startEventEnd: Date;
  }>(null);

  const justResizedRef = React.useRef(false);
  const justMovedRef = React.useRef(false);

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

  const handleMoveStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onMove || isPreview || event.isAllDay) return;
      // Don't start move if user clicked on a resize handle
      const target = e.target as HTMLElement;
      if (
        target.closest('[aria-label="Resize event start"]') ||
        target.closest('[aria-label="Resize event end"]')
      ) {
        return;
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      setPendingDrag({
        startX: e.clientX,
        startY: e.clientY,
        startEventStart: new Date(event.start),
        startEventEnd: new Date(event.end),
        offsetX,
        offsetY,
        ghostWidth: rect.width,
        ghostHeight: rect.height,
      });
    },
    [onMove, isPreview, event.isAllDay, event.start, event.end]
  );

  React.useEffect(() => {
    if (!pendingDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - pendingDrag.startX;
      const dy = e.clientY - pendingDrag.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance >= DRAG_THRESHOLD_PX) {
        setMoveState({
          ...pendingDrag,
          currentX: e.clientX,
          currentY: e.clientY,
        });
        onMoveStart?.(event.id);
        setPendingDrag(null);
      }
    };

    const handleMouseUp = () => {
      setPendingDrag(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [pendingDrag, onMoveStart, event.id]);

  React.useEffect(() => {
    if (!moveState) return;

    dragRef.current = {
      currentX: moveState.currentX,
      currentY: moveState.currentY,
      startX: moveState.startX,
      startY: moveState.startY,
      startEventStart: moveState.startEventStart,
      startEventEnd: moveState.startEventEnd,
      offsetX: moveState.offsetX,
      offsetY: moveState.offsetY,
      ghostWidth: moveState.ghostWidth,
      ghostHeight: moveState.ghostHeight,
    };

    let rafId = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const ref = dragRef.current;
      if (!ref) return;
      ref.currentX = e.clientX;
      ref.currentY = e.clientY;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        setMoveState((prev) =>
          prev && dragRef.current
            ? { ...prev, currentX: dragRef.current!.currentX, currentY: dragRef.current!.currentY }
            : null
        );
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const ref = dragRef.current;
      if (!ref) {
        setMoveState(null);
        return;
      }

      const durationMs =
        ref.startEventEnd.getTime() - ref.startEventStart.getTime();
      const durationMinutes = durationMs / (1000 * 60);

      let newStart: Date;
      let newEnd: Date;

      if (getDropTarget) {
        const target = getDropTarget(e.clientX, e.clientY);
        if (target) {
          newStart = new Date(target.date);
          newStart.setHours(0, 0, 0, 0);
          const snappedMinutes = Math.max(
            0,
            Math.min(24 * 60 - 1, Math.round(target.minutes / SNAP_MINUTES) * SNAP_MINUTES)
          );
          newStart.setMinutes(snappedMinutes);
          newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);
        } else {
          onMoveEnd?.();
          setMoveState(null);
          dragRef.current = null;
          return;
        }
      } else {
        const deltaPx = e.clientY - ref.startY;
        const deltaMinutes = deltaPx / PIXELS_PER_MINUTE;
        const startMinutesFromMidnight =
          ref.startEventStart.getHours() * 60 + ref.startEventStart.getMinutes();
        const endMinutesFromMidnight =
          ref.startEventEnd.getHours() * 60 + ref.startEventEnd.getMinutes();
        const newStartMinutes = Math.max(
          0,
          Math.min(
            24 * 60 - 1 - durationMinutes,
            Math.round((startMinutesFromMidnight + deltaMinutes) / SNAP_MINUTES) * SNAP_MINUTES
          )
        );
        const newEndMinutes = Math.min(
          24 * 60 - 1,
          newStartMinutes + Math.round(durationMinutes / SNAP_MINUTES) * SNAP_MINUTES
        );
        newStart = new Date(ref.startEventStart);
        newStart.setHours(0, 0, 0, 0);
        newStart.setMinutes(newStartMinutes);
        newEnd = new Date(ref.startEventStart);
        newEnd.setHours(0, 0, 0, 0);
        newEnd.setMinutes(newEndMinutes);
      }

      justMovedRef.current = true;
      onMoveEnd?.();
      onMove?.(event, newStart, newEnd);
      setMoveState(null);
      dragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [!!moveState, onMove, onMoveEnd, getDropTarget, event]);

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
      onResize?.(event, newStart, newEnd);
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
  const canMove = Boolean(onMove && !isPreview && !event.isAllDay);
  const textColor = getContrastTextColor(bgColor);
  const textColorValue = textColor === 'dark' ? '#1f2937' : '#ffffff'; // gray-900 or white

  const handleClick = (e: React.MouseEvent) => {
    if (justResizedRef.current) {
      justResizedRef.current = false;
      return;
    }
    if (justMovedRef.current) {
      justMovedRef.current = false;
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

  const ghostPlacement = React.useMemo(() => {
    if (!moveState) return null;
    const durationMinutes =
      (moveState.startEventEnd.getTime() - moveState.startEventStart.getTime()) / (1000 * 60);
    const ghostHeightSnapped = durationMinutes * PIXELS_PER_MINUTE;

    if (getDropTarget && getGhostPosition) {
      const target = getDropTarget(moveState.currentX, moveState.currentY);
      if (target) {
        const pos = getGhostPosition(target.date, target.minutes);
        if (pos) {
          return {
            left: pos.left,
            top: pos.top,
            width: pos.width ?? moveState.ghostWidth,
            height: ghostHeightSnapped,
          };
        }
      }
    }
    return {
      left: moveState.currentX - moveState.offsetX,
      top: moveState.currentY - moveState.offsetY,
      width: moveState.ghostWidth,
      height: moveState.ghostHeight,
    };
  }, [moveState, getDropTarget, getGhostPosition]);

  /** Preview start/end for the ghost label while dragging (updates with drop target). */
  const ghostTimePreview = React.useMemo(() => {
    if (!moveState) return null;
    const durationMs =
      moveState.startEventEnd.getTime() - moveState.startEventStart.getTime();
    const durationMinutes = durationMs / (1000 * 60);

    if (getDropTarget) {
      const target = getDropTarget(moveState.currentX, moveState.currentY);
      if (target) {
        const snappedMinutes = Math.max(
          0,
          Math.min(
            24 * 60 - 1,
            Math.round(target.minutes / SNAP_MINUTES) * SNAP_MINUTES
          )
        );
        const previewStart = new Date(target.date);
        previewStart.setHours(0, 0, 0, 0);
        previewStart.setMinutes(snappedMinutes);
        const previewEnd = new Date(previewStart.getTime() + durationMinutes * 60 * 1000);
        return { start: previewStart, end: previewEnd };
      }
    }
    return { start: new Date(moveState.startEventStart), end: new Date(moveState.startEventEnd) };
  }, [moveState, getDropTarget]);

  const dragGhost =
    typeof document !== 'undefined' &&
    moveState &&
    ghostPlacement &&
    createPortal(
      <div
        aria-hidden
        className="rounded px-2 text-xs overflow-hidden pointer-events-none"
        style={{
          position: 'fixed',
          left: ghostPlacement.left,
          top: ghostPlacement.top,
          width: ghostPlacement.width,
          height: ghostPlacement.height,
          backgroundColor: bgColor,
          color: textColorValue,
          zIndex: 10000,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          opacity: 0.98,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          paddingLeft: '0.5rem',
          paddingRight: '0.5rem',
          paddingTop: showExtraInfo ? '0.25rem' : '0.125rem',
        }}
      >
        <div className="font-medium truncate" style={{ color: textColorValue }}>
          {event.title}
        </div>
        <div className="text-[10px] opacity-90 truncate" style={{ color: textColorValue }}>
          {ghostTimePreview
            ? `${formatEventTime(ghostTimePreview.start, timeFormat)} – ${formatEventTime(ghostTimePreview.end, timeFormat)}`
            : formatEventTime(timeToDisplay, timeFormat)}
        </div>
      </div>,
      document.body
    );

  return (
    <>
      {dragGhost}
      <motion.div
      data-calendar-event="true"
      initial={{ opacity: 0, scale: 0.95, y: -5 }}
      animate={{
        opacity: moveState || isBeingDragged ? 0 : isPreview ? 0.4 : 1,
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
      onMouseDown={canMove ? handleMoveStart : undefined}
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
          : canMove
            ? moveState
              ? 'cursor-grabbing'
              : 'cursor-grab hover:opacity-90 transition-opacity'
            : 'cursor-pointer hover:opacity-90 transition-opacity'
      )}
      style={{
        ...effectiveStyle,
        ...(moveState || isBeingDragged ? { opacity: 0, pointerEvents: 'none' } : {}),
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const synthetic = { preventDefault: () => {}, stopPropagation: () => {}, clientY: rect.top } as React.MouseEvent;
                handleResizeStart('top', synthetic);
              }
            }}
          />
          <div
            role="button"
            tabIndex={0}
            aria-label="Resize event end"
            className="absolute left-0 right-0 bottom-0 h-2 cursor-s-resize z-10"
            style={{ marginBottom: -2 }}
            onMouseDown={(e) => handleResizeStart('bottom', e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const synthetic = { preventDefault: () => {}, stopPropagation: () => {}, clientY: rect.bottom } as React.MouseEvent;
                handleResizeStart('bottom', synthetic);
              }
            }}
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
          {formatEventTime(eventStart, timeFormat)} – {formatEventTime(eventEnd, timeFormat)}
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
    </>
  );
}
