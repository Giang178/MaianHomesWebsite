'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Users,
  CheckCircle2,
  FileText,
  Phone,
  Mail,
  Award,
  Briefcase,
  LayoutGrid,
  List,
  AlertCircle,
  Archive,
  Crown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { teamAdminApi, type PublicStaffDraft, type PublicStaffOptions, type PublicStaffRecord } from './api';

const emptyDraft = (): PublicStaffDraft => ({
  slug: '',
  profile_type: 'SPECIALIST',
  full_name: '',
  position: '',
  phone: '',
  email: '',
  avatar_media_id: null,
  avatar_alt_text: '',
  headline: '',
  short_bio: '',
  about: '',
  quote: '',
  specialties: [],
  achievements: [],
  years_experience: 0,
  customers_served: 0,
  deals_completed: 0,
  satisfaction_rate: 100,
  linkedin_url: '',
  show_on_home: false,
  is_featured: false,
  allow_detail_view: true,
  display_order: 100,
  project_ids: [],
  seo_title: '',
  seo_description: '',
  consent_confirmed: false,
});

const fieldClass =
  'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#AA820A] focus:ring-2 focus:ring-[#AA820A]/15 disabled:bg-slate-50 disabled:text-slate-400';
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600';

type ApiIssue = { field?: string; message?: string };

const PROFILE_TYPE_MAP: Record<
  string,
  { label: string; badgeClass: string; icon: typeof Crown }
> = {
  LEADERSHIP: {
    label: 'Lãnh đạo',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
    icon: Crown,
  },
  SPECIALIST: {
    label: 'Chuyên gia',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-300 font-semibold',
    icon: Award,
  },
  BROKER: {
    label: 'Nhà môi giới',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
    icon: Briefcase,
  },
};

const STATUS_MAP: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  PUBLISHED: {
    label: 'Đang xuất bản',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500 animate-pulse',
  },
  IN_REVIEW: {
    label: 'Chờ duyệt',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
  },
  DRAFT: {
    label: 'Bản nháp',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  UNPUBLISHED: {
    label: 'Đã gỡ',
    badgeClass: 'bg-zinc-100 text-zinc-600 border-zinc-200',
    dotClass: 'bg-zinc-400',
  },
  ARCHIVED: {
    label: 'Lưu trữ',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
  },
};

function ContentItemsEditor({
  title,
  value,
  onChange,
  required = false,
}: {
  title: string;
  value: Array<{ title: string; description: string }>;
  onChange: (value: Array<{ title: string; description: string }>) => void;
  required?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs md:col-span-2">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#AA820A]" />
            <span>
              {title}
              {required ? ' *' : ''}
            </span>
          </h3>
          <p className="text-xs text-slate-500 font-light mt-0.5">
            Thêm từng mục gồm tiêu đề chuyên môn và mô tả ngắn gọn.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...value, { title: '', description: '' }])}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#AA820A] bg-amber-50/50 hover:bg-amber-100/60 px-3 text-xs font-bold text-[#8A6808] transition-colors"
        >
          <Plus className="size-3.5" />
          <span>Thêm mục</span>
        </button>
      </div>

      <div className="space-y-3">
        {value.map((item, index) => (
          <article
            key={index}
            className="grid gap-3 rounded-xl bg-slate-50/80 border border-slate-200/70 p-3.5 md:grid-cols-[1fr_1.5fr_auto] items-start"
          >
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Tiêu đề
              </span>
              <input
                aria-label={`${title} ${index + 1}`}
                value={item.title}
                onChange={(event) =>
                  onChange(
                    value.map((entry, itemIndex) =>
                      itemIndex === index ? { ...entry, title: event.target.value } : entry,
                    ),
                  )
                }
                className={fieldClass}
                placeholder="Ví dụ: Tư vấn Văn phòng Hạng A"
              />
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1">
                Mô tả chi tiết
              </span>
              <textarea
                value={item.description}
                onChange={(event) =>
                  onChange(
                    value.map((entry, itemIndex) =>
                      itemIndex === index
                        ? { ...entry, description: event.target.value }
                        : entry,
                    ),
                  )
                }
                className={`${fieldClass} min-h-20`}
                placeholder="Mô tả cụ thể về kinh nghiệm hoặc giải thưởng đạt được..."
              />
            </div>
            <div className="md:pt-5">
              <button
                type="button"
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                className="grid size-10 place-items-center rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                aria-label={`Xóa ${title} ${index + 1}`}
                title="Xóa mục này"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </article>
        ))}

        {value.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500 font-light">
            Chưa có mục nào được thêm. Nhấn &quot;Thêm mục&quot; ở trên để tạo.
          </div>
        )}
      </div>
    </section>
  );
}

export default function PublicTeamAdminPage() {
  const { user } = useAuth();
  const permissions = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);
  const hasPermission = (value: string) => permissions.has('*') || permissions.has(value);

  const [items, setItems] = useState<PublicStaffRecord[]>([]);
  const [options, setOptions] = useState<PublicStaffOptions>({ projects: [], media: [] });
  const [draft, setDraft] = useState<PublicStaffDraft>(emptyDraft);
  const [selected, setSelected] = useState<PublicStaffRecord | null>(null);

  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<PublicStaffRecord | null>(null);

  // Filters
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [profileTypeFilter, setProfileTypeFilter] = useState('ALL');
  const [projectSearch, setProjectSearch] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [issues, setIssues] = useState<ApiIssue[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [staffResult, optionResult] = await Promise.all([
        teamAdminApi.list(),
        teamAdminApi.options(),
      ]);
      setItems(staffResult.items || []);
      setOptions(optionResult);
      setMessage(null);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể tải hồ sơ đội ngũ.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const beginCreate = () => {
    setSelected(null);
    setDraft(emptyDraft());
    setIssues([]);
    setPreview(false);
    setActiveFormTab(0);
    setOpen(true);
  };

  const beginEdit = (item: PublicStaffRecord) => {
    setSelected(item);
    const nextDraft = { ...emptyDraft(), ...item.draft };
    if (!nextDraft.avatar_alt_text && nextDraft.full_name) {
      nextDraft.avatar_alt_text = `Ảnh chân dung ${nextDraft.full_name}`;
    }
    setDraft(nextDraft);
    setIssues([]);
    setPreview(false);
    setActiveFormTab(0);
    setOpen(true);
  };

  const update = <K extends keyof PublicStaffDraft>(key: K, value: PublicStaffDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const altText = draft.avatar_alt_text.trim();
    if (altText.length < 10) {
      setMessage({ type: 'error', text: 'Vui lòng nhập mô tả ảnh tối thiểu 10 ký tự trước khi tải ảnh.' });
      event.target.value = '';
      return;
    }
    try {
      setUploadingAvatar(true);
      setMessage(null);
      const uploaded = await teamAdminApi.uploadAvatar(file, altText);
      update('avatar_media_id', uploaded.id);
      setMessage({ type: 'success', text: 'Đã tải ảnh chân dung cho hồ sơ thành công.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể tải ảnh chân dung.',
      });
    } finally {
      setUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    try {
      setSaving(true);
      setIssues([]);
      if (selected) await teamAdminApi.update(selected.id, draft, selected.version);
      else await teamAdminApi.create(draft);
      setMessage({
        type: 'success',
        text: selected ? 'Đã cập nhật bản nháp hồ sơ thành công.' : 'Đã tạo bản nháp hồ sơ chuyên gia mới.',
      });
      setOpen(false);
      await load();
    } catch (error) {
      const apiError = error as Error & { issues?: ApiIssue[] };
      setIssues(apiError.issues || []);
      setMessage({ type: 'error', text: apiError.message || 'Không thể lưu hồ sơ chuyên gia.' });
    } finally {
      setSaving(false);
    }
  };

  const transition = async (item: PublicStaffRecord, action: string, note?: string) => {
    try {
      setSaving(true);
      setIssues([]);
      await teamAdminApi.transition(item.id, action, item.version, note);
      setMessage({
        type: 'success',
        text:
          action === 'publish'
            ? 'Đã xuất bản hồ sơ và làm mới website public thành công.'
            : 'Đã cập nhật trạng thái hồ sơ chuyên gia.',
      });
      await load();
    } catch (error) {
      const apiError = error as Error & { issues?: ApiIssue[] };
      setIssues(apiError.issues || []);
      setMessage({
        type: 'error',
        text: apiError.message || 'Không thể đổi trạng thái hồ sơ.',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async () => {
    const item = deleteCandidate;
    if (!item) return;
    try {
      setSaving(true);
      await teamAdminApi.delete(item.id, item.version);
      setMessage({ type: 'success', text: `Đã xóa hồ sơ ${item.draft.full_name} vĩnh viễn.` });
      setDeleteCandidate(null);
      await load();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể xóa hồ sơ.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter items
  const filtered = useMemo(() => {
    return items.filter((item) => {
      const text = `${item.draft?.full_name || ''} ${item.draft?.position || ''} ${item.draft?.slug || ''} ${item.draft?.headline || ''}`.toLowerCase();
      const matchSearch = !query.trim() || text.includes(query.trim().toLowerCase());
      const matchStatus = status === 'ALL' || item.status === status;
      const matchType =
        profileTypeFilter === 'ALL' || item.draft.profile_type === profileTypeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [items, query, status, profileTypeFilter]);

  const visibleProjects = useMemo(
    () =>
      options.projects.filter((project) =>
        `${project.name || ''} ${project.location || ''}`
          .toLowerCase()
          .includes(projectSearch.toLowerCase()),
      ),
    [options.projects, projectSearch],
  );

  const chosenMedia = draft.avatar_media_id
    ? {
        id: draft.avatar_media_id,
        url: `/api/public/marketing-media/${encodeURIComponent(draft.avatar_media_id)}`,
        alt_text: draft.avatar_alt_text || draft.full_name || 'Ảnh chân dung',
      }
    : undefined;

  const isPublic = (item: PublicStaffRecord) =>
    item.is_public ?? item.status === 'PUBLISHED';

  // Statistics
  const stats = useMemo(
    () => ({
      total: items.length,
      published: items.filter(isPublic).length,
      draft: items.filter((item) => item.status === 'DRAFT').length,
    }),
    [items],
  );

  return (
    <div className="admin-module-page admin-module-page--team min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-7 text-slate-800 space-y-4 sm:space-y-5">
      {/* 1. Header & Actions */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#AA820A]/10 text-[#AA820A] uppercase tracking-wider">
              Đội ngũ công khai
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500">Public Leadership & Specialists</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 tracking-tight">
            Quản Lý Đội Ngũ Chuyên Gia
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl font-light">
            Biên tập hồ sơ chuyên môn, thành tích, dự án và số liệu thực chiến của đội ngũ chuyên gia tư vấn hiển thị trên website Maian Homes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {hasPermission('website.staff.create') && (
            <button
              onClick={beginCreate}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#2D1B14] to-[#1A100B] px-5 font-bold text-[#D4AF37] hover:brightness-110 shadow-md transition-all cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Tạo hồ sơ</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Statistical Metric Cards (Compact & Space-Optimized) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Tổng hồ sơ */}
        <div
          onClick={() => setStatus('ALL')}
          className={`rounded-xl border p-3 sm:px-4 sm:py-3 shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 ${
            status === 'ALL'
              ? 'border-[#AA820A] bg-amber-50/20 ring-1 ring-[#AA820A]/30'
              : 'border-slate-200/80 bg-white hover:border-[#AA820A]/40'
          }`}
        >
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block truncate">
              Tổng hồ sơ
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <strong className="text-xl sm:text-2xl font-bold font-serif text-slate-900 leading-none">
                {stats.total}
              </strong>
              <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                Toàn bộ nhân sự trong CMS
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#AA820A]/10 group-hover:text-[#AA820A] flex items-center justify-center shrink-0 transition-colors">
            <Users className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Đang xuất bản */}
        <div
          onClick={() => setStatus('PUBLISHED')}
          className={`rounded-xl border p-3 sm:px-4 sm:py-3 shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 ${
            status === 'PUBLISHED'
              ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/30'
              : 'border-emerald-200/70 bg-emerald-50/20 hover:border-emerald-400'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block truncate">
                Đang xuất bản
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <strong className="text-xl sm:text-2xl font-bold font-serif text-emerald-800 leading-none">
                {stats.published}
              </strong>
              <span className="text-[10px] text-emerald-600/80 truncate hidden sm:inline">
                Công khai tại /doi-ngu
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 transition-colors">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Bản nháp */}
        <div
          onClick={() => setStatus('DRAFT')}
          className={`rounded-xl border p-3 sm:px-4 sm:py-3 shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 ${
            status === 'DRAFT'
              ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-500/30'
              : 'border-amber-200/70 bg-amber-50/20 hover:border-amber-400'
          }`}
        >
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block truncate">
              Bản nháp
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <strong className="text-xl sm:text-2xl font-bold font-serif text-amber-800 leading-none">
                {stats.draft}
              </strong>
              <span className="text-[10px] text-amber-600/80 truncate hidden sm:inline">
                Đang cập nhật nội dung
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 transition-colors">
            <FileText className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Messages & Validation Alerts */}
      {message && (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-sm flex items-start gap-3 transition-all ${
            message.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {message.type === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
          )}
          <div className="flex-1 font-medium">{message.text}</div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-xs"
          >
            Đóng
          </button>
        </div>
      )}

      {issues.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-red-800 font-bold text-sm">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>Cần bổ sung trước khi xuất bản hồ sơ:</span>
          </div>
          <ul className="mt-2.5 list-disc space-y-1 pl-6 text-xs sm:text-sm text-red-700">
            {issues.map((issue, index) => (
              <li key={`${issue.field}-${index}`}>
                <strong>{issue.field}</strong>: {issue.message || 'Mục này chưa hợp lệ.'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 4. Filter Toolbar & View Switcher */}
      <section className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:border-[#AA820A] focus:ring-2 focus:ring-[#AA820A]/15"
            placeholder="Tìm theo tên, chức vụ hoặc slug"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Dropdowns & View Mode */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Profile Type filter */}
          <select
            value={profileTypeFilter}
            onChange={(e) => setProfileTypeFilter(e.target.value)}
            className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white outline-none focus:border-[#AA820A]"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="LEADERSHIP">Lãnh đạo</option>
            <option value="SPECIALIST">Chuyên gia</option>
            <option value="BROKER">Nhà môi giới</option>
          </select>

          {/* Status filter */}
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white outline-none focus:border-[#AA820A]"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="PUBLISHED">Đã xuất bản</option>
            <option value="UNPUBLISHED">Đã gỡ</option>
            <option value="ARCHIVED">Lưu trữ</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-50">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'grid' ? 'bg-white shadow-xs text-[#AA820A]' : 'text-slate-500'
              }`}
              title="Chế độ lưới (Grid Card)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                viewMode === 'table' ? 'bg-white shadow-xs text-[#AA820A]' : 'text-slate-500'
              }`}
              title="Chế độ bảng (Table List)"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {(query || status !== 'ALL' || profileTypeFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setStatus('ALL');
                setProfileTypeFilter('ALL');
              }}
              className="py-2 px-2 text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Đặt lại
            </button>
          )}
        </div>
      </section>

      {/* 5. Main Staff Profiles: GRID VIEW */}
      {viewMode === 'grid' ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const media = item.draft.avatar_media_id
              ? {
                  url: `/api/public/marketing-media/${encodeURIComponent(item.draft.avatar_media_id)}`,
                  alt_text: item.draft.avatar_alt_text || item.draft.full_name || 'Ảnh chân dung',
                }
              : undefined;
            const statusConfig = STATUS_MAP[item.status] || {
              label: item.status,
              badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
              dotClass: 'bg-slate-400',
            };
            const typeConfig = PROFILE_TYPE_MAP[item.draft.profile_type] || {
              label: item.draft.profile_type,
              badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
              icon: Award,
            };
            const TypeIcon = typeConfig.icon;

            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Top: Avatar + Profile Info */}
                  <div className="flex gap-4 items-start">
                    <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xs">
                      {media ? (
                        <Image
                          src={media.url}
                          alt={media.alt_text}
                          fill
                          unoptimized
                          className="object-cover object-top"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-slate-400 font-light">
                          Chưa có ảnh
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border ${typeConfig.badgeClass}`}
                        >
                          <TypeIcon className="w-3 h-3" />
                          <span>{typeConfig.label}</span>
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.badgeClass}`}
                        >
                          <span className={`size-1.5 rounded-full ${statusConfig.dotClass}`} />
                          <span>{statusConfig.label}</span>
                        </span>
                      </div>

                      <h2 className="font-bold font-serif text-slate-900 text-lg leading-snug truncate">
                        {item.draft.full_name}
                      </h2>
                      <p className="text-xs text-[#AA820A] font-medium truncate">
                        {item.draft.position || 'Chưa có chức vụ'}
                      </p>

                      {/* Contact mini line */}
                      <div className="pt-1 flex items-center gap-3 text-xs text-slate-500">
                        {item.draft.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <a
                              href={`tel:${item.draft.phone}`}
                              className="hover:text-[#AA820A] truncate max-w-[90px]"
                            >
                              {item.draft.phone}
                            </a>
                          </span>
                        )}
                        {item.draft.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[120px]">{item.draft.email}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Headline / Short Bio snippet */}
                  {item.draft.headline && (
                    <p className="text-xs text-slate-600 font-medium italic line-clamp-1 border-l-2 border-[#AA820A] pl-2.5">
                      &quot;{item.draft.headline}&quot;
                    </p>
                  )}

                  {/* 4 Performance Metrics Grid */}
                  <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                    <div>
                      <strong className="block text-xs font-bold text-slate-900">
                        {item.draft.years_experience}+
                      </strong>
                      <span className="text-[10px] text-slate-400">Năm KN</span>
                    </div>
                    <div>
                      <strong className="block text-xs font-bold text-slate-900">
                        {item.draft.customers_served}+
                      </strong>
                      <span className="text-[10px] text-slate-400">Khách</span>
                    </div>
                    <div>
                      <strong className="block text-xs font-bold text-slate-900">
                        {item.draft.deals_completed}+
                      </strong>
                      <span className="text-[10px] text-slate-400">Giao dịch</span>
                    </div>
                    <div>
                      <strong className="block text-xs font-bold text-[#AA820A]">
                        {item.draft.satisfaction_rate}%
                      </strong>
                      <span className="text-[10px] text-slate-400">Hài lòng</span>
                    </div>
                  </div>

                  {/* Feature Tags & Slug */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <div className="flex items-center gap-1.5">
                      {item.draft.show_on_home && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                          Trang chủ
                        </span>
                      )}
                      {item.draft.is_featured && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold">
                          Nổi bật
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 truncate max-w-[130px]">
                      /doi-ngu/{item.draft.slug} &bull; v{item.version}
                    </span>
                  </div>
                </div>

                {/* Bottom Action Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 bg-slate-50/80 p-3">
                  {hasPermission('website.staff.update') &&
                    item.status !== 'ARCHIVED' && (
                    <button
                      onClick={() => beginEdit(item)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                    >
                      <Edit3 className="size-3.5" />
                      <span>Chỉnh sửa</span>
                    </button>
                  )}

                  {isPublic(item) && (
                    <Link
                      href={`/doi-ngu/${item.draft.slug}`}
                      target="_blank"
                      aria-label={`Xem hồ sơ thành viên ${item.draft.full_name || item.draft.slug} ngoài website`}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                    >
                      <Eye className="size-3.5 text-[#AA820A]" />
                      <span>Xem public</span>
                    </Link>
                  )}

                  {['DRAFT', 'IN_REVIEW', 'UNPUBLISHED'].includes(item.status) &&
                    hasPermission('website.staff.publish') && (
                      <button
                        disabled={saving}
                        onClick={() => void transition(item, 'publish')}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 text-xs font-bold text-white transition-colors shadow-xs disabled:opacity-50"
                      >
                        <Check className="size-3.5" />
                        <span>Xuất bản</span>
                      </button>
                    )}

                  {isPublic(item) && hasPermission('website.staff.publish') && (
                    <button
                      disabled={saving}
                      onClick={() => void transition(item, 'unpublish')}
                      className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
                    >
                      Gỡ hiển thị
                    </button>
                  )}

                  {item.status !== 'ARCHIVED' && hasPermission('website.staff.archive') && (
                    <button
                      disabled={saving}
                      onClick={() => void transition(item, 'archive')}
                      className="min-h-9 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors shadow-xs ml-auto disabled:opacity-50"
                      title="Lưu trữ hồ sơ"
                    >
                      <Archive className="size-3.5 inline mr-1" />
                      Lưu trữ
                    </button>
                  )}

                  {item.status === 'ARCHIVED' && hasPermission('website.staff.delete') && (
                    <button
                      disabled={saving}
                      onClick={() => setDeleteCandidate(item)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-red-700 hover:bg-red-800 px-3 text-xs font-bold text-white transition-colors shadow-xs disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Xóa</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {!loading && filtered.length === 0 && (
            <div className="col-span-full py-16 text-center rounded-2xl bg-white border border-slate-200 p-8">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Chưa có hồ sơ phù hợp.</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-light">
                Không tìm thấy chuyên gia nào khớp với tiêu chí tìm kiếm hoặc bộ lọc hiện tại.
              </p>
              {hasPermission('website.staff.create') && (
                <button
                  onClick={beginCreate}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2D1B14] text-[#D4AF37] font-bold text-xs shadow hover:brightness-110"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo hồ sơ đội ngũ mới</span>
                </button>
              )}
            </div>
          )}
        </section>
      ) : (
        /* TABLE LIST VIEW */
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs xl:text-sm text-slate-800">
              <thead className="bg-slate-50/90 text-slate-700 uppercase tracking-wider text-[10px] xl:text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">Chuyên gia</th>
                  <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Vai trò / Chức danh</th>
                  <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Số liệu thực chiến</th>
                  <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Trạng thái</th>
                  <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Cấu hình</th>
                  <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-light">
                {filtered.map((item) => {
                  const media = item.draft.avatar_media_id
                    ? {
                        url: `/api/public/marketing-media/${encodeURIComponent(item.draft.avatar_media_id)}`,
                        alt_text: item.draft.avatar_alt_text || item.draft.full_name || 'Ảnh chân dung',
                      }
                    : undefined;
                  const statusConfig = STATUS_MAP[item.status] || {
                    label: item.status,
                    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
                    dotClass: 'bg-slate-400',
                  };
                  const typeConfig = PROFILE_TYPE_MAP[item.draft.profile_type] || {
                    label: item.draft.profile_type,
                    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                    icon: Award,
                  };

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Chuyên gia */}
                      <td className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">
                        <div className="flex items-center gap-2.5 xl:gap-3">
                          <div className="relative size-9 xl:size-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            {media ? (
                              <Image
                                src={media.url}
                                alt={media.alt_text}
                                fill
                                unoptimized
                                className="object-cover object-top"
                              />
                            ) : (
                              <div className="grid h-full place-items-center text-[10px] text-slate-400">
                                ẢNH
                              </div>
                            )}
                          </div>
                          <div>
                            <strong className="font-semibold text-slate-900 block text-xs xl:text-sm">
                              {item.draft.full_name}
                            </strong>
                            <span className="text-[10px] xl:text-xs text-slate-500 font-mono">
                              /doi-ngu/{item.draft.slug}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Vai trò */}
                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] xl:text-[11px] border mb-0.5 xl:mb-1 ${typeConfig.badgeClass}`}
                        >
                          {typeConfig.label}
                        </span>
                        <p className="text-[11px] xl:text-xs text-slate-600 font-medium">{item.draft.position}</p>
                      </td>

                      {/* Số liệu */}
                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4 text-[11px] xl:text-xs text-slate-600">
                        <div>
                          <strong>{item.draft.years_experience} năm KN</strong> &bull;{' '}
                          {item.draft.customers_served} khách
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          {item.draft.deals_completed} giao dịch &bull;{' '}
                          <span className="text-[#AA820A] font-semibold">
                            {item.draft.satisfaction_rate}% hài lòng
                          </span>
                        </div>
                      </td>

                      {/* Trạng thái */}
                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 xl:px-2.5 xl:py-1 rounded-full text-[11px] xl:text-xs font-semibold border ${statusConfig.badgeClass}`}
                        >
                          <span className={`size-1.5 rounded-full ${statusConfig.dotClass}`} />
                          <span>{statusConfig.label}</span>
                        </span>
                      </td>

                      {/* Cấu hình tags */}
                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4 text-xs">
                        <div className="flex flex-col gap-1">
                          {item.draft.show_on_home && (
                            <span className="text-[10px] text-amber-700 font-semibold">
                              ✓ Trang chủ
                            </span>
                          )}
                          {item.draft.is_featured && (
                            <span className="text-[10px] text-purple-700 font-semibold">
                              ★ Nổi bật
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            Thứ tự: {item.draft.display_order}
                          </span>
                        </div>
                      </td>

                      {/* Thao tác */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasPermission('website.staff.update') &&
                            item.status !== 'ARCHIVED' && (
                            <button
                              onClick={() => beginEdit(item)}
                              className="py-1 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
                            >
                              Sửa
                            </button>
                          )}
                          {isPublic(item) && (
                            <Link
                              href={`/doi-ngu/${item.draft.slug}`}
                              target="_blank"
                              className="py-1 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-[#AA820A] transition-colors"
                            >
                              Xem
                            </Link>
                          )}
                          {item.status === 'ARCHIVED' &&
                            hasPermission('website.staff.delete') && (
                            <button
                              onClick={() => setDeleteCandidate(item)}
                              className="py-1 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-xs font-medium text-red-700 border border-red-200 transition-colors"
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-slate-500">
                      Chưa có hồ sơ phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Delete Confirmation Modal (Accessible AlertDialog) */}
      {deleteCandidate && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="delete-staff-title"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-red-100 text-red-700">
              <Trash2 className="size-6" />
            </div>
            <h2 id="delete-staff-title" className="mt-4 text-center text-xl font-bold text-slate-900 font-serif">
              Xóa hồ sơ vĩnh viễn?
            </h2>
            <p className="mt-3 text-center text-sm leading-6 text-slate-600 font-light">
              Hồ sơ <strong>{deleteCandidate.draft.full_name}</strong> sẽ biến mất khỏi trang quản trị và website public. Thao tác này không thể khôi phục.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setDeleteCandidate(null)}
                className="min-h-11 rounded-xl border border-slate-200 font-bold text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void deleteProfile()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 hover:bg-red-800 px-4 font-bold text-sm text-white shadow transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                <span>Xác nhận xóa vĩnh viễn</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Comprehensive Staff Profile Editor Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-5"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={save}
            className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-[#f8f7f4] shadow-2xl border border-slate-200"
          >
            {/* Modal Header */}
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-slate-900">
                  {selected ? 'Chỉnh sửa hồ sơ' : 'Tạo hồ sơ đội ngũ'}
                </h2>
                <p className="text-xs text-slate-500 font-light mt-0.5">
                  Lưu bản nháp trước, sau đó xem trước và xuất bản.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-10 place-items-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                aria-label="Đóng"
              >
                <X className="size-5" />
              </button>
            </header>

            {/* Modal Navigation Step / Tab Bar */}
            <div className="bg-white border-b border-slate-200/80 px-6 py-2.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  '1. Giới thiệu',
                  '2. Năng lực',
                  '3. Dự án & số liệu',
                  '4. SEO & hiển thị',
                ].map((stepName, stepIndex) => (
                  <button
                    key={stepName}
                    type="button"
                    onClick={() => {
                      setPreview(false);
                      setActiveFormTab(stepIndex);
                      window.setTimeout(() => {
                        document
                          .getElementById(`staff-form-section-${stepIndex}`)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 0);
                    }}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all text-center cursor-pointer ${
                      !preview && activeFormTab === stepIndex
                        ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                    }`}
                  >
                    {stepName}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* LIVE PREVIEW MODE */}
              {preview ? (
                <div className="mx-auto max-w-3xl space-y-6">
                  {/* Hero Card Preview */}
                  <div className="grid overflow-hidden rounded-3xl bg-[#091B30] text-white shadow-xl md:grid-cols-[1fr_280px]">
                    <div className="p-8 space-y-4">
                      <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">
                        Xem trước hồ sơ
                      </span>
                      <h2 className="font-serif text-3xl font-bold">
                        {draft.full_name || 'Họ tên chuyên gia'}
                      </h2>
                      <p className="text-[#F3E5AB] font-medium">
                        {draft.headline || draft.position || 'Chức vụ'}
                      </p>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-white/75 font-light">
                        {draft.short_bio || 'Mô tả ngắn sẽ hiển thị tại đây.'}
                      </p>
                    </div>
                    <div className="relative min-h-80 bg-[#17130f]">
                      {chosenMedia ? (
                        <Image
                          src={chosenMedia.url}
                          alt={chosenMedia.alt_text}
                          fill
                          unoptimized
                          className="object-cover object-top"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-sm text-white/50">
                          Chưa chọn ảnh
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4 Stats Preview */}
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      [`${draft.years_experience}+`, 'Năm kinh nghiệm'],
                      [`${draft.customers_served}+`, 'Khách hàng'],
                      [`${draft.deals_completed}+`, 'Giao dịch'],
                      [`${draft.satisfaction_rate}%`, 'Hài lòng'],
                    ].map(([val, lbl]) => (
                      <div key={lbl} className="rounded-2xl border bg-white p-4 text-center">
                        <strong className="text-2xl text-[#B88A29] font-serif block">
                          {val}
                        </strong>
                        <p className="text-xs text-slate-500 mt-1">{lbl}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPreview(false)}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                  >
                    Quay lại chỉnh sửa
                  </button>
                </div>
              ) : (
                /* FORM EDITING MODE */
                <div className="grid gap-4 md:grid-cols-2">
                  {/* TAB 0: GIỚI THIỆU & THÔNG TIN CƠ BẢN */}
                  <div id="staff-form-section-0" className="scroll-mt-4 md:col-span-2">
                    <h3 className="text-xs font-bold uppercase tracking-[.2em] text-[#B88A29] mb-3">
                      01 — Thông tin giới thiệu
                    </h3>
                  </div>

                  <label>
                    <span className={labelClass}>Họ và tên *</span>
                    <input
                      required
                      value={draft.full_name}
                      onChange={(event) => update('full_name', event.target.value)}
                      className={fieldClass}
                      placeholder="Ví dụ: Nguyễn Văn An"
                    />
                  </label>

                  <div>
                    <span className={labelClass}>Đường dẫn hồ sơ</span>
                    <div className="flex min-h-11 items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-600 font-mono">
                      {selected ? `/doi-ngu/${draft.slug}` : 'Tự động tạo từ họ và tên khi lưu'}
                    </div>
                  </div>

                  <label>
                    <span className={labelClass}>Loại hồ sơ *</span>
                    <select
                      value={draft.profile_type}
                      onChange={(event) =>
                        update(
                          'profile_type',
                          event.target.value as PublicStaffDraft['profile_type'],
                        )
                      }
                      className={fieldClass}
                    >
                      <option value="LEADERSHIP">Lãnh đạo (Leadership)</option>
                      <option value="SPECIALIST">Chuyên gia (Specialist)</option>
                      <option value="BROKER">Nhà môi giới (Broker)</option>
                    </select>
                  </label>

                  <label>
                    <span className={labelClass}>Chức vụ *</span>
                    <input
                      required
                      value={draft.position}
                      onChange={(event) => update('position', event.target.value)}
                      className={fieldClass}
                      placeholder="Ví dụ: Giám Đốc Khối Văn Phòng Cho Thuê"
                    />
                  </label>

                  <label className="md:col-span-2">
                    <span className={labelClass}>Tiêu đề giới thiệu *</span>
                    <input
                      value={draft.headline}
                      onChange={(event) => update('headline', event.target.value)}
                      className={fieldClass}
                      placeholder="Ví dụ: 10 năm đồng hành cùng các tập đoàn đa quốc gia tại TP.HCM"
                    />
                  </label>

                  <label className="md:col-span-2">
                    <span className={labelClass}>Mô tả ngắn *</span>
                    <textarea
                      value={draft.short_bio}
                      onChange={(event) => update('short_bio', event.target.value)}
                      className={`${fieldClass} min-h-24`}
                      placeholder="Đoạn tóm tắt 2-3 câu về kinh nghiệm và thế mạnh tư vấn."
                    />
                  </label>

                  <label className="md:col-span-2">
                    <span className={labelClass}>Về tôi *</span>
                    <textarea
                      value={draft.about}
                      onChange={(event) => update('about', event.target.value)}
                      className={`${fieldClass} min-h-36`}
                      placeholder="Tiểu sử nghề nghiệp chi tiết, triết lý phục vụ khách hàng..."
                    />
                  </label>

                  <label className="md:col-span-2">
                    <span className={labelClass}>Câu nói / triết lý</span>
                    <textarea
                      value={draft.quote || ''}
                      onChange={(event) => update('quote', event.target.value)}
                      className={`${fieldClass} min-h-20`}
                      placeholder="Ví dụ: 'Tư vấn bất động sản là tư vấn tương lai và sự an tâm.'"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Điện thoại</span>
                    <input
                      value={draft.phone || ''}
                      onChange={(event) => update('phone', event.target.value)}
                      className={fieldClass}
                      placeholder="Ví dụ: 090 123 4567"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Email</span>
                    <input
                      type="email"
                      value={draft.email || ''}
                      onChange={(event) => update('email', event.target.value)}
                      className={fieldClass}
                      placeholder="chuyengia@maianhomes.vn"
                    />
                  </label>

                  <label className="md:col-span-2">
                    <span className={labelClass}>LinkedIn</span>
                    <input
                      type="url"
                      value={draft.linkedin_url || ''}
                      onChange={(event) => update('linkedin_url', event.target.value)}
                      className={fieldClass}
                      placeholder="https://linkedin.com/in/username"
                    />
                  </label>

                  {/* TAB 1: ẢNH CHÂN DUNG & NĂNG LỰC */}
                  <div id="staff-form-section-1" className="scroll-mt-4 mt-4 border-t border-slate-200 pt-6 md:col-span-2">
                    <h3 className="text-xs font-bold uppercase tracking-[.2em] text-[#B88A29] mb-3">
                      02 — Ảnh, chuyên môn và thành tích
                    </h3>
                  </div>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 md:col-span-2 shadow-xs">
                    <div className="grid gap-6 sm:grid-cols-[180px_1fr] sm:items-center">
                      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xs">
                        {chosenMedia ? (
                          <Image
                            src={chosenMedia.url}
                            alt={chosenMedia.alt_text || draft.full_name || 'Ảnh chân dung'}
                            fill
                            unoptimized
                            className="object-cover object-top"
                          />
                        ) : (
                          <div className="grid h-full place-items-center px-4 text-center text-xs text-slate-400 font-light">
                            Chưa tải ảnh
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-900 text-sm">Ảnh chân dung *</h4>
                        <p className="text-xs text-slate-500 font-light leading-relaxed">
                          Tải ảnh riêng cho hồ sơ chuyên gia này. Hỗ trợ JPEG, PNG, WebP hoặc AVIF; tối đa 20 MB.
                        </p>
                        <label className="block pt-1">
                          <span className={labelClass}>Mô tả ảnh *</span>
                          <input
                            value={draft.avatar_alt_text}
                            onChange={(event) => update('avatar_alt_text', event.target.value)}
                            className={fieldClass}
                            minLength={10}
                            maxLength={300}
                            placeholder="Ví dụ: Chân dung chuyên gia Nguyễn Văn An"
                          />
                          <span className="mt-1 block text-[11px] text-slate-400">
                            Dùng cho khả năng truy cập và SEO; nhập trước khi tải ảnh.
                          </span>
                        </label>
                        <div className="pt-2 flex flex-wrap items-center gap-2.5">
                          <label
                            className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2D1B14] px-5 text-sm font-bold text-[#D4AF37] hover:brightness-110 shadow-sm transition-all ${
                              uploadingAvatar ? 'cursor-wait opacity-60' : 'cursor-pointer'
                            }`}
                          >
                            {uploadingAvatar ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Plus className="size-4" />
                            )}
                            <span>
                              {uploadingAvatar
                                ? 'Đang tải ảnh…'
                                : chosenMedia
                                ? 'Thay ảnh chân dung'
                                : 'Tải ảnh chân dung'}
                            </span>
                            <input
                              aria-label="Tải ảnh chân dung"
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/avif"
                              disabled={uploadingAvatar}
                              onChange={(event) => void uploadAvatar(event)}
                              className="hidden"
                            />
                          </label>

                          {chosenMedia && (
                            <button
                              type="button"
                              onClick={() => update('avatar_media_id', null)}
                              className="min-h-11 rounded-xl border border-red-200 bg-white hover:bg-red-50 px-4 text-sm text-red-700 transition-colors"
                            >
                              Xóa ảnh khỏi hồ sơ
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 italic pt-1">
                          Nên dùng ảnh dọc tỷ lệ 4:5, khuôn mặt rõ ràng và nền trang nhã để hiển thị đúng thiết kế.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Specialties & Achievements Editors */}
                  <ContentItemsEditor
                    title="Chuyên môn"
                    required
                    value={draft.specialties}
                    onChange={(value) => update('specialties', value)}
                  />

                  <ContentItemsEditor
                    title="Thành tích"
                    value={draft.achievements}
                    onChange={(value) => update('achievements', value)}
                  />

                  {/* TAB 2: DỰ ÁN & SỐ LIỆU */}
                  <div id="staff-form-section-2" className="scroll-mt-4 mt-4 border-t border-slate-200 pt-6 md:col-span-2">
                    <h3 className="text-xs font-bold uppercase tracking-[.2em] text-[#B88A29] mb-3">
                      03 — Dự án và số liệu
                    </h3>
                  </div>

                  <label>
                    <span className={labelClass}>Năm kinh nghiệm *</span>
                    <input
                      type="number"
                      min="0"
                      max="80"
                      value={draft.years_experience}
                      onChange={(event) =>
                        update('years_experience', Number(event.target.value) || 0)
                      }
                      className={fieldClass}
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Khách hàng đã đồng hành</span>
                    <input
                      type="number"
                      min="0"
                      value={draft.customers_served}
                      onChange={(event) =>
                        update('customers_served', Number(event.target.value) || 0)
                      }
                      className={fieldClass}
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Giao dịch thành công</span>
                    <input
                      type="number"
                      min="0"
                      value={draft.deals_completed}
                      onChange={(event) =>
                        update('deals_completed', Number(event.target.value) || 0)
                      }
                      className={fieldClass}
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Tỷ lệ hài lòng (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={draft.satisfaction_rate}
                      onChange={(event) =>
                        update(
                          'satisfaction_rate',
                          Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                        )
                      }
                      className={fieldClass}
                    />
                  </label>

                  {/* Projects checklist with search */}
                  <section className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Dự án đã đồng hành
                          {draft.profile_type === 'BROKER' ? ' *' : ''}
                        </h4>
                        <p className="text-xs text-slate-500 font-light mt-0.5">
                          Chọn các dự án bất động sản chuyên gia đang trực tiếp phân phối hoặc tư vấn.
                        </p>
                      </div>
                      <input
                        value={projectSearch}
                        onChange={(event) => setProjectSearch(event.target.value)}
                        className={`${fieldClass} max-w-xs`}
                        placeholder="Tìm dự án..."
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-60 overflow-y-auto pr-1">
                      {visibleProjects.map((project) => (
                        <label
                          key={project.id}
                          className={`flex min-h-12 items-center gap-3 rounded-xl border p-3 text-xs cursor-pointer transition-colors ${
                            draft.project_ids.includes(project.id)
                              ? 'border-[#AA820A] bg-amber-50/60 font-semibold text-slate-900'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={draft.project_ids.includes(project.id)}
                            onChange={() =>
                              update(
                                'project_ids',
                                draft.project_ids.includes(project.id)
                                  ? draft.project_ids.filter((id) => id !== project.id)
                                  : [...draft.project_ids, project.id],
                              )
                            }
                            className="rounded text-[#AA820A] focus:ring-[#AA820A]"
                          />
                          <span className="truncate">
                            <strong className="block text-slate-900 font-medium truncate">
                              {project.name}
                            </strong>
                            <small className="text-slate-400 block truncate">
                              {project.location}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>

                    {visibleProjects.length === 0 && (
                      <p className="py-6 text-center text-xs text-slate-400 font-light">
                        Chưa có dự án công khai phù hợp.
                      </p>
                    )}
                  </section>

                  {/* TAB 3: SEO VÀ QUYỀN HIỂN THỊ */}
                  <div id="staff-form-section-3" className="scroll-mt-4 mt-4 border-t border-slate-200 pt-6 md:col-span-2">
                    <h3 className="text-xs font-bold uppercase tracking-[.2em] text-[#B88A29] mb-3">
                      04 — SEO và hiển thị
                    </h3>
                  </div>

                  <label className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={labelClass}>SEO title *</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {(draft.seo_title || '').length}/60
                      </span>
                    </div>
                    <input
                      required
                      maxLength={120}
                      value={draft.seo_title || ''}
                      onChange={(event) => update('seo_title', event.target.value)}
                      className={fieldClass}
                      placeholder="Tiêu đề chuẩn SEO (ví dụ: Chuyên Gia Nguyễn Văn An | Maian Homes)"
                    />
                  </label>

                  <label className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={labelClass}>SEO description *</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {(draft.seo_description || '').length}/160
                      </span>
                    </div>
                    <textarea
                      required
                      maxLength={320}
                      rows={3}
                      value={draft.seo_description || ''}
                      onChange={(event) => update('seo_description', event.target.value)}
                      className={`${fieldClass} min-h-24`}
                      placeholder="Mô tả tóm tắt cho công cụ tìm kiếm Google..."
                    />
                  </label>

                  {/* Display Permissions Fieldset */}
                  <fieldset className="md:col-span-2 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3 shadow-xs">
                    <legend className="px-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                      Quyền hiển thị & Thứ tự
                    </legend>
                    <label className="flex min-h-11 items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.show_on_home}
                        onChange={(event) => update('show_on_home', event.target.checked)}
                        className="rounded text-[#AA820A] focus:ring-[#AA820A]"
                      />
                      <span>Hiển thị trang chủ</span>
                    </label>
                    <label className="flex min-h-11 items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.is_featured}
                        onChange={(event) => update('is_featured', event.target.checked)}
                        className="rounded text-[#AA820A] focus:ring-[#AA820A]"
                      />
                      <span>Hồ sơ nổi bật</span>
                    </label>
                    <label className="flex min-h-11 items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.allow_detail_view}
                        onChange={(event) => update('allow_detail_view', event.target.checked)}
                        className="rounded text-[#AA820A] focus:ring-[#AA820A]"
                      />
                      <span>Cho mở trang chi tiết</span>
                    </label>
                    <label>
                      <span className={labelClass}>Thứ tự hiển thị</span>
                      <input
                        type="number"
                        min="0"
                        max="9999"
                        value={draft.display_order}
                        onChange={(event) =>
                          update('display_order', Number(event.target.value) || 0)
                        }
                        className={fieldClass}
                      />
                    </label>
                    <label className="flex min-h-11 items-center gap-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 px-4 text-xs font-semibold text-amber-900 sm:col-span-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.consent_confirmed}
                        onChange={(event) => update('consent_confirmed', event.target.checked)}
                        className="rounded text-[#AA820A] focus:ring-[#AA820A]"
                      />
                      <span>Đã có quyền công khai nội dung và hình ảnh.</span>
                    </label>
                  </fieldset>
                </div>
              )}
            </div>

            {/* Modal Sticky Footer */}
            <footer className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setPreview((value) => !value)}
                className="mr-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 hover:bg-slate-50 px-4 text-xs font-bold text-slate-700 transition-colors"
              >
                <Eye className="size-4 text-[#AA820A]" />
                <span>{preview ? 'Chỉnh sửa' : 'Xem trước'}</span>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-xl border border-slate-200 hover:bg-slate-50 px-5 text-xs font-medium text-slate-700 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || preview}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#2D1B14] to-[#1A100B] px-6 font-bold text-xs text-[#D4AF37] hover:brightness-110 shadow-md transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                <span>Lưu bản nháp</span>
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
