'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarEvent } from '@/components/HQCalendar';
import { formatEventTime, isAllDayEvent } from '@/lib/calendar-utils';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import {
  MapPin,
  Users,
  Repeat,
  Video,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit2,
  Save,
  X,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatTimeForInput } from '@/lib/time-format-utils';
import { TimePicker } from '@/components/ui/time-picker';
import { PersonAvatar } from './PersonAvatar';
import { getMatchedPeopleFromEvent, Person } from '@/lib/people-matching';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';
import { getDominantColor } from '@/lib/spotify-color';

interface EventDetailModalProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  timeFormat: TimeFormat;
  onEventUpdate?: (
    eventId: string,
    calendarId: string,
    startTime: Date,
    endTime: Date,
    isAllDay?: boolean
  ) => Promise<void>;
  people?: Person[];
  onPersonClick?: (person: Person) => void;
  onPeopleChange?: (eventId: string, people: Person[]) => void;
}

/**
 * Event detail modal styled like a Notion page
 */
export function EventDetailModal({
  event,
  isOpen,
  onClose,
  timeFormat,
  onEventUpdate,
  people = [],
  onPersonClick,
  onPeopleChange,
}: EventDetailModalProps) {
  // All hooks must be called before any early returns
  // Local optimistic event state for UI updates without triggering parent rerenders
  const [optimisticEvent, setOptimisticEvent] = React.useState<CalendarEvent | null>(event);

  // Update optimistic event when prop event changes
  React.useEffect(() => {
    setOptimisticEvent(event);
  }, [event]);

  // Use optimistic event for rendering
  const displayEvent = optimisticEvent || event;

  const [isEditing, setIsEditing] = React.useState(false);
  const [editedStart, setEditedStart] = React.useState<Date>(() =>
    event ? new Date(event.start) : new Date()
  );
  const [editedEnd, setEditedEnd] = React.useState<Date>(() =>
    event ? new Date(event.end) : new Date()
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [isAllDayEdit, setIsAllDayEdit] = React.useState(() => event?.isAllDay || false);
  const [startDate, setStartDate] = React.useState<string>('');
  const [startTime, setStartTime] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');
  const [endTime, setEndTime] = React.useState<string>('');

  // Initialize date/time inputs when event changes or editing starts
  React.useEffect(() => {
    if (displayEvent) {
      const start = new Date(displayEvent.start);
      const end = new Date(displayEvent.end);
      setEditedStart(start);
      setEditedEnd(end);
      setIsAllDayEdit(displayEvent.isAllDay || false);

      // Format for date input (YYYY-MM-DD)
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);

      setStartTime(formatTimeForInput(start));
      setEndTime(formatTimeForInput(end));
    }
  }, [displayEvent, isEditing]);

  // Helper to get image URL from person
  const getImageUrl = React.useCallback((person: Person): string | null => {
    if (person.image_url) {
      return person.image_url;
    }

    const imageData = person.image;
    if (!imageData || !Array.isArray(imageData) || imageData.length === 0) {
      return null;
    }

    const firstFile = imageData[0];
    if (firstFile.type === 'external' && firstFile.external?.url) {
      return firstFile.external.url;
    }
    if (firstFile.type === 'file' && firstFile.file?.url) {
      return firstFile.file.url;
    }

    return null;
  }, []);

  // State for linked people (from database)
  const [linkedPeople, setLinkedPeople] = React.useState<Array<Person & { linkId?: string }>>([]);
  const [isLoadingLinkedPeople, setIsLoadingLinkedPeople] = React.useState(false);
  const [isAddingPerson, setIsAddingPerson] = React.useState(false);
  const [showPersonSelector, setShowPersonSelector] = React.useState(false);
  const [personSearchQuery, setPersonSearchQuery] = React.useState('');
  const [peopleWithRecentDates, setPeopleWithRecentDates] = React.useState<Map<string, Date>>(
    new Map()
  );
  const [badgeColors, setBadgeColors] = React.useState<Map<string, string>>(new Map());
  const personSelectorTriggerRef = React.useRef<HTMLDivElement>(null);

  // State for calendar and location editing
  const [calendars, setCalendars] = React.useState<
    Array<{ id: string; summary: string; color?: string }>
  >([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = React.useState(false);
  const [showCalendarSelector, setShowCalendarSelector] = React.useState(false);
  const [isUpdatingCalendar, setIsUpdatingCalendar] = React.useState(false);
  const [isEditingLocation, setIsEditingLocation] = React.useState(false);
  const [locationValue, setLocationValue] = React.useState('');
  const [isUpdatingLocation, setIsUpdatingLocation] = React.useState(false);

  // Use linked people from database (if available), otherwise fall back to title matching
  const matchedPeople = React.useMemo(() => {
    if (!displayEvent) return [];
    // Prefer linked people from database
    if (displayEvent.linkedPeople && displayEvent.linkedPeople.length > 0) {
      return displayEvent.linkedPeople;
    }
    // Fallback to title matching
    if (!people || people.length === 0) return [];
    return getMatchedPeopleFromEvent(displayEvent.title, people);
  }, [displayEvent?.linkedPeople, displayEvent?.title, people]);

  // Fetch linked people when event changes
  React.useEffect(() => {
    if (displayEvent?.id) {
      fetchLinkedPeople();
    } else {
      setLinkedPeople([]);
    }
  }, [displayEvent?.id]);

  // Extract badge colors from linked people's images
  React.useEffect(() => {
    const extractColors = async () => {
      const colorMap = new Map<string, string>();

      for (const person of linkedPeople) {
        const imageUrl = getImageUrl(person);
        if (imageUrl) {
          try {
            const color = await getDominantColor(imageUrl);
            colorMap.set(person.id, color);
          } catch (error) {
            // Use default muted color if extraction fails
            colorMap.set(person.id, 'hsl(var(--muted))');
          }
        } else {
          // Use default muted color if no image
          colorMap.set(person.id, 'hsl(var(--muted))');
        }
      }

      setBadgeColors(colorMap);
    };

    if (linkedPeople.length > 0) {
      extractColors();
    } else {
      setBadgeColors(new Map());
    }
  }, [linkedPeople, getImageUrl]);

  // Fetch calendars when modal opens
  React.useEffect(() => {
    if (isOpen) {
      fetchCalendars();
    }
  }, [isOpen]);

  // Initialize location value when event changes
  React.useEffect(() => {
    if (displayEvent?.location) {
      setLocationValue(displayEvent.location);
    } else {
      setLocationValue('');
    }
    setIsEditingLocation(false);
  }, [displayEvent?.location]);

  const fetchCalendars = async () => {
    setIsLoadingCalendars(true);
    try {
      const response = await fetch('/api/google-calendar/calendars');
      if (response.ok) {
        const data = await response.json();
        setCalendars(data.calendars || []);
      }
    } catch (error) {
      console.error('Error fetching calendars:', error);
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const fetchLinkedPeople = async () => {
    if (!displayEvent?.id) return;

    setIsLoadingLinkedPeople(true);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(displayEvent.id)}/people`);
      const data = await response.json();
      if (response.ok) {
        setLinkedPeople(data.people || []);
      }
    } catch (error) {
      console.error('Error fetching linked people:', error);
    } finally {
      setIsLoadingLinkedPeople(false);
    }
  };

  const handleAddPerson = async (personId: string) => {
    if (!displayEvent?.id) return;

    // Optimistically update
    const person = people.find((p) => p.id === personId);
    if (person) {
      const optimisticPerson = { ...person, linkId: `temp-${Date.now()}` };
      setLinkedPeople((prev) => [...prev, optimisticPerson]);
      setShowPersonSelector(false);
      setPersonSearchQuery('');

      // Optimistically update parent component
      const updatedPeople = [...linkedPeople, optimisticPerson];
      onPeopleChange?.(displayEvent.id, updatedPeople);
    }

    setIsAddingPerson(true);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(displayEvent.id)}/people`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId }),
      });

      const data = await response.json();
      if (response.ok) {
        // Replace optimistic update with real data
        setLinkedPeople((prev) =>
          prev.map((p) => (p.id === personId && p.linkId?.startsWith('temp-') ? data.person : p))
        );
        // Update parent with real data
        const updatedPeople = linkedPeople
          .filter((p) => !p.linkId?.startsWith('temp-'))
          .concat(data.person);
        onPeopleChange?.(displayEvent.id, updatedPeople);
      } else {
        // Revert optimistic update on error
        setLinkedPeople((prev) =>
          prev.filter((p) => p.id !== personId || !p.linkId?.startsWith('temp-'))
        );
        const revertedPeople = linkedPeople.filter((p) => p.id !== personId);
        onPeopleChange?.(displayEvent.id, revertedPeople);
        alert(data.error || 'Failed to add person');
      }
    } catch (error) {
      console.error('Error adding person:', error);
      // Revert optimistic update on error
      setLinkedPeople((prev) =>
        prev.filter((p) => p.id !== personId || !p.linkId?.startsWith('temp-'))
      );
      const revertedPeople = linkedPeople.filter((p) => p.id !== personId);
      onPeopleChange?.(displayEvent.id, revertedPeople);
      alert('Failed to add person');
    } finally {
      setIsAddingPerson(false);
    }
  };

  const handleRemovePerson = async (personId: string) => {
    if (!displayEvent?.id) return;

    // Optimistically update
    const personToRemove = linkedPeople.find((p) => p.id === personId);
    setLinkedPeople((prev) => prev.filter((p) => p.id !== personId));

    // Optimistically update parent component
    const updatedPeople = linkedPeople.filter((p) => p.id !== personId);
    onPeopleChange?.(displayEvent.id, updatedPeople);

    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(displayEvent.id)}/people?personId=${personId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        // Revert optimistic update on error
        if (personToRemove) {
          setLinkedPeople((prev) => [...prev, personToRemove]);
          onPeopleChange?.(displayEvent.id, linkedPeople);
        }
        const data = await response.json();
        alert(data.error || 'Failed to remove person');
      }
    } catch (error) {
      console.error('Error removing person:', error);
      // Revert optimistic update on error
      if (personToRemove) {
        setLinkedPeople((prev) => [...prev, personToRemove]);
        onPeopleChange?.(displayEvent.id, linkedPeople);
      }
      alert('Failed to remove person');
    }
  };

  // Fetch most recent attachment date for each person (when they were last attached to an event)
  React.useEffect(() => {
    const fetchRecentDates = async () => {
      if (!showPersonSelector || people.length === 0) return;

      try {
        const response = await fetch('/api/people/recent-attachments');
        if (response.ok) {
          const data = await response.json();
          const recentDates = data.recentDates || {};
          const dateMap = new Map<string, Date>();
          Object.entries(recentDates).forEach(([personId, dateStr]) => {
            dateMap.set(personId, new Date(dateStr as string));
          });
          setPeopleWithRecentDates(dateMap);
        }
      } catch (error) {
        // Silently fail
      }
    };

    if (showPersonSelector) {
      fetchRecentDates();
    }
  }, [showPersonSelector, people]);

  // Get available people (not already linked), filtered and sorted
  const availablePeople = React.useMemo(() => {
    const linkedIds = new Set(linkedPeople.map((p) => p.id));
    let filtered = people.filter((p) => !linkedIds.has(p.id));

    // Filter by search query
    if (personSearchQuery.trim()) {
      const query = personSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.nicknames && p.nicknames.some((n) => n.toLowerCase().includes(query)))
      );
    }

    // Sort by most recently attached to an event
    filtered.sort((a, b) => {
      const dateA = peopleWithRecentDates.get(a.id);
      const dateB = peopleWithRecentDates.get(b.id);

      // People with recent attachments come first
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      if (!dateA && !dateB) return 0; // Both have no attachments, keep original order

      // Sort by most recent attachment first
      return dateB!.getTime() - dateA!.getTime();
    });

    return filtered;
  }, [people, linkedPeople, personSearchQuery, peopleWithRecentDates]);

  // Handle all-day toggle
  const handleAllDayToggle = (checked: boolean) => {
    setIsAllDayEdit(checked);
    if (checked) {
      // When switching to all-day, set times to start/end of day
      setStartTime('00:00');
      setEndTime('23:59');
    }
  };

  const handleSave = async () => {
    if (!onEventUpdate || !displayEvent) return;

    const calendarId = displayEvent.calendarId || displayEvent.calendar;
    if (!calendarId) {
      console.error('No calendar ID available');
      return;
    }

    let newStart: Date;
    let newEnd: Date;

    if (isAllDayEdit) {
      // For all-day events, set to start and end of day
      newStart = new Date(startDate);
      newStart.setHours(0, 0, 0, 0);
      newEnd = new Date(endDate);
      newEnd.setHours(23, 59, 59, 999);
    } else {
      // Combine date and time inputs
      newStart = new Date(`${startDate}T${startTime}:00`);
      newEnd = new Date(`${endDate}T${endTime}:00`);
    }

    if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
      alert('Invalid date or time');
      return;
    }

    if (newStart >= newEnd) {
      alert('End time must be after start time');
      return;
    }

    setIsSaving(true);
    try {
      if (onEventUpdate) {
        await onEventUpdate(displayEvent.id, calendarId, newStart, newEnd, isAllDayEdit);
      } else {
        // Fallback to direct API call if onEventUpdate is not provided
        const response = await fetch(`/api/google-calendar/events/${displayEvent.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            calendarId,
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
            isAllDay: isAllDayEdit,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update event');
        }
      }

      setIsEditing(false);
      // Refresh the event data by closing and reopening (parent should handle this)
      onClose();
      // Small delay to allow state to update
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('calendar-refresh'));
      }, 500);
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Failed to update event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    if (displayEvent) {
      setEditedStart(new Date(displayEvent.start));
      setEditedEnd(new Date(displayEvent.end));
      setIsAllDayEdit(displayEvent.isAllDay || false);
      const start = new Date(displayEvent.start);
      const end = new Date(displayEvent.end);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
      setStartTime(formatTimeForInput(start));
      setEndTime(formatTimeForInput(end));
    }
    setIsEditing(false);
  };

  const handleCalendarChange = async (newCalendarId: string) => {
    if (
      !displayEvent ||
      newCalendarId === displayEvent.calendarId ||
      newCalendarId === displayEvent.calendar
    ) {
      setShowCalendarSelector(false);
      return;
    }

    setIsUpdatingCalendar(true);
    const oldCalendarId = displayEvent.calendarId || displayEvent.calendar;
    const newCalendar = calendars.find((c) => c.id === newCalendarId);

    // Optimistic update - update local state immediately
    const updatedEvent = {
      ...displayEvent,
      calendarId: newCalendarId,
      calendar: newCalendar?.summary || displayEvent.calendar,
      color: newCalendar?.color || displayEvent.color,
    };
    setOptimisticEvent(updatedEvent);
    setShowCalendarSelector(false);

    try {
      const response = await fetch(`/api/google-calendar/events/${displayEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: oldCalendarId,
          newCalendarId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update calendar');
      }

      const data = await response.json();

      // Update optimistic event with server response
      // Ensure calendar name is used (not ID) - prefer API response, then newCalendar summary, then keep current
      const calendarName =
        data.event.calendar && data.event.calendar !== data.event.calendarId
          ? data.event.calendar
          : newCalendar?.summary || displayEvent.calendar;

      setOptimisticEvent({
        ...updatedEvent,
        calendarId: data.event.calendarId || newCalendarId,
        calendar: calendarName,
        color: data.event.color || newCalendar?.color || displayEvent.color,
      });

      // Silently update parent without triggering full refresh
      // Only update the specific event in parent's cache, not trigger a full calendar refresh
      if (onEventUpdate) {
        await onEventUpdate(
          displayEvent.id,
          newCalendarId,
          new Date(data.event.start),
          new Date(data.event.end),
          data.event.isAllDay
        );
      }
    } catch (error) {
      console.error('Error updating calendar:', error);
      // Revert optimistic update on error
      setOptimisticEvent(displayEvent);
      alert('Failed to update calendar. Please try again.');
    } finally {
      setIsUpdatingCalendar(false);
    }
  };

  const handleLocationSave = async () => {
    if (!displayEvent) return;

    setIsUpdatingLocation(true);
    const newLocation = locationValue.trim();

    // Optimistic update
    const updatedEvent = {
      ...displayEvent,
      location: newLocation,
    };
    setOptimisticEvent(updatedEvent);
    setIsEditingLocation(false);

    try {
      const response = await fetch(`/api/google-calendar/events/${displayEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: displayEvent.calendarId || displayEvent.calendar,
          location: newLocation,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update location');
      }

      const data = await response.json();

      // Update optimistic event with server response
      setOptimisticEvent({
        ...updatedEvent,
        location: data.event.location || newLocation,
      });

      // Silently update parent without triggering full refresh
      if (onEventUpdate) {
        await onEventUpdate(
          displayEvent.id,
          displayEvent.calendarId || displayEvent.calendar,
          new Date(data.event.start),
          new Date(data.event.end),
          data.event.isAllDay
        );
      }
    } catch (error) {
      console.error('Error updating location:', error);
      // Revert optimistic update on error
      setOptimisticEvent(displayEvent);
      setIsEditingLocation(true);
      alert('Failed to update location. Please try again.');
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // Format date for display (like "20 Dec 2025")
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'd MMM yyyy');
  };

  // Early return after all hooks
  if (!displayEvent) return null;

  const isAllDay = isAllDayEvent(displayEvent);
  const eventStartDate = new Date(displayEvent.start);
  const eventEndDate = new Date(displayEvent.end);

  // Format date range
  const formatDateRange = () => {
    if (isAllDay) {
      const startStr = format(eventStartDate, 'EEEE, MMMM d, yyyy');
      const endStr = format(eventEndDate, 'EEEE, MMMM d, yyyy');

      if (startStr === endStr) {
        return startStr;
      }
      return `${startStr} - ${endStr}`;
    } else {
      const startStr = format(eventStartDate, 'EEEE, MMMM d, yyyy');
      const startTime = formatEventTime(eventStartDate, timeFormat);
      const endTime = formatEventTime(eventEndDate, timeFormat);

      if (format(eventStartDate, 'yyyy-MM-dd') === format(eventEndDate, 'yyyy-MM-dd')) {
        return `${startStr} at ${startTime} - ${endTime}`;
      } else {
        const endStr = format(eventEndDate, 'EEEE, MMMM d, yyyy');
        return `${startStr} at ${startTime} - ${endStr} at ${endTime}`;
      }
    }
  };

  const formatDuration = () => {
    if (isAllDay) return 'All day';

    const durationMs = eventEndDate.getTime() - eventStartDate.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) return `${minutes} minutes`;
    if (minutes === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    return `${hours}h ${minutes}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-0 shadow-2xl">
        {/* Notion-style header with color accent */}
        <div className="h-1 w-full" style={{ backgroundColor: displayEvent.color || '#4285f4' }} />

        <div className="px-6 py-8 pb-16 relative">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-semibold mb-2 flex items-center gap-2">
              {/* Person avatars - to the left of the title, overlapping */}
              {matchedPeople.length > 0 && (
                <div className="flex items-center flex-shrink-0">
                  {matchedPeople.map((person: Person, index: number) => (
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
                        size="md"
                        onClick={() => onPersonClick?.(person)}
                      />
                    </div>
                  ))}
                </div>
              )}
              <span className="flex-1">{displayEvent.title}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Event details - Notion style */}
          <div className="space-y-6">
            {/* Date & Time */}
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-muted-foreground">Date & Time</div>
                  {!isAllDay && onEventUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                      className="h-7 px-2"
                    >
                      {isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-4">
                    {/* All-day toggle */}
                    <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="all-day-toggle"
                          className="text-sm font-medium cursor-pointer"
                        >
                          All day
                        </Label>
                      </div>
                      <Switch
                        id="all-day-toggle"
                        checked={isAllDayEdit}
                        onCheckedChange={handleAllDayToggle}
                      />
                    </div>

                    {/* Google Calendar style date/time picker */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Start Date */}
                      <div className="relative">
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="h-10 px-3 py-2 bg-background border rounded-md text-sm font-medium cursor-pointer hover:bg-accent transition-colors"
                          style={{ minWidth: '140px' }}
                        />
                        <div className="absolute -top-2 left-2 px-1 bg-background text-[10px] text-muted-foreground">
                          Start date
                        </div>
                      </div>

                      {!isAllDayEdit && (
                        <>
                          {/* Start Time */}
                          <div className="relative">
                            <TimePicker
                              value={startTime}
                              onChange={(newValue) => {
                                setStartTime(newValue);
                              }}
                              timeFormat={timeFormat}
                              className="h-10"
                            />
                            <div className="absolute -top-2 left-2 px-1 bg-background text-[10px] text-muted-foreground">
                              Start time
                            </div>
                          </div>

                          {/* "to" separator */}
                          <span className="text-sm text-muted-foreground px-2">to</span>

                          {/* End Time */}
                          <div className="relative">
                            <TimePicker
                              value={endTime}
                              onChange={(newValue) => {
                                setEndTime(newValue);
                              }}
                              timeFormat={timeFormat}
                              className="h-10"
                            />
                            <div className="absolute -top-2 left-2 px-1 bg-background text-[10px] text-muted-foreground">
                              End time
                            </div>
                          </div>
                        </>
                      )}

                      {isAllDayEdit && (
                        <>
                          {/* "to" separator for all-day */}
                          <span className="text-sm text-muted-foreground px-2">to</span>
                        </>
                      )}

                      {/* End Date */}
                      <div className="relative">
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-10 px-3 py-2 bg-background border rounded-md text-sm font-medium cursor-pointer hover:bg-accent transition-colors"
                          style={{ minWidth: '140px' }}
                        />
                        <div className="absolute -top-2 left-2 px-1 bg-background text-[10px] text-muted-foreground">
                          End date
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={handleSave} disabled={isSaving} className="flex-1">
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-base">{formatDateRange()}</div>
                    {!isAllDay && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Duration: {formatDuration()}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Calendar */}
            {displayEvent.calendar && (
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <Popover
                    open={showCalendarSelector}
                    onOpenChange={(open) => {
                      if (!isUpdatingCalendar) {
                        setShowCalendarSelector(open);
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        className="inline-flex items-center px-2.5 py-1 rounded-full hover:opacity-90 transition-opacity cursor-pointer"
                        style={{ backgroundColor: displayEvent.color || '#4285f4' }}
                        disabled={isUpdatingCalendar || isLoadingCalendars}
                      >
                        <span className="text-xs font-medium text-white">
                          {displayEvent.calendar}
                        </span>
                        {!isUpdatingCalendar && (
                          <ChevronDown className="h-3 w-3 text-white ml-1.5" />
                        )}
                        {isUpdatingCalendar && (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin ml-1.5" />
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-56 p-1"
                      align="start"
                      style={{ zIndex: 10002 }}
                      onInteractOutside={(e) => {
                        // Allow clicks inside the dialog but prevent closing when clicking outside
                        const target = e.target as HTMLElement;
                        if (target.closest('[role="dialog"]')) {
                          // Don't close when clicking inside dialog
                          return;
                        }
                      }}
                    >
                      <div className="max-h-64 overflow-y-auto" style={{ pointerEvents: 'auto' }}>
                        {calendars.map((cal) => (
                          <button
                            key={cal.id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCalendarChange(cal.id);
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-left cursor-pointer"
                            disabled={isUpdatingCalendar}
                            style={{ pointerEvents: 'auto' }}
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cal.color || '#4285f4' }}
                            />
                            <span className="text-sm flex-1 truncate">{cal.summary}</span>
                            {(displayEvent.calendarId === cal.id ||
                              displayEvent.calendar === cal.id) && (
                              <CheckCircle className="h-4 w-4 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {/* Description */}
            {displayEvent.description && displayEvent.description.trim() && (
              <div className="flex items-start gap-4">
                <div className="w-full">
                  <div className="text-sm font-medium text-muted-foreground mb-2">Description</div>
                  <div
                    className="text-sm leading-relaxed [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2
                      [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2
                      [&_li]:my-1 [&_li]:leading-relaxed
                      [&_strong]:font-semibold [&_b]:font-semibold
                      [&_em]:italic [&_i]:italic
                      [&_p]:my-2 [&_p]:leading-relaxed
                      [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                      [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2
                      [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2
                      [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:underline [&_a]:hover:text-blue-800 [&_a]:dark:hover:text-blue-300
                      [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono
                      [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:my-2
                      [&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-2
                      [&_hr]:my-4 [&_hr]:border-t [&_hr]:border-border"
                    dangerouslySetInnerHTML={{ __html: displayEvent.description }}
                  />
                </div>
              </div>
            )}

            {/* People and Location */}
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* People Section */}
                  <div ref={personSelectorTriggerRef}>
                    <div className="relative flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-muted-foreground">People</div>
                      {availablePeople.length > 0 && linkedPeople.length > 0 && (
                        <Popover open={showPersonSelector} onOpenChange={setShowPersonSelector}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-2">
                              <Plus className="h-4 w-4 mr-1" />
                              Add
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-64 p-0"
                            align="end"
                            side="bottom"
                            style={{ zIndex: 10002 }}
                            onPointerDownOutside={(e) => {
                              const target = e.target as HTMLElement;
                              // Don't close when clicking inside the dialog
                              if (target.closest('[role="dialog"]')) {
                                e.preventDefault();
                              }
                            }}
                            onFocusOutside={(e) => {
                              const target = e.target as HTMLElement;
                              // Don't close when focusing inside the dialog
                              if (target.closest('[role="dialog"]')) {
                                e.preventDefault();
                              }
                            }}
                            onOpenAutoFocus={(e) => {
                              // Prevent auto focus to allow manual focus on input
                              e.preventDefault();
                            }}
                          >
                            {/* Search bar */}
                            <div className="p-2 border-b">
                              <Input
                                placeholder="Search people..."
                                value={personSearchQuery}
                                onChange={(e) => setPersonSearchQuery(e.target.value)}
                                className="h-8 text-sm"
                                autoFocus
                                onMouseDown={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                              />
                            </div>
                            {/* People list */}
                            <div
                              className="max-h-48 overflow-y-auto"
                              style={{ pointerEvents: 'auto' }}
                            >
                              {availablePeople.length > 0 ? (
                                availablePeople.map((person) => (
                                  <button
                                    key={person.id}
                                    onClick={() => handleAddPerson(person.id)}
                                    disabled={isAddingPerson}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-left"
                                    style={{ pointerEvents: 'auto' }}
                                  >
                                    <PersonAvatar person={person} size="sm" onClick={undefined} />
                                    <span className="text-sm">{person.name}</span>
                                    {peopleWithRecentDates.has(person.id) && (
                                      <span className="text-xs text-muted-foreground ml-auto">
                                        {format(
                                          new Date(peopleWithRecentDates.get(person.id)!),
                                          'MMM d, yyyy'
                                        )}
                                      </span>
                                    )}
                                  </button>
                                ))
                              ) : (
                                <div className="p-4 text-sm text-muted-foreground text-center">
                                  {personSearchQuery.trim()
                                    ? 'No people found'
                                    : 'No people available'}
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    {isLoadingLinkedPeople ? (
                      <div className="text-sm text-muted-foreground">Loading...</div>
                    ) : linkedPeople.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {linkedPeople.map((person) => {
                          const firstName = person.name.split(' ')[0];
                          const badgeColor = badgeColors.get(person.id) || 'hsl(var(--muted))';
                          return (
                            <div
                              key={person.id}
                              className="relative inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full transition-colors group cursor-pointer"
                              style={{
                                backgroundColor: badgeColor,
                              }}
                              onClick={() => onPersonClick?.(person)}
                            >
                              <PersonAvatar
                                person={person}
                                size="sm"
                                onClick={() => onPersonClick?.(person)}
                              />
                              <span className="text-xs font-medium text-white">{firstName}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePerson(person.id);
                                }}
                                className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-all duration-200 w-4 h-4 flex items-center justify-center bg-destructive hover:bg-destructive/90 rounded-full"
                                title="Remove person"
                              >
                                <X className="h-2.5 w-2.5 text-white" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : availablePeople.length > 0 ? (
                      <Popover open={showPersonSelector} onOpenChange={setShowPersonSelector}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2">
                            <Plus className="h-4 w-4 mr-1" />
                            Add people
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-64 p-0"
                          align="end"
                          side="bottom"
                          style={{ zIndex: 10002 }}
                          onPointerDownOutside={(e) => {
                            const target = e.target as HTMLElement;
                            // Don't close when clicking inside the dialog
                            if (target.closest('[role="dialog"]')) {
                              e.preventDefault();
                            }
                          }}
                          onFocusOutside={(e) => {
                            const target = e.target as HTMLElement;
                            // Don't close when focusing inside the dialog
                            if (target.closest('[role="dialog"]')) {
                              e.preventDefault();
                            }
                          }}
                          onOpenAutoFocus={(e) => {
                            // Prevent auto focus to allow manual focus on input
                            e.preventDefault();
                          }}
                        >
                          {/* Search bar */}
                          <div className="p-2 border-b">
                            <Input
                              placeholder="Search people..."
                              value={personSearchQuery}
                              onChange={(e) => setPersonSearchQuery(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                              onMouseDown={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            />
                          </div>
                          {/* People list */}
                          <div
                            className="max-h-48 overflow-y-auto"
                            style={{ pointerEvents: 'auto' }}
                          >
                            {availablePeople.length > 0 ? (
                              availablePeople.map((person) => (
                                <button
                                  key={person.id}
                                  onClick={() => handleAddPerson(person.id)}
                                  disabled={isAddingPerson}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-left"
                                  style={{ pointerEvents: 'auto' }}
                                >
                                  <PersonAvatar person={person} size="sm" onClick={undefined} />
                                  <span className="text-sm">{person.name}</span>
                                  {peopleWithRecentDates.has(person.id) && (
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {format(
                                        new Date(peopleWithRecentDates.get(person.id)!),
                                        'MMM d, yyyy'
                                      )}
                                    </span>
                                  )}
                                </button>
                              ))
                            ) : (
                              <div className="p-4 text-sm text-muted-foreground text-center">
                                {personSearchQuery.trim()
                                  ? 'No people found'
                                  : 'No people available'}
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="text-sm text-muted-foreground">No people available</div>
                    )}
                  </div>

                  {/* Location Section */}
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-2">Location</div>
                    {isEditingLocation ? (
                      <div className="space-y-2">
                        <Input
                          value={locationValue}
                          onChange={(e) => setLocationValue(e.target.value)}
                          placeholder="Enter location..."
                          className="text-base"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleLocationSave();
                            } else if (e.key === 'Escape') {
                              setIsEditingLocation(false);
                              setLocationValue(event.location || '');
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleLocationSave}
                            disabled={isUpdatingLocation}
                          >
                            {isUpdatingLocation ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Save
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsEditingLocation(false);
                              setLocationValue(displayEvent.location || '');
                            }}
                            disabled={isUpdatingLocation}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : displayEvent.location && String(displayEvent.location).trim() !== '' ? (
                      <a
                        href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(
                          displayEvent.location
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 group"
                      >
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{displayEvent.location}</span>
                        <svg
                          className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingLocation(true)}
                        className="h-7 px-2"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add location
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Attendees */}
            {displayEvent.attendees && displayEvent.attendees.length > 0 && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Attendees ({displayEvent.attendees.length})
                  </div>
                  <div className="space-y-1">
                    {displayEvent.attendees.map((attendee, idx) => (
                      <div key={idx} className="text-base flex items-center gap-2">
                        <span>{attendee.displayName || attendee.email}</span>
                        {attendee.organizer && (
                          <span className="text-xs text-muted-foreground">(Organizer)</span>
                        )}
                        {attendee.responseStatus && (
                          <span
                            className={cn(
                              'text-xs px-2 py-0.5 rounded',
                              attendee.responseStatus === 'accepted' &&
                                'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                              attendee.responseStatus === 'declined' &&
                                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                              attendee.responseStatus === 'tentative' &&
                                'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                              attendee.responseStatus === 'needsAction' &&
                                'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                            )}
                          >
                            {attendee.responseStatus === 'accepted' && 'Accepted'}
                            {attendee.responseStatus === 'declined' && 'Declined'}
                            {attendee.responseStatus === 'tentative' && 'Tentative'}
                            {attendee.responseStatus === 'needsAction' && 'No response'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recurrence */}
            {displayEvent.recurrence && displayEvent.recurrence.length > 0 && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <Repeat className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Recurrence</div>
                  <div className="text-base">
                    Recurring event
                    {displayEvent.recurrence[0] && (
                      <div className="text-sm text-muted-foreground mt-1 font-mono">
                        {displayEvent.recurrence[0]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Video Conference */}
            {(displayEvent.hangoutLink ||
              (displayEvent.conferenceData?.entryPoints &&
                displayEvent.conferenceData.entryPoints.length > 0)) && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <Video className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Video Conference
                  </div>
                  {displayEvent.hangoutLink && (
                    <a
                      href={displayEvent.hangoutLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base text-blue-600 dark:text-blue-400 hover:underline block"
                    >
                      Join Google Meet
                    </a>
                  )}
                  {displayEvent.conferenceData?.entryPoints?.map((entry: any, idx: number) => (
                    <div key={idx} className="mt-1">
                      <a
                        href={entry.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {entry.label || entry.entryPointType || 'Join meeting'}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status */}
            {displayEvent.status && displayEvent.status !== 'confirmed' && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {displayEvent.status === 'cancelled' ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : displayEvent.status === 'tentative' ? (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Status</div>
                  <div className="text-base capitalize">{displayEvent.status}</div>
                </div>
              </div>
            )}

            {/* Visibility */}
            {displayEvent.visibility && displayEvent.visibility !== 'default' && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {displayEvent.visibility === 'private' ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Visibility</div>
                  <div className="text-base capitalize">{displayEvent.visibility}</div>
                </div>
              </div>
            )}

            {/* Transparency */}
            {displayEvent.transparency && displayEvent.transparency !== 'opaque' && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <div className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Transparency</div>
                  <div className="text-base capitalize">
                    {displayEvent.transparency === 'transparent'
                      ? 'Shows as available'
                      : displayEvent.transparency}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Open event button in bottom left */}
        {displayEvent.htmlLink && (
          <div className="absolute bottom-4 left-4">
            <Button variant="outline" size="sm" asChild>
              <a href={displayEvent.htmlLink} target="_blank" rel="noopener noreferrer">
                Open event
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
