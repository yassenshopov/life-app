'use client';

import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Maximize2,
  Minimize2,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CalendarSettingsDialog, TimeFormat } from '@/components/CalendarSettingsDialog';
import { DailyCalendarView } from '@/components/calendar-views/DailyCalendarView';
import { WeeklyCalendarView } from '@/components/calendar-views/WeeklyCalendarView';
import { MonthlyCalendarView } from '@/components/calendar-views/MonthlyCalendarView';
import { AnnualCalendarView } from '@/components/calendar-views/AnnualCalendarView';
import {
  ScheduleCalendarView,
  ScheduleCalendarViewRef,
} from '@/components/calendar-views/ScheduleCalendarView';
import { AnimatedCalendarView } from '@/components/calendar/AnimatedCalendarView';
import { EventDetailModal } from '@/components/calendar/EventDetailModal';
import { NewEventModal } from '@/components/calendar/NewEventModal';
import { KeyboardShortcutsDialog } from '@/components/calendar/KeyboardShortcutsDialog';
import { PersonDetailModal } from '@/components/calendar/PersonDetailModal';
import { EventColorMenu } from '@/components/calendar/EventColorMenu';
import { motion } from 'framer-motion';
import { getMatchedPeopleFromEvent, Person } from '@/lib/people-matching';
import { fetchEventPeople } from '@/lib/fetch-event-people';

// Calendar event interface
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  calendar?: string;
  calendarId?: string; // The actual calendar ID for API calls
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  isAllDay?: boolean;
  organizer?: {
    email?: string;
    displayName?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
    self?: boolean;
  }>;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method?: string;
      minutes?: number;
    }>;
  };
  recurrence?: string[];
  status?: string;
  transparency?: string;
  visibility?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType?: string;
      uri?: string;
      label?: string;
    }>;
  };
  created?: Date;
  updated?: Date;
  linkedPeople?: Array<{ id: string; name: string; image?: any; image_url?: string | null }>; // People linked to this event
}

export type CalendarViewMode = 'daily' | 'weekly' | 'monthly' | 'year' | 'schedule';

interface HQCalendarProps {
  events?: CalendarEvent[];
  navigateToDate?: Date;
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

export function HQCalendar({
  events: initialEvents = [],
  navigateToDate,
  colorPalette,
}: HQCalendarProps) {
  const [events, setEvents] = React.useState<CalendarEvent[]>(initialEvents);
  const [loadingEvents, setLoadingEvents] = React.useState(false);
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = React.useState(false);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = React.useState(false);
  const [newEventInitialTime, setNewEventInitialTime] = React.useState<Date | undefined>();
  const [newEventInitialDate, setNewEventInitialDate] = React.useState<Date | undefined>();
  const [availableCalendars, setAvailableCalendars] = React.useState<
    Array<{ id: string; summary: string; color?: string }>
  >([]);
  const [previewEvent, setPreviewEvent] = React.useState<CalendarEvent | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = React.useState(false);
  const [people, setPeople] = React.useState<Person[]>([]);
  const [selectedPerson, setSelectedPerson] = React.useState<Person | null>(null);
  const [isPersonModalOpen, setIsPersonModalOpen] = React.useState(false);
  const [contextMenuEvent, setContextMenuEvent] = React.useState<{
    event: CalendarEvent;
    x: number;
    y: number;
    calendarColor?: string;
  } | null>(null);
  const scheduleViewRef = React.useRef<ScheduleCalendarViewRef>(null);

  const handlePersonClick = (person: Person) => {
    setSelectedPerson(person);
    setIsPersonModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    console.log('handleEventClick - Event data:', {
      id: event.id,
      title: event.title,
      hasLocation: !!event.location,
      location: event.location,
      hasDescription: !!event.description,
      description: event.description,
      fullEvent: event,
    });
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  const handleEventRightClick = async (event: CalendarEvent, e: React.MouseEvent) => {
    e.preventDefault();

    // Fetch calendar color
    let calendarColor: string | undefined;
    try {
      const response = await fetch(`/api/google-calendar/calendars`);
      if (response.ok) {
        const data = await response.json();
        const calendar = data.calendars?.find(
          (cal: any) => cal.id === event.calendarId || cal.id === event.calendar
        );
        if (calendar?.color) {
          calendarColor = calendar.color.startsWith('#') ? calendar.color : `#${calendar.color}`;
        }
      }
    } catch (error) {
      console.warn('Could not fetch calendar color:', error);
    }

    setContextMenuEvent({
      event,
      x: e.clientX,
      y: e.clientY,
      calendarColor: calendarColor || '#4285f4',
    });
  };

  const handleColorChange = async (color: string | null) => {
    if (!contextMenuEvent) return;

    const event = contextMenuEvent.event;
    const calendarColor = contextMenuEvent.calendarColor || '#4285f4';

    // If color is null, use calendar default
    const colorToUse = color || calendarColor;

    // Optimistically update the UI
    const updatedEvent: CalendarEvent = { ...event, color: colorToUse };
    setEvents((prevEvents) => prevEvents.map((e) => (e.id === event.id ? updatedEvent : e)));

    // Update cache
    allCachedEventsRef.current = allCachedEventsRef.current.map((e) =>
      e.id === event.id ? updatedEvent : e
    );

    // Close context menu
    setContextMenuEvent(null);

    try {
      const response = await fetch(`/api/google-calendar/events/${event.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calendarId: event.calendarId || event.calendar,
          color: colorToUse,
          useCalendarDefault: color === null, // Flag to indicate we want to use calendar default
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update event color');
      }

      const data = await response.json();

      // Update with server response
      const serverUpdatedEvent: CalendarEvent = {
        ...event,
        color: data.event.color,
      };

      setEvents((prevEvents) =>
        prevEvents.map((e) => (e.id === event.id ? serverUpdatedEvent : e))
      );

      // Update cache
      allCachedEventsRef.current = allCachedEventsRef.current.map((e) =>
        e.id === event.id ? serverUpdatedEvent : e
      );

      // No need to trigger refresh - we've already updated the UI optimistically and with server response
    } catch (error) {
      console.error('Error updating event color:', error);

      // Revert optimistic update on error
      setEvents((prevEvents) => prevEvents.map((e) => (e.id === event.id ? event : e)));

      allCachedEventsRef.current = allCachedEventsRef.current.map((e) =>
        e.id === event.id ? event : e
      );
    }
  };

  const handleCloseEventModal = () => {
    setIsEventModalOpen(false);
    setSelectedEvent(null);
  };

  const handleEmptySpaceClick = (date: Date, time: Date) => {
    setNewEventInitialDate(date);
    setNewEventInitialTime(time);
    setIsNewEventModalOpen(true);
  };

  const handleEventCreate = async (eventData: {
    title: string;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
    description?: string;
    location?: string;
    calendarId: string;
  }) => {
    try {
      const response = await fetch('/api/google-calendar/events/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: eventData.title,
          startTime: eventData.startTime.toISOString(),
          endTime: eventData.endTime.toISOString(),
          isAllDay: eventData.isAllDay,
          description: eventData.description,
          location: eventData.location,
          calendarId: eventData.calendarId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create event');
      }

      const data = await response.json();

      // Add the new event to local state
      const newEvent: CalendarEvent = {
        id: data.event.id,
        title: data.event.title,
        start: new Date(data.event.start),
        end: new Date(data.event.end),
        color: data.event.color,
        calendar: data.event.calendar,
        calendarId: data.event.calendarId,
        description: data.event.description,
        location: data.event.location,
        htmlLink: data.event.htmlLink,
        hangoutLink: data.event.hangoutLink,
        isAllDay: data.event.isAllDay,
        organizer: data.event.organizer,
        attendees: data.event.attendees,
        reminders: data.event.reminders,
        recurrence: data.event.recurrence,
        status: data.event.status,
        transparency: data.event.transparency,
        visibility: data.event.visibility,
        conferenceData: data.event.conferenceData,
        created: data.event.created,
        updated: data.event.updated,
      };

      // Update cache
      allCachedEventsRef.current = mergeEvents(allCachedEventsRef.current, [newEvent]);

      // Update displayed events
      setEvents((prevEvents) =>
        [...prevEvents, newEvent].sort((a, b) => a.start.getTime() - b.start.getTime())
      );

      // Trigger a refresh to ensure everything is in sync
      window.dispatchEvent(new CustomEvent('calendar-refresh'));
    } catch (error) {
      console.error('Error creating event:', error);
      throw error; // Re-throw to let the component handle it
    }
  };

  // Fetch available calendars for new event modal
  React.useEffect(() => {
    const fetchCalendars = async () => {
      try {
        const response = await fetch('/api/google-calendar/calendars');
        const data = await response.json();

        if (response.ok && data.calendars && Array.isArray(data.calendars)) {
          setAvailableCalendars(data.calendars);
        }
      } catch (error) {
        console.error('Error fetching calendars:', error);
      }
    };

    if (isNewEventModalOpen) {
      fetchCalendars();
    }
  }, [isNewEventModalOpen]);

  // Fetch people data for matching
  React.useEffect(() => {
    const fetchPeople = async () => {
      try {
        const response = await fetch('/api/people');
        const data = await response.json();
        if (response.ok && data.people && Array.isArray(data.people)) {
          setPeople(data.people);
        }
      } catch (error) {
        console.error('Error fetching people:', error);
      }
    };

    fetchPeople();
  }, []);

  const handleEventUpdate = async (
    eventId: string,
    calendarId: string,
    startTime: Date,
    endTime: Date,
    isAllDay?: boolean
  ) => {
    try {
      const response = await fetch(`/api/google-calendar/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calendarId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          isAllDay: isAllDay,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update event');
      }

      const data = await response.json();

      // Update the event in cache
      const updatedEvent: CalendarEvent = {
        id: eventId,
        title: data.event.title || '',
        start: new Date(data.event.start),
        end: new Date(data.event.end),
        color: data.event.color || '#4285f4',
        calendar: data.event.calendar,
        calendarId: data.event.calendarId || data.event.calendar,
        description: data.event.description,
        location: data.event.location,
        htmlLink: data.event.htmlLink,
        hangoutLink: data.event.hangoutLink,
        isAllDay: data.event.isAllDay,
        organizer: data.event.organizer,
        attendees: data.event.attendees,
        reminders: data.event.reminders,
        recurrence: data.event.recurrence,
        status: data.event.status,
        transparency: data.event.transparency,
        visibility: data.event.visibility,
        conferenceData: data.event.conferenceData,
        created: data.event.created ? new Date(data.event.created) : undefined,
        updated: data.event.updated ? new Date(data.event.updated) : undefined,
      };

      // Update cache
      allCachedEventsRef.current = allCachedEventsRef.current.map((e) =>
        e.id === eventId ? updatedEvent : e
      );

      // Update the event in the local state
      setEvents((prevEvents) =>
        prevEvents.map((e) =>
          e.id === eventId
            ? {
                ...e,
                start: new Date(data.event.start),
                end: new Date(data.event.end),
                isAllDay: data.event.isAllDay,
              }
            : e
        )
      );

      // Trigger a refresh to ensure everything is in sync
      window.dispatchEvent(new CustomEvent('calendar-refresh'));
    } catch (error) {
      console.error('Error updating event:', error);
      throw error; // Re-throw to let the component handle it
    }
  };

  // Load view mode from localStorage
  // Initialize to 'weekly' on both server and client to prevent hydration mismatch
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>('weekly');

  // Load view mode from localStorage after mount to prevent hydration mismatch
  React.useEffect(() => {
    const saved = localStorage.getItem('hq-calendar-view-mode');
    // Migrate old "annual" to "year"
    if (saved === 'annual') {
      localStorage.setItem('hq-calendar-view-mode', 'year');
      setViewMode('year');
      return;
    }
    if (
      saved === 'daily' ||
      saved === 'weekly' ||
      saved === 'monthly' ||
      saved === 'year' ||
      saved === 'schedule'
    ) {
      setViewMode(saved);
    }
  }, []);

  const [currentDate, setCurrentDate] = React.useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Navigate to a specific date when navigateToDate changes
  React.useEffect(() => {
    if (navigateToDate) {
      if (viewMode === 'weekly') {
        const day = navigateToDate.getDay();
        const diff = navigateToDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
        const monday = new Date(navigateToDate);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        setCurrentDate(monday);
      } else if (viewMode === 'daily') {
        const date = new Date(navigateToDate);
        date.setHours(0, 0, 0, 0);
        setCurrentDate(date);
      } else if (viewMode === 'monthly') {
        const date = new Date(navigateToDate.getFullYear(), navigateToDate.getMonth(), 1);
        setCurrentDate(date);
      } else if (viewMode === 'year') {
        const date = new Date(navigateToDate.getFullYear(), 0, 1);
        setCurrentDate(date);
      } else if (viewMode === 'schedule') {
        const date = new Date(navigateToDate);
        date.setHours(0, 0, 0, 0);
        setCurrentDate(date);
      }
    }
  }, [navigateToDate, viewMode]);

  // Save view mode to localStorage when it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hq-calendar-view-mode', viewMode);
    }
  }, [viewMode]);

  // Load time format from localStorage
  // Use default '12h' for SSR, then sync with localStorage after mount to avoid hydration mismatch
  const [timeFormat, setTimeFormat] = React.useState<TimeFormat>('12h');
  const [isMounted, setIsMounted] = React.useState(false);

  // Sync timeFormat with localStorage after mount
  React.useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('hq-calendar-time-format');
    if (saved === '12h' || saved === '24h') {
      setTimeFormat(saved);
    }
  }, []);

  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Save time format to localStorage when it changes (only after mount)
  React.useEffect(() => {
    if (isMounted) {
      localStorage.setItem('hq-calendar-time-format', timeFormat);
    }
  }, [timeFormat, isMounted]);

  // Track if we should stop retrying (for auth errors)
  const [shouldStopRetrying, setShouldStopRetrying] = React.useState(false);
  const [forceRefresh, setForceRefresh] = React.useState(false);
  const fetchingRef = React.useRef(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Client-side cache: track what date ranges we've already fetched
  const cachedRangeRef = React.useRef<{ min: Date; max: Date } | null>(null);
  const allCachedEventsRef = React.useRef<CalendarEvent[]>([]);

  // Listen for calendar refresh events
  React.useEffect(() => {
    const handleRefresh = () => {
      // Clear cache to force refetch
      cachedRangeRef.current = null;
      allCachedEventsRef.current = [];
      // Force refresh by clearing the stop retrying flag and triggering a refetch
      setShouldStopRetrying(false);
      fetchingRef.current = false;
      setForceRefresh(true);
      // Trigger refetch by creating a new date object to force useEffect to run
      setCurrentDate((prev) => new Date(prev.getTime()));
    };

    window.addEventListener('calendar-refresh', handleRefresh);
    return () => {
      window.removeEventListener('calendar-refresh', handleRefresh);
    };
  }, []);

  // Helper function to check if a date range is fully covered by cached events
  const isRangeCached = (requestedMin: Date, requestedMax: Date): boolean => {
    if (!cachedRangeRef.current) return false;
    const cached = cachedRangeRef.current;
    // Check if requested range is fully within cached range
    return requestedMin >= cached.min && requestedMax <= cached.max;
  };

  // Helper function to determine what ranges need to be fetched
  const getMissingRanges = (
    requestedMin: Date,
    requestedMax: Date
  ): Array<{ min: Date; max: Date }> => {
    if (!cachedRangeRef.current || forceRefresh) {
      // No cache or force refresh - fetch everything
      return [{ min: requestedMin, max: requestedMax }];
    }

    const cached = cachedRangeRef.current;
    const ranges: Array<{ min: Date; max: Date }> = [];

    // Check if we need to fetch before cached range
    if (requestedMin < cached.min) {
      ranges.push({
        min: requestedMin,
        max: new Date(Math.min(cached.min.getTime() - 1, requestedMax.getTime())),
      });
    }

    // Check if we need to fetch after cached range
    if (requestedMax > cached.max) {
      ranges.push({
        min: new Date(Math.max(cached.max.getTime() + 1, requestedMin.getTime())),
        max: requestedMax,
      });
    }

    return ranges;
  };

  // Helper function to merge events and remove duplicates
  const mergeEvents = (existing: CalendarEvent[], newEvents: CalendarEvent[]): CalendarEvent[] => {
    const eventMap = new Map<string, CalendarEvent>();

    // Add existing events
    existing.forEach((event) => {
      eventMap.set(event.id, event);
    });

    // Add/update with new events (new events take precedence)
    newEvents.forEach((event) => {
      eventMap.set(event.id, event);
    });

    // Convert back to array and sort by start time
    return Array.from(eventMap.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
  };

  // Calculate current view's date range
  const getCurrentViewRange = (): { timeMin: Date; timeMax: Date } | null => {
    let timeMin: Date;
    let timeMax: Date;

    if (viewMode === 'daily') {
      timeMin = new Date(currentDate);
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(currentDate);
      timeMax.setHours(23, 59, 59, 999);
    } else if (viewMode === 'weekly') {
      timeMin = new Date(currentDate);
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(currentDate);
      timeMax.setDate(currentDate.getDate() + 7);
      timeMax.setHours(23, 59, 59, 999);
    } else if (viewMode === 'monthly') {
      timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      timeMax.setHours(23, 59, 59, 999);
    } else if (viewMode === 'year') {
      timeMin = new Date(currentDate.getFullYear(), 0, 1);
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(currentDate.getFullYear(), 11, 31);
      timeMax.setHours(23, 59, 59, 999);
    } else if (viewMode === 'schedule') {
      timeMin = new Date(currentDate);
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(currentDate);
      timeMax.setDate(currentDate.getDate() + 30);
      timeMax.setHours(23, 59, 59, 999);
    } else {
      return null;
    }

    return { timeMin, timeMax };
  };

  // Refresh events for current view only
  const handleRefreshCurrentView = React.useCallback(() => {
    const viewRange = getCurrentViewRange();
    if (!viewRange) return;

    const { timeMin, timeMax } = viewRange;

    // Remove events from cache that overlap with current view range
    allCachedEventsRef.current = allCachedEventsRef.current.filter((event) => {
      // Keep events that don't overlap with the current view range
      return !(event.start <= timeMax && event.end >= timeMin);
    });

    // Update cached range to exclude the current view range
    if (cachedRangeRef.current) {
      const cached = cachedRangeRef.current;

      // If the cached range is exactly the view range, clear it
      if (
        cached.min.getTime() === timeMin.getTime() &&
        cached.max.getTime() === timeMax.getTime()
      ) {
        cachedRangeRef.current = null;
      } else {
        // Otherwise, shrink the cached range to exclude the view range
        // This is a simplification - we'll just invalidate the cache for this range
        // by setting it to null if the view range overlaps significantly
        if (timeMin >= cached.min && timeMax <= cached.max) {
          // View range is within cached range - we'll need to refetch just this part
          // For simplicity, we'll just clear the cache for this range
          cachedRangeRef.current = null;
        } else {
          // View range extends beyond cached range - clear cache
          cachedRangeRef.current = null;
        }
      }
    }

    // Clear displayed events for current view
    setEvents([]);

    // Force refresh and trigger refetch
    setShouldStopRetrying(false);
    fetchingRef.current = false;
    setForceRefresh(true);

    // Trigger refetch by updating currentDate slightly to force useEffect to run
    setCurrentDate((prev) => new Date(prev.getTime()));
  }, [viewMode, currentDate]);

  // Fetch events from Google Calendar based on current view and date
  React.useEffect(() => {
    // Don't fetch if we're already fetching or should stop retrying
    if (fetchingRef.current || shouldStopRetrying) {
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Calculate time range based on view mode (inside effect to avoid dependency issues)
    let timeMin: Date;
    let timeMax: Date;

    if (viewMode === 'daily') {
      timeMin = new Date(currentDate);
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(currentDate);
      timeMax.setHours(23, 59, 59, 999);
    } else if (viewMode === 'weekly') {
      timeMin = new Date(currentDate);
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(currentDate);
      timeMax.setDate(currentDate.getDate() + 7);
      timeMax.setHours(23, 59, 59, 999);
    } else if (viewMode === 'monthly') {
      timeMin = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      timeMax.setHours(23, 59, 59, 999);
    } else if (viewMode === 'year') {
      timeMin = new Date(currentDate.getFullYear(), 0, 1);
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(currentDate.getFullYear(), 11, 31);
      timeMax.setHours(23, 59, 59, 999);
    } else if (viewMode === 'schedule') {
      timeMin = new Date(currentDate);
      timeMin.setHours(0, 0, 0, 0);
      timeMax = new Date(currentDate);
      timeMax.setDate(currentDate.getDate() + 30);
      timeMax.setHours(23, 59, 59, 999);
    } else {
      return;
    }

    // Check if we already have all events for this range cached
    if (!forceRefresh && isRangeCached(timeMin, timeMax)) {
      // Filter cached events to show only what's in the current view range
      const filteredEvents = allCachedEventsRef.current.filter((event) => {
        // Event overlaps with requested range if: start <= timeMax AND end >= timeMin
        return event.start <= timeMax && event.end >= timeMin;
      });

      setEvents(filteredEvents);
      setLoadingEvents(false);
      console.log('Using cached events:', filteredEvents.length, 'events in range');
      return;
    }

    const fetchEvents = async () => {
      // Prevent concurrent requests
      if (fetchingRef.current || abortController.signal.aborted) {
        return;
      }

      try {
        fetchingRef.current = true;
        setLoadingEvents(true);

        // Determine what ranges we need to fetch
        const missingRanges = getMissingRanges(timeMin, timeMax);

        if (missingRanges.length === 0) {
          // Shouldn't happen, but handle gracefully
          setLoadingEvents(false);
          fetchingRef.current = false;
          return;
        }

        // Fetch all missing ranges in parallel
        const fetchPromises = missingRanges.map(async (range) => {
          const forceRefreshParam = forceRefresh ? '&forceRefresh=true' : '';
          const response = await fetch(
            `/api/google-calendar/events?timeMin=${range.min.toISOString()}&timeMax=${range.max.toISOString()}${forceRefreshParam}`,
            { signal: abortController.signal }
          );

          if (abortController.signal.aborted) {
            return null;
          }

          const data = await response.json();

          if (!response.ok) {
            console.error('Error fetching range:', range, data.error);
            return null;
          }

          // Convert event data to CalendarEvent format
          return (data.events || []).map((event: any) => {
            const startDate = event.start instanceof Date ? event.start : new Date(event.start);
            const endDate = event.end instanceof Date ? event.end : new Date(event.end);
            const hexColor = event.color || '#4285f4';

            return {
              id: event.id,
              title: event.title,
              start: startDate,
              end: endDate,
              color: hexColor,
              calendar: event.calendar,
              calendarId: event.calendarId || event.calendar,
              description: event.description,
              location: event.location,
              htmlLink: event.htmlLink,
              hangoutLink: event.hangoutLink,
              isAllDay: event.isAllDay,
              organizer: event.organizer,
              attendees: event.attendees,
              reminders: event.reminders,
              recurrence: event.recurrence,
              status: event.status,
              transparency: event.transparency,
              visibility: event.visibility,
              conferenceData: event.conferenceData,
              created: event.created
                ? event.created instanceof Date
                  ? event.created
                  : new Date(event.created)
                : undefined,
              updated: event.updated
                ? event.updated instanceof Date
                  ? event.updated
                  : new Date(event.updated)
                : undefined,
            };
          });
        });

        // Wait for all fetches to complete
        const allFetchedEvents = await Promise.all(fetchPromises);

        if (abortController.signal.aborted) {
          return;
        }

        // Flatten and combine all fetched events
        const newEvents = allFetchedEvents.flat().filter(Boolean) as CalendarEvent[];

        console.log(
          'Fetched new events:',
          newEvents.length,
          'from',
          missingRanges.length,
          'ranges'
        );

        // Merge with existing cached events
        const mergedEvents = mergeEvents(allCachedEventsRef.current, newEvents);

        // Update cache
        allCachedEventsRef.current = mergedEvents;

        // Update cached range to include the new range
        if (cachedRangeRef.current) {
          cachedRangeRef.current = {
            min: new Date(Math.min(cachedRangeRef.current.min.getTime(), timeMin.getTime())),
            max: new Date(Math.max(cachedRangeRef.current.max.getTime(), timeMax.getTime())),
          };
        } else {
          cachedRangeRef.current = { min: timeMin, max: timeMax };
        }

        // Fetch linked people for new events only (if not aborted)
        if (!abortController.signal.aborted && newEvents.length > 0) {
          const eventIds = newEvents.map((e) => e.id);
          const eventPeopleMap = await fetchEventPeople(eventIds);

          if (abortController.signal.aborted) {
            return;
          }

          // Update people data in merged events
          mergedEvents.forEach((event) => {
            if (eventPeopleMap[event.id]) {
              event.linkedPeople = eventPeopleMap[event.id];
            }
          });
        }

        // Filter to show only events in the current view range
        const filteredEvents = mergedEvents.filter((event) => {
          return event.start <= timeMax && event.end >= timeMin;
        });

        setEvents(filteredEvents);

        // Reset stop retrying flag on success
        setShouldStopRetrying(false);
        // Reset force refresh flag after successful fetch
        if (forceRefresh) {
          setForceRefresh(false);
        }
      } catch (error: any) {
        // Ignore abort errors
        if (error.name === 'AbortError') {
          return;
        }
        console.error('Error fetching events:', error);
        // On error, try to use cached events if available
        if (allCachedEventsRef.current.length > 0) {
          const filteredEvents = allCachedEventsRef.current.filter((event) => {
            return event.start <= timeMax && event.end >= timeMin;
          });
          setEvents(filteredEvents);
        } else {
          setEvents(initialEvents);
        }
      } finally {
        fetchingRef.current = false;
        setLoadingEvents(false);
      }
    };

    // Debounce rapid changes (e.g., when user is quickly navigating dates)
    const timeoutId = setTimeout(() => {
      fetchEvents();
    }, 150); // 150ms debounce

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [viewMode, currentDate, forceRefresh]); // Removed timeRange and initialEvents from dependencies

  const toggleFullscreen = React.useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Keyboard shortcuts for view mode switching
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Handle Escape key to exit fullscreen (only if fullscreen is active and no modals are open)
      if (
        event.key === 'Escape' &&
        isFullscreen &&
        !isEventModalOpen &&
        !isNewEventModalOpen &&
        !settingsOpen &&
        !isShortcutsDialogOpen
      ) {
        setIsFullscreen(false);
        return;
      }

      // Handle ? key to open shortcuts dialog
      if (event.key === '?' && !isEventModalOpen && !isNewEventModalOpen && !settingsOpen) {
        setIsShortcutsDialogOpen(true);
        return;
      }

      // Check for modifier keys - only allow if no modifiers or just Shift
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
      switch (key) {
        case 'd':
          setViewMode('daily');
          break;
        case 'w':
          setViewMode('weekly');
          break;
        case 'm':
          setViewMode('monthly');
          break;
        case 'y':
          setViewMode('year');
          break;
        case 's':
          setViewMode('schedule');
          break;
        case 't':
          // Go to today - inline to avoid dependency issues
          const today = new Date();
          if (viewMode === 'weekly') {
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(today);
            monday.setDate(diff);
            monday.setHours(0, 0, 0, 0);
            setCurrentDate(monday);
          } else if (viewMode === 'daily') {
            const date = new Date(today);
            date.setHours(0, 0, 0, 0);
            setCurrentDate(date);
          } else if (viewMode === 'monthly') {
            const date = new Date(today.getFullYear(), today.getMonth(), 1);
            setCurrentDate(date);
          } else if (viewMode === 'year') {
            const date = new Date(today.getFullYear(), 0, 1);
            setCurrentDate(date);
          } else if (viewMode === 'schedule') {
            // For schedule view, just scroll to today instead of changing date
            scheduleViewRef.current?.scrollToToday();
          }
          break;
        case 'f':
          // Toggle fullscreen with 'f' key
          toggleFullscreen();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    viewMode,
    isFullscreen,
    isEventModalOpen,
    isNewEventModalOpen,
    settingsOpen,
    isShortcutsDialogOpen,
    toggleFullscreen,
  ]);

  const goToToday = () => {
    const today = new Date();
    if (viewMode === 'weekly') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      setCurrentDate(monday);
    } else if (viewMode === 'daily') {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      setCurrentDate(date);
    } else if (viewMode === 'monthly') {
      const date = new Date(today.getFullYear(), today.getMonth(), 1);
      setCurrentDate(date);
    } else if (viewMode === 'year') {
      const date = new Date(today.getFullYear(), 0, 1);
      setCurrentDate(date);
    } else if (viewMode === 'schedule') {
      // For schedule view, just scroll to today instead of changing date
      scheduleViewRef.current?.scrollToToday();
    }
  };

  const goToPrevious = () => {
    if (viewMode === 'daily') {
      const prevDay = new Date(currentDate);
      prevDay.setDate(currentDate.getDate() - 1);
      setCurrentDate(prevDay);
    } else if (viewMode === 'weekly') {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevWeek);
    } else if (viewMode === 'monthly') {
      const prevMonth = new Date(currentDate);
      prevMonth.setMonth(currentDate.getMonth() - 1);
      setCurrentDate(prevMonth);
    } else if (viewMode === 'year') {
      const prevYear = new Date(currentDate);
      prevYear.setFullYear(currentDate.getFullYear() - 1);
      setCurrentDate(prevYear);
    } else if (viewMode === 'schedule') {
      const prevPeriod = new Date(currentDate);
      prevPeriod.setDate(currentDate.getDate() - 30);
      setCurrentDate(prevPeriod);
    }
  };

  const goToNext = () => {
    if (viewMode === 'daily') {
      const nextDay = new Date(currentDate);
      nextDay.setDate(currentDate.getDate() + 1);
      setCurrentDate(nextDay);
    } else if (viewMode === 'weekly') {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextWeek);
    } else if (viewMode === 'monthly') {
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(currentDate.getMonth() + 1);
      setCurrentDate(nextMonth);
    } else if (viewMode === 'year') {
      const nextYear = new Date(currentDate);
      nextYear.setFullYear(currentDate.getFullYear() + 1);
      setCurrentDate(nextYear);
    } else if (viewMode === 'schedule') {
      const nextPeriod = new Date(currentDate);
      nextPeriod.setDate(currentDate.getDate() + 30);
      setCurrentDate(nextPeriod);
    }
  };

  // Memoize date range string to avoid recalculating on every render
  const dateRangeString = React.useMemo(() => {
    if (viewMode === 'daily') {
      return currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else if (viewMode === 'weekly') {
      const weekDays: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(currentDate);
        date.setDate(currentDate.getDate() + i);
        weekDays.push(date);
      }
      return `${weekDays[0].toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} - ${weekDays[6].toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`;
    } else if (viewMode === 'monthly') {
      return currentDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      });
    } else if (viewMode === 'year') {
      return currentDate.getFullYear().toString();
    } else if (viewMode === 'schedule') {
      return `Next 30 days`;
    }
    return '';
  }, [viewMode, currentDate]);

  const handleNavigate = (date: Date, switchToWeekly?: boolean) => {
    // If switchToWeekly is true (clicked day number in monthly view), switch to weekly view
    if (switchToWeekly && viewMode === 'monthly') {
      setViewMode('weekly');
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      setCurrentDate(monday);
      return;
    }

    if (viewMode === 'weekly') {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      setCurrentDate(monday);
    } else if (viewMode === 'daily') {
      const newDate = new Date(date);
      newDate.setHours(0, 0, 0, 0);
      setCurrentDate(newDate);
    } else if (viewMode === 'monthly') {
      const newDate = new Date(date.getFullYear(), date.getMonth(), 1);
      setCurrentDate(newDate);
    } else if (viewMode === 'year') {
      const newDate = new Date(date.getFullYear(), 0, 1);
      setCurrentDate(newDate);
    } else if (viewMode === 'schedule') {
      const newDate = new Date(date);
      newDate.setHours(0, 0, 0, 0);
      setCurrentDate(newDate);
    }
  };

  // Apply color palette to card if available
  const cardStyle = colorPalette
    ? {
        backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.1)'),
      }
    : undefined;

  return (
    <Card
      className={cn(
        'w-full h-screen transition-all duration-1000 flex flex-col border-0',
        isFullscreen && 'fixed inset-0 z-[9999] m-0 rounded-none w-screen max-w-none'
      )}
      style={cardStyle}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <Select
              value={viewMode}
              onValueChange={(value) => setViewMode(value as CalendarViewMode)}
            >
              <SelectTrigger
                className="w-[120px] transition-all duration-1000"
                style={
                  colorPalette
                    ? {
                        borderColor: colorPalette.accent
                          .replace('rgb', 'rgba')
                          .replace(')', ', 0.4)'),
                        backgroundColor: colorPalette.primary
                          .replace('rgb', 'rgba')
                          .replace(')', ', 0.1)'),
                      }
                    : undefined
                }
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="year">Year</SelectItem>
                <SelectItem value="schedule">Schedule</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="transition-all duration-1000"
              style={
                colorPalette
                  ? {
                      borderColor: colorPalette.accent
                        .replace('rgb', 'rgba')
                        .replace(')', ', 0.4)'),
                      backgroundColor: colorPalette.primary
                        .replace('rgb', 'rgba')
                        .replace(')', ', 0.1)'),
                    }
                  : undefined
              }
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefreshCurrentView}
              title="Refresh current view"
              disabled={loadingEvents}
            >
              <RefreshCw className={cn('h-4 w-4', loadingEvents && 'animate-spin')} />
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={goToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div
              className="text-sm font-medium text-muted-foreground min-w-[200px] text-right"
              suppressHydrationWarning
            >
              {dateRangeString}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="ml-2"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsShortcutsDialogOpen(true)}
              className="ml-2"
              title="Keyboard shortcuts (?)"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="ml-2"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn('p-0 overflow-hidden relative flex-1 min-h-0 pb-0')}>
        {/* Loading overlay */}
        {loadingEvents && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 backdrop-blur-sm z-50 flex items-center justify-center transition-all duration-1000"
            style={
              colorPalette
                ? {
                    backgroundColor: colorPalette.primary
                      .replace('rgb', 'rgba')
                      .replace(')', ', 0.2)'),
                  }
                : {
                    backgroundColor: 'hsl(var(--background) / 0.2)',
                  }
            }
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 rounded-full transition-all duration-1000"
              style={
                colorPalette
                  ? {
                      borderColor: colorPalette.accent,
                      borderTopColor: 'transparent',
                    }
                  : {
                      borderColor: 'hsl(var(--primary))',
                      borderTopColor: 'transparent',
                    }
              }
            />
          </motion.div>
        )}

        <AnimatedCalendarView viewKey={viewMode} className="h-full min-h-0">
          {viewMode === 'daily' && (
            <DailyCalendarView
              currentDate={currentDate}
              events={events}
              timeFormat={timeFormat}
              onNavigate={handleNavigate}
              onEventClick={handleEventClick}
              onEventRightClick={handleEventRightClick}
              onPersonClick={handlePersonClick}
              onEventUpdate={handleEventUpdate}
              onEmptySpaceClick={handleEmptySpaceClick}
              previewEvent={previewEvent}
              people={people}
              colorPalette={colorPalette}
            />
          )}
          {viewMode === 'weekly' && (
            <WeeklyCalendarView
              currentWeek={currentDate}
              events={events}
              timeFormat={timeFormat}
              onNavigate={handleNavigate}
              onEventClick={handleEventClick}
              onEventRightClick={handleEventRightClick}
              onPersonClick={handlePersonClick}
              onEventUpdate={handleEventUpdate}
              onEmptySpaceClick={handleEmptySpaceClick}
              previewEvent={previewEvent}
              people={people}
              colorPalette={colorPalette}
            />
          )}
          {viewMode === 'monthly' && (
            <MonthlyCalendarView
              currentMonth={currentDate}
              events={events}
              onNavigate={handleNavigate}
              onEventClick={handleEventClick}
              onEventRightClick={handleEventRightClick}
              people={people}
              onPersonClick={handlePersonClick}
            />
          )}
          {viewMode === 'year' && (
            <AnnualCalendarView
              currentYear={currentDate}
              events={events}
              onNavigate={handleNavigate}
              onEventClick={handleEventClick}
              onEventRightClick={handleEventRightClick}
            />
          )}
          {viewMode === 'schedule' && (
            <ScheduleCalendarView
              ref={scheduleViewRef}
              currentDate={currentDate}
              events={events}
              timeFormat={timeFormat}
              onNavigate={handleNavigate}
              onEventClick={handleEventClick}
              onEventRightClick={handleEventRightClick}
              onPersonClick={handlePersonClick}
              people={people}
              colorPalette={colorPalette}
            />
          )}
        </AnimatedCalendarView>
      </CardContent>
      <CalendarSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        timeFormat={timeFormat}
        onTimeFormatChange={setTimeFormat}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={isShortcutsDialogOpen}
        onOpenChange={setIsShortcutsDialogOpen}
      />

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        isOpen={isEventModalOpen}
        onClose={handleCloseEventModal}
        timeFormat={timeFormat}
        onEventUpdate={handleEventUpdate}
        people={people}
        onPersonClick={handlePersonClick}
        colorPalette={colorPalette}
        onPeopleChange={(eventId, updatedPeople) => {
          // Update cache
          allCachedEventsRef.current = allCachedEventsRef.current.map((e) =>
            e.id === eventId ? { ...e, linkedPeople: updatedPeople } : e
          );
          // Optimistically update the event in the events array
          setEvents((prevEvents) =>
            prevEvents.map((e) => (e.id === eventId ? { ...e, linkedPeople: updatedPeople } : e))
          );
        }}
      />

      {/* New Event Modal */}
      <NewEventModal
        isOpen={isNewEventModalOpen}
        onClose={() => {
          setIsNewEventModalOpen(false);
          setNewEventInitialTime(undefined);
          setNewEventInitialDate(undefined);
          setPreviewEvent(null);
        }}
        timeFormat={timeFormat}
        initialStartTime={newEventInitialTime}
        initialDate={newEventInitialDate}
        onEventCreate={handleEventCreate}
        availableCalendars={availableCalendars}
        people={people}
        onPersonClick={handlePersonClick}
        colorPalette={colorPalette}
        onPeopleChange={(eventId, updatedPeople) => {
          // Optimistically update the event in the events array
          setEvents((prevEvents) =>
            prevEvents.map((e) => (e.id === eventId ? { ...e, linkedPeople: updatedPeople } : e))
          );
        }}
        onPreviewChange={(preview) => {
          if (!preview) {
            setPreviewEvent(null);
            return;
          }
          // Convert preview to CalendarEvent format
          const calendarEvent: CalendarEvent = {
            id: 'preview-' + Date.now(),
            title: preview.title,
            start: preview.startTime,
            end: preview.endTime,
            color: preview.color || '#4285f4',
            calendarId: preview.calendarId,
            isAllDay: preview.isAllDay,
          };
          setPreviewEvent(calendarEvent);
        }}
      />
      <PersonDetailModal
        isOpen={isPersonModalOpen}
        onClose={() => {
          setIsPersonModalOpen(false);
          setSelectedPerson(null);
        }}
        person={selectedPerson}
      />

      {/* Event Color Context Menu */}
      {contextMenuEvent && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setContextMenuEvent(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenuEvent(null);
            }}
          />
          <div
            className="fixed z-[9999]"
            style={{
              left: contextMenuEvent.x,
              top: contextMenuEvent.y,
            }}
          >
            <EventColorMenu
              event={contextMenuEvent.event}
              calendarColor={contextMenuEvent.calendarColor}
              onColorChange={handleColorChange}
            >
              <div style={{ width: 0, height: 0 }} />
            </EventColorMenu>
          </div>
        </>
      )}
    </Card>
  );
}
