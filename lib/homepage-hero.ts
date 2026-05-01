import { createClient } from '@supabase/supabase-js';

export type HeroSlide = {
  id?: string;
  image: string;
  title: string;
  subtitle: string;
  button_text: string;
  button_link: string;
};

/** Hero CTAs saved as `/shop` (legacy default) go to category browsing instead. */
export function normalizeHeroButtonLink(link: string): string {
  const t = link.trim();
  if (t === '/shop' || t.toLowerCase() === 'shop') return '/categories';
  return t;
}

/** Normalise the hero_slides value from store_settings into a clean array. */
export function parseHeroSlidesFromStoreValue(raw: unknown): HeroSlide[] {
  let slides: unknown[] = [];
  if (Array.isArray(raw)) slides = raw;
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) slides = parsed;
    } catch {
      /* ignore */
    }
  }

  return slides
    .map((s: any) => ({
      id: typeof s?.id === 'string' ? s.id : undefined,
      image: (s?.image ?? '').toString().trim(),
      title: (s?.title ?? '').toString().trim(),
      subtitle: (s?.subtitle ?? '').toString().trim(),
      button_text: (s?.button_text ?? '').toString().trim(),
      button_link: normalizeHeroButtonLink((s?.button_link ?? '').toString()),
    }))
    .filter((s) => s.image || s.title || s.subtitle);
}

/** Hero slides that actually display a background image (text-only rows are skipped for the banner layer). */
export function heroSlidesWithImage(slides: HeroSlide[]): HeroSlide[] {
  return slides.filter((s) => s.image.length > 0);
}

/**
 * Load hero CMS data on the server so the first HTML response already
 * contains the hero (no client-only fetch / layout jump).
 */
export async function fetchHomepageHeroData(): Promise<{
  heroSlides: HeroSlide[];
  heroAutoplaySeconds: number;
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return { heroSlides: [], heroAutoplaySeconds: 6 };
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('store_settings')
    .select('key, value')
    .in('key', ['hero_slides', 'hero_autoplay_seconds']);

  if (error) {
    console.warn('[fetchHomepageHeroData]', error.message);
    return { heroSlides: [], heroAutoplaySeconds: 6 };
  }

  const map: Record<string, unknown> = {};
  (data || []).forEach((row: { key: string; value: unknown }) => {
    map[row.key] = row.value;
  });

  const heroSlides = parseHeroSlidesFromStoreValue(map.hero_slides);
  const ap = Number(map.hero_autoplay_seconds);
  const heroAutoplaySeconds =
    Number.isFinite(ap) && ap >= 2 && ap <= 30 ? ap : 6;

  return { heroSlides, heroAutoplaySeconds };
}
