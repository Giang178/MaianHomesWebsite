import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FeaturedProjectsSection, { FeaturedProjectItem } from './FeaturedProjectsSection';

const mockProjects: FeaturedProjectItem[] = [
  {
    id: '1',
    name: 'Lumiere Midtown',
    slug: 'lumiere-midtown',
    location: 'Thủ Đức, TP. Hồ Chí Minh',
    image: '/images/default-project.jpg',
    status: 'AVAILABLE',
    priceRange: '10 - 12 tỷ',
    isFeatured: true,
  },
  {
    id: '2',
    name: 'The prive',
    slug: 'the-prive',
    location: 'Quận 2, TP. Hồ Chí Minh',
    image: '/images/default-project.jpg',
    status: 'AVAILABLE',
    priceRange: '8 Tỷ',
    isFeatured: true,
  },
  {
    id: '3',
    name: 'Grand Marina',
    slug: 'grand-marina',
    location: 'Quận 1, TP. Hồ Chí Minh',
    image: '/images/default-project.jpg',
    status: 'COMING_SOON',
    priceRange: '18 - 25 tỷ',
    isFeatured: true,
  },
  {
    id: '4',
    name: 'The Global City',
    slug: 'the-global-city',
    location: 'Thủ Đức, TP. Hồ Chí Minh',
    image: '/images/default-project.jpg',
    status: 'AVAILABLE',
    priceRange: '15 - 20 tỷ',
    isFeatured: true,
  },
];

describe('FeaturedProjectsSection', () => {
  it('renders at most 3 featured projects with their status displayed on cards', () => {
    render(<FeaturedProjectsSection projects={mockProjects} />);

    // Should render the first 3 featured projects
    expect(screen.getByText('Lumiere Midtown')).toBeDefined();
    expect(screen.getByText('The prive')).toBeDefined();
    expect(screen.getByText('Grand Marina')).toBeDefined();

    // 4th project should NOT be rendered (capped at 3)
    expect(screen.queryByText('The Global City')).toBeNull();

    // Status of projects must be displayed
    expect(screen.getAllByText('Đang mở bán').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sắp ra mắt')).toBeDefined();

    // Check CTA button
    expect(screen.getByText('Khám Phá Tất Cả Dự Án')).toBeDefined();
  });

  it('renders single featured project with status badge on card', () => {
    render(<FeaturedProjectsSection projects={[mockProjects[0]]} />);

    expect(screen.getByText('Lumiere Midtown')).toBeDefined();
    expect(screen.getByText('10 - 12 tỷ')).toBeDefined();
    expect(screen.getByText('Đang mở bán')).toBeDefined();
  });

  it('renders error state with data-public-data-status marker when error=true', () => {
    const { container } = render(<FeaturedProjectsSection projects={[]} error={true} />);

    expect(container.querySelector('[data-public-data-status="unavailable"]')).toBeDefined();
    expect(screen.getByText('Không Thể Tải Danh Sách Dự Án')).toBeDefined();
  });

  it('renders empty message when no featured projects exist', () => {
    render(<FeaturedProjectsSection projects={[]} error={false} />);

    expect(screen.getByText('Chưa Có Dự Án Nổi Bật')).toBeDefined();
  });
});
