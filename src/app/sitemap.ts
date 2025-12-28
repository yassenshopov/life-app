import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  // Base URL - replace with your actual domain
  const baseUrl = 'https://frameworked.io'

  // Add all your static routes here
  const routes = [
    '',           // home page
    '/login',
    '/hq',
    '/calendar',
    // Add other static routes as needed
  ]

  return routes.map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }))
} 