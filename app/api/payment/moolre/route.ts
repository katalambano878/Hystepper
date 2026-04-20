import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { orderId, amount, customerEmail } = body;

        if (!orderId || !amount) {
            return NextResponse.json({ success: false, message: 'Missing orderId or amount' }, { status: 400 });
        }

        if (!process.env.MOOLRE_API_USER || !process.env.MOOLRE_API_PUBKEY || !process.env.MOOLRE_ACCOUNT_NUMBER) {
            console.error('Missing Moolre credentials');
            return NextResponse.json({ success: false, message: 'Payment gateway configuration error' }, { status: 500 });
        }

        const requestUrl = new URL(req.url);
        const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;
        const baseUrl = rawBaseUrl.replace(/\/+$/, '');

        // Moolre Payload
        const payload = {
            type: 1,
            amount: amount.toString(), // Ensure string
            email: process.env.MOOLRE_MERCHANT_EMAIL || 'hystepper2@gmail.com', // Business email
            externalref: orderId,
            callback: `${baseUrl}/api/payment/moolre/callback`,
            redirect: `${baseUrl}/order-success?order=${orderId}&payment_success=true`,
            reusable: "0",
            currency: "GHS",
            accountnumber: process.env.MOOLRE_ACCOUNT_NUMBER,
            metadata: {
                customer_email: customerEmail
            }
        };

        console.log('Initiating Moolre Payment:', payload);

        const response = await fetch('https://api.moolre.com/embed/link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-USER': process.env.MOOLRE_API_USER,
                'X-API-PUBKEY': process.env.MOOLRE_API_PUBKEY
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('Moolre Response:', result);

        if (result.status === 1 && result.data?.authorization_url) {
            const moolreReference = result.data.reference;

            // Persist the Moolre reference on the order so reconcile/verify can find it later.
            try {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
                const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
                const admin = createClient(supabaseUrl, supabaseKey);

                const { data: existing } = await admin
                    .from('orders')
                    .select('metadata')
                    .eq('order_number', orderId)
                    .single();

                const mergedMeta = {
                    ...(existing?.metadata || {}),
                    moolre_reference: moolreReference,
                    moolre_initiated_at: new Date().toISOString(),
                };

                await admin
                    .from('orders')
                    .update({ metadata: mergedMeta })
                    .eq('order_number', orderId);
            } catch (persistErr) {
                console.error('Failed to persist Moolre reference (non-blocking):', persistErr);
            }

            return NextResponse.json({ success: true, url: result.data.authorization_url, reference: moolreReference });
        } else {
            console.error('Moolre rejected request:', { payload, result });
            return NextResponse.json(
                {
                    success: false,
                    message: result.message || result.error || 'Failed to generate payment link',
                    moolre: result,
                },
                { status: 400 }
            );
        }

    } catch (error: any) {
        console.error('Payment API Error:', error);
        return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
