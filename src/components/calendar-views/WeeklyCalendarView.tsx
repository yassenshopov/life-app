'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../HQCalendar';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import {
  isToday,
  isSameDay,
  eventOverlapsDay,
  getEventsForDay,
  getAllDayEventsForDay,
  getTimedEventsForDay,
  calculateEventPosition,
  formatTime,
  formatEventTime,
  generateTimeSlots,
  getWeekDays,
  formatDateHeader,
  PIXELS_PER_MINUTE,
} from '@/lib/calendar-utils';
import { CurrentTimeIndicator } from '@/components/calendar/CurrentTimeIndicator';
import { AnimatedCalendarEvent } from '@/components/calendar/AnimatedCalendarEvent';
import { AllDayEvents } from '@/components/calendar/AllDayEvents';
import { AnimatePresence } from 'framer-motion';

interface WeeklyCalendarViewProps {
  currentWeek: Date;
  events: CalendarEvent[];
  timeFormat: TimeFormat;
  onNavigate: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventUpdate?: (eventId: string, calendarId: string, startTime: Date, endTime: Date) => Promise<void>;
  onEmptySpaceClick?: (date: Date, time: Date) => void;
  previewEvent?: CalendarEvent | null;
}

export function WeeklyCalendarView({
  currentWeek,
  events,
  timeFormat,
  onNavigate,
  onEventClick,
  onEventUpdate,
  onEmptySpaceClick,
  previewEvent,
}: WeeklyCalendarViewProps) {
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
  
  // Scroll to current time on mount
  React.useEffect(() => {
    if (!scrollContainerRef.current) return;

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
  }, []);

  // Get the week days (Monday to Sunday)
  const weekDays = React.useMemo(() => getWeekDays(currentWeek), [currentWeek]);

  // Time slots from midnight (00:00) to 11 PM
  const timeSlots = React.useMemo(() => generateTimeSlots(), []);

  return (
    <div className="flex flex-col h-[600px]">
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day headers - Fixed */}
          <div
            className="grid border-b sticky top-0 z-10 bg-background"
            style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}
          >
            <div className="border-r p-2 bg-background text-foreground">
              <div className="text-xs text-muted-foreground font-medium mb-1">All Day</div>
            </div>
            {weekDays.map((day, index) => {
              const allDayEvents = getAllDayEventsForDay(events, day);
              return (
                <div
                  key={index}
                  className={cn(
                    'border-r flex flex-col',
                    isToday(day) && 'bg-blue-50 dark:bg-blue-950/20'
                  )}
                >
                  <div className="p-2 text-center">
                    <div className="text-xs text-muted-foreground font-medium">
                      {formatDateHeader(day)}
                    </div>
                    <div
                      className={cn(
                        'text-lg font-semibold mt-1',
                        isToday(day) && 'text-blue-600 dark:text-blue-400'
                      )}
                    >
                      {day.getDate()}
                    </div>
                  </div>
                  {/* All-day events */}
                  {allDayEvents.length > 0 && (
                    <AllDayEvents events={allDayEvents} className="flex-1" onEventClick={onEventClick} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Calendar grid - Scrollable */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar"
      >
        <div className="overflow-x-auto hide-scrollbar">
          <div className="min-w-[800px]">
            <div
              className="grid relative"
              style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}
            >
              {/* Time column */}
              <div className="border-r bg-background text-primary">
                {timeSlots.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-foreground/20 h-[45px] relative px-2"
                    style={{ minHeight: '45px' }}
                  >
                    <div className="absolute -top-2 right-2 text-xs text-foreground font-medium bg-background px-2">
                      {formatTime(hour, timeFormat)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, dayIndex) => {
                const dayEvents = getTimedEventsForDay(events, day);
                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      'border-r relative',
                      isToday(day) && 'bg-blue-50/30 dark:bg-blue-950/10'
                    )}
                  >
                    {/* Time slot grid - clickable for new events */}
                    {timeSlots.map((hour) => (
                      <div
                        key={hour}
                        className="border-b h-[45px] relative cursor-pointer hover:bg-accent/30 transition-colors"
                        style={{ minHeight: '45px' }}
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
                          const clickedTime = new Date(day);
                          clickedTime.setHours(0, 0, 0, 0);
                          clickedTime.setMinutes(minutes);
                          
                          onEmptySpaceClick(day, clickedTime);
                        }}
                      />
                    ))}

                    {/* Current time indicator */}
                    <CurrentTimeIndicator
                      currentDate={day}
                      columnIndex={dayIndex}
                      totalColumns={7}
                    />

                    {/* Events */}
                    <div className="absolute inset-0 pointer-events-none">
                      <AnimatePresence>
                        {dayEvents.map((event) => {
                          const style = calculateEventPosition(event, day);
                          return (
                            <AnimatedCalendarEvent
                              key={`${event.id}-${day.toISOString().split('T')[0]}`}
                              event={event}
                              style={style}
                              timeFormat={timeFormat}
                              onClick={onEventClick}
                              currentDate={day}
                            />
                          );
                        })}
                        {/* Preview event */}
                        {previewEvent && !previewEvent.isAllDay && eventOverlapsDay(previewEvent, day) && (
                          <AnimatedCalendarEvent
                            key={`${previewEvent.id}-preview-${day.toISOString().split('T')[0]}`}
                            event={previewEvent}
                            style={calculateEventPosition(previewEvent, day)}
                            timeFormat={timeFormat}
                            currentDate={day}
                            isPreview={true}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

