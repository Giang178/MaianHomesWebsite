import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TeamMember } from '@/features/team/types';

const api = vi.hoisted(() => ({ getPublicTeamMember: vi.fn() }));

vi.mock('@/features/team/api', () => ({
  TeamApiError: class TeamApiError extends Error {
    constructor(message: string, public status: number) {
      super(message);
    }
  },
  getPublicTeamMember: api.getPublicTeamMember,
}));

vi.mock('@/features/team/TeamAvatar', () => ({
  TeamAvatar: ({ alt }: { alt: string }) => <div role="img" aria-label={alt} />,
}));

vi.mock('@/components/home/ContactFormSection', () => ({
  default: () => <section aria-label="Biểu mẫu liên hệ" />,
}));

import TeamDetailPage from './page';

const member: TeamMember = {
  slug: 'nguyen-minh-anh',
  profile_type: 'LEADERSHIP',
  full_name: 'Nguyễn Minh Anh',
  position: 'Giám đốc tư vấn',
  phone: '0900000000',
  email: 'minhanh@example.com',
  avatar_url: '/api/public/team/nguyen-minh-anh/avatar',
  years_experience: 12,
  headline: 'Tận tâm và chuyên nghiệp',
  short_bio: 'Đồng hành cùng khách hàng.',
  about: 'Am hiểu thị trường bất động sản.',
  quote: 'Giá trị khách hàng là ưu tiên.',
  specialties: [{ title: 'Tư vấn đầu tư', description: 'Phân tích hiệu quả đầu tư.' }],
  achievements: [{ title: '150 giao dịch', description: 'Các giao dịch bất động sản cao cấp.' }],
  customers_served: 200,
  deals_completed: 150,
  satisfaction_rate: 98,
  linkedin_url: 'https://www.linkedin.com/in/minh-anh',
  show_on_home: true,
  is_featured: true,
  allow_detail_view: true,
  display_order: 1,
  projects: [],
};

describe('TeamDetailPage', () => {
  it('renders every public content field entered in the profile form', async () => {
    api.getPublicTeamMember.mockResolvedValue(member);
    const view = await TeamDetailPage({ params: Promise.resolve({ slug: member.slug }) });
    render(view);

    expect(screen.getByText('Lãnh đạo')).toBeInTheDocument();
    expect(screen.getByText('12+')).toBeInTheDocument();
    expect(screen.getByText('200+')).toBeInTheDocument();
    expect(screen.getByText('150+')).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText(/Giá trị khách hàng là ưu tiên/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute('href', member.linkedin_url);
    expect(screen.getByRole('link', { name: 'Liên hệ ngay chuyên gia' })).toHaveAttribute(
      'href',
      'tel:0900000000',
    );
    expect(screen.getByText('Tư vấn đầu tư')).toBeInTheDocument();
    expect(screen.getByText('Phân tích hiệu quả đầu tư.')).toBeInTheDocument();
    expect(screen.getByText('150 giao dịch')).toBeInTheDocument();
    expect(screen.getByText('Các giao dịch bất động sản cao cấp.')).toBeInTheDocument();
  });
});
