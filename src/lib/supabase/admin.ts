// @ts-nocheck
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Only use this on the server — has full DB access bypassing RLS
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
