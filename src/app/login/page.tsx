'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Outfit } from 'next/font/google';
import { useEffect } from 'react';

const outfit = Outfit({ subsets: ['latin'] });

export default function Login() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 ${outfit.className}`}>
      <div className="w-full max-w-md p-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 dark:border-slate-800">
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['github']}
          redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`}
        />
      </div>
    </div>
  );
} 