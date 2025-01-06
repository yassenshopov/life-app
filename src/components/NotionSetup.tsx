'use client';

import { useState, useEffect } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Check as CheckIcon } from 'lucide-react';

export function NotionSetup() {
  const [isOpen, setIsOpen] = useState(false);
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const session = useSession();

  useEffect(() => {
    console.log('useEffect triggered, session:', session);

    if (session?.user) {
      const checkCredentials = async () => {
        try {
          const response = await fetch('/api/user/notion-credentials');
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          console.log('API response data:', data);

          if (data && data.notionDatabaseId) {
            setIsConnected(true);
            setNotionDatabaseId(data.notionDatabaseId);
          } else {
            setIsConnected(false);
            setNotionDatabaseId('');
          }
        } catch (error) {
          console.error('Error checking credentials:', error);
          setIsConnected(false);
          setNotionDatabaseId('');
        } finally {
          setIsLoading(false);
        }
      };

      checkCredentials();
    } else {
      console.log('No session found, resetting states');
      setIsConnected(false);
      setNotionDatabaseId('');
      setIsLoading(false);
    }
  }, [session]);

  const extractDatabaseId = (url: string): string => {
    // Handle URLs that start with @
    url = url.startsWith('@') ? url.substring(1) : url;
    
    // Try to match the database ID pattern (32 characters with optional dashes)
    const match = url.match(/([a-f0-9]{32}|[a-f0-9-]{36})/i);
    return match ? match[0] : url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const cleanedDatabaseId = extractDatabaseId(notionDatabaseId);
      const response = await fetch('/api/user/notion-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session?.user?.id,
          notionDatabaseId: cleanedDatabaseId,
        }),
      });

      if (response.ok) {
        setIsOpen(false);
      } else {
        // Handle error
        console.error('Failed to save Notion credentials');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (isLoading) {
    return (
      <button className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg opacity-50">
        <div className="flex items-center gap-1 sm:gap-2">
          <img src="/notion-logo.svg" alt="Notion Logo" className="w-5 h-5 sm:w-6 sm:h-6 dark:invert mr-1 sm:mr-2" />
          <div>
            <h3 className="font-medium text-sm sm:text-base">Notion Daily Tracking Integration</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Loading...
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
      >
        <div className="flex items-center gap-1 sm:gap-2">
          <img src="/notion-logo.svg" alt="Notion Logo" className="w-5 h-5 sm:w-6 sm:h-6 dark:invert mr-1 sm:mr-2" />
          <div>
            <h3 className="font-medium text-sm sm:text-base">Notion Daily Tracking Integration</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Connect Notion Daily Tracking database
            </p>
          </div>
        </div>
        <span className={`text-xs sm:text-sm ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
          {isConnected ? (
            <span className="flex items-center gap-1">
              Connected <CheckIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            </span>
          ) : (
            'Configure →'
          )}
        </span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Setup Notion Daily Tracking Integration</DialogTitle>
            <DialogDescription className="text-sm">
              Please enter your Notion Daily Tracking database URL to continue.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="notionDatabaseId"
                className="block text-sm font-medium mb-1"
              >
                Notion Database ID
              </label>
              <input
                id="notionDatabaseId"
                type="text"
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
                placeholder="Paste your Notion database URL here"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 text-sm"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md py-2 text-sm"
            >
              Save
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
