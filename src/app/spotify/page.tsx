'use client';

import * as React from 'react';
import HQSidebar from '@/components/HQSidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Music,
  LogOut,
  Loader2,
} from 'lucide-react';
import { Outfit } from 'next/font/google';
import { SpotifyAnalytics } from '@/components/SpotifyAnalytics';

const outfit = Outfit({ subsets: ['latin'] });

interface SpotifyProfile {
  id: string;
  display_name: string;
  email: string;
  images: Array<{ url: string }>;
  followers: { total: number };
  country: string;
  product: string;
}

interface Track {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; images: Array<{ url: string }> };
  external_urls: { spotify: string };
  popularity?: number;
}

interface Artist {
  id: string;
  name: string;
  images: Array<{ url: string }>;
  genres: string[];
  external_urls: { spotify: string };
  popularity?: number;
}

interface CurrentlyPlaying {
  isPlaying: boolean;
  item?: {
    name: string;
    artists: Array<{ name: string }>;
    album: { images: Array<{ url: string }> };
    external_urls: { spotify: string };
  };
  progress_ms?: number;
  is_playing?: boolean;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  images: Array<{ url: string }>;
  owner: { display_name: string };
  tracks: { total: number };
  external_urls: { spotify: string };
}

export default function SpotifyPage() {
  const [isConnected, setIsConnected] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [profile, setProfile] = React.useState<SpotifyProfile | null>(null);

  React.useEffect(() => {
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');

    if (connected === 'true') {
      setIsConnected(true);
      window.history.replaceState({}, '', window.location.pathname);
      checkConnection();
    } else if (error) {
      console.error('Spotify connection error:', error);
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      checkConnection();
    }
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/spotify/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      setIsConnected(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch('/api/spotify/auth');
      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        }
      }
    } catch (error) {
      console.error('Error connecting to Spotify:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch('/api/spotify/disconnect', { method: 'POST' });
      if (response.ok) {
        setIsConnected(false);
        setProfile(null);
      }
    } catch (error) {
      console.error('Error disconnecting from Spotify:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/spotify/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  if (!isConnected) {
    return (
      <div className={`flex h-screen bg-background ${outfit.className}`}>
        <HQSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 flex items-center justify-center p-6">
            <Card className="max-w-md w-full">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                  <Music className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-2xl">Connect to Spotify</CardTitle>
                <CardDescription>
                  Connect your Spotify account to explore the full power of the Spotify Web API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    View your listening history
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    See your top tracks and artists
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Get personalized recommendations
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Manage your playlists
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Track currently playing music
                  </li>
                </ul>
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  size="lg"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Music className="mr-2 h-4 w-4" />
                      Connect with Spotify
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`flex h-screen bg-background ${outfit.className}`}>
      <HQSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                  Spotify
                </h1>
                <p className="text-muted-foreground mt-2">
                  Explore what's possible with the Spotify Web API
                </p>
              </div>
              <div className="flex items-center gap-4">
                {profile && (
                  <div className="flex items-center gap-3">
                    {profile.images?.[0] && (
                      <img
                        src={profile.images[0].url}
                        alt={profile.display_name}
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-semibold">{profile.display_name}</p>
                      <p className="text-sm text-muted-foreground">{profile.followers?.total} followers</p>
                    </div>
                  </div>
                )}
                <Button variant="outline" onClick={handleDisconnect}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            </div>

        {/* Analytics Component */}
        <SpotifyAnalytics />

          </div>
        </div>
      </main>
    </div>
  );
}

