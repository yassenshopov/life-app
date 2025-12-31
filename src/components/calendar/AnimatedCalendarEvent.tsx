'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/components/HQCalendar';
import { formatEventTime } from '@/lib/calendar-utils';
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
}: AnimatedCalendarEventProps) {
  const bgColor = event.color || '#4285f4';
  const textColor = getContrastTextColor(bgColor);
  const textColorValue = textColor === 'dark' ? '#1f2937' : '#ffffff'; // gray-900 or white

  const handleClick = (e: React.MouseEvent) => {
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

  // Use linked people from database (if available), otherwise fall back to title matching
  const matchedPeople = React.useMemo(() => {
    // Prefer linked people from database
    if (event.linkedPeople && event.linkedPeople.length > 0) {
      return event.linkedPeople;
    }
    // Fallback to title matching
    if (!people || people.length === 0) return [];
    return getMatchedPeopleFromEvent(event.title, people);
  }, [event.linkedPeople, event.title, people]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -5 }}
      animate={{ 
        opacity: isPreview ? 0.4 : 1, 
        scale: 1, 
        y: 0 
      }}
      exit={{ opacity: 0, scale: 0.95, y: -5 }}
      transition={{
        duration: 0.2,
        ease: 'easeOut',
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "absolute left-1 right-1 px-2 text-xs pointer-events-auto overflow-hidden",
        // Less padding for short events (<=1hr)
        showExtraInfo ? "py-1" : "py-0.5",
        // Apply rounded corners conditionally based on touching events
        !touchingEvents?.top && !touchingEvents?.bottom && "rounded",
        !touchingEvents?.top && touchingEvents?.bottom && "rounded-t",
        touchingEvents?.top && !touchingEvents?.bottom && "rounded-b",
        // No rounded corners if touching both sides
        isPreview 
          ? "cursor-default border-2 border-dashed" 
          : "cursor-pointer hover:opacity-90 transition-opacity"
      )}
      style={{
        ...style,
        backgroundColor: isPreview ? `${bgColor}40` : bgColor,
        color: textColorValue,
        borderColor: isPreview ? bgColor : undefined,
      }}
      title={[
        event.title,
        formatEventTime(displayStart, timeFormat),
        formatEventTime(displayEnd, timeFormat),
        event.location && `📍 ${event.location}`,
      ].filter(Boolean).join(' - ')}
    >
      {/* Event content */}
      <div className="event-content overflow-hidden">
        <div 
          className={cn(
            "font-medium flex items-center gap-1.5",
            showExtraInfo 
              ? "text-xs break-words" // Allow wrapping for >1hr events
              : "text-[10px] truncate" // Single line truncate for <=1hr events
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
                  <PersonAvatar
                    person={person}
                    size="sm"
                    onClick={() => onPersonClick?.(person)}
                  />
                </div>
              ))}
            </div>
          )}
          <span className={cn(showExtraInfo ? '' : 'truncate', 'flex-1')}>{event.title}</span>
        </div>
        <div 
          className={cn("opacity-90 truncate", showExtraInfo ? "text-[10px]" : "text-[9px]")} 
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
