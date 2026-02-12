import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Minimal user row shape that satisfies typical NOT NULL columns.
 * Matches what the Clerk webhook inserts so the table accepts it.
 */
const minimalUserRow = (userId: string) => ({
  id: userId,
  email: null as string | null,
  first_name: null as string | null,
  last_name: null as string | null,
  image_url: null as string | null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  notion_databases: [] as unknown[],
});

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

  const row = minimalUserRow(userId);

  // Try insert first (clearer for new users); on conflict do nothing
  const { error: insertError } = await supabase.from('users').insert(row);

  if (!insertError) return true;

  // If duplicate key, someone else created the row - we're good
  if (insertError.code === '23505') return true;

  // Otherwise try upsert (in case insert failed due to missing columns)
  const { error: upsertError } = await supabase.from('users').upsert(row, {
    onConflict: 'id',
  });

  if (upsertError) {
    console.error('ensureUserExists: failed to create user', userId, {
      code: upsertError.code,
      message: upsertError.message,
      details: upsertError.details,
    });
    return false;
  }
  return true;
}
