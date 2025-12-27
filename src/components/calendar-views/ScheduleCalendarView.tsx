'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../HQCalendar';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import { 
  MapPin, 
  Users, 
  MoreVertical
} from 'lucide-react';
import { getContrastTextColor } from '@/lib/color-utils';
import DOMPurify from 'dompurify';
import { Person, getMatchedPeopleFromEvent } from '@/lib/people-matching';
import { PersonAvatar } from '@/components/calendar/PersonAvatar';

// Helper function to get matched people from event (prioritizes linkedPeople)
const getEventPeople = (event: CalendarEvent, people: Person[]): Person[] => {
  // Prefer linked people from database
  if (event.linkedPeople && event.linkedPeople.length > 0) {
    // Convert linkedPeople format to Person format for PersonAvatar
    return event.linkedPeople.map(lp => ({
      id: lp.id,
      name: lp.name,
      image_url: lp.image_url,
      image: lp.image,
    })) as Person[];
  }
  // Fallback to title matching
  if (!people || people.length === 0) return [];
  return getMatchedPeopleFromEvent(event.title, people);
};

interface ScheduleCalendarViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  timeFormat: TimeFormat;
  onNavigate: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
  people?: Person[];
  onPersonClick?: (person: Person) => void;
}

export interface ScheduleCalendarViewRef {
  scrollToToday: () => void;
}

export const ScheduleCalendarView = React.forwardRef<ScheduleCalendarViewRef, ScheduleCalendarViewProps>(({
  currentDate,
  events,
  timeFormat,
  onNavigate,
  onEventClick,
  people = [],
  onPersonClick,
}, ref) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const todayElementRef = React.useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = React.useState(new Date());

  // Update current time every minute to refresh active event highlighting
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Expose scrollToToday method via ref
  React.useImperativeHandle(ref, () => ({
    scrollToToday: () => {
      if (todayElementRef.current && scrollContainerRef.current) {
        todayElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
  }));
  // Split sleep events into "Go to sleep" and "Wake up" entries
  const preprocessSleepEvents = (events: CalendarEvent[]): CalendarEvent[] => {
    const processed: CalendarEvent[] = [];
    
    for (const event of events) {
      const titleLower = event.title.toLowerCase();
      // Check if this is a sleep event
      if (titleLower.includes('sleep') && !event.isAllDay) {
        // Calculate original sleep duration
        const sleepDurationMs = event.end.getTime() - event.start.getTime();
        
        // Create "Go to sleep" entry at start time (point-in-time to avoid nesting)
        const goToSleepEvent: CalendarEvent & { _sleepDuration?: number } = {
          ...event,
          id: `${event.id}-sleep-start`,
          title: 'Go to sleep',
          start: new Date(event.start),
          end: new Date(event.start), // Point-in-time to avoid nesting
          _sleepDuration: sleepDurationMs, // Store original duration for display
        };
        
        // Create "Wake up" entry at end time (point-in-time to avoid nesting)
        const wakeUpEvent: CalendarEvent & { _sleepDuration?: number } = {
          ...event,
          id: `${event.id}-sleep-end`,
          title: 'Wake up',
          start: new Date(event.end),
          end: new Date(event.end), // Point-in-time to avoid nesting
          _sleepDuration: sleepDurationMs, // Store original duration for display
        };
        
        processed.push(goToSleepEvent, wakeUpEvent);
      } else {
        processed.push(event);
      }
    }
    
    return processed;
  };

  // Get events for the next 30 days, grouped by day
  const groupedEvents = React.useMemo(() => {
    const startDate = new Date(currentDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 30);

    // Preprocess events to split sleep events BEFORE grouping
    const preprocessedEvents = preprocessSleepEvents(events);

    const grouped: Map<string, CalendarEvent[]> = new Map();

    // Initialize all days in range
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      grouped.set(dateKey, []);
    }

    // Add events to their respective days
    preprocessedEvents
      .filter((event) => {
        const eventDate = new Date(event.start);
        return eventDate >= startDate && eventDate < endDate;
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .forEach((event) => {
        const eventDate = new Date(event.start);
        const dateKey = eventDate.toISOString().split('T')[0];
        const dayEvents = grouped.get(dateKey) || [];
        dayEvents.push(event);
        grouped.set(dateKey, dayEvents);
      });

    return grouped;
  }, [events, currentDate]);

  // Format time for event display
  const formatEventTime = (date: Date) => {
    if (timeFormat === '24h') {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDateHeader = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const dateStr = date.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateStr === todayStr) {
      return 'Today';
    } else if (dateStr === tomorrowStr) {
      return 'Tomorrow';
    } else if (dateStr === yesterdayStr) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Check if an event is currently happening (for today only)
  const isEventActive = (event: CalendarEvent, date: Date): boolean => {
    if (!isToday(date) || event.isAllDay) return false;
    return event.start <= currentTime && currentTime <= event.end;
  };

  // Check if any event is currently active for a given day
  const hasActiveEvent = (events: CalendarEvent[], date: Date): boolean => {
    if (!isToday(date)) return false;
    return events.some(event => isEventActive(event, date));
  };

  // Safely sanitize and format description text
  const sanitizeDescription = (description: string | null | undefined): string => {
    if (!description) {
      return '';
    }

    // Sanitize HTML by stripping all tags and attributes
    const sanitized = DOMPurify.sanitize(description, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
    });

    // Decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = sanitized;
    const decoded = textarea.value;

    // Truncate to 100 characters
    if (decoded.length > 100) {
      return decoded.substring(0, 100) + '...';
    }

    return decoded;
  };

  // Check if event A is fully contained within event B
  const isEventContained = (eventA: CalendarEvent, eventB: CalendarEvent): boolean => {
    if (eventA.id === eventB.id) return false;
    if (eventA.isAllDay || eventB.isAllDay) return false; // Don't nest all-day events
    
    const aStart = eventA.start.getTime();
    const aEnd = eventA.end.getTime();
    const bStart = eventB.start.getTime();
    const bEnd = eventB.end.getTime();
    
    return bStart <= aStart && aEnd <= bEnd;
  };

  // Organize events into parent-child relationships
  const organizeEvents = (events: CalendarEvent[]): Array<CalendarEvent & { children?: CalendarEvent[] }> => {
    if (events.length === 0) return [];
    
    const organized: Array<CalendarEvent & { children?: CalendarEvent[] }> = [];
    const processed = new Set<string>();
    
    // Sort by start time, then by duration (longer first) to prioritize parent events
    const sorted = [...events].sort((a, b) => {
      const startDiff = a.start.getTime() - b.start.getTime();
      if (startDiff !== 0) return startDiff;
      // Longer events first (they're more likely to be parents)
      const aDuration = a.end.getTime() - a.start.getTime();
      const bDuration = b.end.getTime() - b.start.getTime();
      return bDuration - aDuration;
    });
    
    for (const event of sorted) {
      if (processed.has(event.id)) continue;
      
      // Find all events contained within this event
      const children = sorted.filter(e => 
        !processed.has(e.id) && 
        e.id !== event.id && 
        isEventContained(e, event)
      );
      
      if (children.length > 0) {
        // Mark children as processed
        children.forEach(child => processed.add(child.id));
        organized.push({ ...event, children });
      } else {
        // Check if this event is contained in any existing parent
        let addedToParent = false;
        for (const parent of organized) {
          if (isEventContained(event, parent)) {
            if (!parent.children) parent.children = [];
            parent.children.push(event);
            addedToParent = true;
            break;
          }
        }
        if (!addedToParent) {
          organized.push(event);
        }
      }
      
      processed.add(event.id);
    }
    
    return organized;
  };


  const sortedDates = Array.from(groupedEvents.keys()).sort();

  return (
    <div className="flex flex-col h-[600px]">
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <div className="p-4 space-y-6 max-w-2xl mx-auto">
          {sortedDates.map((dateKey) => {
            const date = new Date(dateKey);
            const dayEvents = groupedEvents.get(dateKey) || [];

            if (dayEvents.length === 0) {
              return null;
            }

            const isTodayDate = isToday(date);

            return (
              <div 
                key={dateKey} 
                ref={isTodayDate ? todayElementRef : undefined}
                className="space-y-2"
              >
                <div
                  className={cn(
                    'text-sm font-semibold mb-4 pb-2 border-b',
                    isTodayDate && 'text-blue-600 dark:text-blue-400'
                  )}
                >
                  {formatDateHeader(date)}
                </div>
                
                {/* Timeline container */}
                <div className="relative">
                  {(() => {
                    const organizedEvents = organizeEvents(dayEvents);
                    // Show timeline only if there are 2+ top-level events (events without parents)
                    const showTimeline = organizedEvents.length > 1;
                    
                    return (
                      <>
                        {/* Vertical timeline line connecting all events - centered with circles */}
                        {showTimeline && (
                          <div 
                            className="absolute w-0.5 bg-border/50"
                            style={{ 
                              left: '88px', // Center of circle: 64px (w-16 time) + 8px (gap-2) + 16px (half of w-8 circle) = 88px
                              top: '20px',
                              // Extend to near bottom, stopping 16px from bottom to center on last circle
                              bottom: '16px', // Half of circle radius (32px / 2) to center on last circle
                            }}
                          />
                        )}
                        
                        <div className="space-y-4 relative" ref={scrollContainerRef}>
                          {/* Show unscheduled time block if no event is active on today */}
                          {isTodayDate && !hasActiveEvent(organizedEvents, date) && (
                            <div className="flex items-start gap-4 relative">
                              {/* Left side: Time and Icon */}
                              <div className="flex-shrink-0 flex items-center gap-2">
                                {/* Time */}
                                <div className="text-xs font-medium text-muted-foreground w-16 text-right">
                                  <span>{formatEventTime(currentTime)}</span>
                                </div>
                                
                                {/* Empty circle indicator */}
                                <div className="relative z-10 w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/30 bg-transparent" />
                              </div>
                              
                              {/* Right side: Unscheduled time block */}
                              <div className="flex-1 min-w-0 bg-muted/30 border border-dashed border-muted-foreground/30 rounded-lg p-3">
                                <div className="text-xs text-muted-foreground italic">
                                  Unscheduled time
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {organizedEvents.map((event, eventIndex) => {
                            const eventColor = event.color || '#4285f4';
                            const isAllDay = event.isAllDay || false;
                            // Use linked people from database (if available), otherwise fall back to title matching
                            const matchedPeople = getEventPeople(event, people);
                            const hasChildren = event.children && event.children.length > 0;
                            const isActive = isEventActive(event, date);
                            
                            // Calculate duration (use stored sleep duration if available)
                            const eventWithSleep = event as CalendarEvent & { _sleepDuration?: number };
                            const durationMs = eventWithSleep._sleepDuration ?? (event.end.getTime() - event.start.getTime());
                            const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
                            const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                            const durationText = durationHours > 0 
                              ? `${durationHours} hr ${durationMinutes > 0 ? `${durationMinutes} mins` : ''}`.trim()
                              : `${durationMinutes} mins`;

                            return (
                              <div
                                key={event.id}
                                className="flex items-start gap-4 relative group"
                              >
                                {/* Left side: Time and Icon */}
                                <div className="flex-shrink-0 flex items-center gap-2">
                                  {/* Time */}
                                  <div className="text-xs font-medium text-muted-foreground w-16 text-right">
                                    {isAllDay ? (
                                      <span>All day</span>
                                    ) : (
                                      <span>{formatEventTime(event.start)}</span>
                                    )}
                                  </div>
                                  
                                  {/* Colored circle */}
                                  <div
                                    className="relative z-10 w-8 h-8 rounded-full border-2 border-background shadow-sm"
                                    style={{ backgroundColor: eventColor }}
                                  />
                                </div>
                                
                                {/* Right side: Event card */}
                                <div
                                  className="flex-1 min-w-0 bg-card border rounded-lg p-3 cursor-pointer transition-all hover:border-primary/50"
                                  style={{
                                    borderWidth: isActive ? '2px' : '1px',
                                    borderColor: isActive ? eventColor : undefined,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onEventClick) {
                                      onEventClick(event);
                                    } else {
                                      onNavigate(new Date(event.start));
                                    }
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    {/* Title and details */}
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                      <div className="flex items-center gap-2">
                                        {matchedPeople.length > 0 && (
                                          <div className="flex items-center flex-shrink-0 -space-x-2">
                                            {matchedPeople.map((person: Person, idx: number) => (
                                              <div
                                                key={person.id}
                                                className="relative z-10"
                                                style={{
                                                  zIndex: matchedPeople.length - idx,
                                                }}
                                              >
                                                <PersonAvatar
                                                  person={person}
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    onPersonClick?.(person);
                                                  }}
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        <h3 className="font-semibold text-sm text-foreground truncate">
                                          {event.title}
                                        </h3>
                                      </div>
                                      
                                      {/* Duration */}
                                      {!isAllDay && durationText && (
                                        <div className="text-xs text-muted-foreground">
                                          {durationText}
                                        </div>
                                      )}
                                      
                                      {/* Additional info */}
                                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                                        {event.location && (
                                          <div className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            <span className="truncate max-w-[200px]">{event.location}</span>
                                          </div>
                                        )}
                                        
                                        {event.attendees && event.attendees.length > 0 && (
                                          <div className="flex items-center gap-1">
                                            <Users className="h-3 w-3" />
                                            <span>{event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}</span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Description preview */}
                                      {event.description && (
                                        <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                          {sanitizeDescription(event.description)}
                                        </div>
                                      )}
                                      
                                      {/* Nested events as sub-items */}
                                      {hasChildren && (
                                        <div className="mt-3 pt-3 border-t space-y-2">
                                          {event.children!.map((childEvent) => {
                                            const childColor = childEvent.color || '#4285f4';
                                            // Use linked people from database (if available), otherwise fall back to title matching
                                            const childMatchedPeople = getEventPeople(childEvent, people);
                                            const childDurationMs = childEvent.end.getTime() - childEvent.start.getTime();
                                            const childDurationHours = Math.floor(childDurationMs / (1000 * 60 * 60));
                                            const childDurationMinutes = Math.floor((childDurationMs % (1000 * 60 * 60)) / (1000 * 60));
                                            const childDurationText = childDurationHours > 0 
                                              ? `${childDurationHours} hr ${childDurationMinutes > 0 ? `${childDurationMinutes} mins` : ''}`.trim()
                                              : `${childDurationMinutes} mins`;
                                            
                                            return (
                                              <div
                                                key={childEvent.id}
                                                className="flex items-center gap-2 pl-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (onEventClick) {
                                                    onEventClick(childEvent);
                                                  } else {
                                                    onNavigate(new Date(childEvent.start));
                                                  }
                                                }}
                                              >
                                                {/* Small colored dot */}
                                                <div
                                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                                  style={{ backgroundColor: childColor }}
                                                />
                                                
                                                {/* Child event details */}
                                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                                  <span className="text-xs font-medium text-muted-foreground">
                                                    {formatEventTime(childEvent.start)}
                                                  </span>
                                                  <span className="text-xs text-foreground font-medium">
                                                    {childEvent.title}
                                                  </span>
                                                  {childDurationText && (
                                                    <span className="text-xs text-muted-foreground">
                                                      {childDurationText}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* More options button */}
                                    <button
                                      className="flex-shrink-0 p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (onEventClick) {
                                          onEventClick(event);
                                        }
                                      }}
                                    >
                                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
          {sortedDates.every((dateKey) => groupedEvents.get(dateKey)?.length === 0) && (
            <div className="text-center text-muted-foreground py-8">
              No upcoming events in the next 30 days
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

