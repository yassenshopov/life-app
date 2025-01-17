'use client';

import { Analytics } from '@vercel/analytics/react';
import { Inter, Outfit } from 'next/font/google';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect } from 'react';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { UseCases } from '@/components/landing/UseCases';
import { Integration } from '@/components/landing/Integration';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { Footer } from '@/components/landing/Footer';
import { Header } from '@/components/landing/Header';

const inter = Inter({ subsets: ['latin'] });
const outfit = Outfit({ subsets: ['latin'] });

export default function LandingPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 ${inter.className}`}
    >
      <Analytics />
      <Header outfit={outfit} />
      <Hero outfit={outfit} />
      <Features outfit={outfit} />
      <UseCases outfit={outfit} />
      <Integration outfit={outfit} />
      <Pricing outfit={outfit} />
      <FAQ outfit={outfit} />
      <Footer outfit={outfit} />
    </div>
  );
}
