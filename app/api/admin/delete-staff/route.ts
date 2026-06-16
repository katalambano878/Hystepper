import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Fully removes a staff member.
 *
 * Deleting only the `staff` row (as the client used to do) leaves the
 * underlying auth login account behind. That orphaned account then blocks
 * re-adding the same email later ("account already exists"), which is exactly
 * the bug this endpoint fixes. We delete the staff row AND the auth user (the
 * profile row cascades from the auth user) using the service role so RLS can't
 * silently block it.
 */
export async function POST(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Staff id is required.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Look up the staff row first so we know which auth user to remove.
    const { data: staffRow, error: lookupError } = await supabaseAdmin
      .from('staff')
      .select('id, user_id, email')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 400 });
    }

    if (!staffRow) {
      return NextResponse.json({ error: 'Staff member not found.' }, { status: 404 });
    }

    // Remove the staff row.
    const { error: deleteStaffError } = await supabaseAdmin
      .from('staff')
      .delete()
      .eq('id', id);

    if (deleteStaffError) {
      return NextResponse.json({ error: deleteStaffError.message }, { status: 400 });
    }

    // Remove the auth login account so the email is freed up for re-use.
    // A missing/already-deleted user shouldn't fail the whole operation.
    if (staffRow.user_id) {
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(staffRow.user_id);
      if (deleteUserError && !/not found/i.test(deleteUserError.message)) {
        return NextResponse.json(
          { error: `Staff row removed, but login account could not be deleted: ${deleteUserError.message}` },
          { status: 207 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
