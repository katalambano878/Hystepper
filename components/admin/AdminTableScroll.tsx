'use client';

import type { ReactNode } from 'react';

/**
 * Horizontal-scroll wrapper for admin data tables on narrow viewports.
 * Pair with `min-w-[…]` on the table so swipe actually reveals clipped columns.
 * `touch-pan-x` alone blocks vertical page scroll on iOS — keep pan-y too.
 */
export default function AdminTableScroll({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] touch-pan-x touch-pan-y -mx-4 px-4 sm:mx-0 sm:px-0 ${className}`}
    >
      {children}
    </div>
  );
}
