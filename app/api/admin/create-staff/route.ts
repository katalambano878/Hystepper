import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, full_name, role, permissions, password } = await request.json();

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Email, name and password are required.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    // Use service role key to create user without email confirmation
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create auth account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // Skip email confirmation
      user_metadata: { full_name },
    });

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user?.id;

    // Insert staff record linked to the auth user
    const { error: staffError } = await supabaseAdmin.from('staff').insert({
      user_id: userId,
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      role,
      permissions,
    });

    if (staffError) {
      // Roll back: delete the auth user we just created
      if (userId) await supabaseAdmin.auth.admin.deleteUser(userId);
      if (staffError.message.includes('unique')) {
        return NextResponse.json({ error: 'A staff member with that email already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: staffError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
