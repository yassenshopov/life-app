import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

// Singleton instance for service role client (server-side operations)
let serviceRoleClient: SupabaseClient | null = null;

/**
 * Get a singleton Supabase client with service role key.
 * This should be used for server-side API routes that need elevated permissions.
 * The client is cached to avoid creating multiple connection pools.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient {
  if (!serviceRoleClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    serviceRoleClient = createClient(supabaseUrl, serviceRoleKey);
  }

  return serviceRoleClient;
}

/**
 * Create a Supabase client authenticated with Clerk token.
 * This should be used when you need user-specific authentication.
 * Note: This creates a new client per call because tokens are user-specific.
 */
export const createClientWithClerk = async (): Promise<SupabaseClient> => {
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
