'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
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
import { ScheduleCalendarView } from '@/components/calendar-views/ScheduleCalendarView';
import { AnimatedCalendarView } from '@/components/calendar/AnimatedCalendarView';
import { motion } from 'framer-motion';

// Calendar event interface
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  calendar?: string;
  isAllDay?: boolean;
}

export type CalendarViewMode = 'daily' | 'weekly' | 'monthly' | 'year' | 'schedule';

interface HQCalendarProps {
  events?: CalendarEvent[];
  navigateToDate?: Date;
}

export function HQCalendar({ events: initialEvents = [], navigateToDate }: HQCalendarProps) {
  const [events, setEvents] = React.useState<CalendarEvent[]>(initialEvents);
  const [loadingEvents, setLoadingEvents] = React.useState(false);

  // Load view mode from localStorage
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hq-calendar-view-mode');
      // Migrate old "annual" to "year"
      if (saved === 'annual') {
        localStorage.setItem('hq-calendar-view-mode', 'year');
        return 'year';
      }
      return saved === 'daily' ||
        saved === 'weekly' ||
        saved === 'monthly' ||
        saved === 'year' ||
        saved === 'schedule'
        ? saved
        : 'weekly';
    }
    return 'weekly';
  });

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
  const [timeFormat, setTimeFormat] = React.useState<TimeFormat>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hq-calendar-time-format');
      return saved === '12h' || saved === '24h' ? saved : '12h';
    }
    return '12h';
  });

  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Save time format to localStorage when it changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hq-calendar-time-format', timeFormat);
    }
  }, [timeFormat]);

  // Track if we should stop retrying (for auth errors)
  const [shouldStopRetrying, setShouldStopRetrying] = React.useState(false);
  const fetchingRef = React.useRef(false);

  // Listen for calendar refresh events
  React.useEffect(() => {
    const handleRefresh = () => {
      // Force refresh by clearing the stop retrying flag and triggering a refetch
      setShouldStopRetrying(false);
      fetchingRef.current = false;
      // Trigger refetch by updating a dependency
      setCurrentDate(new Date(currentDate));
    };

    window.addEventListener('calendar-refresh', handleRefresh);
    return () => {
      window.removeEventListener('calendar-refresh', handleRefresh);
    };
  }, [currentDate]);

  // Fetch events from Google Calendar based on current view and date
  React.useEffect(() => {
    // Don't fetch if we're already fetching or should stop retrying
    if (fetchingRef.current || shouldStopRetrying) {
      return;
    }

    const fetchEvents = async () => {
      // Prevent concurrent requests
      if (fetchingRef.current) {
        return;
      }

      try {
        fetchingRef.current = true;
        setLoadingEvents(true);

        // Calculate time range based on view mode
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

        const response = await fetch(
          `/api/google-calendar/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}`
        );

        const data = await response.json();
        console.log('Events API response:', {
          status: response.status,
          ok: response.ok,
          eventsCount: data.events?.length || 0,
          fromCache: data.fromCache,
          error: data.error,
          timeRange: { min: timeMin.toISOString(), max: timeMax.toISOString() },
        });

        if (response.ok) {
          // Convert event data to CalendarEvent format
          const fetchedEvents: CalendarEvent[] = (data.events || []).map((event: any) => {
            // Handle both Date objects and ISO strings
            const startDate = event.start instanceof Date ? event.start : new Date(event.start);
            const endDate = event.end instanceof Date ? event.end : new Date(event.end);

            // Convert hex color to Tailwind class or use inline style
            const hexColor = event.color || '#4285f4';

            return {
              id: event.id,
              title: event.title,
              start: startDate,
              end: endDate,
              color: hexColor, // Store hex color, will be used with inline styles
              calendar: event.calendar,
            };
          });

          console.log('Formatted events:', fetchedEvents.length, fetchedEvents.slice(0, 3));
          setEvents(fetchedEvents);
          // Reset stop retrying flag on success
          setShouldStopRetrying(false);
        } else {
          // Handle auth errors - stop retrying
          if (response.status === 401 || response.status === 404) {
            setShouldStopRetrying(true);
            console.warn('Authentication error or user not found, stopping retries');
          }
          console.error('Events API error:', data.error || 'Unknown error');
          // If not connected or error, use initial events or empty array
          setEvents(initialEvents);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        setEvents(initialEvents);
        // Don't stop retrying on network errors, only on auth errors
      } finally {
        fetchingRef.current = false;
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, [viewMode, currentDate]); // Removed initialEvents from dependencies

  // Keyboard shortcuts for view mode switching
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      setCurrentDate(date);
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

  const getDateRange = () => {
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
      const endDate = new Date(currentDate);
      endDate.setDate(currentDate.getDate() + 30);
      return `Next 30 days`;
    }
    return '';
  };

  const handleNavigate = (date: Date) => {
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

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle>HQ Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={viewMode}
              onValueChange={(value) => setViewMode(value as CalendarViewMode)}
            >
              <SelectTrigger className="w-[120px]">
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
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={goToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm font-medium text-muted-foreground min-w-[200px] text-right">
              {getDateRange()}
            </div>
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
      <CardContent className="p-0 overflow-hidden relative">
        {/* Loading overlay */}
        {loadingEvents && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
            />
          </motion.div>
        )}

        <AnimatedCalendarView viewKey={viewMode} className="h-full">
          {viewMode === 'daily' && (
            <DailyCalendarView
              currentDate={currentDate}
              events={events}
              timeFormat={timeFormat}
              onNavigate={handleNavigate}
            />
          )}
          {viewMode === 'weekly' && (
            <WeeklyCalendarView
              currentWeek={currentDate}
              events={events}
              timeFormat={timeFormat}
              onNavigate={handleNavigate}
            />
          )}
          {viewMode === 'monthly' && (
            <MonthlyCalendarView
              currentMonth={currentDate}
              events={events}
              onNavigate={handleNavigate}
            />
          )}
          {viewMode === 'year' && (
            <AnnualCalendarView
              currentYear={currentDate}
              events={events}
              onNavigate={handleNavigate}
            />
          )}
          {viewMode === 'schedule' && (
            <ScheduleCalendarView
              currentDate={currentDate}
              events={events}
              timeFormat={timeFormat}
              onNavigate={handleNavigate}
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
    </Card>
  );
}
