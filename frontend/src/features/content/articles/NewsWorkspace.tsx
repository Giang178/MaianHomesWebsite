'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { adminConfirm, noticeAdmin } from '@/components/admin/admin-dialog-service';
import { adminLabel } from '@/lib/admin-labels';
import {
  Plus, Search, Edit, Trash, Check, X, AlertCircle,
  ShieldAlert, FileText, Newspaper, RefreshCw, ChevronLeft, ChevronRight,
  Image as ImageIcon, CheckCircle2, History
} from 'lucide-react';
import { getAssetUrl } from '@/lib/api';
import { articleApi, contentApi } from '@/features/content/api';
import { useAuth } from '@/context/AuthContext';
import ArticleEditor, { type ArticleFormData, type ArticleGalleryItem, type ArticleSeoData, type ArticleGeoData } from './ArticleEditor';
import { useAutosave } from './useArticleEditor';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL || 'https://maianhomes.vn';

interface ArticleRow {
  id?: string;
  _id?: string;
  title: string;
  slug: string;
  category: 'internal' | 'market' | 'project';
  project_id?: string;
  sapo: string;
  content: string;
  gallery?: ArticleGalleryItem[];
  status: 'draft' | 'published' | 'unpublished' | 'archived';
  workflow_status?: 'DRAFT' | 'PUBLISHED';
  publication_status?: 'NEVER_PUBLISHED' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
  created_by?: string;
  author_id?: string;
  author_name?: string;
  author_email?: string;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
  view_count?: number;
  version?: number;
  rejection_reason?: string;
  quality_summary?: { score: number; error_count: number; warning_count: number };
  seo?: ArticleSeoData;
  geo?: { answer_summary?: string; key_facts?: string[]; faqs?: Array<{ question: string; answer: string }>; sources?: Array<{ title: string; url: string; publisher?: string }>; internal_links?: Array<{title: string; url: string; type: 'project' | 'article'}> };
}

interface ProjectOption {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
}

interface ArticleRevision {
  version: number;
  updated_by_email?: string;
  note?: string;
  created_at?: string;
}

interface ArticleAuditLog {
  action: string;
  timestamp?: string;
  performed_by_email?: string;
  performed_by_role?: string;
  old_status?: string;
  new_status?: string;
  note?: string;
}

interface ArticleHistoryEvent {
  version?: number;
  snapshot?: { version?: number };
  actor_email?: string;
  actor_role?: string;
  metadata?: { note?: string };
  occurred_at?: string;
  created_at?: string;
  event_type?: string;
}

const getErrorMessage = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

const formatDate = (value?: string) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('vi-VN');
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Chưa rõ';
  return new Date(value).toLocaleString('vi-VN');
};

export default function NewsAdminClient({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const { user } = useAuth();
  const permissions = new Set(user?.permissions || []);
  const can = (permission: string) => permissions.has('*') || permissions.has(permission);
  const canCreateArticle = can('website.articles.create');
  const canUpdateArticle = can('website.articles.update');
  const canPublishArticle = can('website.articles.publish');
  const canDeleteArticle = can('website.articles.delete');
  const isManagerOrCEO = canPublishArticle;
  const activeTab = 'all';

  // Filters & Pagination
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [page, setPage] = useState(1);
  const [articleCursors, setArticleCursors] = useState<Array<string | null>>([null]);
  const limit = 10;

  // Projects dropdown for project category
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // Modals state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isNewArticle, setIsNewArticle] = useState(false);
  const [isEditorDirty, setIsEditorDirty] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Editor Form State
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCategory, setFormCategory] = useState<'internal' | 'market' | 'project'>('market');
  const [formProjectId, setFormProjectId] = useState('');
  const [formSapo, setFormSapo] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formGallery, setFormGallery] = useState<ArticleGalleryItem[]>([]);
  const formVersionRef = useRef(1);
  const editIdRef = useRef<string | null>(null);
  const [formSeo, setFormSeo] = useState<ArticleSeoData>({ meta_title: '', meta_description: '', canonical_url: '', focus_keyword: '', keywords: [] });
  const [formGeo, setFormGeo] = useState<ArticleGeoData>({ answer_summary: '', key_facts: ['', '', ''], faqs: [{ question: '', answer: '' }, { question: '', answer: '' }], sources: [{ title: '', url: '', publisher: '' }], internal_links: [] });
  // History / Revisions Data
  const [revisionsList, setRevisionsList] = useState<ArticleRevision[]>([]);
  const [auditLogsList, setAuditLogsList] = useState<ArticleAuditLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyWarning, setHistoryWarning] = useState<string | null>(null);
  const historyRequestRef = useRef(0);
  const articleListRequestRef = useRef(0);

  const toast = (type: 'success' | 'error', msg: string) => {
    setNote({ type, msg });
    setTimeout(() => setNote(null), 5000);
  };

  const loadProjects = useCallback(async () => {
    try {
      const res = await contentApi.listProjectsInternal<ProjectOption>();
      setProjects(res);
    } catch {
      noticeAdmin('Không thể hoàn tất thao tác. Vui lòng thử lại.');
    }
  }, []);

  const currentArticleCursor = articleCursors[page - 1] || undefined;

  const loadArticles = useCallback(async () => {
    const requestId = ++articleListRequestRef.current;
    setLoading(true);
    try {
      const res = await articleApi.listMyArticles({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        q: debouncedSearch || undefined,
        limit,
        cursor: currentArticleCursor,
      });
      if (requestId !== articleListRequestRef.current) return;

      const list = Array.isArray(res?.items) ? res.items : (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
      setArticles(list);
      setArticleTotal(Number(res?.total ?? list.length));
      const nextCursor = res?.next_cursor ? String(res.next_cursor) : null;
      setArticleCursors((current) => {
        if ((current[page] ?? null) === nextCursor) return current;
        const next = current.slice(0, page + 1);
        next[page] = nextCursor;
        return next;
      });
    } catch (err: unknown) {
      if (requestId !== articleListRequestRef.current) return;
      toast('error', getErrorMessage(err, 'Không thể tải danh sách bài viết'));
    } finally {
      if (requestId === articleListRequestRef.current) setLoading(false);
    }
  }, [currentArticleCursor, page, statusFilter, categoryFilter, debouncedSearch, limit]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // Auto-generate slug from title
  const slugify = useCallback((text: string) => {
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }, []);

  const openCreate = async () => {
    if (!canCreateArticle || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const draft = await articleApi.createDraft();
      const draftId = String(draft?.id || draft?._id || '');
      if (!draftId) throw new Error('Không nhận được ID bản nháp từ máy chủ.');
      editIdRef.current = draftId;
      setEditId(draftId);
      setIsNewArticle(true);
      setIsEditorDirty(false);
      setFormTitle('');
      setFormSlug('');
      setFormCategory('market');
      setFormProjectId('');
      setFormSapo('');
      setFormContent('');
      setFormGallery([]);
      formVersionRef.current = Number(draft.version || 1);
      setFormSeo({ meta_title: '', meta_description: '', canonical_url: '', focus_keyword: '', keywords: [] });
      setFormGeo({ answer_summary: '', key_facts: ['', '', ''], faqs: [{ question: '', answer: '' }, { question: '', answer: '' }], sources: [{ title: '', url: '', publisher: '' }], internal_links: [] });
      setIsEditorOpen(true);
    } catch (error) {
      toast('error', getErrorMessage(error, 'Không thể khởi tạo bản nháp.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (art: ArticleRow) => {
    const articleId = art.id || art._id || null;
    const articleVersion = typeof art.version === 'number' ? art.version : 1;
    editIdRef.current = articleId;
    formVersionRef.current = articleVersion;
    setIsNewArticle(false);
    setIsEditorDirty(false);
    setEditId(articleId);
    setFormTitle(art.title || '');
    setFormSlug(art.slug || '');
    setFormCategory(art.category || 'market');
    setFormProjectId(art.project_id || '');
    setFormSapo(art.sapo || '');
    setFormContent(art.content || '');
    setFormGallery(art.gallery || []);
    setFormSeo({ meta_title: art.seo?.meta_title || art.title || '', meta_description: art.seo?.meta_description || art.sapo || '', canonical_url: art.seo?.canonical_url || `${SITE_URL}/tin_tuc/${art.slug}`, focus_keyword: art.seo?.focus_keyword || '', keywords: art.seo?.keywords || [] });
    setFormGeo({ answer_summary: art.geo?.answer_summary || art.sapo || '', key_facts: art.geo?.key_facts?.length ? art.geo.key_facts : ['', '', ''], faqs: art.geo?.faqs?.length ? art.geo.faqs : [{ question: '', answer: '' }, { question: '', answer: '' }], sources: art.geo?.sources?.length ? art.geo.sources.map(s => ({ ...s, publisher: s.publisher || '' })) : [{ title: '', url: '', publisher: '' }], internal_links: art.geo?.internal_links || [] });
    setIsEditorOpen(true);
  };

  const closeEditorImmediately = () => {
    setIsEditorOpen(false);
    setIsEditorDirty(false);
    setIsNewArticle(false);
    editIdRef.current = null;
    setEditId(null);
  };

  const syncDraftFromEditor = useCallback((data: ArticleFormData) => {
    setFormTitle(data.title);
    setFormSlug(data.slug);
    setFormCategory(data.category);
    setFormProjectId(data.project_id || '');
    setFormSapo(data.sapo);
    setFormContent(data.content);
    setFormGallery(data.gallery);
    setFormSeo(data.seo);
    setFormGeo(data.geo);
  }, []);

  const articleDraftPayload = useMemo(() => ({
    title: formTitle,
    slug: formSlug || slugify(formTitle),
    category: formCategory,
    project_id: formCategory === 'project' ? formProjectId : undefined,
    sapo: formSapo,
    content: formContent,
    gallery: formGallery,
    seo: formSeo,
    geo: {
      ...formGeo,
      key_facts: formGeo.key_facts.filter(Boolean),
      faqs: formGeo.faqs.filter(item => item.question && item.answer),
      sources: formGeo.sources.filter(item => item.title && item.url),
    },
  }), [
    formCategory,
    formContent,
    formGallery,
    formGeo,
    formProjectId,
    formSapo,
    formSeo,
    formSlug,
    formTitle,
    slugify,
  ]);
  const autosaveDraft = useCallback(async (payload: typeof articleDraftPayload) => {
    const targetId = editId;
    if (!targetId) return;
    try {
      const saved = await articleApi.update(targetId, {
        ...payload,
        version: formVersionRef.current,
      });
      if (typeof saved?.version === 'number' && editIdRef.current === targetId) {
        formVersionRef.current = saved.version;
      }
    } catch (error) {
      const currentVersion = (error as Error & { currentVersion?: number }).currentVersion;
      if (typeof currentVersion === 'number' && editIdRef.current === targetId) {
        formVersionRef.current = currentVersion;
      }
      throw error;
    }
  }, [editId]);

  const { state: autosaveState, flush: flushAutosave } = useAutosave(
    articleDraftPayload,
    autosaveDraft,
    Boolean(editId && isEditorOpen),
    1500,
    editId,
  );

  useEffect(() => {
    if (autosaveState === 'saved') setIsEditorDirty(false);
  }, [autosaveState]);

  useEffect(() => {
    if (!isEditorOpen || typeof document === 'undefined') return;

    const previousRootOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isEditorOpen]);

  const requestCloseEditor = async () => {
    if (isEditorDirty && !await adminConfirm('Lưu thay đổi bản nháp trước khi đóng trình soạn thảo?')) return;
    if (isEditorDirty) {
      try {
        await flushAutosave();
      } catch (error) {
        toast('error', getErrorMessage(error, 'Không thể lưu bản nháp. Trình soạn thảo vẫn đang mở.'));
        return;
      }
    }
    closeEditorImmediately();
  };

  // State transitions are handled through the backend API.
  const handleTransition = async (
    artId: string,
    action: string,
    customNote: string = '',
    expectedVersion: number = 1,
    overrideWarningCodes: string[] = [],
  ) => {
    try {
      await articleApi.transitionStatus(
        artId,
        action,
        customNote,
        expectedVersion,
        overrideWarningCodes,
      );
      toast('success', `Đã chuyển trạng thái (${action}) thành công`);
      loadArticles();
    } catch (err: unknown) {
      const apiError = err as Error & { code?: string; warningCodes?: string[] };
      if (
        isManagerOrCEO &&
        apiError.code === 'QUALITY_WARNINGS_REQUIRE_CONFIRMATION' &&
        apiError.warningCodes?.length &&
        await adminConfirm(`Nội dung còn ${apiError.warningCodes.length} cảnh báo SEO/GEO. Xác nhận bỏ qua để tiếp tục?`)
      ) {
        await handleTransition(
          artId,
          action,
          customNote,
          expectedVersion,
          apiError.warningCodes,
        );
        return;
      }
      toast('error', getErrorMessage(err, 'Lỗi chuyển đổi trạng thái'));
    }
  };
  const handlePermanentDelete = async (articleId: string, version: number) => {
    if (!await adminConfirm('Xóa vĩnh viễn bài viết đã lưu trữ? Thao tác này không thể hoàn tác.')) return;
    try {
      await articleApi.deletePermanently(articleId, version);
      toast('success', 'Đã xóa vĩnh viễn bài viết');
      loadArticles();
    } catch (err: unknown) {
      toast('error', getErrorMessage(err, 'Không thể xóa vĩnh viễn bài viết'));
    }
  };

  const openHistoryModal = async (artId: string) => {
    const requestId = ++historyRequestRef.current;
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setHistoryWarning(null);
    setRevisionsList([]);
    setAuditLogsList([]);
    try {
      const [revisionsResult, auditResult] = await Promise.allSettled([
        articleApi.getRevisions(artId),
        articleApi.getAuditLogs(artId),
      ]);
      if (requestId !== historyRequestRef.current) return;
      const revs = revisionsResult.status === 'fulfilled' ? revisionsResult.value : {items: []};
      const logs = auditResult.status === 'fulfilled' ? auditResult.value : {items: []};
      if (revisionsResult.status === 'rejected' || auditResult.status === 'rejected') {
        setHistoryWarning('Một phần lịch sử chưa tải được. Vui lòng thử lại sau.');
      }
      const revisionEvents = (Array.isArray(revs?.items) ? revs.items : []) as ArticleHistoryEvent[];
      const auditEvents = (Array.isArray(logs?.items) ? logs.items : []) as ArticleHistoryEvent[];
      setRevisionsList(revisionEvents.map((event) => ({
        version: Number(event.version || event.snapshot?.version || 0),
        updated_by_email: event.actor_email || undefined,
        note: event.metadata?.note || undefined,
        created_at: event.occurred_at || event.created_at,
      })));
      setAuditLogsList(auditEvents.map((event) => ({
        action: adminLabel(event.event_type, 'event'),
        timestamp: event.occurred_at || event.created_at,
        performed_by_email: event.actor_email || undefined,
        performed_by_role: event.actor_role || undefined,
        note: event.metadata?.note || undefined,
      })));
    } catch {
      if (requestId === historyRequestRef.current) {
        noticeAdmin('Không thể hoàn tất thao tác. Vui lòng thử lại.');
      }
    } finally {
      if (requestId === historyRequestRef.current) setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    historyRequestRef.current += 1;
    setIsHistoryModalOpen(false);
    setHistoryLoading(false);
  };

  // Filtered lists for rendering
  useEffect(() => {
    setPage(1);
    setArticleCursors([null]);
  }, [statusFilter, categoryFilter, search]);

  const filteredArticles = articles;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">Nháp</span>;
      case 'published':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">Đã đăng</span>;
      case 'unpublished':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">Đã gỡ</span>;
      case 'archived':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300">Đã gỡ</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'internal': return 'Tin nội bộ';
      case 'market': return 'Thị trường';
      case 'project': return 'Dự án';
      default: return cat;
    }
  };

  return (
    <div className="admin-module-page admin-module-page--articles p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">

      {/* Toast Notification */}
      {note && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border text-sm font-medium transition-all ${note.type === 'success' ? 'bg-emerald-900 text-emerald-100 border-emerald-700' : 'bg-rose-900 text-rose-100 border-rose-700'
          }`}>
          {note.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
          <span>{note.msg}</span>
        </div>
      )}

      {/* Page Header */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-[#1A1612] to-[#2C241A] p-6 rounded-2xl border border-[#D4AF37]/20 shadow-xl text-white">
          <div>
            <div className="flex items-center gap-2 text-[#D4AF37] font-semibold text-xs uppercase tracking-widest mb-1">
              <Newspaper className="w-4 h-4" />
              <span>Hệ thống phân phối &amp; biên tập</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#F3E6C6]">
              Quản Lý Bài Viết &amp; SEO/GEO
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Quy trình duyệt bài 2 cấp • Tuân thủ chuẩn SEO Google &amp; AI Answer Engines
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => { loadArticles(); }}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-gray-300 hover:text-white transition-colors"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {canCreateArticle && <button
              onClick={openCreate}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] hover:from-[#c29d2b] hover:to-[#e2d49a] text-[#1A1612] font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Viết Bài Mới</span>
            </button>}
          </div>
        </div>
      )}

      {/* Tabs (All Articles vs Inbox for Managers) */}
      <div className="flex flex-wrap items-center justify-between border-b border-gray-200 pb-3 gap-4">
        <div className="flex gap-6">
          <button
            onClick={() => undefined}
            className={`pb-2 font-semibold text-sm flex items-center gap-2 transition-colors border-b-2 -mb-3 ${activeTab === 'all'
              ? 'border-[#D4AF37] text-[#1A1612]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
          >
            <FileText className="w-4 h-4" />
            <span>Danh sách bài viết ({filteredArticles.length})</span>
          </button>

        </div>

        {hideHeader && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => { loadArticles(); }}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl border border-gray-200 text-gray-700 transition-colors"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {canCreateArticle && <button
              onClick={openCreate}
              className="px-4 py-2 bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] hover:from-[#c29d2b] hover:to-[#e2d49a] text-[#1A1612] font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Viết Bài Mới</span>
            </button>}
          </div>
        )}
      </div>

      {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4 justify-between">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tiêu đề bài viết..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#D4AF37] focus:bg-white"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="draft">Nháp</option>
              <option value="published">Đã đăng</option>
              <option value="unpublished">Đã gỡ </option>
              <option value="archived">Đã gỡ</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="">Tất cả chuyên mục</option>
              <option value="internal">Tin nội bộ</option>
              <option value="market">Thị trường</option>
              <option value="project">Dự án</option>
            </select>
          </div>
        </div>


      {/* Content table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[10px] xl:text-xs font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-5">Bài Viết</th>
                <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Chuyên Mục</th>
                <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Tác Giả</th>
                <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Trạng Thái</th>
                <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Cập Nhật</th>
                <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs xl:text-sm">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    {loading ? 'Đang tải dữ liệu bài viết...' : 'Không có bài viết nào phù hợp với bộ lọc.'}
                  </td>
                </tr>
              ) : (
                filteredArticles.map((art) => {
                  const artId = art.id || art._id || '';
                  const ownerId = art.created_by || art.author_id;
                  const isMyArticle = Boolean(ownerId && [user?.id, user?.employee_id].includes(ownerId));
                  const workflow = art.workflow_status || (
                    art.status === 'published' ? 'PUBLISHED' : 'DRAFT'
                  );
                  const publication = art.publication_status || (
                    art.status === 'published' ? 'PUBLISHED' :
                    art.status === 'unpublished' ? 'UNPUBLISHED' :
                    art.status === 'archived' ? 'ARCHIVED' : 'NEVER_PUBLISHED'
                  );
                  const canEdit = canUpdateArticle && publication !== 'ARCHIVED' && (
                    canPublishArticle || isMyArticle
                  );
                  const qualityReady = !art.quality_summary || art.quality_summary.error_count === 0;
                  const canUnpublish = canPublishArticle && publication === 'PUBLISHED';
                  const canPublishDirect = qualityReady && canPublishArticle && publication !== 'ARCHIVED' && workflow !== 'PUBLISHED';
                  const canArchive = canDeleteArticle && publication !== 'ARCHIVED';
                  const canRestore = canDeleteArticle && publication === 'ARCHIVED';
                  const canDeletePermanently = canDeleteArticle && publication === 'ARCHIVED';

                  return (
                    <tr key={artId} className="hover:bg-[#FBF9F4] border-l-2 border-l-transparent hover:border-l-[#C5A059] transition-all duration-300 ease-out group">
                      <td className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 max-w-md">
                        <div className="flex items-start gap-2.5 xl:gap-3">
                          {art.gallery && art.gallery.length > 0 ? (
                            <Image
                              src={getAssetUrl(art.gallery[0].url) || '/images/default-project.jpg'}
                              alt={art.title}
                              width={64}
                              height={48}
                              className="w-12 h-9 xl:w-16 xl:h-12 rounded-lg object-cover bg-gray-100 shrink-0 border"
                            />
                          ) : (
                            <div className="w-12 h-9 xl:w-16 xl:h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 border">
                              <ImageIcon className="w-4 h-4 xl:w-5 xl:h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-serif font-bold text-[#1A1612] text-xs xl:text-sm line-clamp-1 group-hover:text-[#D4AF37] transition-colors">
                              {art.title}
                            </h4>
                            <p className="text-[11px] xl:text-xs text-gray-500 line-clamp-1 mt-0.5">
                              {art.sapo}
                            </p>
                            <span className="text-[9px] xl:text-[10px] text-gray-400 font-mono">slug: {art.slug}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4 whitespace-nowrap font-medium text-gray-700 text-xs xl:text-sm">
                        {getCategoryLabel(art.category)}
                      </td>

                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4 whitespace-nowrap text-gray-600 text-[11px] xl:text-xs">
                        <span className="font-semibold block text-gray-800">{art.author_name || 'Staff'}</span>
                        <span className="text-gray-400 text-[10px] xl:text-[11px]">{art.author_email}</span>
                      </td>

                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-0.5 xl:gap-1">
                          {getStatusBadge(art.status)}
                          <span className="text-[9px] xl:text-[10px] font-mono text-gray-500">
                            {publication === 'NEVER_PUBLISHED' ? 'Chưa Từng Xuất Bản' : 
                             publication === 'PUBLISHED' ? 'Đang Xuất Bản' : 
                             publication === 'UNPUBLISHED' ? 'Đã Gỡ Bài' : 
                             publication === 'ARCHIVED' ? 'Đã Lưu Trữ' : publication}
                          </span>
                          {art.quality_summary && (
                            <span className={`text-[9px] xl:text-[10px] font-bold ${art.quality_summary.error_count ? 'text-rose-600' : 'text-emerald-700'}`}>
                              SEO/GEO {art.quality_summary.score}/100
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4 whitespace-nowrap text-[11px] xl:text-xs text-gray-500">
                        <time dateTime={art.updated_at || art.created_at}>
                          {formatDate(art.updated_at || art.created_at)}
                        </time>
                      </td>

                      <td className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 whitespace-nowrap text-right space-x-1 xl:space-x-1.5">
                        {/* Action: Lịch sử & Nhật ký */}
                        <button
                          onClick={() => openHistoryModal(artId)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-1"
                          title="Xem lịch sử & nhật ký kiểm toán"
                        >
                          <History className="w-4 h-4" />
                        </button>

                        {/* Action: Edit */}
                        {canEdit && (
                          <button
                            onClick={() => openEdit(art)}
                            className="p-1.5 text-gray-600 hover:text-[#D4AF37] hover:bg-amber-50 rounded-lg transition-colors inline-flex items-center gap-1"
                            title="Chỉnh sửa bài viết"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}

                        {/* Action: Staff Submit for Review */}
                        {canPublishDirect && (
                          <button
                            onClick={() => handleTransition(artId, 'publish', '', art.version || 1)}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 text-white rounded-lg inline-flex items-center gap-1"
                            title="Xuất bản trực tiếp sau khi vượt quality gate"
                          >
                            <Check className="w-3.5 h-3.5" /> {publication === 'PUBLISHED' ? 'Xuất bản thay đổi' : 'Xuất bản'}
                          </button>
                        )}

                        {/* Action: Manager Unpublish */}
                        {canUnpublish && (
                          <button
                            onClick={() => handleTransition(artId, 'unpublish', '', art.version || 1)}
                            className="px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors inline-flex items-center gap-1"
                            title="Gỡ bài viết khỏi giao diện công khai"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Gỡ bài</span>
                          </button>
                        )}
                        {canArchive && (
                          <button
                            onClick={() => handleTransition(artId, 'archive', '', art.version || 1)}
                            className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 border rounded-lg inline-flex items-center gap-1"
                            title="Lưu trữ bài viết"
                          >
                            <Trash className="w-3.5 h-3.5" />
                            <span>Lưu trữ</span>
                          </button>
                        )}
                        {canRestore && (
                          <button
                            onClick={() => handleTransition(artId, 'restore', '', art.version || 1)}
                            className="px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg"
                          >
                            Khôi phục
                          </button>
                        )}
                        {canDeletePermanently && (
                          <button
                            onClick={() => handlePermanentDelete(artId, art.version || 1)}
                            className="px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 border border-red-200 rounded-lg"
                          >
                            Xóa vĩnh viễn
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View (Phone / Screen < 768px) */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredArticles.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              {loading ? 'Đang tải dữ liệu bài viết...' : 'Không có bài viết nào phù hợp.'}
            </div>
          ) : (
            filteredArticles.map((art) => {
              const artId = art.id || art._id || '';
              const ownerId = art.created_by || art.author_id;
              const isMyArticle = Boolean(ownerId && [user?.id, user?.employee_id].includes(ownerId));
              const publication = art.publication_status || (
                art.status === 'published' ? 'PUBLISHED' :
                art.status === 'unpublished' ? 'UNPUBLISHED' :
                art.status === 'archived' ? 'ARCHIVED' : 'NEVER_PUBLISHED'
              );
              const canEdit = publication !== 'ARCHIVED' && (
                isManagerOrCEO || isMyArticle
              );

              return (
                <div key={artId} className="p-4 space-y-3 bg-white hover:bg-[#FAF8F5] transition-colors">
                  <div className="flex items-start gap-3">
                    {art.gallery && art.gallery.length > 0 ? (
                      <Image
                        src={getAssetUrl(art.gallery[0].url) || '/images/default-project.jpg'}
                        alt={art.title}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-xl object-cover bg-gray-100 shrink-0 border border-gray-200"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-[#F0E8DF] flex items-center justify-center text-gray-400 shrink-0 border border-gray-200">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-serif font-bold text-[#1A1612] text-sm line-clamp-2">{art.title}</h4>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {getStatusBadge(art.status)}
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-medium">
                          {getCategoryLabel(art.category)}
                        </span>
                        {art.quality_summary && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${art.quality_summary.error_count ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            SEO {art.quality_summary.score}/100
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 gap-2">
                    <span className="text-[11px] text-gray-400">
                      {formatDate(art.updated_at || art.created_at)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openHistoryModal(artId)}
                        className="p-2 bg-[#F8F3ED] hover:bg-[#F0E8DF] rounded-lg text-gray-700"
                        title="Lịch sử"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => openEdit(art)}
                          className="p-2 bg-[#F8F3ED] hover:bg-[#F0E8DF] rounded-lg text-[#C5A059]"
                          title="Chỉnh sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── FULLSCREEN ARTICLE WORKSPACE ── */}
      <div className="flex items-center justify-between border border-gray-200 bg-white rounded-xl px-4 py-3 text-xs text-gray-500">
        <span>{filteredArticles.length} trên trang / {articleTotal} tổng cộng</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex items-center gap-1 border rounded-lg px-2.5 py-1.5 disabled:opacity-40"><ChevronLeft className="w-4 h-4" />Trước</button>
          <span>Trang {page}</span>
          <button type="button" disabled={page * limit >= articleTotal || !articleCursors[page]} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 border rounded-lg px-2.5 py-1.5 disabled:opacity-40">Sau<ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {isEditorOpen && typeof document !== 'undefined' && createPortal(
        <ArticleEditor
          initialData={{
            id: editId || undefined,
            title: formTitle,
            slug: formSlug,
            category: formCategory,
            project_id: formProjectId,
            sapo: formSapo,
            content: formContent,
            gallery: formGallery,
            seo: formSeo,
            geo: formGeo,
          }}
          projects={projects}
          user={user || undefined}
          isEdit={!isNewArticle}
          isSubmitting={isSubmitting}
          autosaveState={autosaveState}
          onDraftChange={syncDraftFromEditor}
          onDirtyChange={setIsEditorDirty}
          onSave={async () => {
            setIsSubmitting(true);
            try {
              await flushAutosave();
              setIsEditorDirty(false);
              toast('success', isNewArticle ? 'Đã tạo và lưu bản nháp!' : 'Đã cập nhật bài viết thành công!');
              closeEditorImmediately();
              loadArticles();
            } catch (err: unknown) {
              toast('error', getErrorMessage(err, 'Lỗi khi lưu bài viết'));
            } finally {
              setIsSubmitting(false);
            }
          }}
          onClose={() => void requestCloseEditor()}
        />,
        document.body
      )}

      {/* ── MODAL: HISTORY & AUDIT LOGS ── */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-gray-200 overflow-hidden my-4 lg:my-6 max-h-[92vh] lg:max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-serif font-bold text-base">Lịch Sử Phiên Bản &amp; Nhật Ký Kiểm Toán</h3>
              </div>
              <button onClick={closeHistoryModal} className="text-gray-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-sm">
              {historyLoading ? (
                <div className="py-12 text-center text-gray-400">Đang tải lịch sử...</div>
              ) : (
                <>
                  {historyWarning && (
                    <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {historyWarning}
                    </div>
                  )}
                  {/* Revisions */}
                  <div>
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                      <span> Lịch sử phiên bản (Revisions)</span>
                    </h4>
                    {revisionsList.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Chưa có phiên bản lịch sử nào ghi nhận.</p>
                    ) : (
                      <div className="space-y-2">
                        {revisionsList.map((rev, i) => (
                          <div key={i} className="p-3 bg-gray-50 border rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-gray-800">Phiên bản v{rev.version}</span>
                              <span className="text-gray-500 ml-2">bởi {rev.updated_by_email}</span>
                              {rev.note && <p className="text-gray-600 mt-0.5 italic">Ghi chú: {rev.note}</p>}
                            </div>
                            <time className="text-gray-400">{formatDateTime(rev.created_at)}</time>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Audit Logs */}
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-xs uppercase tracking-wider">
                      <span> Nhật ký (Audit Logs)</span>
                    </h4>
                    {auditLogsList.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Chưa có nhật ký chuyển trạng thái nào.</p>
                    ) : (
                      <div className="space-y-2">
                        {auditLogsList.map((log, i) => (
                          <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-mono font-bold text-blue-700 uppercase">{log.action}</span>
                              <time className="text-gray-400">{formatDateTime(log.timestamp)}</time>
                            </div>
                            <div className="text-gray-600 flex justify-between">
                              <span>Người thực hiện: <strong className="text-gray-800">{log.performed_by_email}</strong> ({log.performed_by_role})</span>
                              <span>{adminLabel(log.old_status, 'status')} ➔ <strong className="text-gray-900">{adminLabel(log.new_status, 'status')}</strong></span>
                            </div>
                            {log.note && <p className="text-rose-700 font-medium bg-rose-50 p-1.5 rounded border border-rose-100">Lý do / Ghi chú: {log.note}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
