'use client';

import { use } from 'react';
import ProductEditor from './ProductEditor';

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);

  // Verify ID exists
  if (!resolvedParams.id) {
    return <div>Invalid Product ID</div>;
  }

  // Render the fully wired ProductEditor
  return <ProductEditor productId={resolvedParams.id} />;
}
