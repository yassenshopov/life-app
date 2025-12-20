'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CalendarEvent } from '@/components/HQCalendar';
import { formatEventTime, isAllDayEvent } from '@/lib/calendar-utils';
import { TimeFormat } from '@/components/CalendarSettingsDialog';
import { Calendar, Clock, MapPin, User, Link as LinkIcon, Bell, Users, Repeat, Video, Eye, EyeOff, CheckCircle, XCircle, AlertCircle, Edit2, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatTimeForInput } from '@/lib/time-format-utils';
import { TimePicker } from '@/components/ui/time-picker';

interface EventDetailModalProps {
  event: CalendarEvent | null;
  isOpen: boolean;
  onClose: () => void;
  timeFormat: TimeFormat;
  onEventUpdate?: (eventId: string, calendarId: string, startTime: Date, endTime: Date, isAllDay?: boolean) => Promise<void>;
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
}: EventDetailModalProps) {
  if (!event) return null;

  const [isEditing, setIsEditing] = React.useState(false);
  const [editedStart, setEditedStart] = React.useState<Date>(new Date(event.start));
  const [editedEnd, setEditedEnd] = React.useState<Date>(new Date(event.end));
  const [isSaving, setIsSaving] = React.useState(false);
  const [isAllDayEdit, setIsAllDayEdit] = React.useState(event.isAllDay || false);
  const [startDate, setStartDate] = React.useState<string>('');
  const [startTime, setStartTime] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');
  const [endTime, setEndTime] = React.useState<string>('');

  // Initialize date/time inputs when event changes or editing starts
  React.useEffect(() => {
    if (event) {
      const start = new Date(event.start);
      const end = new Date(event.end);
      setEditedStart(start);
      setEditedEnd(end);
      setIsAllDayEdit(event.isAllDay || false);
      
      // Format for date input (YYYY-MM-DD)
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
      
      setStartTime(formatTimeForInput(start));
      setEndTime(formatTimeForInput(end));
    }
  }, [event, isEditing]);

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
    if (!onEventUpdate || !event) return;
    
    const calendarId = event.calendarId || event.calendar;
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
        await onEventUpdate(event.id, calendarId, newStart, newEnd, isAllDayEdit);
      } else {
        // Fallback to direct API call if onEventUpdate is not provided
        const response = await fetch(`/api/google-calendar/events/${event.id}`, {
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
    if (event) {
      setEditedStart(new Date(event.start));
      setEditedEnd(new Date(event.end));
      setIsAllDayEdit(event.isAllDay || false);
      const start = new Date(event.start);
      const end = new Date(event.end);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
      setStartTime(formatTimeForInput(start));
      setEndTime(formatTimeForInput(end));
    }
    setIsEditing(false);
  };

  // Format date for display (like "20 Dec 2025")
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'd MMM yyyy');
  };

  // Debug logging
  React.useEffect(() => {
    if (event) {
      console.log('EventDetailModal - Event data:', {
        id: event.id,
        title: event.title,
        hasLocation: !!event.location,
        location: event.location,
        locationType: typeof event.location,
        locationValue: event.location,
        hasDescription: !!event.description,
        description: event.description,
        hasOrganizer: !!event.organizer,
        organizer: event.organizer,
        hasAttendees: !!event.attendees,
        attendeesCount: event.attendees?.length,
        hasReminders: !!event.reminders,
        hasHtmlLink: !!event.htmlLink,
        fullEvent: event,
      });
    }
  }, [event]);

  const isAllDay = isAllDayEvent(event);
  const eventStartDate = new Date(event.start);
  const eventEndDate = new Date(event.end);

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
        <div
          className="h-1 w-full"
          style={{ backgroundColor: event.color || '#4285f4' }}
        />
        
        <div className="p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-semibold mb-2">
              {event.title}
            </DialogTitle>
          </DialogHeader>

          {/* Event details - Notion style */}
          <div className="space-y-6">
            {/* Date & Time */}
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Date & Time
                  </div>
                  {!isAllDay && onEventUpdate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                      className="h-7 px-2"
                    >
                      {isEditing ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Edit2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-4">
                    {/* All-day toggle */}
                    <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="all-day-toggle" className="text-sm font-medium cursor-pointer">
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
                              onChange={setStartTime}
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
                              onChange={setEndTime}
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
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1"
                      >
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
            {event.calendar && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Calendar
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: event.color || '#4285f4' }}
                    />
                    <span className="text-base">{event.calendar}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Location */}
            {event.location && String(event.location).trim() !== '' && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Location
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 group"
                  >
                    <span>{event.location}</span>
                    <svg
                      className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
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
                </div>
              </div>
            )}

            {/* Description */}
            {event.description && event.description.trim() && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <div className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Description
                  </div>
                  <div
                    className="text-base leading-relaxed [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2
                      [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2
                      [&_li]:my-1 [&_li]:leading-relaxed
                      [&_strong]:font-semibold [&_b]:font-semibold
                      [&_em]:italic [&_i]:italic
                      [&_p]:my-2 [&_p]:leading-relaxed
                      [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                      [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2
                      [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-2
                      [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:underline [&_a]:hover:text-blue-800 [&_a]:dark:hover:text-blue-300
                      [&_code]:text-sm [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono
                      [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:my-2
                      [&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-2
                      [&_hr]:my-4 [&_hr]:border-t [&_hr]:border-border"
                    dangerouslySetInnerHTML={{ __html: event.description }}
                  />
                </div>
              </div>
            )}

            {/* Organizer */}
            {event.organizer && (event.organizer.email || event.organizer.displayName) && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Organizer
                  </div>
                  <div className="text-base">
                    {event.organizer.displayName || event.organizer.email}
                    {event.organizer.email && event.organizer.displayName && (
                      <span className="text-sm text-muted-foreground ml-2">
                        ({event.organizer.email})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Attendees */}
            {event.attendees && event.attendees.length > 0 && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-2">
                    Attendees ({event.attendees.length})
                  </div>
                  <div className="space-y-1">
                    {event.attendees.map((attendee, idx) => (
                      <div key={idx} className="text-base flex items-center gap-2">
                        <span>{attendee.displayName || attendee.email}</span>
                        {attendee.organizer && (
                          <span className="text-xs text-muted-foreground">(Organizer)</span>
                        )}
                        {attendee.responseStatus && (
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded',
                            attendee.responseStatus === 'accepted' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                            attendee.responseStatus === 'declined' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                            attendee.responseStatus === 'tentative' && 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                            attendee.responseStatus === 'needsAction' && 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                          )}>
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

            {/* Reminders */}
            {event.reminders && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Reminders
                  </div>
                  {event.reminders.useDefault ? (
                    <div className="text-base">Using default reminders</div>
                  ) : event.reminders.overrides && event.reminders.overrides.length > 0 ? (
                    <div className="space-y-1">
                      {event.reminders.overrides.map((reminder: any, idx: number) => (
                        <div key={idx} className="text-base">
                          {reminder.method === 'email' && '📧 '}
                          {reminder.method === 'popup' && '🔔 '}
                          {reminder.minutes !== undefined && (
                            reminder.minutes === 0 ? 'At time of event' :
                            reminder.minutes < 60 ? `${reminder.minutes} minutes before` :
                            reminder.minutes < 1440 ? `${Math.floor(reminder.minutes / 60)} hours before` :
                            `${Math.floor(reminder.minutes / 1440)} days before`
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-base text-muted-foreground">No reminders</div>
                  )}
                </div>
              </div>
            )}

            {/* Recurrence */}
            {event.recurrence && event.recurrence.length > 0 && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <Repeat className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Recurrence
                  </div>
                  <div className="text-base">
                    Recurring event
                    {event.recurrence[0] && (
                      <div className="text-sm text-muted-foreground mt-1 font-mono">
                        {event.recurrence[0]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Video Conference */}
            {(event.hangoutLink || (event.conferenceData?.entryPoints && event.conferenceData.entryPoints.length > 0)) && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <Video className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Video Conference
                  </div>
                  {event.hangoutLink && (
                    <a
                      href={event.hangoutLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base text-blue-600 dark:text-blue-400 hover:underline block"
                    >
                      Join Google Meet
                    </a>
                  )}
                  {event.conferenceData?.entryPoints?.map((entry: any, idx: number) => (
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
            {event.status && event.status !== 'confirmed' && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {event.status === 'cancelled' ? (
                    <XCircle className="h-5 w-5 text-red-500" />
                  ) : event.status === 'tentative' ? (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Status
                  </div>
                  <div className="text-base capitalize">{event.status}</div>
                </div>
              </div>
            )}

            {/* Visibility */}
            {event.visibility && event.visibility !== 'default' && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {event.visibility === 'private' ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Visibility
                  </div>
                  <div className="text-base capitalize">{event.visibility}</div>
                </div>
              </div>
            )}

            {/* Transparency */}
            {event.transparency && event.transparency !== 'opaque' && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <div className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Transparency
                  </div>
                  <div className="text-base capitalize">
                    {event.transparency === 'transparent' ? 'Shows as available' : event.transparency}
                  </div>
                </div>
              </div>
            )}

            {/* Created/Updated timestamps */}
            {(event.created || event.updated) && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <div className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    Metadata
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {event.created && (
                      <div>Created: {format(event.created, 'PPpp')}</div>
                    )}
                    {event.updated && (
                      <div>Updated: {format(event.updated, 'PPpp')}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Link to Google Calendar */}
            {event.htmlLink && (
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <LinkIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    View in Google Calendar
                  </div>
                  <a
                    href={event.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open event
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

