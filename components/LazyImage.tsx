'use client';

import { useState } from 'react';
import Image from 'next/image';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  onLoad?: () => void;
  fill?: boolean;
  sizes?: string;
}

const FALLBACK_SRC = '/placeholder-product.png';

export default function LazyImage({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  onLoad,
  fill,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const safeSrc = typeof src === 'string' && src.trim() ? src : FALLBACK_SRC;
  const isDataUrl = safeSrc.startsWith('data:');

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onLoad?.();
  };

  const useFill = fill || (!width && !height);

  if (isDataUrl || hasError) {
    return (
      <div className={`relative overflow-hidden ${className}`} style={!useFill ? { width, height } : undefined}>
        {hasError ? (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
            <i className="ri-image-line text-2xl text-gray-400"></i>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeSrc}
            alt={alt || 'Product'}
            className={`w-full h-full object-cover object-top`}
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
          />
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={!useFill ? { width, height } : undefined}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>
      )}
      {useFill ? (
        <Image
          src={safeSrc}
          alt={alt || 'Product'}
          fill
          sizes={sizes}
          className={`object-cover object-top transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleLoad}
          onError={handleError}
          priority={priority}
          loading={priority ? 'eager' : 'lazy'}
        />
      ) : (
        <Image
          src={safeSrc}
          alt={alt || 'Product'}
          width={width!}
          height={height!}
          className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleLoad}
          onError={handleError}
          priority={priority}
          loading={priority ? 'eager' : 'lazy'}
        />
      )}
    </div>
  );
}
