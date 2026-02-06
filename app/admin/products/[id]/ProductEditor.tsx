'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function ProductEditor({ productId }: { productId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Product State
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('active');
  const [featured, setFeatured] = useState(false);
  const [description, setDescription] = useState('');

  // Pricing & Inventory
  const [price, setPrice] = useState('');
  const [comparePrice, setComparePrice] = useState('');
  const [sku, setSku] = useState('');
  const [stock, setStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

  // New Footwear Fields
  const [styleName, setStyleName] = useState('');
  const [material, setMaterial] = useState('');
  const [heelHeight, setHeelHeight] = useState('');
  const [sizingNotes, setSizingNotes] = useState('');

  // SEO
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [keywords, setKeywords] = useState(''); // Mapping to 'tags' array

  // Collections Data (for dropdown)
  const [categories, setCategories] = useState<any[]>([]);

  // Images & Variants (Read-only / Partial Implementation for now)
  const [images, setImages] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);

  // Initialize
  useEffect(() => {
    fetchInitialData();
  }, [productId]);

  async function fetchInitialData() {
    try {
      setLoading(true);

      // 1. Fetch Categories for dropdown
      const { data: cats } = await supabase.from('categories').select('id, name').eq('status', 'active');
      if (cats) setCategories(cats);

      if (productId === 'new') {
        setLoading(false);
        return;
      }

      // 2. Fetch Product Data
      const { data: product, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images (*),
          product_variants (*)
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;

      if (product) {
        setProductName(product.name || '');
        setCategory(product.category_id || ''); // This binds to category ID
        setStatus(product.status || 'active');
        setFeatured(product.featured || false);
        setDescription(product.description || '');

        setPrice(product.price?.toString() || '');
        setComparePrice(product.compare_at_price?.toString() || '');
        setSku(product.sku || '');
        setStock(product.quantity?.toString() || '0');
        // lowStockThreshold not in DB schema provided, assuming it might be in metadata or skip

        // New Fields
        setStyleName(product.style_name || '');
        setMaterial(product.material || '');
        setHeelHeight(product.heel_height || '');
        setSizingNotes(product.sizing_notes || '');

        // SEO
        setSeoTitle(product.seo_title || '');
        setSeoDescription(product.seo_description || '');
        setSlug(product.slug || '');
        setKeywords(product.tags ? product.tags.join(', ') : '');

        // Images
        if (product.product_images) {
          setImages(product.product_images.sort((a: any, b: any) => a.position - b.position));
        }

        // Variants
        if (product.product_variants) {
          setVariants(product.product_variants);
        }
      }

    } catch (err) {
      console.error('Error loading product:', err);
      toast.error('Failed to load product data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);

      const productData = {
        name: productName,
        category_id: category || null, // handle empty
        status,
        featured,
        description,
        price: parseFloat(price) || 0,
        compare_at_price: comparePrice ? parseFloat(comparePrice) : null,
        sku,
        quantity: parseInt(stock) || 0,
        slug: slug || productName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        // New Fields
        style_name: styleName,
        material: material,
        heel_height: heelHeight,
        sizing_notes: sizingNotes,
        // SEO
        seo_title: seoTitle,
        seo_description: seoDescription,
        tags: keywords.split(',').map(tag => tag.trim()).filter(tag => tag),
        updated_at: new Date().toISOString()
      };

      let error;
      if (productId === 'new') {
        const { data, error: insertError } = await supabase.from('products').insert(productData).select().single();
        error = insertError;
        if (data) {
          toast.success('Product created!');
          router.replace(`/admin/products/${data.id}`);
        }
      } else {
        const { error: updateError } = await supabase.from('products').update(productData).eq('id', productId);
        error = updateError;
        if (!error) toast.success('Product updated successfully');
      }

      if (error) throw error;

    } catch (err: any) {
      console.error('Error saving product:', err);
      toast.error(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { id: 'general', label: 'General', icon: 'ri-information-line' },
    { id: 'pricing', label: 'Pricing & Inventory', icon: 'ri-price-tag-3-line' },
    { id: 'variants', label: 'Variants', icon: 'ri-layout-grid-line' },
    { id: 'images', label: 'Images', icon: 'ri-image-line' },
    { id: 'seo', label: 'SEO', icon: 'ri-search-line' }
  ];

  if (loading) {
    return <div className="p-12 text-center text-gray-500">Loading product editor...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/products"
            className="w-10 h-10 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
          >
            <i className="ri-arrow-left-line text-xl text-gray-700"></i>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{productId === 'new' ? 'New Product' : 'Edit Product'}</h1>
            <p className="text-gray-600 mt-1">Update product information and settings</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-semibold whitespace-nowrap cursor-pointer">
            <i className="ri-eye-line mr-2"></i>
            Preview
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center ${saving ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            {saving ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>
            ) : (
              <i className="ri-save-line mr-2"></i>
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 font-semibold whitespace-nowrap transition-colors border-b-2 cursor-pointer ${activeTab === tab.id
                    ? 'border-emerald-700 text-emerald-700 bg-emerald-50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
              >
                <i className={`${tab.icon} text-xl`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-8">
          {activeTab === 'general' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter product name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  maxLength={1000}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  placeholder="Describe your product..."
                />
                <p className="text-sm text-gray-500 mt-2">{description.length} characters</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    {/* Fallback if no categories */}
                    {categories.length === 0 && <option>No categories found</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-5 h-5 text-emerald-700 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                />
                <label className="text-gray-900 font-medium">
                  Feature this product on homepage
                </label>
              </div>

              {/* LIVE DATABASE FIELDS - FOOTWEAR */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Product Details</h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Style Name
                    </label>
                    <input
                      type="text"
                      value={styleName}
                      onChange={(e) => setStyleName(e.target.value)}
                      placeholder="e.g., Classic Elegance"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Material
                    </label>
                    <input
                      type="text"
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                      placeholder="e.g., Genuine Leather"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Heel Height
                    </label>
                    <input
                      type="text"
                      value={heelHeight}
                      onChange={(e) => setHeelHeight(e.target.value)}
                      placeholder="e.g., 3 inches"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Sizing Notes
                  </label>
                  <textarea
                    rows={3}
                    value={sizingNotes}
                    onChange={(e) => setSizingNotes(e.target.value)}
                    placeholder="e.g., Runs true to size. For wide feet, consider sizing up."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  />
                  <p className="text-sm text-gray-500 mt-2">Help customers choose the right size</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-6 max-w-3xl">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Price (GH₵) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">GH₵</span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full pl-16 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Compare at Price (GH₵)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">GH₵</span>
                    <input
                      type="number"
                      value={comparePrice}
                      onChange={(e) => setComparePrice(e.target.value)}
                      className="w-full pl-16 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      step="0.01"
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Show original price for comparison</p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-900 font-semibold mb-1">Discount Calculation</p>
                <p className="text-blue-800">
                  {price && comparePrice && parseFloat(comparePrice) > parseFloat(price) ? (
                    <>
                      Savings: GH₵ {(parseFloat(comparePrice) - parseFloat(price)).toFixed(2)}
                      <span className="ml-2">
                        ({(((parseFloat(comparePrice) - parseFloat(price)) / parseFloat(comparePrice)) * 100).toFixed(0)}% off)
                      </span>
                    </>
                  ) : 'No discount applied'}
                </p>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Inventory</h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      SKU (Product Code) *
                    </label>
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                      placeholder="PROD-SKU-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Stock Quantity *
                    </label>
                    <input
                      type="number"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Low Stock Threshold
                  </label>
                  <input
                    type="number"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <p className="text-sm text-gray-500 mt-2">Get notified when stock falls below this number</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'variants' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Product Variants</h3>
                  <p className="text-gray-600 mt-1">Manage different versions of this product (Read Only for now)</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Variant Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Price</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.length === 0 && (
                      <tr><td colSpan={3} className="p-4 text-center text-gray-500">No variants found.</td></tr>
                    )}
                    {variants.map((variant) => (
                      <tr key={variant.id} className="border-b border-gray-100">
                        <td className="py-4 px-4">{variant.name}</td>
                        <td className="py-4 px-4">{variant.price}</td>
                        <td className="py-4 px-4">{variant.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Product Images</h3>
                <p className="text-gray-600">Product images are managed via common storage. (View Only).</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200">
                      <img src={image.url} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                    </div>
                  </div>
                ))}
                {images.length === 0 && <p className="text-gray-500 col-span-4 text-center py-4">No images uploaded.</p>}
              </div>
            </div>
          )}

          {activeTab === 'seo' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Search Engine Optimization</h3>
                <p className="text-gray-600">Optimize how this product appears in search results</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Page Title
                </label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Meta Description
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  URL Slug
                </label>
                <div className="flex items-center">
                  <span className="text-gray-600 bg-gray-100 px-4 py-3 border-2 border-r-0 border-gray-300 rounded-l-lg">
                    /product/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Keywords
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="leather, bag, accessories"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="text-sm text-gray-500 mt-2">Separate keywords with commas</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
