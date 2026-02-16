import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendOrderConfirmation } from '@/lib/notifications';

// Ensure we use Service Role Key for admin-level updates (marking paid)
// This bypasses RLS policies which might block 'update' for anonymous users
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
    try {
        let body: any = {};
        const contentType = req.headers.get('content-type') || '';

        // Robust Body Parsing (JSON vs Form Data)
        try {
            if (contentType.includes('application/json')) {
                body = await req.json();
            } else if (contentType.includes('form')) { // x-www-form-urlencoded or multipart
                const formData = await req.formData();
                body = Object.fromEntries(formData.entries());
            } else {
                // Fallback: Try JSON, then text ignoring errors
                try {
                    body = await req.json();
                } catch {
                    console.warn('Could not parse callback body as JSON, ignoring.');
                }
            }
        } catch (parseError) {
            console.error('Body parsing failed:', parseError);
            return NextResponse.json({ success: false, message: 'Invalid Request Body' }, { status: 400 });
        }

        console.log('Moolre Callback Received:', body);

        const {
            status,
            externalref, // This is our orderNumber
            orderRef, // Alternate key?
            external_reference, // Alternate key?
            reference,   // Moolre's reference
        } = body;

        // Determine the correct merchant order reference
        const merchantOrderRef = externalref || orderRef || external_reference;

        if (!merchantOrderRef) {
            console.error('Missing externalref (Order Number) in callback. Body:', body);
            return NextResponse.json({ success: false, message: 'Invalid callback data: Missing order reference' }, { status: 400 });
        }

        // Verify payment success (flexible match: case-insensitive string or number 1)
        const statusStr = String(status || '').toLowerCase();
        const isSuccess =
            statusStr === 'success' ||
            statusStr === 'successful' ||
            statusStr === 'completed' ||
            statusStr === 'paid' ||
            status == 1 ||
            statusStr === '1';

        if (isSuccess) {
            console.log(`Processing successful payment for Order ${merchantOrderRef}, Method: Moolre`);

            // Use RPC to Update Order Status (Works with Anon Key via Security Definer)
            const { data: orderJson, error: updateError } = await supabase
                .rpc('mark_order_paid', {
                    order_ref: merchantOrderRef,
                    moolre_ref: reference
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

        } else {
            // Payment failed or pending
            console.log(`Payment failed/pending for order ${merchantOrderRef}, status: ${status}`);

            await supabase
                .from('orders')
                .update({
                    payment_status: 'failed',
                    metadata: {
                        moolre_reference: reference,
                        failure_reason: body.message || 'Payment failed'
                    }
                })
                .eq('order_number', merchantOrderRef);

            return NextResponse.json({ success: false, message: 'Payment reported as not successful' });
        }

    } catch (error: any) {
        console.error('Callback Critical Error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function GET(req: Request) {
    return NextResponse.json({ message: 'Moolre callback endpoint ready' });
}
