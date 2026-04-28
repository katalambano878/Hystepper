// Smart size sorter used everywhere we render a list of size options.
// Handles three common cases:
//   1. Pure numeric / decimal sizes ("37", "38", "9.5") → ascending number order
//   2. Lettered clothing sizes ("XS", "S", "M", "L", "XL", "XXL")
//      → canonical small → large order
//   3. Prefixed sizes ("EU 38", "UK 9", "Size 40")
//      → first numeric token wins, otherwise falls back to letter rank
// When in doubt the sort is stable: anything we can't categorise stays in the
// original relative position via Array.prototype.sort being stable in modern JS.

const LETTER_ORDER: Record<string, number> = {
    XXXS: 1,
    XXS: 2,
    XS: 3,
    S: 4,
    M: 5,
    L: 6,
    XL: 7,
    XXL: 8,
    XXXL: 9,
    '4XL': 10,
    '5XL': 11,
    '6XL': 12,
    'ONE SIZE': 99,
    OS: 99,
    FREE: 99,
};

function canonical(size: string): string {
    return (size || '').toString().trim().toUpperCase().replace(/\s+/g, ' ');
}

function extractNumber(size: string): number | null {
    // Pull the first number-looking token (handles "EU 38", "UK 9.5", "38", "Size 40")
    const match = canonical(size).match(/-?\d+(?:[.,]\d+)?/);
    if (!match) return null;
    const n = Number(match[0].replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function letterRank(size: string): number | null {
    const c = canonical(size);
    if (c in LETTER_ORDER) return LETTER_ORDER[c];
    // Strip a leading letter-prefix like "UK ", "EU ", "Size " and try again.
    const stripped = c.replace(/^(EU|UK|US|SIZE)\s+/i, '');
    if (stripped in LETTER_ORDER) return LETTER_ORDER[stripped];
    return null;
}

export function compareSizes(a: string, b: string): number {
    const aNum = extractNumber(a);
    const bNum = extractNumber(b);
    if (aNum != null && bNum != null) return aNum - bNum;
    if (aNum != null) return -1; // numbers before words
    if (bNum != null) return 1;

    const aRank = letterRank(a);
    const bRank = letterRank(b);
    if (aRank != null && bRank != null) return aRank - bRank;
    if (aRank != null) return -1;
    if (bRank != null) return 1;

    return canonical(a).localeCompare(canonical(b));
}

export function sortSizes(sizes: (string | null | undefined)[]): string[] {
    return sizes
        .map((s) => (s == null ? '' : String(s)))
        .filter((s) => s.length > 0)
        .slice()
        .sort(compareSizes);
}
