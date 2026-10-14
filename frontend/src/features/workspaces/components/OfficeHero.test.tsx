import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import OfficeHero from './OfficeHero';

describe('OfficeHero', () => {
  it('renders the configured admin banner above the section background', () => {
    render(
      <OfficeHero
        landing={{
          hero_title: 'Van phong cho thue',
          hero_image_url: '/api/public/marketing-media/banner-id',
          hero_alt_text: 'Banner van phong',
        }}
      />,
    );

    const banner = screen.getByTestId('office-hero-banner');
    const image = screen.getByRole('img', { name: 'Banner van phong' });

    expect(banner).toHaveClass('z-0');
    expect(banner).not.toHaveClass('-z-10');
    expect(banner.querySelector('.bg-gradient-to-b')).not.toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/api/public/marketing-media/banner-id');
    expect(image).not.toHaveClass('opacity-30');
  });
});
