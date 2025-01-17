'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Outfit } from 'next/font/google';
import { useEffect } from 'react';
import { Header } from '@/components/landing/Header';

const outfit = Outfit({ subsets: ['latin'] });

export default function Login() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return (
    <div
      className={`min-h-screen relative flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 overflow-hidden ${outfit.className}`}
    >
      <Header outfit={outfit} hideAction />
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="absolute inset-0 w-full h-full" aria-hidden="true">
          <div className="absolute -left-1/3 -top-1/2 w-[800px] h-[800px] bg-purple-500/15 dark:bg-purple-500/10 rounded-full blur-3xl animate-blob" />
          <div className="absolute -right-1/3 -top-1/4 w-[900px] h-[900px] bg-blue-500/15 dark:bg-blue-500/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute left-1/4 -top-1/4 w-[700px] h-[700px] bg-indigo-500/15 dark:bg-indigo-500/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
          <div className="absolute right-1/4 bottom-[-20%] w-[800px] h-[800px] bg-pink-500/10 dark:bg-pink-500/10 rounded-full blur-3xl animate-blob animation-delay-3000" />
          <div className="absolute -left-1/4 top-0 w-[900px] h-[900px] bg-cyan-500/15 dark:bg-cyan-500/10 rounded-full blur-3xl animate-blob animation-delay-1000" />
        </div>

        <h1 className="text-7xl font-bold mb-12 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 text-transparent bg-clip-text tracking-tight py-2 z-10">
          Sign in :)
        </h1>
        <div
          className={`w-full max-w-md p-8 !bg-white/60 dark:!bg-slate-900/10 backdrop-blur-md rounded-lg border border-slate-200/50 dark:border-slate-800/50 z-10 ${outfit.className}`}
        >
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
            redirectTo={
              typeof window !== 'undefined'
                ? `${window.location.origin}/auth/callback`
                : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
            }
          />
        </div>
      </div>
    </div>
  );
}
