/**
 * HTML + input sanitization helpers.
 * Primarily used to prevent XSS when injecting user-supplied values into
 * our transactional emails or admin pages.
 */

export function escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Allow common formatting tags while stripping anything that can execute
 * scripts or exfiltrate data. Used by blog rendering and long-form admin
 * fields.
 */
export function sanitizeHtml(html: string): string {
    if (!html) return '';

    let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<(iframe|object|embed|form|input|textarea|button)\b[^>]*>.*?<\/\1>/gi, '');
    clean = clean.replace(/<(iframe|object|embed|form|input|textarea|button)\b[^>]*\/?>/gi, '');
    clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    clean = clean.replace(/\s+(href|src|action)\s*=\s*["']?\s*javascript:/gi, ' $1="');
    clean = clean.replace(/\s+(href|src|action)\s*=\s*["']?\s*data:/gi, ' $1="');
    clean = clean.replace(/\s+style\s*=\s*["'][^"']*expression\s*\([^"']*["']/gi, '');

    return clean;
}

export function isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Ghana phone validator: accepts 0XXXXXXXXX (10) or +233/233XXXXXXXXX (12).
 */
export function isValidGhanaPhone(phone: string): boolean {
    if (!phone || typeof phone !== 'string') return false;
    const cleaned = phone.replace(/\D/g, '');
    return (
        (cleaned.length === 10 && cleaned.startsWith('0')) ||
        (cleaned.length === 12 && cleaned.startsWith('233'))
    );
}

/**
 * Normalize Ghana phone to local 0XXXXXXXXX format.
 */
export function normalizeGhanaPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('233')) {
        return '0' + cleaned.slice(3);
    }
    return cleaned;
}

/**
 * Mask an email for logging — only reveals the first two local chars + domain.
 */
export function maskEmail(email: string): string {
    if (!email) return '***';
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    return local.slice(0, 2) + '***@' + domain;
}

/**
 * Mask a phone number for logging.
 */
export function maskPhone(phone: string): string {
    if (!phone || phone.length < 6) return '***';
    return phone.slice(0, 4) + '****' + phone.slice(-2);
}
