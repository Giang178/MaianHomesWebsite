'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  History,
  Info,
  Link2,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Search,
  SearchCheck,
  Share2,
  Smartphone,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { contentAdminApi, type WebsitePageDefinition, type WebsitePageRecord } from './api';
import MediaPickerField from '@/features/website/admin/MediaPickerField';
import { useAuth } from '@/context/AuthContext';

type PageDocument = {
  content: Record<string, unknown>;
  seo: Record<string, unknown>;
  geo: Record<string, unknown>;
};

type Tab = 'content' | 'seo' | 'geo' | 'preview';
type VersionItem = { id: string; version: number; snapshot: Record<string, unknown>; created_at: string; note?: string };
type Issue = { field: string; message: string };

const EMPTY: PageDocument = {
  content: {},
  seo: {
    title: '',
    description: '',
    focus_keyword: '',
    keywords: [],
    canonical_url: '',
    robots: 'index,follow',
  },
  geo: {
    answer_summary: '',
    key_facts: [],
    faqs: [],
    sources: [],
    internal_links: [],
  },
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export default function ContentAdminPage() {
  const { user } = useAuth();
  const permissions = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);
  const canUpdate = permissions.has('*') || permissions.has('website.pages.update');
  const canPublishPermission = permissions.has('*') || permissions.has('website.pages.publish');
  const [pages, setPages] = useState<WebsitePageRecord[]>([]);
  const [definitions, setDefinitions] = useState<Record<string, WebsitePageDefinition>>({});
  const [selected, setSelected] = useState<WebsitePageRecord | null>(null);
  const [doc, setDoc] = useState<PageDocument>(clone(EMPTY));
  const [keywordsRaw, setKeywordsRaw] = useState('');
  const [keyFactsRaw, setKeyFactsRaw] = useState('');
  const [tab, setTab] = useState<Tab>('seo');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [pageSearch, setPageSearch] = useState('');
  const [pageFilter, setPageFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const choose = useCallback((page: WebsitePageRecord) => {
    setSelected(page);
    const seoData = { ...EMPTY.seo, ...(page.draft?.seo || {}) };
    const geoData = { ...EMPTY.geo, ...(page.draft?.geo || {}) };
    setDoc({
      content: { ...(page.draft?.content || {}) },
      seo: seoData,
      geo: geoData,
    });
    // Initialize raw multiline text states so user can freely type spaces and newlines
    const rawKeywords = Array.isArray(seoData.keywords) ? seoData.keywords.join('\n') : '';
    const rawFacts = Array.isArray(geoData.key_facts) ? geoData.key_facts.join('\n') : '';
    setKeywordsRaw(rawKeywords);
    setKeyFactsRaw(rawFacts);

    setDirty(false);
    setIssues([]);
    setToast(null);
  }, []);

  const load = useCallback(async () => {
    try {
      const [pageResult, definitionResult] = await Promise.all([
        contentAdminApi.list(),
        contentAdminApi.definitions(),
      ]);
      const safePages = Array.isArray(pageResult.items) ? pageResult.items : [];
      setPages(safePages);
      setDefinitions(definitionResult.items || {});
      setSelected((current) => {
        const next = safePages.find((item) => item.page_key === current?.page_key) || safePages[0] || null;
        if (next) choose(next);
        return next;
      });
    } catch (error) {
      setToast({
        text: error instanceof Error ? error.message : 'Không thể tải dữ liệu CMS website.',
        type: 'error',
      });
    }
  }, [choose]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (group: keyof PageDocument, key: string, value: unknown) => {
    if (!canUpdate) return;
    setDoc((current) => ({ ...current, [group]: { ...current[group], [key]: value } }));
    setDirty(true);
    setIssues((current) => current.filter((item) => item.field !== `${group}.${key}`));
  };

  const handleKeywordsChange = (text: string) => {
    if (!canUpdate) return;
    setKeywordsRaw(text);
    const parsed = text
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    update('seo', 'keywords', parsed);
  };

  const handleKeyFactsChange = (text: string) => {
    if (!canUpdate) return;
    setKeyFactsRaw(text);
    const parsed = text
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    update('geo', 'key_facts', parsed);
  };

  const save = useCallback(async () => {
    if (!selected || saving || !canUpdate) return null;
    setSaving(true);
    try {
      const result = (await contentAdminApi.update(selected.page_key, {
        ...doc,
        expected_version: selected.version,
      })) as WebsitePageRecord;
      setSelected(result);
      setPages((all) => all.map((item) => (item.page_key === result.page_key ? result : item)));
      setDirty(false);
      setIssues([]);
      setToast({ text: 'Đã tự động lưu bản nháp an toàn vào hệ thống.', type: 'success' });
      return result;
    } catch (error) {
      const apiError = error as Error & { issues?: Issue[] };
      setIssues(apiError.issues || []);
      setToast({ text: apiError.message || 'Không thể lưu bản nháp.', type: 'error' });
      return null;
    } finally {
      setSaving(false);
    }
  }, [canUpdate, doc, saving, selected]);

  useEffect(() => {
    if (!canUpdate || !dirty || !selected) return;
    const timer = window.setTimeout(() => {
      void save();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [canUpdate, dirty, doc, save, selected]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const publish = async () => {
    if (!selected || publishing || !canPublishPermission) return;
    setPublishing(true);
    try {
      const current = dirty ? await save() : selected;
      if (!current) return;
      const result = (await contentAdminApi.transition(
        current.page_key,
        'publish',
        current.version
      )) as WebsitePageRecord;
      setSelected(result);
      setPages((all) => all.map((item) => (item.page_key === result.page_key ? result : item)));
      setIssues([]);
      setToast({
        text: '🎉 Xuất bản thành công! Nội dung mới đã được cập nhật trực tiếp lên website chính thức.',
        type: 'success',
      });
    } catch (error) {
      const apiError = error as Error & { issues?: Issue[] };
      const nextIssues = apiError.issues || [];
      setIssues(nextIssues);
      setToast({
        text: apiError.message || 'Chưa thể xuất bản. Vui lòng hoàn thành các tiêu chí kiểm tra bắt buộc.',
        type: 'error',
      });
      const first = nextIssues[0]?.field || '';
      if (first.startsWith('geo.')) setTab('geo');
      else setTab('seo');
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-field="${CSS.escape(first)}"]`)?.focus()
      );
    } finally {
      setPublishing(false);
    }
  };

  const openVersions = async () => {
    if (!selected) return;
    const result = await contentAdminApi.versions(selected.page_key);
    setVersions(Array.isArray(result.items) ? result.items : []);
    setShowVersions(true);
  };

  const rollback = async (version: number) => {
    if (!selected) return;
    const result = (await contentAdminApi.transition(
      selected.page_key,
      'rollback',
      selected.version,
      version
    )) as WebsitePageRecord;
    setShowVersions(false);
    choose(result);
    setPages((all) => all.map((item) => (item.page_key === result.page_key ? result : item)));
    setToast({
      text: `Đã khôi phục dữ liệu bản nháp từ phiên bản ${version}.`,
      type: 'info',
    });
  };

  const definition = selected ? definitions[selected.page_key] : undefined;

  // Validation metrics
  const seoCheckResults = useMemo(() => getSeoChecks(doc.seo), [doc.seo]);
  const geoCheckResults = useMemo(() => getGeoChecks(doc.geo, selected?.page_key), [doc.geo, selected?.page_key]);
  const contentCheckResults = useMemo(() => (definition?.fields || [])
    .filter((field) => field.required)
    .map((field) => ({
      field: `content.${field.key}`,
      label: field.label,
      hint: 'Trường nội dung bắt buộc',
      ok: Array.isArray(doc.content[field.key])
        ? (doc.content[field.key] as unknown[]).length > 0
        : Boolean(String(doc.content[field.key] || '').trim()),
    })), [definition?.fields, doc.content]);
  const totalSeoPassed = seoCheckResults.filter((c) => c.ok).length;
  const totalGeoPassed = geoCheckResults.filter((c) => c.ok).length;
  const allSeoPassed = totalSeoPassed === 7;
  const totalGeoChecks = geoCheckResults.length;
  const allGeoPassed = totalGeoPassed === totalGeoChecks;
  const totalContentPassed = contentCheckResults.filter((check) => check.ok).length;
  const allContentPassed = totalContentPassed === contentCheckResults.length;
  const contentReady = allContentPassed && allSeoPassed && allGeoPassed && !saving && !publishing;
  const canPublish = canPublishPermission && contentReady;
  const totalChecks = contentCheckResults.length + 7 + totalGeoChecks;
  const overallPercentage = Math.round(((totalContentPassed + totalSeoPassed + totalGeoPassed) / totalChecks) * 100);

  // Filtered pages list
  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      const def = definitions[page.page_key];
      const name = (def?.label || page.page_key).toLowerCase();
      const path = (def?.public_path || '').toLowerCase();
      const matchSearch = name.includes(pageSearch.toLowerCase()) || path.includes(pageSearch.toLowerCase());
      if (!matchSearch) return false;
      if (pageFilter === 'PUBLISHED') return page.publication_status === 'PUBLISHED' || page.status === 'PUBLISHED';
      if (pageFilter === 'DRAFT') return ['DRAFT', 'REJECTED'].includes(page.workflow_status || (page.status === 'DRAFT' ? 'DRAFT' : ''));
      return true;
    });
  }, [pages, definitions, pageSearch, pageFilter]);

  const autoGenerateCanonical = () => {
    if (!definition?.public_path) return;
    const origin = 'https://maianhomes.vn';
    const autoUrl = `${origin}${definition.public_path === '/' ? '' : definition.public_path}`;
    update('seo', 'canonical_url', autoUrl);
  };

  const focusField = (field: string) => {
    if (field.startsWith('content.')) {
      setTab('content');
    } else if (field.startsWith('geo.')) {
      setTab('geo');
    } else {
      setTab('seo');
    }
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.classList.add('ring-4', 'ring-amber-300');
        setTimeout(() => el.classList.remove('ring-4', 'ring-amber-300'), 2000);
      }
    }, 100);
  };

  return (
    <div className="admin-module-page admin-module-page--content min-h-screen bg-[#FDFBF7] text-[#2D1B14]">
      {/* Top Breadcrumb & Status Bar */}
      <div className="sticky top-0 z-30 border-b border-[#E8E0D8] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 2xl:px-8 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 2xl:gap-3">
            <span className="inline-flex h-9 w-9 2xl:h-10 2xl:w-10 items-center justify-center rounded-xl bg-[#FAF6F0] text-[#C5A059] border border-[#E8E0D8] shadow-2xs">
              <FileText className="h-5 w-5 2xl:h-5.5 2xl:w-5.5 text-[#C5A059]" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg lg:text-xl 2xl:text-2xl font-bold font-serif tracking-tight text-[#2D1B14]">Quản trị Nội dung Trang</h1>
                <span className="hidden rounded px-2 py-0.5 2xl:px-2.5 2xl:py-1 text-[10px] xl:text-xs font-bold bg-[#D4AF37]/15 text-[#AA820A] border border-[#D4AF37]/30 uppercase tracking-wide sm:inline-block">
                  CMS & SEO
                </span>
              </div>
              <p className="text-xs xl:text-sm 2xl:text-[14px] text-stone-500">Chuẩn hóa cấu hình hiển thị Google Search và tối ưu AI Engine (GEO)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-save Status Indicator */}
            <div className="flex items-center gap-2 rounded-full border border-[#E8E0D8] bg-[#FAF8F5] px-3.5 py-1 xl:px-4 xl:py-1.5 text-xs xl:text-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  saving ? 'animate-ping bg-amber-500' : dirty ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <span className="font-medium text-stone-700">
                {saving ? 'Đang lưu bản nháp...' : dirty ? 'Có thay đổi chưa lưu' : 'Bản nháp đã lưu tự động'}
              </span>
            </div>

            {/* Quick Preview Link */}
            {definition?.public_path && (
              <Link
                href={definition.public_path}
                target="_blank"
                className="hidden items-center gap-1.5 rounded-xl border border-[#E8E0D8] bg-white px-3 py-1.5 xl:px-4 xl:py-2 text-xs xl:text-sm font-semibold text-stone-700 shadow-2xs hover:border-[#C5A059] hover:text-[#C5A059] md:inline-flex transition"
              >
                <span>Xem trang live</span>
                <ExternalLink className="h-3 w-3 xl:h-3.5 xl:w-3.5 text-stone-400" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Floating / Toast Notification Alert */}
      {toast && (
        <div className="fixed right-6 top-16 z-50 animate-in fade-in slide-in-from-top-4">
          <div
            className={`flex max-w-md items-center justify-between gap-3 rounded-2xl p-4 shadow-xl border ${
              toast.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : toast.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-blue-200 bg-blue-50 text-blue-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
              ) : (
                <Info className="h-5 w-5 shrink-0 text-blue-600" />
              )}
              <span className="text-xs xl:text-sm font-medium leading-relaxed">{toast.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-slate-600 text-sm xl:text-base"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <div className="mx-4 mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm xl:text-base text-rose-900 sm:mx-6 2xl:mx-8">
          <strong>Vui lòng xử lý {issues.length} lỗi trước khi tiếp tục:</strong>
          <div className="mt-2 flex flex-wrap gap-2">{issues.map((issue, index) => <button key={`${issue.field}-${index}`} type="button" onClick={() => focusField(issue.field)} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-left text-xs xl:text-sm font-semibold hover:border-rose-400">{issue.message}</button>)}</div>
        </div>
      )}

      {/* Main Workspace Layout (Sidebar - Studio Editor - Checklist) */}
      <div className="grid gap-6 p-4 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[290px_minmax(0,1fr)_340px] xl:p-6 2xl:p-8">
        {/* ========================================================= */}
        {/* 1. LEFT SIDEBAR: DANH SÁCH TRANG                         */}
        {/* ========================================================= */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#E8E0D8] bg-white p-4 2xl:p-5 shadow-2xs">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs xl:text-sm font-bold uppercase tracking-wider text-[#2D1B14]">Trang website ({pages.length})</h2>
              <span className="rounded-md bg-[#FAF6F0] border border-[#E8E0D8] px-2 py-0.5 text-[10px] xl:text-xs font-semibold text-stone-600">
                {filteredPages.length} kết quả
              </span>
            </div>

            {/* Search Box */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 xl:top-3 h-3.5 w-3.5 xl:h-4 xl:w-4 text-stone-400" />
              <input
                type="text"
                placeholder="Tìm trang hoặc URL..."
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                className="w-full rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] py-1.5 xl:py-2 pl-8 xl:pl-9 pr-3 text-xs xl:text-sm text-stone-800 outline-none transition focus:bg-white focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
              />
            </div>

            {/* Filter Pills */}
            <div className="mb-3 flex gap-1 rounded-xl bg-[#FAF8F5] border border-[#E8E0D8] p-1 xl:p-1.5 text-[11px] xl:text-xs">
              <button
                type="button"
                onClick={() => setPageFilter('ALL')}
                className={`flex-1 rounded-lg py-1 xl:py-1.5 font-medium transition ${
                  pageFilter === 'ALL' ? 'bg-[#2D1B14] text-white shadow-2xs font-semibold' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setPageFilter('PUBLISHED')}
                className={`flex-1 rounded-lg py-1 xl:py-1.5 font-medium transition ${
                  pageFilter === 'PUBLISHED' ? 'bg-white text-emerald-700 shadow-2xs font-semibold' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Đã đăng
              </button>
              <button
                type="button"
                onClick={() => setPageFilter('DRAFT')}
                className={`flex-1 rounded-lg py-1 xl:py-1.5 font-medium transition ${
                  pageFilter === 'DRAFT' ? 'bg-white text-amber-700 shadow-2xs font-semibold' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Bản nháp
              </button>
            </div>

            {/* Page Navigation List */}
            <div className="space-y-1.5 max-h-[calc(100vh-290px)] 2xl:max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {filteredPages.map((page) => {
                const def = definitions[page.page_key];
                const isSelected = selected?.page_key === page.page_key;
                const isPublished = page.publication_status === 'PUBLISHED' || page.status === 'PUBLISHED';
                return (
                  <button
                    type="button"
                    key={page.page_key}
                    onClick={() => choose(page)}
                    className={`group relative flex w-full flex-col rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? 'border-[#C5A059] bg-[#FAF7F2] shadow-xs'
                        : 'border-[#E8E0D8]/60 bg-white hover:border-[#C5A059]/40 hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <strong className={`truncate text-xs xl:text-sm ${isSelected ? 'text-[#2D1B14] font-bold' : 'text-stone-800'}`}>
                        {def?.label || page.page_key}
                      </strong>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] xl:text-xs font-semibold border ${
                          isPublished
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : 'bg-amber-50 text-amber-700 border-amber-200/80'
                        }`}
                      >
                        {isPublished ? (page.workflow_status === 'DRAFT' ? 'Live · có bản nháp' : 'Đã xuất bản') : ('Bản nháp')}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] xl:text-xs text-stone-500">
                      <span className="truncate font-mono text-[10px] xl:text-xs">{def?.public_path || '/'}</span>
                      <span className="font-mono text-[10px] xl:text-xs text-stone-400">v{page.version}</span>
                    </div>

                    {isSelected && (
                      <span className="absolute -left-1 top-3 h-6 w-1 rounded-r-full bg-[#C5A059]" />
                    )}
                  </button>
                );
              })}

              {filteredPages.length === 0 && (
                <div className="py-6 text-center text-xs xl:text-sm text-slate-400">
                  Không tìm thấy trang nào.
                </div>
              )}
            </div>
          </div>

          {/* Quick Notice for Marketing */}
          <div className="rounded-2xl border border-[#EADBCA] bg-[#FAF8F5] p-4 2xl:p-5 text-xs xl:text-sm text-stone-700">
            <div className="flex items-center gap-2 font-bold text-[#2D1B14] text-xs xl:text-sm">
              <Info className="h-4 w-4 xl:h-4.5 xl:w-4.5 text-[#C5A059]" />
              <span>Quy chuẩn biên tập</span>
            </div>
            <p className="mt-1.5 leading-relaxed text-stone-600 text-[11px] xl:text-xs">
              Giao diện, hình ảnh và bố cục trang được khóa cố định theo nhận diện thương hiệu Maian Homes. Nhân viên chỉ cần hoàn thiện các trường <strong>SEO Google</strong> và <strong>GEO AI</strong> để xuất bản.
            </p>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* 2. CENTER: VÙNG BIÊN TẬP CHÍNH (STUDIO EDITOR)            */}
        {/* ========================================================= */}
        <section className="min-w-0 space-y-4">
          {/* Header Card for Selected Page */}
          <header className="rounded-2xl border border-[#E8E0D8] bg-white p-3.5 xl:p-5 2xl:p-6 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-3 xl:gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 2xl:gap-3">
                  <h2 className="text-base sm:text-lg xl:text-xl 2xl:text-2xl font-bold font-serif text-[#2D1B14]">
                    {definition?.label || selected?.page_key || 'Chọn một trang'}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 xl:px-2.5 xl:py-1 text-[11px] xl:text-xs 2xl:text-sm font-semibold border ${
                      selected?.status === 'PUBLISHED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        selected?.status === 'PUBLISHED' ? 'bg-emerald-600' : 'bg-amber-600'
                      }`}
                    />
                    {selected?.status === 'PUBLISHED' ? 'Đã xuất bản (Live)' : 'Bản nháp (Draft)'}
                  </span>
                  <span className="rounded-full bg-[#FAF6F0] border border-[#E8E0D8] px-2 py-0.5 xl:px-2.5 xl:py-1 text-[10px] xl:text-xs 2xl:text-[13px] font-mono font-medium text-stone-600">
                    Phiên bản {selected?.version}
                  </span>
                </div>

                {definition && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[11px] xl:text-xs 2xl:text-sm text-stone-500">
                    <span>Đường dẫn public:</span>
                    <Link
                      href={definition.public_path}
                      target="_blank"
                      className="inline-flex items-center gap-1 font-mono font-medium text-[#C5A059] hover:underline"
                    >
                      {definition.public_path}
                      <ExternalLink className="h-3 w-3 xl:h-3.5 xl:w-3.5" />
                    </Link>
                    <span className="text-stone-300">|</span>
                    <span className="text-stone-400">
                      Component: <code className="font-mono text-stone-600">{definition.frontend_component || 'Page'}</code>
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 xl:gap-2">
                {!canUpdate && <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs xl:text-sm font-semibold text-blue-800">Chế độ chỉ xem</span>}
                <button
                  type="button"
                  onClick={() => void openVersions()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E0D8] bg-white px-2.5 py-1.5 xl:px-3.5 xl:py-2 2xl:px-4 2xl:py-2.5 text-xs xl:text-sm font-semibold text-stone-700 shadow-2xs transition hover:bg-[#FAF8F5] hover:text-[#2D1B14] active:scale-95"
                >
                  <History className="h-3.5 w-3.5 xl:h-4 xl:w-4 text-stone-500" />
                  <span>Lịch sử phiên bản</span>
                </button>

                {canUpdate && <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E0D8] bg-white px-2.5 py-1.5 xl:px-3.5 xl:py-2 2xl:px-4 2xl:py-2.5 text-xs xl:text-sm font-semibold text-stone-700 shadow-2xs transition hover:bg-[#FAF8F5] hover:text-[#2D1B14] active:scale-95 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5 xl:h-4 xl:w-4 text-stone-500" />
                  <span>{saving ? 'Đang lưu...' : 'Lưu nháp'}</span>
                </button>}
                {canPublishPermission && <button
                  type="button"
                  disabled={!canPublish}
                  onClick={() => void publish()}
                  title={
                    !canPublish
                      ? `Cần đạt 100% tiêu chí kiểm tra để xuất bản`
                      : 'Xuất bản nội dung này ra website chính thức'
                  }
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 xl:px-5 xl:py-2 2xl:px-5.5 2xl:py-2.5 text-xs xl:text-sm font-bold shadow-xs transition active:scale-95 ${
                    canPublish
                      ? 'bg-gradient-to-r from-[#C5A059] via-[#D4AF37] to-[#B38E46] text-white hover:from-[#B38E46] hover:to-[#996515] shadow-sm shadow-[#C5A059]/25'
                      : 'cursor-not-allowed bg-stone-200 text-stone-400'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
                  <span>{publishing ? 'Đang xuất bản...' : 'Xuất bản website'}</span>
                </button>}
              </div>
            </div>
          </header>

          {/* Segmented Navigation Tab Strip (Never Truncates) */}
          <nav
            aria-label="Nhóm nội dung biên tập"
            className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm scrollbar-none"
          >
            <button
              type="button"
              onClick={() => setTab('content')}
              className={`inline-flex shrink-0 items-center gap-1.5 xl:gap-2 rounded-xl px-3 py-1.5 xl:px-4 xl:py-2 2xl:px-5 2xl:py-2.5 text-xs xl:text-sm font-bold transition ${
                tab === 'content'
                  ? 'bg-[#0A192F] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
              <span>Nội dung & hình ảnh</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('seo')}
              className={`inline-flex shrink-0 items-center gap-1.5 xl:gap-2 rounded-xl px-3 py-1.5 xl:px-4 xl:py-2 2xl:px-5 2xl:py-2.5 text-xs xl:text-sm font-bold transition ${
                tab === 'seo'
                  ? 'bg-[#0A192F] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <SearchCheck className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
              <span>SEO Google</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[9px] xl:text-[10px] 2xl:text-xs ${
                  allSeoPassed ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {totalSeoPassed}/7
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTab('geo')}
              className={`inline-flex shrink-0 items-center gap-1.5 xl:gap-2 rounded-xl px-3 py-1.5 xl:px-4 xl:py-2 2xl:px-5 2xl:py-2.5 text-xs xl:text-sm font-bold transition ${
                tab === 'geo'
                  ? 'bg-[#0A192F] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Bot className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
              <span>AI Search & GEO</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[9px] xl:text-[10px] 2xl:text-xs ${
                  allGeoPassed ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {totalGeoPassed}/{totalGeoChecks}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTab('preview')}
              className={`inline-flex shrink-0 items-center gap-1.5 xl:gap-2 rounded-xl px-3 py-1.5 xl:px-4 xl:py-2 2xl:px-5 2xl:py-2.5 text-xs xl:text-sm font-bold transition ${
                tab === 'preview'
                  ? 'bg-[#0A192F] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Eye className="h-4 w-4" />
              <span>Mô phỏng hiển thị</span>
            </button>
          </nav>

          {/* Tab Content Box */}
          <div className={`rounded-2xl border border-[#E8E0D8] bg-white p-5 2xl:p-7 shadow-2xs sm:p-6 ${!canUpdate && tab !== 'preview' ? 'admin-editor-readonly' : ''}`}>
            {/* TAB 1: PAGE CONTENT EDITOR */}
            {tab === 'content' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base xl:text-lg 2xl:text-xl font-bold text-[#2D1B14]">Nội dung hiển thị của trang</h3>
                  <p className="text-xs xl:text-sm 2xl:text-[14px] text-slate-500">
                    Các trường dưới đây được tạo theo cấu hình của từng trang. Website chỉ đọc bản đã xuất bản.
                  </p>
                </div>

                {definition?.fields?.length ? definition.fields.map((field) => {
                  const value = doc.content[field.key];
                  if (field.kind === 'sections') {
                    return (
                      <SectionListEditor key={field.key} label={field.label} fieldPath={`content.${field.key}`} rows={Array.isArray(value) ? value as Array<Record<string, unknown>> : []} onChange={(rows) => update('content', field.key, rows)} />
                    );
                  }
                  const mediaSlot = definition.media_slots?.find((slot) => slot.key === field.key);
                  if (field.kind === 'media') {
                    return <MediaPickerField key={field.key} fieldPath={`content.${field.key}`} label={field.label} value={typeof value === 'string' ? value : ''} required={field.required} requirement={mediaSlot} onChange={(nextValue) => update('content', field.key, nextValue)} />;
                  }
                  return (
                    <SmartTextField
                      key={field.key}
                      fieldPath={`content.${field.key}`}
                      label={field.label}
                      description={`Tối đa ${field.max_length} ký tự.`}
                      required={field.required}
                      area={field.kind === 'textarea'}
                      max={field.max_length}
                      value={typeof value === 'string' ? value : ''}
                      onChange={(nextValue) => update('content', field.key, nextValue)}
                      placeholder={field.label}
                    />
                  );
                }) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    Trang này chưa khai báo trường nội dung có thể biên tập.
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SEO GOOGLE EDITOR */}
            {tab === 'seo' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base xl:text-lg 2xl:text-xl font-bold text-[#2D1B14]">Cấu hình Tối ưu Tìm kiếm Google (SEO)</h3>
                  <p className="text-xs xl:text-sm 2xl:text-[14px] text-slate-500">
                    Cấu hình thông tin thẻ Meta hiển thị khi khách hàng tìm kiếm Maian Homes trên Google Search.
                  </p>
                </div>

                {/* Meta Title */}
                <SmartTextField
                  fieldPath="seo.title"
                  label="Tiêu đề trang (Meta Title)"
                  description="Dòng chữ tiêu đề màu xanh trên kết quả tìm kiếm Google. Chuẩn tốt nhất từ 30 đến 60 ký tự."
                  required
                  min={30}
                  max={60}
                  value={String(doc.seo.title || '')}
                  onChange={(val) => update('seo', 'title', val)}
                  placeholder="Ví dụ: Maian Homes | Đơn vị Phân phối & Tư vấn Bất động sản Cao cấp"
                  quickAction={{
                    label: 'Gợi ý từ tên trang',
                    onClick: () => {
                      if (!definition?.label) return;
                      const title = `${definition.label} | Maian Homes Bất động sản`;
                      update('seo', 'title', title.slice(0, 60));
                    },
                  }}
                />

                {/* Meta Description */}
                <SmartTextField
                  fieldPath="seo.description"
                  label="Đoạn trích dẫn mô tả (Meta Description)"
                  description="Đoạn tóm tắt dưới tiêu đề trên Google. Chuẩn tốt nhất từ 120 đến 160 ký tự. Hỗ trợ xuống dòng và cách từ tự nhiên."
                  required
                  area
                  min={120}
                  max={160}
                  value={String(doc.seo.description || '')}
                  onChange={(val) => update('seo', 'description', val)}
                  placeholder="Ví dụ: Khám phá các dự án bất động sản hạng sang, không gian làm việc sáng tạo và cơ hội đầu tư bền vững hàng đầu Việt Nam cùng đội ngũ chuyên gia Maian Homes."
                />

                {/* Focus Keyword & Canonical URL */}
                <div className="grid gap-6 md:grid-cols-2">
                  <SmartTextField
                    fieldPath="seo.focus_keyword"
                    label="Từ khóa tìm kiếm trọng tâm"
                    description="Từ khóa mục tiêu quan trọng nhất của trang này."
                    required
                    max={160}
                    value={String(doc.seo.focus_keyword || '')}
                    onChange={(val) => update('seo', 'focus_keyword', val)}
                    placeholder="Ví dụ: bất động sản cao cấp, ký gửi nhà đất"
                  />

                  <SmartTextField
                    fieldPath="seo.canonical_url"
                    label="Đường dẫn chuẩn (Canonical URL)"
                    description="Ngăn ngừa trùng lặp nội dung. Bắt buộc bắt đầu bằng https://maianhomes.vn"
                    required
                    value={String(doc.seo.canonical_url || '')}
                    onChange={(val) => update('seo', 'canonical_url', val)}
                    placeholder="https://maianhomes.vn/du-an"
                    quickAction={{
                      label: 'Tạo URL chuẩn tự động',
                      onClick: autoGenerateCanonical,
                    }}
                  />
                </div>

                {/* Secondary Keywords (Binds to raw string so Enter and Space work 100%) */}
                <div data-field="seo.keywords" className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm xl:text-[15px] 2xl:text-base font-bold text-slate-800">
                        Bộ từ khóa bổ trợ (Tối thiểu 3 từ khóa) <span className="text-red-500">*</span>
                      </span>
                      <p className="text-xs xl:text-sm 2xl:text-[14px] text-slate-500">
                        Nhập danh sách từ khóa liên quan, mỗi dòng một từ khóa (nhấn Enter để xuống dòng tự nhiên).
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs xl:text-sm font-semibold text-slate-600">
                      {Array.isArray(doc.seo.keywords) ? doc.seo.keywords.length : 0} từ khóa hợp lệ
                    </span>
                  </div>

                  <textarea
                    rows={4}
                    value={keywordsRaw}
                    onChange={(e) => handleKeywordsChange(e.target.value)}
                    placeholder={'bất động sản hà nội\ncăn hộ hạng sang\nkhông gian làm việc maian homes'}
                    className="w-full rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] p-3 xl:p-3.5 text-xs xl:text-sm 2xl:text-[14px] leading-relaxed text-stone-800 outline-none transition focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059]"
                  />
                </div>

                {/* Robots Directive */}
                <div data-field="seo.robots" className="space-y-2">
                  <span className="text-sm xl:text-[15px] 2xl:text-base font-bold text-slate-800">
                    Chỉ thị cho Bot tìm kiếm (Robots Directive) <span className="text-red-500">*</span>
                  </span>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        value: 'index,follow',
                        title: 'Cho phép lập chỉ mục',
                        desc: 'Hiển thị trên Google và quét liên kết (Khuyên dùng)',
                      },
                      {
                        value: 'noindex,follow',
                        title: 'Không lập chỉ mục',
                        desc: 'Ẩn khỏi tìm kiếm nhưng vẫn quét liên kết trang',
                      },
                      {
                        value: 'noindex,nofollow',
                        title: 'Chặn hoàn toàn',
                        desc: 'Không hiển thị và không quét bất kỳ liên kết nào',
                      },
                    ].map((opt) => {
                      const isChecked = String(doc.seo.robots || 'index,follow') === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={`flex cursor-pointer flex-col rounded-xl border p-3.5 xl:p-4 transition ${
                            isChecked
                              ? 'border-[#C5A059] bg-[#FAF7F2] ring-1 ring-[#C5A059]'
                              : 'border-[#E8E0D8] hover:border-stone-300 hover:bg-[#FAF8F5]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="robots"
                              value={opt.value}
                              checked={isChecked}
                              onChange={(e) => update('seo', 'robots', e.target.value)}
                              className="text-[#C5A059] focus:ring-[#C5A059] accent-[#C5A059]"
                            />
                            <strong className="text-xs xl:text-sm 2xl:text-sm font-bold text-slate-900">{opt.title}</strong>
                          </div>
                          <p className="mt-1 text-[11px] xl:text-xs 2xl:text-[13px] text-slate-500">{opt.desc}</p>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Open Graph Banner Notice */}
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 xl:p-4 text-xs xl:text-sm text-amber-900">
                  <Share2 className="h-5 w-5 xl:h-5.5 xl:w-5.5 shrink-0 text-amber-700" />
                  <div>
                    <strong className="font-semibold text-xs xl:text-sm 2xl:text-sm">Hình ảnh Open Graph (Ảnh đại diện khi chia sẻ MXH):</strong>
                    <p className="mt-0.5 text-amber-800/90 text-[11px] xl:text-xs 2xl:text-sm">
                      Hình ảnh chia sẻ lên Zalo/Facebook đã được cố định theo chuẩn nhận diện đồ họa của Maian Homes để đảm bảo tính đồng nhất.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: AI SEARCH & GEO EDITOR */}
            {tab === 'geo' && (
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base xl:text-lg 2xl:text-xl font-bold text-[#2D1B14]">Generative Engine Optimization (AI Search & GEO)</h3>
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] xl:text-xs font-bold text-purple-700">
                      Chuẩn AI Search 2026
                    </span>
                  </div>
                  <p className="text-xs xl:text-sm 2xl:text-[14px] text-slate-500">
                    Cung cấp câu trả lời trực diện và dữ liệu có cấu trúc để các mô hình trí tuệ nhân tạo (ChatGPT, Google Gemini, Perplexity, Copilot) trích dẫn Maian Homes.
                  </p>
                </div>

                {/* Answer Summary */}
                <SmartTextField
                  fieldPath="geo.answer_summary"
                  label="Tóm tắt câu trả lời trực diện (Answer Summary)"
                  description="Đoạn văn ngắn gọn, khách quan, súc tích (dưới 1000 ký tự) để AI trích xuất làm câu trả lời nổi bật cho người dùng. Cho phép xuống dòng và đoạn văn."
                  required
                  area
                  max={1000}
                  value={String(doc.geo.answer_summary || '')}
                  onChange={(val) => update('geo', 'answer_summary', val)}
                  placeholder="Ví dụ: Maian Homes là hệ sinh thái bất động sản cao cấp và không gian làm việc hiện đại tại Việt Nam, cung cấp giải pháp tư vấn đầu tư chuyên sâu, dịch vụ ký gửi minh bạch và văn phòng coworking chuẩn quốc tế."
                />

                {/* Key Facts (Binds to raw string so Enter and Space work 100%) */}
                <div data-field="geo.key_facts" className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm xl:text-[15px] 2xl:text-base font-bold text-slate-800">
                        Thông tin cốt lõi (Key Facts — Tối thiểu 3 ý) <span className="text-red-500">*</span>
                      </span>
                      <p className="text-xs xl:text-sm 2xl:text-[14px] text-slate-500">
                        Mỗi dòng một thông tin xác thực để AI kiểm chứng dữ liệu (nhấn Enter để tạo dòng mới tự nhiên).
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs xl:text-sm font-semibold text-slate-600">
                      {Array.isArray(doc.geo.key_facts) ? doc.geo.key_facts.filter(Boolean).length : 0} thông tin
                    </span>
                  </div>

                  <textarea
                    rows={4}
                    value={keyFactsRaw}
                    onChange={(e) => handleKeyFactsChange(e.target.value)}
                    placeholder={
                      '• Đối tác chiến lược của hơn 20 chủ đầu tư bất động sản hàng đầu\n• Sở hữu chuỗi không gian làm việc Coworking tại các vị trí đắc địa\n• 100% hồ sơ ký gửi được thẩm định pháp lý minh bạch trước khi công bố'
                    }
                    className="w-full rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] p-3 xl:p-3.5 text-xs xl:text-sm 2xl:text-[14px] leading-relaxed text-stone-800 outline-none transition focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059]"
                  />
                </div>

                {/* FAQs with Multiline Answer */}
                {selected?.page_key === 'about' ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 xl:p-5 text-sm xl:text-base text-blue-900">
                    <strong>FAQ trang Giới thiệu dùng Kho kiến thức doanh nghiệp.</strong>
                    <p className="mt-1 text-xs xl:text-sm leading-relaxed text-blue-800">
                      Website, Mái Đỏ và dữ liệu FAQ Schema cùng sử dụng bản đã xuất bản từ một nguồn duy nhất.
                    </p>
                    <Link href="/admin/content/company" className="mt-3 inline-flex text-xs xl:text-sm font-bold text-blue-700 hover:underline">
                      Mở Kho kiến thức doanh nghiệp →
                    </Link>
                  </div>
                ) : (
                  <StructuredRows
                    title="Câu hỏi thường gặp (FAQs cho AI & Schema Google)"
                    subtitle="Tối thiểu 3 câu hỏi hoàn chỉnh với câu trả lời rõ ràng, đáng tin cậy. Hỗ trợ xuống dòng và cách từ tự do."
                    fieldPath="geo.faqs"
                    rows={Array.isArray(doc.geo.faqs) ? (doc.geo.faqs as Array<Record<string, string>>) : []}
                    fields={[
                      { key: 'question', label: 'Câu hỏi của khách hàng', placeholder: 'Ví dụ: Maian Homes cung cấp những dịch vụ nào?' },
                      { key: 'answer', label: 'Câu trả lời chi tiết', placeholder: 'Ví dụ: Chúng tôi cung cấp tư vấn dự án cao cấp, ký gửi bất động sản và không gian làm việc coworking.', multiline: true },
                    ]}
                    minRequired={3}
                    onChange={(rows) => update('geo', 'faqs', rows)}
                  />
                )}

                {/* Sources */}
                <StructuredRows
                  title="Nguồn tham khảo uy tín (Sources)"
                  subtitle="Tối thiểu 1 nguồn có giao thức bảo mật HTTPS để tăng độ uy tín E-E-A-T."
                  fieldPath="geo.sources"
                  rows={Array.isArray(doc.geo.sources) ? (doc.geo.sources as Array<Record<string, string>>) : []}
                  fields={[
                    { key: 'title', label: 'Tên nguồn / Tổ chức', placeholder: 'Ví dụ: Cổng thông tin Maian Homes' },
                    { key: 'url', label: 'Địa chỉ URL (Bắt buộc https://)', placeholder: 'https://maianhomes.vn/gioi-thieu' },
                  ]}
                  minRequired={1}
                  onChange={(rows) => update('geo', 'sources', rows)}
                />

                {/* Internal Links */}
                <StructuredRows
                  title="Liên kết nội bộ gợi ý (Internal Links)"
                  subtitle="Tối thiểu 1 liên kết dẫn dắt người dùng đến trang khác (Bắt đầu bằng /)."
                  fieldPath="geo.internal_links"
                  rows={Array.isArray(doc.geo.internal_links) ? (doc.geo.internal_links as Array<Record<string, string>>) : []}
                  fields={[
                    { key: 'title', label: 'Tên liên kết', placeholder: 'Ví dụ: Xem danh sách dự án nổi bật' },
                    { key: 'url', label: 'Đường dẫn nội bộ (bắt đầu bằng /)', placeholder: '/du_an' },
                  ]}
                  minRequired={1}
                  onChange={(rows) => update('geo', 'internal_links', rows)}
                />
              </div>
            )}

            {/* TAB 3: LIVE PREVIEW SIMULATOR */}
            {tab === 'preview' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base xl:text-lg 2xl:text-xl font-bold text-[#2D1B14]">Mô phỏng hiển thị thực tế (Live Preview)</h3>
                    <p className="text-xs xl:text-sm 2xl:text-[14px] text-slate-500">
                      Xem trước cách tiêu đề và trích dẫn hiển thị trên Google Search và các công cụ AI (ChatGPT, Perplexity).
                    </p>
                  </div>
                  <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs xl:text-sm">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 xl:px-3.5 xl:py-1.5 font-medium transition ${
                        previewDevice === 'desktop' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
                      <span>Máy tính (Desktop)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 xl:px-3.5 xl:py-1.5 font-medium transition ${
                        previewDevice === 'mobile' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
                      <span>Điện thoại (Mobile)</span>
                    </button>
                  </div>
                </div>

                {/* Google Search Card Preview */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs xl:text-sm font-bold text-slate-700">
                    <Search className="h-4 w-4 text-blue-600" />
                    <span>Mô phỏng kết quả tìm kiếm Google (Google SERP Snippet)</span>
                  </div>
                  <div
                    className={`rounded-2xl border border-slate-200 bg-white p-5 xl:p-6 shadow-xs transition-all ${
                      previewDevice === 'mobile' ? 'max-w-md' : 'w-full'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 xl:h-8 xl:w-8 items-center justify-center rounded-full bg-slate-100 text-xs xl:text-sm font-bold text-red-600">
                        M
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs xl:text-sm font-semibold text-slate-800">Maian Homes</div>
                        <div className="truncate font-mono text-[11px] xl:text-xs text-slate-500">
                          {String(doc.seo.canonical_url || `https://maianhomes.vn${definition?.public_path || ''}`)}
                        </div>
                      </div>
                    </div>

                    <h4 className="mt-2 cursor-pointer text-lg xl:text-xl 2xl:text-2xl font-medium text-[#1a0dab] hover:underline">
                      {String(doc.seo.title || 'Tiêu đề trang sẽ hiển thị ở đây trên Google Search')}
                    </h4>

                    <p className="mt-1 text-xs xl:text-sm 2xl:text-[15px] leading-relaxed text-[#4d5156] whitespace-pre-line">
                      {String(
                        doc.seo.description ||
                          'Đoạn văn tóm tắt mô tả nội dung của trang web Maian Homes sẽ được hiển thị đầy đủ tại vị trí này khi khách hàng tìm kiếm trên Google.'
                      )}
                    </p>
                  </div>
                </div>

                {/* AI / Chatbot Answer Preview */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs xl:text-sm font-bold text-slate-700">
                    <Bot className="h-4 w-4 text-purple-600" />
                    <span>Mô phỏng trích dẫn bởi Trí tuệ Nhân tạo (ChatGPT / Gemini / Perplexity)</span>
                  </div>
                  <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/50 via-white to-slate-50 p-5 xl:p-6 shadow-xs">
                    <div className="flex items-center gap-2 text-xs xl:text-sm font-bold text-purple-900">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      Trích dẫn từ Maian Homes ({definition?.label || 'Website'})
                    </div>

                    <div className="mt-3 rounded-xl border border-purple-100 bg-white p-4 xl:p-5 text-xs xl:text-sm 2xl:text-[14px] leading-relaxed text-slate-800 shadow-xs">
                      <p className="font-medium text-slate-900 whitespace-pre-line">
                        {String(
                          doc.geo.answer_summary ||
                            'Chưa có đoạn tóm tắt câu trả lời (Answer Summary). Hãy điền trong tab AI Search & GEO.'
                        )}
                      </p>

                      {Array.isArray(doc.geo.key_facts) && doc.geo.key_facts.length > 0 && (
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <strong className="text-[11px] xl:text-xs uppercase tracking-wider text-slate-400">
                            Các điểm chính nổi bật:
                          </strong>
                          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs xl:text-sm text-slate-700">
                            {doc.geo.key_facts.map((fact, i) => (
                              <li key={i}>{String(fact)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] xl:text-xs text-slate-500">
                      <span>Nguồn trích dẫn:</span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-purple-100/70 px-2 py-0.5 font-medium text-purple-800">
                        <Link2 className="h-3 w-3" /> maianhomes.vn
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 3. RIGHT COLUMN: CHECKLIST KIỂM ĐỊNH XUẤT BẢN          */}
        {/* ========================================================= */}
        <aside className="space-y-4">
          <div className="sticky top-20 rounded-2xl border border-[#E8E0D8] bg-white p-5 2xl:p-6 shadow-2xs">
            {/* Header / Score Indicator */}
            <div className="border-b border-stone-100 pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm xl:text-base font-bold text-[#2D1B14]">Tiêu chuẩn Xuất bản</h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs xl:text-sm font-bold border ${
                    canPublish ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {overallPercentage}% Đạt chuẩn
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#FAF6F0] border border-[#E8E0D8]">
                <div
                  className={`h-full transition-all duration-500 ${
                    canPublish ? 'bg-emerald-600' : 'bg-gradient-to-r from-[#C5A059] to-[#996515]'
                  }`}
                  style={{ width: `${overallPercentage}%` }}
                />
              </div>
            </div>

            {/* Checklist Items */}
            <div className="mt-4 max-h-[calc(100vh-380px)] space-y-3 overflow-y-auto pr-1">
              {contentCheckResults.length > 0 && <>
                <div className="text-[11px] xl:text-xs font-bold uppercase tracking-wider text-slate-400">Kiểm tra nội dung ({totalContentPassed}/{contentCheckResults.length})</div>
                {contentCheckResults.map((check) => <CheckItem key={check.field} label={check.label} hint={check.hint} ok={check.ok} onFix={() => focusField(check.field)} />)}
              </>}
              <div className="text-[11px] xl:text-xs font-bold uppercase tracking-wider text-slate-400">
                Kiểm tra SEO ({totalSeoPassed}/7)
              </div>
              {seoCheckResults.map((check, index) => (
                <CheckItem
                  key={index}
                  label={check.label}
                  hint={check.hint}
                  ok={check.ok}
                  onFix={() => focusField(check.field)}
                />
              ))}

              <div className="pt-2 text-[11px] xl:text-xs font-bold uppercase tracking-wider text-slate-400">
                Kiểm tra AI & GEO ({totalGeoPassed}/{totalGeoChecks})
              </div>
              {geoCheckResults.map((check, index) => (
                <CheckItem
                  key={index}
                  label={check.label}
                  hint={check.hint}
                  ok={check.ok}
                  onFix={() => focusField(check.field)}
                />
              ))}
            </div>

            {/* Quality Summary & Action Prompt */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              {canPublish ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 xl:p-4 text-xs xl:text-sm text-emerald-900">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 text-xs xl:text-sm">
                    <CheckCircle2 className="h-4 w-4 xl:h-4.5 xl:w-4.5 text-emerald-600" />
                    Sẵn sàng xuất bản!
                  </div>
                  <p className="mt-1 text-[11px] xl:text-xs 2xl:text-[13px] leading-relaxed text-emerald-700">
                    Trang đã thỏa mãn 100% điều kiện kỹ thuật. Bấm nút <strong>&quot;Xuất bản website&quot;</strong> để áp dụng trực tiếp.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 xl:p-4 text-xs xl:text-sm text-amber-900">
                  <div className="flex items-center gap-2 font-bold text-amber-800 text-xs xl:text-sm">
                    <AlertCircle className="h-4 w-4 xl:h-4.5 xl:w-4.5 text-amber-600" />
                    Cần hoàn thiện tiêu chí
                  </div>
                  <p className="mt-1 text-[11px] xl:text-xs 2xl:text-[13px] leading-relaxed text-amber-700">
                    Bấm vào nút <strong>&quot;Sửa&quot;</strong> tại các mục màu vàng để đến đúng ô nhập liệu.
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ========================================================= */}
      {/* 4. MODAL LỊCH SỬ PHIÊN BẢN (VERSION HISTORY MODAL)         */}
      {/* ========================================================= */}
      {showVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <section className="max-h-[85vh] w-full max-w-2xl 2xl:max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 2xl:p-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 xl:h-10 xl:w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <History className="h-5 w-5 xl:h-5.5 xl:w-5.5" />
                </span>
                <div>
                  <h2 className="text-lg xl:text-xl 2xl:text-2xl font-bold text-[#2D1B14]">Lịch sử Xuất bản & Sao lưu</h2>
                  <p className="text-xs xl:text-sm text-slate-500">Trang: {definition?.label || selected?.page_key}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setShowVersions(false)}
                className="flex h-8 w-8 xl:h-9 xl:w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {versions.map((version) => (
                <div key={version.id || version.version} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm xl:text-base font-bold text-slate-900">Phiên bản {version.version}</strong>
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] xl:text-xs font-semibold text-emerald-700">
                        Đã xuất bản
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs xl:text-sm text-slate-500">
                      <Clock className="h-3 w-3 xl:h-3.5 xl:w-3.5 text-slate-400" />
                      {new Date(version.created_at).toLocaleString('vi-VN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {version.note && <p className="mt-1 text-xs xl:text-sm italic text-slate-600">Ghi chú: {version.note}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={() => void rollback(version.version)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs xl:text-sm font-semibold text-slate-700 shadow-xs transition hover:border-red-600 hover:text-red-600 active:scale-95"
                  >
                    <RotateCcw className="h-3.5 w-3.5 xl:h-4 xl:w-4" />
                    Khôi phục bản này
                  </button>
                </div>
              ))}

              {versions.length === 0 && (
                <div className="py-12 text-center text-sm xl:text-base text-slate-400">
                  Chưa có lịch sử xuất bản nào trước đây cho trang này.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// SUBCOMPONENTS & UI HELPERS
// =========================================================================

function CheckItem({
  label,
  hint,
  ok,
  onFix,
}: {
  label: string;
  hint?: string;
  ok: boolean;
  onFix: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs xl:text-sm">
      <div className="flex items-start gap-2">
        {ok ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 xl:h-4.5 xl:w-4.5 shrink-0 text-emerald-600" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 xl:h-4.5 xl:w-4.5 shrink-0 text-amber-500" />
        )}
        <div>
          <span className={`font-medium ${ok ? 'text-slate-700' : 'text-slate-900'}`}>{label}</span>
          {hint && !ok && <p className="text-[11px] xl:text-xs text-amber-700">{hint}</p>}
        </div>
      </div>
      {!ok && (
        <button
          type="button"
          onClick={onFix}
          className="shrink-0 text-[11px] xl:text-xs font-bold text-[#C5A059] hover:underline"
        >
          Sửa
        </button>
      )}
    </div>
  );
}

function SmartTextField({
  fieldPath,
  label,
  description,
  value,
  onChange,
  area,
  required,
  min,
  max,
  placeholder,
  quickAction,
}: {
  fieldPath: string;
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  area?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  quickAction?: { label: string; onClick: () => void };
}) {
  const length = value.length;
  const isTooShort = min !== undefined && length < min;
  const isTooLong = max !== undefined && length > max;
  const isOptimal = (min === undefined || length >= min) && (max === undefined || length <= max) && length > 0;

  return (
    <div className="space-y-1.5" data-field={fieldPath}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="text-sm xl:text-[15px] 2xl:text-base font-bold text-slate-800">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
          {description && <p className="text-xs xl:text-sm 2xl:text-[14px] text-slate-500">{description}</p>}
        </div>
        {quickAction && (
          <button
            type="button"
            onClick={quickAction.onClick}
            className="text-xs xl:text-sm font-semibold text-[#C5A059] hover:underline"
          >
            {quickAction.label}
          </button>
        )}
      </div>

      <div className="relative">
        {area ? (
          <textarea
            rows={3}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-xl border p-3 xl:p-3.5 text-xs xl:text-sm 2xl:text-[14px] leading-relaxed text-stone-800 outline-none transition whitespace-pre-wrap ${
              isTooLong
                ? 'border-rose-500 focus:border-rose-600 focus:ring-1 focus:ring-rose-600'
                : isOptimal
                ? 'border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                : 'border-[#E8E0D8] bg-[#FAF8F5] focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059]'
            }`}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full rounded-xl border px-3.5 py-2.5 xl:py-3 text-xs xl:text-sm 2xl:text-[14px] text-stone-800 outline-none transition ${
              isTooLong
                ? 'border-rose-500 focus:border-rose-600 focus:ring-1 focus:ring-rose-600'
                : isOptimal
                ? 'border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                : 'border-[#E8E0D8] bg-[#FAF8F5] focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059]'
            }`}
          />
        )}
      </div>

      {/* Meter Bar for Range */}
      {(min !== undefined || max !== undefined) && (
        <div className="flex items-center justify-between text-[11px] xl:text-xs">
          <span
            className={`font-medium ${
              isTooLong
                ? 'text-red-600'
                : isTooShort
                ? 'text-amber-600'
                : isOptimal
                ? 'text-emerald-600'
                : 'text-slate-400'
            }`}
          >
            {isTooLong
              ? `Vượt quá giới hạn (${max} ký tự)`
              : isTooShort
              ? `Cần thêm tối thiểu ${min - length} ký tự`
              : isOptimal
              ? '✓ Độ dài lý tưởng'
              : 'Chưa nhập dữ liệu'}
          </span>
          <span className="font-mono text-slate-400">
            {length}
            {max ? `/${max}` : ''} ký tự
          </span>
        </div>
      )}
    </div>
  );
}

function StructuredRows({
  title,
  subtitle,
  fieldPath,
  rows,
  fields,
  minRequired,
  onChange,
}: {
  title: string;
  subtitle: string;
  fieldPath: string;
  rows: Array<Record<string, string>>;
  fields: Array<{ key: string; label: string; placeholder: string; multiline?: boolean }>;
  minRequired: number;
  onChange: (rows: Array<Record<string, string>>) => void;
}) {
  const count = rows.length;
  const isSatisfied = count >= minRequired;

  return (
    <div data-field={fieldPath} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-sm xl:text-[15px] 2xl:text-base font-bold text-slate-800">
            {title} <span className="text-red-500">*</span>
          </span>
          <p className="text-xs xl:text-sm 2xl:text-[14px] text-slate-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs xl:text-sm font-semibold ${
              isSatisfied ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {count}/{minRequired} mục
          </span>
          <button
            type="button"
            onClick={() => onChange([...rows, Object.fromEntries(fields.map((f) => [f.key, '']))])}
            className="inline-flex items-center gap-1 rounded-lg border border-[#E8E0D8] bg-white px-2.5 py-1 xl:px-3.5 xl:py-1.5 text-xs xl:text-sm font-semibold text-stone-700 shadow-2xs hover:border-[#C5A059] hover:text-[#C5A059]"
          >
            <Plus className="h-3.5 w-3.5 xl:h-4 xl:w-4" /> Thêm mới
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map((row, index) => (
          <div
            key={index}
            className="relative grid gap-3 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] p-3.5 xl:p-4 transition hover:border-stone-300 md:grid-cols-[1fr_1.8fr_auto]"
          >
            {fields.map((field) => (
              <div key={field.key} className="flex flex-col justify-start">
                <span className="mb-1 block text-[11px] xl:text-xs font-medium text-slate-500">{field.label}</span>
                {field.multiline ? (
                  <textarea
                    rows={2}
                    value={row[field.key] || ''}
                    placeholder={field.placeholder}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange(
                        rows.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, [field.key]: val } : item
                        )
                      );
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 xl:p-3 text-xs xl:text-sm 2xl:text-[14px] text-slate-800 outline-none transition focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] whitespace-pre-wrap leading-relaxed"
                  />
                ) : (
                  <input
                    type="text"
                    value={row[field.key] || ''}
                    placeholder={field.placeholder}
                    onChange={(e) => {
                      const val = e.target.value;
                      onChange(
                        rows.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, [field.key]: val } : item
                        )
                      );
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 xl:py-2.5 text-xs xl:text-sm 2xl:text-[14px] text-slate-800 outline-none transition focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                  />
                )}
              </div>
            ))}
            <div className="flex items-center justify-end md:items-end">
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}
                aria-label="Xóa dòng"
                className="flex h-8 w-8 xl:h-9 xl:w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4 xl:h-4.5 xl:w-4.5" />
              </button>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs xl:text-sm text-slate-400">
            Chưa có mục nào. Bấm <strong>&quot;Thêm mới&quot;</strong> để tạo mục đầu tiên.
          </div>
        )}
      </div>
    </div>
  );
}

function SectionListEditor({ label, fieldPath, rows, onChange }: {
  label: string;
  fieldPath: string;
  rows: Array<Record<string, unknown>>;
  onChange: (rows: Array<Record<string, unknown>>) => void;
}) {
  const updateRow = (index: number, key: 'title' | 'content', value: string) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  const move = (index: number, offset: number) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= rows.length) return;
    const next = [...rows];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };
  return <div data-field={fieldPath} className="space-y-3"><div className="flex items-center justify-between"><div><h4 className="text-sm xl:text-[15px] 2xl:text-base font-bold text-slate-800">{label}</h4><p className="text-xs xl:text-sm 2xl:text-[14px] text-slate-500">Thêm, sửa và sắp xếp các mục nội dung.</p></div><button type="button" onClick={() => onChange([...rows, { id: `section-${Date.now()}`, title: '', content: '' }])} className="rounded-lg bg-slate-900 px-3 py-2 xl:px-4 xl:py-2.5 text-xs xl:text-sm font-bold text-white">+ Thêm mục</button></div>{rows.map((row, index) => <div key={String(row.id || index)} className="rounded-xl border border-slate-200 bg-slate-50 p-3 xl:p-4"><div className="flex justify-between gap-2"><strong className="text-xs xl:text-sm text-slate-600">Mục {index + 1}</strong><div className="flex gap-2"><button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="text-xs xl:text-sm disabled:opacity-30">↑</button><button type="button" onClick={() => move(index, 1)} disabled={index === rows.length - 1} className="text-xs xl:text-sm disabled:opacity-30">↓</button><button type="button" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} className="text-xs xl:text-sm font-bold text-rose-700">Xóa</button></div></div><input value={String(row.title || '')} onChange={(event) => updateRow(index, 'title', event.target.value)} placeholder="Tiêu đề mục" className="mt-2 w-full rounded-lg border p-2 xl:p-2.5 text-sm xl:text-base font-semibold" /><textarea rows={6} value={Array.isArray(row.content) ? row.content.join('\n\n') : String(row.content || '')} onChange={(event) => updateRow(index, 'content', event.target.value)} placeholder="Nội dung mục" className="mt-2 w-full rounded-lg border p-2 xl:p-2.5 text-sm xl:text-base leading-relaxed" /></div>)}</div>;
}

// =========================================================================
// VALIDATION LOGIC HELPERS
// =========================================================================

function getSeoChecks(seo: Record<string, unknown>) {
  const title = String(seo.title || '').trim();
  const description = String(seo.description || '').trim();
  const focus = String(seo.focus_keyword || '').trim();
  const rawKeywords = Array.isArray(seo.keywords)
    ? seo.keywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
    : [];
  const uniqueKeywords = new Set(rawKeywords);
  const canonical = String(seo.canonical_url || '').trim();
  const robots = String(seo.robots || '').trim();

  return [
    {
      field: 'seo.title',
      label: 'Meta Title đạt chuẩn',
      hint: 'Cần từ 30 đến 60 ký tự',
      ok: title.length >= 30 && title.length <= 60,
    },
    {
      field: 'seo.description',
      label: 'Meta Description đạt chuẩn',
      hint: 'Cần từ 120 đến 160 ký tự',
      ok: description.length >= 120 && description.length <= 160,
    },
    {
      field: 'seo.focus_keyword',
      label: 'Có từ khóa trọng tâm',
      hint: 'Bắt buộc nhập từ khóa chính',
      ok: Boolean(focus),
    },
    {
      field: 'seo.keywords',
      label: 'Tối thiểu 3 từ khóa phụ',
      hint: 'Không để trùng lặp từ khóa',
      ok: rawKeywords.length >= 3 && uniqueKeywords.size === rawKeywords.length,
    },
    {
      field: 'seo.canonical_url',
      label: 'Canonical URL hợp lệ',
      hint: 'Bắt buộc https://maianhomes.vn',
      ok: Boolean(canonical) && canonical.startsWith('https://maianhomes.vn'),
    },
    {
      field: 'seo.robots',
      label: 'Chỉ thị Robots hợp lệ',
      hint: 'Chọn index hoặc noindex',
      ok: ['index,follow', 'noindex,follow', 'noindex,nofollow'].includes(robots),
    },
    {
      field: 'seo.og_media_id',
      label: 'Ảnh đại diện Open Graph',
      hint: 'Được cố định theo giao diện',
      ok: true,
    },
  ];
}

function getGeoChecks(geo: Record<string, unknown>, pageKey?: string) {
  const summary = String(geo.answer_summary || '').trim();
  const facts = Array.isArray(geo.key_facts) ? geo.key_facts.filter((f) => Boolean(String(f).trim())) : [];
  const faqs = Array.isArray(geo.faqs)
    ? (geo.faqs as Array<Record<string, string>>).filter((item) => item.question?.trim() && item.answer?.trim())
    : [];
  const sources = Array.isArray(geo.sources)
    ? (geo.sources as Array<Record<string, string>>).filter(
        (item) => item.title?.trim() && item.url?.trim().startsWith('https://')
      )
    : [];
  const links = Array.isArray(geo.internal_links)
    ? (geo.internal_links as Array<Record<string, string>>).filter(
        (item) => item.title?.trim() && item.url?.trim().startsWith('/')
      )
    : [];

  const checks = [
    ...(pageKey === 'sitemap' ? [] : [{
      field: 'geo.answer_summary',
      label: 'Tóm tắt câu trả lời (Answer Summary)',
      hint: 'Không để trống tóm tắt',
      ok: Boolean(summary),
    }]),
    ...(['home', 'about', 'consignment', 'projects_index', 'news_index', 'team_index', 'recruitment_index', 'privacy'].includes(pageKey || '') ? [{
      field: 'geo.key_facts',
      label: 'Tối thiểu 3 Thông tin chính',
      hint: 'Nhập ít nhất 3 ý cốt lõi',
      ok: facts.length >= 3,
    }] : []),
    ...(['consignment', 'privacy'].includes(pageKey || '') ? [{
      field: 'geo.faqs',
      label: 'Tối thiểu 3 Câu hỏi thường gặp',
      hint: 'Đầy đủ cả câu hỏi và câu trả lời',
      ok: faqs.length >= 3,
    }] : []),
    ...(['home', 'about', 'contact', 'consignment', 'projects_index', 'news_index', 'team_index', 'recruitment_index', 'privacy'].includes(pageKey || '') ? [{
      field: 'geo.sources',
      label: 'Tối thiểu 1 Nguồn tham khảo HTTPS',
      hint: 'URL phải bắt đầu bằng https://',
      ok: sources.length >= 1,
    }] : []),
    ...(pageKey === 'sitemap' ? [] : [{
      field: 'geo.internal_links',
      label: 'Tối thiểu 1 Liên kết nội bộ',
      hint: 'URL phải bắt đầu bằng /',
      ok: links.length >= 1,
    }]),
  ];
  return checks;
}
