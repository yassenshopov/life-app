import Image from 'next/image';
import Link from 'next/link';
import { Menu as MenuIcon, Info, DollarSign, HelpCircle, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { useRouter } from 'next/navigation';

export function Header({ outfit, hideAction }: { 
  outfit: any; 
  hideAction?: boolean;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/85 z-40 sm:hidden min-h-screen"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

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
        
        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-4">
          <a
            href="#features"
            onClick={(e) => scrollToSection(e, 'features')}
            className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          >
            Features
          </a>
          <a
            href="#pricing"
            onClick={(e) => scrollToSection(e, 'pricing')}
            className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          >
            Pricing
          </a>
          <a
            href="#faq"
            onClick={(e) => scrollToSection(e, 'faq')}
            className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
          >
            FAQ
          </a>
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

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 sm:hidden rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Toggle menu"
        >
          <MenuIcon className="w-5 h-5" />
        </button>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="sm:hidden absolute top-full left-0 right-0 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-lg divide-y divide-slate-200 dark:divide-slate-800">
            <a
              href="#features"
              onClick={(e) => {
                scrollToSection(e, 'features');
                setIsMobileMenuOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left flex items-center gap-2 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Info className="w-4 h-4" />
              Features
            </a>
            <a
              href="#pricing"
              onClick={(e) => {
                scrollToSection(e, 'pricing');
                setIsMobileMenuOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left flex items-center gap-2 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <DollarSign className="w-4 h-4" />
              Pricing
            </a>
            <a
              href="#faq"
              onClick={(e) => {
                scrollToSection(e, 'faq');
                setIsMobileMenuOpen(false);
              }}
              className="w-full px-4 py-2.5 text-left flex items-center gap-2 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <HelpCircle className="w-4 h-4" />
              FAQ
            </a>
            {!hideAction && (
              <Link
                href="/login"
                className="w-full px-4 py-3 text-left flex items-center justify-between bg-indigo-600 hover:bg-indigo-500 text-white font-medium group"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
            <div className="px-4 py-2.5 flex items-center">
              <span className="text-slate-600 dark:text-slate-400">Theme</span>
              <div className="ml-auto">
                <ThemeToggle />
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
} 