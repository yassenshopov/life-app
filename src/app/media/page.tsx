'use client';

import * as React from 'react';
import HQSidebar from '@/components/HQSidebar';
import { MediaView } from '@/components/MediaView';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export default function MediaPage() {
  return (
    <div className={`flex h-screen bg-background ${outfit.className}`}>
      <HQSidebar />
      <main className="flex-1 overflow-y-auto">
        <MediaView />
      </main>
    </div>
  );
}







