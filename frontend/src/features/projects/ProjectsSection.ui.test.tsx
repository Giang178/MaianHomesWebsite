import type {ImgHTMLAttributes} from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import ProjectsSection from './ProjectsSection';

const mocks = vi.hoisted(() => ({
  listProjectsPublic: vi.fn(),
}));

vi.mock('@/features/content/api', () => ({
  contentApi: {
    listProjectsPublic: mocks.listProjectsPublic,
  },
}));

vi.mock('next/image', () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => <img alt="" {...props}/>,
}));

describe('public projects catalog recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the current public projects when the server-rendered list is empty', async () => {
    mocks.listProjectsPublic.mockResolvedValue({
      data: [
        {
          name: 'The Privé',
          slug: 'the-prive',
          location: 'Thành phố Hồ Chí Minh',
          hero_images: ['/images/the-prive.jpg'],
          marketing_tags: ['Không gian sống cao cấp'],
          status: 'AVAILABLE',
          price_range: '7 - 12 tỷ',
        },
      ],
    });

    render(<ProjectsSection initialProjects={[]}/>);

    await waitFor(() => expect(mocks.listProjectsPublic).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('link', {name: /The Privé/})).toHaveAttribute(
      'href',
      '/du_an/the-prive',
    );
  });

  it('keeps a single project card at a usable desktop width', () => {
    render(
      <ProjectsSection
        initialProjects={[
          {
            name: 'The Privé',
            slug: 'the-prive',
            shortDesc: 'Không gian sống cao cấp',
            location: 'Thành phố Hồ Chí Minh',
            image: '/images/the-prive.jpg',
            status: 'AVAILABLE',
            priceRange: '7 - 12 tỷ',
          },
        ]}
      />,
    );

    const projectLink = screen.getByRole('link', {name: /The Privé/});
    expect(projectLink).toHaveClass('sm:w-full');
    expect(projectLink.parentElement).toHaveClass('w-full', 'max-w-[380px]');
  });
});
