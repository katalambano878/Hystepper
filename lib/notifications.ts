import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'missing_api_key');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@hystepper.com';

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY is missing. Email not sent.');
        return null;
    }
    try {
        const data = await resend.emails.send({
            from: 'Hy_stepper <orders@hystepper.com>', // Updated Sender
            to,
            subject,
            html,
        });
        console.log('Email sent:', data);
        return data;
    } catch (error) {
        console.error('Email Error:', error);
        return null;
    }
}

// ... (keep phone formatter helper same or assume it's same)

// Helper to format phone number for SMS (Ghana specific for now)
function formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters (including + for now)
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0 (e.g. 024...), replace 0 with 233
    if (cleaned.startsWith('0')) {
        cleaned = '233' + cleaned.substring(1);
    }

    // If length is 9 (e.g. 24...), prepend 233
    if (cleaned.length === 9) {
        cleaned = '233' + cleaned;
    }

    // Ensure it starts with correct country code before prepending +
    if (!cleaned.startsWith('233') && cleaned.length === 12) {
        // Assuming it's some other format, but if it starts with 233, it's fine.
    }

    // Return with + prefix as per E.164
    return '+' + cleaned;
}

export async function sendSMS({ to, message }: { to: string; message: string }) {
    // SMS TEMPORARILY DISABLED
    console.log('SMS Service is temporarily disabled. Would have sent:', { to, message });
    return { success: true, message: 'SMS disabled', data: null };

    /*
    // Allow distinct SMS credentials, falling back to payment credentials
    // Note: Moolre SMS might not use PubKey, or might differ from Payment PubKey.
    // Logic: If using custom SMS User, only use custom SMS PubKey (don't fallback to Payment PubKey).
    const isCustomSmsUser = !!process.env.MOOLRE_SMS_API_USER;
    const smsUser = process.env.MOOLRE_SMS_API_USER || process.env.MOOLRE_API_USER;
    const smsVasKey = process.env.MOOLRE_SMS_API_KEY || process.env.MOOLRE_API_KEY;

    let smsPubKey = process.env.MOOLRE_SMS_API_PUBKEY;
    if (!isCustomSmsUser) {
        // If reusing Payment User, reuse Payment PubKey
        smsPubKey = smsPubKey || process.env.MOOLRE_API_PUBKEY;
    }

    if (!smsVasKey || !smsUser) {
        console.warn('Missing Moolre credentials (VASKEY or USER) for SMS.');
        return null;
    }

    const recipient = formatPhoneNumber(to);

    try {
        console.log(`Sending SMS to ${recipient}: ${message}`);
        const response = await fetch('https://api.moolre.com/open/sms/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-VASKEY': smsVasKey,
                'X-API-USER': smsUser,
                'X-API-PUBKEY': smsPubKey || ''
            },
            body: JSON.stringify({
                type: 1,
                senderid: 'Hy_stepper', 
                messages: [
                    {
                        recipient: recipient,
                        message: message
                    }
                ]
            })
        });

        const result = await response.json();
        console.log('SMS Result:', result);
        return result;
    } catch (error) {
        console.error('SMS Error:', error);
        return null;
    }
    */
}

export async function sendOrderConfirmation(order: any) {
    const { id, email, phone: orderPhone, shipping_address, total, created_at, order_number } = order;

    // Try to get name from full_name, then firstName, then fallback
    const name = shipping_address?.full_name || shipping_address?.firstName || 'Customer';

    // Prefer top-level phone, then shipping address phone
    const phone = orderPhone || shipping_address?.phone;

    console.log(`Preparing confirmation for Order #${order_number}. Phone: ${phone}, Name: ${name}`);

    // 1. Email to Customer
    const customerEmailHtml = `
    <h1>Order Confirmation</h1>
    <p>Hi ${name},</p>
    <p>Thank you for your order! We've received it and are getting it ready.</p>
    <p><strong>Order ID:</strong> ${order_number || id}</p>
    <p><strong>Total:</strong> GH₵${total.toFixed(2)}</p>
    <br/>
    <p>We will notify you when your order ships.</p>
  `;

    await sendEmail({
        to: email,
        subject: `Order Confirmation #${order_number || id}`,
        html: customerEmailHtml
    });

    // 2. Email to Admin
    const adminEmailHtml = `
    <h1>New Order Received</h1>
    <p><strong>Order ID:</strong> ${order_number || id}</p>
    <p><strong>Customer:</strong> ${name} (${email})</p>
    <p><strong>Total:</strong> GH₵${total.toFixed(2)}</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/orders/${id}">View Order</a></p>
  `;

    await sendEmail({
        to: ADMIN_EMAIL,
        subject: `New Order #${order_number || id}`,
        html: adminEmailHtml
    });

    // 3. SMS to Customer (if phone exists)
    if (phone) {
        await sendSMS({
            to: phone,
            message: `Hi ${name}, thanks for your order #${order_number || id} at Hy_stepper! We will update you when it ships.`
        });
    }
}

export async function sendOrderStatusUpdate(order: any, newStatus: string) {
    const { id, email, phone: orderPhone, shipping_address, order_number } = order;

    // Consistent name/phone extraction
    const name = shipping_address?.full_name || shipping_address?.firstName || 'Customer';
    const phone = orderPhone || shipping_address?.phone;

    console.log(`Sending status update for Order #${order_number} to ${newStatus}. Phone: ${phone}`);

    const subject = `Order Update #${order_number || id}`;
    let message = `Your order #${order_number || id} status has been updated to ${newStatus}.`;

    if (newStatus === 'shipped') {
        message = `Good news! Your order #${order_number || id} has been shipped and is on its way.`;
    } else if (newStatus === 'delivered') {
        message = `Your order #${order_number || id} has been delivered. Enjoy!`;
    }

    // Email
    await sendEmail({
        to: email,
        subject: subject,
        html: `<h1>Order Update</h1><p>Hi ${name},</p><p>${message}</p>`
    });

    // SMS disabled for status updates — only order confirmation SMS is sent
    // if (phone) {
    //     await sendSMS({ to: phone, message: message });
    // }
}

export async function sendWelcomeMessage(user: { email: string, firstName: string, phone?: string }) {
    const { email, firstName, phone } = user;

    // Email
    await sendEmail({
        to: email,
        subject: `Welcome to Hy_stepper!`,
        html: `
      <h1>Welcome, ${firstName}!</h1>
      <p>Thank you for joining the Hy_stepper family.</p>
      <p>We're thrilled to have you with us. Explore our collection of premium beauty products and enjoy your shopping journey.</p>
      <br/>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/shop">Start Shopping</a>
    `
    });

    // SMS disabled for welcome — only order confirmation SMS is sent
    // if (phone) {
    //     await sendSMS({ to: phone, message: `Welcome ${firstName}! Thanks for joining Hy_stepper.` });
    // }
}

export async function sendContactMessage(data: { name: string, email: string, subject: string, message: string }) {
    const { name, email, subject, message } = data;

    // 1. Acknowledge to User
    await sendEmail({
        to: email,
        subject: `We received your message: ${subject}`,
        html: `
      <p>Hi ${name},</p>
      <p>Thanks for contacting Hy_stepper.</p>
      <p>We have received your message regarding "${subject}" and will get back to you shortly.</p>
    `
    });

    // 2. Alert Admin
    await sendEmail({
        to: ADMIN_EMAIL,
        subject: `Contact: ${subject}`,
        html: `
      <h1>New Contact Message</h1>
      <p><strong>From:</strong> ${name} (${email})</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong></p>
      <p>${message}</p>
    `
    });
}
