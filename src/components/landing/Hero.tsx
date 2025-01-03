import Link from 'next/link';
import { Outfit } from 'next/font/google';
import { LucideCreditCard } from 'lucide-react';

const outfit = Outfit({ subsets: ['latin'] });

export function Hero() {
  return (
    <section className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
      <div className="text-center">
        <h1
          className={`text-4xl sm:text-6xl font-bold text-slate-900 dark:text-white mb-6 ${outfit.className}`}
        >
          Supercharge Your Notion Workflow
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-xl mx-auto">
          Effortlessly visualize, manage, and enhance your data with powerful
          features you can't get in Notion.
        </p>
        <Link
          href="/login"
          className="inline-block bg-purple-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-200ms"
        >
          Get Started for Free
        </Link>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
          No credit card required
          <LucideCreditCard className="w-4 h-4 inline-block ml-2" />
        </p>
      </div>
    </section>
  );
}
