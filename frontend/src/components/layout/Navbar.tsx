// src/components/layout/Navbar.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { contentApi } from '@/features/content/api';
import { mediaUrl, usePublicSiteSettings } from '@/features/website/public/site-settings';
import { apiFetch } from '@/lib/api';

interface ProjectNavItem {
  name: string;
  slug: string;
}
interface WorkspaceAvailability {
  coworking: boolean;
  office: boolean;
}
interface PublicProjectResponse {
  data?: Array<{ name?: string; slug?: string }>;
}

export default function Navbar() {
  const [isProjectHovered, setIsProjectHovered] = useState(false);
  const [projectList, setProjectList] = useState<ProjectNavItem[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileProjectOpen, setMobileProjectOpen] = useState(false);
  const [isServiceHovered, setIsServiceHovered] = useState(false);
  const [mobileServiceOpen, setMobileServiceOpen] = useState(false);
  const [workspaceAvailability, setWorkspaceAvailability] = useState<WorkspaceAvailability>({ coworking: true, office: true });
  const pathname = usePathname();
  const siteSettings = usePublicSiteSettings();

  const loadPublishedProjects = useCallback(async () => {
    try {
      const res: PublicProjectResponse = await contentApi.listProjectsPublic({ is_featured: true });
      const dbProjects = Array.isArray(res?.data) ? res.data : [];
      const seenSlugs = new Set<string>();
      const freshProjects = dbProjects.reduce<ProjectNavItem[]>((projects, project) => {
        const slug = project?.slug?.trim();
        if (!slug || seenSlugs.has(slug)) return projects;
        seenSlugs.add(slug);
        projects.push({ name: project.name?.trim() || slug, slug });
        return projects;
      }, []);

      // Luôn thay thế bằng trạng thái public hiện tại để cả thao tác gỡ và
      // xuất bản lại đều được phản ánh chính xác trên Navbar.
      setProjectList(freshProjects);
    } catch {
      // Keep the current/empty navigation list. A public API outage must not
      // break route rendering or replace the visible layout.
    }
  }, []);

  const loadWorkspaceAvailability = useCallback(async () => {
    try {
      const availability = await apiFetch(
        '/workspaces/availability',
        { cache: 'no-store' },
        'public',
      );
      setWorkspaceAvailability(availability as WorkspaceAvailability);
    } catch {
      // Keep the last known navigation state during a temporary API outage.
    }
  }, []);
  // Close mobile menu on route change
  useEffect(() => {
    const task = window.setTimeout(() => {
      setMobileOpen(false);
      setMobileProjectOpen(false);
      setMobileServiceOpen(false);
    }, 0);
    return () => window.clearTimeout(task);
  }, [pathname]);

  // Prevent body scroll when menu open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Navbar nằm trong layout dùng chung nên không bị mount lại khi điều hướng.
  // Tải lại theo pathname để không giữ danh sách dự án cũ trong state.
  useEffect(() => {
    // Dữ liệu được cập nhật bất đồng bộ sau khi API phản hồi, không phải
    // một lần setState đồng bộ ngay trong effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPublishedProjects();
    void loadWorkspaceAvailability();
  }, [loadPublishedProjects, loadWorkspaceAvailability, pathname]);

  return (
    <>
      <header data-site-navbar className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-black/5 shadow-md transition-all duration-300">
        <div className="w-full max-w-[96%] xl:max-w-[1720px] 2xl:max-w-[1800px] mx-auto px-4 sm:px-8 py-2 sm:py-2 xl:py-2 flex items-center justify-between transition-all duration-300">

          {/* Logo */}
          <Link href="/" className="flex items-center group shrink-0" aria-label="Maian Homes - Trang chủ bất động sản cao cấp" title="Maian Homes - Trang chủ">
            <Image
              src={mediaUrl(siteSettings.logo_header_media_id, '/images/logo_maian.png')}
              alt="Logo công ty Maian Homes - Đầu trang"
              width={220}
              height={76}
              sizes="(max-width: 640px) 140px, 220px"
              priority
              className="h-8 sm:h-9 lg:h-10 xl:h-[42px] w-auto object-contain transition-transform duration-300 group-hover:opacity-90"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-2.5 xl:gap-3.5 2xl:gap-5 text-[13px] xl:text-[14px] 2xl:text-[15px] font-bold tracking-normal text-[#0a192f] whitespace-nowrap">
            {/* 1. Ký gửi */}
            <Link
              href="/ky-gui"
              className="relative overflow-hidden group bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] px-3.5 xl:px-4.5 py-1.5 xl:py-2 rounded-full font-bold hover:shadow-[0_0_25px_rgba(212,175,55,0.55)] transition-all duration-300 whitespace-nowrap text-[12px] xl:text-[13px] 2xl:text-[14px]"
              aria-label="Dịch vụ ký gửi mua bán, cho thuê bất động sản TP.HCM - Maian Homes"
            >
              <span className="relative z-10">Ký gửi BĐS</span>
              <div className="absolute inset-0 h-full w-full bg-white/30 transform -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out skew-x-12 z-0"></div>
            </Link>

            {/* Dropdown Dự án */}
            <div
              className="relative py-2 group cursor-pointer"
              onMouseEnter={() => {
                setIsProjectHovered(true);
                void loadPublishedProjects();
                void loadWorkspaceAvailability();
              }}
              onMouseLeave={() => setIsProjectHovered(false)}
            >
              <div className="flex items-center gap-1 hover:text-red-600 hover:-translate-y-0.5 transition-all duration-300">
                <Link
                  href="/du_an"
                  className="relative"
                  aria-label="Dự án bất động sản Maian Homes"
                >
                  Dự án
                </Link>
                <button
                  type="button"
                  onClick={() => setIsProjectHovered((isOpen) => !isOpen)}
                  aria-expanded={isProjectHovered}
                  aria-label="Mở danh sách dự án nổi bật"
                  className="rounded p-0.5"
                >
                  <svg className={`w-3.5 h-3.5 transition-transform ${isProjectHovered ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <div className={`absolute top-full left-1/2 -translate-x-1/2 w-64 xl:w-72 pt-2 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isProjectHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <div className="bg-white/95 backdrop-blur-2xl border border-black/10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.15)] p-2">
                  {projectList.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/du_an/${p.slug}`}
                      className="block px-4 py-2.5 text-[#0a192f] font-medium hover:text-red-600 hover:bg-black/5 rounded-xl transition-all duration-300 text-sm hover:pl-5"
                    >
                      {p.name}
                    </Link>
                  ))}
                  <div className="h-px bg-black/10 my-1" />
                  <Link
                    href="/du_an"
                    className="flex items-center justify-between px-3.5 py-2 text-[#A37B18] hover:text-[#1A1612] hover:bg-[#D4AF37]/10 font-semibold rounded-lg transition-all duration-200 text-xs tracking-wide"
                    aria-label="Khám phá danh mục dự án bất động sản Maian Homes tại TP.HCM"
                  >
                    <span>Khám phá toàn bộ dự án</span>
                    <span className="text-xs ml-1 font-bold">&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Dropdown Dịch Vụ */}
            <div
              className="relative py-2 group cursor-pointer"
              onMouseEnter={() => setIsServiceHovered(true)}
              onMouseLeave={() => setIsServiceHovered(false)}
            >
              <div className="flex items-center gap-1 hover:text-red-600 hover:-translate-y-0.5 transition-all duration-300">
                Dịch vụ
                <svg className={`w-3.5 h-3.5 transition-transform ${isServiceHovered ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <div className={`absolute top-full left-1/2 -translate-x-1/2 w-56 pt-2 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isServiceHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                <div className="bg-white/95 backdrop-blur-2xl border border-black/10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.15)] p-2">
                  {workspaceAvailability.coworking && (
                    <Link
                      href="/dich-vu-cho-thue/coworking"
                      className="block px-4 py-2.5 text-[#0a192f] font-medium hover:text-red-600 hover:bg-black/5 rounded-xl transition-all duration-300 text-sm hover:pl-5"
                      aria-label="Dịch vụ văn phòng chia sẻ Co-working Space Maian Homes"
                    >
                      Co-working Space
                    </Link>
                  )}
                  {workspaceAvailability.office && (
                    <Link
                      href="/dich-vu-cho-thue/office"
                      className="block px-4 py-2.5 text-[#0a192f] font-medium hover:text-red-600 hover:bg-black/5 rounded-xl transition-all duration-300 text-sm hover:pl-5"
                      aria-label="Dịch vụ văn phòng Maian Office Maian Homes"
                    >
                      Maian Office
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* 6. Đội Ngũ */}
            <Link
              href="/doi-ngu"
              className="relative hover:text-red-600 hover:-translate-y-0.5 transition-all duration-300 after:content-[''] after:absolute after:bottom-[-4px] after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-red-600 hover:after:w-full after:transition-all after:duration-300"
              aria-label="Đội ngũ chuyên viên tư vấn và quản lý bất động sản Maian Homes"
            >
              Đội ngũ
            </Link>

            {/* 7. Giới thiệu */}
            <Link
              href="/gioi-thieu"
              className="relative hover:text-red-600 hover:-translate-y-0.5 transition-all duration-300 after:content-[''] after:absolute after:bottom-[-4px] after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-red-600 hover:after:w-full after:transition-all after:duration-300"
              aria-label="Giới thiệu Maian Homes - Đơn vị tư vấn bất động sản cao cấp TP.HCM"
            >
              Giới thiệu
            </Link>

            {/* 8. Tin tức */}
            <Link
              href="/tin_tuc"
              className="relative hover:text-red-600 hover:-translate-y-0.5 transition-all duration-300 after:content-[''] after:absolute after:bottom-[-4px] after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-red-600 hover:after:w-full after:transition-all after:duration-300"
              aria-label="Tin tức thị trường và phân tích xu hướng bất động sản TP.HCM"
            >
              Tin tức
            </Link>

            {/* 9. Tuyển dụng */}
            <Link
              href="/tuyen-dung"
              className="relative hover:text-red-600 hover:-translate-y-0.5 transition-all duration-300 after:content-[''] after:absolute after:bottom-[-4px] after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-red-600 hover:after:w-full after:transition-all after:duration-300"
              aria-label="Cơ hội nghề nghiệp và tuyển dụng chuyên viên BĐS tại Maian Homes"
            >
              Tuyển dụng
            </Link>

            {/* 10. Liên hệ */}
            <Link
              href="/lien-he"
              className="relative hover:text-red-600 hover:-translate-y-0.5 transition-all duration-300 after:content-[''] after:absolute after:bottom-[-4px] after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[2px] after:bg-red-600 hover:after:w-full after:transition-all after:duration-300"
              aria-label="Liên hệ tư vấn dịch vụ bất động sản Maian Homes TP.HCM"
            >
              Liên hệ
            </Link>
          </nav>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
            className="lg:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5 rounded-xl border border-black/10 bg-black/5 hover:bg-black/10 transition-colors"
          >
            <span className={`block h-0.5 w-5 bg-[#1A1612] transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block h-0.5 w-5 bg-[#1A1612] transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-5 bg-[#1A1612] transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>

        </div>
      </header>

      {/* ── MOBILE DRAWER ── */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[48] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-72 max-w-[85vw] z-[49] bg-white shadow-2xl transform transition-transform duration-300 ease-out lg:hidden flex flex-col ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!mobileOpen}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-black/10">
          <span className="text-[#0a192f] font-bold text-sm uppercase tracking-widest">Menu</span>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng menu điều hướng"
            className="w-8 h-8 flex items-center justify-center rounded-full border border-black/10 text-black/60 hover:text-black transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Drawer links */}
        <nav className="flex-1 overflow-y-auto overscroll-contain py-6 px-4 space-y-1" style={{ touchAction: 'pan-y' }}>
          {/* 1. Ký gửi */}
          <Link
            href="/ky-gui"
            className="relative overflow-hidden group flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] font-bold rounded-xl shadow-sm transition-all text-sm uppercase tracking-wider mb-2"
            aria-label="Ký gửi nhà đất với Maian Homes"
          >
            <span className="relative z-10">Ký gửi</span>
            <div className="absolute inset-0 h-full w-full bg-white/30 transform -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out skew-x-12 z-0"></div>
          </Link>

          {/* Mobile Projects Accordion */}
          <div>
            <div className="flex items-center rounded-xl text-[#0a192f] transition-all hover:bg-black/5 hover:text-red-600">
              <Link
                href="/du_an"
                className="flex-1 px-4 py-3.5 text-sm font-semibold uppercase tracking-wider"
                aria-label="Dự án bất động sản Maian Homes"
              >
                Tất cả dự án
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (!mobileProjectOpen) void loadPublishedProjects();
                  setMobileProjectOpen((isOpen) => !isOpen);
                }}
                aria-expanded={mobileProjectOpen}
                aria-label="Mở rộng danh sách dự án"
                className="mr-2 flex h-10 w-10 items-center justify-center rounded-lg"
              >
                <svg className={`w-4 h-4 transition-transform duration-300 ${mobileProjectOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {/* Sub-items */}
            <div className={`overflow-hidden transition-all duration-300 ${mobileProjectOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="ml-4 mt-1 space-y-0.5 border-l border-black/10 pl-4">
                {projectList.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/du_an/${p.slug}`}
                    className="block py-2 text-[#0a192f] hover:text-red-600 transition-colors text-sm font-medium"
                  >
                    {p.name}
                  </Link>
                ))}
                <div className="h-px bg-black/10 my-1" />
                <Link
                  href="/du_an"
                  className="flex items-center justify-between py-2 text-xs font-semibold text-[#A37B18] hover:text-[#1A1612] transition-colors"
                  aria-label="Xem tất cả dự án nổi bật Maian Homes"
                >
                  <span>Xem toàn bộ danh mục</span>
                  <span className="text-xs">&rarr;</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Mobile Service Accordion */}
          <div>
            <button
              onClick={() => setMobileServiceOpen((isOpen) => !isOpen)}
              aria-expanded={mobileServiceOpen}
              aria-label="Mở rộng danh sách dịch vụ"
              className="w-full flex items-center justify-between px-4 py-3.5 text-[#0a192f] font-semibold rounded-xl hover:bg-black/5 hover:text-red-600 transition-all text-sm uppercase tracking-wider"
            >
              Dịch vụ
              <svg className={`w-4 h-4 transition-transform duration-300 ${mobileServiceOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${mobileServiceOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="ml-4 mt-1 space-y-0.5 border-l border-black/10 pl-4">
                {workspaceAvailability.coworking && (
                  <Link
                    href="/dich-vu-cho-thue/coworking"
                    className="block py-2 text-[#0a192f] hover:text-red-600 transition-colors text-sm font-medium"
                    aria-label="Dịch vụ văn phòng chia sẻ Co-working Space"
                  >
                    Co-working
                  </Link>
                )}
                {workspaceAvailability.office && (
                  <Link
                    href="/dich-vu-cho-thue/office"
                    className="block py-2 text-[#0a192f] hover:text-red-600 transition-colors text-sm font-medium"
                    aria-label="Dịch vụ văn phòng Maian Office"
                  >
                    Maian Office
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* 6. Đội ngũ */}
          <Link
            href="/doi-ngu"
            className="block px-4 py-3.5 text-[#0a192f] font-semibold rounded-xl hover:bg-black/5 hover:text-red-600 transition-all text-sm uppercase tracking-wider"
            aria-label="Gặp gỡ đội ngũ chuyên gia Maian Homes"
          >
            Đội ngũ chuyên viên
          </Link>

          {/* 7. Giới thiệu */}
          <Link
            href="/gioi-thieu"
            className="block px-4 py-3.5 text-[#0a192f] font-semibold rounded-xl hover:bg-black/5 hover:text-red-600 transition-all text-sm uppercase tracking-wider"
            aria-label="Tìm hiểu về Maian Homes"
          >
            Giới thiệu Maian Homes
          </Link>

          {/* 8. Tin tức */}
          <Link
            href="/tin_tuc"
            className="block px-4 py-3.5 text-[#0a192f] font-semibold rounded-xl hover:bg-black/5 hover:text-red-600 transition-all text-sm uppercase tracking-wider"
            aria-label="Cập nhật tin tức bất động sản mới nhất"
          >
            Tin tức thị trường
          </Link>

          {/* 9. Tuyển dụng */}
          <Link
            href="/tuyen-dung"
            className="block px-4 py-3.5 text-[#0a192f] font-semibold rounded-xl hover:bg-black/5 hover:text-red-600 transition-all text-sm uppercase tracking-wider"
            aria-label="Ứng tuyển vị trí tại Maian Homes"
          >
            Tuyển dụng nhân sự
          </Link>
          {/* 10. Liên hệ */}
          <Link
            href="/lien-he"
            className="block px-4 py-3.5 text-[#0a192f] font-semibold rounded-xl hover:bg-black/5 hover:text-red-600 transition-all text-sm uppercase tracking-wider"
            aria-label="Gửi yêu cầu liên hệ tư vấn nhanh qua menu di động"
          >
            Liên hệ tư vấn
          </Link>
        </nav>

        {/* CTA at bottom */}
        <div className="px-4 py-6 border-t border-black/10">
          <Link
            href="/ky-gui"
            className="relative overflow-hidden group block w-full text-center bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#1A1612] px-6 py-3.5 rounded-full font-bold text-sm uppercase tracking-wider hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all shadow-md"
            aria-label="Ký gửi bất động sản ngay với Maian Homes"
          >
            <span className="relative z-10">Ký gửi Bất Động Sản</span>
            <div className="absolute inset-0 h-full w-full bg-white/30 transform -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out skew-x-12 z-0"></div>
          </Link>
          <p className="text-center text-gray-400 text-xs mt-4">© {new Date().getFullYear()} Maian Homes</p>
        </div>
      </div>
    </>
  );
}
