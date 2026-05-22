import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendOrderConfirmation } from '@/lib/notifications';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Moolre Callback Payload Shape (verified from live integration):
 * {
 *   "status": 1,                     // API status (request accepted)
 *   "code": "P01",
 *   "message": "Transaction Successful",
 *   "data": {
 *     "txstatus": 1,                 // Transaction status — also seen as "txtstatus" in docs
 *     "payer": "233XXXXXXXXX",
 *     "accountnumber": "1080...",
 *     "amount": "34.96",
 *     "value": "34.96",
 *     "transactionid": "42252702",
 *     "externalref": "ORD-...-R17700...",
 *     "thirdpartyref": "74658410493"
 *   },
 *   "secret": "f619ff6d-...",        // Must match MOOLRE_CALLBACK_SECRET (either here or in data.secret)
 *   "ts": "2026-02-05 22:21:16",
 *   "go": null
 * }
 */

async function parseBody(req: Request): Promise<Record<string, any>> {
    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    const rawText = await req.text();

    console.log('[Moolre Callback] Content-Type:', contentType);
    console.log('[Moolre Callback] Raw body:', rawText?.slice(0, 2000));

    if (!rawText) return {};

    if (contentType.includes('application/json')) {
        try {
            return JSON.parse(rawText);
        } catch {
            /* fall through */
        }
    }

    if (contentType.includes('x-www-form-urlencoded')) {
        try {
            return Object.fromEntries(new URLSearchParams(rawText).entries());
        } catch {
            /* fall through */
        }
    }

    try {
        return JSON.parse(rawText);
    } catch {
        try {
            const entries = Object.fromEntries(new URLSearchParams(rawText).entries());
            if (Object.keys(entries).length > 0) return entries;
        } catch {
            /* ignore */
        }
    }

    return {};
}

export async function POST(req: Request) {
    console.log('[Moolre Callback] Received at', new Date().toISOString());

    try {
        // Callback rate limit is deliberately relaxed — payment providers retry
        // on any non-2xx response and we don't want to drop legitimate retries.
        const clientId = getClientIdentifier(req);
        const rl = checkRateLimit(`moolre-callback:${clientId}`, RATE_LIMITS.callback);
        if (!rl.success) {
            console.warn('[Moolre Callback] Rate limited:', clientId);
            return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });
        }

        const body = await parseBody(req);
        console.log('[Moolre Callback] Body keys:', Object.keys(body).join(', '));

        const data: any = body.data || {};

        // Verify the shared secret. Moolre has been observed sending it at
        // both the top level (body.secret) and nested (body.data.secret) —
        // accept either. Only skipped if the env var is unset.
        const expectedSecret = process.env.MOOLRE_CALLBACK_SECRET;
        const providedSecret = body.secret || data.secret;
        if (expectedSecret) {
            if (!providedSecret || providedSecret !== expectedSecret) {
                console.error(
                    '[Moolre Callback] Secret mismatch or missing. Rejecting.',
                    '| provided present:', !!providedSecret,
                    '| lengths:', providedSecret?.length, 'vs', expectedSecret.length
                );
                return NextResponse.json(
                    { success: false, message: 'Invalid callback signature' },
                    { status: 403 }
                );
            }
        } else {
            console.warn('[Moolre Callback] MOOLRE_CALLBACK_SECRET not configured — skipping signature check.');
        }

        // Normalize the external reference and strip any retry suffix like
        // "-R1770000000" that we add during payment initiation.
        const rawExternalRef =
            data.externalref ||
            data.external_reference ||
            data.orderRef ||
            body.externalref ||
            body.orderRef ||
            body.external_reference;

        const merchantOrderRef: string | undefined = rawExternalRef
            ? String(rawExternalRef).replace(/-R\d+$/, '')
            : data.metadata?.original_order_number || body.metadata?.original_order_number;

        const moolreReference =
            data.transactionid || data.thirdpartyref || body.reference || 'callback';

        const apiStatus = body.status;
        // Live payload uses "txstatus"; some docs say "txtstatus" — accept either.
        const txStatus = data.txstatus ?? data.txtstatus;
        const messageStr = String(body.message || '').toLowerCase();

        console.log(
            '[Moolre Callback] ref:', merchantOrderRef,
            '| API status:', apiStatus,
            '| txstatus:', txStatus,
            '| message:', body.message,
            '| moolre ref:', moolreReference
        );

        if (!merchantOrderRef) {
            console.error('[Moolre Callback] Missing order reference. Body:', JSON.stringify(body).slice(0, 500));
            return NextResponse.json({ success: false, message: 'Missing order reference' }, { status: 400 });
        }

        const apiOk = apiStatus === 1 || apiStatus === '1';
        const txOk = txStatus === 1 || txStatus === '1';
        const messageIndicatesFailure = messageStr.includes('fail') || messageStr.includes('error');
        const isSuccess = (apiOk || txOk) && !messageIndicatesFailure;

        if (isSuccess) {
            console.log(`[Moolre Callback] Payment SUCCESS for ${merchantOrderRef}`);

            const { data: existingOrder, error: fetchError } = await supabaseAdmin
                .from('orders')
                .select('id, order_number, payment_status, total, metadata')
                .eq('order_number', merchantOrderRef)
                .single();

            if (fetchError || !existingOrder) {
                console.error('[Moolre Callback] Order not found:', merchantOrderRef);
                return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
            }

            if (existingOrder.payment_status === 'paid') {
                console.log('[Moolre Callback] Already paid, idempotent skip:', merchantOrderRef);
                return NextResponse.json({ success: true, message: 'Order already processed' });
            }

            // Amount verification. Compare against payable_now (partial-payment
            // orders where delivery is billed on arrival) or total otherwise.
            const callbackAmount =
                data.amount != null
                    ? parseFloat(data.amount)
                    : body.amount != null
                        ? parseFloat(body.amount)
                        : null;
            if (callbackAmount !== null && Number.isFinite(callbackAmount)) {
                const payableNow = Number(existingOrder.metadata?.payable_now);
                const expectedAmount =
                    Number.isFinite(payableNow) && payableNow > 0
                        ? payableNow
                        : Number(existingOrder.total);
                if (Math.abs(callbackAmount - expectedAmount) > 0.01) {
                    console.error(
                        '[Moolre Callback] AMOUNT MISMATCH. Expected:', expectedAmount,
                        '| Got:', callbackAmount,
                        '| order.total:', existingOrder.total,
                        '| payable_now:', payableNow
                    );
                    return NextResponse.json(
                        { success: false, message: 'Payment amount does not match order' },
                        { status: 400 }
                    );
                }
            }

            const { data: orderJson, error: updateError } = await supabaseAdmin.rpc(
                'mark_order_paid',
                {
                    order_ref: merchantOrderRef,
                    moolre_ref: String(moolreReference),
                }
            );

            if (updateError) {
                console.error('[Moolre Callback] RPC error:', updateError);
                return NextResponse.json({ success: false, message: 'Database update failed' }, { status: 500 });
            }

            if (!orderJson) {
                console.error('[Moolre Callback] Order not found after RPC:', merchantOrderRef);
                return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
            }

            console.log('[Moolre Callback] Order updated:', orderJson.order_number, '| status:', orderJson.status);

            // Idempotent fallback in case the inner stock RPC chained from
            // mark_order_paid is ever missed (replica lag, pool routing, etc).
            // decrement_order_stock short-circuits on metadata.stock_reduced.
            if (orderJson?.id) {
                const { error: stockError } = await supabaseAdmin.rpc('decrement_order_stock', {
                    order_ref: orderJson.id,
                });
                if (stockError) {
                    console.error('[Moolre Callback] decrement_order_stock failed:', stockError);
                }
            }

            try {
                await sendOrderConfirmation(orderJson);
            } catch (notifyErr: any) {
                console.error('[Moolre Callback] Notification failed (non-blocking):', notifyErr?.message || notifyErr);
            }

            return NextResponse.json({ success: true, message: 'Payment verified and order updated' });
        }

        // Explicit failure from Moolre
        if (txStatus === 2 || txStatus === '2' || messageIndicatesFailure) {
            console.log(`[Moolre Callback] Payment FAILED for ${merchantOrderRef} | txstatus: ${txStatus}`);

            await supabaseAdmin
                .from('orders')
                .update({
                    payment_status: 'failed',
                    metadata: {
                        moolre_reference: moolreReference,
                        failure_reason: body.message || 'Payment failed',
                    },
                })
                .eq('order_number', merchantOrderRef);

            return NextResponse.json({ success: false, message: 'Payment not successful' });
        }

        // Unknown / pending — leave the order alone; reconcile will retry.
        console.log(`[Moolre Callback] Pending/unknown for ${merchantOrderRef} — no state change`);
        return NextResponse.json({ success: true, message: 'Callback received, payment not final' });
    } catch (error: any) {
        console.error('[Moolre Callback] Critical error:', error);
        return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    if ([...url.searchParams.keys()].length === 0) {
        return NextResponse.json({ message: 'Moolre callback endpoint ready', timestamp: new Date().toISOString() });
    }

    console.log('[Moolre Callback] GET params:', Object.fromEntries(url.searchParams.entries()));

    // If a GET redirect carries the same fields (some Moolre setups do this),
    // reuse the POST handler so we have a single codepath.
    const synthetic = new Request(req.url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: url.searchParams.toString(),
    });
    return POST(synthetic);
}
