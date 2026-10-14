import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ResponsiveProjectImage, { ProjectImageMetadataProvider } from './ResponsiveProjectImage';

const metadata = [{
  field: 'hero_images.0',
  media_id: 'hero',
  url: '/api/public/marketing-media/hero',
  alt_text: 'Toàn cảnh dự án',
  width: 1600,
  height: 900,
  focal_x: 35,
  focal_y: 60,
  variants: {
    thumbnail_webp: '/media/hero-480.webp',
    medium_webp: '/media/hero-960.webp',
    large_webp: '/media/hero-1600.webp',
    thumbnail_avif: '/media/hero-480.avif',
    medium_avif: '/media/hero-960.avif',
    large_avif: '/media/hero-1600.avif',
  },
}];

describe('ResponsiveProjectImage', () => {
  it('renders responsive sources, alt and focal point without changing its container', () => {
    const {container} = render(
      <div className="relative aspect-video">
        <ProjectImageMetadataProvider metadata={metadata}>
          <ResponsiveProjectImage
            src="/api/public/marketing-media/hero"
            field="hero_images.0"
            alt="Fallback"
            priority
          />
        </ProjectImageMetadataProvider>
      </div>,
    );
    const image = screen.getByAltText('Toàn cảnh dự án');
    expect(image).toHaveAttribute('width', '1600');
    expect(image).toHaveAttribute('height', '900');
    expect(image).toHaveStyle({objectPosition: '35% 60%'});
    expect(image).toHaveAttribute('loading', 'eager');
    expect(container.querySelector('source[type="image/avif"]')?.getAttribute('srcset')).toContain('1600w');
    expect(container.querySelector('source[type="image/webp"]')?.getAttribute('srcset')).toContain('960w');
  });
});
