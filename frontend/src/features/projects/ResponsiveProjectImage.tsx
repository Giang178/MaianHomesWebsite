'use client';

import { createContext, useCallback, useContext, useMemo, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import { getAssetUrl } from '@/lib/api';
import type { ProjectImageMetadata } from '@/features/content/projects/project-form-contract';

const FALLBACK_IMAGE = '/images/banner.jpg';
const absoluteUrl = (value?: string) => getAssetUrl(value) || value || FALLBACK_IMAGE;

const variantSrcSet = (variants: Record<string, string> | undefined, format: 'avif' | 'webp') =>
  ([['thumbnail', 480], ['medium', 960], ['large', 1600]] as const)
    .map(([name, width]) => variants?.[`${name}_${format}`] ? `${absoluteUrl(variants[`${name}_${format}`])} ${width}w` : '')
    .filter(Boolean)
    .join(', ');

function resolveProjectImage(metadata: ProjectImageMetadata[] | undefined, field: string, url?: string) {
  return metadata?.find((item) => item.field === field)
    || metadata?.find((item) => Boolean(url) && item.url === url);
}

const ProjectImageMetadataContext = createContext<ProjectImageMetadata[]>([]);

export function ProjectImageMetadataProvider({metadata, children}: {metadata?: ProjectImageMetadata[]; children: ReactNode}) {
  return <ProjectImageMetadataContext.Provider value={metadata || []}>{children}</ProjectImageMetadataContext.Provider>;
}

export function useProjectImageResolver() {
  const metadata = useContext(ProjectImageMetadataContext);
  return useCallback((field: string, url?: string) => resolveProjectImage(metadata, field, url), [metadata]);
}

export default function ResponsiveProjectImage({
  src, field, metadata, alt, priority = false, decorative = false,
  sizes = '100vw', className = '', style, onLoad,
}: {
  src?: string;
  field: string;
  metadata?: ProjectImageMetadata[];
  alt: string;
  priority?: boolean;
  decorative?: boolean;
  sizes?: string;
  className?: string;
  style?: CSSProperties;
  onLoad?: (event: SyntheticEvent<HTMLImageElement>) => void;
}) {
  const inheritedMetadata = useContext(ProjectImageMetadataContext);
  const effectiveMetadata = metadata || inheritedMetadata;
  const media = useMemo(() => resolveProjectImage(effectiveMetadata, field, src), [effectiveMetadata, field, src]);
  const [failed, setFailed] = useState(false);
  const objectPosition = `${media?.focal_x ?? 50}% ${media?.focal_y ?? 50}%`;
  const avifSrcSet = failed ? '' : variantSrcSet(media?.variants, 'avif');
  const webpSrcSet = failed ? '' : variantSrcSet(media?.variants, 'webp');

  return (
    <picture className="contents">
      {avifSrcSet && <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />}
      {webpSrcSet && <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />}
      <img
        src={failed ? FALLBACK_IMAGE : absoluteUrl(src)}
        alt={decorative ? '' : (media?.alt_text?.trim() || alt)}
        aria-hidden={decorative || undefined}
        width={media?.width || undefined}
        height={media?.height || undefined}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
        style={{ ...style, objectPosition }}
        onLoad={onLoad}
        onError={() => {
          if (!failed) {
            setFailed(true);
            window.dispatchEvent(new CustomEvent('project-media-error', { detail: { field } }));
          }
        }}
      />
    </picture>
  );
}
