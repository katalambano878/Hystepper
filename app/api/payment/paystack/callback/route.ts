import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderConfirmation } from '@/lib/notifications';

/**
 * Paystack browser redirect callback.
 *
 * Runs in the customer's tab after they complete payment. The authoritative
 * confirmation path is /api/payment/paystack/webhook (server-to-server). This
 * route stays as a second line of defence: verifies the transaction via
 * Paystack's API, converges on the same mark_order_paid RPC, then redirects
 * the customer to /order-success.
 */
export async function GET(req: Request) {
    const supabase = supabaseAdmin;
    const url = new URL(req.url);
    const baseUrl = url.origin;

    try {
        const reference = url.searchParams.get('reference') || url.searchParams.get('trxref');
        const orderId = url.searchParams.get('order');

        if (!reference) {
            return NextResponse.redirect(new URL('/order-failed?reason=missing_reference', baseUrl));
        }

        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) {
            console.error('[Paystack Callback] Missing PAYSTACK_SECRET_KEY');
            return NextResponse.redirect(new URL('/order-failed?reason=config_error', baseUrl));
        }

        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
        });
        const result = await response.json();
        console.log('[Paystack Callback] Verification:', {
            status: result.status,
            txStatus: result.data?.status,
            amount: result.data?.amount,
            reference,
        });

        if (!(result.status && result.data?.status === 'success')) {
            console.warn('[Paystack Callback] Payment not successful:', result.data?.status, result.message);
            return NextResponse.redirect(
                new URL(`/order-failed?order=${orderId || ''}&reason=payment_failed`, baseUrl)
            );
        }

        const orderRef: string | undefined =
            orderId || result.data.metadata?.order_id;

        if (!orderRef) {
            console.error('[Paystack Callback] No order reference on verified transaction');
            return NextResponse.redirect(new URL('/order-failed?reason=missing_order', baseUrl));
        }

        // Fetch the order to check idempotency + verify the amount. The webhook
        // may already have marked this paid; if so we just redirect.
        const { data: existingOrder, error: fetchError } = await supabase
            .from('orders')
            .select('id, order_number, payment_status, total, metadata')
            .eq('order_number', orderRef)
            .single();

        if (fetchError || !existingOrder) {
            console.error('[Paystack Callback] Order not found:', orderRef);
            return NextResponse.redirect(new URL('/order-failed?reason=order_not_found', baseUrl));
        }

        if (existingOrder.payment_status === 'paid') {
            console.log('[Paystack Callback] Already marked paid (likely by webhook):', orderRef);
            return NextResponse.redirect(
                new URL(`/order-success?order=${orderRef}&payment_success=true`, baseUrl)
            );
        }

        // Amount comes from Paystack in pesewas (GHS * 100). Compare against
        // payable_now for "Pay Item Cost Only" orders, else order.total.
        const paystackAmount = Number(result.data.amount) / 100;
        const payableNow = Number(existingOrder.metadata?.payable_now);
        const expectedAmount =
            Number.isFinite(payableNow) && payableNow > 0
                ? payableNow
                : Number(existingOrder.total);

        if (Math.abs(paystackAmount - expectedAmount) > 0.01) {
            console.error(
                '[Paystack Callback] AMOUNT MISMATCH. Expected:', expectedAmount,
                '| Got:', paystackAmount,
                '| order.total:', existingOrder.total,
                '| payable_now:', payableNow
            );
            return NextResponse.redirect(
                new URL(`/order-failed?order=${orderRef}&reason=amount_mismatch`, baseUrl)
            );
        }

        const { data: updatedOrder, error: rpcError } = await supabase.rpc('mark_order_paid', {
            order_ref: orderRef,
            moolre_ref: String(reference),
        });

        if (rpcError) {
            console.error('[Paystack Callback] RPC error:', rpcError);
            return NextResponse.redirect(
                new URL(`/order-failed?order=${orderRef}&reason=update_failed`, baseUrl)
            );
        }

        // Idempotent fallback for stock decrement; no-op if already flagged.
        if (updatedOrder?.id) {
            const { error: stockError } = await supabase.rpc('decrement_order_stock', {
                order_ref: updatedOrder.id,
            });
            if (stockError) {
                console.error('[Paystack Callback] decrement_order_stock failed:', stockError);
            }
        }

        if (updatedOrder) {
            try {
                await sendOrderConfirmation(updatedOrder);
            } catch (notifyErr: any) {
                console.error(
                    '[Paystack Callback] Notification failed (non-blocking):',
                    notifyErr?.message || notifyErr
                );
            }
        }

        return NextResponse.redirect(
            new URL(`/order-success?order=${orderRef}&payment_success=true`, baseUrl)
        );
    } catch (error: any) {
        console.error('[Paystack Callback] Error:', error);
        return NextResponse.redirect(new URL('/order-failed?reason=verification_error', baseUrl));
    }
}
