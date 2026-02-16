import { NextResponse } from 'next/server';
import { sendOrderConfirmation, sendOrderStatusUpdate, sendWelcomeMessage, sendContactMessage, sendEmail, sendSMS } from '@/lib/notifications';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, payload } = body;

        if (!payload) {
            return NextResponse.json({ error: 'Payload required' }, { status: 400 });
        }

        if (type === 'order_created' || type === 'order_confirmation') {
            await sendOrderConfirmation(payload);
            return NextResponse.json({ success: true, message: 'Order confirmation sent' });
        }

        if (type === 'order_updated') {
            const { order, status } = payload;
            await sendOrderStatusUpdate(order, status);
            return NextResponse.json({ success: true, message: 'Status update sent' });
        }

        if (type === 'welcome') {
            await sendWelcomeMessage(payload);
            return NextResponse.json({ success: true, message: 'Welcome message sent' });
        }

        if (type === 'contact') {
            await sendContactMessage(payload);
            return NextResponse.json({ success: true, message: 'Contact message sent' });
        }

        if (type === 'campaign') {
            const { recipients, subject, message, channels } = payload;

            // recipients is array of { email, phone, name }
            // Basic loop - in production use a queue
            const results = { email: 0, sms: 0 };

            for (const recipient of recipients) {
                if (channels.email && recipient.email) {
                    await sendEmail({
                        to: recipient.email,
                        subject: subject,
                        html: `<h1>${subject}</h1><p>Hi ${recipient.name || 'Customer'},</p><p>${message.replace(/\n/g, '<br/>')}</p>`
                    });
                    results.email++;
                }

                if (channels.sms && recipient.phone) {
                    await sendSMS({
                        to: recipient.phone,
                        message: message
                    });
                    results.sms++;
                }
            }

            return NextResponse.json({ success: true, message: `Campaign sent to ${results.email} emails and ${results.sms} numbers.` });
        }

        return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });

    } catch (error: any) {
        console.error('Notification API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
