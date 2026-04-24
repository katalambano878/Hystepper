import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Initiate a Moolre payment. This mirrors standardecom's proven shape:
 *  - The amount is always taken from the DB (never trust the client).
 *  - externalref is `<order_number>-R<timestamp>` so repeat attempts are unique.
 *  - The callback strips the `-R<ts>` suffix to find the real order.
 */
export async function POST(req: Request) {
    try {
        const clientId = getClientIdentifier(req);
        const rl = checkRateLimit(`moolre-init:${clientId}`, RATE_LIMITS.payment);
        if (!rl.success) {
            return NextResponse.json(
                { success: false, message: 'Too many payment attempts. Please wait a moment.' },
                { status: 429 }
            );
        }

        const body = await req.json();
        const { orderId, customerEmail, redirectUrl } = body;

        if (!orderId || typeof orderId !== 'string') {
            return NextResponse.json({ success: false, message: 'Missing or invalid orderId' }, { status: 400 });
        }

        if (!process.env.MOOLRE_API_USER || !process.env.MOOLRE_API_PUBKEY || !process.env.MOOLRE_ACCOUNT_NUMBER) {
            console.error('[Payment] Missing Moolre credentials');
            return NextResponse.json({ success: false, message: 'Payment gateway configuration error' }, { status: 500 });
        }

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
        const query = supabaseAdmin
            .from('orders')
            .select('id, order_number, total, email, payment_status, metadata');

        const { data: order, error: orderError } = isUUID
            ? await query.eq('id', orderId).single()
            : await query.eq('order_number', orderId).single();

        if (orderError || !order) {
            console.error('[Payment] Order not found:', orderId);
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        if (order.payment_status === 'paid') {
            return NextResponse.json({ success: false, message: 'Order is already paid' }, { status: 400 });
        }

        // Partial-payment aware: if the order was placed with "Pay Item Cost Only",
        // the checkout stores the amount actually due now in metadata.payable_now.
        // Fall back to order.total for full-payment orders or legacy records.
        const payableNow = Number(order.metadata?.payable_now);
        const amount =
            Number.isFinite(payableNow) && payableNow > 0 ? payableNow : Number(order.total);
        if (!amount || amount <= 0) {
            return NextResponse.json({ success: false, message: 'Invalid order amount' }, { status: 400 });
        }

        const orderRef = order.order_number || orderId;

        const requestUrl = new URL(req.url);
        const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin).replace(/\/+$/, '');

        const defaultRedirectUrl = `${baseUrl}/order-success?order=${orderRef}&payment_success=true`;
        const allowedPrefixes = ['https://'];
        const safeRedirectUrl =
            typeof redirectUrl === 'string' &&
                allowedPrefixes.some((prefix) => redirectUrl.startsWith(prefix))
                ? redirectUrl
                : defaultRedirectUrl;

        const uniqueRef = `${orderRef}-R${Date.now()}`;

        const payload = {
            type: 1,
            amount: amount.toString(),
            email: process.env.MOOLRE_MERCHANT_EMAIL || 'info@hystepper.com',
            externalref: uniqueRef,
            callback: `${baseUrl}/api/payment/moolre/callback`,
            redirect: safeRedirectUrl,
            reusable: '0',
            currency: 'GHS',
            accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
            metadata: {
                customer_email: customerEmail || order.email,
                original_order_number: orderRef,
            },
        };

        console.log('[Payment] Initiating for order:', orderRef, '| Amount:', amount, '| Callback:', payload.callback);

        const response = await fetch('https://api.moolre.com/embed/link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-USER': process.env.MOOLRE_API_USER,
                'X-API-PUBKEY': process.env.MOOLRE_API_PUBKEY,
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();
        console.log('[Payment] Moolre status:', result.status, '| has URL:', !!result.data?.authorization_url);

        if (result.status === 1 && result.data?.authorization_url) {
            return NextResponse.json({
                success: true,
                url: result.data.authorization_url,
                reference: result.data.reference,
                externalRef: uniqueRef,
            });
        } else {
            console.error('[Payment] Moolre rejected request:', result);
            return NextResponse.json(
                { success: false, message: result.message || 'Failed to generate payment link', moolre: result },
                { status: 400 }
            );
        }
    } catch (error: any) {
        console.error('[Payment] API error:', error);
        return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
