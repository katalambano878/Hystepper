import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const reference = url.searchParams.get('reference') || url.searchParams.get('trxref');
        const orderId = url.searchParams.get('order');

        if (!reference) {
            return NextResponse.redirect(new URL('/order-failed?reason=missing_reference', url.origin));
        }

        const secretKey = process.env.PAYSTACK_SECRET_KEY;
        if (!secretKey) {
            console.error('Missing PAYSTACK_SECRET_KEY for verification');
            return NextResponse.redirect(new URL(`/order-failed?reason=config_error`, url.origin));
        }

        // Verify transaction
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                'Authorization': `Bearer ${secretKey}`
            }
        });

        const result = await response.json();
        console.log('Paystack Verification Result:', result);

        // Always redirect back to the same origin the callback arrived on
        const baseUrl = url.origin;

        if (result.status && result.data?.status === 'success') {
            const orderRef = orderId || result.data.metadata?.order_id;

            if (orderRef) {
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({
                        payment_status: 'paid',
                        status: 'processing',
                        metadata: {
                            paystack_reference: reference,
                            paystack_status: 'success',
                            paid_at: new Date().toISOString()
                        }
                    })
                    .eq('order_number', orderRef);

                if (updateError) {
                    console.error('Failed to update order after payment:', updateError);
                }
            }

            return NextResponse.redirect(new URL(`/order-success?order=${orderRef}&payment_success=true`, baseUrl));
        } else {
            console.warn('Paystack payment not successful:', result.data?.status, result.message);
            return NextResponse.redirect(new URL(`/order-failed?order=${orderId}&reason=payment_failed`, baseUrl));
        }

    } catch (error: any) {
        console.error('Paystack Callback Error:', error);
        const url = new URL(req.url);
        return NextResponse.redirect(new URL('/order-failed?reason=verification_error', url.origin));
    }
}
