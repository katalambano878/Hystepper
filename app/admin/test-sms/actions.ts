'use server';

import { sendSMS } from '@/lib/notifications';

export async function testSmsAction(phone: string, message: string) {
    try {
        console.log('Testing SMS to:', phone);

        // Capture environment state for debugging
        const envDebug = {
            MOOLRE_SMS_API_USER: process.env.MOOLRE_SMS_API_USER ? 'Set' : 'Unset',
            MOOLRE_SMS_API_KEY: process.env.MOOLRE_SMS_API_KEY ? 'Set' : 'Unset',
            MOOLRE_SMS_API_PUBKEY: process.env.MOOLRE_SMS_API_PUBKEY ? 'Set' : 'Unset',
            MOOLRE_API_USER: process.env.MOOLRE_API_USER ? 'Set' : 'Unset',
            MOOLRE_API_PUBKEY: process.env.MOOLRE_API_PUBKEY ? 'Set' : 'Unset',
            MOOLRE_API_KEY: process.env.MOOLRE_API_KEY ? 'Set' : 'Unset',
        };

        const result = await sendSMS({ to: phone, message });

        return {
            success: !!result,
            result,
            envOfServer: envDebug
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
            stack: error.stack
        };
    }
}
