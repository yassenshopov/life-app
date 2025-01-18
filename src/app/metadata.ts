import { Metadata } from 'next'

export const defaultMetadata: Metadata = {
  title: 'Frameworked | Supercharge your Notion workspace',
  description: 'Supercharge your Notion workspace with powerful visualizations, integrations, and enhanced workflows. Build custom dashboards, track metrics, and optimize your productivity.',
  keywords: 'notion enhancement, notion framework, productivity tools, notion dashboard, data visualization, notion integration, workflow automation',
  authors: [{ name: 'Yassen Shopov' }],
  openGraph: {
    title: 'Frameworked | Supercharge your Notion workspace',
    description: 'Supercharge your Notion workspace with powerful visualizations and enhanced workflows.',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.webp',
        width: 1200,
        height: 630,
        alt: 'Frameworked Dashboard Preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Frameworked | Supercharge your Notion workspace',
    description: 'Supercharge your Notion workspace with powerful visualizations and enhanced workflows.',
    images: ['/og-image.webp'],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: '/manifest.json',
};

export default defaultMetadata 