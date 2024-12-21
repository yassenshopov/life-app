import { Metadata } from 'next'

export const defaultMetadata: Metadata = {
  title: 'LifeMetrics | Personal Analytics Dashboard',
  description: 'Track and visualize your daily activities, habits, and personal metrics. Get insights into your sleep, productivity, fitness, and more.',
  keywords: 'life tracking, personal analytics, habit tracking, productivity metrics, health dashboard, personal data',
  authors: [{ name: 'LifeMetrics Team' }],
  openGraph: {
    title: 'LifeMetrics | Personal Analytics Dashboard',
    description: 'Track and visualize your daily activities, habits, and personal metrics.',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'LifeMetrics Dashboard Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LifeMetrics | Personal Analytics Dashboard',
    description: 'Track and visualize your daily activities, habits, and personal metrics.',
    images: ['/og-image.jpg'],
  },
  viewport: 'width=device-width, initial-scale=1',
  robots: {
    index: true,
    follow: true,
  },
  themeColor: '#8b5cf6',
  manifest: '/manifest.json',
};

export default defaultMetadata 