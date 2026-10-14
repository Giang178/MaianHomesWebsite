'use client';

import Image from 'next/image';
import { useState } from 'react';

export function TeamAvatar({
  src,
  alt,
  priority = false,
  className = '',
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      src={failed || !src ? '/images/logo_maian.png' : src}
      alt={alt}
      fill
      priority={priority}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 600px"
      className={`object-cover object-top ${failed ? 'object-contain bg-[#16120e] p-8' : ''} ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
