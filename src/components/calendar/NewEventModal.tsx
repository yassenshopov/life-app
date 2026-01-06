'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import { Calendar, Clock, MapPin, Save, X, Users, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LocationAutocomplete } from './LocationAutocomplete';
import { formatTimeForInput, parseTimeInput } from '@/lib/time-format-utils';
import { TimePicker } from '@/components/ui/time-picker';
import { PersonAvatar } from './PersonAvatar';
import { getMatchedPeopleFromEvent, Person } from '@/lib/people-matching';
import { renderTitleWithAvatars } from '@/lib/render-title-with-avatars';

interface NewEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeFormat: TimeFormat;
  initialStartTime?: Date;
  initialDate?: Date;
  onEventCreate: (event: {
    title: string;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
    description?: string;
    location?: string;
    calendarId: string;
  }) => Promise<void>;
  availableCalendars?: Array<{
    id: string;
    summary: string;
    color?: string;
  }>;
  onPreviewChange?: (preview: {
    title: string;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
    calendarId: string;
    color?: string;
  } | null) => void;
  people?: Person[];
  onPersonClick?: (person: Person) => void;
  onPeopleChange?: (eventId: string, people: Person[]) => void;
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

/**
 * New event modal styled like EventDetailModal
 */
export function NewEventModal({
  isOpen,
  onClose,
  timeFormat,
  initialStartTime,
  initialDate,
  onEventCreate,
  availableCalendars = [],
  onPreviewChange,
  people = [],
  onPersonClick,
  onPeopleChange,
  colorPalette,
}: NewEventModalProps) {
  const [title, setTitle] = React.useState('');
  const [isAllDay, setIsAllDay] = React.useState(false);
  const [startDate, setStartDate] = React.useState<string>('');
  const [startTime, setStartTime] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');
  const [endTime, setEndTime] = React.useState<string>('');
  const [description, setDescription] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [selectedCalendarId, setSelectedCalendarId] = React.useState<string>('');
  const [isCreating, setIsCreating] = React.useState(false);
  const titleRef = React.useRef<HTMLHeadingElement | null>(null);
  const [showPeopleSelector, setShowPeopleSelector] = React.useState(false);
  const [personSearchQuery, setPersonSearchQuery] = React.useState('');
  const [peopleWithRecentDates, setPeopleWithRecentDates] = React.useState<Map<string, Date>>(new Map());
  const [selectedPeopleIds, setSelectedPeopleIds] = React.useState<string[]>([]);

  // Match people from title
  const matchedPeople = React.useMemo(() => {
    if (!title || !people || people.length === 0) return [];
    return getMatchedPeopleFromEvent(title, people);
  }, [title, people]);

  // Fetch most recent attachment date for each person (when they were last attached to an event)
  React.useEffect(() => {
    const fetchRecentDates = async () => {
      if (!showPeopleSelector || people.length === 0) return;
      
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

    fetchRecentDates();
  }, [showPeopleSelector, people]);

  // Get filtered and sorted people
  const availablePeopleForSelection = React.useMemo(() => {
    let filtered = [...people];
    
    // Filter by search query
    if (personSearchQuery.trim()) {
      const query = personSearchQuery.toLowerCase();
      filtered = filtered.filter((p) => 
        p.name.toLowerCase().includes(query) ||
        (p.nicknames && p.nicknames.some(n => n.toLowerCase().includes(query)))
      );
    }
    
    // Sort by most recently attached to an event
    filtered.sort((a, b) => {
      const dateA = peopleWithRecentDates.get(a.id);
      const dateB = peopleWithRecentDates.get(b.id);
      
      // People with recent attachments come first
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      if (!dateA && !dateB) return 0;
      
      // Sort by most recent attachment first
      return dateB!.getTime() - dateA!.getTime();
    });
    
    return filtered;
  }, [people, personSearchQuery, peopleWithRecentDates]);

  // Initialize with initial time or current time
  React.useEffect(() => {
    if (isOpen) {
      const baseDate = initialDate || initialStartTime || new Date();
      const start = initialStartTime || new Date();
      const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 minutes later

      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);

      const formatTime = (date: Date) => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      };
      setStartTime(formatTime(start));
      setEndTime(formatTime(end));

      // Set default calendar to first available or primary
      if (availableCalendars.length > 0 && !selectedCalendarId) {
        const primaryCalendar = availableCalendars.find(cal => cal.id === 'primary') || availableCalendars[0];
        setSelectedCalendarId(primaryCalendar.id);
      }

      // Focus the title input when modal opens
      setTimeout(() => {
        if (titleRef.current) {
          titleRef.current.focus();
        }
      }, 100);
    } else {
      // Reset title when modal closes
      setTitle('');
      if (titleRef.current) {
        titleRef.current.textContent = '';
      }
      onPreviewChange?.(null);
    }
  }, [isOpen, initialStartTime, initialDate, availableCalendars, selectedCalendarId, onPreviewChange]);

  // Update preview whenever form fields change
  const updatePreview = React.useCallback(() => {
    if (!onPreviewChange || !selectedCalendarId || !startDate || !endDate) {
      onPreviewChange?.(null);
      return;
    }

    try {
      let newStart: Date;
      let newEnd: Date;

      if (isAllDay) {
        newStart = new Date(startDate);
        newStart.setHours(0, 0, 0, 0);
        newEnd = new Date(endDate);
        newEnd.setHours(23, 59, 59, 999);
      } else {
        if (!startTime || !endTime) {
          onPreviewChange?.(null);
          return;
        }
        newStart = new Date(`${startDate}T${startTime}:00`);
        newEnd = new Date(`${endDate}T${endTime}:00`);
      }

      if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime()) || newStart >= newEnd) {
        onPreviewChange?.(null);
        return;
      }

      const selectedCal = availableCalendars.find(cal => cal.id === selectedCalendarId);
      const calendarColor = selectedCal?.color || '#4285f4';

      onPreviewChange({
        title: title.trim() || 'New Event',
        startTime: newStart,
        endTime: newEnd,
        isAllDay,
        calendarId: selectedCalendarId,
        color: calendarColor,
      });
    } catch (error) {
      onPreviewChange?.(null);
    }
  }, [title, startDate, startTime, endDate, endTime, isAllDay, selectedCalendarId, availableCalendars, onPreviewChange]);

  // Update preview when relevant fields change
  React.useEffect(() => {
    if (isOpen) {
      // Use requestAnimationFrame to batch updates and prevent infinite loops
      const rafId = requestAnimationFrame(() => {
        updatePreview();
      });
      return () => cancelAnimationFrame(rafId);
    } else {
      onPreviewChange?.(null);
    }
  }, [isOpen, title, startDate, startTime, endDate, endTime, isAllDay, selectedCalendarId, updatePreview, onPreviewChange]);

  const handleAllDayToggle = (checked: boolean) => {
    setIsAllDay(checked);
    if (checked) {
      setStartTime('00:00');
      setEndTime('23:59');
    }
    updatePreview();
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      alert('Please enter a title for the event');
      return;
    }

    if (!selectedCalendarId) {
      alert('Please select a calendar');
      return;
    }

    let newStart: Date;
    let newEnd: Date;

    if (isAllDay) {
      newStart = new Date(startDate);
      newStart.setHours(0, 0, 0, 0);
      newEnd = new Date(endDate);
      newEnd.setHours(23, 59, 59, 999);
    } else {
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

    setIsCreating(true);
    try {
      const eventData = {
        title: title.trim(),
        startTime: newStart,
        endTime: newEnd,
        isAllDay,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        calendarId: selectedCalendarId,
      };
      
      await onEventCreate(eventData);
      
      // Link selected people to the event after creation
      // We need to get the event ID from the response or fetch it
      // For now, we'll link them after a short delay to allow the event to be created
      if (selectedPeopleIds.length > 0) {
        // Wait a bit for the event to be created, then link people
        setTimeout(async () => {
          // Fetch the most recent event with this title to get its ID
          try {
            const timeMin = newStart.toISOString();
            const timeMax = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000).toISOString();
            const response = await fetch(`/api/google-calendar/events?timeMin=${timeMin}&timeMax=${timeMax}`);
            if (response.ok) {
              const data = await response.json();
              const events = data.events || [];
              // Find the event we just created (same title and time)
              const createdEvent = events.find((e: any) => 
                e.title === title.trim() &&
                Math.abs(new Date(e.start).getTime() - newStart.getTime()) < 60000 // Within 1 minute
              );
              
              if (createdEvent) {
                // Optimistically update - get person objects
                const linkedPeople = selectedPeopleIds
                  .map(id => people.find(p => p.id === id))
                  .filter((p): p is Person => p !== undefined);
                
                // Optimistically update parent component
                onPeopleChange?.(createdEvent.id, linkedPeople);
                
                // Link all selected people
                await Promise.all(
                  selectedPeopleIds.map(async (personId) => {
                    try {
                      const response = await fetch(`/api/events/${encodeURIComponent(createdEvent.id)}/people`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ personId }),
                      });
                      if (!response.ok) {
                        // Revert optimistic update on error
                        const currentPeople = linkedPeople.filter(p => p.id !== personId);
                        onPeopleChange?.(createdEvent.id, currentPeople);
                      }
                    } catch (error) {
                      console.error('Error linking person:', error);
                      // Revert optimistic update on error
                      const currentPeople = linkedPeople.filter(p => p.id !== personId);
                      onPeopleChange?.(createdEvent.id, currentPeople);
                    }
                  })
                );
              }
            }
          } catch (error) {
            console.error('Error linking people to new event:', error);
          }
        }, 1000);
      }
      
      // Reset form
      setTitle('');
      setDescription('');
      setLocation('');
      setIsAllDay(false);
      setSelectedPeopleIds([]);
      setShowPeopleSelector(false);
      setPersonSearchQuery('');
      onClose();
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setIsAllDay(false);
    setSelectedPeopleIds([]);
    setShowPeopleSelector(false);
    setPersonSearchQuery('');
    setPeopleWithRecentDates(new Map());
    onClose();
  };

  // Get selected calendar color for border
  const selectedCalendar = availableCalendars.find(cal => cal.id === selectedCalendarId);
  const borderColor = selectedCalendar?.color || '#4285f4';

  // Helper to mix colors - blend default background with Spotify color for solid background
  const getMixedBackground = React.useCallback(() => {
    if (!colorPalette || typeof window === 'undefined') return undefined;
    
    // Get computed background color (resolved from CSS variables)
    const root = document.documentElement;
    const computedBg = getComputedStyle(root).getPropertyValue('background-color');
    
    // Extract RGB from computed background
    const bgMatch = computedBg.match(/\d+/g);
    if (!bgMatch || bgMatch.length < 3) return undefined;
    
    const [bgR, bgG, bgB] = bgMatch.map(Number);
    
    // Extract RGB from Spotify color
    const spotifyMatch = colorPalette.primary.match(/\d+/g);
    if (!spotifyMatch || spotifyMatch.length < 3) return undefined;
    
    const [spotifyR, spotifyG, spotifyB] = spotifyMatch.map(Number);
    
    // Mix colors: 75% default background, 25% Spotify color
    const mixRatio = 0.25; // 25% Spotify, 75% default
    const mixedR = Math.round(bgR * (1 - mixRatio) + spotifyR * mixRatio);
    const mixedG = Math.round(bgG * (1 - mixRatio) + spotifyG * mixRatio);
    const mixedB = Math.round(bgB * (1 - mixRatio) + spotifyB * mixRatio);
    
    // Return solid RGB color
    return `rgb(${mixedR}, ${mixedG}, ${mixedB})`;
  }, [colorPalette]);

  // Apply color palette to dialog if available (solid background with color mixing)
  const dialogStyle = colorPalette
    ? {
        background: getMixedBackground(),
      }
    : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent 
        className={cn(
          "max-w-2xl max-h-[90vh] overflow-y-auto p-0 shadow-2xl transition-all duration-1000 border-0",
          !colorPalette && "bg-background"
        )}
        style={dialogStyle}
      >
        {/* Notion-style header with calendar color accent */}
        <div 
          className="h-1 w-full transition-colors"
          style={{ backgroundColor: borderColor }}
        />
        
        <div className="p-8">
          <DialogHeader className="mb-6">
            {/* Hidden DialogTitle for accessibility */}
            <DialogTitle className="sr-only">New Event</DialogTitle>
            {/* Editable title - H1 style */}
            <div className="mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  ref={titleRef}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const text = e.currentTarget.textContent || '';
                    setTitle(text);
                    // Clear if empty to show placeholder
                    if (!text.trim() && e.currentTarget.textContent) {
                      e.currentTarget.textContent = '';
                    }
                    updatePreview();
                  }}
                  onInput={(e) => {
                    const text = e.currentTarget.textContent || '';
                    setTitle(text);
                    updatePreview();
                  }}
                  className="text-3xl font-semibold outline-none focus:outline-none focus:ring-0 min-h-[2.5rem] flex-1 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
                  data-placeholder="Add title..."
                />
              </div>
              {/* Show title with avatars below editable input */}
              {title && matchedPeople.length > 0 && (
                <div className="mt-2 text-3xl font-semibold">
                  {renderTitleWithAvatars({
                    title,
                    people: matchedPeople,
                    onAvatarClick: onPersonClick,
                  })}
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-6">

            {/* Date & Time */}
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-muted-foreground">
                    Date & Time
                  </div>
                </div>

                {/* Google Calendar style date/time picker - all on one row */}
                <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden">
                  {/* Start Date */}
                  <div className="relative flex-shrink-0">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        updatePreview();
                      }}
                      className="h-7 px-1.5 py-0.5 bg-background border rounded text-[11px] font-medium cursor-pointer hover:bg-accent transition-colors"
                      style={{ width: '95px', fontSize: '11px' }}
                    />
                    <div className="absolute -top-1.5 left-1 px-0.5 bg-background text-[8px] text-muted-foreground whitespace-nowrap">
                      Start date
                    </div>
                  </div>

                  {!isAllDay && (
                    <>
                      {/* Start Time */}
                      <div className="relative flex-shrink-0">
                        <TimePicker
                          value={startTime}
                          onChange={(value) => {
                            setStartTime(value);
                            updatePreview();
                          }}
                          timeFormat={timeFormat}
                          className="h-7"
                        />
                        <div className="absolute -top-1.5 left-1 px-0.5 bg-background text-[8px] text-muted-foreground whitespace-nowrap">
                          Start time
                        </div>
                      </div>
                    </>
                  )}

                  {/* "to" separator */}
                  <span className="text-[11px] text-muted-foreground px-0.5 flex-shrink-0">to</span>

                  {/* End Date */}
                  <div className="relative flex-shrink-0">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        updatePreview();
                      }}
                      className="h-7 px-1.5 py-0.5 bg-background border rounded text-[11px] font-medium cursor-pointer hover:bg-accent transition-colors"
                      style={{ width: '95px', fontSize: '11px' }}
                    />
                    <div className="absolute -top-1.5 left-1 px-0.5 bg-background text-[8px] text-muted-foreground whitespace-nowrap">
                      End date
                    </div>
                  </div>

                  {!isAllDay && (
                    <>
                      {/* End Time */}
                      <div className="relative flex-shrink-0">
                        <TimePicker
                          value={endTime}
                          onChange={(value) => {
                            setEndTime(value);
                            updatePreview();
                          }}
                          timeFormat={timeFormat}
                          className="h-7"
                        />
                        <div className="absolute -top-1.5 left-1 px-0.5 bg-background text-[8px] text-muted-foreground whitespace-nowrap">
                          End time
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* All-day checkbox - below date/time */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="all-day-toggle"
                    checked={isAllDay}
                    onCheckedChange={handleAllDayToggle}
                  />
                  <Label htmlFor="all-day-toggle" className="text-sm font-medium cursor-pointer">
                    All day
                  </Label>
                </div>
              </div>
            </div>

            {/* Calendar Selection */}
            {availableCalendars.length > 0 && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <Label htmlFor="calendar-select" className="text-sm font-medium text-muted-foreground mb-1 block">
                    Calendar
                  </Label>
                  <Select 
                    value={selectedCalendarId} 
                    onValueChange={(value) => {
                      if (value !== selectedCalendarId) {
                        setSelectedCalendarId(value);
                        // Use requestAnimationFrame to prevent infinite loop
                        requestAnimationFrame(() => {
                          updatePreview();
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full h-10">
                      <SelectValue placeholder="Select a calendar" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCalendars.map((cal) => {
                        const calendarColor = cal.color || '#4285f4';
                        return (
                          <SelectItem key={cal.id} value={cal.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded border-2 border-background flex-shrink-0"
                                style={{
                                  backgroundColor: calendarColor,
                                }}
                              />
                              <span>{cal.summary}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Location */}
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <Label htmlFor="event-location" className="text-sm font-medium text-muted-foreground mb-1 block">
                  Location
                </Label>
                <LocationAutocomplete
                  id="event-location"
                  value={location}
                  onChange={setLocation}
                  placeholder="Add location"
                />
              </div>
            </div>

            {/* People */}
            {people.length > 0 && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium text-muted-foreground">
                      People
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPeopleSelector(!showPeopleSelector)}
                      className="h-7 px-2"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  
                  {/* Selected people */}
                  {selectedPeopleIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedPeopleIds.map((personId) => {
                        const person = people.find(p => p.id === personId);
                        if (!person) return null;
                        return (
                          <div
                            key={personId}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors group"
                          >
                            <PersonAvatar
                              person={person}
                              size="sm"
                              onClick={() => onPersonClick?.(person)}
                            />
                            <span className="text-sm">{person.name}</span>
                            <button
                              onClick={() => setSelectedPeopleIds(prev => prev.filter(id => id !== personId))}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/20 rounded"
                              title="Remove person"
                            >
                              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* People selector dropdown */}
                  {showPeopleSelector && (
                    <div className="border rounded-md bg-background shadow-lg">
                      {/* Search bar */}
                      <div className="p-2 border-b">
                        <Input
                          placeholder="Search people..."
                          value={personSearchQuery}
                          onChange={(e) => setPersonSearchQuery(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                      </div>
                      {/* People list */}
                      <div className="max-h-48 overflow-y-auto">
                        {availablePeopleForSelection.length > 0 ? (
                          availablePeopleForSelection
                            .filter(p => !selectedPeopleIds.includes(p.id))
                            .map((person) => (
                              <button
                                key={person.id}
                                onClick={() => setSelectedPeopleIds(prev => [...prev, person.id])}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors text-left"
                              >
                                <PersonAvatar person={person} size="sm" onClick={undefined} />
                                <span className="text-sm">{person.name}</span>
                                {peopleWithRecentDates.has(person.id) && (
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {format(new Date(peopleWithRecentDates.get(person.id)!), 'MMM d, yyyy')}
                                  </span>
                                )}
                              </button>
                            ))
                        ) : (
                          <div className="p-4 text-sm text-muted-foreground text-center">
                            {personSearchQuery.trim() ? 'No people found' : 'No people available'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <div className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <Label htmlFor="event-description" className="text-sm font-medium text-muted-foreground mb-2 block">
                  Description
                </Label>
                <Textarea
                  id="event-description"
                  placeholder="Add description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating || !title.trim()}
                className="flex-1"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Event
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

