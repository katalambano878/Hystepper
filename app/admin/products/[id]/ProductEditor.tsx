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
  const [productCode, setProductCode] = useState('');
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
        setProductCode(product.product_code || '');
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

      // Validation
      if (!productName.trim()) {
        toast.error('Product Name is required');
        setActiveTab('general');
        setSaving(false);
        return;
      }
      if (!category) {
        toast.error('Category is required');
        setActiveTab('general');
        setSaving(false);
        return;
      }
      if (!price || parseFloat(price) <= 0) {
        toast.error('Valid Price is required');
        setActiveTab('pricing');
        setSaving(false);
        return;
      }

      const productData = {
        name: productName,
        category_id: category,
        status,
        featured,
        description,
        price: parseFloat(price) || 0,
        compare_at_price: comparePrice ? parseFloat(comparePrice) : null,
        sku,
        quantity: parseInt(stock) || 0,
        slug: slug || productName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        // New Fields
        product_code: productCode,
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

      let targetId = productId;
      let error;

      if (productId === 'new') {
        const { data, error: insertError } = await supabase.from('products').insert(productData).select().single();
        error = insertError;
        if (data) {
          targetId = data.id;
          toast.success('Product created!');
        }
      } else {
        const { error: updateError } = await supabase.from('products').update(productData).eq('id', productId);
        error = updateError;
        if (!error) toast.success('Product updated successfully');
      }

      if (error) throw error;

      // --- SAVE VARIANTS ---
      if (targetId) {
        // 1. Prepare data (remove temp IDs)
        const variantsToUpsert = variants.map(v => {
          const payload: any = {
            product_id: targetId,
            name: v.name,
            option2: v.option2,
            price: v.price || 0,
            quantity: parseInt(v.quantity?.toString() || '0') || 0
          };
          // Keep existing UUIDs, drop temp IDs
          if (v.id && !v.id.toString().startsWith('temp-')) {
            payload.id = v.id;
          }
          return payload;
        });

        // 2. Delete variants that were removed from UI
        // (Only if not a new product, or if we want to be safe)
        if (productId !== 'new') {
          const keptIds = variantsToUpsert
            .filter(v => v.id) // Only those with real IDs
            .map(v => v.id);

          if (keptIds.length > 0) {
            await supabase
              .from('product_variants')
              .delete()
              .eq('product_id', targetId)
              .not('id', 'in', keptIds);
          } else {
            // Check if we should delete all (i.e., user deleted all variants)
            // But verify we actually have variants in the UI before deciding to delete all??
            // If variants.length === 0, then we delete all.
            if (variants.length === 0) {
              await supabase.from('product_variants').delete().eq('product_id', targetId);
            } else {
              // If variants exist but all are new (temp IDs), we basically just insert them later.
              // But we still need to delete old ones from DB? Yes.
              // So if keptIds is empty, we delete all previously existing variants.
              await supabase.from('product_variants').delete().eq('product_id', targetId);
            }
          }
        }

        // 3. Upsert (Insert new + Update existing)
        if (variantsToUpsert.length > 0) {
          const { error: variantError } = await supabase.from('product_variants').upsert(variantsToUpsert);
          if (variantError) {
            console.error('Variant save error:', variantError);
            toast.error('Product saved, but variants failed to update');
          }
        }

        // 4. Save Images (If New Product)
        if (productId === 'new' && images.length > 0) {
          const imagesToInsert = images.map((img, idx) => ({
            product_id: targetId,
            url: img.url,
            position: idx,
            alt_text: productName
          }));

          const { error: imgError } = await supabase.from('product_images').insert(imagesToInsert);
          if (imgError) {
            console.error('Image save error:', imgError);
            toast.error('Product saved but images failed to upload');
          }
        }
      }

      // Redirect to products list
      router.push('/admin/products');

    } catch (err: any) {
      console.error('Error saving product:', err);
      toast.error(`Failed to save: ${err.message || 'Unknown error'}`);
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

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Product Code <span className="text-gray-500 font-normal">(Unique identifier for this product)</span>
                  </label>
                  <input
                    type="text"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    placeholder="e.g., HYS-001"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

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
                  <p className="text-gray-600 mt-1">Manage sizes, colors, or other versions</p>
                </div>
                <button
                  onClick={() => setVariants([...variants, { id: `temp-${Date.now()}`, name: '', option2: '', price: price, quantity: 0 }])}
                  className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 font-semibold transition-colors flex items-center"
                >
                  <i className="ri-add-line mr-2"></i>
                  Add Variant
                </button>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Size (e.g. 42)</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Color (e.g. Red)</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Price Override</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Stock</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {variants.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-gray-500">No variants added yet. Click "Add Variant" to start.</td></tr>
                    )}
                    {variants.map((variant, index) => (
                      <tr key={variant.id || index} className="group hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <input
                            type="text"
                            value={variant.name}
                            onChange={(e) => {
                              const newVariants = [...variants];
                              newVariants[index].name = e.target.value;
                              setVariants(newVariants);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="Size 42"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={variant.option2 || ''}
                            onChange={(e) => {
                              const newVariants = [...variants];
                              newVariants[index].option2 = e.target.value;
                              setVariants(newVariants);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="Red"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={variant.price}
                            onChange={(e) => {
                              const newVariants = [...variants];
                              newVariants[index].price = parseFloat(e.target.value);
                              setVariants(newVariants);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder={price}
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={variant.quantity}
                            onChange={(e) => {
                              const newVariants = [...variants];
                              newVariants[index].quantity = parseInt(e.target.value);
                              setVariants(newVariants);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              if (!confirm('Remove this variant?')) return;
                              setVariants(variants.filter((_, i) => i !== index));
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <i className="ri-delete-bin-line text-lg"></i>
                          </button>
                        </td>
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
                <p className="text-gray-600">Upload images via URL or file upload. Drag to reorder.</p>
              </div>

              {/* Image Upload Methods */}
              <div className="space-y-4">
                {/* URL Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Add Image URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      onKeyPress={async (e) => {
                        if (e.key === 'Enter' && e.currentTarget.value) {
                          const url = e.currentTarget.value;

                          if (productId === 'new') {
                            setImages([...images, { url, position: images.length }]);
                            e.currentTarget.value = '';
                            toast.success('Image added');
                            return;
                          }

                          try {
                            const { error } = await supabase.from('product_images').insert({
                              product_id: productId,
                              url: url,
                              position: images.length,
                              alt_text: productName
                            });
                            if (error) throw error;
                            setImages([...images, { url, position: images.length }]);
                            e.currentTarget.value = '';
                            toast.success('Image added');
                          } catch (err) {
                            toast.error('Failed to add image');
                          }
                        }
                      }}
                    />
                    <button
                      onClick={async (e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        const url = input.value;
                        if (!url) return;

                        if (productId === 'new') {
                          setImages([...images, { url, position: images.length }]);
                          input.value = '';
                          toast.success('Image added');
                          return;
                        }

                        try {
                          const { error } = await supabase.from('product_images').insert({
                            product_id: productId,
                            url: url,
                            position: images.length,
                            alt_text: productName
                          });
                          if (error) throw error;
                          setImages([...images, { url, position: images.length }]);
                          input.value = '';
                          toast.success('Image added');
                        } catch (err) {
                          toast.error('Failed to add image');
                        }
                      }}
                      className="px-6 py-3 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 font-semibold whitespace-nowrap"
                    >
                      Add URL
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Press Enter or click "Add URL" to add the image</p>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Upload from Computer</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors">
                    <input
                      type="file"
                      accept="image/*,video/mp4,video/webm"
                      multiple
                      className="hidden"
                      id="image-upload"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;

                        toast.info('Uploading media...');

                        for (const file of files) {
                          try {
                            // Create a data URL for immediate preview
                            const reader = new FileReader();
                            reader.onload = async (event) => {
                              const dataUrl = event.target?.result as string;

                              if (productId === 'new') {
                                setImages(prev => [...prev, { url: dataUrl, position: prev.length }]);
                                return;
                              }

                              // Insert to database
                              const { error } = await supabase.from('product_images').insert({
                                product_id: productId,
                                url: dataUrl,
                                position: images.length,
                                alt_text: productName
                              });

                              if (error) throw error;
                              setImages(prev => [...prev, { url: dataUrl, position: prev.length }]);
                            };
                            reader.readAsDataURL(file);
                          } catch (err) {
                            toast.error(`Failed to upload ${file.name}`);
                          }
                        }

                        if (productId === 'new') {
                          toast.success('Media prepared (Save to upload)');
                        } else {
                          toast.success('Media uploaded');
                        }

                        e.target.value = '';
                      }}
                    />
                    <label htmlFor="image-upload" className="cursor-pointer">
                      <i className="ri-upload-cloud-line text-4xl text-gray-400 mb-2 block"></i>
                      <p className="text-gray-700 font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm text-gray-500 mt-1">Images (PNG, JPG) or Videos (MP4, WebM)</p>
                    </label>
                  </div>
                </div>
              </div>

              {/* Image Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {images.map((image, index) => {
                  const isVideo = image.url.startsWith('data:video') || image.url.match(/\.(mp4|webm|ogg)$/i);
                  return (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-200">
                        {isVideo ? (
                          <video
                            src={image.url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            loop
                            onMouseOver={e => e.currentTarget.play()}
                            onMouseOut={e => e.currentTarget.pause()}
                          />
                        ) : (
                          <img src={image.url} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                        )}
                        {isVideo && (
                          <div className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full">
                            <i className="ri-movie-fill"></i>
                          </div>
                        )}
                      </div>

                      {/* Overlay Controls */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                        <button
                          onClick={async () => {
                            if (!confirm('Delete this item?')) return;

                            if (productId === 'new') {
                              setImages(images.filter((_, i) => i !== index));
                              return;
                            }

                            try {
                              const { error } = await supabase
                                .from('product_images')
                                .delete()
                                .eq('product_id', productId)
                                .eq('url', image.url);

                              if (error) throw error;
                              setImages(images.filter((_, i) => i !== index));
                              toast.success('Deleted');
                            } catch (err) {
                              toast.error('Failed to delete');
                            }
                          }}
                          className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center"
                        >
                          <i className="ri-delete-bin-line"></i>
                        </button>

                        {/* Reorder buttons logic can remain or be updated similarly if we want reorder on new products */}
                        {/* For brevity, omitting detailed reorder update here, assuming delete is main priority for user */}
                        {index > 0 && (
                          <button
                            onClick={async () => {
                              const newImages = [...images];
                              [newImages[index], newImages[index - 1]] = [newImages[index - 1], newImages[index]];
                              setImages(newImages);
                              // Update positions in DB
                              if (productId !== 'new') {
                                for (let i = 0; i < newImages.length; i++) {
                                  await supabase
                                    .from('product_images')
                                    .update({ position: i })
                                    .eq('product_id', productId)
                                    .eq('url', newImages[i].url);
                                }
                              }
                            }}
                            className="w-10 h-10 bg-gray-700 hover:bg-gray-800 text-white rounded-lg flex items-center justify-center"
                          >
                            <i className="ri-arrow-left-line"></i>
                          </button>
                        )}

                        {index < images.length - 1 && (
                          <button
                            onClick={async () => {
                              const newImages = [...images];
                              [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
                              setImages(newImages);
                              // Update positions in DB
                              if (productId !== 'new') {
                                for (let i = 0; i < newImages.length; i++) {
                                  await supabase
                                    .from('product_images')
                                    .update({ position: i })
                                    .eq('product_id', productId)
                                    .eq('url', newImages[i].url);
                                }
                              }
                            }}
                            className="w-10 h-10 bg-gray-700 hover:bg-gray-800 text-white rounded-lg flex items-center justify-center"
                          >
                            <i className="ri-arrow-right-line"></i>
                          </button>
                        )}
                      </div>

                      {/* Position Badge */}
                      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        #{index + 1}
                      </div>
                    </div>
                  );
                })}
                {images.length === 0 && (
                  <div className="col-span-4 text-center py-12 text-gray-500">
                    <i className="ri-image-line text-4xl mb-2 block text-gray-300"></i>
                    <p>No images uploaded yet. Add your first image above.</p>
                  </div>
                )}
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
    </div >
  );
}
