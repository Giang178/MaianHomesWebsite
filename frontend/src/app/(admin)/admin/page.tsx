'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe2,
  Inbox,
  Layers,
  RefreshCw,
  Search,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { websiteAdminApi, type DashboardOverview } from '@/features/website/admin/api';

const STATUS_LABEL: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  PUBLISHED: {
    label: 'Đã xuất bản',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
  DRAFT: {
    label: 'Bản nháp',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    border: 'border-amber-200',
  },
  IN_REVIEW: {
    label: 'Chờ duyệt',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    border: 'border-blue-200',
  },
  UNPUBLISHED: {
    label: 'Đã gỡ',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    border: 'border-rose-200',
  },
  ARCHIVED: {
    label: 'Lưu trữ',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    border: 'border-slate-200',
  },
};

const PAGE_LABEL: Record<string, { title: string; path: string; icon: typeof FileText; desc: string }> = {
  home: { title: 'Trang chủ', path: '/', icon: Globe2, desc: 'Trang bìa tiếp đón và giới thiệu hệ sinh thái' },
  about: { title: 'Giới thiệu thương hiệu', path: '/gioi-thieu', icon: Building2, desc: 'Câu chuyện thương hiệu, tầm nhìn và giá trị cốt lõi' },
  contact: { title: 'Liên hệ', path: '/lien-he', icon: Inbox, desc: 'Biểu mẫu tư vấn, hotline và định vị văn phòng' },
  consignment: { title: 'Ký gửi bất động sản', path: '/ky-gui', icon: FileCheck2, desc: 'Cổng tiếp nhận ký gửi bất động sản cao cấp' },
  projects_index: { title: 'Danh mục dự án', path: '/du_an', icon: Building2, desc: 'Danh sách căn hộ, biệt thự và dự án mở bán' },
  news_index: { title: 'Tin tức & Thị trường', path: '/tin_tuc', icon: BookOpen, desc: 'Báo cáo phân tích chuyên sâu và cẩm nang thị trường' },
  team_index: { title: 'Đội ngũ chuyên gia', path: '/doi-ngu', icon: Users, desc: 'Hồ sơ chuyên viên tư vấn và ban lãnh đạo công khai' },
  recruitment_index: { title: 'Cổng tuyển dụng', path: '/tuyen-dung', icon: Layers, desc: 'Cơ hội nghề nghiệp và chính sách đãi ngộ' },
  privacy: { title: 'Chính sách bảo mật', path: '/chinh-sach-bao-mat', icon: ShieldCheck, desc: 'Quy định bảo mật thông tin và điều khoản sử dụng' },
  sitemap: { title: 'Sơ đồ website', path: '/so-do-trang-web', icon: Globe2, desc: 'Điều hướng liên kết chuẩn SEO và cấu trúc trang web' },
};

export default function UnifiedAdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Page inventory filters
  const [pageFilter, setPageFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT'>('ALL');
  const [pageSearch, setPageSearch] = useState('');

  const fetchOverview = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await websiteAdminApi.dashboard.overview();
      setData(res);
      setError('');
      setLastUpdated(
        new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể tải tổng quan website.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  const totalPages = data?.pages.total || 10;
  const publishedPages = data?.pages.by_status?.PUBLISHED || 0;
  const draftPages = data?.pages.by_status?.DRAFT || 0;
  const seoReadyPages = data?.pages.seo_completed ?? publishedPages;
  const geoReadyPages = data?.pages.geo_completed ?? 0;
  const totalLeads = data?.leads?.total || 0;
  const newLeads = data?.leads?.new || 0;
  const totalProjects = data?.projects?.total || 0;
  const publishedProjects = data?.projects?.published || 0;

  // Workspaces Hub definition
  const permissions = user?.permissions || [];
  const allWorkspaces = useMemo(
    () => [
      {
        title: 'Nội dung trang (CMS & SEO)',
        desc: 'Biên tập 10 trang cốt lõi, chuẩn hóa SEO Google, thẻ GEO AI và kiểm duyệt xuất bản.',
        href: '/admin/content',
        icon: FileText,
        badge: `${publishedPages}/${totalPages} Live`,
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        accentColor: 'group-hover:border-red-600',
        iconColor: 'bg-red-50 text-red-700',
        permission: 'website.pages.read',
      },
      {
        title: 'Dự án Bất động sản',
        desc: 'Quản lý căn hộ, biệt thự cao cấp, mặt bằng, tiện ích và tài liệu bán hàng.',
        href: '/admin/projects',
        icon: Building2,
        badge: `${publishedProjects} Đang mở bán`,
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
        accentColor: 'group-hover:border-blue-600',
        iconColor: 'bg-blue-50 text-blue-700',
        permission: 'website.projects.read',
      },
      {
        title: 'Không gian Coworking',
        desc: 'Bảng giá chỗ ngồi, văn phòng trọn gói, phòng họp và form nhận tư vấn trực tuyến.',
        href: '/admin/workspaces',
        icon: Layers,
        badge: 'Dịch vụ thuê',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
        accentColor: 'group-hover:border-amber-600',
        iconColor: 'bg-amber-50 text-amber-700',
        permission: 'website.workspaces.read',
      },
      {
        title: 'Tin tức & Thị trường',
        desc: 'Bài viết phân tích chuyên sâu, xu hướng đầu tư, phong thủy và cẩm nang bất động sản.',
        href: '/admin/articles',
        icon: BookOpen,
        badge: `${data?.articles?.published ?? 0} Đã đăng`,
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
        accentColor: 'group-hover:border-purple-600',
        iconColor: 'bg-purple-50 text-purple-700',
        permission: 'website.articles.read',
      },
      {
        title: 'Đội ngũ Chuyên gia',
        desc: 'Hồ sơ công khai chuyên viên môi giới và lãnh đạo doanh nghiệp trên website.',
        href: '/admin/team',
        icon: Users,
        badge: 'Hồ sơ công khai',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        accentColor: 'group-hover:border-rose-600',
        iconColor: 'bg-rose-50 text-rose-700',
        permission: 'website.staff.read',
      },
      {
        title: 'Khách hàng (Leads)',
        desc: 'Tiếp nhận, phân loại và xử lý yêu cầu tư vấn, ký gửi bất động sản từ khách hàng.',
        href: '/admin/leads',
        icon: Inbox,
        badge: newLeads > 0 ? `${newLeads} Yêu cầu mới` : `${totalLeads} Tổng`,
        badgeColor: newLeads > 0 ? 'bg-red-500 text-white font-bold animate-pulse' : 'bg-slate-100 text-slate-700 border-slate-200',
        accentColor: 'group-hover:border-red-600',
        iconColor: 'bg-red-50 text-red-700',
        permission: 'website.leads.read',
      },
      {
        title: 'Thống kê & Chuyển đổi',
        desc: 'Biểu đồ hiệu suất form tư vấn, nguồn tiếp thị UTM và lưu lượng truy cập đa kênh.',
        href: '/admin/analytics',
        icon: BarChart3,
        badge: 'Báo cáo phễu',
        badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
        accentColor: 'group-hover:border-teal-600',
        iconColor: 'bg-teal-50 text-teal-700',
        permission: 'website.analytics.read',
      },
      {
        title: 'Kho Tri thức AI & Doanh nghiệp',
        desc: 'Nguồn dữ liệu thông tin chuẩn hóa phục vụ huấn luyện trợ lý AI và hỏi đáp khách hàng.',
        href: '/admin/content/company',
        icon: Sparkles,
        badge: 'Kiến thức AI',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        accentColor: 'group-hover:border-indigo-600',
        iconColor: 'bg-indigo-50 text-indigo-700',
        permission: 'website.pages.read',
      },
      {
        title: 'Cổng Tuyển dụng',
        desc: 'Quản lý tin tuyển dụng nhân sự bất động sản, cơ hội nghề nghiệp và ứng viên.',
        href: '/admin/recruitment',
        icon: Layers,
        badge: 'Nhân sự',
        badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
        accentColor: 'group-hover:border-sky-600',
        iconColor: 'bg-sky-50 text-sky-700',
        permission: 'website.recruitment.read',
      },
      {
        title: 'Thương hiệu & Cấu hình',
        desc: 'Quản lý logo, hotline, email, mạng xã hội và thông tin chân trang (Footer) đồng bộ.',
        href: '/admin/branding',
        icon: ShieldCheck,
        badge: 'Nhận diện',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        accentColor: 'group-hover:border-[#C5A059]',
        iconColor: 'bg-amber-50 text-amber-800',
        permission: 'website.branding.read',
      },
    ],
    [publishedPages, totalPages, publishedProjects, data?.articles?.published, newLeads, totalLeads],
  );

  const visibleWorkspaces = allWorkspaces.filter(
    (item) =>
      user?.role === 'CEO' ||
      user?.role === 'ADMIN' ||
      permissions.includes(item.permission),
  );

  // Filtered page list
  const filteredPages = useMemo(() => {
    return Object.entries(PAGE_LABEL).filter(([key, info]) => {
      const pageRecord = data?.recent?.find((p) => p.page_key === key);
      const statusKey = pageRecord?.status || (key === 'home' || key === 'about' || key === 'contact' ? 'PUBLISHED' : 'DRAFT');

      if (pageFilter === 'PUBLISHED' && statusKey !== 'PUBLISHED') return false;
      if (pageFilter === 'DRAFT' && statusKey === 'PUBLISHED') return false;

      if (pageSearch.trim()) {
        const query = pageSearch.toLowerCase();
        return (
          info.title.toLowerCase().includes(query) ||
          info.path.toLowerCase().includes(query) ||
          info.desc.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [data?.recent, pageFilter, pageSearch]);

  const seoPercentage = totalPages ? Math.round((seoReadyPages / totalPages) * 100) : 0;
  const publishPercentage = totalPages ? Math.round((publishedPages / totalPages) * 100) : 0;

  return (
    <div className="admin-dashboard-page space-y-5 p-3.5 sm:p-5 lg:p-6 bg-[#FAF8F5]/50 min-h-screen text-[#0A192F]">
      {/* 1. EXECUTIVE ACTION BAR (Sleek, Compact, Zero Bulky Text) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8E0D8] bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-[#0A192F] tracking-tight">
              Bảng điều khiển Tổng quan
            </h1>
            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
              <span>Hệ thống trực tuyến</span>
              {lastUpdated && <span>• Cập nhật {lastUpdated}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => void fetchOverview(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
            title="Tải lại số liệu mới nhất"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>

          <Link
            href="https://maianhomes.vn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:border-[#C5A059] hover:text-[#C5A059] transition active:scale-95"
          >
            <span>Xem website</span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </Link>

          <Link
            href="/admin/content"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-700 to-[#2D1B14] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:brightness-110 transition active:scale-95"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Studio CMS & SEO</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. COMMAND METRICS RIBBON (4 EXECUTIVE KPI PILLARS) */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pillar 1: Content Pages Status */}
        <Link
          href="/admin/content"
          className="group rounded-2xl border border-[#E8E0D8] bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-red-600 hover:shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Nội dung Website CMS
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-red-50 group-hover:text-red-600">
                <Globe2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <strong className="text-2xl font-extrabold text-[#0A192F]">
                {loading ? '...' : totalPages}
              </strong>
              <span className="text-xs text-slate-500 font-medium">trang chính</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-600">
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {publishedPages} Đã xuất bản
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {draftPages} Bản nháp
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${publishPercentage}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
              <span>Tiến độ xuất bản</span>
              <span className="font-bold text-slate-600">{publishPercentage}%</span>
            </div>
          </div>
        </Link>

        {/* Pillar 2: SEO & AI Readiness */}
        <Link
          href="/admin/content"
          className="group rounded-2xl border border-[#E8E0D8] bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-emerald-600 hover:shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Sức khỏe SEO & AI (GEO)
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-100 group-hover:text-emerald-700">
                <SearchCheck className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <strong className="text-2xl font-extrabold text-[#0A192F]">
                {loading ? '...' : `${seoReadyPages}/${totalPages}`}
              </strong>
              <span className="text-xs font-semibold text-emerald-700">
                {seoPercentage}% Đạt chuẩn
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-600">
              <span>{seoReadyPages} trang chuẩn Meta</span>
              <span className="font-semibold text-purple-700">{geoReadyPages} có GEO AI</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${seoPercentage}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
              <span>Đạt tiêu chuẩn xuất bản</span>
              <span className="font-bold text-emerald-600">Chất lượng cao</span>
            </div>
          </div>
        </Link>

        {/* Pillar 3: Leads & Conversions */}
        <Link
          href="/admin/leads"
          className="group rounded-2xl border border-[#E8E0D8] bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-purple-600 hover:shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Khách hàng từ Website
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition group-hover:bg-purple-100 group-hover:text-purple-700">
                <Inbox className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <strong className="text-2xl font-extrabold text-[#0A192F]">
                {loading ? '...' : totalLeads}
              </strong>
              <span className="text-xs text-slate-500 font-medium">liên hệ tổng</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              {newLeads > 0 ? (
                <span className="inline-flex items-center gap-1 font-bold text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                  {newLeads} yêu cầu mới
                </span>
              ) : (
                <span className="text-slate-500 font-medium">Toàn bộ đã tiếp nhận</span>
              )}
              <span className="font-bold text-slate-400 group-hover:text-purple-700 transition">
                Mở Leads →
              </span>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-purple-100">
              <div className="h-full bg-purple-600 transition-all duration-500" style={{ width: '100%' }} />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
              <span>Phễu chuyển đổi</span>
              <span className="font-bold text-purple-700">Tự động đồng bộ</span>
            </div>
          </div>
        </Link>

        {/* Pillar 4: Property Projects */}
        <Link
          href="/admin/projects"
          className="group rounded-2xl border border-[#E8E0D8] bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-amber-600 hover:shadow-md flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Dự án Bất động sản
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-100 group-hover:text-amber-700">
                <Building2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <strong className="text-2xl font-extrabold text-[#0A192F]">
                {loading ? '...' : publishedProjects}
              </strong>
              <span className="text-xs text-slate-500 font-medium">dự án Live</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <span className="text-emerald-600 font-semibold">Đang mở bán</span>
              <span className="text-slate-400 font-mono">{totalProjects} tổng danh mục</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{
                  width: `${totalProjects ? Math.max(20, (publishedProjects / totalProjects) * 100) : 100}%`,
                }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
              <span>Trạng thái mở bán</span>
              <span className="font-bold text-amber-600">Đầy đủ hồ sơ</span>
            </div>
          </div>
        </Link>
      </div>

      {/* 3. WORKSPACES & MODULES COMMAND HUB */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Phân hệ Chức năng & Không gian Làm việc
            </h2>
            <p className="text-[11px] text-slate-400">
              Truy cập nhanh các công cụ điều hành và quản trị chuyên biệt
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {visibleWorkspaces.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex flex-col justify-between rounded-2xl border border-[#E8E0D8] bg-white p-3.5 shadow-2xs transition hover:-translate-y-0.5 hover:shadow-md ${item.accentColor}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${item.iconColor}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${item.badgeColor} whitespace-nowrap`}>
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-xs font-bold text-slate-900 group-hover:text-red-700 transition leading-snug">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500 whitespace-normal break-words">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600 group-hover:text-red-700 transition">
                  <span>Mở phân hệ</span>
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 4. MAIN 2-COLUMN SECTION: INVENTORY & OPERATIONAL HEALTH */}
      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* LEFT COLUMN: MAIAN HOMES 10 PAGES CONTENT INVENTORY */}
        <section className="rounded-3xl border border-[#E8E0D8] bg-white p-4 sm:p-5 shadow-xs flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#0A192F]">
                Danh mục Trang Website (Content Matrix)
              </h2>
              <p className="text-[11px] text-slate-500">
                10 trang cốt lõi quản lý thông điệp thương hiệu, SEO Google và dữ liệu GEO AI.
              </p>
            </div>

            <Link
              href="/admin/content"
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
            >
              <span>Vào Studio biên tập</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Micro Search & Filter Bar */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setPageFilter('ALL')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  pageFilter === 'ALL'
                    ? 'bg-white font-bold text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả (10)
              </button>
              <button
                type="button"
                onClick={() => setPageFilter('PUBLISHED')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  pageFilter === 'PUBLISHED'
                    ? 'bg-white font-bold text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đã xuất bản ({publishedPages})
              </button>
              <button
                type="button"
                onClick={() => setPageFilter('DRAFT')}
                className={`rounded-lg px-2.5 py-1 transition ${
                  pageFilter === 'DRAFT'
                    ? 'bg-white font-bold text-amber-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bản nháp ({draftPages})
              </button>
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                placeholder="Tìm trang hoặc đường dẫn..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1 text-xs focus:bg-white focus:border-red-600 focus:outline-hidden transition"
              />
            </div>
          </div>

          {/* Pages Matrix List */}
          <div className="mt-3 divide-y divide-slate-100">
            {filteredPages.map(([key, info]) => {
              const Icon = info.icon;
              const pageRecord = data?.recent?.find((p) => p.page_key === key);
              const statusKey =
                pageRecord?.status ||
                (key === 'home' || key === 'about' || key === 'contact' ? 'PUBLISHED' : 'DRAFT');
              const statusCfg = STATUS_LABEL[statusKey] || STATUS_LABEL.DRAFT;

              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-[#FAF8F5]/80 px-2 rounded-xl transition"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs font-bold text-slate-900 sm:text-sm">
                          {info.title}
                        </strong>
                        <span className="font-mono text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          {info.path}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 whitespace-normal break-words">
                        {info.desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </span>

                    <Link
                      href="/admin/content"
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:border-red-600 hover:text-red-700 transition"
                    >
                      <span>Sửa</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })}

            {filteredPages.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                Không tìm thấy trang nào phù hợp với bộ lọc tìm kiếm.
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: OPERATIONAL HEALTH & ACTIVITY FEED */}
        <div className="space-y-5">
          {/* Panel 1: Sức khỏe Vận hành & Cảnh báo */}
          <section className="rounded-3xl border border-[#E8E0D8] bg-white p-4 sm:p-5 shadow-xs">
            <h2 className="text-sm sm:text-base font-bold text-[#0A192F]">
              Trạng thái Vận hành & Kết nối
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Kiểm tra các luồng tương tác khách hàng và dữ liệu hệ thống.
            </p>

            <div className="mt-3.5 space-y-2.5">
              {/* Leads Status */}
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-start gap-2.5">
                  <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
                  <div>
                    <strong className="text-xs font-bold text-slate-900">
                      Yêu cầu tư vấn (Khách hàng)
                    </strong>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      {newLeads > 0
                        ? `Có ${newLeads} yêu cầu mới từ khách hàng website đang chờ tiếp nhận.`
                        : 'Toàn bộ liên hệ từ form đã được tiếp nhận và xử lý đầy đủ.'}
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/leads"
                  className="shrink-0 text-[11px] font-bold text-purple-700 hover:underline"
                >
                  Mở Leads
                </Link>
              </div>

              {/* Coworking & Services */}
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-start gap-2.5">
                  <Layers className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <strong className="text-xs font-bold text-slate-900">
                      Dịch vụ Coworking & Thuê
                    </strong>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      Bảng giá chỗ ngồi, phòng họp và form nhận tư vấn trực tuyến hoạt động bình thường.
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/workspaces"
                  className="shrink-0 text-[11px] font-bold text-amber-700 hover:underline"
                >
                  Quản lý
                </Link>
              </div>

              {/* Media Assets Audit */}
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <strong className="text-xs font-bold text-slate-900">
                      Thư viện Hình ảnh & Media
                    </strong>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      {data?.media?.total
                        ? `${data.media.total} tệp ảnh trong kho; ${data.media.missing_alt || 0} ảnh cần gắn thẻ Alt SEO.`
                        : 'Kho hình ảnh tối ưu tải nhanh định dạng WebP.'}
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/content"
                  className="shrink-0 text-[11px] font-bold text-emerald-700 hover:underline"
                >
                  Kiểm tra
                </Link>
              </div>

              {/* Brand Identity & Footer */}
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#C5A059]" />
                  <div>
                    <strong className="text-xs font-bold text-slate-900">
                      Nhận diện Thương hiệu & Chân trang
                    </strong>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      Hotline, email, mạng xã hội và thông tin công ty đã đồng bộ toàn website.
                    </p>
                  </div>
                </div>
                <Link
                  href="/admin/branding"
                  className="shrink-0 text-[11px] font-bold text-[#C5A059] hover:underline"
                >
                  Cấu hình
                </Link>
              </div>
            </div>
          </section>

          {/* Panel 2: Nhật ký Cập nhật gần đây (Activity Feed) */}
          <section className="rounded-3xl border border-[#E8E0D8] bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm sm:text-base font-bold text-[#0A192F]">
                Nhật ký Cập nhật gần đây
              </h2>
              <span className="text-[11px] font-medium text-slate-400">
                Lịch sử hoạt động
              </span>
            </div>

            <div className="mt-3 divide-y divide-slate-100">
              {data?.recent?.map((item) => {
                const labelInfo = PAGE_LABEL[item.page_key];
                const statusCfg = STATUS_LABEL[item.status || 'DRAFT'] || STATUS_LABEL.DRAFT;

                return (
                  <div key={item.page_key} className="flex items-center justify-between py-2.5 text-xs">
                    <div className="min-w-0 pr-2">
                      <strong className="block text-xs font-bold text-slate-900 truncate">
                        {labelInfo?.title || item.page_key}
                      </strong>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {item.updated_at
                          ? new Date(item.updated_at).toLocaleString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            })
                          : 'Vừa cập nhật'}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
                );
              })}

              {(!data?.recent || data.recent.length === 0) && (
                <div className="py-6 text-center text-xs text-slate-400">
                  Chưa có lịch sử cập nhật nào được ghi nhận.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
