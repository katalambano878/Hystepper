import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client with the service role key.
 * ONLY import this in API routes / server actions — never in client
 * components. It bypasses RLS, so always authorize the caller first.
 *
 * Exported as a lazy singleton so hot-reload and serverless cold-starts
 * don't spin up dozens of clients.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
    // Fail loud at import time in dev — in prod Vercel surfaces the env too.
    console.error('[supabaseAdmin] Missing NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseServiceKey) {
    console.error(
        '[supabaseAdmin] CRITICAL: Missing SUPABASE_SERVICE_ROLE_KEY — privileged operations will fail'
    );
}

export const supabaseAdmin = createClient(
    supabaseUrl || '',
    supabaseServiceKey || '',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);
