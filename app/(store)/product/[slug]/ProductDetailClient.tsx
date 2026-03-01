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

  const handleAddToCart = () => {
    if (!product) return;

    // Validation: Ensure required variants are selected before adding to cart
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      alert(`Please select a ${product.colors.some((c: any) => c.image) ? 'style' : 'color'} before adding to cart.`);
      return;
    }

    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      alert('Please select a size before adding to cart.');
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

    // Validation: Ensure required variants are selected before buying
    if (product.colors && product.colors.length > 0 && !selectedColor) {
      alert(`Please select a ${product.colors.some((c: any) => c.image) ? 'style' : 'color'} before buying.`);
      return;
    }

    if (product.sizes && product.sizes.length > 0 && !selectedSize) {
      alert('Please select a size before buying.');
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
        <section className="py-6 bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <nav className="flex items-center space-x-2 text-sm flex-wrap gap-y-2 font-medium">
              <Link href="/" className="text-gray-500 hover:text-gold-600 transition-colors flex items-center gap-1">
                <i className="ri-home-4-line"></i> Home
              </Link>
              <i className="ri-arrow-right-s-line text-gray-300"></i>
              <Link href="/shop" className="text-gray-500 hover:text-gold-600 transition-colors">Shop</Link>
              <i className="ri-arrow-right-s-line text-gray-300"></i>
              <Link href={`/categories/${product.category.toLowerCase()}`} className="text-gray-500 hover:text-gold-600 transition-colors">{product.category}</Link>
              <i className="ri-arrow-right-s-line text-gray-300"></i>
              <span className="text-gray-900 truncate max-w-[200px]">{product.name}</span>
            </nav>
          </div>
        </section>

        <section className="py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">
              {/* Left Column: Images */}
              <div className="lg:col-span-7 animate-fade-in-up">
                <div className="sticky top-24">
                  <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-gray-50 mb-4 shadow-sm border border-gray-100">
                    {/* Main Media Display — color override takes priority */}
                    {(() => {
                      const images = Array.isArray(product.images) ? product.images : [];
                      const fallback = images[0] || 'https://via.placeholder.com/800x800?text=No+Image';
                      const currentMedia = (colorOverrideImage && typeof colorOverrideImage === 'string' && colorOverrideImage.trim())
                        ? colorOverrideImage.trim()
                        : (images[selectedImage] ?? fallback);
                      const safeSrc = typeof currentMedia === 'string' && currentMedia.trim() ? currentMedia.trim() : fallback;
                      const isVideo = safeSrc.startsWith('data:video') || /\.(mp4|webm|ogg)$/i.test(safeSrc);

                      if (isVideo) {
                        return (
                          <video
                            src={safeSrc}
                            className="w-full h-full object-cover"
                            controls
                            playsInline
                            muted
                            preload="metadata"
                            poster={images[0] !== safeSrc ? images[0] : undefined}
                          />
                        );
                      }

                      if (mainImageError || safeSrc.startsWith('data:')) {
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={safeSrc}
                            alt={product.name || 'Product'}
                            className="w-full h-full object-cover object-center"
                          />
                        );
                      }

                      return (
                        <Image
                          key={safeSrc}
                          src={safeSrc}
                          alt={product.name || 'Product'}
                          fill
                          sizes="(max-width: 1024px) 100vw, 60vw"
                          className="object-cover object-center transition-opacity duration-500"
                          unoptimized={!!colorOverrideImage}
                          onError={() => setMainImageError(true)}
                          priority
                        />
                      );
                    })()}

                    {discount > 0 && (
                      <span className="absolute top-6 right-6 bg-red-600 text-white text-sm font-bold px-4 py-1.5 rounded-full z-10 shadow-lg">
                        -{discount}% OFF
                      </span>
                    )}
                  </div>

                  {Array.isArray(product.images) && product.images.length > 1 && (
                    <div className="grid grid-cols-5 gap-3">
                      {product.images.filter((img: any) => img).map((image: string, index: number) => {
                        const isVideo = typeof image === 'string' && (image.startsWith('data:video') || /\.(mp4|webm|ogg)$/i.test(image));
                        const isSelected = !colorOverrideImage && selectedImage === index;
                        return (
                          <button
                            key={index}
                            onClick={() => { setSelectedImage(index); setColorOverrideImage(null); setMainImageError(false); }}
                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${isSelected ? 'border-gold-600 shadow-md ring-2 ring-gold-600/20 scale-95' : 'border-transparent hover:border-gray-300'
                              }`}
                          >
                            {isVideo ? (
                              <div className="w-full h-full bg-gray-900 flex items-center justify-center relative">
                                <video src={typeof image === 'string' ? image : ''} className="w-full h-full object-cover opacity-70" muted />
                                <i className="ri-play-circle-fill text-white text-2xl absolute z-10 drop-shadow-md"></i>
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={typeof image === 'string' && image ? image : 'https://via.placeholder.com/200x200?text=No+Image'}
                                alt={`${product.name || 'Product'} view ${index + 1}`}
                                className="w-full h-full object-cover object-center"
                                loading="lazy"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Product Details */}
              <div className="lg:col-span-5 animate-fade-in-up delay-100">
                <div className="sticky top-24">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm text-gold-600 font-bold tracking-wider uppercase tracking-widest">{product.category}</p>
                    <button
                      onClick={() => setIsWishlisted(!isWishlisted)}
                      className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-red-50 rounded-full transition-colors cursor-pointer group"
                      aria-label="Add to wishlist"
                    >
                      <i className={`${isWishlisted ? 'ri-heart-fill text-red-600' : 'ri-heart-line text-gray-400 group-hover:text-red-500'} text-xl transition-colors`}></i>
                    </button>
                  </div>
                  
                  <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 leading-tight">{product.name}</h1>

                  <div className="flex items-center mb-6">
                    <div className="flex items-center space-x-1 mr-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <i
                          key={star}
                          className={`${star <= Math.round(Number(product.rating) || 0) ? 'ri-star-fill text-amber-400' : 'ri-star-line text-gray-200'} text-lg`}
                        ></i>
                      ))}
                    </div>
                    <span className="text-gray-600 font-medium text-sm">{(Number(product.rating) || 0).toFixed(1)}</span>
                    <span className="mx-3 text-gray-300">|</span>
                    <a href="#reviews" className="text-sm text-gray-500 hover:text-gold-600 transition-colors underline underline-offset-4">Read Reviews</a>
                  </div>

                  <div className="flex items-baseline space-x-4 mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="text-4xl font-bold text-gray-900 tracking-tight">GH₵{(Number(product.price) || 0).toFixed(2)}</span>
                    {product.compare_at_price != null && Number(product.compare_at_price) > Number(product.price) && (
                      <span className="text-xl text-gray-400 line-through decoration-gray-300 decoration-2">GH₵{(Number(product.compare_at_price) || 0).toFixed(2)}</span>
                    )}
                  </div>

                  <p className="text-gray-600 leading-relaxed mb-8 text-base">{product.description}</p>

                {/* Variant Selection — color swatches or image thumbnails */}
                {product.colors && product.colors.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <label className="font-semibold text-gray-900">
                        {product.colors.some((c: any) => c.image) ? 'Style' : 'Colour'}
                      </label>
                      {selectedColor && <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{selectedColor}</span>}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {product.colors.map((color: any) => {
                        const colorName = color?.name ?? '';
                        const colorImage = typeof color?.image === 'string' && color.image ? color.image : null;
                        const colorHex = color?.hex ?? null;
                        const isSelected = selectedColor === colorName;

                        if (colorImage) {
                          return (
                            <button
                              key={colorName}
                              onClick={() => {
                                setSelectedColor(colorName);
                                setColorOverrideImage(colorImage);
                                setMainImageError(false);
                              }}
                              className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${isSelected
                                ? 'border-gold-600 ring-2 ring-gold-600/20 scale-105 shadow-md'
                                : 'border-gray-200 hover:border-gray-400 hover:scale-105'}`}
                              title={colorName}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={colorImage} alt={colorName} className="w-full h-full object-cover" />
                              {isSelected && (
                                <span className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-[1px]">
                                  <i className="ri-check-line text-white text-xl font-bold drop-shadow-md"></i>
                                </span>
                              )}
                            </button>
                          );
                        }

                        return (
                          <button
                            key={colorName || colorHex}
                            onClick={() => {
                              setSelectedColor(colorName);
                              setColorOverrideImage(null);
                              setMainImageError(false);
                            }}
                            className={`group relative w-12 h-12 rounded-full border-2 transition-all cursor-pointer ${isSelected
                              ? 'border-gold-600 ring-4 ring-gold-600/20 scale-110 shadow-md'
                              : 'border-gray-200 hover:border-gray-400 hover:scale-105'}`}
                            title={colorName}
                          >
                            <span className="block w-full h-full rounded-full border border-black/5" style={{ backgroundColor: colorHex || '#ccc' }}></span>
                            {isSelected && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <i className={`ri-check-line text-lg font-bold ${isLightColor(colorHex) ? 'text-gray-800' : 'text-white'}`}></i>
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Size Selection */}
                {product.sizes && product.sizes.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <label className="font-semibold text-gray-900">Size</label>
                      {selectedSize && <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{selectedSize}</span>}
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                      {product.sizes.map((size: string) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize(size)}
                          className={`py-3 rounded-xl border-2 font-semibold transition-all text-center cursor-pointer ${selectedSize === size
                            ? 'border-gold-600 bg-gold-600 text-white shadow-md shadow-gold-600/20 scale-[1.02]'
                            : 'border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <label className="block font-semibold text-gray-900 mb-3">Quantity</label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center border-2 border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
                        disabled={product.stockCount === 0}
                      >
                        <i className="ri-subtract-line text-xl"></i>
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                        className="w-16 h-12 text-center border-x-2 border-gray-100 focus:outline-none text-lg font-bold text-gray-900 bg-gray-50/50"
                        min="1"
                        max="10"
                        disabled={product.stockCount === 0}
                      />
                      <button
                        onClick={() => setQuantity(Math.min(10, quantity + 1))}
                        className="w-12 h-12 flex items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors cursor-pointer"
                        disabled={product.stockCount === 0}
                      >
                        <i className="ri-add-line text-xl"></i>
                      </button>
                    </div>
                    {product.stockCount > 10 && (
                      <span className="text-emerald-600 font-semibold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full text-sm">
                        <i className="ri-checkbox-circle-fill text-lg"></i> In Stock
                      </span>
                    )}
                    {product.stockCount > 0 && product.stockCount <= 10 && (
                      <span className="text-amber-600 font-semibold flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-full text-sm">
                        <i className="ri-error-warning-fill text-lg"></i> Only {product.stockCount} Left
                      </span>
                    )}
                    {product.stockCount === 0 && (
                      <span className="text-red-600 font-semibold flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-full text-sm">
                        <i className="ri-close-circle-fill text-lg"></i> Sold Out
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 mb-8">
                  <button
                    disabled={product.stockCount === 0}
                    className={`w-full bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 text-lg cursor-pointer shadow-lg shadow-gray-900/20 ${product.stockCount === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
                    onClick={handleAddToCart}
                  >
                    <i className="ri-shopping-cart-line text-xl"></i>
                    <span>{product.stockCount === 0 ? 'Out of Stock' : 'Add to Cart'}</span>
                  </button>
                  {product.stockCount > 0 && (
                    <button
                      onClick={handleBuyNow}
                      className="w-full bg-gold-600 hover:bg-gold-700 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 text-lg cursor-pointer shadow-lg shadow-gold-600/20 hover:-translate-y-0.5"
                    >
                      <i className="ri-flashlight-fill text-xl"></i>
                      <span>Buy It Now</span>
                    </button>
                  )}
                </div>

                {/* Notify Me When Back in Stock */}
                {product.stockCount === 0 && (
                  <div className="mb-8 p-6 bg-gray-50 border border-gray-200 rounded-2xl">
                    {notifySubmitted ? (
                      <div className="flex items-center gap-3 text-gold-700">
                        <i className="ri-checkbox-circle-fill text-2xl"></i>
                        <div>
                          <p className="font-bold text-lg">You&apos;re on the list!</p>
                          <p className="text-sm text-gray-600">We&apos;ll email you when this item is back in stock.</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="font-bold text-gray-900 mb-2 flex items-center gap-2 text-lg">
                          <i className="ri-notification-3-line text-gold-600"></i>
                          Get notified when back in stock
                        </p>
                        <p className="text-sm text-gray-600 mb-4">Leave your email and we'll let you know when this item is back in stock.</p>
                        <form onSubmit={handleNotifyMe} className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="email"
                            value={notifyEmail}
                            onChange={(e) => setNotifyEmail(e.target.value)}
                            placeholder="Enter your email"
                            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none"
                            required
                          />
                          <button
                            type="submit"
                            disabled={notifyLoading}
                            className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          >
                            {notifyLoading ? 'Saving...' : 'Notify Me'}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-8 border-t border-gray-100">
                  <div className="flex flex-col items-center justify-center text-center p-4 bg-gray-50 rounded-2xl border border-gray-100 transition-colors hover:bg-gray-100">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 text-gold-600">
                      <i className="ri-truck-line text-2xl"></i>
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm mb-1">Fast Delivery</h4>
                    <p className="text-xs text-gray-500">Nationwide shipping</p>
                  </div>
                  <div className="flex flex-col items-center justify-center text-center p-4 bg-gray-50 rounded-2xl border border-gray-100 transition-colors hover:bg-gray-100">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 text-gold-600">
                      <i className="ri-shield-check-line text-2xl"></i>
                    </div>
                    <h4 className="font-bold text-gray-900 text-sm mb-1">Secure Payment</h4>
                    <p className="text-xs text-gray-500">100% safe checkout</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between text-sm text-gray-500 bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                  <span className="flex items-center gap-2">
                    <i className="ri-barcode-box-line text-lg"></i>
                    SKU:
                  </span>
                  <span className="font-mono font-medium text-gray-900">{product.product_code || product.sku || product.id.substring(0, 8).toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-white border-t border-gray-100">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="flex justify-center mb-10">
              <div className="inline-flex bg-gray-100 p-1.5 rounded-2xl">
                {['description', 'features', 'reviews'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-8 py-3 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer text-sm sm:text-base ${activeTab === tab
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                      }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-3xl p-8 sm:p-12 border border-gray-100 min-h-[300px]">
              {activeTab === 'description' && (
                <div className="prose max-w-none animate-fade-in-up">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">About this item</h3>
                  <p className="text-gray-600 text-lg leading-relaxed whitespace-pre-line">{product.description}</p>
                </div>
              )}

              {activeTab === 'features' && (
                <div className="animate-fade-in-up">
                  <h3 className="text-2xl font-bold text-gray-900 mb-8">Key Features</h3>
                  <ul className="grid sm:grid-cols-2 gap-6">
                    {product.features?.length > 0 ? product.features.map((feature: string, index: number) => (
                      <li key={index} className="flex items-start bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="w-10 h-10 bg-gold-50 rounded-full flex items-center justify-center mr-4 shrink-0">
                          <i className="ri-check-line text-gold-600 text-xl"></i>
                        </div>
                        <span className="text-gray-700 font-medium mt-2">{feature}</span>
                      </li>
                    )) : (
                      <p className="text-gray-500 italic col-span-2">No specific features listed for this product.</p>
                    )}
                  </ul>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div id="reviews" className="animate-fade-in-up">
                  <ProductReviews productId={product.id} />
                </div>
              )}
            </div>
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="py-24 bg-gray-50 border-t border-gray-100" data-product-shop>
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 tracking-tight">You May Also Like</h2>
                <div className="w-24 h-1 bg-gold-600 mx-auto rounded-full mb-6"></div>
                <p className="text-lg text-gray-600">Curated recommendations based on your selection</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {relatedProducts.map((p, idx) => (
                  <div key={p.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
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
