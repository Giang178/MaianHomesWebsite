'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Check,
  Edit3,
  Eye,
  Loader2,
  Plus,
  Send,
  X,
  Search,
  Users,
  CheckCircle2,
  FileText,
  Clock,
  MapPin,
  Building,
  Download,
  AlertCircle,
  Archive,
  RefreshCw,
  GraduationCap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import RichTextEditor from '@/features/content/articles/RichTextEditor';
import { recruitmentAdminApi, type JobApplication, type RecruitmentJob } from './api';

type JobDraft = RecruitmentJob['draft'];
type ContentField = 'description_html' | 'requirements_html' | 'benefits_html';
type ApiIssue = { field?: string; message?: string };

const emptyJob = (): JobDraft => ({
  title: '',
  slug: '',
  department: '',
  location: 'TP. Hồ Chí Minh',
  address_detail: '',
  employment_type: 'Full-time',
  quantity: 1,
  salary_range: '',
  short_description: '',
  description_html: '',
  requirements_html: '',
  benefits_html: '',
  seo_title: '',
  seo_description: '',
});

const fieldClass =
  'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#AA820A] focus:ring-2 focus:ring-[#AA820A]/15 disabled:bg-slate-50 disabled:text-slate-400';
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600';

const contentTabs: Array<{ key: ContentField; label: string; hint: string }> = [
  {
    key: 'description_html',
    label: 'Mô tả công việc',
    hint: 'Nhiệm vụ, vai trò và trách nhiệm hằng ngày của vị trí.',
  },
  {
    key: 'requirements_html',
    label: 'Yêu cầu ứng viên',
    hint: 'Kinh nghiệm, kỹ năng chuyên môn, thái độ và tiêu chuẩn cần có.',
  },
  {
    key: 'benefits_html',
    label: 'Quyền lợi và đãi ngộ',
    hint: 'Thu nhập, chế độ thưởng, lộ trình thăng tiến và môi trường làm việc.',
  },
];

const STATUS_MAP: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  PUBLISHED: {
    label: 'Đang tuyển',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500 animate-pulse',
  },
  DRAFT: {
    label: 'Bản nháp',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  CLOSED: {
    label: 'Đóng nhận',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
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

export default function RecruitmentAdminPage() {
  const { user } = useAuth();
  const permissions = useMemo(() => new Set(user?.permissions || []), [user?.permissions]);
  const can = (permission: string) => permissions.has('*') || permissions.has(permission);

  const [jobs, setJobs] = useState<RecruitmentJob[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [form, setForm] = useState<JobDraft>(emptyJob);
  const [selected, setSelected] = useState<RecruitmentJob | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);

  const [tab, setTab] = useState<'jobs' | 'applications'>('jobs');
  const [contentTab, setContentTab] = useState<ContentField>('description_html');
  const [editorOpen, setEditorOpen] = useState(false);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);

  // Filters
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('ALL');
  const [jobDeptFilter, setJobDeptFilter] = useState('ALL');
  const [appSearch, setAppSearch] = useState('');
  const [appJobFilter, setAppJobFilter] = useState('ALL');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [issues, setIssues] = useState<ApiIssue[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [jobResult, applicationResult] = await Promise.all([
        recruitmentAdminApi.list(),
        recruitmentAdminApi.applications(),
      ]);
      setJobs(jobResult.items || []);
      setApplications(applicationResult.items || []);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Không thể tải dữ liệu tuyển dụng.',
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
    setForm(emptyJob());
    setIssues([]);
    setContentTab('description_html');
    setEditorOpen(true);
  };

  const beginEdit = (job: RecruitmentJob) => {
    setSelected(job);
    setForm({ ...emptyJob(), ...job.draft });
    setIssues([]);
    setContentTab('description_html');
    setEditorOpen(true);
  };

  const update = <K extends keyof JobDraft>(key: K, value: JobDraft[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setIssues([]);
      if (selected) await recruitmentAdminApi.update(selected.id, form, selected.version);
      else await recruitmentAdminApi.create(form);
      setMessage({
        type: 'success',
        text: selected ? 'Đã cập nhật bản nháp tuyển dụng thành công.' : 'Đã tạo bản nháp tuyển dụng mới.',
      });
      setEditorOpen(false);
      await load();
    } catch (error) {
      const apiError = error as Error & { issues?: ApiIssue[] };
      setIssues(apiError.issues || []);
      setMessage({ type: 'error', text: apiError.message || 'Không thể lưu tin tuyển dụng.' });
    } finally {
      setSaving(false);
    }
  };

  const transition = async (job: RecruitmentJob, action: string) => {
    try {
      setSaving(true);
      setIssues([]);
      await recruitmentAdminApi.transition(job.id, action, job.version);
      const actionText =
        action === 'publish'
          ? 'Đã xuất bản tin tuyển dụng công khai.'
          : action === 'close'
          ? 'Đã đóng nhận hồ sơ cho vị trí này.'
          : action === 'archive'
          ? 'Đã chuyển tin tuyển dụng vào kho lưu trữ.'
          : 'Đã cập nhật trạng thái tin tuyển dụng.';
      setMessage({ type: 'success', text: actionText });
      await load();
    } catch (error) {
      const apiError = error as Error & { issues?: ApiIssue[] };
      setIssues(apiError.issues || []);
      setMessage({
        type: 'error',
        text: apiError.message || 'Không thể cập nhật trạng thái tin tuyển dụng.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Metrics
  const publishedCount = jobs.filter((job) => job.status === 'PUBLISHED').length;
  const draftCount = jobs.filter((job) => job.status === 'DRAFT').length;
  const closedCount = jobs.filter((job) => job.status === 'CLOSED').length;

  // Departments list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.draft.department) set.add(j.draft.department.trim());
    });
    return Array.from(set);
  }, [jobs]);

  // Unique jobs list for applications filter
  const jobSlugs = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((j) => {
      map.set(j.draft.slug, j.draft.title);
    });
    return map;
  }, [jobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchSearch =
        !jobSearch.trim() ||
        job.draft.title.toLowerCase().includes(jobSearch.toLowerCase()) ||
        job.draft.department?.toLowerCase().includes(jobSearch.toLowerCase()) ||
        job.draft.location?.toLowerCase().includes(jobSearch.toLowerCase());
      const matchStatus = jobStatusFilter === 'ALL' || job.status === jobStatusFilter;
      const matchDept = jobDeptFilter === 'ALL' || job.draft.department === jobDeptFilter;
      return matchSearch && matchStatus && matchDept;
    });
  }, [jobs, jobSearch, jobStatusFilter, jobDeptFilter]);

  // Filtered applications
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const matchSearch =
        !appSearch.trim() ||
        app.full_name.toLowerCase().includes(appSearch.toLowerCase()) ||
        app.phone.includes(appSearch) ||
        (app.email && app.email.toLowerCase().includes(appSearch.toLowerCase())) ||
        app.job_slug.toLowerCase().includes(appSearch.toLowerCase());
      const matchJob = appJobFilter === 'ALL' || app.job_slug === appJobFilter;
      return matchSearch && matchJob;
    });
  }, [applications, appSearch, appJobFilter]);

  const activeContent = contentTabs.find((item) => item.key === contentTab) || contentTabs[0];

  return (
    <div className="admin-module-page admin-module-page--recruitment min-h-screen bg-slate-50/60 p-4 sm:p-6 lg:p-7 text-slate-800 space-y-4 sm:space-y-5">
      {/* 1. Header & Quick Action */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#AA820A]/10 text-[#AA820A] uppercase tracking-wider">
              Tuyển dụng website
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500">Website Career Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 tracking-tight">
            Quản Lý Tuyển Dụng & Ứng Viên
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-2xl font-light">
            Soạn thảo, quản lý bài đăng tuyển dụng chuẩn SEO và theo dõi danh sách hồ sơ ứng viên gửi về website Maian Homes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {can('website.recruitment.create') && (
            <button
              onClick={beginCreate}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#2D1B14] to-[#1A100B] px-5 font-bold text-[#D4AF37] hover:brightness-110 shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="size-4" />
              <span>Tạo tin tuyển dụng</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Statistical Metric Cards (Compact & Space-Optimized) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Tổng tin */}
        <div
          onClick={() => {
            setTab('jobs');
            setJobStatusFilter('ALL');
          }}
          className={`rounded-xl border p-3 sm:px-4 sm:py-3 shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 ${
            tab === 'jobs' && jobStatusFilter === 'ALL'
              ? 'border-[#AA820A] bg-amber-50/20 ring-1 ring-[#AA820A]/30'
              : 'border-slate-200/80 bg-white hover:border-[#AA820A]/40'
          }`}
        >
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block truncate">
              Tổng tin tuyển
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <strong className="text-xl sm:text-2xl font-bold font-serif text-slate-900 leading-none">
                {jobs.length}
              </strong>
              <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                Tất cả vị trí trong hệ thống
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-[#AA820A]/10 group-hover:text-[#AA820A] flex items-center justify-center shrink-0 transition-colors">
            <BriefcaseBusiness className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Đang tuyển */}
        <div
          onClick={() => {
            setTab('jobs');
            setJobStatusFilter('PUBLISHED');
          }}
          className={`rounded-xl border p-3 sm:px-4 sm:py-3 shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 ${
            tab === 'jobs' && jobStatusFilter === 'PUBLISHED'
              ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500/30'
              : 'border-emerald-200/70 bg-emerald-50/20 hover:border-emerald-400'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block truncate">
                Đang tuyển công khai
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <strong className="text-xl sm:text-2xl font-bold font-serif text-emerald-800 leading-none">
                {publishedCount}
              </strong>
              <span className="text-[10px] text-emerald-600/80 truncate hidden sm:inline">
                Hiển thị trực tiếp trên website
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 transition-colors">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Bản nháp */}
        <div
          onClick={() => {
            setTab('jobs');
            setJobStatusFilter('DRAFT');
          }}
          className={`rounded-xl border p-3 sm:px-4 sm:py-3 shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 ${
            tab === 'jobs' && jobStatusFilter === 'DRAFT'
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
                {draftCount}
              </strong>
              <span className="text-[10px] text-amber-600/80 truncate hidden sm:inline">
                Đang biên soạn hoặc chỉnh sửa
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 transition-colors">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Ứng viên */}
        <div
          onClick={() => setTab('applications')}
          className={`rounded-xl border p-3 sm:px-4 sm:py-3 shadow-xs transition-all cursor-pointer group flex items-center justify-between gap-3 ${
            tab === 'applications'
              ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/30'
              : 'border-blue-200/70 bg-blue-50/20 hover:border-blue-400'
          }`}
        >
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block truncate">
              Hồ sơ ứng viên
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <strong className="text-xl sm:text-2xl font-bold font-serif text-blue-800 leading-none">
                {applications.length}
              </strong>
              <span className="text-[10px] text-blue-600/80 truncate hidden sm:inline">
                Đã nộp trực tuyến qua form CV
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 transition-colors">
            <Users className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Messages & Publication Issues Alerts */}
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
            <span>Cần bổ sung các mục sau trước khi xuất bản tin tuyển dụng:</span>
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

      {/* 4. Tab Navigation & Interactive Filter Bar */}
      <div className="space-y-4">
        {/* Main Tab Pill Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('jobs')}
              className={`rounded-xl px-5 py-2.5 font-bold text-sm transition-all flex items-center gap-2 cursor-pointer ${
                tab === 'jobs'
                  ? 'bg-[#2D1B14] text-[#D4AF37] shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <BriefcaseBusiness className="w-4 h-4" />
              <span>Tin tuyển dụng</span>
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  tab === 'jobs' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {jobs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTab('applications')}
              className={`rounded-xl px-5 py-2.5 font-bold text-sm transition-all flex items-center gap-2 cursor-pointer ${
                tab === 'applications'
                  ? 'bg-[#2D1B14] text-[#D4AF37] shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Hồ sơ ứng viên</span>
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  tab === 'applications'
                    ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {applications.length}
              </span>
            </button>
          </div>

          {/* Sub-info / Status ticker */}
          <div className="text-xs text-slate-500 font-light flex items-center gap-3">
            <span>Đang tuyển: <strong className="text-emerald-700">{publishedCount}</strong></span>
            <span>•</span>
            <span>Bản nháp: <strong className="text-amber-700">{draftCount}</strong></span>
            <span>•</span>
            <span>Đã đóng: <strong className="text-rose-700">{closedCount}</strong></span>
          </div>
        </div>

        {/* Filter bar for Jobs Tab */}
        {tab === 'jobs' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm theo tên vị trí, phòng ban..."
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:border-[#AA820A] focus:ring-2 focus:ring-[#AA820A]/15"
              />
              {jobSearch && (
                <button
                  type="button"
                  onClick={() => setJobSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Department Dropdown */}
              <select
                value={jobDeptFilter}
                onChange={(e) => setJobDeptFilter(e.target.value)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white outline-none focus:border-[#AA820A]"
              >
                <option value="ALL">Tất cả phòng ban</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Status Dropdown */}
              <select
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white outline-none focus:border-[#AA820A]"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="PUBLISHED">Đang tuyển (Published)</option>
                <option value="DRAFT">Bản nháp (Draft)</option>
                <option value="CLOSED">Đã đóng nhận hồ sơ</option>
                <option value="ARCHIVED">Lưu trữ</option>
              </select>

              {(jobSearch || jobStatusFilter !== 'ALL' || jobDeptFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setJobSearch('');
                    setJobStatusFilter('ALL');
                    setJobDeptFilter('ALL');
                  }}
                  className="py-2 px-3 text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Đặt lại
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter bar for Applications Tab */}
        {tab === 'applications' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm ứng viên, SĐT, Email..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm outline-none focus:border-[#AA820A] focus:ring-2 focus:ring-[#AA820A]/15"
              />
              {appSearch && (
                <button
                  type="button"
                  onClick={() => setAppSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={appJobFilter}
                onChange={(e) => setAppJobFilter(e.target.value)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white outline-none focus:border-[#AA820A]"
              >
                <option value="ALL">Tất cả vị trí ứng tuyển</option>
                {Array.from(jobSlugs.entries()).map(([slug, title]) => (
                  <option key={slug} value={slug}>
                    {title}
                  </option>
                ))}
              </select>

              {(appSearch || appJobFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setAppSearch('');
                    setAppJobFilter('ALL');
                  }}
                  className="py-2 px-3 text-xs text-slate-500 hover:text-slate-800 underline"
                >
                  Đặt lại
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Main Content: Jobs List OR Applications Table */}
      {tab === 'jobs' ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((job) => {
            const statusConfig = STATUS_MAP[job.status] || {
              label: job.status,
              badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
              dotClass: 'bg-slate-400',
            };

            return (
              <article
                key={job.id}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Top: Icon + Status Pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-[#2D1B14] to-[#1A100B] text-[#D4AF37] shadow-sm">
                      <BriefcaseBusiness className="size-5" />
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusConfig.badgeClass}`}
                    >
                      <span className={`size-2 rounded-full ${statusConfig.dotClass}`} />
                      <span>{statusConfig.label}</span>
                    </span>
                  </div>

                  {/* Title & Department */}
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 group-hover:text-[#AA820A] transition-colors leading-snug">
                      {job.draft.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1 text-slate-600">
                        <Building className="w-3.5 h-3.5 text-[#AA820A]" />
                        {job.draft.department || 'Chưa phân ban'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-[#AA820A]" />
                        {job.draft.location || 'TP.HCM'}
                      </span>
                    </div>
                  </div>

                  {/* Highlights Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                        Hình thức
                      </span>
                      <span className="font-semibold text-slate-800">
                        {job.draft.employment_type || 'Full-time'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                        Chỉ tiêu
                      </span>
                      <span className="font-semibold text-slate-800">
                        {job.draft.quantity || 1} nhân sự
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/50">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                        Mức lương
                      </span>
                      <span className="font-semibold text-[#AA820A]">
                        {job.draft.salary_range || 'Thỏa thuận theo năng lực'}
                      </span>
                    </div>
                  </div>

                  {/* Short Description */}
                  {job.draft.short_description && (
                    <p className="text-xs text-slate-600 leading-relaxed font-light line-clamp-2">
                      {job.draft.short_description}
                    </p>
                  )}

                  {/* Slug & Version indicator */}
                  <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1">
                    <span className="truncate max-w-[200px]">/tuyen-dung/{job.draft.slug}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-sans font-semibold text-[10px]">
                      v{job.version}
                    </span>
                  </div>
                </div>

                {/* Bottom Action Toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 bg-slate-50/80 p-3">
                  {can('website.recruitment.update') && (
                    <button
                      onClick={() => beginEdit(job)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                    >
                      <Edit3 className="size-3.5" />
                      <span>Chỉnh sửa</span>
                    </button>
                  )}

                  {job.status === 'PUBLISHED' && (
                    <Link
                      href={`/tuyen-dung/${job.draft.slug}`}
                      target="_blank"
                      aria-label={`Xem tin tuyển dụng ${job.draft.title || job.draft.slug} ngoài website`}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                    >
                      <Eye className="size-3.5 text-[#AA820A]" />
                      <span>Xem public</span>
                    </Link>
                  )}

                  {['DRAFT', 'UNPUBLISHED', 'CLOSED'].includes(job.status) &&
                    can('website.recruitment.publish') && (
                      <button
                        disabled={saving}
                        onClick={() => void transition(job, 'publish')}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 text-xs font-bold text-white transition-colors shadow-xs disabled:opacity-50"
                      >
                        <Check className="size-3.5" />
                        <span>Xuất bản</span>
                      </button>
                    )}

                  {job.status === 'PUBLISHED' && can('website.recruitment.publish') && (
                    <button
                      disabled={saving}
                      onClick={() => void transition(job, 'close')}
                      className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs disabled:opacity-50"
                    >
                      Đóng nhận hồ sơ
                    </button>
                  )}

                  {job.status !== 'ARCHIVED' && can('website.recruitment.archive') && (
                    <button
                      disabled={saving}
                      onClick={() => void transition(job, 'archive')}
                      className="min-h-9 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors shadow-xs ml-auto disabled:opacity-50"
                      title="Lưu trữ tin này"
                    >
                      <Archive className="size-3.5 inline mr-1" />
                      Lưu trữ
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {!loading && filteredJobs.length === 0 && (
            <div className="col-span-full py-16 text-center rounded-2xl bg-white border border-slate-200 p-8">
              <BriefcaseBusiness className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">Không tìm thấy tin tuyển dụng nào</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-light">
                Không có tin nào khớp với tiêu chí tìm kiếm hoặc bộ lọc hiện tại. Thử thay đổi từ khóa hoặc tạo tin tuyển dụng mới.
              </p>
              {can('website.recruitment.create') && (
                <button
                  onClick={beginCreate}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2D1B14] text-[#D4AF37] font-bold text-xs shadow hover:brightness-110"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo tin tuyển dụng mới</span>
                </button>
              )}
            </div>
          )}
        </section>
      ) : (
        /* Applications Table Section */
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs xl:text-sm text-slate-800">
              <thead className="bg-slate-50/90 text-slate-700 uppercase tracking-wider text-[10px] xl:text-[11px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">Ứng viên</th>
                  <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Vị trí ứng tuyển</th>
                  <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Thông tin bổ sung</th>
                  <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Thời gian nộp</th>
                  <th className="py-2.5 px-3 xl:py-3.5 xl:px-4">Tài liệu CV</th>
                  <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-light">
                {filteredApplications.map((application) => {
                  const jobTitle = jobSlugs.get(application.job_slug) || application.job_slug;

                  return (
                    <tr
                      key={application.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Ứng viên */}
                      <td className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">
                        <div className="flex items-center gap-2.5 xl:gap-3">
                          <div className="size-8 xl:size-9 rounded-full bg-gradient-to-br from-[#2D1B14] to-[#45281D] text-[#D4AF37] font-bold flex items-center justify-center text-[11px] xl:text-xs shrink-0 shadow-xs">
                            {application.full_name
                              ? application.full_name.charAt(0).toUpperCase()
                              : 'U'}
                          </div>
                          <div>
                            <strong className="font-semibold text-slate-900 block text-xs xl:text-sm">
                              {application.full_name}
                            </strong>
                            <div className="text-[11px] xl:text-xs text-slate-600 mt-0.5 flex items-center gap-1.5 xl:gap-2">
                              <a
                                href={`tel:${application.phone}`}
                                className="hover:text-[#AA820A] font-medium"
                              >
                                {application.phone}
                              </a>
                              {application.email && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="text-slate-500">{application.email}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vị trí */}
                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4 font-medium text-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs xl:text-sm">{jobTitle}</span>
                        </div>
                        <span className="text-[10px] xl:text-[11px] text-slate-400 font-mono block">
                          /{application.job_slug}
                        </span>
                      </td>

                      {/* Thông tin bổ sung */}
                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4 text-[11px] xl:text-xs text-slate-600">
                        {application.education || application.school ? (
                          <div>
                            <span className="font-medium text-slate-800">
                              {application.education || 'Học vấn'}
                            </span>
                            {application.school && (
                              <span className="text-slate-500 block truncate max-w-[180px]">
                                {application.school}
                              </span>
                            )}
                          </div>
                        ) : application.birth_year ? (
                          <span>Sinh năm: {application.birth_year}</span>
                        ) : (
                          <span className="text-slate-400 italic">Cơ bản</span>
                        )}
                      </td>

                      {/* Thời gian */}
                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4 text-[11px] xl:text-xs text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(application.submitted_at).toLocaleString('vi-VN')}</span>
                        </div>
                      </td>

                      {/* CV */}
                      <td className="py-2.5 px-3 xl:py-3.5 xl:px-4">
                        {application.resume_filename ? (
                          <a
                            href={`/api/protected/website/applications/${application.id}/resume`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
                            title={application.resume_filename}
                          >
                            <Download className="w-3.5 h-3.5 text-[#AA820A]" />
                            <span>Tải CV</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Không có</span>
                        )}
                      </td>

                      {/* Chi tiết button */}
                      <td className="py-4 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedApplication(application);
                            setCandidateModalOpen(true);
                          }}
                          className="py-1.5 px-3 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                        >
                          Xem hồ sơ
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {!loading && filteredApplications.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-slate-500">
                      Chưa có hồ sơ ứng viên nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Job Editor Modal (Creating or Editing) */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-5"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={save}
            className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-[#f8f7f4] shadow-2xl border border-slate-200"
          >
            {/* Modal Header */}
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-bold font-serif text-slate-900">
                  {selected ? 'Chỉnh sửa tin tuyển dụng' : 'Tạo tin tuyển dụng'}
                </h2>
                <p className="text-xs text-slate-500 font-light mt-0.5">
                  Slug được tạo tự động; tin chỉ xuất hiện public sau khi xuất bản.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="grid size-10 place-items-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                aria-label="Đóng"
              >
                <X className="size-5" />
              </button>
            </header>

            {/* Modal Body */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Group 1: General Job Info */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#AA820A] flex items-center gap-1.5">
                  <BriefcaseBusiness className="w-4 h-4" />
                  <span>Thông Tin Vị Trí Tuyển Dụng</span>
                </h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="md:col-span-2">
                    <span className={labelClass}>Tên vị trí *</span>
                    <input
                      required
                      value={form.title}
                      onChange={(event) => update('title', event.target.value)}
                      className={fieldClass}
                      placeholder="Ví dụ: Chuyên Viên Tư Vấn Bất Động Sản Cao Cấp"
                    />
                  </label>

                  <div>
                    <span className={labelClass}>Đường dẫn bài viết</span>
                    <div className="flex min-h-11 items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-600 font-mono">
                      {selected ? `/tuyen-dung/${form.slug}` : 'Tự động tạo từ tên vị trí khi lưu'}
                    </div>
                  </div>

                  <label>
                    <span className={labelClass}>Phòng ban *</span>
                    <input
                      required
                      value={form.department}
                      onChange={(event) => update('department', event.target.value)}
                      className={fieldClass}
                      placeholder="Ví dụ: Kinh doanh / Marketing"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Khu vực làm việc *</span>
                    <input
                      required
                      value={form.location}
                      onChange={(event) => update('location', event.target.value)}
                      className={fieldClass}
                      placeholder="Ví dụ: TP. Hồ Chí Minh"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Địa chỉ chi tiết</span>
                    <input
                      value={form.address_detail || ''}
                      onChange={(event) => update('address_detail', event.target.value)}
                      className={fieldClass}
                      placeholder="Ví dụ: 606/62 đường 3 Tháng 2, Phường Diên Hồng"
                    />
                  </label>

                  <label>
                    <span className={labelClass}>Hình thức làm việc *</span>
                    <select
                      value={form.employment_type}
                      onChange={(event) => update('employment_type', event.target.value)}
                      className={fieldClass}
                    >
                      <option value="Full-time">Toàn thời gian (Full-time)</option>
                      <option value="Part-time">Bán thời gian (Part-time)</option>
                      <option value="Contract">Hợp đồng (Contract)</option>
                      <option value="Internship">Thực tập (Internship)</option>
                    </select>
                  </label>

                  <label>
                    <span className={labelClass}>Chỉ tiêu tuyển *</span>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={form.quantity}
                      onChange={(event) =>
                        update('quantity', Math.max(1, Number(event.target.value) || 1))
                      }
                      className={fieldClass}
                    />
                  </label>

                  <label className="md:col-span-2">
                    <span className={labelClass}>Mức lương / đãi ngộ</span>
                    <input
                      value={form.salary_range || ''}
                      onChange={(event) => update('salary_range', event.target.value)}
                      className={fieldClass}
                      placeholder="Ví dụ: 15–25 triệu + hoa hồng theo dự án"
                    />
                  </label>

                  <label className="md:col-span-2">
                    <span className={labelClass}>Mô tả ngắn trên danh sách *</span>
                    <textarea
                      required
                      maxLength={1000}
                      rows={3}
                      value={form.short_description || ''}
                      onChange={(event) => update('short_description', event.target.value)}
                      className={fieldClass}
                      placeholder="Tóm tắt ngắn 1-2 câu về vị trí tuyển dụng để hiển thị trên danh sách."
                    />
                  </label>
                </div>
              </div>

              {/* Group 2: Detailed Content Tabs */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                  <div className="flex flex-wrap gap-2">
                    {contentTabs.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setContentTab(item.key)}
                        className={`min-h-10 rounded-xl px-4 text-xs font-bold transition-all cursor-pointer ${
                          contentTab === item.key
                            ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
                            : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-slate-500 font-light italic">
                    {activeContent.hint}
                  </p>
                </div>

                <RichTextEditor
                  value={form[contentTab]}
                  onChange={(value) => update(contentTab, value)}
                />
              </section>

              {/* Group 3: SEO Configuration */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-[.2em] text-[#B88A29]">
                    SEO bài tuyển dụng
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Tối ưu hiển thị trên Google & Mạng xã hội
                  </span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={labelClass}>SEO Title</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {(form.seo_title || '').length}/60
                      </span>
                    </div>
                    <input
                      maxLength={120}
                      value={form.seo_title || ''}
                      onChange={(event) => update('seo_title', event.target.value)}
                      className={fieldClass}
                      placeholder="Tiêu đề chuẩn SEO xuất hiện trên thanh tìm kiếm Google"
                    />
                  </label>

                  <label className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={labelClass}>SEO Description</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {(form.seo_description || '').length}/160
                      </span>
                    </div>
                    <textarea
                      maxLength={320}
                      rows={3}
                      value={form.seo_description || ''}
                      onChange={(event) => update('seo_description', event.target.value)}
                      className={fieldClass}
                      placeholder="Mô tả tóm tắt ngắn cho công cụ tìm kiếm"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <footer className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#2D1B14] to-[#1A100B] px-6 font-bold text-[#D4AF37] hover:brightness-110 shadow-md transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                <span>Lưu bản nháp</span>
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* 7. Candidate Profile Detail Modal / Drawer */}
      {candidateModalOpen && selectedApplication && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-[#2D1B14] text-[#D4AF37] font-bold flex items-center justify-center text-sm">
                  {selectedApplication.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedApplication.full_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ứng tuyển vị trí: {jobSlugs.get(selectedApplication.job_slug) || selectedApplication.job_slug}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCandidateModalOpen(false)}
                className="grid size-9 place-items-center rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="p-6 space-y-4 overflow-y-auto text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase font-semibold">
                    Số điện thoại
                  </span>
                  <a
                    href={`tel:${selectedApplication.phone}`}
                    className="font-bold text-slate-900 hover:text-[#AA820A]"
                  >
                    {selectedApplication.phone}
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase font-semibold">
                    Email liên hệ
                  </span>
                  <span className="font-medium text-slate-800">
                    {selectedApplication.email || 'Chưa cung cấp'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase font-semibold">
                    Năm sinh
                  </span>
                  <span className="font-medium text-slate-800">
                    {selectedApplication.birth_year || 'Đang cập nhật'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase font-semibold">
                    Thời gian nộp
                  </span>
                  <span className="font-medium text-slate-800">
                    {new Date(selectedApplication.submitted_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>

              {/* Education & School */}
              {(selectedApplication.education || selectedApplication.school) && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                  <span className="text-slate-400 block text-[11px] uppercase font-semibold flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-[#AA820A]" />
                    <span>Học Vấn & Đào Tạo</span>
                  </span>
                  <p className="font-medium text-slate-900">
                    {selectedApplication.education || 'Đại học / Cao đẳng'}
                  </p>
                  {selectedApplication.school && (
                    <p className="text-xs text-slate-600">Trường: {selectedApplication.school}</p>
                  )}
                </div>
              )}

              {/* Address */}
              {selectedApplication.address && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-slate-400 block text-[11px] uppercase font-semibold flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#AA820A]" />
                    <span>Địa Chỉ Cư Trú</span>
                  </span>
                  <p className="text-slate-800">{selectedApplication.address}</p>
                </div>
              )}

              {/* Attached Resume */}
              <div className="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate max-w-[240px]">
                      {selectedApplication.resume_filename || 'Hồ sơ đính kèm (CV)'}
                    </span>
                    <span className="text-[11px] text-slate-500">Tài liệu ứng tuyển</span>
                  </div>
                </div>

                {selectedApplication.resume_filename ? (
                  <a
                    href={`/api/protected/website/applications/${selectedApplication.id}/resume`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#2D1B14] hover:bg-black text-[#D4AF37] transition-all shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải về</span>
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 italic">Không có file đính kèm</span>
                )}
              </div>
            </div>

            <footer className="border-t border-slate-100 bg-slate-50/70 px-6 py-3.5 flex justify-end">
              <button
                type="button"
                onClick={() => setCandidateModalOpen(false)}
                className="py-2 px-5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
