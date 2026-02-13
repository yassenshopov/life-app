import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase';

const supabase = getSupabaseServiceRoleClient();

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '');

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400,
    });
  }

  // Handle the webhook
  const eventType = evt.type;

  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, image_url, created_at, updated_at } =
      evt.data;

    const primaryEmail = email_addresses?.find((e: { id: string }) => e.id === evt.data.primary_email_address_id)?.email_address
      ?? email_addresses?.[0]?.email_address;

    const row = {
      id,
      email: primaryEmail ?? null,
      first_name: first_name ?? null,
      last_name: last_name ?? null,
      image_url: image_url ?? null,
      created_at: created_at ? new Date(Number(created_at)).toISOString() : undefined,
      updated_at: updated_at ? new Date(Number(updated_at)).toISOString() : undefined,
      notion_databases: [],
      isdeleted: false,
    };

    try {
      const { error } = await supabase
        .from('users')
        .upsert(row, { onConflict: 'id' });

      if (error) {
        const body = JSON.stringify({
          error: 'Error creating user in Supabase',
          code: error.code,
          message: error.message,
          details: error.details,
        });
        console.error('Clerk webhook: Supabase upsert failed', { userId: id, code: error.code, message: error.message, details: error.details });
        return new Response(body, {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('User created successfully', {
        status: 200,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : err instanceof Error && err.cause ? String(err.cause) : null;
      console.error('Clerk webhook: Error processing user.created', { message, cause, err });
      return new Response(
        JSON.stringify({
          error: 'Error processing webhook',
          message,
          cause: cause ?? undefined,
          hint: 'If message is "fetch failed", check production env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and that the deployment can reach Supabase.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;
    try {
      const { error } = await supabase.from('users').update({ isdeleted: true }).eq('id', id);
      if (error) {
        console.error('Error updating user as deleted in Supabase:', error);
        return new Response('Error updating user as deleted in Supabase', {
          status: 500,
        });
      }
      return new Response('User marked as deleted successfully', {
        status: 200,
      });
    } catch (error) {
      console.error('Error processing user.deleted webhook:', error);
      return new Response('Error processing user.deleted webhook', {
        status: 500,
      });
    }
  }

  // Return a 200 response for other event types
  return new Response('Webhook received', {
    status: 200,
  });
}
