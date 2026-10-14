import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamDirectoryClient } from './TeamDirectoryClient';
import type { TeamMember } from './types';

const mockMembers: TeamMember[] = [
  {
    full_name: 'Nguyễn Văn A',
    slug: 'nguyen-van-a',
    position: 'Trưởng phòng kinh doanh',
    headline: 'Chuyên gia tư vấn cao cấp',
    avatar_url: '/avatars/a.jpg',
    profile_type: 'SPECIALIST',
    phone: '0901234567',
    email: 'a@maianhomes.vn',
    display_order: 1,
    years_experience: 5,
    short_bio: 'Tư vấn bất động sản',
    about: 'Chi tiết về Nguyễn Văn A',
    specialties: [],
    achievements: [],
    customers_served: 50,
    deals_completed: 30,
    satisfaction_rate: 98,
    show_on_home: true,
    is_featured: true,
    allow_detail_view: true,
    projects: [{ id: 'p1', name: 'Vinhomes Central Park', slug: 'vinhomes-central-park' }],
  },
  {
    full_name: 'Trần Thị B',
    slug: 'tran-thi-b',
    position: 'Chuyên viên tư vấn',
    headline: 'Tư vấn dự án Masteri',
    avatar_url: '/avatars/b.jpg',
    profile_type: 'BROKER',
    phone: '0907654321',
    email: 'b@maianhomes.vn',
    display_order: 2,
    years_experience: 3,
    short_bio: 'Tư vấn bất động sản Masteri',
    about: 'Chi tiết về Trần Thị B',
    specialties: [],
    achievements: [],
    customers_served: 20,
    deals_completed: 15,
    satisfaction_rate: 95,
    show_on_home: true,
    is_featured: false,
    allow_detail_view: true,
    projects: [{ id: 'p2', name: 'Masteri Thảo Điền', slug: 'masteri-thao-dien' }],
  },
];

describe('TeamDirectoryClient', () => {
  it('does not display "Hiển thị 2 chuyên gia" and renders all members in grid view', () => {
    render(<TeamDirectoryClient members={mockMembers} />);

    // Không hiển thị dòng "Hiển thị 2 chuyên gia"
    expect(screen.queryByText(/Hiển thị/i)).not.toBeInTheDocument();

    // Không có nút chuyển đổi chế độ xem (lưới/danh sách)
    expect(screen.queryByTitle('Chế độ lưới')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Chế độ danh sách chi tiết')).not.toBeInTheDocument();

    // Hiển thị đầy đủ danh sách chuyên gia
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
  });

  it('displays search results counter only when filtering', () => {
    render(<TeamDirectoryClient members={mockMembers} />);

    const searchInput = screen.getByPlaceholderText('Tìm theo tên chuyên gia, chức vụ...');
    fireEvent.change(searchInput, { target: { value: 'Nguyễn' } });

    // Khi lọc/tìm kiếm, hiển thị số lượng tìm thấy và nút xóa bộ lọc
    expect(screen.getByText(/Tìm thấy/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xóa bộ lọc/i })).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.queryByText('Trần Thị B')).not.toBeInTheDocument();
  });
});
