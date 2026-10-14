/* eslint-disable @next/next/no-img-element */
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamProjectCard } from './TeamProjectCard';
import type { TeamProject } from '@/features/team/types';

// Mock next/image to inspect props passed to it
vi.mock('next/image', () => ({
  default: (props: ComponentProps<'img'> & {priority?: boolean; quality?: number}) => {
    return <img alt={props.alt} src={props.src} data-sizes={props.sizes} data-quality={props.quality} data-priority={props.priority ? 'true' : 'false'} />;
  },
}));

describe('TeamProjectCard', () => {
  const sampleProject: TeamProject = {
    id: 'proj-1',
    name: 'The Global City',
    slug: 'the-global-city',
    location: 'Đỗ Xuân Hợp, TP. Thủ Đức',
    status: 'AVAILABLE',
    price_range: '35 - 50 Tỷ',
    image: '/images/global-cover.jpg',
    logo_url: '/images/global-logo.jpg',
    images: [''],
    hero_images: ['/images/global-hero.jpg'],
  };

  it('renders project information correctly', () => {
    render(<TeamProjectCard project={sampleProject} />);

    expect(screen.getByText('The Global City')).toBeInTheDocument();
    expect(screen.getByText('Đang mở bán')).toBeInTheDocument();
    expect(screen.getByText('35 - 50 Tỷ')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/du_an/the-global-city');
  });

  it('configures high-definition responsive image sizes and quality=90 for sharp rendering across mobile, laptop and PC', () => {
    render(<TeamProjectCard project={sampleProject} priority={true} />);

    const img = screen.getByRole('img', { name: 'The Global City' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('data-sizes', '(max-width: 640px) 100vw, (max-width: 1024px) 75vw, 800px');
    expect(img).toHaveAttribute('data-quality', '90');
    expect(img).toHaveAttribute('data-priority', 'true');
  });

  it('safely skips empty image strings and picks the first valid candidate', () => {
    const projectWithEmptyStrings: TeamProject = {
      id: 'proj-2',
      name: 'Lumiere Riverside',
      slug: 'lumiere-riverside',
      images: ['', '   '],
      hero_images: ['/images/lumiere-hero.jpg'],
    };

    render(<TeamProjectCard project={projectWithEmptyStrings} />);

    const img = screen.getByRole('img', { name: 'Lumiere Riverside' });
    expect(img).toHaveAttribute('src', '/images/lumiere-hero.jpg');
  });

  it('falls back to default project image when no images are provided', () => {
    const emptyProject: TeamProject = {
      id: 'proj-3',
      name: 'Dự án mẫu',
      slug: 'du-an-mau',
    };

    render(<TeamProjectCard project={emptyProject} />);

    const img = screen.getByRole('img', { name: 'Dự án mẫu' });
    expect(img).toHaveAttribute('src', '/images/banner_sec.png');
  });
});
