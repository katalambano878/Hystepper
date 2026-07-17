/**
 * Server-side admin client — plain Postgres via the supabase-js compatibility
 * layer (bypasses RLS the same way the old service-role key did).
 * ONLY import from API routes / server components / server actions.
 */
import { createClient, type SupabaseCompatClient } from "@/server/db/supabase-compat";

let _admin: SupabaseCompatClient | null = null;

export function getSupabaseAdmin(): SupabaseCompatClient {
  if (!_admin) _admin = createClient();
  return _admin;
}

/** Lazy singleton matching the previous `supabaseAdmin` export shape. */
export const supabaseAdmin = new Proxy({} as SupabaseCompatClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
