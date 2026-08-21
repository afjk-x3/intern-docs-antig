import 'server-only';
import { createClient } from '@supabase/supabase-js';

// This client uses the service role key and MUST NOT be used in client components
// or leaked to the frontend. It is meant exclusively for server actions that need
// administrative privileges, such as inviting users.
export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase admin environment variables');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  );
}
