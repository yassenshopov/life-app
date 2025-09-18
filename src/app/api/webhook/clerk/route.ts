import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    try {
      const { error } = await supabase.from('users').insert({
        id,
        email: email_addresses[0]?.email_address,
        first_name,
        last_name,
        image_url,
        created_at: new Date(Number(created_at)).toISOString(),
        updated_at: new Date(Number(updated_at)).toISOString(),
      });

      if (error) {
        console.error('Error creating user in Supabase:', error);
        return new Response('Error creating user in Supabase', {
          status: 500,
        });
      }

      return new Response('User created successfully', {
        status: 200,
      });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response('Error processing webhook', {
        status: 500,
      });
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;
    try {
      const { error } = await supabase.from('users').update({ isDeleted: true }).eq('id', id);
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
