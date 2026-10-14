import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NewsListClient, { type ArticleItem } from './NewsListClient';

const mockArticles: ArticleItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `art-${i + 1}`,
  title: `Bài viết phân tích thị trường số ${i + 1}`,
  slug: `bai-viet-so-${i + 1}`,
  category: i % 3 === 0 ? 'project' : i % 3 === 1 ? 'market' : 'internal',
  sapo: `Tóm tắt bài viết số ${i + 1} về thị trường bất động sản cao cấp.`,
  content: `<p>Nội dung chi tiết của bài viết số ${i + 1}.</p>`,
  author_name: 'Ban Nghiên Cứu',
  published_at: new Date(2026, 8, 18 - i).toISOString(),
  view_count: (i + 1) * 100,
}));

describe('NewsListClient', () => {
  it('renders masthead, search toolbar, spotlight bento and archive grid', () => {
    render(<NewsListClient initialArticles={mockArticles} />);

    // Masthead header
    expect(screen.getByRole('heading', { level: 1, name: /Tin Tức & Phân Tích/i })).toBeInTheDocument();

    // Search input
    expect(screen.getByPlaceholderText('Tìm bài viết, dự án, phân tích...')).toBeInTheDocument();

    // Spotlight hero article (first article)
    expect(screen.getByText('Bài viết phân tích thị trường số 1')).toBeInTheDocument();

    // Briefing Suite (articles 2, 3, 4)
    expect(screen.getByText('Tiêu Điểm Đồng Hành')).toBeInTheDocument();
    expect(screen.getByText('Bài viết phân tích thị trường số 2')).toBeInTheDocument();
    expect(screen.getByText('Bài viết phân tích thị trường số 3')).toBeInTheDocument();
    expect(screen.getByText('Bài viết phân tích thị trường số 4')).toBeInTheDocument();

    // Archive grid header
    expect(screen.getByRole('heading', { level: 2, name: 'Kho Lưu Trữ Bài Viết' })).toBeInTheDocument();
  });

  it('filters articles by search query and shows reset button', () => {
    render(<NewsListClient initialArticles={mockArticles} />);

    const searchInput = screen.getByPlaceholderText('Tìm bài viết, dự án, phân tích...');
    fireEvent.change(searchInput, { target: { value: 'số 5' } });

    expect(screen.getByText(/Tìm thấy/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xóa bộ lọc/i })).toBeInTheDocument();
    expect(screen.getByText('Bài viết phân tích thị trường số 5')).toBeInTheDocument();
    expect(screen.queryByText('Bài viết phân tích thị trường số 1')).not.toBeInTheDocument();

    // Reset filters
    fireEvent.click(screen.getByRole('button', { name: /Xóa bộ lọc/i }));
    expect(screen.getByText('Bài viết phân tích thị trường số 1')).toBeInTheDocument();
  });

  it('filters articles by category tabs', () => {
    render(<NewsListClient initialArticles={mockArticles} />);

    const projectTab = screen.getByRole('button', { name: /Dự Án Trọng Điểm/i });
    fireEvent.click(projectTab);

    // Filter indicator
    expect(screen.getByText(/thuộc/i)).toBeInTheDocument();
    expect(screen.getAllByText('Dự Án Trọng Điểm').length).toBeGreaterThan(0);
  });

  it('does not render sort buttons for "Mới nhất" and "Đọc nhiều"', () => {
    render(<NewsListClient initialArticles={mockArticles} />);
    expect(screen.queryByRole('button', { name: /Mới nhất/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Đọc nhiều/i })).not.toBeInTheDocument();
  });

  it('filters articles by "Thị Trường" category tab', () => {
    render(<NewsListClient initialArticles={mockArticles} />);

    const marketTab = screen.getByRole('button', { name: /Thị Trường/i });
    fireEvent.click(marketTab);

    expect(screen.getByText(/thuộc/i)).toBeInTheDocument();
    expect(screen.getAllByText('Thị Trường').length).toBeGreaterThan(0);
  });
});
