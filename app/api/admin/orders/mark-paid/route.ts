import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendOrderConfirmation } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const { orderNumber, reference } = await request.json();

    if (!orderNumber) {
      return NextResponse.json({ error: 'orderNumber is required.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabaseAdmin.rpc('mark_order_paid', {
      order_ref: orderNumber,
      moolre_ref: reference || 'ADMIN-RECONCILE',
    });

    if (error) {
      console.error('mark_order_paid RPC failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Fire-and-forget confirmation notification (non-blocking)
    sendOrderConfirmation(data).catch((err) => {
      console.error('sendOrderConfirmation failed (non-blocking):', err);
    });

    return NextResponse.json({ success: true, order: data });
  } catch (err: any) {
    console.error('mark-paid endpoint error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
