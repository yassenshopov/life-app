import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

// Create a single supabase client for interacting with your database
export const createClientWithClerk = async () => {
  try {
    const { getToken } = await auth();
    const token = await getToken({ template: 'supabase' });

    if (token) {
      return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      );
    }
  } catch (error) {
    console.warn('Failed to get Clerk token for Supabase, falling back to anon key:', error);
  }

  // Fallback to using the anon key without Clerk token
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};
