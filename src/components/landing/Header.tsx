import Image from 'next/image';
import Link from 'next/link';
import { Outfit } from 'next/font/google';
import { ThemeToggle } from '@/components/theme-toggle';

const outfit = Outfit({ subsets: ['latin'] });

export function Header({ outfit, hideAction }: { outfit: any; hideAction?: boolean }) {
  return (
    <header className="fixed top-0 left-0 right-0 w-full px-6 py-4 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-50 border-b border-slate-200/50 dark:border-slate-800/50">
      <Link href="/" className={`flex items-center gap-3 ${outfit.className}`}>
        <Image 
          src="/logo.png" 
          alt="Frameworked Logo" 
          width={32} 
          height={32} 
          className="invert dark:invert-0" 
        />
        <span className="text-xl font-semibold">Frameworked</span>
      </Link>
      <div className="flex items-center gap-4">
        {!hideAction && (
          <Link
            href="/login"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Get Started
          </Link>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
} 