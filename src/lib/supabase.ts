import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs';

// Create a single supabase client for interacting with your database
export const createClientWithClerk = async () => {
  const { getToken } = auth();
  const token = await getToken({ template: 'supabase' });

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
};
