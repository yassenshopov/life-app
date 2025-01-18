import { ArrowRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';

export function Hero({ outfit, hideAction }: { outfit: any; hideAction?: boolean }) {
  return (
    <div className="relative px-6 lg:px-8 py-24 sm:py-32 mt-10 sm:mt-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className={`${outfit.className} text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent`}>
          Supercharge your Notion workspace
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
          Transform your Notion into a powerful command center. Add beautiful dashboards, 
          real-time data sync, and enhanced mobile experience while keeping Notion as your source of truth.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/login"
            className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Get Started
          </Link>
          <Link href="#features" className="flex items-center text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
            Learn more <ArrowRightIcon className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
