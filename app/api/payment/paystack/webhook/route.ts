import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { sendOrderConfirmation } from '@/lib/notifications';

/**
 * Paystack server-to-server webhook.
 *
 * This is the authoritative confirmation path — fires even if the customer
 * closes their tab before the browser callback runs. The /callback route
 * remains as a second line of defence for the redirect flow.
 *
 * Security:
 *  - HMAC-SHA512 of the raw body using PAYSTACK_SECRET_KEY must match
 *    the x-paystack-signature header, exactly as Paystack computes it.
 *  - Amount is verified against metadata.payable_now (for "Pay Item
 *    Cost Only" orders) or order.total for full payments.
 *
 * Idempotent:
 *  - Orders already flagged payment_status = 'paid' short-circuit.
 *  - mark_order_paid RPC is the single writer; both webhook and callback
 *    converge on it so duplicate deliveries do not double-notify.
 */
export async function POST(req: Request) {
  console.log('[Paystack Webhook] Received at', new Date().toISOString());

  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error('[Paystack Webhook] PAYSTACK_SECRET_KEY not configured');
      return NextResponse.json(
        { success: false, message: 'Server misconfigured' },
        { status: 500 }
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    const computed = crypto
      .createHmac('sha512', secretKey)
      .update(rawBody)
      .digest('hex');

    // Constant-time compare to avoid timing attacks.
    const sigMatches =
      signature.length === computed.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));

    if (!sigMatches) {
      console.error('[Paystack Webhook] Signature mismatch. Rejecting.');
      return NextResponse.json(
        { success: false, message: 'Invalid signature' },
        { status: 403 }
      );
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    console.log(
      '[Paystack Webhook] Event:',
      event.event,
      '| reference:',
      event.data?.reference
    );

    // Paystack fires many event types; we only mark orders paid on charge.success.
    if (event.event !== 'charge.success') {
      return NextResponse.json({ success: true, message: 'Event ignored' });
    }

    const data = event.data || {};
    if (data.status !== 'success') {
      return NextResponse.json({
        success: true,
        message: 'Charge status not successful, ignoring',
      });
    }

    // Extract order reference. We set metadata.order_id during initiation,
    // but also handle our canonical reference format `PAY-<orderNumber>-<ts>`.
    const orderRef: string | undefined =
      data.metadata?.order_id ||
      (typeof data.reference === 'string'
        ? data.reference.replace(/^PAY-/, '').replace(/-\d+$/, '')
        : undefined);

    if (!orderRef) {
      console.error('[Paystack Webhook] Could not determine order reference');
      return NextResponse.json(
        { success: false, message: 'Missing order reference' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: existingOrder, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, payment_status, total, metadata')
      .eq('order_number', orderRef)
      .single();

    if (fetchError || !existingOrder) {
      console.error('[Paystack Webhook] Order not found:', orderRef);
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }

    if (existingOrder.payment_status === 'paid') {
      console.log('[Paystack Webhook] Already paid, idempotent skip:', orderRef);
      return NextResponse.json({ success: true, message: 'Order already processed' });
    }

    // Paystack reports amount in the smallest currency unit (pesewas for GHS,
    // i.e. value * 100). Compare against payable_now for partial payments,
    // else fall back to order.total.
    const paystackAmount = Number(data.amount) / 100;
    const payableNow = Number(existingOrder.metadata?.payable_now);
    const expectedAmount =
      Number.isFinite(payableNow) && payableNow > 0
        ? payableNow
        : Number(existingOrder.total);

    if (!Number.isFinite(paystackAmount) || paystackAmount <= 0) {
      console.error('[Paystack Webhook] Invalid amount on event:', data.amount);
      return NextResponse.json(
        { success: false, message: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (Math.abs(paystackAmount - expectedAmount) > 0.01) {
      console.error(
        '[Paystack Webhook] AMOUNT MISMATCH. Expected:', expectedAmount,
        '| Got:', paystackAmount,
        '| order.total:', existingOrder.total,
        '| payable_now:', payableNow
      );
      return NextResponse.json(
        { success: false, message: 'Payment amount does not match order' },
        { status: 400 }
      );
    }

    const { data: updatedOrder, error: rpcError } = await supabaseAdmin.rpc(
      'mark_order_paid',
      {
        order_ref: orderRef,
        moolre_ref: String(data.reference || 'paystack'),
      }
    );

    if (rpcError) {
      console.error('[Paystack Webhook] RPC error:', rpcError);
      return NextResponse.json(
        { success: false, message: 'Database update failed' },
        { status: 500 }
      );
    }

    console.log(
      '[Paystack Webhook] Order marked paid:',
      orderRef,
      '| ref:',
      data.reference
    );

    if (updatedOrder) {
      try {
        await sendOrderConfirmation(updatedOrder);
      } catch (notifyErr: any) {
        console.error(
          '[Paystack Webhook] Notification failed (non-blocking):',
          notifyErr?.message || notifyErr
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment verified and order updated',
    });
  } catch (err: any) {
    console.error('[Paystack Webhook] Critical error:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Paystack webhook endpoint ready',
    timestamp: new Date().toISOString(),
  });
}
