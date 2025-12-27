'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import NotionSetup from '@/components/NotionSetup';
import { Spinner } from '@/components/ui/spinner';
import { ThemeToggle } from '@/components/theme-toggle';
import { Inter, Outfit } from 'next/font/google';
import Link from 'next/link';
import { ArrowLeft, LogOut, Github, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

const inter = Inter({ subsets: ['latin'] });
const outfit = Outfit({ subsets: ['latin'] });

const UserProfile = ({ user }: { user: any }) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-sm text-slate-600 dark:text-slate-400 w-full">
    {user.imageUrl ? (
      <img src={user.imageUrl} alt="Profile" className="w-12 h-12 rounded-full" />
    ) : (
      <div className="w-12 h-12 rounded-full font-bold bg-purple-600 dark:bg-purple-500 flex items-center justify-center text-white">
        {user.primaryEmailAddress?.emailAddress[0].toUpperCase()}
      </div>
    )}
    <div className="w-full">
      <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2 break-all">
        {user.primaryEmailAddress?.emailAddress}
        {user.externalAccounts?.some((account: any) => account.provider === 'github') ? (
          <Github className="w-4 h-4 text-slate-500" />
        ) : (
          <Mail className="w-4 h-4 text-slate-500" />
        )}
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Joined {new Date(user.createdAt).toLocaleDateString()}
      </div>
    </div>
  </div>
);

const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white dark:bg-slate-900 rounded-lg p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800">
    <h2
      className={`text-lg font-semibold mb-3 sm:mb-4 text-slate-900 dark:text-white ${outfit.className}`}
    >
      {title}
    </h2>
    {children}
  </section>
);

export default function Settings() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out. Please try again.');
    }
  };

  useEffect(() => {
    if (isLoaded) {
      if (!user) {
        router.push('/login');
      }
      setIsLoading(false);
    }
  }, [isLoaded, user, router]);

  if (isLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 ${inter.className}`}
      >
        <div className="flex flex-col items-center gap-2">
          <Spinner size="lg" />
          <span className="text-sm text-gray-700 dark:text-white/80">Authenticating...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 ${inter.className}`}
      >
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div
      className={`min-h-screen p-3 sm:p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 ${inter.className}`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>

        <h1
          className={`text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-slate-900 dark:text-white ${outfit.className}`}
        >
          Settings
        </h1>

        <div className="space-y-4 sm:space-y-6">
          <SettingsSection title="Appearance">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Toggle between light and dark mode
              </div>
              <ThemeToggle />
            </div>
          </SettingsSection>

          <SettingsSection title="Integrations">
            <NotionSetup />
          </SettingsSection>

          <SettingsSection title="Account">
            <div className="space-y-4 sm:space-y-0 flex flex-col sm:flex-row sm:items-center justify-between">
              <UserProfile user={user} />
              <div className="flex justify-start sm:justify-end">
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  size="default"
                  className="text-base w-full sm:w-auto"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </Button>
              </div>
            </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}
