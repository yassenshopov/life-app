'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, isToday, isSameDay } from 'date-fns';
import { CalendarEvent } from '@/components/HQCalendar';

interface HQTodayAgendaProps {
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

export function HQTodayAgenda({ colorPalette }: HQTodayAgendaProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTodayEvents = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const response = await fetch(
          `/api/google-calendar/events?timeMin=${today.toISOString()}&timeMax=${tomorrow.toISOString()}`
        );
        const data = await response.json();

        if (response.ok && data.events) {
          // Filter events for today only
          const todayEvents = data.events
            .map((event: any) => ({
              ...event,
              start: new Date(event.start),
              end: new Date(event.end),
            }))
            .filter((event: CalendarEvent) => isSameDay(event.start, today))
            .sort((a: CalendarEvent, b: CalendarEvent) => a.start.getTime() - b.start.getTime());

          setEvents(todayEvents);
        }
      } catch (error) {
        console.error('Error fetching today events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayEvents();
  }, []);

  const formatTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  // Apply color palette to card if available
  const cardStyle = colorPalette
    ? {
        backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderColor: colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.3)'),
      }
    : undefined;

  return (
    <Card className="flex flex-col h-full transition-all duration-1000" style={cardStyle}>
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Today
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto min-h-0">
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">No events today</div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              // Convert hex color to rgba with opacity
              const hexToRgba = (hex: string, opacity: number) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${opacity})`;
              };

              const bgColor = event.color.startsWith('#')
                ? hexToRgba(event.color, 0.15)
                : event.color;

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-2 rounded-lg transition-all hover:opacity-80"
                  style={{
                    backgroundColor: bgColor,
                    borderLeft: `3px solid ${event.color}`,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                    {!event.isAllDay && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatTime(event.start)}
                        {event.end && ` - ${formatTime(event.end)}`}
                      </div>
                    )}
                    {event.isAllDay && (
                      <span className="text-xs text-muted-foreground">All day</span>
                    )}
                    </div>
                    <div className="font-medium text-sm">{event.title}</div>
                    {event.location && (
                      <div className="text-xs text-muted-foreground mt-1">{event.location}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

