import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ensures a user row exists in Supabase for the given Clerk userId.
 * If the user was never created (e.g. Clerk webhook didn't run in production),
 * inserts a minimal row so API routes that look up the user can succeed.
 */
export async function ensureUserExists(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (data) return true;

  const { error } = await supabase.from('users').upsert(
    {
      id: userId,
      notion_databases: [],
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('ensureUserExists: failed to create user', userId, error);
    return false;
  }
  return true;
}
