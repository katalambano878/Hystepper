import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendOrderConfirmation } from '@/lib/notifications';

/**
 * Reconcile a Moolre payment by asking Moolre directly via /embed/status.
 * The order is only marked paid when Moolre's API confirms success — we never
 * trust the client's say-so.
 *
 * Body: { orderNumber: string }
 */
export async function POST(req: Request) {
  try {
    const { orderNumber } = await req.json();

    if (!orderNumber || typeof orderNumber !== 'string') {
      return NextResponse.json(
        { success: false, status: 'unknown', message: 'orderNumber is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, status: 'unknown', message: 'Server misconfigured' },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order, error: lookupError } = await admin
      .from('orders')
      .select('id, order_number, payment_status, payment_method, total, metadata')
      .eq('order_number', orderNumber)
      .single();

    if (lookupError || !order) {
      return NextResponse.json(
        { success: false, status: 'unknown', message: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({
        success: true,
        status: 'paid',
        message: 'Order already marked as paid',
      });
    }

    const apiUser = process.env.MOOLRE_API_USER;
    const apiPubKey = process.env.MOOLRE_API_PUBKEY;
    if (!apiUser || !apiPubKey) {
      return NextResponse.json(
        { success: false, status: 'unknown', message: 'Moolre credentials missing' },
        { status: 500 }
      );
    }

    // Moolre's verify endpoint: POST /embed/status with { externalref }
    console.log('[Moolre Reconcile] Verifying', orderNumber);

    let moolreJson: any = null;
    try {
      const resp = await fetch('https://api.moolre.com/embed/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-USER': apiUser,
          'X-API-PUBKEY': apiPubKey,
        },
        body: JSON.stringify({ externalref: orderNumber }),
      });
      moolreJson = await resp.json();
      console.log('[Moolre Reconcile] Response:', JSON.stringify(moolreJson).slice(0, 500));
    } catch (err) {
      console.error('[Moolre Reconcile] fetch failed:', err);
      return NextResponse.json(
        { success: false, status: 'unknown', message: 'Could not reach Moolre' },
        { status: 502 }
      );
    }

    if (!moolreJson || moolreJson.status !== 1 || !moolreJson.data) {
      return NextResponse.json({
        success: false,
        status: 'unknown',
        message: moolreJson?.message || 'Could not find this payment on Moolre yet. Try again in a moment.',
      });
    }

    const data = moolreJson.data;
    const statusStr = String(data.status || '').toLowerCase();
    const isPaid =
      statusStr === 'success' ||
      statusStr === 'successful' ||
      statusStr === 'completed' ||
      statusStr === 'paid';

    const isFailed =
      statusStr === 'failed' ||
      statusStr === 'failure' ||
      statusStr === 'declined';

    if (isPaid) {
      // Verify amount matches order total
      if (data.amount != null) {
        const paidAmount = parseFloat(data.amount);
        const expectedAmount = Number(order.total);
        if (Number.isFinite(paidAmount) && Math.abs(paidAmount - expectedAmount) > 0.01) {
          console.error('[Moolre Reconcile] Amount mismatch. Expected:', expectedAmount, 'Got:', paidAmount);
          return NextResponse.json(
            {
              success: false,
              status: 'unknown',
              message: 'Payment amount does not match order total',
            },
            { status: 400 }
          );
        }
      }

      const { data: updated, error: rpcErr } = await admin.rpc('mark_order_paid', {
        order_ref: orderNumber,
        moolre_ref: data.transactionid || data.reference || 'RECONCILED',
      });

      if (rpcErr) {
        console.error('[Moolre Reconcile] mark_order_paid failed:', rpcErr);
        return NextResponse.json(
          {
            success: false,
            status: 'unknown',
            message: 'Verified with Moolre but could not update order',
          },
          { status: 500 }
        );
      }

      if (updated) {
        sendOrderConfirmation(updated).catch((err) => {
          console.error('[Moolre Reconcile] notification failed (non-blocking):', err);
        });
      }

      return NextResponse.json({
        success: true,
        status: 'paid',
        message: 'Verified with Moolre and marked as paid',
        order: updated,
      });
    }

    if (isFailed) {
      await admin
        .from('orders')
        .update({
          payment_status: 'failed',
          metadata: {
            ...(order.metadata || {}),
            moolre_reference: data.transactionid || data.reference,
            failure_reason: data.message || 'Moolre reported transaction failed',
            reconciled_at: new Date().toISOString(),
          },
        })
        .eq('order_number', orderNumber);

      return NextResponse.json({
        success: true,
        status: 'failed',
        message: 'Moolre reports payment failed',
      });
    }

    return NextResponse.json({
      success: true,
      status: 'pending',
      message: 'Moolre reports payment is still pending',
    });
  } catch (err: any) {
    console.error('[Moolre Reconcile] critical error:', err);
    return NextResponse.json(
      { success: false, status: 'unknown', message: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
