'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { getDefaultBgColor, getDominantColor } from '@/lib/spotify-color';

// Helper to convert RGB string to RGB values
function parseRgb(rgbString: string): { r: number; g: number; b: number } {
  const match = rgbString.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
    };
  }
  return { r: 241, g: 245, b: 249 }; // Default fallback
}

// Generate color variations for animated gradient
function generateGradientColors(baseColor: string): string[] {
  const rgb = parseRgb(baseColor);

  // Create variations: lighter, base, darker, and complementary
  const variations = [
    `rgb(${Math.min(255, rgb.r + 30)}, ${Math.min(255, rgb.g + 30)}, ${Math.min(255, rgb.b + 30)})`, // Lighter
    baseColor, // Base
    `rgb(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)})`, // Darker
    `rgb(${Math.min(255, rgb.r + 20)}, ${Math.max(0, rgb.g - 10)}, ${Math.min(255, rgb.b + 20)})`, // Slight variation
  ];

  return variations;
}

// Default color that matches the server-side render to avoid hydration mismatch
const DEFAULT_BG_COLOR = 'rgb(241, 245, 249)';
const DEFAULT_GRADIENT_COLORS = generateGradientColors(DEFAULT_BG_COLOR);

export default function NotFound() {
  // Use static default values for initial render to avoid hydration mismatch
  const [bgColor, setBgColor] = React.useState<string>(DEFAULT_BG_COLOR);
  const [isUsingCustomColor, setIsUsingCustomColor] = React.useState(false);
  const [gradientColors, setGradientColors] = React.useState<string[]>(DEFAULT_GRADIENT_COLORS);
  const [isConnected, setIsConnected] = React.useState(false);
  const lastTrackIdRef = React.useRef<string | null>(null);

  // Update to actual theme color after hydration (client-side only)
  React.useEffect(() => {
    const actualColor = getDefaultBgColor();
    if (actualColor !== DEFAULT_BG_COLOR) {
      setBgColor(actualColor);
      setGradientColors(generateGradientColors(actualColor));
    }
  }, []);

  // Check connection status
  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/spotify/profile');
        setIsConnected(response.ok);
      } catch {
        setIsConnected(false);
      }
    };

    checkConnection();
  }, []);

  // Check for currently playing track and extract color
  const fetchCurrentlyPlaying = React.useCallback(async () => {
    try {
      const response = await fetch('/api/spotify/currently-playing');
      if (response.ok) {
        const data = await response.json();
        const currentTrackId = data.item?.id;

        // Only update colors if track has changed
        if (currentTrackId && currentTrackId !== lastTrackIdRef.current) {
          lastTrackIdRef.current = currentTrackId;

          // Extract color from album art if available
          if (data.item?.album?.images && data.item.album.images.length > 0) {
            const imageUrl =
              data.item.album.images[0]?.url ||
              data.item.album.images[1]?.url ||
              data.item.album.images[2]?.url;
            if (imageUrl) {
              getDominantColor(imageUrl)
                .then((color) => {
                  setBgColor(color);
                  setGradientColors(generateGradientColors(color));
                  setIsUsingCustomColor(true);
                })
                .catch(() => {
                  const defaultColor = getDefaultBgColor();
                  setBgColor(defaultColor);
                  setGradientColors(generateGradientColors(defaultColor));
                  setIsUsingCustomColor(false);
                });
            } else {
              const defaultColor = getDefaultBgColor();
              setBgColor(defaultColor);
              setGradientColors(generateGradientColors(defaultColor));
              setIsUsingCustomColor(false);
            }
          } else {
            const defaultColor = getDefaultBgColor();
            setBgColor(defaultColor);
            setGradientColors(generateGradientColors(defaultColor));
            setIsUsingCustomColor(false);
          }
        } else if (!currentTrackId && lastTrackIdRef.current) {
          // Track stopped playing
          lastTrackIdRef.current = null;
          const defaultColor = getDefaultBgColor();
          setBgColor(defaultColor);
          setGradientColors(generateGradientColors(defaultColor));
          setIsUsingCustomColor(false);
        }
      } else {
        // Not connected or error
        if (isConnected) {
          const defaultColor = getDefaultBgColor();
          setBgColor(defaultColor);
          setGradientColors(generateGradientColors(defaultColor));
          setIsUsingCustomColor(false);
        }
      }
    } catch {
      // Silently handle errors
    }
  }, [isConnected]);

  // Poll for currently playing track - same frequency as SpotifyPlayer
  React.useEffect(() => {
    if (!isConnected) return;

    const pollInterval = setInterval(() => {
      fetchCurrentlyPlaying();
    }, 5000); // Poll every 5 seconds (same as SpotifyPlayer)

    // Initial fetch
    fetchCurrentlyPlaying();

    return () => clearInterval(pollInterval);
  }, [isConnected, fetchCurrentlyPlaying]);

  // Generate dynamic keyframes for custom colors using smooth opacity transitions
  const dynamicKeyframes = React.useMemo(() => {
    if (isUsingCustomColor && gradientColors.length >= 4) {
      const [color1, color2, color3, color4] = gradientColors;
      return `
        .gradient-layer-1 {
          background: radial-gradient(circle at 20% 30%, ${color1} 0%, ${color2} 40%, transparent 70%);
          animation: gradientMove1 15s ease-in-out infinite;
        }
        .gradient-layer-2 {
          background: radial-gradient(circle at 80% 20%, ${color2} 0%, ${color3} 40%, transparent 70%);
          animation: gradientMove2 15s ease-in-out infinite;
        }
        .gradient-layer-3 {
          background: radial-gradient(circle at 80% 80%, ${color3} 0%, ${color4} 40%, transparent 70%);
          animation: gradientMove3 15s ease-in-out infinite;
        }
        .gradient-layer-4 {
          background: radial-gradient(circle at 20% 80%, ${color4} 0%, ${color1} 40%, transparent 70%);
          animation: gradientMove4 15s ease-in-out infinite;
        }
        
        @keyframes gradientMove1 {
          0%, 100% { opacity: 1; transform: scale(1) translate(0, 0); }
          25% { opacity: 0.3; transform: scale(1.2) translate(60%, -10%); }
          50% { opacity: 0.1; transform: scale(1.4) translate(60%, 50%); }
          75% { opacity: 0.3; transform: scale(1.2) translate(0, 50%); }
        }
        @keyframes gradientMove2 {
          0% { opacity: 0.3; transform: scale(1.2) translate(-60%, 10%); }
          25%, 100% { opacity: 1; transform: scale(1) translate(0, 0); }
          50% { opacity: 0.3; transform: scale(1.2) translate(0, 60%); }
          75% { opacity: 0.1; transform: scale(1.4) translate(-60%, 60%); }
        }
        @keyframes gradientMove3 {
          0% { opacity: 0.1; transform: scale(1.4) translate(-60%, -50%); }
          25% { opacity: 0.3; transform: scale(1.2) translate(-60%, -10%); }
          50%, 100% { opacity: 1; transform: scale(1) translate(0, 0); }
          75% { opacity: 0.3; transform: scale(1.2) translate(0, -60%); }
        }
        @keyframes gradientMove4 {
          0% { opacity: 0.3; transform: scale(1.2) translate(60%, -50%); }
          25% { opacity: 0.1; transform: scale(1.4) translate(60%, -10%); }
          50% { opacity: 0.3; transform: scale(1.2) translate(0, -60%); }
          75%, 100% { opacity: 1; transform: scale(1) translate(0, 0); }
        }
      `;
    }
    return '';
  }, [isUsingCustomColor, gradientColors]);

  // Generate animated gradient style with base background
  const animatedGradientStyle = React.useMemo(() => {
    if (isUsingCustomColor && gradientColors.length >= 4) {
      const [color1, color2, color3, color4] = gradientColors;
      return {
        background: `radial-gradient(circle at 50% 50%, ${color1} 0%, ${color2} 25%, ${color3} 50%, ${color4} 75%, ${color1} 100%)`,
      } as React.CSSProperties;
    }
    return undefined;
  }, [isUsingCustomColor, gradientColors]);

  return (
    <>
      <style>
        {dynamicKeyframes}
        {`
        .default-gradient-layer-1 {
          background: radial-gradient(circle at 20% 30%, rgb(241, 245, 249) 0%, rgb(226, 232, 240) 40%, transparent 70%);
          animation: defaultGradientMove1 12s ease-in-out infinite;
        }
        .default-gradient-layer-2 {
          background: radial-gradient(circle at 80% 20%, rgb(226, 232, 240) 0%, rgb(203, 213, 225) 40%, transparent 70%);
          animation: defaultGradientMove2 12s ease-in-out infinite;
        }
        .default-gradient-layer-3 {
          background: radial-gradient(circle at 80% 80%, rgb(203, 213, 225) 0%, rgb(226, 232, 240) 40%, transparent 70%);
          animation: defaultGradientMove3 12s ease-in-out infinite;
        }
        .default-gradient-layer-4 {
          background: radial-gradient(circle at 20% 80%, rgb(226, 232, 240) 0%, rgb(241, 245, 249) 40%, transparent 70%);
          animation: defaultGradientMove4 12s ease-in-out infinite;
        }
        
        @keyframes defaultGradientMove1 {
          0%, 100% { opacity: 1; transform: scale(1) translate(0, 0); }
          25% { opacity: 0.3; transform: scale(1.2) translate(60%, -10%); }
          50% { opacity: 0.1; transform: scale(1.4) translate(60%, 50%); }
          75% { opacity: 0.3; transform: scale(1.2) translate(0, 50%); }
        }
        @keyframes defaultGradientMove2 {
          0% { opacity: 0.3; transform: scale(1.2) translate(-60%, 10%); }
          25%, 100% { opacity: 1; transform: scale(1) translate(0, 0); }
          50% { opacity: 0.3; transform: scale(1.2) translate(0, 60%); }
          75% { opacity: 0.1; transform: scale(1.4) translate(-60%, 60%); }
        }
        @keyframes defaultGradientMove3 {
          0% { opacity: 0.1; transform: scale(1.4) translate(-60%, -50%); }
          25% { opacity: 0.3; transform: scale(1.2) translate(-60%, -10%); }
          50%, 100% { opacity: 1; transform: scale(1) translate(0, 0); }
          75% { opacity: 0.3; transform: scale(1.2) translate(0, -60%); }
        }
        @keyframes defaultGradientMove4 {
          0% { opacity: 0.3; transform: scale(1.2) translate(60%, -50%); }
          25% { opacity: 0.1; transform: scale(1.4) translate(60%, -10%); }
          50% { opacity: 0.3; transform: scale(1.2) translate(0, -60%); }
          75%, 100% { opacity: 1; transform: scale(1) translate(0, 0); }
        }
        
        .dark .default-gradient-layer-1 {
          background: radial-gradient(circle at 20% 30%, rgb(0, 0, 0) 0%, rgb(15, 23, 42) 40%, transparent 70%);
        }
        .dark .default-gradient-layer-2 {
          background: radial-gradient(circle at 80% 20%, rgb(15, 23, 42) 0%, rgb(30, 41, 59) 40%, transparent 70%);
        }
        .dark .default-gradient-layer-3 {
          background: radial-gradient(circle at 80% 80%, rgb(30, 41, 59) 0%, rgb(15, 23, 42) 40%, transparent 70%);
        }
        .dark .default-gradient-layer-4 {
          background: radial-gradient(circle at 20% 80%, rgb(15, 23, 42) 0%, rgb(0, 0, 0) 40%, transparent 70%);
        }
        
        .animated-gradient-default {
          background: radial-gradient(circle at 50% 50%, 
            rgb(241, 245, 249) 0%, 
            rgb(226, 232, 240) 25%, 
            rgb(203, 213, 225) 50%, 
            rgb(226, 232, 240) 75%,
            rgb(241, 245, 249) 100%
          );
          position: relative;
          overflow: hidden;
        }
        
        .dark .animated-gradient-default {
          background: radial-gradient(circle at 50% 50%, 
            rgb(0, 0, 0) 0%, 
            rgb(15, 23, 42) 25%, 
            rgb(30, 41, 59) 50%, 
            rgb(15, 23, 42) 75%,
            rgb(0, 0, 0) 100%
          );
        }
        
        .gradient-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        
        .gradient-content {
          position: relative;
          z-index: 1;
        }
      `}
      </style>
      <div
        className={`min-h-screen flex items-center justify-center px-4 transition-all duration-500 relative ${
          !isUsingCustomColor ? 'animated-gradient-default' : ''
        }`}
        style={animatedGradientStyle}
      >
        {/* Animated gradient overlay layers */}
        {isUsingCustomColor && gradientColors.length >= 4 ? (
          <>
            <div className="gradient-overlay gradient-layer-1" />
            <div className="gradient-overlay gradient-layer-2" />
            <div className="gradient-overlay gradient-layer-3" />
            <div className="gradient-overlay gradient-layer-4" />
          </>
        ) : (
          <>
            <div className="gradient-overlay default-gradient-layer-1" />
            <div className="gradient-overlay default-gradient-layer-2" />
            <div className="gradient-overlay default-gradient-layer-3" />
            <div className="gradient-overlay default-gradient-layer-4" />
          </>
        )}
        <div className="text-center space-y-6 max-w-md gradient-content">
          <div className="space-y-2">
            <h1
              className="text-9xl font-bold transition-colors duration-500"
              style={{
                color: !isUsingCustomColor
                  ? 'rgba(var(--primary), 0.2)'
                  : 'rgba(255, 255, 255, 0.3)',
              }}
            >
              404
            </h1>
            <h2
              className="text-3xl font-bold transition-colors duration-500"
              style={{
                color: !isUsingCustomColor ? 'hsl(var(--foreground))' : 'rgba(255, 255, 255, 0.95)',
              }}
            >
              Page Not Found
            </h2>
            <p
              className="transition-colors duration-500"
              style={{
                color: !isUsingCustomColor
                  ? 'hsl(var(--muted-foreground))'
                  : 'rgba(255, 255, 255, 0.8)',
              }}
            >
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              asChild
              size="lg"
              style={
                isUsingCustomColor
                  ? {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    }
                  : undefined
              }
              className={isUsingCustomColor ? 'hover:bg-white/30' : undefined}
            >
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              style={
                isUsingCustomColor
                  ? {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                    }
                  : undefined
              }
              className={isUsingCustomColor ? 'hover:bg-white/20' : undefined}
            >
              <Link href="/hq">Go to HQ</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
