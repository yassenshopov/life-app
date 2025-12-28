'use client';

import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock, MoreVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, isSameDay, startOfDay, addDays } from 'date-fns';
import { CalendarEvent } from '@/components/HQCalendar';
import Link from 'next/link';

interface HQWeekAgendaProps {
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

interface ForecastDay {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  description: string;
  icon: string;
  precipitation?: number;
  windSpeed?: number;
}

export function HQWeekAgenda({ colorPalette }: HQWeekAgendaProps) {
  const [eventsByDay, setEventsByDay] = useState<Map<string, CalendarEvent[]>>(new Map());
  const [forecastByDay, setForecastByDay] = useState<Map<string, ForecastDay>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showWeather, setShowWeather] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hq-week-agenda-show-weather');
      return saved === 'true';
    }
    return false;
  });

  useEffect(() => {
    const fetchWeekEvents = async () => {
      try {
        const today = startOfDay(new Date());
        const weekEnd = addDays(today, 7);
        weekEnd.setHours(23, 59, 59, 999);

        const response = await fetch(
          `/api/google-calendar/events?timeMin=${today.toISOString()}&timeMax=${weekEnd.toISOString()}`
        );
        const data = await response.json();

        if (response.ok && data.events) {
          // Group events by day
          const grouped = new Map<string, CalendarEvent[]>();

          // Initialize all 7 days
          for (let i = 0; i < 7; i++) {
            const date = addDays(today, i);
            const dateKey = format(date, 'yyyy-MM-dd');
            grouped.set(dateKey, []);
          }

          // Add events to their respective days
          data.events
            .map((event: any) => ({
              ...event,
              start: new Date(event.start),
              end: new Date(event.end),
            }))
            .forEach((event: CalendarEvent) => {
              const eventDate = startOfDay(event.start);
              const dateKey = format(eventDate, 'yyyy-MM-dd');
              const dayEvents = grouped.get(dateKey) || [];
              dayEvents.push(event);
              grouped.set(dateKey, dayEvents);
            });

          // Sort events within each day
          grouped.forEach((events, key) => {
            events.sort((a, b) => a.start.getTime() - b.start.getTime());
          });

          setEventsByDay(grouped);
        }
      } catch (error) {
        console.error('Error fetching week events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeekEvents();
  }, []);

  useEffect(() => {
    if (!showWeather) {
      setForecastByDay(new Map());
      return;
    }

    const fetchForecast = async () => {
      try {
        const response = await fetch('/api/weather/forecast');
        if (response.ok) {
          const data = await response.json();
          if (data.forecast) {
            const forecastMap = new Map<string, ForecastDay>();
            data.forecast.forEach((day: ForecastDay) => {
              forecastMap.set(day.date, day);
            });
            setForecastByDay(forecastMap);
          }
        }
      } catch (error) {
        console.error('Error fetching forecast:', error);
      }
    };

    fetchForecast();
  }, [showWeather]);

  const formatTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  const formatDayLabel = (dateKey: string) => {
    const date = new Date(dateKey);
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);

    if (isSameDay(date, today)) {
      return 'Today';
    } else if (isSameDay(date, tomorrow)) {
      return 'Tomorrow';
    } else {
      return format(date, 'EEE, MMM d');
    }
  };

  const getWeatherIcon = (iconCode: string) => {
    const iconMap: Record<string, string> = {
      '01d': '☀️',
      '01n': '🌙',
      '02d': '⛅',
      '02n': '☁️',
      '03d': '☁️',
      '03n': '☁️',
      '04d': '☁️',
      '04n': '☁️',
      '09d': '🌧️',
      '09n': '🌧️',
      '10d': '🌦️',
      '10n': '🌦️',
      '11d': '⛈️',
      '11n': '⛈️',
      '13d': '❄️',
      '13n': '❄️',
      '50d': '🌫️',
      '50n': '🌫️',
    };
    return iconMap[iconCode] || '🌤️';
  };

  const handleToggleWeather = () => {
    const newValue = !showWeather;
    setShowWeather(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hq-week-agenda-show-weather', String(newValue));
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Next 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const days = Array.from(eventsByDay.keys()).sort();

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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Next 7 Days
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleToggleWeather}>
                {showWeather ? 'Hide' : 'Show'} Weather
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {days.length === 0 || Array.from(eventsByDay.values()).every((events) => events.length === 0) ? (
          <div className="text-sm text-muted-foreground py-4 text-center">No upcoming events</div>
        ) : (
          <div className="grid grid-cols-7 gap-3 h-full">
            {Array.from({ length: 7 }, (_, i) => {
              const today = startOfDay(new Date());
              const date = addDays(today, i);
              const dateKey = format(date, 'yyyy-MM-dd');
              const events = eventsByDay.get(dateKey) || [];

              const dayForecast = forecastByDay.get(dateKey);

              return (
                <div key={dateKey} className="flex flex-col min-h-0">
                  <div className="mb-2 flex-shrink-0">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {formatDayLabel(dateKey)}
                    </div>
                    {showWeather && dayForecast && (
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                        <span>{getWeatherIcon(dayForecast.icon)}</span>
                        <span className="font-medium">
                          {dayForecast.temperature.max}°/{dayForecast.temperature.min}°
                        </span>
                        <span className="opacity-70">💧 {dayForecast.precipitation}%</span>
                        <span className="opacity-70">💨 {dayForecast.windSpeed}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
                    {events.length === 0 ? (
                      <div className="text-xs text-muted-foreground/50">No events</div>
                    ) : (
                      events.slice(0, 5).map((event) => {
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
                            className="flex items-start gap-1.5 p-1.5 rounded transition-all hover:opacity-80"
                            style={{
                              backgroundColor: bgColor,
                              borderLeft: `2px solid ${event.color}`,
                            }}
                          >
                            <div className="flex-1 min-w-0">
                            {!event.isAllDay && (
                              <div className="text-[10px] text-muted-foreground mb-0.5">
                                {formatTime(event.start)}
                              </div>
                            )}
                            <div className="font-medium text-xs leading-tight line-clamp-2">
                              {event.title}
                            </div>
                          </div>
                        </div>
                      );
                      })
                    )}
                    {events.length > 5 && (
                      <Link
                        href="/calendar"
                        className="text-[10px] text-muted-foreground hover:text-foreground block mt-1"
                      >
                        +{events.length - 5}
                      </Link>
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

