'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
import ProductCard from '@/components/ProductCard';
const ProductReviews = dynamic(() => import('@/components/ProductReviews'), { ssr: false });
import { StructuredData, generateProductSchema, generateBreadcrumbSchema } from '@/components/SEOHead';
import { notFound } from 'next/navigation';
import { useCart } from '@/context/CartContext';

function isLightColor(hex: string | null): boolean {
  if (!hex || typeof hex !== 'string') return false;
  const c = hex.replace('#', '').trim();
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [colorOverrideImage, setColorOverrideImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySubmitted, setNotifySubmitted] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [mainImageError, setMainImageError] = useState(false);

  const { addToCart } = useCart();

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        let query = supabase
          .from('products')
          .select(`
            id, name, slug, description, price, compare_at_price, quantity, sku,
            category_id, rating_avg, product_code, material, heel_height, style_name,
            sizing_notes, metadata,
            categories(name),
            product_variants(id, name, option1, option2, option3, quantity, image_url),
            product_images(url, position)
          `);

        // Check if slug looks like a UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

        if (isUUID) {
          query = query.or(`id.eq.${slug},slug.eq.${slug}`);
        } else {
          query = query.eq('slug', slug);
        }

        const { data: productData, error } = await query.single();

        if (error || !productData) {
          console.error('Error fetching product:', error);
          setLoading(false);
          return;
        }

        const features = [];
        if (productData.style_name) features.push(`Style: ${productData.style_name}`);
        if (productData.material) features.push(`Material: ${productData.material}`);
        if (productData.heel_height) features.push(`Heel Height: ${productData.heel_height}`);
        if (productData.sizing_notes) features.push(`Sizing: ${productData.sizing_notes}`);
        if (features.length === 0) features.push('Premium Quality', 'Authentic Design');

        // Transform product data (safe sort and filter invalid urls)
        const rawImages = (productData.product_images || [])
          .filter((img: any) => img && img.url)
          .sort((a: any, b: any) => (Number(a?.position) ?? 0) - (Number(b?.position) ?? 0))
          .map((img: any) => img.url);
        const transformedProduct = {
          ...productData,
          images: Array.isArray(rawImages) ? rawImages : [],
          category: productData.categories?.name || 'Shop',
          rating: productData.rating_avg || 0,
          reviewCount: 0, // Placeholder
          stockCount: productData.quantity,
          colors: (() => {
            const seen = new Set<string>();
            return (productData.product_variants || [])
              .filter((v: any) => v && (v.option2 ?? v.name))
              .reduce((acc: any[], v: any) => {
                const name = (v.option2 ?? v.name ?? '').toString().trim();
                if (!name) return acc;
                const hex = (v.option3 && typeof v.option3 === 'string') ? v.option3 : null;
                const image = (v.image_url && typeof v.image_url === 'string') ? v.image_url : null;
                if (!seen.has(name)) {
                  seen.add(name);
                  acc.push({ name, hex, image });
                } else if (image) {
                  const existing = acc.find((c: any) => c.name === name);
                  if (existing) existing.image = image;
                }
                return acc;
              }, []);
          })(),
          sizes: [...new Set(productData.product_variants?.map((v: any) => v.name || v.option1).filter(Boolean))] || [],
          variants: productData.product_variants || [],
          features: features,
          care: 'Handle with care. Keep in dry place.',
          isPreorder: productData.metadata?.is_preorder || false
        };

        // Ensure at least one image/placeholder
        if (transformedProduct.images.length === 0) {
          transformedProduct.images = ['https://via.placeholder.com/800x800?text=No+Image'];
        }

        setProduct(transformedProduct);

        // Default select first size if available
        if (transformedProduct.sizes.length > 0) {
          // Do not auto-select size so validation triggers
          // setSelectedSize(transformedProduct.sizes[0]);
        }

        // Fetch related products (e.g., same category)
        if (productData.category_id) {
          const { data: related } = await supabase
            .from('products')
            .select('slug, name, price, quantity, rating_avg, product_images(url, position)')
            .eq('category_id', productData.category_id)
            .eq('status', 'active')
            .neq('id', productData.id)
            .not('product_images.url', 'ilike', 'data:video%')
            .order('position', { foreignTable: 'product_images', ascending: true })
            .limit(4)
            .limit(1, { foreignTable: 'product_images' });

          if (related) {
            setRelatedProducts(related.map(p => ({
              id: p.slug,
              name: p.name,
              price: p.price,
              image: p.product_images?.[0]?.url || 'https://via.placeholder.com/800?text=No+Image',
              rating: p.rating_avg || 0,
              reviewCount: 0,
              inStock: p.quantity > 0
            })));
          }
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  const [showSizeError, setShowSizeError] = useState(false);
  const [showColorError, setShowColorError] = useState(false);

  const handleAddToCart = () => {
    if (!product) return;

    let hasError = false;

    // Validation: Ensure required variants are selected before adding to cart
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      setShowColorError(true);
      hasError = true;
    }

    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      setShowSizeError(true);
      hasError = true;
    }

    if (hasError) {
      // Scroll up slightly to show the error if needed
      window.scrollBy({ top: -100, behavior: 'smooth' });
      return;
    }

    const price = Number(product.price);
    const maxStock = Number(product.stockCount) || 0;

    const firstImage = (product.images || []).find(
      (img: string) => typeof img === 'string' && !img.startsWith('data:video')
    );
    const image = firstImage ?? 'https://via.placeholder.com/400x400?text=Product';

    if (Number.isNaN(price) || price < 0) return;

    addToCart({
      id: product.id,
      name: product.name ?? 'Product',
      price,
      image,
      quantity: Math.max(1, Math.min(quantity, maxStock || 999)),
      variant: [selectedSize, selectedColor].filter(Boolean).join(' / ') || undefined,
      slug: product.slug ?? product.id,
      maxStock: maxStock || 999
    });
  };

  const handleBuyNow = () => {
    if (!product) return;

    let hasError = false;

    // Validation: Ensure required variants are selected before buying
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      setShowColorError(true);
      hasError = true;
    }

    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      setShowSizeError(true);
      hasError = true;
    }

    if (hasError) {
      window.scrollBy({ top: -100, behavior: 'smooth' });
      return;
    }

    handleAddToCart();
    window.location.href = '/checkout';
  };

  const handleNotifyMe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyEmail.trim()) return;
    setNotifyLoading(true);
    try {
      const { error } = await supabase
        .from('stock_notifications')
        .insert({
          product_id: product.id,
          email: notifyEmail.trim().toLowerCase(),
          notified: false,
        });
      if (error) throw error;
      setNotifySubmitted(true);
    } catch (err: any) {
      console.error('Notify me error:', err);
      // Might be a duplicate - that's ok
      setNotifySubmitted(true);
    } finally {
      setNotifyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white py-12 flex justify-center items-center">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-gold-600 animate-spin mb-4 block"></i>
          <p className="text-gray-500">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white py-20 flex justify-center items-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h2>
          <Link href="/shop" className="text-gold-600 hover:underline">Return to Shop</Link>
        </div>
      </div>
    );
  }

  const discount = product.compare_at_price ? Math.round((1 - product.price / product.compare_at_price) * 100) : 0;

  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    image: product.images[0],
    price: product.price,
    currency: 'GHS',
    sku: product.sku,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availability: product.quantity > 0 ? 'in_stock' : 'out_of_stock',
    category: product.category
  });

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: 'https://standardecom.com' },
    { name: 'Shop', url: 'https://standardecom.com/shop' },
    { name: product.category, url: `https://standardecom.com/shop?category=${product.category.toLowerCase().replace(/\s+/g, '-')}` },
    { name: product.name, url: `https://standardecom.com/product/${slug}` }
  ]);

  return (
    <>
      <StructuredData data={productSchema} />
      <StructuredData data={breadcrumbSchema} />

      <main className="min-h-screen bg-white">

        {/* Slim Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 pb-2">
          <nav className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/shop" className="hover:text-gray-700 transition-colors">Shop</Link>
            <span>/</span>
            <Link href={`/shop?category=${product.category}`} className="hover:text-gray-700 transition-colors">{product.category}</Link>
            <span>/</span>
            <span className="text-gray-600 truncate max-w-[180px]">{product.name}</span>
          </nav>
        </div>

        {/* Main Product Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-10">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-14">

            {/* ── LEFT: Image Gallery ── */}
            <div className="lg:w-[55%] flex gap-3 lg:gap-4">

              {/* Vertical thumbnail strip — desktop only */}
              {Array.isArray(product.images) && product.images.length > 1 && (
                <div className="hidden lg:flex flex-col gap-3 w-20 flex-shrink-0">
                  {product.images.filter((img: any) => img).map((image: string, index: number) => {
                    const isVideo = typeof image === 'string' && (image.startsWith('data:video') || /\.(mp4|webm|ogg)$/i.test(image));
                    const isSelected = !colorOverrideImage && selectedImage === index;
                    return (
                      <button
                        key={index}
                        onClick={() => { setSelectedImage(index); setColorOverrideImage(null); setMainImageError(false); }}
                        className={`relative aspect-square rounded-xl overflow-hidden flex-shrink-0 transition-all cursor-pointer border-2 ${isSelected ? 'border-gray-900 opacity-100' : 'border-transparent opacity-60 hover:opacity-100 hover:border-gray-300'}`}
                      >
                        {isVideo ? (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <i className="ri-play-circle-fill text-white text-xl"></i>
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={typeof image === 'string' && image ? image : 'https://via.placeholder.com/100x100'} alt="" className="w-full h-full object-cover object-center" loading="lazy" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Main image */}
              <div className="flex-1 flex flex-col gap-3">
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 w-full">
                  {(() => {
                    const images = Array.isArray(product.images) ? product.images : [];
                    const fallback = images[0] || 'https://via.placeholder.com/800x800?text=No+Image';
                    const currentMedia = (colorOverrideImage && typeof colorOverrideImage === 'string' && colorOverrideImage.trim())
                      ? colorOverrideImage.trim()
                      : (images[selectedImage] ?? fallback);
                    const safeSrc = typeof currentMedia === 'string' && currentMedia.trim() ? currentMedia.trim() : fallback;
                    const isVideo = safeSrc.startsWith('data:video') || /\.(mp4|webm|ogg)$/i.test(safeSrc);

                    if (isVideo) return (
                      <video src={safeSrc} className="w-full h-full object-cover" controls playsInline muted preload="metadata" poster={images[0] !== safeSrc ? images[0] : undefined} />
                    );
                    if (mainImageError || safeSrc.startsWith('data:')) return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={safeSrc} alt={product.name || 'Product'} className="w-full h-full object-cover object-center" />
                    );
                    return (
                      <Image key={safeSrc} src={safeSrc} alt={product.name || 'Product'} fill sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover object-center" unoptimized={!!colorOverrideImage} onError={() => setMainImageError(true)} priority />
                    );
                  })()}

                  {discount > 0 && (
                    <span className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full z-10">
                      -{discount}% OFF
                    </span>
                  )}
                  {product.stockCount === 0 && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <span className="text-gray-700 font-semibold text-xl bg-white px-6 py-3 rounded-full shadow-sm border border-gray-200">Sold Out</span>
                    </div>
                  )}
                </div>

                {/* Mobile thumbnails — horizontal scroll */}
                {Array.isArray(product.images) && product.images.length > 1 && (
                  <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {product.images.filter((img: any) => img).map((image: string, index: number) => {
                      const isVideo = typeof image === 'string' && (image.startsWith('data:video') || /\.(mp4|webm|ogg)$/i.test(image));
                      const isSelected = !colorOverrideImage && selectedImage === index;
                      return (
                        <button key={index} onClick={() => { setSelectedImage(index); setColorOverrideImage(null); setMainImageError(false); }}
                          className={`relative aspect-square w-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${isSelected ? 'border-gray-900' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        >
                          {isVideo ? (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center"><i className="ri-play-fill text-white"></i></div>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={typeof image === 'string' && image ? image : 'https://via.placeholder.com/100x100'} alt="" className="w-full h-full object-cover object-center" loading="lazy" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: Product Info ── */}
            <div className="lg:w-[45%]">
              <div className="lg:sticky lg:top-6 space-y-5">

                {/* Category + Wishlist */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-gold-600">{product.category}</span>
                  <button onClick={() => setIsWishlisted(!isWishlisted)} className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all cursor-pointer" aria-label="Wishlist">
                    <i className={`${isWishlisted ? 'ri-heart-fill text-red-500' : 'ri-heart-line text-gray-400'} text-lg`}></i>
                  </button>
                </div>

                {/* Product name */}
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-snug">{product.name}</h1>

                {/* Rating */}
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1,2,3,4,5].map(s => (
                      <i key={s} className={`${s <= Math.round(Number(product.rating)||0) ? 'ri-star-fill text-amber-400' : 'ri-star-line text-gray-200'} text-sm`}></i>
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">{(Number(product.rating)||0).toFixed(1)}</span>
                  <span className="text-gray-200">·</span>
                  <a href="#reviews" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">Reviews</a>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-gray-900">GH₵{(Number(product.price)||0).toFixed(2)}</span>
                  {product.compare_at_price != null && Number(product.compare_at_price) > Number(product.price) && (
                    <span className="text-lg text-gray-400 line-through">GH₵{(Number(product.compare_at_price)||0).toFixed(2)}</span>
                  )}
                  {product.stockCount > 0 && product.stockCount <= 10 && (
                    <span className="ml-auto text-amber-600 text-xs font-semibold bg-amber-50 px-2 py-1 rounded-lg">Only {product.stockCount} left!</span>
                  )}
                </div>

                {/* Description */}
                {product.description && (
                  <p className="text-gray-500 text-sm leading-relaxed line-clamp-3 whitespace-pre-line">{product.description}</p>
                )}

                <div className="border-t border-gray-100 pt-5 space-y-5">

                  {/* Colour Variants */}
                  {product.colors && product.colors.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-gray-800">
                          {product.colors.some((c: any) => c.image) ? 'Style' : 'Colour'}
                          {selectedColor && <span className="ml-2 font-normal text-gray-500">— {selectedColor}</span>}
                        </p>
                        {showColorError && !selectedColor && (
                          <span className="text-red-500 text-xs font-semibold animate-pulse">Please select</span>
                        )}
                      </div>
                      <div className={`flex flex-wrap gap-2.5 transition-all ${showColorError && !selectedColor ? 'p-2 -m-2 rounded-xl border border-red-200 bg-red-50/40' : ''}`}>
                        {product.colors.map((color: any) => {
                          const colorName = color?.name ?? '';
                          const colorImage = typeof color?.image === 'string' && color.image ? color.image : null;
                          const colorHex = color?.hex ?? null;
                          const isSelected = selectedColor === colorName;
                          if (colorImage) return (
                            <button key={colorName} onClick={() => { setSelectedColor(colorName); setShowColorError(false); setColorOverrideImage(colorImage); setMainImageError(false); }}
                              className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${isSelected ? 'border-gray-900 shadow-md scale-105' : 'border-transparent hover:border-gray-300'}`} title={colorName}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={colorImage} alt={colorName} className="w-full h-full object-cover" />
                              {isSelected && <span className="absolute inset-0 bg-black/25 flex items-center justify-center"><i className="ri-check-line text-white font-bold"></i></span>}
                            </button>
                          );
                          return (
                            <button key={colorName || colorHex} onClick={() => { setSelectedColor(colorName); setShowColorError(false); setColorOverrideImage(null); setMainImageError(false); }}
                              className={`relative w-10 h-10 rounded-full border-2 transition-all cursor-pointer ${isSelected ? 'border-gray-900 scale-110 shadow-md' : 'border-gray-200 hover:scale-105'}`} title={colorName}>
                              <span className="block w-full h-full rounded-full border border-black/10" style={{ backgroundColor: colorHex || '#ccc' }}></span>
                              {isSelected && <span className="absolute inset-0 flex items-center justify-center"><i className={`ri-check-line text-sm font-bold ${isLightColor(colorHex) ? 'text-gray-900' : 'text-white'}`}></i></span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Size Variants */}
                  {product.sizes && product.sizes.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-gray-800">
                          Size
                          {selectedSize && <span className="ml-2 font-normal text-gray-500">— {selectedSize}</span>}
                        </p>
                        {showSizeError && !selectedSize && (
                          <span className="text-red-500 text-xs font-semibold animate-pulse">Please select</span>
                        )}
                      </div>
                      <div className={`flex flex-wrap gap-2 transition-all ${showSizeError && !selectedSize ? 'p-2 -m-2 rounded-xl border border-red-200 bg-red-50/40' : ''}`}>
                        {product.sizes.map((size: string) => (
                          <button key={size} onClick={() => { setSelectedSize(size); setShowSizeError(false); }}
                            className={`min-w-[52px] px-3 py-2 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${selectedSize === size
                              ? 'border-gray-900 bg-gray-900 text-white'
                              : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}
                          >{size}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quantity + Stock status */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={product.stockCount === 0}
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40">
                        <i className="ri-subtract-line"></i>
                      </button>
                      <span className="w-10 h-10 flex items-center justify-center font-bold text-gray-900 text-base border-x border-gray-200">{quantity}</span>
                      <button onClick={() => setQuantity(Math.min(10, quantity + 1))} disabled={product.stockCount === 0}
                        className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40">
                        <i className="ri-add-line"></i>
                      </button>
                    </div>
                    {product.stockCount > 10 && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><i className="ri-checkbox-circle-fill text-sm"></i> In Stock</span>
                    )}
                    {product.stockCount > 0 && product.stockCount <= 10 && (
                      <span className="text-xs font-semibold text-amber-600 flex items-center gap-1"><i className="ri-error-warning-fill text-sm"></i> {product.stockCount} left</span>
                    )}
                  </div>

                  {/* CTAs */}
                  <div className="flex gap-3 pt-1">
                    <button disabled={product.stockCount === 0} onClick={handleAddToCart}
                      className={`flex-1 h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all cursor-pointer border-2 border-gray-900 ${product.stockCount === 0 ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-gray-900 hover:bg-gray-900 hover:text-white'}`}>
                      <i className="ri-shopping-bag-line text-xl"></i>
                      <span>{product.stockCount === 0 ? 'Out of Stock' : 'Add to Bag'}</span>
                    </button>
                    {product.stockCount > 0 && (
                      <button onClick={handleBuyNow}
                        className="flex-1 h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 bg-gold-600 hover:bg-gold-700 text-white transition-all cursor-pointer shadow-md shadow-gold-600/20">
                        <i className="ri-flashlight-fill text-xl"></i>
                        <span>Buy Now</span>
                      </button>
                    )}
                  </div>

                  {/* Notify Me */}
                  {product.stockCount === 0 && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      {notifySubmitted ? (
                        <p className="text-sm text-emerald-700 font-semibold flex items-center gap-2"><i className="ri-checkbox-circle-fill text-lg"></i> You&apos;re on the list!</p>
                      ) : (
                        <form onSubmit={handleNotifyMe}>
                          <p className="text-sm font-semibold text-gray-800 mb-2">Notify me when back in stock</p>
                          <div className="flex gap-2">
                            <input type="email" value={notifyEmail} onChange={e => setNotifyEmail(e.target.value)} placeholder="your@email.com"
                              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400" required />
                            <button type="submit" disabled={notifyLoading}
                              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50">
                              {notifyLoading ? '...' : 'Notify Me'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Trust strip */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-400">
                    <span className="flex items-center gap-1.5"><i className="ri-truck-line text-sm text-gray-500"></i> Nationwide Delivery</span>
                    <span className="flex items-center gap-1.5"><i className="ri-shield-check-line text-sm text-gray-500"></i> Secure Checkout</span>
                    <span className="flex items-center gap-1.5"><i className="ri-exchange-line text-sm text-gray-500"></i> Easy Exchange</span>
                  </div>

                  {/* SKU */}
                  <p className="text-xs text-gray-300 pt-1">SKU: <span className="font-mono">{product.product_code || product.sku || product.id.substring(0,8).toUpperCase()}</span></p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs Section */}
        <section className="border-t border-gray-100 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
              {['description', 'features', 'reviews'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors border-b-2 -mb-px ${activeTab === tab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="py-10 max-w-3xl">
              {activeTab === 'description' && (
                <p className="text-gray-600 text-base leading-relaxed whitespace-pre-line">{product.description || 'No description available.'}</p>
              )}
              {activeTab === 'features' && (
                <ul className="space-y-3">
                  {product.features?.length > 0 ? product.features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-start gap-3 text-gray-700">
                      <i className="ri-check-line text-gold-600 text-lg mt-0.5 shrink-0"></i>
                      <span>{feature}</span>
                    </li>
                  )) : <p className="text-gray-400 italic">No features listed.</p>}
                </ul>
              )}
              {activeTab === 'reviews' && (
                <div id="reviews"><ProductReviews productId={product.id} /></div>
              )}
            </div>
          </div>
        </section>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="py-16 border-t border-gray-100 bg-gray-50" data-product-shop>
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <h2 className="text-xl font-bold text-gray-900 mb-8">You May Also Like</h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {relatedProducts.map((p, idx) => (
                  <div key={p.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 80}ms` }}>
                    <ProductCard {...p} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
