'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import { Calendar, Clock, MapPin, Save, X } from 'lucide-react';
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
    }
  }, [isOpen, initialStartTime, initialDate, availableCalendars, selectedCalendarId]);

  const handleAllDayToggle = (checked: boolean) => {
    setIsAllDay(checked);
    if (checked) {
      setStartTime('00:00');
      setEndTime('23:59');
    }
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
      await onEventCreate({
        title: title.trim(),
        startTime: newStart,
        endTime: newEnd,
        isAllDay,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        calendarId: selectedCalendarId,
      });
      // Reset form
      setTitle('');
      setDescription('');
      setLocation('');
      setIsAllDay(false);
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
    onClose();
  };

  // Get selected calendar color for border
  const selectedCalendar = availableCalendars.find(cal => cal.id === selectedCalendarId);
  const borderColor = selectedCalendar?.color || '#4285f4';

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-0 shadow-2xl">
        {/* Notion-style header with calendar color accent */}
        <div 
          className="h-1 w-full transition-colors"
          style={{ backgroundColor: borderColor }}
        />
        
        <div className="p-8">
          <DialogHeader className="mb-6">
            {/* Editable title - H1 style */}
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
              }}
              onInput={(e) => {
                const text = e.currentTarget.textContent || '';
                setTitle(text);
              }}
              className="text-3xl font-semibold mb-2 outline-none focus:outline-none focus:ring-0 min-h-[2.5rem] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
              data-placeholder="Add title..."
            />
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
                      onChange={(e) => setStartDate(e.target.value)}
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
                        <Input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="h-7 px-1.5 py-0.5 bg-background border rounded text-[11px] font-medium cursor-pointer hover:bg-accent transition-colors"
                          style={{ width: '70px', fontSize: '11px' }}
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
                      onChange={(e) => setEndDate(e.target.value)}
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
                        <Input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="h-7 px-1.5 py-0.5 bg-background border rounded text-[11px] font-medium cursor-pointer hover:bg-accent transition-colors"
                          style={{ width: '70px', fontSize: '11px' }}
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
                  <Select value={selectedCalendarId} onValueChange={setSelectedCalendarId}>
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

