import {describe, expect, it} from 'vitest';

import {selectProjectCardImage} from './project-card-data';

describe('selectProjectCardImage', () => {
  it('uses the hero banner consistently even when a logo and gallery image exist', () => {
    expect(selectProjectCardImage({
      hero_images: ['/images/banner.jpg'],
      images: ['/images/gallery.jpg'],
      logo_url: '/images/logo.png',
    })).toBe('/images/banner.jpg');
  });

  it('skips empty hero values before using the first usable banner', () => {
    expect(selectProjectCardImage({
      hero_images: ['', '/images/banner-2.jpg'],
      images: ['/images/gallery.jpg'],
    })).toBe('/images/banner-2.jpg');
  });

  it('falls back to gallery and then logo when no banner exists', () => {
    expect(selectProjectCardImage({
      images: ['/images/gallery.jpg'],
      logo_url: '/images/logo.png',
    })).toBe('/images/gallery.jpg');
    expect(selectProjectCardImage({logo_url: '/images/logo.png'})).toBe('/images/logo.png');
  });
});
