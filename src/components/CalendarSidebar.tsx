'use client';

import * as React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MiniCalendar } from '@/components/MiniCalendar';
import { RefreshCw } from 'lucide-react';

interface CalendarItem {
  id: string;
  summary: string;
  color?: string;
  selected?: boolean;
}

interface CalendarItemProps {
  calendar: CalendarItem;
  onToggle: (calendarId: string, checked: boolean) => void;
  onRefresh: (calendarId: string) => Promise<void>;
}

interface CalendarSidebarProps {
  currentDate?: Date;
  onDateSelect?: (date: Date) => void;
}

function CalendarItemComponent({ calendar, onToggle, onRefresh }: CalendarItemProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    try {
      await onRefresh(calendar.id);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex items-center space-x-2 group">
      <Checkbox
        id={calendar.id}
        checked={calendar.selected !== false}
        onCheckedChange={(checked) => onToggle(calendar.id, checked as boolean)}
      />
      <label
        htmlFor={calendar.id}
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
      >
        <div className="flex items-center space-x-2">
          <div
            className={cn(
              'w-3 h-3 rounded-full',
              calendar.color ? `bg-[${calendar.color}]` : 'bg-blue-500'
            )}
            style={calendar.color ? { backgroundColor: calendar.color } : undefined}
          />
          <span className="truncate">{calendar.summary}</span>
        </div>
      </label>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleRefresh}
        disabled={isRefreshing}
        title="Refresh events"
      >
        <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
      </Button>
    </div>
  );
}

export function CalendarSidebar({ currentDate, onDateSelect }: CalendarSidebarProps) {
  const [calendars, setCalendars] = React.useState<CalendarItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    currentDate || new Date()
  );

  React.useEffect(() => {
    fetchCalendars();
    // Check for OAuth callback success/error
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const connected = params.get('connected');
    
    if (connected === 'true') {
      // Refresh calendars after successful connection
      fetchCalendars();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      // Show error message
      console.error('OAuth error:', error);
      const params = new URLSearchParams(window.location.search);
      const details = params.get('details');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      // You could add a toast notification here
      const errorMessage = details 
        ? `Connection failed: ${error}\nDetails: ${details}\n\nPlease check the setup guide or ensure your Supabase users table has the google_calendar_credentials column.`
        : `Connection failed: ${error}. Please check the setup guide.`;
      alert(errorMessage);
    }
  }, []);

  const fetchCalendars = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/google-calendar/calendars');
      const data = await response.json();
      
      console.log('Calendar API response:', { status: response.status, data });
      
      if (response.ok) {
        if (data.calendars && Array.isArray(data.calendars) && data.calendars.length > 0) {
          setCalendars(data.calendars);
          setError(null);
        } else if (data.error) {
          // API returned an error message (e.g., "Google Calendar not connected")
          console.log('Calendar API error:', data.error, data.message);
          setCalendars([]);
          // Don't show error for "not connected" - that's expected before connection
          if (data.error !== 'Google Calendar not connected') {
            setError(data.message || data.error);
          }
        } else {
          // Empty calendars array
          console.log('No calendars found');
          setCalendars([]);
        }
      } else {
        // HTTP error status
        console.error('Failed to fetch calendars:', response.status, data);
        setCalendars([]);
        setError(data.error || `Failed to load calendars (${response.status})`);
      }
    } catch (error) {
      console.error('Error fetching calendars:', error);
      setCalendars([]);
      setError('Failed to connect to calendar service');
    } finally {
      setLoading(false);
    }
  };

  const handleCalendarToggle = async (calendarId: string, checked: boolean) => {
    // Update local state optimistically
    setCalendars((prev) =>
      prev.map((cal) => (cal.id === calendarId ? { ...cal, selected: checked } : cal))
    );

    // TODO: Save preference to backend/localStorage
    try {
      await fetch('/api/google-calendar/calendars/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId, selected: checked }),
      });
    } catch (error) {
      console.error('Error saving calendar preference:', error);
      // Revert on error
      setCalendars((prev) =>
        prev.map((cal) => (cal.id === calendarId ? { ...cal, selected: !checked } : cal))
      );
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      onDateSelect?.(date);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch('/api/google-calendar/auth');
      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      } else {
        console.error('Failed to get OAuth URL');
      }
    } catch (error) {
      console.error('Error initiating OAuth:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCalendarRefresh = async (calendarId: string) => {
    try {
      const response = await fetch(`/api/google-calendar/events/refresh?calendarId=${calendarId}`, {
        method: 'POST',
      });
      if (response.ok) {
        // Trigger a refresh of the calendar view
        window.dispatchEvent(new CustomEvent('calendar-refresh'));
      } else {
        console.error('Failed to refresh calendar events');
      }
    } catch (error) {
      console.error('Error refreshing calendar:', error);
    }
  };

  return (
    <div className="w-64 border-r bg-background p-4 space-y-4 overflow-y-auto">
      {/* Monthly Calendar Preview */}
      <MiniCalendar selectedDate={selectedDate} onDateSelect={handleDateSelect} />

      {/* My Calendars */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium px-1">My Calendars</h3>
        {loading ? (
          <div className="text-sm text-muted-foreground px-1">Loading calendars...</div>
        ) : error ? (
          <div className="space-y-2 px-1">
            <div className="text-sm text-destructive">{error}</div>
            <Button
              onClick={handleConnectGoogle}
              disabled={isConnecting}
              className="w-full"
              size="sm"
            >
              {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
            </Button>
          </div>
        ) : calendars.length === 0 ? (
          <div className="space-y-2 px-1">
            <div className="text-sm text-muted-foreground">
              No calendars found. Connect your Google Calendar to get started.
            </div>
            <Button
              onClick={handleConnectGoogle}
              disabled={isConnecting}
              className="w-full"
              size="sm"
            >
              {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
            </Button>
          </div>
          ) : (
            calendars.map((calendar) => (
              <CalendarItemComponent
                key={calendar.id}
                calendar={calendar}
                onToggle={handleCalendarToggle}
                onRefresh={handleCalendarRefresh}
              />
            ))
          )}
      </div>
    </div>
  );
}

