'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import {
  FileText, ImageIcon, Search, Bot, CheckCircle2, ArrowLeft,
  Save, Sparkles, Upload, Trash2, Plus, Eye,
  RefreshCw, ShieldAlert, ShieldCheck, ChevronRight, HelpCircle
} from 'lucide-react';
import { getAssetUrl } from '@/lib/api';
import { articleApi } from '@/features/content/api';
import { aiApi } from '@/features/ai/api';
import ArticleDetailClient from '@/features/news/ArticleDetailClient';
import RichTextEditor from './RichTextEditor';
import ValidationPanel from '@/features/content/shared/ValidationPanel';
import { validateArticleDraft } from '@/features/content/shared/client-validation';
import { noticeAdmin } from '@/components/admin/admin-dialog-service';
import type { ValidationReport } from '@/features/content/contracts/generated';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

export type ArticleCategory = 'internal' | 'market' | 'project';

export interface ArticleGalleryItem {
  media_id?: string;
  url: string;
  alt_text?: string;
  caption?: string;
  credit?: string;
}

export interface ArticleSeoData {
  meta_title?: string;
  meta_description?: string;
  canonical_url?: string;
  focus_keyword?: string;
  keywords?: string[];
}

export interface ArticleFaqItem {
  question: string;
  answer: string;
}

export interface ArticleSourceItem {
  title: string;
  url: string;
  publisher?: string;
}

export interface ArticleInternalLink {
  title: string;
  url: string;
  type: 'project' | 'article';
}

export interface ArticleGeoData {
  answer_summary?: string;
  key_facts: string[];
  faqs: ArticleFaqItem[];
  sources: ArticleSourceItem[];
  internal_links: ArticleInternalLink[];
}

export interface ArticleFormData {
  id?: string;
  _id?: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  project_id?: string;
  sapo: string;
  content: string;
  gallery: ArticleGalleryItem[];
  status?: string;
  workflow_status?: string;
  publication_status?: string;
  version?: number;
  seo: ArticleSeoData;
  geo: ArticleGeoData;
}

export interface ArticleEditorProps {
  initialData?: Partial<ArticleFormData>;
  projects: Array<{ id?: string; _id?: string; name: string; slug: string }>;
  user?: { id?: string; employee_id?: string; name?: string; email?: string };
  isEdit: boolean;
  isSubmitting: boolean;
  autosaveState?: 'idle' | 'saving' | 'saved' | 'dirty' | 'error';
  onSave: (data: ArticleFormData) => Promise<void>;
  onClose: () => void;
  onDraftChange?: (data: ArticleFormData) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const ARTICLE_STEPS = [
  { id: 0, title: 'Nội dung & Biên tập', description: 'Tiêu đề, Sapo 5W1H & Nội dung', icon: FileText },
  { id: 1, title: 'Thư viện Media & Ảnh', description: 'Ảnh đại diện & Alt text SEO', icon: ImageIcon },
  { id: 2, title: 'SEO Google & SERP', description: 'Meta tags & Mô phỏng tìm kiếm', icon: Search },
  { id: 3, title: 'GEO & Trích dẫn AI', description: 'Tóm tắt AI & FAQ Schema', icon: Bot },
] as const;

function generateSlug(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const ARTICLE_FIELD_LOCATIONS: Record<string, { step: string; control: string }> = {
  title: { step: '1. Nội dung', control: 'Tiêu đề bài viết' },
  slug: { step: '1. Nội dung', control: 'Đường dẫn (Slug)' },
  sapo: { step: '1. Nội dung', control: 'Sapo 5W1H' },
  content: { step: '1. Nội dung', control: 'Nội dung chi tiết' },
  category: { step: '1. Nội dung', control: 'Chuyên mục' },
  project_id: { step: '1. Nội dung', control: 'Dự án liên kết' },
  gallery: { step: '2. Media', control: 'Hình ảnh bài viết' },
  'gallery.alt': { step: '2. Media', control: 'Alt text hình ảnh' },
  'seo.meta_title': { step: '3. SEO Google', control: 'Meta Title' },
  'seo.meta_description': { step: '3. SEO Google', control: 'Meta Description' },
  'seo.focus_keyword': { step: '3. SEO Google', control: 'Từ khóa chính' },
  'seo.canonical_url': { step: '3. SEO Google', control: 'Canonical URL' },
  'geo.answer_summary': { step: '4. GEO AI', control: 'Answer Summary' },
  'geo.key_facts': { step: '4. GEO AI', control: 'Dữ kiện Key Facts' },
  'geo.faqs': { step: '4. GEO AI', control: 'FAQ Schema' },
  'geo.sources': { step: '4. GEO AI', control: 'Nguồn tham khảo' },
};

function resolveArticleLocation(issue: { field: string }): { step: string; control: string } {
  if (ARTICLE_FIELD_LOCATIONS[issue.field]) {
    return ARTICLE_FIELD_LOCATIONS[issue.field];
  }
  if (issue.field.startsWith('gallery')) {
    return { step: '2. Media', control: 'Alt text ảnh' };
  }
  if (issue.field.startsWith('seo.')) {
    return { step: '3. SEO Google', control: issue.field.replace('seo.', '') };
  }
  if (issue.field.startsWith('geo.')) {
    return { step: '4. GEO AI', control: issue.field.replace('geo.', '') };
  }
  return { step: 'Biểu mẫu', control: issue.field };
}

export default function ArticleEditor({
  initialData,
  projects,
  user,
  isEdit,
  isSubmitting,
  autosaveState = 'idle',
  onSave,
  onClose,
  onDraftChange,
  onDirtyChange,
}: ArticleEditorProps) {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [uploadingImg, setUploadingImg] = useState(false);
  const [generatingSeoGeo, setGeneratingSeoGeo] = useState(false);
  const [showQualityDock, setShowQualityDock] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form States
  const [title, setTitle] = useState(initialData?.title || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [category, setCategory] = useState<ArticleCategory>(initialData?.category || 'market');
  const [projectId, setProjectId] = useState(initialData?.project_id || '');
  const [sapo, setSapo] = useState(initialData?.sapo || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [gallery, setGallery] = useState<ArticleGalleryItem[]>(initialData?.gallery || []);
  const [seo, setSeo] = useState<ArticleSeoData>({
    meta_title: initialData?.seo?.meta_title || '',
    meta_description: initialData?.seo?.meta_description || '',
    canonical_url: initialData?.seo?.canonical_url || '',
    focus_keyword: initialData?.seo?.focus_keyword || '',
    keywords: initialData?.seo?.keywords || [],
  });
  const [geo, setGeo] = useState<ArticleGeoData>({
    answer_summary: initialData?.geo?.answer_summary || '',
    key_facts: initialData?.geo?.key_facts || ['', '', ''],
    faqs: initialData?.geo?.faqs && initialData.geo.faqs.length > 0
      ? initialData.geo.faqs
      : [{ question: '', answer: '' }],
    sources: initialData?.geo?.sources && initialData.geo.sources.length > 0
      ? initialData.geo.sources
      : [{ title: '', url: '', publisher: '' }],
    internal_links: initialData?.geo?.internal_links || [],
  });

  useEffect(() => {
    onDraftChange?.({
      title,
      slug,
      category,
      project_id: projectId || undefined,
      sapo,
      content,
      gallery,
      seo,
      geo,
    });
  }, [title, slug, category, projectId, sapo, content, gallery, seo, geo, onDraftChange]);

  // Track Dirty State without marking a freshly opened editor as modified.
  const dirtyInitializedRef = useRef(false);
  useEffect(() => {
    if (!dirtyInitializedRef.current) {
      dirtyInitializedRef.current = true;
      onDirtyChange?.(false);
      return;
    }
    onDirtyChange?.(true);
  }, [title, slug, category, projectId, sapo, content, gallery, seo, geo, onDirtyChange]);

  // Sync title to slug automatically if not manually edited
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!isEdit && (!slug || slug === generateSlug(title))) {
      setSlug(generateSlug(newTitle));
    }
  };

  // Upload image to gallery
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const res = await articleApi.uploadImage(file);
      setGallery(prev => [
        ...prev,
        {
          media_id: res.id,
          url: res.url,
          alt_text: title ? `${title} - Hình ảnh minh họa` : file.name.replace(/\.[^/.]+$/, ''),
          caption: '',
          credit: 'Maian Homes',
        },
      ]);
    } catch {
      noticeAdmin('Tải ảnh lên thất bại. Vui lòng thử lại.', 'error');
    } finally {
      setUploadingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setGallery(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateImage = (index: number, field: keyof ArticleGalleryItem, val: string) => {
    setGallery(prev => prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)));
  };

  // AI SEO & GEO Generator
  const handleGenerateSeoGeo = async () => {
    if (title.trim().length < 5) {
      noticeAdmin('Tiêu đề cần có ít nhất 5 ký tự trước khi tạo SEO/GEO.', 'warning');
      return;
    }
    const plainAiContent = (content || sapo).replace(/<[^>]*>/g, ' ').trim();
    const verifiedFactCount = plainAiContent
      .split(/(?<=[.!?])\s+|\n+/)
      .filter(value => value.trim().length >= 20).length;
    if (verifiedFactCount < 3) {
      noticeAdmin('Nội dung cần ít nhất ba câu hoặc đoạn văn có dữ kiện rõ ràng trước khi tạo SEO/GEO.', 'warning');
      return;
    }
    const verifiedSources = geo.sources.filter(
      source => source.title?.trim() && source.url?.trim(),
    );
    if (category === 'market' && verifiedSources.length === 0) {
      noticeAdmin('Bài viết thị trường cần ít nhất một nguồn tham khảo hợp lệ.', 'warning');
      return;
    }
    setGeneratingSeoGeo(true);
    try {
      const res = await aiApi.generateArticleSeoGeo({
        title,
        sapo,
        slug: slug || generateSlug(title),
        category,
        content: plainAiContent,
        sources: geo.sources
          .filter(source => source.title?.trim() && source.url?.trim())
          .map(source => ({title: source.title, url: source.url, publisher: source.publisher || ''})),
      });

      if (!res?.data || res.status !== 'ok' || res.validation?.evidence_valid !== true) {
        noticeAdmin(res?.warnings?.[0]?.message || 'AI chưa tạo được gợi ý đúng chuẩn.', 'warning');
        return;
      }
      const suggestion = res.data;
      setSeo(prev => ({
        ...prev,
        meta_title: suggestion.meta_title || prev.meta_title,
        meta_description: suggestion.meta_description || prev.meta_description,
        canonical_url: suggestion.canonical_url || prev.canonical_url || `${SITE_URL}/tin_tuc/${slug}`,
        focus_keyword: suggestion.focus_keyword || prev.focus_keyword,
        keywords: suggestion.keywords?.length ? suggestion.keywords : prev.keywords,
      }));

      setGeo(prev => ({
        ...prev,
        answer_summary: suggestion.answer_summary || prev.answer_summary,
        key_facts: suggestion.key_facts?.length ? suggestion.key_facts : prev.key_facts,
        faqs: suggestion.faqs?.length ? suggestion.faqs : prev.faqs,
        sources: prev.sources,
        internal_links: suggestion.internal_links?.length ? suggestion.internal_links : prev.internal_links,
      }));

      noticeAdmin(
        res.validation?.complete === false
          ? 'AI đã tạo và tự động điền các trường SEO/GEO có đủ căn cứ. Vui lòng kiểm tra lại trước khi lưu.'
          : 'AI đã tạo và tự động điền gợi ý SEO & GEO thành công!',
        'success',
      );
    } catch {
      noticeAdmin('Gợi ý AI gặp sự cố. Bạn có thể tự điền các thông tin thủ công.', 'warning');
    } finally {
      setGeneratingSeoGeo(false);
    }
  };

  // Realtime Checklist & Quality Calculations
  const seoChecklist = useMemo(() => {
    const titleLen = title.trim().length;
    const sapoLen = sapo.trim().length;
    const cleanText = content.replace(/<[^>]*>/g, ' ').trim();
    const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
    const galleryOk = gallery.length > 0 && gallery.every(img => Boolean(img.alt_text?.trim()));

    return {
      titleLen,
      titleOk: titleLen >= 20 && titleLen <= 120,
      sapoLen,
      sapoOk: sapoLen >= 50 && sapoLen <= 250,
      wordCount,
      contentOk: wordCount >= 300,
      galleryOk,
    };
  }, [title, sapo, content, gallery]);

  // Validation Report for ValidationPanel
  const validationReport = useMemo<ValidationReport>(() => {
    return validateArticleDraft({
      title,
      slug,
      category,
      project_id: projectId,
      sapo,
      content,
      gallery,
      seo,
      geo,
    });
  }, [title, slug, category, projectId, sapo, content, gallery, seo, geo]);

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      id: initialData?.id || initialData?._id,
      title,
      slug,
      category,
      project_id: projectId || undefined,
      sapo,
      content,
      gallery,
      seo,
      geo,
    });
  };

  // Interactive Focus to Field from ValidationPanel
  const handleSelectIssue = (field: string) => {
    if (['title', 'slug', 'category', 'project_id', 'sapo', 'content'].includes(field)) {
      setActiveTab(0);
    } else if (field.startsWith('gallery') || field.startsWith('image')) {
      setActiveTab(1);
    } else if (field.startsWith('seo') || field.startsWith('meta_')) {
      setActiveTab(2);
    } else if (field.startsWith('geo') || field.startsWith('faq') || field.startsWith('source') || field.startsWith('key_facts')) {
      setActiveTab(3);
    }

    setTimeout(() => {
      const fieldCandidates = [field];
      if (field.startsWith('gallery') || field.startsWith('image')) fieldCandidates.push('gallery');
      if (field.startsWith('geo.faq') || field.startsWith('faq')) fieldCandidates.push('geo.faqs');
      if (field.startsWith('geo.source') || field.startsWith('source')) fieldCandidates.push('geo.sources');
      if (field.startsWith('geo.key_facts') || field.startsWith('key_facts')) fieldCandidates.push('geo.key_facts');
      if (field.startsWith('geo.answer_summary')) fieldCandidates.push('geo.answer_summary');

      let el: HTMLElement | null = null;
      for (const candidate of fieldCandidates) {
        const candidateElement = document.querySelector(`[data-field="${candidate}"]`);
        if (candidateElement instanceof HTMLElement) {
          el = candidateElement;
          break;
        }
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('project-field-flash');
        setTimeout(() => el.classList.remove('project-field-flash'), 2000);
      }
    }, 150);
  };

  return (
    <form onSubmit={handleSubmit} className="mkt-fullscreen-overlay article-editor-shell">
      {/* ── TOP STICKY HEADER ── */}
      <header className="mkt-workspace-header article-editor-header">
        <div className="flex items-center gap-3 min-w-0 article-editor-header-main">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-500 hover:text-[#2D1B14] hover:bg-[#F8F3ED] transition-colors shrink-0"
            title="Đóng / Thoát"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-[#2D1B14] truncate flex items-center gap-2 article-editor-title">
              <FileText className="w-4 h-4 text-[#C5A059] shrink-0" />
              <span>{isEdit ? 'Chỉnh Sửa Bài Viết' : 'Soạn Thảo Bài Viết Mới'}</span>
              {title && <span className="text-[#C5A059] font-semibold truncate hidden sm:inline">/ {title}</span>}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-gray-400 font-mono hidden md:inline">
                /tin_tuc/{slug || 'chua-tao-slug'}
              </span>
              {isEdit && (
                <span className="text-[11px] text-gray-500 flex items-center gap-1" aria-live="polite">
                  •
                  {autosaveState === 'saving' && <><RefreshCw className="w-3 h-3 animate-spin text-amber-500" /> Đang lưu...</>}
                  {autosaveState === 'saved' && <><CheckCircle2 className="w-3 h-3 text-emerald-500" /> Đã lưu nháp</>}
                  {autosaveState === 'dirty' && <><FileText className="w-3 h-3 text-blue-500" /> Có thay đổi</>}
                  {autosaveState === 'error' && <><ShieldAlert className="w-3 h-3 text-rose-500" /> Lưu thất bại</>}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 article-editor-header-actions">
          {/* Segmented Mode: Edit vs Live Preview */}
          <div className="flex bg-[#F0E8DF] p-1 rounded-xl border border-[#E8E0D8] article-editor-mode-toggle">
            <button
              type="button"
              onClick={() => setMode('edit')}
              aria-label="Soạn thảo bài viết"
              className={`py-1.5 px-3 sm:px-4 font-semibold text-xs transition-all rounded-lg ${
                mode === 'edit'
                  ? 'text-[#2D1B14] bg-white shadow-xs font-bold'
                  : 'text-[#6B7280] hover:text-[#2D1B14]'
              }`}
            >
              <FileText className="article-editor-mode-icon w-3.5 h-3.5" />
              <span className="article-editor-mode-label">Soạn thảo</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('preview')}
              aria-label="Xem trước bài viết"
              className={`py-1.5 px-3 sm:px-4 font-semibold text-xs transition-all rounded-lg flex items-center gap-1.5 ${
                mode === 'preview'
                  ? 'text-[#2D1B14] bg-white shadow-xs font-bold'
                  : 'text-[#6B7280] hover:text-[#2D1B14]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="article-editor-mode-label">Xem trước</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </button>
          </div>

          {/* Quality Dock Toggle Button */}


          <button


            type="button"


            onClick={() => setShowQualityDock((prev) => !prev)}


            aria-label={showQualityDock ? 'Ẩn trợ lý SEO & GEO' : 'Hiện trợ lý SEO & GEO'}


            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${


              showQualityDock


                ? 'bg-[#FAF8F5] border-[#C5A059] text-[#2D1B14] shadow-2xs'


                : 'bg-white border-[#E8E0D8] text-gray-600 hover:text-gray-900 hover:border-gray-300'


            }`}


            title={showQualityDock ? 'Ẩn trợ lý SEO/GEO' : 'Hiện trợ lý SEO/GEO'}


          >


            <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />


            <span className="hidden xl:inline">Trợ lý SEO</span>


            <span


              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${


                validationReport.errors.length === 0


                  ? 'bg-emerald-100 text-emerald-800'


                  : 'bg-amber-100 text-amber-800 font-bold'


              }`}


            >


              {validationReport.errors.length === 0 ? 'OK' : `${validationReport.errors.length} lỗi`}


            </span>


          </button>





          {/* AI Suggestion Quick Button */}
          <button
            type="button"
            onClick={handleGenerateSeoGeo}
            disabled={generatingSeoGeo}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-[#FAF8F5] hover:bg-[#F8F3ED] text-[#8A6A16] border border-[#C5A059]/40 rounded-xl text-xs font-bold transition-all shadow-2xs disabled:opacity-50 article-editor-ai-button"
            title="Tự động tạo gợi ý SEO/GEO bằng AI"
          >
            <Sparkles className={`w-3.5 h-3.5 text-[#C5A059] ${generatingSeoGeo ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">{generatingSeoGeo ? 'Đang tạo…' : 'Gợi ý AI SEO/GEO'}</span>
          </button>

          {/* Save Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-gold text-xs font-bold py-2 sm:py-2.5 px-4 sm:px-6 shadow-md flex items-center gap-2 article-editor-save-button"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span className="article-editor-save-label">{isEdit ? 'Lưu Thay Đổi' : 'Tạo Bản Nháp'}</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── WORKSPACE BODY (EDIT MODE VS PREVIEW MODE) ── */}
      {mode === 'preview' ? (
        /* LIVE PREVIEW 100% REALITY */
        <div className="flex-1 bg-[#F8F3ED] p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
          <div className="mx-auto max-w-[1440px] bg-white rounded-2xl shadow-xl border border-[#E8E0D8] overflow-hidden">
            <div className="p-4 bg-[#FAF8F5] border-b border-[#E8E0D8] flex items-center justify-between">
              <span className="text-xs font-bold text-[#2D1B14] flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#C5A059]" />
                Xem trước thực tế (Live Preview): Giao diện người đọc hiển thị 100% giống trang web
              </span>
              <button
                type="button"
                onClick={() => setMode('edit')}
                className="text-xs text-[#C5A059] font-bold hover:underline"
              >
                Quay lại soạn thảo
              </button>
            </div>
            <div className="p-4 sm:p-8">
              <ArticleDetailClient
                isPreview={true}
                article={{
                  id: 'preview',
                  title: title || 'Tiêu đề bài viết mô phỏng...',
                  slug: slug || 'preview',
                  category,
                  project_id: projectId,
                  sapo: sapo || 'Đoạn mở đầu Sapo 5W1H mô phỏng...',
                  content: content || '<p>Nội dung bài viết chi tiết...</p>',
                  gallery,
                  author_name: user?.name || user?.email?.split('@')[0] || 'Maian Homes',
                  published_at: new Date().toISOString(),
                  view_count: 0,
                }}
                relatedArticles={[]}
                revisions={[]}
                linkedProject={(() => {
                  const project = projects.find(p => p.id === projectId || p._id === projectId);
                  return project ? {
                    id: project.id || project._id || '',
                    name: project.name,
                    slug: project.slug,
                    developer: '',
                    location: '',
                    price_range: '',
                    status: '',
                  } : null;
                })()}
              />
            </div>
          </div>
        </div>
      ) : (
        /* 3-COLUMN WORKSPACE: LEFT RAIL + CENTER CANVAS + RIGHT QUALITY DOCK */
        <div className={`article-editor-body ${!showQualityDock ? 'article-editor-body--no-quality' : ''}`}>
          {/* ── LEFT STEPPER RAIL ── */}
          <aside className="bg-white border-r border-[#E8E0D8] flex-col shrink-0 article-editor-stepper">
            <div className="p-4 border-b border-[#E8E0D8] bg-[#FAF8F5]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Các bước biên tập</span>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-gray-600">Tiến độ bài viết:</span>
                <span className="font-bold text-[#C5A059]">
                  {Math.round(
                    ((title ? 1 : 0) +
                      (sapo ? 1 : 0) +
                      (content ? 1 : 0) +
                      (gallery.length > 0 ? 1 : 0) +
                      (seo.meta_title ? 1 : 0) +
                      (geo.answer_summary ? 1 : 0)) *
                      (100 / 6)
                  )}%
                </span>
              </div>
              <div className="w-full bg-[#E8E0D8] h-1.5 rounded-full mt-1.5 overflow-hidden">
                <div
                  className="bg-[#C5A059] h-full transition-all duration-300"
                  style={{
                    width: `${Math.round(
                      ((title ? 1 : 0) +
                        (sapo ? 1 : 0) +
                        (content ? 1 : 0) +
                        (gallery.length > 0 ? 1 : 0) +
                        (seo.meta_title ? 1 : 0) +
                        (geo.answer_summary ? 1 : 0)) *
                        (100 / 6)
                    )}%`,
                  }}
                />
              </div>
            </div>

            <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto custom-scrollbar article-editor-stepper-nav" aria-label="Các bước bài viết">
              {ARTICLE_STEPS.map((step) => {
                const Icon = step.icon;
                const isActive = activeTab === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveTab(step.id)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 border ${
                      isActive
                        ? 'bg-[#FAF8F5] border-[#C5A059] text-[#2D1B14] shadow-xs'
                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                        isActive ? 'bg-[#C5A059] text-[#1A1612]' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span className="truncate">{step.title}</span>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">{step.description}</p>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Chuyên mục & Dự án Fast Switcher in Rail */}
            <div className="p-3 border-t border-[#E8E0D8] bg-[#FAF8F5] space-y-2.5 article-editor-context">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                  Chuyên mục *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ArticleCategory)}
                  className="w-full px-2.5 py-1.5 bg-white border border-[#E8E0D8] rounded-lg text-xs font-medium text-[#2D1B14] focus:outline-none focus:border-[#C5A059]"
                >
                  <option value="market">Tin Thị Trường (Phân tích, vĩ mô)</option>
                  <option value="project">Tin Dự Án (Tiến độ, mở bán)</option>
                  <option value="internal">Tin Nội Bộ (Văn hóa, thành tích)</option>
                </select>
              </div>

              {category === 'project' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Dự án liên kết *
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    required={category === 'project'}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E8E0D8] rounded-lg text-xs font-medium text-[#2D1B14] focus:outline-none focus:border-[#C5A059]"
                  >
                    <option value="">-- Chọn dự án hệ thống --</option>
                    {projects.map((p) => (
                      <option key={p.id || p._id} value={p.id || p._id}>
                        {p.name} ({p.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </aside>

          {/* ── CENTER CANVAS: WORKSPACE CONTENT ── */}
          <main className="bg-[#F8F3ED] overflow-y-auto custom-scrollbar article-editor-canvas">
            {/* Mobile Tab Stepper (< 768px) */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-4 custom-scrollbar article-editor-mobile-steps">
              {ARTICLE_STEPS.map((step) => {
                const Icon = step.icon;
                const isActive = activeTab === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveTab(step.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border shrink-0 ${
                      isActive
                        ? 'bg-white border-[#C5A059] text-[#2D1B14] shadow-xs'
                        : 'bg-[#FAF8F5] border-[#E8E0D8] text-gray-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{step.title}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 0: NỘI DUNG & BIÊN TẬP CỐT LÕI */}
            {activeTab === 0 && (
              <div className="article-editor-tab">
                <div className="mkt-card space-y-6 article-editor-card">
                  <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-3">
                    <h3 className="font-serif font-bold text-lg text-[#2D1B14] flex items-center gap-2">
                      <FileText className="w-5 h-5 text-[#C5A059]" />
                      Thông Tin Bài Viết &amp; Đoạn Mở Đầu (Sapo 5W1H)
                    </h3>
                    <span className="text-xs text-gray-500 font-mono">Bước 1 / 4</span>
                  </div>

                  {/* Headline & Slug */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-7">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                        Tiêu đề bài viết (Headline) *
                      </label>
                      <input
                        data-field="title"
                        type="text"
                        required
                        value={title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        placeholder="VD: Maian Homes chính thức ra mắt siêu dự án The Privé..."
                        className="mkt-input-control"
                      />
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className={seoChecklist.titleOk ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                          {seoChecklist.titleLen} / 120 ký tự (Yêu cầu: 20 - 120 ký tự)
                        </span>
                        {seoChecklist.titleOk && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                    </div>

                    <div className="xl:col-span-5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                        Đường dẫn (Slug URL) *
                      </label>
                      <input
                        data-field="slug"
                        type="text"
                        required
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="maian-homes-ra-mat-the-prive"
                        className="mkt-input-control font-mono"
                      />
                      <span className="text-[11px] text-gray-400 mt-1 block truncate">
                        Tự động tạo từ tiêu đề (viết thường, không dấu, nối bằng gạch ngang)
                      </span>
                    </div>
                  </div>

                  {/* Mobile category selection if screen is small */}
                  <div className="article-editor-category-mobile grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                        Chuyên mục *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as ArticleCategory)}
                        className="mkt-input-control"
                      >
                        <option value="market">Tin Thị Trường</option>
                        <option value="project">Tin Dự Án</option>
                        <option value="internal">Tin Nội Bộ</option>
                      </select>
                    </div>

                    {category === 'project' && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                          Dự án liên kết *
                        </label>
                        <select
                          value={projectId}
                          onChange={(e) => setProjectId(e.target.value)}
                          className="mkt-input-control"
                        >
                          <option value="">-- Chọn dự án --</option>
                          {projects.map((p) => (
                            <option key={p.id || p._id} value={p.id || p._id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Sapo 5W1H */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                        <span>Đoạn mở đầu (Sapo 5W1H - Câu trả lời trích dẫn cho AI Bot) *</span>
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                      </label>
                      <span className={`text-[11px] font-medium ${seoChecklist.sapoOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {seoChecklist.sapoLen} / 250 ký tự (Khuyến nghị: 50 - 250 ký tự)
                      </span>
                    </div>
                    <textarea
                      data-field="sapo"
                      required
                      rows={3}
                      value={sapo}
                      onChange={(e) => setSapo(e.target.value)}
                      placeholder="Tóm tắt nội dung chính theo nguyên tắc 5W1H (Who, What, Where, When, Why, How) giúp AI Answer Engines như ChatGPT, Gemini, Perplexity dễ dàng trích dẫn..."
                      className="mkt-input-control !h-auto min-h-[90px] leading-relaxed"
                    />
                  </div>

                  {/* Rich Text Editor */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                        Nội dung chi tiết (Rich Text) *
                      </label>
                      <span className={`text-[11px] font-medium ${seoChecklist.contentOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {seoChecklist.wordCount} từ (SEO tối thiểu: 300 từ)
                      </span>
                    </div>
                    <RichTextEditor
                      value={content}
                      onChange={setContent}
                      images={gallery.map((img) => ({
                        media_id: img.media_id || img.url.match(/[a-f0-9]{32}/)?.[0] || img.url,
                        url: img.url,
                        alt_text: img.alt_text,
                        caption: img.caption,
                        credit: img.credit,
                      }))}
                      uploadImage={async (file) => {
                        const res = await articleApi.uploadImage(file);
                        return {
                          media_id: res.id,
                          url: res.url,
                          alt_text: title || file.name.replace(/\.[^/.]+$/, ''),
                        };
                      }}
                      onImageUploaded={(img) => {
                        setGallery((prev) => {
                          if (prev.some((item) => item.media_id === img.media_id || item.url === img.url)) {
                            return prev;
                          }
                          return [
                            ...prev,
                            { media_id: img.media_id, url: img.url, alt_text: img.alt_text, caption: img.caption, credit: img.credit },
                          ];
                        });
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 1: THƯ VIỆN MEDIA & ẢNH ALT TEXT */}
            {activeTab === 1 && (
              <div className="article-editor-tab">
                <div className="mkt-card space-y-6 article-editor-card" data-field="gallery">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E0D8] pb-3">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-[#2D1B14] flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-[#C5A059]" />
                        Thư Viện Hình Ảnh &amp; Alt Text Chuẩn SEO
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Tất cả hình ảnh hiển thị bắt buộc phải có Alt Text mô tả để phục vụ Google Image Search.
                      </p>
                    </div>

                    <label className="btn-gold text-xs py-2 px-4 shadow-sm inline-flex items-center gap-2 cursor-pointer self-start sm:self-auto">
                      <Upload className={`w-3.5 h-3.5 ${uploadingImg ? 'animate-bounce' : ''}`} />
                      <span>{uploadingImg ? 'Đang tải ảnh…' : 'Tải Ảnh Mới'}</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleUploadImage}
                        disabled={uploadingImg}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {gallery.length === 0 ? (
                    <div className="p-12 border-2 border-dashed border-[#E8E0D8] rounded-2xl text-center space-y-3 bg-[#FAF8F5]">
                      <ImageIcon className="w-12 h-12 text-gray-300 mx-auto" />
                      <p className="text-sm font-semibold text-gray-700">Chưa có hình ảnh nào trong bài viết.</p>
                      <p className="text-xs text-gray-400">
                        Bấm nút &quot;Tải Ảnh Mới&quot; ở trên để bổ sung ảnh đại diện hoặc hình ảnh nội dung.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {gallery.map((img, idx) => (
                        <div key={idx} className="mkt-media-card p-4 space-y-3 relative group">
                          <div className="flex items-start gap-3">
                            <div className="relative w-20 h-20 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-[#E8E0D8]">
                              <Image
                                src={getAssetUrl(img.url)}
                                alt={img.alt_text || 'Preview'}
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider">
                                {idx === 0 ? 'Ảnh đại diện (Cover)' : `Ảnh #${idx + 1}`}
                              </span>
                              <p className="text-xs font-mono text-gray-400 truncate mt-0.5">{img.url}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Xóa ảnh"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-gray-100">
                            <div>
                              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
                                Alt text (Bắt buộc SEO) *
                              </label>
                              <input
                                type="text"
                                value={img.alt_text || ''}
                                onChange={(e) => handleUpdateImage(idx, 'alt_text', e.target.value)}
                                placeholder="Mô tả nội dung hình ảnh cho Google..."
                                className={`w-full px-3 py-1.5 rounded-lg border text-xs ${
                                  !img.alt_text ? 'border-rose-300 bg-rose-50/50' : 'border-gray-300 bg-white'
                                }`}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Chú thích</label>
                                <input
                                  type="text"
                                  value={img.caption || ''}
                                  onChange={(e) => handleUpdateImage(idx, 'caption', e.target.value)}
                                  placeholder="Hiển thị dưới ảnh"
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">Bản quyền</label>
                                <input
                                  type="text"
                                  value={img.credit || ''}
                                  onChange={(e) => handleUpdateImage(idx, 'credit', e.target.value)}
                                  placeholder="Maian Homes"
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: SEO GOOGLE & SERP SNIPPET PREVIEW */}
            {activeTab === 2 && (
              <div className="article-editor-tab">
                <div className="mkt-card space-y-6 article-editor-card">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E0D8] pb-3">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-[#2D1B14] flex items-center gap-2">
                        <Search className="w-5 h-5 text-[#C5A059]" />
                        Cài Đặt SEO &amp; Mô Phỏng Tìm Kiếm Google
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Tối ưu hóa các thẻ Meta Tags để đạt thứ hạng cao trên Google Search.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateSeoGeo}
                      disabled={generatingSeoGeo}
                      className="btn-gold text-xs py-2 px-4 shadow-sm inline-flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{generatingSeoGeo ? 'Đang tạo SEO…' : 'Gợi ý SEO bằng AI'}</span>
                    </button>
                  </div>

                  {/* Google SERP Snippet Preview */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                      Mô phỏng hiển thị trên Google Search:
                    </span>
                    <div className="serp-preview-box">
                      <div className="serp-site">
                        <div className="w-4 h-4 rounded-full bg-[#C5A059] flex items-center justify-center text-[9px] text-white font-bold">
                          M
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-gray-900">Maian Homes</div>
                          <div className="serp-url">{SITE_URL} › tin_tuc › {slug || 'duong-dan-bai-viet'}</div>
                        </div>
                      </div>
                      <div className="serp-title">
                        {seo.meta_title || title || 'Tiêu đề bài viết hiển thị trên Google Search'}
                      </div>
                      <div className="serp-description">
                        {seo.meta_description || sapo || 'Đoạn mô tả ngắn gọn tóm tắt bài viết sẽ xuất hiện trong kết quả tìm kiếm của người dùng...'}
                      </div>
                    </div>
                  </div>

                  {/* Inputs */}
                  <div className="space-y-4 pt-2 border-t border-gray-100">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                          Meta Title (Tiêu đề SEO Google) *
                        </label>
                        <span className={`text-[11px] font-medium ${
                          (seo.meta_title?.length || 0) >= 30 && (seo.meta_title?.length || 0) <= 60
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}>
                          {seo.meta_title?.length || 0} / 60 ký tự (Chuẩn: 30 - 60)
                        </span>
                      </div>
                      <input
                        data-field="seo.meta_title"
                        type="text"
                        value={seo.meta_title || ''}
                        onChange={(e) => setSeo({ ...seo, meta_title: e.target.value })}
                        placeholder="Tiêu đề SEO hiển thị trên kết quả tìm kiếm..."
                        className="mkt-input-control"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                          Meta Description (Mô tả tìm kiếm) *
                        </label>
                        <span className={`text-[11px] font-medium ${
                          (seo.meta_description?.length || 0) >= 120 && (seo.meta_description?.length || 0) <= 160
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}>
                          {seo.meta_description?.length || 0} / 160 ký tự (Chuẩn: 120 - 160)
                        </span>
                      </div>
                      <textarea
                        data-field="seo.meta_description"
                        rows={3}
                        value={seo.meta_description || ''}
                        onChange={(e) => setSeo({ ...seo, meta_description: e.target.value })}
                        placeholder="Đoạn văn bản tóm tắt hấp dẫn thu hút người tìm kiếm nhấp vào bài viết..."
                        className="mkt-input-control !h-auto min-h-[80px]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                        Canonical URL (Đường dẫn gốc)
                      </label>
                      <input
                        type="url"
                        value={seo.canonical_url || ''}
                        onChange={(e) => setSeo({ ...seo, canonical_url: e.target.value })}
                        placeholder={`${SITE_URL}/tin_tuc/${slug}`}
                        className="mkt-input-control font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                          Từ khóa trọng tâm
                        </label>
                        <input
                          type="text"
                          maxLength={200}
                          value={seo.focus_keyword || ''}
                          onChange={(e) => setSeo({ ...seo, focus_keyword: e.target.value })}
                          placeholder="VD: căn hộ cao cấp TP.HCM"
                          className="mkt-input-control"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                          Từ khóa liên quan
                        </label>
                        <input
                          type="text"
                          value={(seo.keywords || []).join(', ')}
                          onChange={(e) => setSeo({ ...seo, keywords: e.target.value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 50) })}
                          placeholder="căn hộ, đầu tư, thị trường"
                          className="mkt-input-control"
                        />
                        <p className="mt-1 text-[11px] text-gray-500">Phân cách từng từ khóa bằng dấu phẩy.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: GEO & AI ANSWER ENGINES */}
            {activeTab === 3 && (
              <div className="article-editor-tab">
                <div className="mkt-card space-y-6 article-editor-card">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E0D8] pb-3">
                    <div>
                      <h3 className="font-serif font-bold text-lg text-[#2D1B14] flex items-center gap-2">
                        <Bot className="w-5 h-5 text-[#C5A059]" />
                        Cài Đặt GEO &amp; AI Answer Engines (ChatGPT, Perplexity)
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Cung cấp dữ liệu có cấu trúc giúp các công cụ tìm kiếm AI dễ dàng trích dẫn Maian Homes.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGenerateSeoGeo}
                      disabled={generatingSeoGeo}
                      className="btn-gold text-xs py-2 px-4 shadow-sm inline-flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{generatingSeoGeo ? 'Đang tạo…' : 'Gợi ý GEO bằng AI'}</span>
                    </button>
                  </div>

                  {/* AI Answer Summary */}
                  <div data-field="geo.answer_summary">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      Câu trả lời tóm tắt trực tiếp cho AI (Answer Summary) *
                    </label>
                    <textarea
                      rows={3}
                      value={geo.answer_summary || ''}
                      onChange={(e) => setGeo({ ...geo, answer_summary: e.target.value })}
                      placeholder="Tóm tắt trực tiếp thông tin trọng tâm để AI trích dẫn làm câu trả lời nổi bật..."
                      className="mkt-input-control !h-auto min-h-[80px]"
                    />
                  </div>

                  {/* Key Facts */}
                  <div data-field="geo.key_facts">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                      Key Facts (3 điểm sự kiện cốt lõi)
                    </label>
                    <div className="space-y-2">
                      {geo.key_facts.map((fact, index) => (
                        <input
                          key={index}
                          type="text"
                          value={fact}
                          onChange={(e) => {
                            const newFacts = [...geo.key_facts];
                            newFacts[index] = e.target.value;
                            setGeo({ ...geo, key_facts: newFacts });
                          }}
                          placeholder={`Điểm cốt lõi #${index + 1}...`}
                          className="mkt-input-control"
                        />
                      ))}
                    </div>
                  </div>

                  {/* FAQ Schema Dynamic Builder */}
                  <div className="space-y-3 pt-4 border-t border-gray-100" data-field="geo.faqs">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                        Câu hỏi thường gặp (FAQ Schema)
                      </label>
                      <button
                        type="button"
                        onClick={() => setGeo({ ...geo, faqs: [...geo.faqs, { question: '', answer: '' }] })}
                        className="text-xs text-[#C5A059] font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm câu hỏi
                      </button>
                    </div>

                    <div className="space-y-3">
                      {geo.faqs.map((faq, index) => (
                        <div key={index} className="mkt-faq-card space-y-2 relative group">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500">FAQ #{index + 1}</span>
                            {geo.faqs.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setGeo({ ...geo, faqs: geo.faqs.filter((_, i) => i !== index) })}
                                className="text-gray-400 hover:text-rose-600 text-xs"
                                title="Xóa FAQ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={faq.question}
                            onChange={(e) => {
                              const newFaqs = [...geo.faqs];
                              newFaqs[index].question = e.target.value;
                              setGeo({ ...geo, faqs: newFaqs });
                            }}
                            placeholder="Nhập câu hỏi..."
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold"
                          />
                          <textarea
                            rows={2}
                            value={faq.answer}
                            onChange={(e) => {
                              const newFaqs = [...geo.faqs];
                              newFaqs[index].answer = e.target.value;
                              setGeo({ ...geo, faqs: newFaqs });
                            }}
                            placeholder="Nhập câu trả lời chi tiết..."
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sources & Citations */}
                  <div className="space-y-3 pt-4 border-t border-gray-100" data-field="geo.sources">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                      Nguồn tham khảo &amp; Trích dẫn GEO
                    </label>
                    <div className="space-y-3">
                      {geo.sources.map((source, index) => (
                        <div key={index} className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-[1fr_1.3fr_auto]">
                          <input
                            type="text"
                            value={source.title}
                            onChange={(event) => setGeo({...geo, sources: geo.sources.map((item, itemIndex) => itemIndex === index ? {...item, title: event.target.value} : item)})}
                            placeholder="Tên nguồn"
                            className="mkt-input-control"
                          />
                          <input
                            type="url"
                            value={source.url}
                            onChange={(event) => setGeo({...geo, sources: geo.sources.map((item, itemIndex) => itemIndex === index ? {...item, url: event.target.value} : item)})}
                            placeholder="https://nguon-tham-khao.vn/..."
                            className="mkt-input-control font-mono"
                          />
                          <button type="button" aria-label={`Xóa nguồn ${index + 1}`} onClick={() => setGeo({...geo, sources: geo.sources.filter((_, itemIndex) => itemIndex !== index)})} className="rounded-lg px-3 text-rose-700">×</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setGeo({...geo, sources: [...geo.sources, {title: '', url: '', publisher: ''}]})} className="text-xs font-bold text-blue-700">+ Thêm nguồn</button>
                    </div>
                    {geo.internal_links.length > 0 && (
                      <div className="rounded-xl bg-blue-50 p-3 text-xs text-gray-700">
                        <p className="mb-2 font-bold">Liên kết nội bộ đã xác minh</p>
                        <ul className="space-y-1">{geo.internal_links.map(link => <li key={link.url}><a href={link.url} className="text-blue-700 underline">{link.title}</a></li>)}</ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* ── RIGHT QUALITY & SEO DOCK ── */}
          <aside className="bg-white border-l border-[#E8E0D8] p-3 sm:p-3.5 flex-col gap-3 shrink-0 overflow-y-auto custom-scrollbar article-editor-quality">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E8E0D8]">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                <span>Trợ lý Kiểm Định SEO &amp; GEO</span>
              </h4>
              <span
                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  validationReport.errors.length === 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {validationReport.errors.length === 0 ? 'ĐẠT CHUẨN' : `${validationReport.errors.length} VẤN ĐỀ`}
              </span>
            </div>

            {/* Checklist Box */}
            <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E8E0D8] space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                Tiêu chuẩn xuất bản nhanh:
              </span>
              <div className="space-y-1.5 text-xs">
                <div className={`py-1.5 px-2.5 rounded-lg border flex items-center justify-between ${
                  seoChecklist.titleOk ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'
                }`}>
                  <span>Tiêu đề (20–120 ký tự)</span>
                  <span className="font-bold font-mono">{seoChecklist.titleLen}</span>
                </div>
                <div className={`py-1.5 px-2.5 rounded-lg border flex items-center justify-between ${
                  seoChecklist.sapoOk ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'
                }`}>
                  <span>Sapo 5W1H (&gt;50 ký tự)</span>
                  <span className="font-bold font-mono">{seoChecklist.sapoLen}</span>
                </div>
                <div className={`py-1.5 px-2.5 rounded-lg border flex items-center justify-between ${
                  seoChecklist.contentOk ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'
                }`}>
                  <span>Nội dung (&gt;300 từ)</span>
                  <span className="font-bold font-mono">{seoChecklist.wordCount} từ</span>
                </div>
                <div className={`py-1.5 px-2.5 rounded-lg border flex items-center justify-between ${
                  seoChecklist.galleryOk ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
                }`}>
                  <span>Alt text ảnh đầy đủ</span>
                  <span className="font-bold">{seoChecklist.galleryOk ? 'Đầy đủ' : 'Thiếu'}</span>
                </div>
              </div>
            </div>

            {/* Validation Panel with Flash-to-Field */}
            <div className="flex-1 min-h-0">
              <ValidationPanel
                report={validationReport}
                onSelectIssue={handleSelectIssue}
                resolveLocation={resolveArticleLocation}
              />
            </div>
          </aside>
        </div>
      )}

      {/* ── MOBILE STICKY BOTTOM BAR (< 768px) ── */}
      <div className="mkt-sticky-bottom-bar article-editor-mobile-actions">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            validationReport.errors.length === 0 ? 'bg-emerald-500' : 'bg-amber-500'
          }`} />
          <span className="text-xs font-bold text-gray-700">
            {validationReport.errors.length === 0 ? 'SEO Đạt chuẩn' : `${validationReport.errors.length} lỗi SEO`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeTab < 3 && (
            <button
              type="button"
              onClick={() => setActiveTab(prev => Math.min(prev + 1, 3))}
              className="px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl"
            >
              Tiếp theo
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-gold text-xs font-bold py-2 px-4 shadow-sm"
          >
            {isSubmitting ? 'Đang lưu…' : (isEdit ? 'Lưu bài' : 'Tạo nháp')}
          </button>
        </div>
      </div>
    </form>
  );
}
