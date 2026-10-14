'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  UserCircle,
  Menu,
  X,
} from 'lucide-react';
import './admin.css';
import { useAuth } from '@/context/AuthContext';
import { getAssetUrl } from '@/lib/api';
import { getSafeAdminFallback, isAdminPathAllowed } from '@/lib/admin-access';
import { useNotifications } from '@/context/NotificationContext';
import AdminSidebar from '@/components/layout/AdminSidebar';
import AdminBottomNav from '@/components/layout/AdminBottomNav';
import { adminLabel } from '@/lib/admin-labels';

const ADMIN_PAGE_TITLES: Array<[string, string]> = [
  ['/admin/workspaces/coworking', 'Quản trị Coworking'],
  ['/admin/workspaces/office', 'Quản trị văn phòng'],
  ['/admin/workspaces/grades', 'Phân hạng văn phòng'],
  ['/admin/workspaces/seo-geo', 'SEO & GEO dịch vụ'],
  ['/admin/recruitment', 'Tuyển dụng'],
  ['/admin/accounts', 'Tài khoản & phân quyền'],
  ['/admin/articles', 'Tin tức'],
  ['/admin/projects', 'Dự án'],
  ['/admin/content/company', 'Kho kiến thức doanh nghiệp'],
  ['/admin/content', 'Nội dung website'],
  ['/admin/branding', 'Thương hiệu & liên hệ'],
  ['/admin/analytics', 'Thống kê'],
  ['/admin/activity', 'Nhật ký hoạt động'],
  ['/admin/system', 'Giám sát hệ thống'],
  ['/admin/team', 'Đội ngũ công khai'],
  ['/admin/leads', 'Khách hàng'],
  ['/admin/profile', 'Thông tin cá nhân'],
  ['/admin/workspaces', 'Dịch vụ'],
  ['/admin', 'Tổng quan'],
];


// FIX-10: Error Boundary — prevents child runtime errors from crashing entire admin layout
type AdminPageContext = {
  section: string;
  description: string;
  tone: 'access' | 'content' | 'growth' | 'service' | 'operations' | 'personal';
};

type AdminQuickLink = {
  href: string;
  label: string;
};

const ADMIN_PAGE_CONTEXT: Array<[string, AdminPageContext]> = [
  ['/admin/workspaces', { section: 'Dịch vụ', description: 'Điều hành nội dung, sản phẩm và dữ liệu vận hành của các dịch vụ cho thuê.', tone: 'service' }],
  ['/admin/content/company', { section: 'Nội dung & AI', description: 'Nguồn tri thức doanh nghiệp dùng chung cho website, FAQ và trợ lý AI.', tone: 'content' }],
  ['/admin/content', { section: 'Nội dung', description: 'Quản trị nội dung trang, chất lượng SEO/GEO và quy trình xuất bản.', tone: 'content' }],
  ['/admin/projects', { section: 'Nội dung', description: 'Biên tập danh mục dự án, media, tiện ích và trạng thái xuất bản.', tone: 'content' }],
  ['/admin/articles', { section: 'Nội dung', description: 'Soạn thảo, kiểm duyệt và xuất bản tin tức trên website.', tone: 'content' }],
  ['/admin/branding', { section: 'Thương hiệu', description: 'Quản lý nhận diện, thông tin liên hệ và cấu hình footer công khai.', tone: 'content' }],
  ['/admin/team', { section: 'Nội dung', description: 'Quản trị hồ sơ đội ngũ chuyên gia hiển thị trên website.', tone: 'content' }],
  ['/admin/recruitment', { section: 'Nhân sự công khai', description: 'Quản lý tin tuyển dụng, hồ sơ ứng viên và nội dung cổng nghề nghiệp.', tone: 'growth' }],
  ['/admin/accounts', { section: 'Truy cập & bảo mật', description: 'Quản lý tài khoản, vai trò và quyền thao tác theo từng chức năng.', tone: 'access' }],
  ['/admin/leads', { section: 'Kinh doanh', description: 'Theo dõi khách hàng, yêu cầu tư vấn và trạng thái xử lý liên hệ.', tone: 'growth' }],
  ['/admin/analytics', { section: 'Kinh doanh', description: 'Phân tích chuyển đổi, nguồn truy cập và hiệu suất nội dung website.', tone: 'growth' }],
  ['/admin/activity', { section: 'Vận hành', description: 'Tra cứu nhật ký thao tác, kết quả xử lý và dấu vết kiểm toán.', tone: 'operations' }],
  ['/admin/system', { section: 'Vận hành', description: 'Theo dõi sức khỏe dịch vụ, API, email và hạ tầng kỹ thuật.', tone: 'operations' }],
  ['/admin/profile', { section: 'Cá nhân', description: 'Quản lý thông tin định danh và hồ sơ tài khoản đang đăng nhập.', tone: 'personal' }],
];

const ADMIN_QUICK_LINKS: Record<AdminPageContext['tone'], AdminQuickLink[]> = {
  access: [
    { href: '/admin/accounts', label: 'Tài khoản' },
    { href: '/admin/system', label: 'Hệ thống' },
  ],
  content: [
    { href: '/admin/content', label: 'Trang web' },
    { href: '/admin/content/company', label: 'Kho tri thức AI' },
    { href: '/admin/projects', label: 'Dự án' },
    { href: '/admin/branding', label: 'Thương hiệu' },
    { href: '/admin/team', label: 'Đội ngũ' },
  ],
  growth: [
    { href: '/admin/leads', label: 'Khách hàng' },
    { href: '/admin/analytics', label: 'Phân tích' },
    { href: '/admin/recruitment', label: 'Tuyển dụng' },
  ],
  service: [
    { href: '/admin/workspaces', label: 'Tổng quan' },
    { href: '/admin/workspaces/coworking', label: 'Coworking' },
    { href: '/admin/workspaces/office', label: 'Văn phòng' },
    { href: '/admin/workspaces/grades', label: 'Phân hạng' },
    { href: '/admin/workspaces/seo-geo', label: 'SEO / GEO' },
  ],
  operations: [
    { href: '/admin/system', label: 'Hệ thống' },
    { href: '/admin/accounts', label: 'Phân quyền' },
  ],
  personal: [{ href: '/admin/profile', label: 'Hồ sơ của tôi' }],
};

class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '50vh', padding: '2rem', textAlign: 'center', color: '#D4AF37',
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}> Đã xảy ra lỗi không mong đợi</h2>
          <p style={{ opacity: 0.7, fontSize: '0.9rem', marginBottom: '1.5rem' }}>{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.6rem 2rem', cursor: 'pointer',
              background: '#D4AF37', color: '#1A1612', border: 'none', borderRadius: '6px',
              fontWeight: 600, fontSize: '0.9rem',
            }}
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [showNotifMenu, setShowNotifMenu] = React.useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = React.useState(false);
  const [notificationError, setNotificationError] = React.useState('');
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isMiniSidebar, setIsMiniSidebar] = React.useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
    setShowNotifMenu(false);
  }, [pathname]);

  useEffect(() => {
    setIsMiniSidebar(localStorage.getItem('adminSidebarMini') === 'true');
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    const closeOverlays = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsSidebarOpen(false);
      setShowNotifMenu(false);
    };
    window.addEventListener('keydown', closeOverlays);
    return () => window.removeEventListener('keydown', closeOverlays);
  }, []);


  const {
    notifications: displayNotifications,
    unreadCount: displayUnreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const handleMarkAllNotificationsRead = async () => {
    setNotificationError('');
    if (displayUnreadCount === 0 || isMarkingAllRead) return;
    setIsMarkingAllRead(true);
    try {
      await markAllAsRead();
    } catch {
      setNotificationError('Không thể đánh dấu tất cả thông báo đã đọc. Vui lòng thử lại.');
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleOpenNotification = async (notif: (typeof displayNotifications)[number]) => {
    setNotificationError('');
    try {
      const id = notif.id || notif._id;
      if (id && !notif.is_read) await markAsRead(id);
      if (notif.link) {
        setShowNotifMenu(false);
        router.push(notif.link);
      }
    } catch {
      setNotificationError('Không thể mở thông báo lúc này. Vui lòng thử lại.');
    }
  };

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else {
        if (pathname === '/admin/profile') return;

        const allowedPaths = user.allowed_paths || [];
        const isAllowed = isAdminPathAllowed(allowedPaths, pathname);

        if (!isAllowed) {
          const fallbackPath = getSafeAdminFallback(user.role, allowedPaths);
          if (fallbackPath && fallbackPath !== pathname) {
            router.replace(fallbackPath);
          } else {
            router.replace('/login');
          }
        }
      }
    }
  }, [user, isLoading, router, pathname]);

  const isPathAllowed = () => {
    if (!user) return false;
    const allowedPaths = user.allowed_paths || [];
    return isAdminPathAllowed(allowedPaths, pathname);
  };

  const allowed = isPathAllowed();
  const pageTitle = ADMIN_PAGE_TITLES.find(([path]) =>
    path === '/admin' ? pathname === path : pathname.startsWith(path),
  )?.[1] || 'Quản trị';

  const pageContext = ADMIN_PAGE_CONTEXT.find(([path]) =>
    pathname === path || pathname.startsWith(`${path}/`),
  )?.[1];
  const showRouteFrame =
    pathname !== '/admin' &&
    pathname !== '/admin/accounts' &&
    !pathname.startsWith('/admin/content') &&
    pathname !== '/admin/branding' &&
    pathname !== '/admin/projects' &&
    pathname !== '/admin/team' &&
    pathname !== '/admin/recruitment' &&
    pathname !== '/admin/leads' &&
    pathname !== '/admin/analytics' &&
    pathname !== '/admin/system' &&
    pathname !== '/admin/profile' &&
    !pathname.startsWith('/admin/workspaces') &&
    Boolean(pageContext);
  const quickLinks = pageContext
    ? ADMIN_QUICK_LINKS[pageContext.tone].filter((link) =>
        isAdminPathAllowed(user?.allowed_paths || [], link.href),
      )
    : [];
  const moduleNumber = String(
    Math.max(
      1,
      ADMIN_PAGE_CONTEXT.findIndex(([path]) =>
        pathname === path || pathname.startsWith(`${path}/`),
      ) + 1,
    ),
  ).padStart(2, '0');

  if (isLoading || !user || !allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A1612]">
        <div className="w-10 h-10 border-4 border-[#D4AF37]/20 border-t-[#D4AF37] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <AdminSidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isMini={isMiniSidebar}
        setIsMini={setIsMiniSidebar}
      />

      {/* Main Content Area */}
      <div className={`admin-shell-content flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ease-in-out ${isMiniSidebar ? 'admin-shell-content--mini lg:ml-[80px]' : 'lg:ml-[244px] xl:ml-[260px] 2xl:ml-[280px]'}`}>
        <header className="admin-header shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="admin-header-hamburger lg:hidden"
              aria-label="Menu"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="admin-header-context min-w-0">
              <p className="admin-header-eyebrow">Maian Homes Admin</p>
              <p className="admin-header-title truncate">{pageTitle}</p>
            </div>
          </div>

          <div className="admin-header-actions flex items-center gap-3 sm:gap-5">
            <div className="admin-system-status hidden xl:flex" title="Hệ thống đang hoạt động">
              <span />
              Trực tuyến
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="admin-header-icon-button relative cursor-pointer p-1.5 rounded-full transition-colors flex items-center justify-center"
                aria-label="Thông báo hệ thống"
                aria-expanded={showNotifMenu}
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {displayUnreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-4 h-4 px-1 flex items-center justify-center rounded-full font-bold">
                    {displayUnreadCount}
                  </span>
                )}
              </button>

              {showNotifMenu && (
                <div className="admin-notification-menu absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-[999] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200" role="dialog" aria-label="Thông báo hệ thống">
                  <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <span className="font-semibold text-xs text-gray-800">Thông báo hệ thống</span>
                    {displayUnreadCount > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                          {displayUnreadCount} mới
                        </span>
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsRead}
                          disabled={isMarkingAllRead}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline disabled:cursor-wait disabled:opacity-60"
                        >
                          {isMarkingAllRead ? 'Đang đọc...' : 'Đọc tất cả'}
                        </button>
                      </div>
                    )}
                  </div>
                  {notificationError && <div role="alert" className="mx-3 mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{notificationError}</div>}
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                    {displayNotifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-gray-400">
                        Không có thông báo nào.
                      </div>
                    ) : (
                      displayNotifications.map((notif) => (
                        <div
                          key={notif.id || notif._id}
                          role={notif.link ? 'button' : undefined}
                          tabIndex={notif.link ? 0 : undefined}
                          onClick={() => void handleOpenNotification(notif)}
                          onKeyDown={(event) => {
                            if (notif.link && (event.key === 'Enter' || event.key === ' ')) {
                              event.preventDefault();
                              void handleOpenNotification(notif);
                            }
                          }}
                          className={`px-4 py-3 text-xs transition-colors hover:bg-gray-50 flex flex-col gap-1 ${notif.link ? 'cursor-pointer' : ''} ${!notif.is_read ? 'bg-blue-50/20 font-medium' : ''}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-semibold text-gray-800 text-xs">{notif.title}</span>
                            {!notif.is_read && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const id = notif.id || notif._id;
                                    if (id) await markAsRead(id);
                                  } catch {
                                    setNotificationError('Không thể đánh dấu thông báo đã đọc.');
                                  }
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold shrink-0"
                              >
                                Đọc
                              </button>
                            )}
                          </div>
                          <p className="text-gray-600 leading-normal text-xs">{notif.message}</p>
                          <span className="text-xs text-gray-400 mt-1">
                            {notif.created_at ? new Date(notif.created_at).toLocaleString('vi-VN') : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/admin/profile"
              className="admin-header-profile flex items-center gap-3 border-l pl-5 cursor-pointer group hover:opacity-80 transition-all"
              title="Xem trang thông tin cá nhân"
            >
              <div className="admin-header-user-copy text-right">
                <p className="text-sm font-semibold group-hover:text-[#D4AF37] transition-colors">{user.name}</p>
                <p className="text-xs uppercase font-bold text-[#D4AF37]">{adminLabel(user.role, 'role')}</p>
              </div>
              {user.avatar_url ? (
                <Image
                  src={getAssetUrl(user.avatar_url) || ''}
                  alt={user.name}
                  width={40}
                  height={40}
                  unoptimized
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#D4AF37] shadow-xs group-hover:scale-105 transition-transform"
                />
              ) : (
                <UserCircle className="w-10 h-10 text-gray-400 group-hover:text-[#D4AF37] transition-colors" />
              )}
            </Link>
          </div>
        </header>

        <main className="admin-main">
          <section className="admin-content pb-16 lg:pb-0" data-admin-section={pageContext?.tone || 'overview'}>
            {showRouteFrame && pageContext && (
              <div className="admin-route-frame">
                <div className="admin-route-frame__signal" aria-hidden="true">
                  <span>Module</span>
                  <strong>{moduleNumber}</strong>
                  <i />
                </div>
                <div className="admin-route-frame__main">
                  <div className="admin-route-frame__crumbs">
                    <span>Maian Console</span>
                    <i aria-hidden="true" />
                    <strong>{pageContext.section}</strong>
                  </div>
                  <h1>{pageTitle}</h1>
                  <p>{pageContext.description}</p>
                  {quickLinks.length > 0 && (
                    <nav className="admin-route-frame__nav" aria-label={`Điều hướng nhanh ${pageContext.section}`}>
                      {quickLinks.map((link) => {
                        const isCurrent = link.href === '/admin/workspaces'
                          ? pathname === link.href
                          : pathname === link.href || pathname.startsWith(`${link.href}/`);
                        return (
                          <Link
                            key={link.href}
                            href={link.href}
                            aria-current={isCurrent ? 'page' : undefined}
                          >
                            <span>{link.label}</span>
                            <i aria-hidden="true">↗</i>
                          </Link>
                        );
                      })}
                    </nav>
                  )}
                </div>
                <aside className="admin-route-frame__meta" aria-label="Trạng thái module">
                  <span className="admin-route-frame__secure"><i /> Đang hoạt động</span>
                  <div>
                    <small>Không gian</small>
                    <strong>{pageContext.section}</strong>
                  </div>
                  <div>
                    <small>Quyền hiện tại</small>
                    <strong>{adminLabel(user.role, 'role')}</strong>
                  </div>
                  <p><i /> Kiểm soát truy cập đang bật</p>
                </aside>
              </div>
            )}
            <div className={`admin-route-body ${showRouteFrame ? 'admin-route-body--framed' : ''}`}>
              <AdminErrorBoundary>
                {children}
              </AdminErrorBoundary>
            </div>
          </section>
        </main>
      </div>

      {/* Thanh điều hướng dưới đáy dành riêng cho thiết bị di động */}
      <AdminBottomNav onOpenSidebar={() => setIsSidebarOpen(true)} />
    </div>
  );
}
