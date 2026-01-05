'use client';

import * as React from 'react';
import HQSidebar from '@/components/HQSidebar';
import { HQCalendar } from '@/components/HQCalendar';
import { CalendarSidebar } from '@/components/CalendarSidebar';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export default function CalendarPage() {
  const [navigateToDate, setNavigateToDate] = React.useState<Date | undefined>();

  const handleDateSelect = (date: Date) => {
    setNavigateToDate(date);
  };

  return (
    <div className={`flex h-screen bg-background ${outfit.className}`}>
      <HQSidebar />
      <div className="flex flex-1 overflow-hidden">
        <CalendarSidebar onDateSelect={handleDateSelect} />
        <main className="flex-1 overflow-y-auto">
          <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-black dark:to-slate-950 p-6 md:p-8">
            <div className="max-w-7xl mx-auto">
              <HQCalendar navigateToDate={navigateToDate} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}





