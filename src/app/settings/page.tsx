'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { NotionSetup } from '@/components/NotionSetup';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ThemeToggle } from '@/components/theme-toggle';
import { Inter, Outfit } from 'next/font/google';
import Link from 'next/link';
import { ArrowLeft, LogOut, Github, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

const inter = Inter({ subsets: ['latin'] });
const outfit = Outfit({ subsets: ['latin'] });

const UserProfile = ({ user }: { user: User }) => (
  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
    {user.user_metadata?.avatar_url ? (
      <img
        src={user.user_metadata.avatar_url}
        alt="Profile"
        className="w-12 h-12 rounded-full"
      />
    ) : (
      <div className="w-12 h-12 rounded-full font-bold bg-purple-600 dark:bg-purple-500 flex items-center justify-center text-white">
        {user.email?.[0].toUpperCase()}
      </div>
    )}
    <div>
      <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
        {user.email}
        {user.app_metadata?.provider === 'github' ? (
          <Github className="w-4 h-4 text-slate-500" />
        ) : (
          <Mail className="w-4 h-4 text-slate-500" />
        )}
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Joined {new Date(Date.parse(user.created_at)).toLocaleDateString()}
      </div>
    </div>
  </div>
);

const SettingsSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="bg-white dark:bg-slate-900 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-800">
    <h2
      className={`text-lg font-semibold mb-4 text-slate-900 dark:text-white ${outfit.className}`}
    >
      {title}
    </h2>
    {children}
  </section>
);

export default function Settings() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      setError('Failed to sign out. Please try again.');
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;
        if (!session) {
          router.push('/login');
          return;
        }

        setUser(session.user);
      } catch (error) {
        console.error('Error checking user session:', error);
        setError('Failed to authenticate. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
  }, [supabase, router]);

  if (isLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 ${inter.className}`}
      >
        <LoadingSpinner size="lg" label="Authenticating..." />
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
      className={`min-h-screen p-4 sm:p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 ${inter.className}`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>

        <h1
          className={`text-2xl font-bold mb-8 text-slate-900 dark:text-white ${outfit.className}`}
        >
          Settings
        </h1>

        <div className="space-y-6">
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
            <div className="space-y-4 flex items-center justify-between">
              <UserProfile user={user} />
              <div className="flex justify-end">
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  size="default"
                  className="text-base"
                >
                  <LogOut className="w-4 h-4" />
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
