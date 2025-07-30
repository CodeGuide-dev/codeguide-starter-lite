import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
* Singleton Supabase client that can be safely imported from **browser** or **server** code.
*
* - Uses the public `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars.
* - Does **not** persist auth sessions – we rely on Clerk-issued JWT for RLS.
* - On the server we just create a fresh client; in the browser we memoize it so that
*   components/hooks share a single instance.
*/
let browserClient: SupabaseClient<Database> | undefined

export function getSupabaseClient(): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    // Server / Edge – always return a new client (no global state)
    return createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
      },
    )
  }

  // Browser – memoize in module scope
  if (!browserClient) {
    browserClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }

  return browserClient
}

export type SupabaseDbClient = SupabaseClient<Database>
