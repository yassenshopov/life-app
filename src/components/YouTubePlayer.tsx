'use client';

import * as React from 'react';
import { Outfit } from 'next/font/google';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Video, ExternalLink, Play } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

import { getDefaultBgColor, getDominantColor } from '@/lib/youtube-color';

const outfit = Outfit({ subsets: ['latin'] });

interface RecentlyWatchedVideo {
  video_id: string;
  title: string;
  channel_name: string | null;
  channel_url: string | null;
  video_url: string;
  thumbnail_url: string | null;
  watched_at: string;
}

// Simple waveform animation (static for YouTube since we don't have playback state)
function YouTubeWaveform({ compact = false }: { compact?: boolean }) {
  const barCount = compact ? 60 : 120;
  const minHeightPercent = 15;
  const maxHeightPercent = 85;

  return (
    <>
      <style>{`
        @keyframes bar-animate {
          0%, 100% {
            height: ${minHeightPercent}%;
          }
          50% {
            height: ${maxHeightPercent}%;
          }
        }
      `}</style>
      <div className={`w-full ${compact ? 'h-6' : 'h-12'} flex items-end justify-between gap-0.5 px-1`}>
        {Array.from({ length: barCount }).map((_, i) => {
          // Calculate delay based on position to create wave effect
          const delay = (i / barCount) * 1.2;
          
          return (
            <div
              key={i}
              className="bg-white/80 rounded-full"
              style={{
                width: compact ? '3px' : '4px',
                flex: '1 1 0',
                height: `${minHeightPercent}%`,
                animation: `bar-animate 1.2s ease-in-out infinite`,
                animationDelay: `${delay}s`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>
    </>
  );
}

// Marquee text component - single line, horizontal scroll (autocue style)
function MarqueeText({ text, className = '' }: { text: string; className?: string }) {
  const [shouldScroll, setShouldScroll] = React.useState(false);
  const textRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (textRef.current && containerRef.current) {
      const textWidth = textRef.current.scrollWidth;
      const containerWidth = containerRef.current.offsetWidth;
      setShouldScroll(textWidth > containerWidth);
    }
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${className}`}
      style={{
        height: '1.25rem',
        lineHeight: '1.25rem',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        ref={textRef}
        className="whitespace-nowrap"
        style={
          shouldScroll
            ? {
                display: 'inline-block',
                paddingLeft: '100%',
                animation: 'marquee 20s linear infinite',
              }
            : {
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }
        }
      >
        {text}
      </div>
      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
}

export function YouTubePlayer() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [recentlyWatched, setRecentlyWatched] = React.useState<RecentlyWatchedVideo | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [hasHistory, setHasHistory] = React.useState(false);
  const [bgColor, setBgColor] = React.useState<string>(() => getDefaultBgColor());

  // Check if user has watch history
  React.useEffect(() => {
    const checkHistory = async () => {
      try {
        const response = await fetch('/api/youtube/recently-watched');
        if (response.ok) {
          const data = await response.json();
          setHasHistory(data.video !== null);
          if (data.video) {
            setRecentlyWatched(data.video);
          }
        }
      } catch (error) {
        setHasHistory(false);
      }
    };

    checkHistory();
  }, []);

  // Poll for recently watched video
  React.useEffect(() => {
    if (!hasHistory) return;

    const pollInterval = setInterval(() => {
      fetchRecentlyWatched();
    }, 10000); // Poll every 10 seconds (less frequent than Spotify since it's not real-time)

    // Initial fetch
    fetchRecentlyWatched();

    return () => clearInterval(pollInterval);
  }, [hasHistory]);

  // Extract background color from thumbnail
  React.useEffect(() => {
    if (recentlyWatched?.thumbnail_url) {
      getDominantColor(recentlyWatched.thumbnail_url)
        .then((color) => {
          setBgColor(color);
        })
        .catch(() => {
          setBgColor(getDefaultBgColor());
        });
    } else {
      setBgColor(getDefaultBgColor());
    }
  }, [recentlyWatched?.thumbnail_url]);

  const fetchRecentlyWatched = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/youtube/recently-watched');
      if (response.ok) {
        const data = await response.json();
        if (data.video) {
          setRecentlyWatched(data.video);
          setHasHistory(true);
        } else {
          setHasHistory(false);
        }
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  };

  if (!hasHistory || !recentlyWatched) {
    return null; // Don't show widget if no history
  }

  // Format time since watched
  const getTimeAgo = (watchedAt: string): string => {
    const now = new Date();
    const watched = new Date(watchedAt);
    const diffMs = now.getTime() - watched.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <>
      {/* Mini Widget - Fixed Width */}
      <div className="fixed bottom-24 right-4 z-50">
        <div
          className={`relative w-80 rounded-lg shadow-2xl transition-all duration-500 cursor-pointer overflow-hidden ${outfit.className}`}
          style={
            {
              backgroundColor: bgColor || getDefaultBgColor(),
              background: bgColor || getDefaultBgColor(),
            } as React.CSSProperties
          }
          onClick={() => setIsOpen(true)}
        >
          {/* Background Waveform */}
          <div className="absolute inset-0 flex items-end justify-center opacity-20 pointer-events-none pb-0">
            <div className="w-full px-4">
              <YouTubeWaveform compact={false} />
            </div>
          </div>

          <div className="relative p-3 z-10">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
                {recentlyWatched.thumbnail_url ? (
                  <img
                    src={recentlyWatched.thumbnail_url}
                    alt={recentlyWatched.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center">
                    <Video className="w-6 h-6 text-white/60" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <MarqueeText text={recentlyWatched.title} className="text-white font-semibold text-sm" />
                <p className="text-white/80 text-xs truncate">
                  {recentlyWatched.channel_name || 'Unknown Channel'}
                </p>
                <p className="text-white/60 text-xs">{getTimeAgo(recentlyWatched.watched_at)}</p>
              </div>
              <div className="flex-shrink-0">
                <button
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  aria-label="Open in YouTube"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(recentlyWatched.video_url, '_blank');
                  }}
                >
                  <Play className="w-4 h-4 text-white fill-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Modal - Fixed Height, Wider, Compact */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className={`sm:max-w-[700px] h-[500px] p-0 border-0 overflow-hidden ${outfit.className}`}
          style={
            {
              backgroundColor: bgColor,
              backgroundImage: `linear-gradient(135deg, ${bgColor}ee, ${bgColor}cc)`,
            } as React.CSSProperties
          }
        >
          <DialogTitle className="sr-only">Recently Watched</DialogTitle>
          {recentlyWatched ? (
            <div className="flex h-full">
              {/* Left: Thumbnail */}
              <div className="w-64 h-full flex-shrink-0 relative">
                {recentlyWatched.thumbnail_url ? (
                  <img
                    src={recentlyWatched.thumbnail_url}
                    alt={recentlyWatched.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <Video className="w-24 h-24 text-white/60" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-black/40" />
              </div>

              {/* Right: Info */}
              <div className="flex-1 flex flex-col p-6 text-white">
                <div className="flex items-start mb-4">
                  <div className="flex-1 min-w-0">
                    <MarqueeText text={recentlyWatched.title} className="text-2xl font-bold mb-1" />
                    <p className="text-white/90 text-lg mb-1">
                      {recentlyWatched.channel_name || 'Unknown Channel'}
                    </p>
                    <p className="text-white/70 text-sm">Watched {getTimeAgo(recentlyWatched.watched_at)}</p>
                  </div>
                </div>

                {/* Waveform */}
                <div className="flex-1 flex items-center py-4">
                  <YouTubeWaveform />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/30"
                    onClick={() => window.open(recentlyWatched.video_url, '_blank')}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Watch on YouTube
                  </Button>
                  {recentlyWatched.channel_url && (
                    <Button
                      className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                      onClick={() => window.open(recentlyWatched.channel_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center space-y-4">
                <div className="mx-auto w-24 h-24 rounded-full bg-white/10 flex items-center justify-center">
                  {loading ? (
                    <Spinner size="lg" className="text-white" />
                  ) : (
                    <Video className="w-12 h-12 text-white/60" />
                  )}
                </div>
                <div>
                  <p className="text-white text-xl font-semibold">No watch history</p>
                  <p className="text-white/80 text-sm mt-2">
                    Sync your YouTube watch history to see recently watched videos
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

