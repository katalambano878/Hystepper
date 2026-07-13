import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        // Bypass the Navigator LockManager. On mobile Safari, backgrounding the
        // tab can suspend a token refresh while it still holds the browser lock;
        // on return every Supabase call waits on that lock forever and the whole
        // site appears frozen. An immediate-execution lock avoids the deadlock —
        // auth-js tolerates concurrent refreshes via its reuse window.
        lock: async (_name, _acquireTimeout, fn) => await fn(),
    },
});
