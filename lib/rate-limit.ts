/**
 * Simple in-memory rate limiter for API routes.
 *
 * Good enough for a single-instance Node/Vercel serverless deployment.
 * If we ever run multiple long-lived instances, swap this for a Redis
 * (Upstash) backed implementation so the counter is shared.
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries so the map doesn't grow unbounded on a warm server.
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of rateLimitStore.entries()) {
            if (entry.resetTime < now) {
                rateLimitStore.delete(key);
            }
        }
    }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
    /** Maximum requests allowed within the window. */
    maxRequests: number;
    /** Window size, in seconds. */
    windowSeconds: number;
}

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    /** Seconds until the window resets. */
    resetIn: number;
}

export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    let entry = rateLimitStore.get(identifier);

    if (!entry || entry.resetTime < now) {
        entry = { count: 1, resetTime: now + windowMs };
        rateLimitStore.set(identifier, entry);
        return {
            success: true,
            remaining: config.maxRequests - 1,
            resetIn: config.windowSeconds,
        };
    }

    if (entry.count >= config.maxRequests) {
        return {
            success: false,
            remaining: 0,
            resetIn: Math.ceil((entry.resetTime - now) / 1000),
        };
    }

    entry.count += 1;
    return {
        success: true,
        remaining: config.maxRequests - entry.count,
        resetIn: Math.ceil((entry.resetTime - now) / 1000),
    };
}

/**
 * Best-effort client identifier — falls back to 'unknown' when the platform
 * strips the relevant headers.
 */
export function getClientIdentifier(req: Request): string {
    const forwardedFor = req.headers.get('x-forwarded-for');
    if (forwardedFor) return forwardedFor.split(',')[0].trim();

    const realIp = req.headers.get('x-real-ip');
    if (realIp) return realIp;

    const cfIp = req.headers.get('cf-connecting-ip');
    if (cfIp) return cfIp;

    return 'unknown';
}

export const RATE_LIMITS = {
    /** Payment initiation — strict. */
    payment: { maxRequests: 10, windowSeconds: 60 },
    /** Notification fan-out from the app. */
    notification: { maxRequests: 20, windowSeconds: 60 },
    /** Webhook/callback inbound — relaxed (providers retry). */
    callback: { maxRequests: 50, windowSeconds: 60 },
    /** Default for everything else. */
    default: { maxRequests: 100, windowSeconds: 60 },
} satisfies Record<string, RateLimitConfig>;
