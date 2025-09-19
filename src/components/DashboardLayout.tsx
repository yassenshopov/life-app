'use client';

import { ReactNode } from 'react';
import NotionSidebar from './NotionSidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <NotionSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
