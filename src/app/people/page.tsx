'use client';

import * as React from 'react';
import HQSidebar from '@/components/HQSidebar';
import { PeopleView } from '@/components/PeopleView';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export default function PeoplePage() {
  return (
    <div className={`flex h-screen bg-background ${outfit.className}`}>
      <HQSidebar />
      <main className="flex-1 overflow-y-auto">
        <PeopleView />
      </main>
    </div>
  );
}

