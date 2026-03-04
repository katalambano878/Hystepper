import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { orderId, amount, customerEmail, customerPhone } = body;

        if (!orderId || !amount) {
            return NextResponse.json({ success: false, message: 'Missing orderId or amount' }, { status: 400 });
        }

        const secretKey = process.env.PAYSTACK_SECRET_KEY;

        if (!secretKey) {
            console.error('Missing PAYSTACK_SECRET_KEY');
            return NextResponse.json({ success: false, message: 'Payment gateway configuration error' }, { status: 500 });
        }

        // Always derive the base URL from the actual incoming request so the
        // callback works on every domain (local, staging, production) without
        // needing to update NEXT_PUBLIC_APP_URL.
        const requestUrl = new URL(req.url);
        const baseUrl = requestUrl.origin;

        // Paystack requires a valid email address
        const email = customerEmail && customerEmail.includes('@')
            ? customerEmail
            : `guest-${customerPhone || 'unknown'}@hystepper.com`;

        const payload: any = {
            email,
            amount: Math.round(amount * 100), // Paystack expects amount in pesewas (kobo)
            currency: 'GHS',
            reference: `PAY-${orderId}-${Date.now()}`,
            callback_url: `${baseUrl}/api/payment/paystack/callback?order=${orderId}`,
            metadata: {
                order_id: orderId,
                customer_phone: customerPhone,
            }
        };

        console.log('Initiating Paystack Payment:', payload);

        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${secretKey}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('Paystack Response:', result);

        if (result.status && result.data?.authorization_url) {
            return NextResponse.json({
                success: true,
                url: result.data.authorization_url,
                reference: result.data.reference,
                access_code: result.data.access_code
            });
        } else {
            return NextResponse.json({
                success: false,
                message: result.message || 'Failed to initialize payment'
            }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Paystack Payment API Error:', error);
        return NextResponse.json({ success: false, message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
