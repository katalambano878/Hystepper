import HomePageClient from '@/components/HomePageClient';
import { fetchHomepageHeroData } from '@/lib/homepage-hero';

/** Refresh homepage hero from CMS periodically (admin saves appear without redeploy). */
export const revalidate = 60;

export default async function HomePage() {
  const { heroSlides, heroAutoplaySeconds } = await fetchHomepageHeroData();

  return (
    <HomePageClient
      initialHeroSlides={heroSlides}
      initialHeroAutoplaySeconds={heroAutoplaySeconds}
    />
  );
}
