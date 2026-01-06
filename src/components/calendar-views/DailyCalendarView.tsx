'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../HQCalendar';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import {
  isToday,
  isSameDay,
  getEventsForDay,
  getAllDayEventsForDay,
  getTimedEventsForDay,
  calculateEventPosition,
  groupOverlappingEvents,
  eventsTouch,
  formatTime,
  formatEventTime,
  generateTimeSlots,
  PIXELS_PER_MINUTE,
} from '@/lib/calendar-utils';
import { CurrentTimeIndicator } from '@/components/calendar/CurrentTimeIndicator';
import { AnimatedCalendarEvent } from '@/components/calendar/AnimatedCalendarEvent';
import { AllDayEvents } from '@/components/calendar/AllDayEvents';
import { AnimatePresence } from 'framer-motion';

interface DailyCalendarViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  timeFormat: TimeFormat;
  onNavigate: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventRightClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
  onEventUpdate?: (eventId: string, calendarId: string, startTime: Date, endTime: Date) => Promise<void>;
  onEmptySpaceClick?: (date: Date, time: Date) => void;
  previewEvent?: CalendarEvent | null;
  people?: Array<{ id: string; name: string; nicknames?: string[] | null; image?: any; image_url?: string | null }>;
  onPersonClick?: (person: { id: string; name: string; nicknames?: string[] | null; image?: any; image_url?: string | null }) => void;
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

export function DailyCalendarView({
  currentDate,
  events,
  timeFormat,
  onNavigate,
  onEventClick,
  onEventRightClick,
  onEventUpdate,
  onEmptySpaceClick,
  previewEvent,
  people = [],
  onPersonClick,
  colorPalette,
}: DailyCalendarViewProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Smooth scrolling implementation
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let isScrolling = false;
    let scrollTimeout: NodeJS.Timeout;
    let targetScrollTop = container.scrollTop;

    const smoothScroll = () => {
      if (Math.abs(container.scrollTop - targetScrollTop) < 1) {
        container.scrollTop = targetScrollTop;
        isScrolling = false;
        return;
      }

      const diff = targetScrollTop - container.scrollTop;
      container.scrollTop += diff * 0.1; // Smooth easing factor
      requestAnimationFrame(smoothScroll);
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      targetScrollTop += e.deltaY;
      targetScrollTop = Math.max(0, Math.min(targetScrollTop, container.scrollHeight - container.clientHeight));

      if (!isScrolling) {
        isScrolling = true;
        smoothScroll();
      }

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, 150);
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Allow native touch scrolling but make it smoother
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const currentScroll = container.scrollTop;
        const delta = touch.clientY - (container as any).lastTouchY;
        (container as any).lastTouchY = touch.clientY;
        
        targetScrollTop = currentScroll - delta;
        targetScrollTop = Math.max(0, Math.min(targetScrollTop, container.scrollHeight - container.clientHeight));
        
        if (!isScrolling) {
          isScrolling = true;
          smoothScroll();
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        (container as any).lastTouchY = e.touches[0].clientY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      clearTimeout(scrollTimeout);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);
  
  // Scroll to current time if viewing today
  React.useEffect(() => {
    if (!scrollContainerRef.current || !isToday(currentDate)) return;

    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const pixelsPerMinute = 45 / 60;
    const position = minutes * pixelsPerMinute;
    const scrollPosition = Math.max(0, position - 200);

    // Use smooth scroll animation
    const container = scrollContainerRef.current;
    const startScroll = container.scrollTop;
    const targetScroll = scrollPosition;
    const duration = 500;
    const startTime = Date.now();

    const animateScroll = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      
      container.scrollTop = startScroll + (targetScroll - startScroll) * ease;
      
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };

    requestAnimationFrame(animateScroll);
  }, [currentDate]);

  // Time slots from midnight (00:00) to 11 PM
  const timeSlots = React.useMemo(() => generateTimeSlots(), []);

  // Get all-day and timed events separately
  const allDayEvents = React.useMemo(
    () => getAllDayEventsForDay(events, currentDate),
    [events, currentDate]
  );
  
  const timedEvents = React.useMemo(
    () => getTimedEventsForDay(events, currentDate),
    [events, currentDate]
  );

  // Group overlapping events
  const overlappingGroups = React.useMemo(
    () => groupOverlappingEvents(timedEvents, currentDate),
    [timedEvents, currentDate]
  );

  const dateString = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-x-auto">
        <div className="min-w-[400px]">
          {/* Day header - Fixed */}
          <div 
            className="grid sticky top-0 z-10 transition-all duration-1000" 
            style={{
              gridTemplateColumns: '60px 1fr',
              borderBottom: colorPalette 
                ? `1px solid ${colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.2)')}`
                : undefined,
              ...(colorPalette ? {
                backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.1)'),
              } : { backgroundColor: 'hsl(var(--background))' })
            }}
          >
            <div 
              className="p-2 text-foreground transition-all duration-1000"
              style={colorPalette ? {
                backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.12)'),
                borderRight: `1px solid ${colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.2)')}`,
              } : undefined}
            >
              <div className="text-xs text-muted-foreground font-medium mb-1">All Day</div>
            </div>
            <div
              className={cn(
                'flex flex-col transition-all duration-1000',
                isToday(currentDate) && 'bg-blue-50 dark:bg-blue-950/20'
              )}
              style={colorPalette ? {
                ...(colorPalette && !isToday(currentDate) ? {
                  backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.08)'),
                } : {}),
                borderRight: `1px solid ${colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.2)')}`,
              } : undefined}
            >
              <div className="p-2 text-center">
                <div className="text-xs text-muted-foreground font-medium">{dateString}</div>
              </div>
              {/* All-day events */}
              {allDayEvents.length > 0 && (
                <AllDayEvents events={allDayEvents} className="flex-1" onEventClick={onEventClick} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar grid - Scrollable */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar"
      >
        <div className="overflow-x-auto hide-scrollbar">
          <div className="min-w-[400px]">
            <div className="grid relative" style={{ gridTemplateColumns: '60px 1fr' }}>
              {/* Time column */}
              <div 
                className="text-primary transition-all duration-1000"
                style={colorPalette ? {
                  backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.12)'),
                  borderRight: `1px solid ${colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.2)')}`,
                } : { backgroundColor: 'hsl(var(--background))' }}
              >
                {timeSlots.map((hour) => (
                  <div
                    key={hour}
                    className="h-[45px] relative px-2 transition-all duration-1000"
                    style={{ 
                      minHeight: '45px',
                      borderBottom: colorPalette 
                        ? `1px solid ${colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.15)')}`
                        : '1px solid hsl(var(--foreground) / 0.2)'
                    }}
                  >
                    <div 
                      className="absolute -top-2 right-2 text-xs text-foreground font-medium px-2 transition-all duration-1000"
                      style={colorPalette ? {
                        backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.12)'),
                      } : { backgroundColor: 'hsl(var(--background))' }}
                    >
                      {formatTime(hour, timeFormat)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Day column */}
              <div
                className={cn(
                  'relative transition-all duration-1000',
                  isToday(currentDate) && 'bg-blue-50/30 dark:bg-blue-950/10'
                )}
                style={colorPalette ? {
                  borderRight: `1px solid ${colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.2)')}`,
                } : undefined}
              >
                {/* Time slot grid - clickable for new events */}
                {timeSlots.map((hour) => (
                  <div
                    key={hour}
                    className="h-[45px] relative cursor-pointer hover:bg-accent/30 transition-all duration-1000"
                    style={{ 
                      minHeight: '45px',
                      borderBottom: colorPalette 
                        ? `1px solid ${colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.15)')}`
                        : '1px solid hsl(var(--foreground) / 0.2)'
                    }}
                    onClick={(e) => {
                      if (!onEmptySpaceClick) return;
                      
                      // Check if click is on empty space (not on an event)
                      const target = e.target as HTMLElement;
                      if (target.closest('.event-content') || target.closest('[style*="absolute"]')) {
                        return;
                      }

                      // Get the column element
                      const column = e.currentTarget.parentElement;
                      if (!column) return;
                      
                      const columnRect = column.getBoundingClientRect();
                      const scrollContainer = scrollContainerRef.current;
                      const scrollTop = scrollContainer?.scrollTop || 0;
                      
                      // Calculate mouse position relative to column top, accounting for scroll
                      const mouseY = e.clientY - columnRect.top + scrollTop;
                      
                      // Convert pixels to minutes (snap to 15-minute intervals)
                      const minutes = Math.max(0, Math.round((mouseY / PIXELS_PER_MINUTE) / 15) * 15);
                      
                      // Create date with the clicked time
                      const clickedTime = new Date(currentDate);
                      clickedTime.setHours(0, 0, 0, 0);
                      clickedTime.setMinutes(minutes);
                      
                      onEmptySpaceClick(currentDate, clickedTime);
                    }}
                  />
                ))}

                {/* Current time indicator */}
                <CurrentTimeIndicator currentDate={currentDate} />

                {/* Events */}
                <div className="absolute inset-0 pointer-events-none">
                  <AnimatePresence>
                    {timedEvents.map((event) => {
                      // Find the overlapping group this event belongs to
                      const overlappingGroup = overlappingGroups.find((group) =>
                        group.some((e) => e.id === event.id)
                      ) || [event];
                      
                      const style = calculateEventPosition(event, currentDate, overlappingGroup);
                      
                      // Check for touching events (check all day events, not just overlapping ones)
                      let touchingTop = false;
                      let touchingBottom = false;
                      for (const otherEvent of timedEvents) {
                        if (otherEvent.id === event.id) continue;
                        const touch = eventsTouch(event, otherEvent, currentDate);
                        if (touch.top) touchingTop = true;
                        if (touch.bottom) touchingBottom = true;
                      }
                      
                      return (
                        <AnimatedCalendarEvent
                          onRightClick={onEventRightClick}
                          key={event.id}
                          event={event}
                          style={style}
                          timeFormat={timeFormat}
                          onClick={onEventClick}
                          currentDate={currentDate}
                          touchingEvents={{ top: touchingTop, bottom: touchingBottom }}
                          people={people}
                          onPersonClick={onPersonClick}
                        />
                      );
                    })}
                    {/* Preview event */}
                    {previewEvent && !previewEvent.isAllDay && isSameDay(previewEvent.start, currentDate) && (
                      <AnimatedCalendarEvent
                        key={previewEvent.id}
                        event={previewEvent}
                        style={calculateEventPosition(previewEvent, currentDate)}
                        timeFormat={timeFormat}
                        currentDate={currentDate}
                        isPreview={true}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

