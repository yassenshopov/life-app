'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Calendar, List, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDominantColor } from '@/lib/youtube-color';
import { PIXELS_PER_MINUTE } from '@/lib/calendar-utils';

interface YouTubeVideo {
  id: string;
  video_id: string;
  video_title: string;
  channel_name: string | null;
  channel_url: string | null;
  video_url: string;
  thumbnail_url: string | null;
  watched_at: string;
}

type ViewMode = 'calendar' | 'timeline';

interface YouTubeWatchHistoryCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  colorPalette?: { primary: string; secondary: string; accent: string } | null;
}

// Get week days (Monday to Sunday)
function getWeekDays(weekStart: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    days.push(date);
  }
  return days;
}

// Generate time slots from 0:00 to 23:00
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
  }
  return slots;
}

// Format time for display
function formatTime(hour: number, minute: number, format: '12h' | '24h' = '12h'): string {
  if (format === '24h') {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

export function YouTubeWatchHistoryCalendar({
  isOpen,
  onClose,
  colorPalette,
}: YouTubeWatchHistoryCalendarProps) {
  const [videos, setVideos] = React.useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>('calendar');
  const [currentWeek, setCurrentWeek] = React.useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [videoColors, setVideoColors] = React.useState<Map<string, string>>(new Map());
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [timeFormat, setTimeFormat] = React.useState<'12h' | '24h'>('12h');
  const [selectedSession, setSelectedSession] = React.useState<{
    videos: YouTubeVideo[];
    day: Date;
    startTime: Date;
    endTime: Date;
  } | null>(null);

  // Fetch videos for current week
  const fetchVideos = React.useCallback(async () => {
    if (!isOpen) return;

    setLoading(true);
    try {
      const weekStart = new Date(currentWeek);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(currentWeek);
      weekEnd.setDate(currentWeek.getDate() + 7);
      weekEnd.setHours(23, 59, 59, 999);

      const response = await fetch(
        `/api/youtube/watch-history?timeMin=${weekStart.toISOString()}&timeMax=${weekEnd.toISOString()}&limit=5000`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, currentWeek]);

  React.useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Extract colors from thumbnails
  React.useEffect(() => {
    const extractColors = async () => {
      const colorMap = new Map<string, string>();
      const videosNeedingColors = videos.filter(
        (video) => video.thumbnail_url && !videoColors.has(video.id)
      );
      
      if (videosNeedingColors.length === 0) return;

      const promises = videosNeedingColors.map(async (video) => {
        if (!video.thumbnail_url) return;
        try {
          const color = await getDominantColor(video.thumbnail_url);
          colorMap.set(video.id, color);
        } catch (error) {
          console.error('Error extracting color for video:', video.id, error);
        }
      });

      await Promise.all(promises);
      
      if (colorMap.size > 0) {
        setVideoColors((prev) => {
          const newMap = new Map(prev);
          colorMap.forEach((color, id) => {
            newMap.set(id, color);
          });
          return newMap;
        });
      }
    };

    if (videos.length > 0) {
      extractColors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  // Get videos for a specific day
  const getVideosForDay = (day: Date): YouTubeVideo[] => {
    const dateKey = day.toISOString().split('T')[0];
    return videos.filter((video) => {
      const videoDate = new Date(video.watched_at);
      return videoDate.toISOString().split('T')[0] === dateKey;
    });
  };

  // Group videos into sessions (videos within 60 minutes of each other - more generous)
  const groupVideosIntoSessions = (videos: YouTubeVideo[]): YouTubeVideo[][] => {
    if (videos.length === 0) return [];
    
    const sorted = [...videos].sort((a, b) => 
      new Date(a.watched_at).getTime() - new Date(b.watched_at).getTime()
    );
    
    const sessions: YouTubeVideo[][] = [];
    let currentSession: YouTubeVideo[] = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const prevTime = new Date(sorted[i - 1].watched_at).getTime();
      const currentTime = new Date(sorted[i].watched_at).getTime();
      const minutesDiff = (currentTime - prevTime) / (1000 * 60);
      
      // If videos are within 60 minutes (1 hour), group them together
      if (minutesDiff <= 60) {
        currentSession.push(sorted[i]);
      } else {
        sessions.push(currentSession);
        currentSession = [sorted[i]];
      }
    }
    
    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }
    
    return sessions;
  };

  // Calculate session position and duration
  const getSessionPosition = (session: YouTubeVideo[], day: Date) => {
    if (session.length === 0) return null;
    
    const firstVideo = session[0];
    const lastVideo = session[session.length - 1];
    const firstTime = new Date(firstVideo.watched_at);
    const lastTime = new Date(lastVideo.watched_at);
    
    // Check if session is on this day
    if (firstTime.toISOString().split('T')[0] !== day.toISOString().split('T')[0]) {
      return null;
    }

    const startMinutes = firstTime.getHours() * 60 + firstTime.getMinutes();
    const endMinutes = lastTime.getHours() * 60 + lastTime.getMinutes();
    
    // Calculate duration: time between first and last video, with minimum of 15 minutes
    const sessionDuration = Math.max(endMinutes - startMinutes + 15, 15);
    
    const top = startMinutes * PIXELS_PER_MINUTE;
    const height = sessionDuration * PIXELS_PER_MINUTE;

    return {
      top: `${top}px`,
      height: `${Math.max(height, 30)}px`, // Minimum height of 30px
      startTime: firstTime,
      endTime: new Date(lastTime.getTime() + 15 * 60 * 1000), // Add 15 min to last video
    };
  };

  const weekDays = React.useMemo(() => getWeekDays(currentWeek), [currentWeek]);
  const timeSlots = React.useMemo(() => generateTimeSlots(), []);

  const goToPreviousWeek = () => {
    setCurrentWeek((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7);
      return newDate;
    });
  };

  const goToNextWeek = () => {
    setCurrentWeek((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7);
      return newDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    setCurrentWeek(monday);
  };

  const weekRangeString = React.useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    return `${start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} - ${end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  }, [weekDays]);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Timeline view: sort videos by watched_at
  const sortedVideos = React.useMemo(() => {
    return [...videos].sort((a, b) => {
      return new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime();
    });
  }, [videos]);

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-7xl max-h-[90vh] bg-background rounded-lg shadow-2xl border overflow-hidden flex flex-col"
            style={
              colorPalette
                ? {
                    backgroundColor: colorPalette.primary.replace('rgb', 'rgba').replace(')', ', 0.95)'),
                    borderColor: colorPalette.accent.replace('rgb', 'rgba').replace(')', ', 0.3)'),
                  }
                : undefined
            }
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  YouTube Watch History
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="calendar">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Calendar
                        </div>
                      </SelectItem>
                      <SelectItem value="timeline">
                        <div className="flex items-center gap-2">
                          <List className="h-4 w-4" />
                          Timeline
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
              {viewMode === 'calendar' ? (
                <div className="flex flex-col h-full">
                  {/* Week Navigation */}
                  <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background z-10">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" onClick={goToToday}>
                        Today
                      </Button>
                      <Button variant="ghost" size="icon" onClick={goToNextWeek}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <h2 className="text-xl font-semibold ml-4">{weekRangeString}</h2>
                    </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      {videos.length} videos this week
                    </div>
                    <Select value={timeFormat} onValueChange={(value) => setTimeFormat(value as '12h' | '24h')}>
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12h</SelectItem>
                        <SelectItem value="24h">24h</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                  {/* Weekly Timeline View */}
                  <div className="flex-1 overflow-auto">
                    <div className="min-w-[1000px]">
                      {/* Day headers */}
                      <div
                        className="grid sticky top-0 z-10 bg-background border-b"
                        style={{ gridTemplateColumns: '60px repeat(7, 1fr)' }}
                      >
                        <div className="p-2 border-r" />
                        {weekDays.map((day, dayIndex) => (
                          <div
                            key={day.toISOString()}
                            className={cn(
                              'p-2 border-r last:border-r-0 text-center cursor-pointer hover:bg-accent transition-colors',
                              isToday(day) && 'bg-primary/10 font-bold'
                            )}
                            onClick={() => setSelectedDay(day)}
                          >
                            <div className="text-xs text-muted-foreground mb-1">
                              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIndex]}
                            </div>
                            <div className={cn('text-sm', isToday(day) && 'text-primary')}>
                              {day.getDate()}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {getVideosForDay(day).length} videos
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Time slots and videos */}
                      <div className="relative" style={{ height: `${24 * 60 * PIXELS_PER_MINUTE}px` }}>
                        {/* Time labels */}
                        <div className="absolute left-0 top-0 bottom-0 w-[60px] border-r bg-background z-10">
                          {timeSlots.map((slot, index) => (
                            <div
                              key={slot}
                              className="absolute text-xs text-muted-foreground pr-2 text-right"
                              style={{
                                top: `${index * 60 * PIXELS_PER_MINUTE}px`,
                                height: `${60 * PIXELS_PER_MINUTE}px`,
                                lineHeight: `${60 * PIXELS_PER_MINUTE}px`,
                                width: '60px',
                              }}
                            >
                              {timeFormat === '24h' ? slot : formatTime(index, 0, '12h')}
                            </div>
                          ))}
                        </div>

                        {/* Day columns - using grid to match header */}
                        <div className="absolute left-[60px] right-0 top-0 bottom-0 grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                          {weekDays.map((day) => {
                            const dayVideos = getVideosForDay(day);
                            const sessions = groupVideosIntoSessions(dayVideos);
                            
                            return (
                              <div
                                key={day.toISOString()}
                                className="relative border-r last:border-r-0"
                                style={{ height: `${24 * 60 * PIXELS_PER_MINUTE}px` }}
                              >
                              {/* Hour lines */}
                              {timeSlots.map((_, index) => (
                                <div
                                  key={index}
                                  className="absolute border-t border-border/50 w-full"
                                  style={{
                                    top: `${index * 60 * PIXELS_PER_MINUTE}px`,
                                  }}
                                />
                              ))}

                              {/* Video sessions */}
                              {sessions.map((session, sessionIndex) => {
                                const position = getSessionPosition(session, day);
                                if (!position) return null;

                                const sessionId = `${day.toISOString()}-${sessionIndex}`;
                                const bgColor = videoColors.get(session[0].id) || 'rgba(66, 133, 244, 0.7)';
                                const sessionDuration = Math.round(
                                  (position.endTime.getTime() - position.startTime.getTime()) / (1000 * 60)
                                );

                                return (
                                  <div
                                    key={sessionId}
                                    className="absolute left-1 right-1 rounded overflow-hidden hover:opacity-90 transition-opacity"
                                    style={{
                                      ...position,
                                      backgroundColor: bgColor.startsWith('rgb')
                                        ? bgColor.replace('rgb', 'rgba').replace(')', ', 0.7)')
                                        : bgColor + 'B3',
                                      cursor: 'pointer',
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setSelectedSession({
                                        videos: session,
                                        day,
                                        startTime: position.startTime,
                                        endTime: position.endTime,
                                      });
                                    }}
                                  >
                                    <a
                                      href={session[0].video_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block h-full"
                                      onClick={(e) => {
                                        if (session.length > 1) {
                                          e.preventDefault();
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-1 p-1 h-full">
                                        {session[0].thumbnail_url && (
                                          <img
                                            src={session[0].thumbnail_url}
                                            alt={session[0].video_title}
                                            className="w-8 h-6 rounded object-cover flex-shrink-0"
                                          />
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium truncate text-white">
                                            {session.length > 1
                                              ? `${session.length} videos • ${sessionDuration} min`
                                              : session[0].video_title}
                                          </p>
                                          {session.length > 1 && (
                                            <p className="text-xs text-white/70">
                                              Click for details
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </a>
                                  </div>
                                );
                              })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-auto p-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-muted-foreground">Loading videos...</div>
                    </div>
                  ) : sortedVideos.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-muted-foreground">No videos found for this week</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedVideos.map((video) => {
                        const watchedDate = new Date(video.watched_at);
                        return (
                          <a
                            key={video.id}
                            href={video.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group"
                          >
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex gap-4 p-4 rounded-lg border hover:bg-accent transition-colors"
                              style={
                                colorPalette
                                  ? {
                                      borderColor: colorPalette.accent
                                        .replace('rgb', 'rgba')
                                        .replace(')', ', 0.2)'),
                                    }
                                  : undefined
                              }
                            >
                              {video.thumbnail_url ? (
                                <img
                                  src={video.thumbnail_url}
                                  alt={video.video_title}
                                  className="w-40 h-[90px] rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-40 h-[90px] bg-muted rounded flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-lg mb-1 group-hover:text-primary line-clamp-2">
                                  {video.video_title}
                                </h3>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {video.channel_name || 'Unknown Channel'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {watchedDate.toLocaleDateString('en-US', {
                                    month: 'long',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </motion.div>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Daily Modal */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedDay?.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {selectedDay && (
              <div className="space-y-2">
                {getVideosForDay(selectedDay)
                  .sort((a, b) => new Date(a.watched_at).getTime() - new Date(b.watched_at).getTime())
                  .map((video) => {
                    const watchedAt = new Date(video.watched_at);
                    const bgColor = videoColors.get(video.id);
                    return (
                      <a
                        key={video.id}
                        href={video.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                      >
                        <div
                          className="flex gap-3 p-3 rounded-lg border hover:opacity-80 transition-opacity"
                          style={
                            bgColor
                              ? {
                                  borderColor: bgColor.startsWith('rgb')
                                    ? bgColor.replace('rgb', 'rgba').replace(')', ', 0.3)')
                                    : bgColor + '4D',
                                  backgroundColor: bgColor.startsWith('rgb')
                                    ? bgColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
                                    : bgColor + '1A',
                                }
                              : undefined
                          }
                        >
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt={video.video_title}
                              className="w-32 h-20 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-32 h-20 bg-muted rounded flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold mb-1 group-hover:text-primary line-clamp-2">
                              {video.video_title}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {watchedAt.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                {getVideosForDay(selectedDay).length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No videos watched on this day
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* YouTube Session Modal */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              YouTube Session
            </DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="flex-1 overflow-auto space-y-4">
              {/* Session Summary */}
              <div className="p-4 rounded-lg border bg-muted/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Date</div>
                    <div className="font-semibold">
                      {selectedSession.day.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Start Time</div>
                    <div className="font-semibold">
                      {selectedSession.startTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">End Time</div>
                    <div className="font-semibold">
                      {selectedSession.endTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Duration</div>
                    <div className="font-semibold">
                      {Math.round(
                        (selectedSession.endTime.getTime() - selectedSession.startTime.getTime()) /
                          (1000 * 60)
                      )}{' '}
                      minutes
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Videos</div>
                    <div className="font-semibold text-lg">{selectedSession.videos.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Unique Channels</div>
                    <div className="font-semibold text-lg">
                      {
                        new Set(
                          selectedSession.videos
                            .map((v) => v.channel_name)
                            .filter((name) => name)
                        ).size
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Avg Time Between Videos</div>
                    <div className="font-semibold text-lg">
                      {selectedSession.videos.length > 1
                        ? Math.round(
                            ((selectedSession.endTime.getTime() -
                              selectedSession.startTime.getTime()) /
                              (1000 * 60)) /
                              (selectedSession.videos.length - 1)
                          )
                        : 0}{' '}
                      min
                    </div>
                  </div>
                </div>
              </div>

              {/* Videos List */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Videos Watched</h3>
                {selectedSession.videos.map((video, index) => {
                  const watchedAt = new Date(video.watched_at);
                  const bgColor = videoColors.get(video.id);
                  return (
                    <a
                      key={video.id}
                      href={video.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <div
                        className="flex gap-4 p-4 rounded-lg border hover:opacity-80 transition-opacity"
                        style={
                          bgColor
                            ? {
                                borderColor: bgColor.startsWith('rgb')
                                  ? bgColor.replace('rgb', 'rgba').replace(')', ', 0.3)')
                                  : bgColor + '4D',
                                backgroundColor: bgColor.startsWith('rgb')
                                  ? bgColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
                                  : bgColor + '1A',
                              }
                            : undefined
                        }
                      >
                        <div className="flex-shrink-0 relative">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt={video.video_title}
                              className="w-40 h-24 rounded object-cover"
                            />
                          ) : (
                            <div className="w-40 h-24 bg-muted rounded" />
                          )}
                          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                            #{index + 1}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold mb-1 group-hover:text-primary line-clamp-2">
                            {video.video_title}
                          </h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            {video.channel_name || 'Unknown Channel'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Watched at{' '}
                            {watchedAt.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
