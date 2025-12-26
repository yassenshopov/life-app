import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider, QueryProvider } from '@/components/providers';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import { defaultMetadata } from './metadata';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GlobalThemeToggle } from '@/components/GlobalThemeToggle';
import { SpotifyPlayer } from '@/components/SpotifyPlayer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  manifest: '/manifest.json',
  ...defaultMetadata,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
        <ClerkProvider>
          <QueryProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <GlobalThemeToggle />
              {children}
              <SpotifyPlayer />
              <SpeedInsights />
            </ThemeProvider>
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
