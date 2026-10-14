'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getAssetUrl } from '@/lib/api';
import {
  ArrowRight,
  ArrowDown,
  ArrowUpRight,
  Eye,
  Calendar,
  User,
  Newspaper,
  Search,
  X,
  RotateCcw,
  Clock,
  Building2,
  BookOpen,
  Compass,
} from 'lucide-react';

export interface ArticleItem {
  id: string;
  title: string;
  slug: string;
  category: 'internal' | 'market' | 'project';
  project_id?: string;
  sapo: string;
  content: string;
  featured_image_id?: string;
  gallery?: Array<{ id?: string; media_id?: string; url: string; alt_text?: string; caption?: string; credit?: string }>;
  published_at?: string;
  updated_at?: string;
  author_name?: string;
  view_count?: number;
}

type NewsCategory = ArticleItem['category'] | 'all';

interface NewsListClientProps {
  initialArticles: ArticleItem[];
  pageTitle?: string;
  pageDescription?: string;
}

const CATEGORY_TABS: Array<{
  id: NewsCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'all', label: 'Tất Cả Bài Viết', icon: Newspaper },
  { id: 'project', label: 'Dự Án Trọng Điểm', icon: Building2 },
  { id: 'market', label: 'Thị Trường', icon: Compass },
  { id: 'internal', label: 'Tin Nội Bộ & Sự Kiện', icon: BookOpen },
];

function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export default function NewsListClient({ initialArticles, pageTitle = 'Tin Tức & Phân Tích', pageDescription = 'Dữ liệu thị trường minh bạch, góc nhìn chuyên sâu và thông tin dự án bất động sản cao cấp được thẩm định bởi đội ngũ chuyên gia Maian Homes.' }: NewsListClientProps) {
  const [activeTab, setActiveTab] = useState<NewsCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(9);

  // Tính số lượng bài viết theo từng chuyên mục
  const categoryCounts = useMemo(() => {
    const counts = { all: initialArticles.length, project: 0, market: 0, internal: 0 };
    initialArticles.forEach((item) => {
      if (item.category && counts[item.category] !== undefined) {
        counts[item.category] += 1;
      }
    });
    return counts;
  }, [initialArticles]);

  // Lọc và sắp xếp bài viết (mới nhất lên đầu)
  const filteredArticles = useMemo(() => {
    return initialArticles
      .filter((item) => {
        const matchesCategory = activeTab === 'all' || item.category === activeTab;
        const q = removeVietnameseTones(searchQuery.trim());
        const matchesSearch = !q
          ? true
          : removeVietnameseTones(item.title || '').includes(q) ||
            removeVietnameseTones(item.sapo || '').includes(q) ||
            removeVietnameseTones(item.author_name || '').includes(q);

        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const dateA = new Date(a.published_at || 0).getTime();
        const dateB = new Date(b.published_at || 0).getTime();
        return dateB - dateA;
      });
  }, [initialArticles, activeTab, searchQuery]);

  // Khối nổi bật (Hero Lead Story & Briefing Suite)
  const featuredLarge = filteredArticles[0];
  const featuredSide = filteredArticles.slice(1, 4);

  // Lưới bài viết lưu trữ (Archive Grid)
  const gridArticles = filteredArticles.slice(4, 4 + visibleCount);
  const hasMore = 4 + visibleCount < filteredArticles.length;

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'internal':
        return 'Tin Nội Bộ & Sự Kiện';
      case 'market':
        return 'Thị Trường';
      case 'project':
        return 'Dự Án Trọng Điểm';
      default:
        return 'Tin Tức';
    }
  };

  const getImageUrl = (item?: ArticleItem) => {
    if (!item) return '/images/banner.jpg';
    if (item.gallery && item.gallery.length > 0 && item.gallery[0].url) {
      return getAssetUrl(item.gallery[0].url) || '/images/banner.jpg';
    }
    return '/images/banner.jpg';
  };

  const formatArticleDate = (date?: string) => {
    if (!date) return 'Vừa cập nhật';
    return new Date(date).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const calculateReadingTime = (text?: string) => {
    if (!text) return '3 phút đọc';
    const words = text.replace(/<[^>]*>/g, '').trim().split(/\s+/).length;
    const mins = Math.max(2, Math.round(words / 150));
    return `${mins} phút đọc`;
  };

  const isFiltering = activeTab !== 'all' || !!searchQuery.trim();

  const handleResetFilters = () => {
    setActiveTab('all');
    setSearchQuery('');
    setVisibleCount(9);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#15243b] pt-14 sm:pt-20 lg:pt-24 pb-16 sm:pb-28 px-3.5 sm:px-6 lg:px-8 font-sans selection:bg-[#D4AF37]/20 selection:text-[#15243b]">
      <div className="max-w-7xl mx-auto">

        {/* ── 1. EDITORIAL HERO MASTHEAD ── */}
        <header className="border-b border-slate-200/80 pb-5 sm:pb-10 mb-5 sm:mb-8 text-left flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-6">
          <div>
            <div className="flex items-center justify-start gap-2 mb-2 sm:mb-3">
              <span className="h-0.5 w-5 sm:w-8 bg-[#D4AF37] rounded-full" />
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] font-bold text-[#B88A29]">
                Maian Homes Research & Insights
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold text-[#15243b] tracking-tight leading-tight">
              {pageTitle}
            </h1>
          </div>
          <p className="text-xs sm:text-sm md:text-base text-slate-600 max-w-lg font-light leading-relaxed">
            {pageDescription}
          </p>
        </header>

        {/* ── 2. SMART SEARCH & FILTER TOOLBAR ── */}
        <div className="bg-white/95 rounded-2xl sm:rounded-3xl border border-slate-200/90 p-2.5 sm:p-4 mb-6 sm:mb-12 shadow-xs backdrop-blur-md">
          {/* Hàng 1: Ô tìm kiếm toàn chiều rộng */}
          <div className="relative mb-2.5 sm:mb-3">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm bài viết, dự án, phân tích..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(9);
              }}
              className="w-full rounded-xl sm:rounded-2xl border border-slate-200/90 bg-slate-50/70 py-2 sm:py-2.5 pl-8 sm:pl-10 pr-8 sm:pr-9 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#B88A29] focus:bg-white focus:ring-2 focus:ring-[#B88A29]/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Hàng 2: Tabs chuyên mục - Bố cục Lưới 2x2 Bento trên Mobile, Dải Pill linh hoạt trên Desktop */}
          <div className="pt-2 sm:pt-2.5 border-t border-slate-100">
            {/* Header chuyên mục nhỏ trên Mobile */}
            <div className="flex items-center justify-between mb-2 px-0.5 sm:hidden">
              <span className="text-[10px] uppercase tracking-[0.15em] font-bold text-slate-400">
                Chuyên Mục Bài Viết
              </span>
              <span className="text-[10px] font-medium text-[#B88A29]">
                {categoryCounts[activeTab] || 0} bài viết
              </span>
            </div>

            <nav aria-label="Chuyên mục bài viết" className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2">
              {CATEGORY_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const count = categoryCounts[tab.id] || 0;
                const IconComponent = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setVisibleCount(9);
                    }}
                    className={`group/tab relative flex flex-col sm:flex-row justify-between sm:justify-start items-stretch sm:items-center gap-1.5 sm:gap-2 p-2.5 sm:px-3.5 sm:py-1.5 rounded-xl sm:rounded-full text-xs font-semibold transition-all cursor-pointer text-left min-h-[64px] sm:min-h-0 active:scale-[0.98] sm:active:scale-95 ${
                      isActive
                        ? 'bg-[#15243b] text-white shadow-sm border border-[#D4AF37] ring-1 ring-[#D4AF37]/30 sm:ring-0'
                        : 'bg-slate-50/90 hover:bg-slate-100 text-slate-700 border border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    {/* Hàng trên trên mobile: Icon (trái) và Badge số lượng (phải) */}
                    <div className="flex items-center justify-between sm:contents">
                      <div
                        className={`p-1 sm:p-0 rounded-lg sm:rounded-none shrink-0 transition-colors ${
                          isActive
                            ? 'bg-white/10 sm:bg-transparent text-[#D4AF37]'
                            : 'bg-slate-200/70 sm:bg-transparent text-slate-500'
                        }`}
                      >
                        <IconComponent className="size-3.5" />
                      </div>

                      {/* Badge hiển thị ở góc trên bên phải trên mobile */}
                      <span
                        className={`sm:hidden text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none shrink-0 ${
                          isActive
                            ? 'bg-[#D4AF37] text-slate-950'
                            : 'bg-white text-slate-600 border border-slate-200/80 shadow-2xs'
                        }`}
                      >
                        {count}
                      </span>
                    </div>

                    {/* Tên chuyên mục */}
                    <span
                      className={`text-[11.5px] sm:text-xs font-semibold leading-tight line-clamp-2 sm:line-clamp-none ${
                        isActive ? 'text-white' : 'text-slate-800 sm:text-slate-600'
                      }`}
                    >
                      {tab.label}
                    </span>

                    {/* Badge hiển thị cuối pill trên desktop */}
                    <span
                      className={`hidden sm:inline-flex text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-none shrink-0 ${
                        isActive
                          ? 'bg-[#D4AF37] text-slate-950 font-bold'
                          : 'bg-white text-slate-500 shadow-xs'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Thanh trạng thái kết quả lọc & Xóa bộ lọc */}
        {isFiltering && (
          <div className="mb-5 sm:mb-6 flex items-center justify-between px-1 text-xs font-medium text-slate-600 animate-in fade-in duration-200">
            <span className="truncate pr-2">
              Tìm thấy <strong className="font-bold text-[#15243b]">{filteredArticles.length}</strong> bài viết
              {searchQuery && <> phù hợp &ldquo;<strong className="text-[#B88A29]">{searchQuery}</strong>&rdquo;</>}
              {activeTab !== 'all' && <> thuộc <strong className="text-[#B88A29]">{getCategoryLabel(activeTab)}</strong></>}
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 font-semibold text-[#B88A29] hover:text-[#15243b] transition-colors cursor-pointer text-xs shrink-0"
            >
              <RotateCcw className="size-3" />
              <span>Xóa bộ lọc</span>
            </button>
          </div>
        )}

        {/* ── 3. DANH SÁCH BÀI VIẾT ── */}
        {filteredArticles.length === 0 ? (
          <div className="text-center py-12 sm:py-24 px-5 sm:px-6 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs max-w-xl mx-auto my-4 sm:my-6">
            <div className="w-12 sm:w-14 h-12 sm:h-14 rounded-full bg-[#FAF8F2] text-[#B88A29] flex items-center justify-center mx-auto mb-3 sm:mb-4 border border-[#D4AF37]/30">
              <Newspaper className="size-6 sm:size-7" />
            </div>
            <h2 className="text-base sm:text-xl font-serif font-bold text-[#15243b] mb-1.5 sm:mb-2">
              {isFiltering ? 'Chưa tìm thấy bài viết phù hợp' : 'Chuyên mục đang được cập nhật'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed mb-5 sm:mb-6">
              {isFiltering
                ? 'Vui lòng thử tìm kiếm với từ khóa khác hoặc chọn chuyên mục bài viết khác để xem thêm nội dung.'
                : 'Các bài viết phân tích thị trường và tin tức mới nhất sẽ sớm được ban biên tập Maian Homes phát hành.'}
            </p>
            {isFiltering && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 rounded-full bg-[#15243b] px-5 sm:px-6 py-2 sm:py-2.5 text-xs font-bold text-white hover:bg-[#B88A29] transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                Xem tất cả bài viết ({initialArticles.length})
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── KHỐI TIÊU ĐIỂM (EDITORIAL SPOTLIGHT BENTO) ── */}
            {featuredLarge && (
              <section aria-label="Tiêu điểm bài viết" className="mb-8 sm:mb-16 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-stretch">
                
                {/* Cột trái: Bài viết tiêu điểm lớn (Hero Lead Story) */}
                <article className={`${featuredSide.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12 max-w-4xl mx-auto w-full'} group flex flex-col justify-between h-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3.5 sm:p-6 lg:p-7 shadow-[0_8px_30px_rgba(21,36,59,0.05)] hover:shadow-[0_20px_50px_rgba(212,175,55,0.14)] hover:border-[#D4AF37]/50 transition-all duration-300 active:scale-[0.99] sm:active:scale-100`}>
                  <div>
                    {/* Ảnh bài viết tỉ lệ 16/10 trên mobile, 16/9 trên desktop */}
                    <Link
                      href={`/tin_tuc/${featuredLarge.slug}`}
                      className="block overflow-hidden rounded-xl sm:rounded-2xl relative aspect-[16/10] sm:aspect-[16/9] mb-3.5 sm:mb-5 bg-slate-100 border border-slate-100 group/img"
                      aria-label={`Hình ảnh bài viết tiêu điểm: ${featuredLarge.title}`}
                    >
                      <Image
                        src={getImageUrl(featuredLarge)}
                        alt={featuredLarge.title}
                        fill
                        priority
                        sizes="(max-width: 1024px) 95vw, 60vw"
                        className="object-cover group-hover/img:scale-105 transition-transform duration-700 ease-out"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent pointer-events-none" />

                      {/* Badge trên ảnh */}
                      <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 z-10 flex items-center gap-2">
                        <span className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider bg-[#15243b]/90 text-[#F3E5AB] backdrop-blur-md border border-[#D4AF37]/50 shadow-sm">
                          {getCategoryLabel(featuredLarge.category)}
                        </span>
                      </div>

                      {/* Thời gian đọc ở góc dưới ảnh */}
                      <div className="absolute bottom-2.5 sm:bottom-3 left-2.5 sm:left-3 z-10 flex items-center gap-1.5 text-white/95 text-[10.5px] sm:text-[11px] font-medium drop-shadow-md">
                        <Clock className="size-3 text-[#F3E5AB]" />
                        <span>{calculateReadingTime(featuredLarge.content || featuredLarge.sapo)}</span>
                      </div>
                    </Link>

                    {/* Metadata: Ngày đăng & Tác giả */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] sm:text-xs mb-2 sm:mb-3 text-slate-500">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Calendar className="size-3 sm:size-3.5 text-[#B88A29]" />
                        <time dateTime={featuredLarge.published_at}>
                          {formatArticleDate(featuredLarge.published_at)}
                        </time>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 font-medium">
                        <User className="size-3 sm:size-3.5 text-[#B88A29]" />
                        <span>{featuredLarge.author_name || 'Ban Nghiên Cứu'}</span>
                      </span>
                      {featuredLarge.view_count !== undefined && featuredLarge.view_count > 0 && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1 font-medium text-slate-400">
                            <Eye className="size-3 sm:size-3.5" />
                            <span>{featuredLarge.view_count} xem</span>
                          </span>
                        </>
                      )}
                    </div>

                    {/* Tiêu đề H2 */}
                    <Link href={`/tin_tuc/${featuredLarge.slug}`} className="block" aria-label={`Đọc bài viết tiêu điểm: ${featuredLarge.title}`}>
                      <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-[#15243b] group-hover:text-[#B88A29] transition-colors leading-snug sm:leading-[1.25] mb-2 sm:mb-3">
                        {featuredLarge.title}
                      </h2>
                    </Link>

                    {/* Sapo */}
                    <p className="text-slate-600 text-xs sm:text-sm md:text-base line-clamp-2 sm:line-clamp-3 font-light leading-relaxed mb-4 sm:mb-6">
                      {featuredLarge.sapo}
                    </p>
                  </div>

                  {/* Nút Đọc toàn bộ bài phân tích */}
                  <div className="pt-3 sm:pt-4 border-t border-slate-100">
                    <Link
                      href={`/tin_tuc/${featuredLarge.slug}`}
                      className="inline-flex items-center justify-between text-xs sm:text-sm font-bold uppercase tracking-[0.1em] sm:tracking-[0.12em] text-[#15243b] group-hover:text-[#B88A29] transition-colors w-full group/btn"
                      aria-label={`Đọc toàn bộ bài phân tích chuyên sâu: ${featuredLarge.title}`}
                    >
                      <span className="flex items-center gap-2">
                        <span>Đọc toàn bộ bài phân tích</span>
                      </span>
                      <div className="size-7 sm:size-8 rounded-full bg-slate-100 group-hover:bg-[#B88A29] group-hover:text-white flex items-center justify-center transition-all duration-300 shadow-2xs">
                        <ArrowUpRight className="size-3.5 sm:size-4 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                      </div>
                    </Link>
                  </div>
                </article>

                {/* Cột phải (5 cột): Danh sách tiêu điểm đồng hành (Briefing Suite) */}
                {featuredSide.length > 0 && (
                  <aside className="lg:col-span-5 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3.5 sm:p-6 lg:p-7 flex flex-col justify-between shadow-[0_8px_30px_rgba(21,36,59,0.05)] hover:shadow-[0_20px_50px_rgba(212,175,55,0.1)] transition-all duration-300">
                    <div>
                      {/* Header cột phải */}
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 sm:pb-4 mb-3 sm:mb-5">
                        <div className="flex items-center gap-2">
                          <Compass className="size-3.5 sm:size-4 text-[#B88A29]" />
                          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-[0.12em] sm:tracking-[0.15em] text-[#15243b]">
                            Tiêu Điểm Đồng Hành
                          </h2>
                        </div>
                        <span className="text-[9.5px] sm:text-[10px] uppercase tracking-widest text-[#B88A29] font-bold bg-[#B88A29]/10 px-2 sm:px-2.5 py-0.5 rounded-full">
                          Briefing Suite
                        </span>
                      </div>

                      {/* Danh sách 3 bài viết tiêu điểm kèm THUMBNAIL */}
                      <div className="flex flex-col divide-y divide-slate-100">
                        {featuredSide.map((sideItem, idx) => (
                          <article
                            key={sideItem.id}
                            className="py-3 sm:py-4 first:pt-0 last:pb-0 group/side"
                          >
                            <Link href={`/tin_tuc/${sideItem.slug}`} className="flex gap-2.5 sm:gap-4 items-center active:opacity-85" aria-label={`Đọc bài viết tiêu điểm đồng hành: ${sideItem.title}`}>
                              {/* Số thứ tự mạ vàng */}
                              <span className="font-serif text-base sm:text-2xl font-bold text-[#D4AF37] shrink-0 w-5 sm:w-7 text-center">
                                {String(idx + 1).padStart(2, '0')}
                              </span>

                              {/* Ảnh thumbnail vuông bo góc */}
                              <div className="relative w-14 h-14 sm:w-20 sm:h-20 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                                <Image
                                  src={getImageUrl(sideItem)}
                                  alt={sideItem.title}
                                  fill
                                  sizes="80px"
                                  className="object-cover group-hover/side:scale-108 transition-transform duration-500 ease-out"
                                />
                              </div>

                              {/* Nội dung bên phải thumbnail */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#B88A29]">
                                    {getCategoryLabel(sideItem.category)}
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  <time className="text-[10px] sm:text-[10.5px] text-slate-400 font-medium" dateTime={sideItem.published_at}>
                                    {formatArticleDate(sideItem.published_at)}
                                  </time>
                                </div>
                                <h3 className="text-xs sm:text-sm font-serif font-bold text-[#15243b] group-hover/side:text-[#B88A29] transition-colors line-clamp-2 leading-snug">
                                  {sideItem.title}
                                </h3>
                              </div>
                            </Link>
                          </article>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 sm:mt-5 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-[10.5px] sm:text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Building2 className="size-3 text-[#B88A29]" />
                        <span>Hệ thống phân tích Maian</span>
                      </span>
                      <span className="font-serif italic">Cập nhật 24/7</span>
                    </div>
                  </aside>
                )}

              </section>
            )}

            {/* ── 4. KHO LƯU TRỮ BÀI VIẾT (ARTICLES ARCHIVE GRID) ── */}
            {gridArticles.length > 0 && (
              <section aria-label="Kho lưu trữ bài viết" className="mt-8 sm:mt-14">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 sm:pb-4 mb-4 sm:mb-8">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <BookOpen className="size-4 sm:size-5 text-[#B88A29]" />
                    <h2 className="text-lg sm:text-2xl font-serif font-bold text-[#15243b]">
                      Kho Lưu Trữ Bài Viết
                    </h2>
                  </div>
                  <span className="text-[11px] sm:text-xs text-slate-500 font-medium bg-white border border-slate-200 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-2xs">
                    <strong className="text-[#15243b]">{gridArticles.length}</strong> bài viết
                  </span>
                </div>

                {/* Lưới bài viết: 1 cột mobile, 2 cột tablet/laptop, 3 cột PC */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6 lg:gap-8">
                  {gridArticles.map((item) => (
                    <article
                      key={item.id}
                      className="flex flex-col justify-between group bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-3 sm:p-5 shadow-[0_6px_20px_rgba(21,36,59,0.03)] hover:shadow-[0_16px_36px_rgba(21,36,59,0.08)] hover:border-[#D4AF37]/50 transition-all duration-300 hover:-translate-y-1 active:scale-[0.99] sm:active:scale-100"
                    >
                      <div>
                        {/* Ảnh thumbnail tỉ lệ 16/10 */}
                        <Link
                          href={`/tin_tuc/${item.slug}`}
                          className="block relative aspect-[16/10] overflow-hidden rounded-xl sm:rounded-2xl bg-slate-100 border border-slate-100 mb-2.5 sm:mb-3.5 group/img"
                          aria-label={`Hình ảnh bài viết: ${item.title}`}
                        >
                          <Image
                            src={getImageUrl(item)}
                            alt={item.title}
                            fill
                            sizes="(max-width: 640px) 95vw, (max-width: 1024px) 48vw, 32vw"
                            className="object-cover group-hover/img:scale-105 transition-transform duration-500 ease-out"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />

                          {/* Badge chuyên mục trên ảnh */}
                          <div className="absolute top-2 sm:top-2.5 left-2 sm:left-2.5 z-10">
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider bg-[#15243b]/90 text-[#F3E5AB] backdrop-blur-md border border-[#D4AF37]/40 shadow-xs">
                              {getCategoryLabel(item.category)}
                            </span>
                          </div>

                          {/* Thời lượng đọc */}
                          <div className="absolute bottom-2 sm:bottom-2.5 left-2 sm:left-2.5 z-10 flex items-center gap-1 text-white/95 text-[10px] sm:text-[10.5px] font-medium drop-shadow-sm">
                            <Clock className="size-3 text-[#F3E5AB]" />
                            <span>{calculateReadingTime(item.content || item.sapo)}</span>
                          </div>
                        </Link>

                        {/* Metadata ngày đăng */}
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[10.5px] sm:text-[11px] text-slate-400 mb-1.5 sm:mb-2">
                          <Calendar className="size-3 text-[#B88A29]" />
                          <time dateTime={item.published_at} className="font-medium">
                            {formatArticleDate(item.published_at)}
                          </time>
                          <span className="text-slate-300">•</span>
                          <span className="truncate">{item.author_name || 'Maian Homes'}</span>
                        </div>

                        {/* Tiêu đề bài viết */}
                        <Link href={`/tin_tuc/${item.slug}`} className="block" aria-label={`Đọc bài viết thị trường: ${item.title}`}>
                          <h3 className="text-sm sm:text-base md:text-lg font-serif font-bold text-[#15243b] group-hover:text-[#B88A29] transition-colors line-clamp-2 leading-snug mb-1.5 sm:mb-2">
                            {item.title}
                          </h3>
                        </Link>

                        {/* Sapo tóm tắt: 2 dòng gọn gàng trên mobile */}
                        <p className="text-slate-600 text-xs sm:text-sm line-clamp-2 font-light leading-relaxed mb-3 sm:mb-4">
                          {item.sapo}
                        </p>
                      </div>

                      {/* Chân thẻ: Lượt xem và Nút xem chi tiết */}
                      <div className="pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <Link
                          href={`/tin_tuc/${item.slug}`}
                          className="font-bold uppercase tracking-[0.1em] sm:tracking-[0.12em] text-[11px] sm:text-xs text-[#15243b] group-hover:text-[#B88A29] transition-colors flex items-center gap-1.5"
                          aria-label={`Xem chi tiết bài phân tích: ${item.title}`}
                        >
                          <span>Xem chi tiết</span><span className="sr-only">: {item.title}</span>
                          <ArrowRight className="size-3 sm:size-3.5 text-[#B88A29] group-hover:translate-x-1 transition-transform" />
                        </Link>

                        {item.view_count !== undefined && item.view_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[10.5px] sm:text-[11px]">
                            <Eye className="size-3 sm:size-3.5 text-slate-400" />
                            <span>{item.view_count}</span>
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                {/* Nút Tải thêm bài viết: Full width và chiều cao chạm 44px tối ưu trên mobile */}
                {hasMore && (
                  <div className="text-center mt-8 sm:mt-14 pt-4 sm:pt-6 border-t border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 9)}
                      className="w-full sm:w-auto min-h-[44px] px-6 sm:px-8 py-2.5 sm:py-3 bg-white border border-slate-300 hover:border-[#15243b] hover:bg-[#15243b] text-[#15243b] hover:text-white text-xs font-bold uppercase tracking-[0.12em] sm:tracking-[0.15em] rounded-full shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer inline-flex items-center justify-center gap-2.5 active:scale-95"
                    >
                      <span>Xem thêm ({filteredArticles.length - 4 - visibleCount} bài còn lại)</span>
                      <ArrowDown className="size-3.5 text-[#B88A29]" />
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
