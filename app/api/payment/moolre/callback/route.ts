import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendOrderConfirmation } from '@/lib/notifications';

// Ensure we use Service Role Key for admin-level updates (marking paid)
// This bypasses RLS policies which might block 'update' for anonymous users
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function parseBody(req: Request): Promise<Record<string, any>> {
    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    const rawText = await req.text();

    // Always log the raw payload so we can debug Moolre's exact webhook shape.
    console.log('[Moolre Callback] Content-Type:', contentType);
    console.log('[Moolre Callback] Raw body:', rawText);

    if (!rawText) return {};

    if (contentType.includes('application/json')) {
        try { return JSON.parse(rawText); } catch { /* fall through */ }
    }

    if (contentType.includes('x-www-form-urlencoded')) {
        try {
            const params = new URLSearchParams(rawText);
            return Object.fromEntries(params.entries());
        } catch { /* fall through */ }
    }

    // Best-effort fallback: try JSON, then urlencoded.
    try { return JSON.parse(rawText); } catch {
        try {
            const params = new URLSearchParams(rawText);
            const entries = Object.fromEntries(params.entries());
            if (Object.keys(entries).length > 0) return entries;
        } catch { /* ignore */ }
    }

    return {};
}

export async function POST(req: Request) {
    try {
        const body = await parseBody(req);
        console.log('[Moolre Callback] Parsed body:', body);

        // Moolre sometimes nests the payload under `data`.
        const payload: any = body?.data && typeof body.data === 'object' ? { ...body, ...body.data } : body;

        const {
            status,
            txstatus,
            externalref,
            orderRef,
            external_reference,
            reference,
            transactionid,
        } = payload;

        const merchantOrderRef = externalref || orderRef || external_reference;

        if (!merchantOrderRef) {
            console.error('Missing externalref (Order Number) in callback. Body:', body);
            return NextResponse.json({ success: false, message: 'Invalid callback data: Missing order reference' }, { status: 400 });
        }

        // Verify payment success (flexible match across known Moolre shapes)
        const statusStr = String(status ?? '').toLowerCase();
        const txStatusNum = Number(txstatus);
        const isSuccess =
            statusStr === 'success' ||
            statusStr === 'successful' ||
            statusStr === 'completed' ||
            statusStr === 'paid' ||
            status == 1 ||
            statusStr === '1' ||
            txStatusNum === 1;
        const isExplicitFailure = txStatusNum === 2 || statusStr === 'failed' || statusStr === 'failure';

        if (isSuccess) {
            console.log(`Processing successful payment for Order ${merchantOrderRef}, Method: Moolre`);

            // Use RPC to Update Order Status (Works with Anon Key via Security Definer)
            const { data: orderJson, error: updateError } = await supabase
                .rpc('mark_order_paid', {
                    order_ref: merchantOrderRef,
                    moolre_ref: transactionid || reference || 'WEBHOOK'
                });

            if (updateError) {
                console.error('Failed to update order via RPC:', updateError);
                return NextResponse.json({ success: false, message: 'Database update failed' }, { status: 500 });
            }

            if (!orderJson) {
                console.error('Order not found or update returned null:', merchantOrderRef);
                return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
            }

            // Send notification directly
            try {
                console.log('Triggering Order Confirmation Notification...');
                await sendOrderConfirmation(orderJson);
                console.log('Notification trigger completed.');
            } catch (notifyError) {
                console.error('Notification sent failed (Non-blocking):', notifyError);
            }

            return NextResponse.json({ success: true, message: 'Payment verified and Order Updated' });

        } else if (isExplicitFailure) {
            console.log(`Payment explicitly failed for order ${merchantOrderRef}, status: ${status}, txstatus: ${txstatus}`);

            await supabase
                .from('orders')
                .update({
                    payment_status: 'failed',
                    metadata: {
                        moolre_reference: transactionid || reference,
                        failure_reason: payload.message || 'Payment failed',
                    },
                })
                .eq('order_number', merchantOrderRef);

            return NextResponse.json({ success: false, message: 'Payment reported as failed' });
        } else {
            // Unknown / pending — leave the order state alone. Reconcile can retry later.
            console.log(`Payment pending/unknown for order ${merchantOrderRef}, status: ${status}, txstatus: ${txstatus}`);
            return NextResponse.json({ success: true, message: 'Callback received, payment not final' });
        }

    } catch (error: any) {
        console.error('Callback Critical Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    // If Moolre (or a browser redirect) pings with query params, reuse the POST logic
    // by constructing a synthetic POST request.
    const url = new URL(req.url);
    if ([...url.searchParams.keys()].length === 0) {
        return NextResponse.json({ message: 'Moolre callback endpoint ready' });
    }

    console.log('[Moolre Callback] GET params:', Object.fromEntries(url.searchParams.entries()));

    const synthetic = new Request(req.url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: url.searchParams.toString(),
    });
    return POST(synthetic);
}
