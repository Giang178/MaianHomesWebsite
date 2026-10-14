import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TeamSection from './TeamSection';
import type { TeamMember } from '@/features/team/types';

vi.mock('@/features/team/TeamAvatar', () => ({
  TeamAvatar: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

const member = (index: number): TeamMember => ({
  slug: `member-${index}`,
  profile_type: 'BROKER',
  full_name: `Chuyên gia ${index}`,
  position: 'Property Advisor',
  avatar_url: '/avatar',
  years_experience: index,
  headline: 'Tư vấn',
  short_bio: 'Mô tả',
  about: 'Về tôi',
  specialties: [{ title: 'Tư vấn', description: 'Tư vấn đầu tư' }],
  achievements: [],
  customers_served: 0,
  deals_completed: 0,
  satisfaction_rate: 100,
  show_on_home: true,
  is_featured: index === 1,
  allow_detail_view: true,
  display_order: index,
  projects: [],
});

describe('TeamSection', () => {
  it('renders immediately before the process as a bounded four-profile section with 2-1-3-4 display order', () => {
    render(<TeamSection members={[1, 2, 3, 4, 5].map(member)} />);
    expect(screen.getByRole('heading', { name: 'ĐỘI NGŨ NHÀ MÔI GIỚI MAIAN HOMES' })).toBeInTheDocument();
    const memberLinks = screen.getAllByRole('link').filter((link) =>
      link.getAttribute('href')?.startsWith('/doi-ngu/member-')
    );
    expect(memberLinks).toHaveLength(4);
    expect(memberLinks[0]).toHaveAttribute('href', '/doi-ngu/member-2');
    expect(memberLinks[1]).toHaveAttribute('href', '/doi-ngu/member-1');
    expect(memberLinks[2]).toHaveAttribute('href', '/doi-ngu/member-3');
    expect(memberLinks[3]).toHaveAttribute('href', '/doi-ngu/member-4');
    expect(screen.queryByText('Chuyên gia 5')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Xem tất cả chuyên gia/i })).toHaveAttribute('href', '/doi-ngu');
  });

  it('does not leave an empty section when there is no published profile', () => {
    const { container } = render(<TeamSection members={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a display-only profile without a detail link', () => {
    render(<TeamSection members={[{ ...member(1), allow_detail_view: false }]} />);
    expect(screen.getByRole('article', { name: /chỉ hiển thị thông tin tóm tắt/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Chuyên gia 1/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Xem tất cả chuyên gia/i })).toHaveAttribute('href', '/doi-ngu');
  });
});
