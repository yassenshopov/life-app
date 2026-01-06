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
import { Music, ExternalLink, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

import { getDefaultBgColor, getDominantColor } from '@/lib/spotify-color';

const outfit = Outfit({ subsets: ['latin'] });

interface CurrentlyPlaying {
  isPlaying: boolean;
  item?: {
    name: string;
    artists: Array<{ name: string }>;
    album: {
      name: string;
      images: Array<{ url: string }>;
    };
    external_urls: { spotify: string };
  };
  progress_ms?: number;
  is_playing?: boolean;
}

// Simple ECG-like waveform animation
function SpotifyWaveform({
  isPlaying,
  compact = false,
}: {
  isPlaying: boolean;
  compact?: boolean;
}) {
  // Generate a simple sine wave path that repeats seamlessly
  const generateWavePath = (width: number, height: number) => {
    const centerY = height / 2;
    const amplitude = height * 0.35;
    // Use frequency that ensures seamless repetition: 2π / width gives one full period
    const frequency = (2 * Math.PI) / width;
    const points: string[] = [];
    
    for (let x = 0; x <= width; x += 2) {
      const y = centerY + Math.sin(x * frequency) * amplitude;
      points.push(`${x},${y}`);
    }
    
    return `M ${points.join(' L ')}`;
  };

  const segmentWidth = 1000; // Width of one wave segment
  const waveHeight = compact ? 24 : 48;
  const wavePath = generateWavePath(segmentWidth, waveHeight);

  if (!isPlaying) {
    return (
      <div className={`w-full ${compact ? 'h-6' : 'h-12'} flex items-center`}>
        <div className="w-full h-0.5 bg-white/40" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes wave-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
      <div className={`w-full ${compact ? 'h-6' : 'h-12'} relative overflow-hidden`}>
        <div className="absolute inset-0 flex items-center">
          <svg
            className="h-full"
            style={{
              width: '200%',
              animation: isPlaying ? 'wave-scroll 4s linear infinite' : 'none',
            }}
            viewBox={`0 0 ${segmentWidth * 2} ${waveHeight}`}
            preserveAspectRatio="none"
          >
            {/* First wave segment */}
            <path
              d={wavePath}
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={0.8}
            />
            {/* Duplicate wave segment for seamless looping */}
            <path
              d={wavePath}
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={0.8}
              transform={`translate(${segmentWidth}, 0)`}
            />
          </svg>
        </div>
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

export function SpotifyPlayer() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = React.useState<CurrentlyPlaying | null>(null);
  const [lastTrack, setLastTrack] = React.useState<CurrentlyPlaying['item'] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [isConnected, setIsConnected] = React.useState(false);
  const [bgColor, setBgColor] = React.useState<string>(() => getDefaultBgColor());
  const [isToggling, setIsToggling] = React.useState(false);

  // Check connection status
  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/spotify/profile');
        setIsConnected(response.ok);
        if (response.ok) {
          fetchCurrentlyPlaying();
        }
      } catch (error) {
        setIsConnected(false);
      }
    };

    checkConnection();
  }, []);

  // Poll for currently playing track - reduced frequency
  React.useEffect(() => {
    if (!isConnected) return;

    const pollInterval = setInterval(() => {
      fetchCurrentlyPlaying();
    }, 5000); // Poll every 5 seconds (reduced from 3)

    // Initial fetch
    fetchCurrentlyPlaying();

    return () => clearInterval(pollInterval);
  }, [isConnected]);

  // Extract background color from album art
  React.useEffect(() => {
    const track = currentlyPlaying?.item || lastTrack;
    if (track?.album?.images && track.album.images.length > 0) {
      // Use the largest available image for better color extraction
      const imageUrl =
        track.album.images[0]?.url || track.album.images[1]?.url || track.album.images[2]?.url;
      if (imageUrl) {
        getDominantColor(imageUrl)
          .then((color) => {
            setBgColor(color);
          })
          .catch(() => {
            setBgColor(getDefaultBgColor());
          });
      } else {
        setBgColor(getDefaultBgColor());
      }
    } else if (!currentlyPlaying?.isPlaying && !currentlyPlaying?.is_playing && !lastTrack) {
      // Reset to default when not playing and no last track
      setBgColor(getDefaultBgColor());
    }
  }, [
    currentlyPlaying?.item?.album?.images,
    currentlyPlaying?.isPlaying,
    currentlyPlaying?.is_playing,
    lastTrack,
  ]);

  const fetchCurrentlyPlaying = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/spotify/currently-playing');
      if (response.ok) {
        const data = await response.json();
        setCurrentlyPlaying(data);
        // Store last track info if we have a track
        if (data.item) {
          setLastTrack(data.item);
        }
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening modal
    if (isToggling) return;

    setIsToggling(true);
    try {
      const isCurrentlyPlaying =
        (currentlyPlaying?.is_playing ?? currentlyPlaying?.isPlaying) && currentlyPlaying?.item;
      const endpoint = isCurrentlyPlaying ? '/api/spotify/pause' : '/api/spotify/play';

      const response = await fetch(endpoint, { method: 'PUT' });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        // Immediately update local state for better UX
        if (isCurrentlyPlaying) {
          setCurrentlyPlaying((prev) =>
            prev ? { ...prev, is_playing: false, isPlaying: false } : null
          );
        } else {
          setCurrentlyPlaying((prev) =>
            prev ? { ...prev, is_playing: true, isPlaying: true } : null
          );
        }
        // Refetch after a short delay to get accurate state
        setTimeout(() => {
          fetchCurrentlyPlaying();
        }, 500);
      } else if (data.needsReconnect) {
        // Show user-friendly message about needing to reconnect
        alert(
          'Playback control requires additional permissions. Please disconnect and reconnect to Spotify on the Spotify page to enable this feature.'
        );
      }
    } catch {
      // Silently handle errors
    } finally {
      setIsToggling(false);
    }
  };

  const handleSkip = async (direction: 'next' | 'previous', e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening modal
    if (isToggling) return;

    setIsToggling(true);
    try {
      const endpoint = direction === 'next' ? '/api/spotify/next' : '/api/spotify/previous';
      const response = await fetch(endpoint, { method: 'POST' });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        // Refetch after a short delay to get the new track
        setTimeout(() => {
          fetchCurrentlyPlaying();
        }, 500);
      } else if (data.needsReconnect) {
        alert(
          'Playback control requires additional permissions. Please disconnect and reconnect to Spotify on the Spotify page to enable this feature.'
        );
      }
    } catch {
      // Silently handle errors
    } finally {
      setIsToggling(false);
    }
  };

  if (!isConnected) {
    return null; // Don't show widget if not connected
  }

  // Use the actual is_playing field from Spotify API, fallback to isPlaying
  const isPlaying = Boolean(
    (currentlyPlaying?.is_playing ?? currentlyPlaying?.isPlaying) && currentlyPlaying?.item
  );
  // Use last track if paused, otherwise use current track
  const track = currentlyPlaying?.item || lastTrack;

  // Don't show widget if there's no track playing
  if (!track) {
    return null;
  }

  return (
    <>
      {/* Mini Widget - Fixed Width */}
      <div className="fixed bottom-4 right-4 z-50">
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
              <SpotifyWaveform isPlaying={isPlaying} compact={false} />
            </div>
          </div>

          <div className="relative p-3 z-10">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
                <img
                  src={track.album.images[2]?.url || track.album.images[0]?.url}
                  alt={track.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <MarqueeText text={track.name} className="text-white font-semibold text-sm" />
                <p className="text-white/80 text-xs truncate">
                  {track.artists.map((a) => a.name).join(', ')}
                </p>
              </div>
              {/* Controls: Previous, Play/Pause, Next */}
              <div className="flex-shrink-0 flex items-center gap-1">
                <button
                  onClick={(e) => handleSkip('previous', e)}
                  disabled={isToggling}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors disabled:opacity-50"
                  aria-label="Previous track"
                >
                  <SkipBack className="w-3.5 h-3.5 text-white" />
                </button>
                <button
                  onClick={handlePlayPause}
                  disabled={isToggling}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors disabled:opacity-50"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isToggling ? (
                    <Spinner size="sm" className="text-white" />
                  ) : isPlaying ? (
                    <Pause className="w-4 h-4 text-white fill-white" />
                  ) : (
                    <Play className="w-4 h-4 text-white fill-white" />
                  )}
                </button>
                <button
                  onClick={(e) => handleSkip('next', e)}
                  disabled={isToggling}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors disabled:opacity-50"
                  aria-label="Next track"
                >
                  <SkipForward className="w-3.5 h-3.5 text-white" />
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
          <DialogTitle className="sr-only">Now Playing</DialogTitle>
          {track ? (
            <div className="flex h-full">
              {/* Left: Album Art */}
              <div className="w-64 h-full flex-shrink-0 relative">
                <img
                  src={track.album.images[0]?.url}
                  alt={track.album.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-black/40" />
              </div>

              {/* Right: Info */}
              <div className="flex-1 flex flex-col p-6 text-white">
                <div className="flex items-start mb-4">
                  <div className="flex-1 min-w-0">
                    <MarqueeText text={track.name} className="text-2xl font-bold mb-1" />
                    <p className="text-white/90 text-lg mb-1">
                      {track.artists.map((a) => a.name).join(', ')}
                    </p>
                    <p className="text-white/70 text-sm">{track.album.name}</p>
                  </div>
                </div>

                {/* Waveform */}
                <div className="flex-1 flex items-center py-4">
                  <SpotifyWaveform isPlaying={isPlaying} />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={(e) => handleSkip('previous', e)}
                    disabled={isToggling}
                    className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors disabled:opacity-50"
                    aria-label="Previous track"
                  >
                    <SkipBack className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    disabled={isToggling}
                    className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors disabled:opacity-50"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isToggling ? (
                      <Spinner size="md" className="text-white" />
                    ) : isPlaying ? (
                      <Pause className="w-6 h-6 text-white fill-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white fill-white" />
                    )}
                  </button>
                  <button
                    onClick={(e) => handleSkip('next', e)}
                    disabled={isToggling}
                    className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors disabled:opacity-50"
                    aria-label="Next track"
                  >
                    <SkipForward className="w-5 h-5 text-white" />
                  </button>
                  <Button
                    className="flex-1 bg-white/20 hover:bg-white/30 text-white border-white/30"
                    onClick={() => window.open(track.external_urls.spotify, '_blank')}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in Spotify
                  </Button>
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
                    <Music className="w-12 h-12 text-white/60" />
                  )}
                </div>
                <div>
                  <p className="text-white text-xl font-semibold">Nothing is playing</p>
                  <p className="text-white/80 text-sm mt-2">Start playing something on Spotify</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
