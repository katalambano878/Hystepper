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

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onLoad?.();
  };

  // Determine if we should use fill mode or explicit dimensions
  const useFill = fill || (!width && !height);

  return (
    <div className={`relative overflow-hidden ${className}`} style={!useFill ? { width, height } : undefined}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse"></div>
      )}
      {hasError ? (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <i className="ri-image-line text-2xl text-gray-400"></i>
        </div>
      ) : useFill ? (
        <Image
          src={src}
          alt={alt}
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
          src={src}
          alt={alt}
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
