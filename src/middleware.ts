import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define which routes are public
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/webhook/clerk',
  '/api/webhooks/notion', // Notion webhook (no auth; verified via NOTION_WEBHOOK_SECRET)
  '/api/notion/daily-tracking',
  '/api/spotify/callback',
  '/api/google-calendar/callback',
  '/login',
  '/signup',
  '/pricing',
]);

export default clerkMiddleware((auth, req) => {
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    auth.protect();
  }
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
