'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { LogOut, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { getContrastTextColor } from '@/lib/color-utils';

export type TimeFormat = '12h' | '24h';

interface CalendarItem {
  id: string;
  summary: string;
  color?: string;
  selected?: boolean;
}

interface CalendarSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeFormat: TimeFormat;
  onTimeFormatChange: (format: TimeFormat) => void;
}

function CalendarItemRow({
  calendar,
  onToggle,
}: {
  calendar: CalendarItem;
  onToggle: (calendarId: string, checked: boolean) => void;
}) {
  const calendarColor = calendar.color || '#4285f4';
  const isChecked = calendar.selected !== false;
  const checkmarkColor = getContrastTextColor(calendarColor) === 'dark' ? '#1f2937' : '#ffffff';

  return (
    <div className="flex items-center space-x-2">
      <div className="relative flex items-center">
        <Checkbox
          id={calendar.id}
          checked={isChecked}
          onCheckedChange={(checked) => onToggle(calendar.id, checked as boolean)}
          className={cn(
            'data-[state=checked]:border-2 data-[state=checked]:text-transparent',
            !isChecked && 'border-2'
          )}
          style={{
            borderColor: calendarColor,
            ...(isChecked && { backgroundColor: calendarColor }),
          }}
        />
        {isChecked && (
          <div
            className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none"
            style={{ color: checkmarkColor }}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <label
        htmlFor={calendar.id}
        className="text-sm font-medium leading-none cursor-pointer flex-1 flex items-center"
      >
        <span className="truncate">{calendar.summary}</span>
      </label>
    </div>
  );
}

export function CalendarSettingsDialog({
  open,
  onOpenChange,
  timeFormat,
  onTimeFormatChange,
}: CalendarSettingsDialogProps) {
  const [isConnected, setIsConnected] = React.useState<boolean | null>(null);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [calendars, setCalendars] = React.useState<CalendarItem[]>([]);
  const [calendarsLoading, setCalendarsLoading] = React.useState(true);
  const [calendarsError, setCalendarsError] = React.useState<string | null>(null);
  const [isRefreshingAll, setIsRefreshingAll] = React.useState(false);

  // When dialog opens: handle OAuth callback params, then fetch connection + calendars once
  React.useEffect(() => {
    if (!open) return;

    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const connected = params.get('connected');

    if (error) {
      const details = params.get('details');
      window.history.replaceState({}, '', window.location.pathname);
      const errorMessage = details
        ? `Connection failed: ${error}\nDetails: ${details}`
        : `Connection failed: ${error}. Please check the setup guide.`;
      alert(errorMessage);
    } else if (connected === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
    }

    const load = async () => {
      try {
        setCalendarsLoading(true);
        setCalendarsError(null);
        const response = await fetch('/api/google-calendar/calendars');
        const data = await response.json();
        const hasCalendars = data.calendars && Array.isArray(data.calendars) && data.calendars.length > 0;
        setIsConnected(hasCalendars);
        if (hasCalendars) {
          setCalendars(data.calendars);
        } else if (data.error && data.error !== 'Google Calendar not connected') {
          setCalendarsError(data.message || data.error);
          setCalendars([]);
        } else {
          setCalendars([]);
        }
      } catch (err) {
        console.error('Error loading calendars:', err);
        setIsConnected(false);
        setCalendars([]);
        setCalendarsError('Failed to connect to calendar service');
      } finally {
        setCalendarsLoading(false);
      }
    };

    load();
  }, [open]);

  const handleCalendarToggle = async (calendarId: string, checked: boolean) => {
    setCalendars((prev) =>
      prev.map((cal) => (cal.id === calendarId ? { ...cal, selected: checked } : cal))
    );
    try {
      const response = await fetch('/api/google-calendar/calendars/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId, selected: checked }),
      });
      if (response.ok) {
        window.dispatchEvent(new CustomEvent('calendar-refresh'));
      } else {
        throw new Error('Failed to save preference');
      }
    } catch (error) {
      console.error('Error saving calendar preference:', error);
      setCalendars((prev) =>
        prev.map((cal) => (cal.id === calendarId ? { ...cal, selected: !checked } : cal))
      );
    }
  };

  const handleRefreshAll = async () => {
    if (calendars.length === 0) return;
    setIsRefreshingAll(true);
    try {
      await Promise.all(
        calendars.map((calendar) =>
          fetch(`/api/google-calendar/events/refresh?calendarId=${calendar.id}`, { method: 'POST' })
        )
      );
      window.dispatchEvent(new CustomEvent('calendar-refresh'));
    } catch (error) {
      console.error('Error refreshing calendars:', error);
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar? You will need to reconnect to sync events.')) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/google-calendar/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setIsConnected(false);
        // Trigger refresh to update calendar sidebar
        window.dispatchEvent(new CustomEvent('calendar-refresh'));
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to disconnect Google Calendar');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      alert('Failed to disconnect Google Calendar');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/google-calendar/auth');
      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      } else {
        alert('Failed to initiate Google Calendar connection');
      }
    } catch (error) {
      console.error('Error connecting:', error);
      alert('Failed to connect Google Calendar');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Calendar Settings</DialogTitle>
          <DialogDescription>Customize your calendar display preferences.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Google Calendar Connection */}
          <div className="space-y-3">
            <Label>Google Calendar</Label>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {isConnected === null ? 'Checking...' : isConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {isConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="gap-2"
                >
                  {isDisconnecting ? (
                    <>
                      <Spinner size="sm" />
                      Disconnecting...
                    </>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4" />
                      Disconnect
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="gap-2"
                >
                  {isConnecting ? (
                    <>
                      <Spinner size="sm" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4" />
                      Connect
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* My Calendars */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>My Calendars</Label>
              {calendars.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={handleRefreshAll}
                  disabled={isRefreshingAll}
                  title="Refresh all calendars"
                >
                  <RefreshCw className={cn('h-3 w-3', isRefreshingAll && 'animate-spin')} />
                </Button>
              )}
            </div>
            {calendarsLoading ? (
              <div className="text-sm text-muted-foreground py-2">Loading calendars...</div>
            ) : calendarsError ? (
              <div className="text-sm text-destructive py-1">{calendarsError}</div>
            ) : calendars.length === 0 ? (
              <div className="text-sm text-muted-foreground py-1">
                No calendars found. Connect Google Calendar above to get started.
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {calendars.map((calendar) => (
                  <CalendarItemRow
                    key={calendar.id}
                    calendar={calendar}
                    onToggle={handleCalendarToggle}
                  />
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Time Format */}
          <div className="space-y-3">
            <Label>Time Format</Label>
            <div className="flex flex-col space-y-2">
              <label
                className={cn(
                  'flex items-center space-x-2 cursor-pointer rounded-md p-3 border transition-colors',
                  timeFormat === '12h'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                )}
              >
                <input
                  type="radio"
                  name="timeFormat"
                  value="12h"
                  checked={timeFormat === '12h'}
                  onChange={() => onTimeFormatChange('12h')}
                  className="h-4 w-4 text-primary"
                />
                <span className="text-sm font-medium">12-hour (AM/PM)</span>
              </label>
              <label
                className={cn(
                  'flex items-center space-x-2 cursor-pointer rounded-md p-3 border transition-colors',
                  timeFormat === '24h'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent'
                )}
              >
                <input
                  type="radio"
                  name="timeFormat"
                  value="24h"
                  checked={timeFormat === '24h'}
                  onChange={() => onTimeFormatChange('24h')}
                  className="h-4 w-4 text-primary"
                />
                <span className="text-sm font-medium">24-hour (Military)</span>
              </label>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

