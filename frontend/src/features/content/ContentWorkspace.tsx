'use client';
/* eslint-disable @next/next/no-img-element -- User-managed preview URLs require native image behavior. */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { adminConfirm } from '@/components/admin/admin-dialog-service';
import { adminLabel } from '@/lib/admin-labels';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Plus, Search, Edit, Trash, ExternalLink, RefreshCw, X,
  AlertCircle, Building2, Newspaper, ShieldAlert, Sparkles,
  CheckCircle2, ChevronRight, ShieldCheck
} from 'lucide-react';
import { getAssetUrl } from '@/lib/api';
import { projectsApi } from '@/features/content/api/projects';
import { createIdempotencyKey } from '@/features/content/api/workflow';
import WorkflowActions from '@/features/content/shared/WorkflowActions';
import type { ContentAction } from '@/features/content/contracts/generated';
import { useAuth } from '@/context/AuthContext';
import ProjectForm, { ProjectFormData, DEFAULT_FORM } from './projects/ProjectEditor';
import type { ProjectListItem } from './projects/project-form-contract';

const NewsAdminClient = dynamic(() => import('./articles/NewsWorkspace'));

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const WORKFLOW_LABEL: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã xuất bản'
};

const PUBLICATION_LABEL: Record<string, string> = {
  NEVER_PUBLISHED: 'Chưa xuất bản',
  PUBLISHED: 'Đang hiển thị',
  ARCHIVED: 'Đã lưu trữ',
  UNPUBLISHED: 'Đã gỡ'
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Đang mở bán',
  COMING_SOON: 'Sắp ra mắt',
  PRE_SALE: 'Sắp mở bán',
  HANDING_OVER: 'Đang bàn giao',
  RESERVED: 'Đã giữ chỗ',
  SOLD: 'Đã bán hết',
};

const DECLARED_PROJECT_STATUSES: Array<{ value: string; label: string }> = [
  { value: 'AVAILABLE', label: 'Đang mở bán' },
  { value: 'PRE_SALE', label: 'Sắp mở bán' },
  { value: 'HANDING_OVER', label: 'Đang bàn giao' },
];

const STATUS_BADGE_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  AVAILABLE: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  COMING_SOON: { bg: 'bg-sky-50/90', text: 'text-sky-800', border: 'border-sky-200', dot: 'bg-sky-500' },
  PRE_SALE: { bg: 'bg-indigo-50/90', text: 'text-indigo-800', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  HANDING_OVER: { bg: 'bg-amber-50/90', text: 'text-amber-900', border: 'border-amber-200', dot: 'bg-amber-500' },
  RESERVED: { bg: 'bg-orange-50/90', text: 'text-orange-900', border: 'border-orange-200', dot: 'bg-orange-500' },
  SOLD: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-400' },
};

export default function ContentWorkspace({ initialTab = 'projects' }: { initialTab?: 'projects' | 'news' | 'company' } = {}) {
  const { user } = useAuth();
  const permissions = new Set(user?.permissions || []);
  const can = (permission: string) => permissions.has('*') || permissions.has(permission);
  const canCreateProject = can('website.projects.create');
  const canUpdateProject = can('website.projects.update');
  const canPublishProject = can('website.projects.publish');
  const canDeleteProject = can('website.projects.delete');
  const isManagerOrCEO = canPublishProject;
  const [activeSection, setActiveSection] = useState<'projects' | 'news'>(
    initialTab === 'news' ? 'news' : 'projects',
  );

  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState('');
  const [publicationFilter, setPublicationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editData, setEditData] = useState<Partial<ProjectFormData> | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState(1);
  const [formDirty, setFormDirty] = useState(false);
  const [formIdempotencyKey, setFormIdempotencyKey] = useState('');
  const [note, setNote] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    type: 'archive' | 'delete' | 'warning';
    onConfirm: () => void;
  } | null>(null);
  const projectDialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const toast = (type: 'success' | 'error', msg: string) => {
    setNote({ type, msg });
    setTimeout(() => setNote(null), 5000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await projectsApi.list();
      setProjects(res.items || []);
    } catch (error: unknown) {
      toast('error', errorMessage(error, 'Không thể tải danh sách dự án.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'company') {
        window.location.href = '/admin/content/company';
        return;
      }
      if (tab === 'news' || tab === 'projects') {
        setActiveSection(tab);
      }
    }
  }, [load]);

  // Đảm bảo khi truy cập hoặc chuyển trang Dự án trong Admin, section hiển thị luôn là section Dự án đầu tiên
  useEffect(() => {
    if (initialTab === 'projects') {
      setActiveSection('projects');
    } else if (initialTab === 'news') {
      setActiveSection('news');
    }
  }, [initialTab]);

  // Bộ lọc tình trạng dự án chỉ hiển thị các trạng thái được khai báo chính thức
  const availableStatusOptions = useMemo(() => {
    const list = [...DECLARED_PROJECT_STATUSES];
    const legacyKeys = ['RESERVED', 'SOLD'] as const;
    for (const key of legacyKeys) {
      if (projects.some((p) => p.status === key) || statusFilter === key) {
        list.push({ value: key, label: STATUS_LABEL[key] || key });
      }
    }
    return list;
  }, [projects, statusFilter]);

  const handleSwitchTab = (tab: 'projects' | 'news') => {
    setActiveSection(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({}, '', url.toString());
    }
  };

  const openCreate = () => {
    if (!canCreateProject) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    setEditId(null);
    setEditVersion(1);
    setEditData(null);
    setFormDirty(false);
    setFormIdempotencyKey(createIdempotencyKey('project-create'));
    setIsOpen(true);
  };

  const openEdit = async (p: ProjectListItem) => {
    if (!canUpdateProject) return;
    const id = p.id || p._id;
    if (!id) return;
    try {
      lastFocusedRef.current = document.activeElement as HTMLElement | null;
      const detail = await projectsApi.detail(id);
      setEditId(id);
      setEditData(detail.project);
      setEditVersion(detail.project.version || p.version || 1);
      setFormDirty(false);
      setFormIdempotencyKey(createIdempotencyKey(`project-${id}-save`));
      setIsOpen(true);
    } catch (error: unknown) {
      toast('error', errorMessage(error, 'Không thể tải bản nháp dự án.'));
    }
  };

  const close = useCallback(async (force = false) => {
    if (!force && formDirty && !await adminConfirm('Bạn có thay đổi chưa lưu. Đóng biểu mẫu và bỏ các thay đổi này?')) return;
    setIsOpen(false);
    setFormDirty(false);
    window.setTimeout(() => lastFocusedRef.current?.focus(), 0);
  }, [formDirty]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = projectDialogRef.current;
    dialog?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )).filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  const handleDelete = (id: string, version: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Lưu trữ dự án',
      message: 'Lưu trữ dự án này? Dự án sẽ không còn hiển thị công khai trên website.',
      confirmText: 'Lưu trữ',
      cancelText: 'Hủy',
      type: 'warning',
      onConfirm: async () => {
        try {
          await projectsApi.archive(id, version);
          toast('success', 'Đã lưu trữ dự án thành công.');
          load();
        } catch (error: unknown) {
          toast('error', errorMessage(error, 'Không thể lưu trữ dự án.'));
        }
      }
    });
  };

  const handlePermanentDelete = (id: string, version: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa vĩnh viễn dự án',
      message: 'Xóa vĩnh viễn dự án đã lưu trữ? Thao tác này không thể hoàn tác.',
      confirmText: 'Xóa vĩnh viễn',
      cancelText: 'Hủy',
      type: 'delete',
      onConfirm: async () => {
        try {
          await projectsApi.deletePermanently(id, version);
          toast('success', 'Dự án đã được xóa vĩnh viễn.');
          load();
        } catch (error: unknown) {
          toast('error', errorMessage(error, 'Không thể xóa vĩnh viễn dự án.'));
        }
      }
    });
  };

  const handleProjectTransition = async (
    id: string,
    action: ContentAction,
    version: number,
    overrideWarningCodes: string[] = [],
  ): Promise<void> => {
    const currentProject = projects.find((project) => (project.id || project._id) === id);
    if (
      action === 'publish' &&
      currentProject?.quality_summary?.error_count
    ) {
      toast('error', `Còn ${currentProject.quality_summary.error_count} lỗi SEO/GEO bắt buộc. Hãy mở dự án để hoàn thiện.`);
      return;
    }
    try {
      await projectsApi.transition(id, action, version, '', overrideWarningCodes);
      toast('success', 'Đã cập nhật quy trình dự án.');
      load();
    } catch (error: unknown) {
      const apiError = error as Error & { code?: string; warningCodes?: string[] };
      if (
        isManagerOrCEO &&
        apiError.code === 'QUALITY_WARNINGS_REQUIRE_CONFIRMATION' &&
        apiError.warningCodes?.length &&
        await adminConfirm(`Dự án còn ${apiError.warningCodes.length} cảnh báo SEO/GEO. Xác nhận bỏ qua để tiếp tục?`)
      ) {
        await handleProjectTransition(id, action, version, apiError.warningCodes);
        return;
      }
      toast('error', errorMessage(error, 'Không thể chuyển trạng thái dự án.'));
    }
  };

  const handleSubmit = async (data: ProjectFormData, andPublish?: boolean) => {
    setIsSubmitting(true);
    try {
      let targetId = editId;
      let targetVersion = editVersion;
      if (editId) {
        const response = await projectsApi.update(editId, data, editVersion, formIdempotencyKey);
        targetVersion = response.project.version;
        setEditVersion(targetVersion);
        if (!andPublish) {
          toast('success', 'Đã lưu bản nháp dự án thành công.');
        }
      } else {
        const response = await projectsApi.create(data, formIdempotencyKey);
        targetId = response.project.id;
        targetVersion = response.project.version;
        if (!andPublish) {
          toast('success', 'Tạo dự án mới thành công.');
        }
      }

      if (andPublish && targetId) {
        try {
          await projectsApi.transition(targetId, 'publish', targetVersion, '', []);
        } catch (error: unknown) {
          const apiError = error as Error & { code?: string; warningCodes?: string[] };
          const canOverrideWarnings = isManagerOrCEO
            && apiError.code === 'QUALITY_WARNINGS_REQUIRE_CONFIRMATION'
            && Boolean(apiError.warningCodes?.length);
          if (!canOverrideWarnings) throw error;
          const confirmed = await adminConfirm(
            `Dự án còn ${apiError.warningCodes?.length || 0} cảnh báo SEO/GEO. Xác nhận bỏ qua để xuất bản?`,
          );
          if (!confirmed) {
            toast('success', 'Đã lưu bản nháp. Dự án chưa được xuất bản.');
            return;
          }
          await projectsApi.transition(targetId, 'publish', targetVersion, '', apiError.warningCodes || []);
        }
        toast('success', 'Đã lưu và xuất bản dự án thành công ra website!');
      }

      close(true);
      await load();
    } catch (error: unknown) {
      const currentVersion = (error as Error & { currentVersion?: number }).currentVersion;
      if (typeof currentVersion === 'number') setEditVersion(currentVersion);
      toast('error', errorMessage(error, 'Lỗi khi lưu dữ liệu dự án.'));
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = projects.filter(p =>
    (search === '' || p.name.toLowerCase().includes(search.toLowerCase()) || p.location.toLowerCase().includes(search.toLowerCase())) &&
    (!workflowFilter || p.workflow_status === workflowFilter) &&
    (!publicationFilter || p.publication_status === publicationFilter) &&
    (!statusFilter || p.status === statusFilter)
  );

  return (
    <div className="admin-module-page admin-module-page--projects space-y-6 relative max-w-[1600px] mx-auto pb-12">
      {/* Toast Notification */}
      {note && (
        <div
          role="status"
          className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border animate-in fade-in slide-in-from-top-4 duration-300 ${
            note.type === 'success'
              ? 'bg-[#1A3A2A]/95 border-emerald-500/40 text-emerald-200'
              : 'bg-[#3A1A1A]/95 border-rose-500/40 text-rose-200'
          }`}
        >
          {note.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
          <span className="text-xs font-bold">{note.msg}</span>
        </div>
      )}

      {/* ── 1. EXECUTIVE MARKETING COMMAND HEADER ── */}
      <div className="bg-white/95 backdrop-blur-md border border-[#E8E0D8] shadow-[0_10px_35px_rgba(45,27,20,0.04)] rounded-3xl relative z-20 overflow-hidden">
        {/* Top Gold Gradient Trim */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#8A6A2F] via-[#D4AF37] to-[#C5A059]" />

        <div className="p-5 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E8E0D8]/70">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2D1B14] to-[#4A3228] border border-[#C5A059]/40 flex items-center justify-center text-[#D4AF37] shadow-md shadow-[#2D1B14]/10 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-serif font-bold text-[#2D1B14] tracking-tight">
                  Phòng Marketing & Phát Triển Thương Hiệu
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200/80 text-[10px] font-bold">
                  Portfolio Hub
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#8A7A6E] mt-0.5 font-medium">
                <span>Quản trị Marketing</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#C5A059]" />
                <span className="font-bold text-[#2D1B14]">
                  {activeSection === 'projects' ? 'Danh mục Dự án Bất động sản' : 'Bài viết & Tối ưu SEO/GEO'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            {user?.role && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF8F5] border border-[#E8E0D8] text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C5A059]" />
                <span className="text-[#6B5E55]">Đặc quyền:</span>
                <strong className="text-[#2D1B14]">{adminLabel(user.role, 'role')}</strong>
              </div>
            )}

            {/* Segmented Control Switcher */}
            <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-2xl border border-[#E8E0D8] shadow-2xs">
              <button
                type="button"
                onClick={() => handleSwitchTab('projects')}
                className={`flex items-center gap-1.5 xl:gap-2 px-3 xl:px-4 py-1.5 rounded-xl text-[11px] xl:text-xs font-bold transition-all ${
                  activeSection === 'projects'
                    ? 'bg-[#2D1B14] text-[#D4AF37] shadow-sm'
                    : 'text-[#6B5E55] hover:text-[#2D1B14] hover:bg-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Dự án BĐS</span>
                {projects.length > 0 && (
                  <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[9px] xl:text-[10px] font-mono border ${
                    activeSection === 'projects'
                      ? 'bg-[#3D2820] text-[#D4AF37] border-[#C5A059]/40'
                      : 'bg-white text-[#2D1B14] border-[#E8E0D8]'
                  }`}>
                    {projects.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSwitchTab('news')}
                className={`flex items-center gap-1.5 xl:gap-2 px-3 xl:px-4 py-1.5 rounded-xl text-[11px] xl:text-xs font-bold transition-all ${
                  activeSection === 'news'
                    ? 'bg-[#2D1B14] text-[#D4AF37] shadow-sm'
                    : 'text-[#6B5E55] hover:text-[#2D1B14] hover:bg-white'
                }`}
              >
                <Newspaper className="w-3.5 h-3.5" />
                <span>Tin tức & SEO/GEO</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: PROJECTS MANAGEMENT ── */}
      {activeSection === 'projects' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* 4 KPI Intelligence Cards (Compact Space-Saving Layout) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setWorkflowFilter('');
                setPublicationFilter('');
                setStatusFilter('');
              }}
              className={`text-left rounded-xl border px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-2xs flex items-center justify-between gap-1.5 sm:gap-2 transition-all cursor-pointer group ${
                !search && !workflowFilter && !publicationFilter && !statusFilter
                  ? 'border-[#C5A059] bg-[#FAF8F5]/60 ring-1 ring-[#C5A059]/30'
                  : 'border-[#E8E0D8] bg-white hover:border-[#C5A059]/60 hover:shadow-xs'
              }`}
              title="Tất cả dự án (nhấp để bỏ lọc)"
            >
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#FAF8F5] border border-[#E8E0D8] flex items-center justify-center text-[#C5A059] shrink-0 group-hover:scale-105 transition-transform">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#6B5E55] block truncate leading-tight">
                    Tổng danh mục
                  </span>
                  <p className="text-[9px] text-[#8A7A6E] truncate leading-tight mt-0.5">
                    Kho dự án lưu trữ
                  </p>
                </div>
              </div>
              <p className="text-base sm:text-lg font-serif font-bold text-[#2D1B14] shrink-0 pl-1 leading-none tabular-nums">
                {projects.length}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPublicationFilter(prev => prev === 'PUBLISHED' ? '' : 'PUBLISHED')}
              className={`text-left rounded-xl border border-emerald-200 bg-emerald-50/40 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-2xs flex items-center justify-between gap-1.5 sm:gap-2 hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group ${
                publicationFilter === 'PUBLISHED' ? 'ring-1.5 ring-emerald-500 bg-emerald-100/70 border-emerald-300' : ''
              }`}
              title="Nhấp để lọc dự án đang hiển thị"
            >
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-100/80 border border-emerald-200/80 flex items-center justify-center text-emerald-800 shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-900 block truncate leading-tight">
                    Đang hiển thị
                  </span>
                  <p className="text-[9px] text-emerald-800/80 truncate leading-tight mt-0.5">
                    Công khai website
                  </p>
                </div>
              </div>
              <p className="text-base sm:text-lg font-serif font-bold text-emerald-900 shrink-0 pl-1 leading-none tabular-nums">
                {projects.filter((item) => item.publication_status === 'PUBLISHED').length}
              </p>
            </button>

            <div className="rounded-xl border border-rose-200 bg-rose-50/40 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-2xs flex items-center justify-between gap-1.5 sm:gap-2 hover:border-rose-300 hover:shadow-xs transition-all">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-rose-100/80 border border-rose-200/80 flex items-center justify-center text-rose-800 shrink-0">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-900 block truncate leading-tight">
                    Cần tối ưu SEO
                  </span>
                  <p className="text-[9px] text-rose-800/80 truncate leading-tight mt-0.5">
                    Chưa đạt Quality Gate
                  </p>
                </div>
              </div>
              <p className="text-base sm:text-lg font-serif font-bold text-rose-900 shrink-0 pl-1 leading-none tabular-nums">
                {projects.filter((item) => (item.quality_summary?.error_count || 0) > 0).length}
              </p>
            </div>
          </div>

          {/* Action & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 xl:gap-4 bg-white p-3 xl:p-4 rounded-2xl xl:rounded-3xl border border-[#E8E0D8] shadow-2xs">
            <div className="flex items-center bg-[#FAF8F5] border border-[#E8E0D8] px-3 py-1.5 xl:px-3.5 xl:py-2 rounded-xl xl:rounded-2xl w-full sm:w-72 xl:w-80 focus-within:border-[#C5A059] focus-within:ring-1 focus-within:ring-[#C5A059] transition-all">
              <Search className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-gray-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Tìm dự án theo tên hoặc vị trí..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-[11px] xl:text-xs w-full text-[#2D1B14] placeholder-gray-400 font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:gap-2.5 w-full sm:w-auto justify-end">
              <select
                value={workflowFilter}
                onChange={(event) => setWorkflowFilter(event.target.value)}
                className="rounded-xl xl:rounded-2xl border border-[#E8E0D8] bg-[#FAF8F5] px-2.5 py-1.5 xl:px-3 xl:py-2 text-[11px] xl:text-xs font-bold text-[#2D1B14] outline-none focus:border-[#C5A059]"
                aria-label="Loc trang thai kiem duyet"
              >
                <option value="">Tất cả kiểm duyệt</option>
                <option value="DRAFT">Bản nháp</option>
                <option value="PUBLISHED">Đã xuất bản</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl xl:rounded-2xl border border-[#E8E0D8] bg-[#FAF8F5] px-2.5 py-1.5 xl:px-3 xl:py-2 text-[11px] xl:text-xs font-bold text-[#2D1B14] outline-none focus:border-[#C5A059]"
                aria-label="Loc tinh trang du an"
              >
                <option value="">Tất cả tình trạng</option>
                {availableStatusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={publicationFilter}
                onChange={(event) => setPublicationFilter(event.target.value)}
                className="rounded-xl xl:rounded-2xl border border-[#E8E0D8] bg-[#FAF8F5] px-2.5 py-1.5 xl:px-3 xl:py-2 text-[11px] xl:text-xs font-bold text-[#2D1B14] outline-none focus:border-[#C5A059]"
                aria-label="Loc trang thai xuat ban"
              >
                <option value="">Tất cả xuất bản</option>
                <option value="PUBLISHED">Đang hiển thị</option>
                <option value="UNPUBLISHED">Đã gỡ</option>
                <option value="ARCHIVED">Lưu trữ</option>
              </select>

              <button
                type="button"
                onClick={load}
                className="p-2 xl:p-2.5 bg-[#FAF8F5] hover:bg-[#FAF6F0] border border-[#E8E0D8] rounded-xl xl:rounded-2xl text-gray-600 hover:text-[#2D1B14] transition-colors"
                title="Làm mới danh sách"
              >
                <RefreshCw className={`w-3.5 h-3.5 xl:w-4 xl:h-4 ${loading ? 'animate-spin text-[#C5A059]' : ''}`} />
              </button>

              {canCreateProject && <button
                type="button"
                onClick={openCreate}
                className="flex items-center gap-1.5 xl:gap-2 px-3.5 py-2 xl:px-5 xl:py-2.5 rounded-xl bg-gradient-to-r from-[#C5A059] via-[#D4AF37] to-[#B38E46] text-white text-[11px] xl:text-xs font-bold shadow-md shadow-[#C5A059]/25 hover:from-[#B38E46] hover:to-[#996515] active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 xl:w-4 xl:h-4" />
                <span>Thêm dự án mới</span>
              </button>}
            </div>
          </div>

          {/* Projects Data Table & Mobile Cards */}
          <div className="rounded-3xl border border-[#E8E0D8] bg-white overflow-hidden shadow-2xs">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="w-7 h-7 animate-spin text-[#C5A059]" />
                <p className="text-xs text-gray-500 font-mono">Đang tải danh mục dự án...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 px-4">
                <div className="w-14 h-14 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#C5A059] mx-auto mb-3">
                  <Building2 className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-gray-800 mb-1">Chưa tìm thấy dự án nào</h3>
                <p className="text-xs text-gray-500 mb-5">Thử thay đổi bộ lọc hoặc thêm dự án bất động sản mới vào hệ thống.</p>
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2D1B14] text-[#D4AF37] border border-[#C5A059]/40 text-xs font-bold"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm dự án đầu tiên</span>
                </button>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[900px]">
                    <thead>
                      <tr className="text-[#6B5E55] font-mono text-[10px] xl:text-[11px] uppercase tracking-wider border-b border-[#E8E0D8] bg-[#FAF8F5]">
                        <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 font-bold whitespace-nowrap">Dự án</th>
                        <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 font-bold whitespace-nowrap">Kiểm duyệt & Xuất bản</th>
                        <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 font-bold whitespace-nowrap">Chất lượng SEO/GEO</th>
                        <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 font-bold whitespace-nowrap">Tình trạng mở bán</th>
                        <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 text-right font-bold whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E2D9]/70 font-medium">
                      {filtered.map(p => {
                        const id = p.id || p._id || '';
                        const ownerId = p.created_by || p.author_id;
                        const isOwner = Boolean(ownerId && [user?.id, user?.employee_id].includes(ownerId));
                        const canEditThisProject = canUpdateProject
                          && p.publication_status !== 'ARCHIVED'
                          && (canPublishProject || isOwner);
                        const hasSeo = p.quality_summary
                          ? p.quality_summary.error_count === 0
                          : !!(p.seo_metadata?.title && p.seo_metadata?.description);
                        const projectImg = p.logo_url || p.images?.[0] || p.hero_images?.[0];
                        const stageStyle = STATUS_BADGE_STYLE[p.status] || STATUS_BADGE_STYLE.SOLD;

                        return (
                          <tr
                            key={id}
                            className="hover:bg-[#FAF7F2] border-l-2 border-l-transparent hover:border-l-[#C5A059] transition-all duration-200 group"
                          >
                            <td className="py-2.5 px-3.5 xl:py-3.5 xl:px-5">
                              <div
                                onClick={() => canEditThisProject && void openEdit(p)}
                                className={`flex items-center gap-2.5 xl:gap-3.5 ${canEditThisProject ? 'cursor-pointer' : ''}`}
                                title={canEditThisProject ? 'Nhấp để chỉnh sửa chi tiết dự án' : undefined}
                              >
                                <div className="w-9 h-9 xl:w-11 xl:h-11 bg-[#FAF8F5] rounded-xl xl:rounded-2xl overflow-hidden flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0 border border-[#E8E0D8] shadow-2xs">
                                  {projectImg ? (
                                    <img src={getAssetUrl(projectImg) || ''} alt={p.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <Building2 className="w-4 h-4 xl:w-5 xl:h-5 text-gray-400" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-serif font-bold text-[#2D1B14] text-xs xl:text-sm group-hover:text-[#C5A059] transition-colors truncate max-w-[220px] xl:max-w-sm">
                                    {p.name}
                                  </p>
                                  <p className="text-[10px] xl:text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                                    /du_an/{p.slug}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 whitespace-nowrap">
                              <div className="flex flex-col items-start gap-1">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] xl:text-[10px] font-mono font-bold border ${
                                  p.is_published
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-300'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${p.is_published ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                  {p.is_published ? 'LIVE' : 'BẢN NHÁP'}
                                </span>
                                <div className="flex items-center gap-1">
                                  <span className="rounded-md border border-blue-200 bg-blue-50/90 px-1.5 py-0.2 text-[9px] font-bold text-blue-800">
                                    {WORKFLOW_LABEL[p.workflow_status || 'DRAFT'] || adminLabel(p.workflow_status, 'status')}
                                  </span>
                                  <span className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.2 text-[9px] font-bold text-gray-600">
                                    {PUBLICATION_LABEL[p.publication_status || 'NEVER_PUBLISHED'] || adminLabel(p.publication_status, 'status')}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 xl:px-2.5 xl:py-1 rounded-xl text-[10px] xl:text-[11px] font-mono font-bold border ${
                                hasSeo
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 text-amber-900 border-amber-200'
                              }`}>
                                <ShieldCheck className={`w-3.5 h-3.5 ${hasSeo ? 'text-emerald-600' : 'text-amber-600'}`} />
                                {hasSeo ? 'Chuẩn SEO/GEO' : 'Cần bổ sung'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 xl:px-3 xl:py-1 rounded-full text-[10px] xl:text-[11px] font-bold border ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                                {STATUS_LABEL[p.status] || adminLabel(p.status, 'status')}
                              </span>
                            </td>

                            <td className="py-2.5 px-3.5 xl:py-3.5 xl:px-5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <WorkflowActions
                                  canPublish={canPublishProject}
                                  publicationStatus={p.publication_status}
                                  workflowStatus={p.workflow_status}
                                  onAction={(action) => handleProjectTransition(id, action, p.version || 1)}
                                />
                                {canDeleteProject && p.publication_status === 'ARCHIVED' && (
                                  <button
                                    type="button"
                                    onClick={() => handlePermanentDelete(id, p.version || 1)}
                                    className="p-2 rounded-xl text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors"
                                    title="Xóa vĩnh viễn"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canEditThisProject && <button
                                  type="button"
                                  onClick={() => void openEdit(p)}
                                  className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-[#FAF6F0] border border-[#E8E0D8] text-[#2D1B14] hover:text-[#C5A059] transition-colors"
                                  title="Chỉnh sửa chi tiết dự án"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>}
                                <a
                                  href={`/du_an/${p.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-xl bg-[#FAF8F5] hover:bg-[#FAF6F0] border border-[#E8E0D8] text-gray-500 hover:text-[#C5A059] transition-colors"
                                  title="Xem trang công khai"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                {canDeleteProject && p.publication_status !== 'ARCHIVED' && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(id, p.version || 1)}
                                    className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Lưu trữ dự án"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View (< 768px) */}
                <div className="md:hidden divide-y divide-[#E5E2D9]/70">
                  {filtered.map(p => {
                    const id = p.id || p._id || '';
                    const ownerId = p.created_by || p.author_id;
                    const isOwner = Boolean(ownerId && [user?.id, user?.employee_id].includes(ownerId));
                    const canEditThisProject = canUpdateProject
                      && p.publication_status !== 'ARCHIVED'
                      && (canPublishProject || isOwner);
                    const hasSeo = p.quality_summary
                      ? p.quality_summary.error_count === 0
                      : !!(p.seo_metadata?.title && p.seo_metadata?.description);
                    const projectImg = p.logo_url || p.images?.[0] || p.hero_images?.[0];
                    const stageStyle = STATUS_BADGE_STYLE[p.status] || STATUS_BADGE_STYLE.SOLD;

                    return (
                      <div key={id} className="p-4 space-y-3 bg-white hover:bg-[#FAF8F5] transition-colors">
                        <div
                          onClick={() => canEditThisProject && void openEdit(p)}
                          className={`flex items-start gap-3 ${canEditThisProject ? 'cursor-pointer' : ''}`}
                          title={canEditThisProject ? 'Nhấp để chỉnh sửa chi tiết dự án' : undefined}
                        >
                          <div className="w-14 h-14 bg-[#FAF8F5] rounded-2xl overflow-hidden flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 border border-[#E8E0D8]">
                            {projectImg ? (
                              <img src={getAssetUrl(projectImg) || ''} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <Building2 className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-serif font-bold text-[#2D1B14] text-sm truncate">{p.name}</h4>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${stageStyle.bg} ${stageStyle.text} ${stageStyle.border}`}>
                                {STATUS_LABEL[p.status] || adminLabel(p.status, 'status')}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                p.is_published ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}>
                                {p.is_published ? 'LIVE' : 'NHÁP'}
                              </span>
                              <span className={`px-2 py-0.5 rounded-xl text-[10px] font-mono font-bold border ${
                                hasSeo ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-900 border-amber-200'
                              }`}>
                                SEO: {hasSeo ? 'OK' : 'Cần sửa'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#E8E0D8] gap-2">
                          <span className="text-[10px] text-gray-400 font-mono">/du_an/{p.slug}</span>
                          <div className="flex items-center gap-1.5">
                            <WorkflowActions
                              canPublish={canPublishProject}
                              publicationStatus={p.publication_status}
                              workflowStatus={p.workflow_status}
                              onAction={(action) => handleProjectTransition(id, action, p.version || 1)}
                            />
                            {canEditThisProject && <button
                              type="button"
                              onClick={() => void openEdit(p)}
                              className="p-2 bg-[#FAF8F5] hover:bg-[#FAF6F0] border border-[#E8E0D8] rounded-xl text-[#2D1B14]"
                              title="Chỉnh sửa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>}
                            <a
                              href={`/du_an/${p.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-[#FAF8F5] hover:bg-[#FAF6F0] border border-[#E8E0D8] rounded-xl text-[#C5A059]"
                              title="Xem trang"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION 2: NEWS & SEO/GEO MANAGEMENT ── */}
      {activeSection === 'news' && (
        <div className="animate-in fade-in duration-200">
          <NewsAdminClient hideHeader={true} />
        </div>
      )}



      {/* ── FULLSCREEN IMMERSIVE PROJECT WORKSPACE ── */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={projectDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={editId ? 'Chỉnh sửa dự án' : 'Thêm dự án mới'}
          tabIndex={-1}
          className="mkt-fullscreen-overlay outline-none"
        >
          <ProjectForm
            key={editId ? `project-edit-${editId}` : 'project-create'}
            initialData={editData || DEFAULT_FORM}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            isEdit={!!editId}
            canPublish={canPublishProject}
            onDirtyChange={setFormDirty}
            onClose={() => close()}
          />
        </div>,
        document.body
      )}

      {/* ── CONFIRMATION MODAL ── */}
      {confirmDialog?.isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-[#E8E0D8]">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3.5 rounded-2xl shrink-0 ${
                  confirmDialog.type === 'delete'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {confirmDialog.type === 'delete' ? <Trash className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-[#2D1B14] mb-1.5">{confirmDialog.title}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">{confirmDialog.message}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-[#FAF8F5] flex justify-end gap-3 border-t border-[#E8E0D8]">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-[#E8E0D8] rounded-xl hover:bg-gray-50 transition-colors"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-sm ${
                  confirmDialog.type === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#2D1B14] text-[#D4AF37] hover:bg-[#3D2820] border border-[#C5A059]/40'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
