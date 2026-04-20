import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendOrderConfirmation } from '@/lib/notifications';

/**
 * Reconcile a Moolre payment by querying Moolre's /open/transact/status endpoint
 * and updating the order based on what Moolre reports.
 *
 * Safe to expose publicly because we never mark an order paid unless Moolre
 * itself returns txstatus === 1 for it.
 *
 * Body: { orderNumber: string }
 *
 * Response: {
 *   success: boolean,
 *   status: 'paid' | 'failed' | 'pending' | 'unknown',
 *   message: string,
 *   order?: any,
 *   moolre?: any,
 * }
 */
export async function POST(req: Request) {
  try {
    const { orderNumber } = await req.json();

    if (!orderNumber) {
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
      .select('order_number, payment_status, payment_method, metadata')
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
    const accountNumber = process.env.MOOLRE_ACCOUNT_NUMBER;

    if (!apiUser || !apiPubKey || !accountNumber) {
      return NextResponse.json(
        { success: false, status: 'unknown', message: 'Moolre credentials missing' },
        { status: 500 }
      );
    }

    const moolreReference: string | undefined = order.metadata?.moolre_reference;

    // Build the set of IDs to try: saved Moolre reference first, then our order_number.
    const candidates: Array<{ id: string; label: string }> = [];
    if (moolreReference) candidates.push({ id: moolreReference, label: 'moolre_reference' });
    candidates.push({ id: orderNumber, label: 'order_number' });

    let moolreData: any = null;
    let lastResponse: any = null;

    for (const { id, label } of candidates) {
      try {
        const resp = await fetch('https://api.moolre.com/open/transact/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-USER': apiUser,
            'X-API-PUBKEY': apiPubKey,
          },
          body: JSON.stringify({
            type: 1,
            idtype: 1,
            id,
            accountnumber: accountNumber,
          }),
        });

        const json = await resp.json();
        lastResponse = { lookup: label, json };
        console.log(`[Moolre Reconcile] ${orderNumber} via ${label}=${id}:`, json);

        if (json?.status === 1 && json?.data) {
          moolreData = json.data;
          break;
        }
      } catch (err) {
        console.error('[Moolre Reconcile] fetch failed:', err);
      }
    }

    if (!moolreData) {
      return NextResponse.json({
        success: false,
        status: 'unknown',
        message: 'Could not find this payment on Moolre yet. Try again in a moment.',
        moolre: lastResponse,
      });
    }

    const txstatus = Number(moolreData.txstatus);

    if (txstatus === 1) {
      const { data: updated, error: rpcErr } = await admin.rpc('mark_order_paid', {
        order_ref: orderNumber,
        moolre_ref: moolreData.transactionid || moolreReference || 'RECONCILED',
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

      // Fire-and-forget confirmation
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

    if (txstatus === 2) {
      await admin
        .from('orders')
        .update({
          payment_status: 'failed',
          metadata: {
            ...(order.metadata || {}),
            moolre_reference: moolreData.transactionid || moolreReference,
            failure_reason: moolreData.message || 'Moolre reported transaction failed',
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
      moolre: moolreData,
    });
  } catch (err: any) {
    console.error('[Moolre Reconcile] critical error:', err);
    return NextResponse.json(
      { success: false, status: 'unknown', message: err.message || 'Server error' },
      { status: 500 }
    );
  }
}
