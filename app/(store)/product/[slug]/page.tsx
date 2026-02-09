import ProductDetailClient from './ProductDetailClient';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getProduct(slug: string) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data } = await supabase
    .from('products')
    .select('name, description, price, compare_at_price, product_images(url, position), categories(name)')
    .eq('slug', slug)
    .single();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return { title: 'Product Not Found' };
  }

  const mainImage = product.product_images
    ?.sort((a: any, b: any) => (a.position || 0) - (b.position || 0))[0]?.url
    || '/hero-footwear.png';

  const description = product.description
    ? product.description.substring(0, 160)
    : `Buy ${product.name} from Hy_stepper. Premium footwear delivered to your door.`;

  return {
    title: product.name,
    description,
    openGraph: {
      title: `${product.name} | Hy_stepper`,
      description,
      type: 'website',
      images: [
        {
          url: mainImage,
          width: 800,
          height: 800,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description,
      images: [mainImage],
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetailClient slug={slug} />;
}
