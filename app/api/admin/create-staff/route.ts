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

    const cleanEmail = email.trim().toLowerCase();

    // Create auth account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true, // Skip email confirmation
      user_metadata: { full_name },
    });

    let userId = authData?.user?.id;
    // Only auth users we create in this request may be rolled back on failure;
    // a reused orphan account must be left intact.
    let createdFreshUser = !authError && !!userId;

    if (authError) {
      const alreadyExists =
        authError.message.includes('already registered') ||
        authError.message.includes('already exists') ||
        authError.message.toLowerCase().includes('email');

      if (!alreadyExists) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }

      // An auth account with this email already exists. It might be an orphan
      // left behind by an old delete that only removed the staff row. Find it,
      // and if there's no staff row attached, repair it (reset password +
      // metadata) and reuse it. If a staff row IS attached, it's a genuine
      // duplicate and we reject.
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', cleanEmail)
        .maybeSingle();

      const existingUserId = existingProfile?.id;

      if (!existingUserId) {
        // Email is taken in auth but we can't resolve the id to repair it.
        return NextResponse.json({ error: 'An account with that email already exists.' }, { status: 409 });
      }

      const { data: existingStaff } = await supabaseAdmin
        .from('staff')
        .select('id')
        .eq('user_id', existingUserId)
        .maybeSingle();

      if (existingStaff) {
        return NextResponse.json({ error: 'A staff member with that email already exists.' }, { status: 409 });
      }

      // Orphaned login account — reset its password & name, then reuse it.
      const { error: repairError } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
        password,
        user_metadata: { full_name },
      });
      if (repairError) {
        return NextResponse.json({ error: repairError.message }, { status: 400 });
      }

      userId = existingUserId;
      createdFreshUser = false;
    }

    // Insert staff record linked to the auth user
    const { error: staffError } = await supabaseAdmin.from('staff').insert({
      user_id: userId,
      email: email.trim().toLowerCase(),
      full_name: full_name.trim(),
      role,
      permissions,
    });

    if (staffError) {
      // Roll back only if we created the auth user in this request; a reused
      // orphan account must not be deleted as a side effect.
      if (userId && createdFreshUser) await supabaseAdmin.auth.admin.deleteUser(userId);
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
