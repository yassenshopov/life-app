'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '../HQCalendar';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import { 
  MapPin, 
  Users, 
  MoreVertical,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { getContrastTextColor } from '@/lib/color-utils';
import DOMPurify from 'dompurify';
import { Person, getMatchedPeopleFromEvent } from '@/lib/people-matching';
import { PersonAvatar } from '@/components/calendar/PersonAvatar';
import { MediaModal } from '@/components/media/MediaModal';

// Typed text animation component
function TypedText({ 
  text, 
  delay = 0, 
  className = '',
  onComplete
}: { 
  text: string; 
  delay?: number; 
  className?: string;
  onComplete?: () => void;
}) {
  const [displayedText, setDisplayedText] = React.useState('');
  const [isComplete, setIsComplete] = React.useState(false);

  React.useEffect(() => {
    if (!text) return;
    
    setDisplayedText('');
    setIsComplete(false);
    
    const timeout = setTimeout(() => {
      let currentIndex = 0;
      const typingInterval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsComplete(true);
          clearInterval(typingInterval);
          // Call onComplete after a brief delay to ensure state is updated
          if (onComplete) {
            setTimeout(() => onComplete(), 0);
          }
        }
      }, 30); // Typing speed

      return () => clearInterval(typingInterval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, delay]); // Removed onComplete from dependencies to prevent resets

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && <span className="animate-pulse">|</span>}
    </span>
  );
}

// Sequential typed text list component - types items one by one
function SequentialTypedList({ 
  items, 
  mediaItems,
  onMediaClick
}: { 
  items: string[];
  mediaItems: Array<{ id: string; name: string; category: string | null }>;
  onMediaClick: (mediaId: string) => void;
}) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(0); // null means none active, number is the index being typed
  const [completedIndices, setCompletedIndices] = React.useState<Set<number>>(new Set());

  const handleItemComplete = React.useCallback((index: number) => {
    // Mark this item as completed
    setCompletedIndices(prev => new Set([...prev, index]));
    
    // Start next item after a short delay
    if (index < items.length - 1) {
      setTimeout(() => {
        setActiveIndex(index + 1);
      }, 150); // Small delay between items
    } else {
      // All items completed - keep activeIndex at last index so all items show as completed
      setActiveIndex(items.length);
    }
  }, [items.length]);

  // Reset when items change
  React.useEffect(() => {
    setActiveIndex(0); // Start with first item
    setCompletedIndices(new Set());
  }, [items]);

  // Parse text to find and make media references clickable
  const parseTextWithMediaLinks = (text: string) => {
    // If no media items, return original text
    if (!mediaItems || mediaItems.length === 0) {
      return [{ text, isLink: false }];
    }
    
    const parts: Array<{ text: string; isLink: boolean; mediaId?: string }> = [];
    const matches: Array<{ index: number; length: number; mediaId: string; originalText: string }> = [];
    
    // Find all media item matches in the text with very flexible matching
    for (const mediaItem of mediaItems) {
      const name = mediaItem.name.trim();
      if (!name || name.length < 2) continue;
      
      // Escape special regex characters
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Try multiple patterns - search for the title in various contexts
      // We'll search for the title and then extract it, handling quotes, "by", and "(year)"
      const patterns = [
        // 1. Quoted title - "The North Water" or "Interstellar"
        `["']${escapedName}["']`,
        // 2. Title with word boundaries
        `\\b${escapedName}\\b`,
        // 3. Title without word boundaries (most flexible)
        escapedName,
      ];
      
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'gi');
        let match;
        regex.lastIndex = 0; // Reset regex
        
        while ((match = regex.exec(text)) !== null) {
          let matchText = match[0];
          let matchIndex = match.index;
          let titleText = name;
          let titleIndex = matchIndex;
          
          // Handle quoted titles
          if (matchText.startsWith('"') || matchText.startsWith("'")) {
            // Extract just the title from quotes
            titleText = matchText.slice(1, -1);
            titleIndex = matchIndex + 1;
          } else {
            // Unquoted title - check if it's followed by "by" or "("
            // Look ahead to see if there's "by Author" or "(year)" after the title
            const afterMatch = text.substring(matchIndex + matchText.length);
            const trimmedAfter = afterMatch.trim();
            
            // If followed by "by" or "(", use just the title part
            if (trimmedAfter.startsWith('by ') || trimmedAfter.startsWith('(')) {
              titleText = matchText.trim();
              titleIndex = matchIndex;
            } else {
              // Simple match
              titleText = matchText.trim();
              titleIndex = matchIndex;
            }
          }
          
          // Ensure we have a valid title
          if (!titleText || titleText.length < 2) continue;
          
          // Check if this match overlaps with an existing match
          const overlaps = matches.some(m => {
            const mEnd = m.index + m.length;
            const matchEnd = titleIndex + titleText.length;
            return (titleIndex < mEnd && matchEnd > m.index);
          });
          
          if (!overlaps) {
            matches.push({
              index: titleIndex,
              length: titleText.length,
              mediaId: mediaItem.id,
              originalText: titleText
            });
            // Break after first successful match to avoid duplicates
            break;
          }
        }
        
        // If we found a match with this pattern, don't try less specific patterns
        if (matches.some(m => m.mediaId === mediaItem.id)) {
          break;
        }
      }
    }
    
    // Sort matches by index
    const sortedMatches = [...matches].sort((a, b) => a.index - b.index);
    
    // Build parts array from matches
    let lastIndex = 0;
    for (const match of sortedMatches) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push({ text: text.substring(lastIndex, match.index), isLink: false });
      }
      // Add media link
      parts.push({ 
        text: match.originalText, 
        isLink: true, 
        mediaId: match.mediaId 
      });
      lastIndex = match.index + match.length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ text: text.substring(lastIndex), isLink: false });
    }
    
    // If no media matches found, return original text
    if (parts.length === 0) {
      return [{ text, isLink: false }];
    }
    
    return parts;
  };


  return (
    <ul className="space-y-1.5">
      {items.map((item, idx) => {
        const isActive = activeIndex === idx;
        const isCompleted = completedIndices.has(idx) || (activeIndex !== null && idx < activeIndex);
        const isPending = activeIndex !== null && idx > activeIndex;
        
        return (
          <li key={idx} className="text-xs text-foreground flex items-start gap-2">
            <span className="text-muted-foreground mt-0.5 flex-shrink-0">•</span>
            <span className="flex-1 min-w-0">
              {isActive ? (
                <TypedText
                  text={item}
                  delay={0}
                  className="break-words"
                  onComplete={() => handleItemComplete(idx)}
                />
              ) : isCompleted ? (
                <span className="break-words">
                  {(() => {
                    const parsedParts = parseTextWithMediaLinks(item);
                    return parsedParts.map((part, partIdx) => 
                      part.isLink && part.mediaId ? (
                        <button
                          key={partIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMediaClick(part.mediaId!);
                          }}
                          className="text-foreground hover:text-foreground/80 underline cursor-pointer"
                        >
                          {part.text}
                        </button>
                      ) : (
                        <span key={partIdx}>{part.text}</span>
                      )
                    );
                  })()}
                </span>
              ) : (
                <span className="opacity-0 break-words">{item}</span> // Reserve space for pending items
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

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
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = React.useState(false);
  const [mediaItems, setMediaItems] = React.useState<Array<{ id: string; name: string; category: string | null }>>([]);
  const [selectedMediaItem, setSelectedMediaItem] = React.useState<any | null>(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = React.useState(false);

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

  // Gather context for AI suggestions
  const gatherContextForSuggestions = (currentTime: Date, allEvents: CalendarEvent[]) => {
    const today = new Date(currentTime);
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Filter events for today only
    const todayEvents = allEvents.filter(event => {
      const eventDate = new Date(event.start);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate.getTime() === today.getTime() && !event.isAllDay;
    }).sort((a, b) => a.start.getTime() - b.start.getTime());

    // Find recent past events (within last 4 hours)
    const fourHoursAgo = new Date(currentTime.getTime() - 4 * 60 * 60 * 1000);
    const recentEvents = todayEvents
      .filter(event => event.end <= currentTime && event.end >= fourHoursAgo)
      .slice(-3)
      .map(event => ({
        title: event.title,
        start: event.start,
        end: event.end,
        location: event.location,
      }));

    // Find upcoming events (next 8 hours)
    const eightHoursFromNow = new Date(currentTime.getTime() + 8 * 60 * 60 * 1000);
    const upcomingEvents = todayEvents
      .filter(event => event.start > currentTime && event.start <= eightHoursFromNow)
      .slice(0, 5)
      .map(event => ({
        title: event.title,
        start: event.start,
        end: event.end,
        location: event.location,
      }));

    // Calculate time until next event
    const nextEvent = todayEvents.find(event => event.start > currentTime);
    const timeUntilNextEvent = nextEvent
      ? Math.floor((nextEvent.start.getTime() - currentTime.getTime()) / (1000 * 60))
      : undefined;

    // Calculate available time blocks (gaps between events)
    const availableTimeBlocks: Array<{ start: Date; end: Date; durationMinutes: number }> = [];
    
    // Gap from current time to first upcoming event
    if (nextEvent) {
      const durationMinutes = Math.floor((nextEvent.start.getTime() - currentTime.getTime()) / (1000 * 60));
      if (durationMinutes > 0) {
        availableTimeBlocks.push({
          start: new Date(currentTime),
          end: new Date(nextEvent.start),
          durationMinutes,
        });
      }
    }

    // Gaps between consecutive events
    for (let i = 0; i < todayEvents.length - 1; i++) {
      const currentEvent = todayEvents[i];
      const nextEventInList = todayEvents[i + 1];
      
      if (currentEvent.end < nextEventInList.start) {
        const durationMinutes = Math.floor((nextEventInList.start.getTime() - currentEvent.end.getTime()) / (1000 * 60));
        if (durationMinutes > 0) {
          availableTimeBlocks.push({
            start: new Date(currentEvent.end),
            end: new Date(nextEventInList.start),
            durationMinutes,
          });
        }
      }
    }

    return {
      currentTime,
      recentEvents,
      upcomingEvents,
      timeUntilNextEvent,
      availableTimeBlocks,
    };
  };

  // Fetch AI suggestions
  const handleGetSuggestions = async () => {
    setIsLoadingSuggestions(true);
    setSuggestions([]);
    setMediaItems([]);

    try {
      // Fetch media items first
      let media: Array<{ id: string; name: string; category: string | null }> = [];
      try {
        const mediaResponse = await fetch('/api/media');
        if (mediaResponse.ok) {
          const mediaData = await mediaResponse.json();
          media = (mediaData.media || []).map((item: any) => ({
            id: item.id,
            name: item.name,
            category: item.category,
          }));
          setMediaItems(media);
        }
      } catch (mediaError) {
        console.error('Error fetching media:', mediaError);
      }

      const context = gatherContextForSuggestions(currentTime, events);
      
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentTime: context.currentTime.toISOString(),
          recentEvents: context.recentEvents.map(e => ({
            ...e,
            start: e.start.toISOString(),
            end: e.end.toISOString(),
          })),
          upcomingEvents: context.upcomingEvents.map(e => ({
            ...e,
            start: e.start.toISOString(),
            end: e.end.toISOString(),
          })),
          timeUntilNextEvent: context.timeUntilNextEvent,
          availableTimeBlocks: context.availableTimeBlocks.map(b => ({
            ...b,
            start: b.start.toISOString(),
            end: b.end.toISOString(),
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions(['Unable to generate suggestions at this time.']);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Handle media item click - fetch full item and open modal
  const handleMediaClick = React.useCallback(async (mediaId: string) => {
    try {
      const response = await fetch('/api/media');
      if (response.ok) {
        const data = await response.json();
        const mediaItem = data.media?.find((item: any) => item.id === mediaId);
        if (mediaItem) {
          setSelectedMediaItem(mediaItem);
          setIsMediaModalOpen(true);
        }
      }
    } catch (error) {
      console.error('Error fetching media item:', error);
    }
  }, []);

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
                    
                    // Create unscheduled time block if needed (for today, when no event is active)
                    let eventsToDisplay = [...organizedEvents];
                    if (isTodayDate && !hasActiveEvent(organizedEvents, date)) {
                      // Create a placeholder event for unscheduled time at current time
                      const unscheduledEvent: CalendarEvent & { _isUnscheduled?: boolean } = {
                        id: 'unscheduled-time',
                        title: 'Unscheduled time',
                        start: new Date(currentTime),
                        end: new Date(currentTime),
                        color: '#6b7280', // Gray color
                        _isUnscheduled: true,
                      };
                      
                      // Insert at correct chronological position
                      eventsToDisplay.push(unscheduledEvent);
                      eventsToDisplay.sort((a, b) => a.start.getTime() - b.start.getTime());
                    }
                    
                    // Show timeline only if there are 2+ top-level events (events without parents)
                    const showTimeline = eventsToDisplay.length > 1;
                    
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
                          {eventsToDisplay.map((event, eventIndex) => {
                            const isUnscheduled = (event as CalendarEvent & { _isUnscheduled?: boolean })._isUnscheduled;
                            
                            // Render unscheduled time block differently
                            if (isUnscheduled) {
                              return (
                                <div key={event.id} className="flex items-start gap-4 relative">
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
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="text-xs text-muted-foreground italic">
                                        Unscheduled time
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleGetSuggestions();
                                        }}
                                        disabled={isLoadingSuggestions}
                                        className="h-7 px-2 text-xs"
                                      >
                                        {isLoadingSuggestions ? (
                                          <>
                                            <Spinner size="sm" className="mr-1" />
                                            Thinking...
                                          </>
                                        ) : (
                                          <>
                                            <Sparkles className="h-3 w-3 mr-1" />
                                            Get suggestions
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                    
                                    {/* Suggestions list */}
                                    {suggestions.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-muted-foreground/20">
                                        <div className="text-xs font-medium text-muted-foreground mb-2">
                                          Suggestions:
                                        </div>
                                        <SequentialTypedList 
                                          items={suggestions} 
                                          mediaItems={mediaItems}
                                          onMediaClick={handleMediaClick}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            
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
      
      {/* Media Modal */}
      <MediaModal
        item={selectedMediaItem}
        isOpen={isMediaModalOpen}
        onClose={() => {
          setIsMediaModalOpen(false);
          setSelectedMediaItem(null);
        }}
      />
    </div>
  );
});

ScheduleCalendarView.displayName = 'ScheduleCalendarView';

