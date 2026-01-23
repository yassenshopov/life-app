'use client';

import * as React from 'react';
import HQSidebar from '@/components/HQSidebar';
import { TrackingView } from '@/components/TrackingView';
import { Outfit } from 'next/font/google';
import { getColorPalette, getDefaultBgColor } from '@/lib/spotify-color';

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

export default function TrackingPage() {
  const [colorPalette, setColorPalette] = React.useState<{
    primary: string;
    secondary: string;
    accent: string;
  }>(() => {
    const defaultColor = getDefaultBgColor();
    return {
      primary: defaultColor,
      secondary: defaultColor,
      accent: defaultColor,
    };
  });
  const [isConnected, setIsConnected] = React.useState(false);
  const currentTrackIdRef = React.useRef<string | null>(null);
  const lastTrackRef = React.useRef<CurrentlyPlaying['item'] | null>(null);

  // Update background color based on currently playing track
  const updateBackgroundColor = React.useCallback((track: CurrentlyPlaying['item'] | null) => {
    if (!track?.album?.images || track.album.images.length === 0) {
      if (!lastTrackRef.current) {
        const defaultColor = getDefaultBgColor();
        setColorPalette({
          primary: defaultColor,
          secondary: defaultColor,
          accent: defaultColor,
        });
      }
      return;
    }

    // Use the largest available image for better color extraction
    const imageUrl =
      track.album.images[0]?.url || track.album.images[1]?.url || track.album.images[2]?.url;
    if (imageUrl) {
      getColorPalette(imageUrl)
        .then((palette) => {
          setColorPalette(palette);
        })
        .catch(() => {
          const defaultColor = getDefaultBgColor();
          setColorPalette({
            primary: defaultColor,
            secondary: defaultColor,
            accent: defaultColor,
          });
        });
    } else {
      const defaultColor = getDefaultBgColor();
      setColorPalette({
        primary: defaultColor,
        secondary: defaultColor,
        accent: defaultColor,
      });
    }
  }, []);

  // Check Spotify connection and fetch currently playing
  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/spotify/profile');
        const connected = response.ok;
        setIsConnected(connected);
        if (connected) {
          // Fetch immediately to get current track
          const playingResponse = await fetch('/api/spotify/currently-playing');
          if (playingResponse.ok) {
            const data: CurrentlyPlaying = await playingResponse.json();
            if (data.item) {
              lastTrackRef.current = data.item;
              const trackId = data.item.album?.images?.[0]?.url || data.item.name || null;
              currentTrackIdRef.current = trackId;
              updateBackgroundColor(data.item);
            }
          }
        }
      } catch (error) {
        setIsConnected(false);
      }
    };

    checkConnection();
  }, [updateBackgroundColor]);

  const fetchCurrentlyPlaying = React.useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/currently-playing');
      if (response.ok) {
        const data: CurrentlyPlaying = await response.json();
        
        // Only update color if track changed
        const trackId = data.item?.album?.images?.[0]?.url || null;
        if (trackId !== currentTrackIdRef.current) {
          currentTrackIdRef.current = trackId;
          
          // Store last track info if we have a track
          if (data.item) {
            lastTrackRef.current = data.item;
            updateBackgroundColor(data.item);
          } else if (!data.isPlaying && !data.is_playing) {
            // If paused and no current track, use last track or reset
            if (lastTrackRef.current) {
              updateBackgroundColor(lastTrackRef.current);
            } else {
              const defaultColor = getDefaultBgColor();
              setColorPalette({
                primary: defaultColor,
                secondary: defaultColor,
                accent: defaultColor,
              });
            }
          }
        }
      }
    } catch {
      // Silently handle errors
    }
  }, [updateBackgroundColor]);

  // Poll for currently playing track
  React.useEffect(() => {
    if (!isConnected) return;

    const pollInterval = setInterval(() => {
      fetchCurrentlyPlaying();
    }, 5000); // Poll every 5 seconds

    // Initial fetch
    fetchCurrentlyPlaying();

    return () => clearInterval(pollInterval);
  }, [isConnected, fetchCurrentlyPlaying]);

  // Convert RGB colors to RGBA with opacity for gradient
  const gradientColors = React.useMemo(() => {
    const extractRgb = (color: string) => {
      // Handle RGB format
      if (color.startsWith('rgb(')) {
        const matches = color.match(/\d+/g);
        if (matches && matches.length >= 3) {
          return { r: matches[0], g: matches[1], b: matches[2] };
        }
      }
      // Handle HSL format (convert to RGB)
      if (color.startsWith('hsl(')) {
        const matches = color.match(/[\d.]+/g);
        if (matches && matches.length >= 3) {
          const h = parseFloat(matches[0]) / 360;
          const s = parseFloat(matches[1]) / 100;
          const l = parseFloat(matches[2]) / 100;
          
          const c = (1 - Math.abs(2 * l - 1)) * s;
          const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
          const m = l - c / 2;
          
          let r = 0, g = 0, b = 0;
          if (h < 1/6) { r = c; g = x; b = 0; }
          else if (h < 2/6) { r = x; g = c; b = 0; }
          else if (h < 3/6) { r = 0; g = c; b = x; }
          else if (h < 4/6) { r = 0; g = x; b = c; }
          else if (h < 5/6) { r = x; g = 0; b = c; }
          else { r = c; g = 0; b = x; }
          
          return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255),
          };
        }
      }
      return null;
    };

    const primary = extractRgb(colorPalette.primary);
    const secondary = extractRgb(colorPalette.secondary);
    const accent = extractRgb(colorPalette.accent);

    if (!primary || !secondary || !accent) {
      return null;
    }

    // More prominent opacity values for better visibility
    return {
      primary: `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.5)`,
      secondary: `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.35)`,
      accent: `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.2)`,
    };
  }, [colorPalette]);

  const effectiveColorPalette = isConnected && gradientColors ? colorPalette : null;

  return (
    <div className={`flex h-screen bg-background ${outfit.className}`}>
      <HQSidebar colorPalette={effectiveColorPalette} />
      <main className="flex-1 overflow-y-auto">
        <div
          className={`min-h-screen transition-all duration-1000 ease-in-out ${
            !isConnected || !gradientColors
              ? 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950'
              : ''
          }`}
          style={{
            background: isConnected && gradientColors
              ? `linear-gradient(135deg, ${gradientColors.primary}, ${gradientColors.secondary}, ${gradientColors.accent})`
              : undefined,
          }}
        >
          <TrackingView colorPalette={effectiveColorPalette} />
        </div>
      </main>
    </div>
  );
}

