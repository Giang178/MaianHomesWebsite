'use client';
/* eslint-disable @next/next/no-img-element -- User-managed preview URLs require native image behavior. */

import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getAssetUrl } from '@/lib/api';
import { articleApi } from '@/features/content/api';
import { ArticleItem } from './NewsListClient';
import ArticleContent, { sanitizeArticleHtml } from '@/features/content/public/ArticleContent';
import { Calendar, Eye, Clock, ChevronRight, ArrowRight, ChevronDown, ChevronUp, ShieldCheck, Sparkles, Building2 } from 'lucide-react';

interface RevisionItem {
  version: number;
  updated_by_email?: string;
  note?: string;
  created_at?: string;
}

interface LinkedProject {
  id: string;
  name: string;
  slug: string;
  developer: string;
  location: string;
  price_range: string;
  status: string;
  hero_image?: string;
}

interface ArticleDetailClientProps {
  article: ArticleItem;
  linkedProject?: LinkedProject | null;
  relatedArticles: ArticleItem[];
  revisions: RevisionItem[];
  isPreview?: boolean;
}

export default function ArticleDetailClient({
  article,
  linkedProject,
  relatedArticles,
  revisions,
  isPreview = false,
}: ArticleDetailClientProps) {
  const [tocOpen, setTocOpen] = useState(false);
  const isMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  // Tính thời gian đọc (trung bình 200 từ/phút)
  const sanitizedArticleContent = useMemo(() => {
    return sanitizeArticleHtml(article.content || '');
  }, [article.content]);

  const formatDate = (value?: string) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const readingTime = useMemo(() => {
    const text = (article.sapo || '') + ' ' + (article.content || '');
    const wordCount = text.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 200));
  }, [article]);

  const articleBody = useMemo(() => {
    if (!isMounted || typeof window === 'undefined') {
      return { html: sanitizedArticleContent, headings: [] as Array<{ id: string; text: string; level: number }> };
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedArticleContent, 'text/html');
    const headings = Array.from(doc.querySelectorAll('h2, h3')).map((el, idx) => {
      const id = el.id || `heading-${idx}`;
      el.id = id;
      return {
        id,
        text: el.textContent || `Mục ${idx + 1}`,
        level: el.tagName.toLowerCase() === 'h2' ? 2 : 3,
      };
    });
    return { html: doc.body.innerHTML, headings };
  }, [sanitizedArticleContent, isMounted]);
  const headings = articleBody.headings;

  // Theo dõi Lượt đọc thực chất (Engaged Reader Tracking: ở lại trang ≥ 5s & cuộn ≥ 25%)
  useEffect(() => {
    if (typeof window === 'undefined' || !article.id || isPreview) return;

    const sessionKey = `view_tracked_${article.id}`;
    if (sessionStorage.getItem(sessionKey)) return;

    let timeMet = false;
    let scrollMet = false;
    let tracked = false;

    const checkAndTrack = () => {
      if (timeMet && scrollMet && !tracked) {
        tracked = true;
        sessionStorage.setItem(sessionKey, 'true');
        articleApi.trackView(article.slug || article.id).catch(() => {});
      }
    };

    const timer = setTimeout(() => {
      timeMet = true;
      checkAndTrack();
    }, 5000);

    const handleScroll = () => {
      if (scrollMet) return;
      const scrollPosition = window.scrollY + window.innerHeight;
      const totalHeight = document.documentElement.scrollHeight;
      if (scrollPosition / totalHeight >= 0.25) {
        scrollMet = true;
        checkAndTrack();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [article.id, article.slug, isPreview]);

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'internal':
        return 'Tin Nội Bộ & Sự Kiện';
      case 'market':
        return 'Phân Tích Thị Trường';
      case 'project':
        return 'Dự Án Trọng Điểm';
      default:
        return 'Tin Tức';
    }
  };

  const featuredImg =
    article.gallery && article.gallery.length > 0 ? article.gallery[0] : null;

  const getImageUrl = (url?: string) =>
    getAssetUrl(url) || '/images/default-project.jpg';

  // Sắp xếp lịch sử cập nhật
  const sortedRevisions = useMemo(() => {
    return [...revisions].sort((a, b) => b.version - a.version);
  }, [revisions]);

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#15243b] pt-24 sm:pt-32 pb-20 sm:pb-28 px-4 sm:px-6 lg:px-8 font-sans selection:bg-[#D4AF37]/20 selection:text-[#15243b]">
      <div className="max-w-7xl mx-auto">
        
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="mb-8 text-xs text-slate-500 flex flex-wrap items-center gap-2 font-medium"
        >
          <Link href="/" className="hover:text-[#B88A29] transition-colors" aria-label="Breadcrumb: Về trang chủ Maian Homes">
            Trang chủ
          </Link>
          <ChevronRight className="size-3 text-slate-400" />
          <Link href="/tin_tuc" className="hover:text-[#B88A29] transition-colors" aria-label="Breadcrumb: Về trang tin tức Maian Homes">
            Tin tức &amp; Phân tích
          </Link>
          <ChevronRight className="size-3 text-slate-400" />
          <span className="text-[#B88A29] truncate max-w-[200px] sm:max-w-xs font-bold">
            {getCategoryLabel(article.category)}
          </span>
        </nav>

        {/* Article Header */}
        <header className="mb-10 max-w-4xl border-b border-slate-200/80 pb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#B88A29]/10 text-[#B88A29]">
              <Sparkles className="size-3" />
              {getCategoryLabel(article.category)}
            </span>
            <span className="text-slate-300">•</span>
            <span className="inline-flex items-center gap-1 text-slate-500 font-normal text-xs">
              <Clock className="size-3.5 text-slate-400" />
              Thời gian đọc: ~{readingTime} phút
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-[#15243b] leading-[1.2] mb-6">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-4 sm:gap-6 text-xs text-slate-600 pt-5 border-t border-slate-200/80">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-[#15243b] text-[#D4AF37] ring-2 ring-[#D4AF37]/30 flex items-center justify-center font-serif font-bold text-base shadow-xs">
                {(article.author_name || 'M')[0]}
              </div>
              <div>
                <span className="block font-bold text-[#15243b] tracking-wide text-xs">
                  {article.author_name || 'Maian Homes Research'}
                </span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Ban Biên Tập &amp; Phân Tích Thị Trường
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs font-normal">
              <div className="flex items-center gap-1.5">
                <Calendar className="size-3.5 text-slate-400" />
                <div>
                  <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                    Xuất bản ngày
                  </span>
                  <time dateTime={article.published_at} className="font-bold text-[#15243b]">
                    {formatDate(article.published_at)}
                  </time>
                </div>
              </div>

              {article.view_count !== undefined && article.view_count > 0 && (
                <div className="border-l border-slate-200 pl-6 flex items-center gap-1.5">
                  <Eye className="size-3.5 text-slate-400" />
                  <div>
                    <span className="block text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                      Lượt quan tâm
                    </span>
                    <span className="font-bold text-[#15243b]">{article.view_count} lượt đọc</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Featured Sapo (Editorial Pull-Quote Style) */}
        {article.sapo && (
          <div className="max-w-4xl mb-12 border-l-4 border-[#D4AF37] bg-white rounded-r-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(21,36,59,0.04)] border border-l-0 border-slate-200/80">
            <p className="text-lg sm:text-xl md:text-2xl font-serif italic text-[#15243b] leading-relaxed font-normal">
              {article.sapo}
            </p>
          </div>
        )}

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          
          {/* Left Column (8 cols): Article Body */}
          <main className="lg:col-span-8 bg-white p-6 sm:p-10 lg:p-12 rounded-3xl border border-slate-200/90 shadow-[0_8px_30px_rgba(21,36,59,0.04)]">
            
            {/* Featured Image */}
            {featuredImg && (
              <figure className="mb-10 -mx-6 sm:-mx-10 lg:-mx-12 -mt-6 sm:-mt-10 lg:-mt-12 overflow-hidden rounded-t-3xl bg-slate-100 border-b border-slate-200/80">
                <img
                  src={getImageUrl(featuredImg.url)}
                  alt={featuredImg.alt_text || article.title}
                  className="w-full max-h-[520px] object-cover"
                />
                {(featuredImg.caption || featuredImg.credit) && (
                  <figcaption className="p-3.5 bg-slate-50/90 border-t border-slate-200/70 text-center text-xs text-slate-500 italic font-serif">
                    {featuredImg.caption && <span>{featuredImg.caption}</span>}
                    {featuredImg.credit && (
                      <span className="ml-2 text-slate-400 not-italic">
                        (Nguồn: {featuredImg.credit})
                      </span>
                    )}
                  </figcaption>
                )}
              </figure>
            )}

            {/* Table of Contents (TOC) Accordion for Mobile/Tablet (<1024px) */}
            {headings.length > 0 && (
              <div className="block lg:hidden mb-10 bg-[#FAF9F5] border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setTocOpen(!tocOpen)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left font-serif font-bold text-[#15243b] min-h-[44px] cursor-pointer"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="size-2 rounded-full bg-[#D4AF37]"></span>
                    <span>Mục Lục Phân Tích</span>
                  </span>
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-sans flex items-center gap-1">
                    {tocOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </span>
                </button>

                {tocOpen && (
                  <div className="px-5 pb-5 pt-2 border-t border-slate-200/80 space-y-2 text-xs">
                    {headings.map((h) => (
                      <a
                        key={h.id}
                        href={`#${h.id}`}
                        onClick={() => setTocOpen(false)}
                        className={`block text-slate-600 hover:text-[#B88A29] py-1 transition-colors min-h-[32px] flex items-center ${
                          h.level === 3 ? 'pl-4 font-normal italic' : 'font-semibold'
                        }`}
                      >
                        {h.text}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Rich Text Body */}
            <ArticleContent
              html={articleBody.html}
              className="prose sm:prose-lg max-w-none text-[#15243b] font-normal leading-[1.85] space-y-6 prose-headings:font-serif prose-headings:font-bold prose-headings:text-[#15243b] prose-a:text-[#B88A29] prose-a:underline hover:prose-a:text-[#15243b] prose-img:rounded-2xl prose-img:border prose-img:border-slate-200 prose-blockquote:border-l-4 prose-blockquote:border-[#D4AF37] prose-blockquote:bg-slate-50/70 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:italic prose-blockquote:text-[#15243b] prose-blockquote:font-serif prose-blockquote:rounded-r-2xl"
              style={{ fontSize: '16px' }}
            />

            {/* Revision / Update History Block */}
            {sortedRevisions.length > 1 && (
              <div className="mt-14 pt-8 border-t border-slate-200/80">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="size-4 text-[#B88A29]" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#15243b]">
                    Minh Bạch Dữ Liệu &amp; Lịch Sử Chỉnh Sửa
                  </p>
                </div>
                <p className="text-xs text-slate-500 mb-5 font-normal leading-relaxed">
                  Để bảo đảm tính chính xác cho các nhà đầu tư và hệ thống AI Answer Engines, bài phân tích này ghi nhận toàn bộ các lần kiểm chứng và bổ sung dữ liệu:
                </p>
                <div className="space-y-2.5">
                  {sortedRevisions.map((rev) => (
                    <div
                      key={rev.version}
                      className="flex items-start justify-between text-xs bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70"
                    >
                      <div>
                        <span className="font-bold text-[#15243b] uppercase tracking-wider text-[11px]">
                          Bản thảo v{rev.version}
                        </span>
                        {rev.note && (
                          <span className="text-slate-600 ml-2.5 font-normal">
                            — {rev.note}
                          </span>
                        )}
                      </div>
                      <time className="text-slate-400 shrink-0 ml-4 font-medium">
                        {formatDate(rev.created_at)}
                      </time>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </main>

          {/* Right Sidebar (4 cols) */}
          <aside className="lg:col-span-4 space-y-8 lg:sticky lg:top-28">
            
            {/* Sticky Table of Contents for PC/Laptop (>1024px) */}
            {headings.length > 0 && (
              <div className="hidden lg:block bg-white p-6 rounded-3xl border border-slate-200/90 shadow-[0_8px_30px_rgba(21,36,59,0.04)]">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                  <span className="size-2 rounded-full bg-[#D4AF37]"></span>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#15243b]">
                    Mục Lục Phân Tích
                  </p>
                </div>
                <nav className="space-y-1.5 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
                  {headings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      className={`block text-xs text-slate-600 hover:text-[#B88A29] py-1.5 transition-colors leading-snug ${
                        h.level === 3
                          ? 'pl-4 font-normal italic text-[11px]'
                          : 'font-semibold'
                      }`}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            {/* Linked Project Box (Luxury Dossier Box) */}
            {linkedProject && (
              <div className="bg-[#15243b] text-white p-6 sm:p-8 rounded-3xl border border-[#D4AF37]/40 shadow-xl relative overflow-hidden group">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#D4AF37] flex items-center gap-1.5">
                    <Building2 className="size-3.5" />
                    Dự Án Trọng Điểm
                  </span>
                  <span className="h-px w-8 bg-[#D4AF37]/40"></span>
                </div>

                <h2 className="text-2xl font-serif font-bold text-white mb-4 group-hover:text-[#D4AF37] transition-colors">
                  {linkedProject.name}
                </h2>

                <div className="space-y-3 text-xs text-slate-200 mb-6 border-y border-white/15 py-4 divide-y divide-white/10">
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-400 font-normal">Chủ đầu tư:</span>
                    <span className="font-semibold text-white text-right">
                      {linkedProject.developer || 'Maian Homes'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2.5">
                    <span className="text-slate-400 font-normal">Vị trí:</span>
                    <span className="font-semibold text-white text-right max-w-[60%] truncate">
                      {linkedProject.location || 'Việt Nam'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2.5">
                    <span className="text-slate-400 font-normal">Mức giá:</span>
                    <span className="font-bold text-[#D4AF37] text-right">
                      {linkedProject.price_range || 'Đang cập nhật'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2.5">
                    <span className="text-slate-400 font-normal">Trạng thái:</span>
                    <span className="font-semibold text-emerald-400 text-right uppercase tracking-wider text-[10px]">
                      {linkedProject.status}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/du_an/${linkedProject.slug}`}
                  className="w-full py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] hover:from-[#B88A29] hover:to-[#D4AF37] text-[#15243b] font-bold text-xs uppercase tracking-[0.2em] rounded-full transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg min-h-[44px] active:scale-95"
                >
                  <span>Khám Phá Hồ Sơ Dự Án</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            )}

            {/* Related Articles Box */}
            {relatedArticles.length > 0 && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-[0_8px_30px_rgba(21,36,59,0.04)]">
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-100">
                  <span className="size-2 rounded-full bg-[#15243b]"></span>
                  <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-[#15243b]">
                    Tin Tức &amp; Phân Tích Liên Quan
                  </h2>
                </div>

                <div className="space-y-4 divide-y divide-slate-100">
                  {relatedArticles.map((rel) => (
                    <article key={rel.id} className="pt-4 first:pt-0 group">
                      <Link href={`/tin_tuc/${rel.slug}`} className="flex gap-4 items-start" aria-label={`Xem bài viết liên quan: ${rel.title}`}>
                        <div className="w-20 aspect-[4/3] rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-100">
                          <img
                            src={getImageUrl(rel.gallery?.[0]?.url)}
                            alt={rel.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#B88A29] block mb-1">
                            {getCategoryLabel(rel.category)}
                          </span>
                          <h3 className="text-sm font-serif font-bold text-[#15243b] group-hover:text-[#B88A29] transition-colors line-clamp-2 leading-snug">
                            {rel.title}
                          </h3>
                          <time
                            className="text-[10px] text-slate-400 font-medium block mt-1"
                            dateTime={rel.published_at}
                          >
                            {formatDate(rel.published_at)}
                          </time>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            )}

          </aside>

        </div>

      </div>
    </div>
  );
}
