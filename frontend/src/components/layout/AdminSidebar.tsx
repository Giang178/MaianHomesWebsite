'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  LayoutDashboard,
  Layers,
  LogOut,
  ShieldCheck,
  HeartPulse,
  Sparkles,
  UserRound,
  Sliders,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isAdminPathAllowed } from '@/lib/admin-access';

interface AdminSidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isMini: boolean;
  setIsMini: (isMini: boolean) => void;
}

const navItems = [
  { name: 'Tổng quan', href: '/admin', icon: LayoutDashboard },
  { name: 'Tài khoản & quyền', href: '/admin/accounts', icon: ShieldCheck },
  { name: 'Nội dung trang', href: '/admin/content', icon: FileText },
  { name: 'Kho tri thức AI', href: '/admin/content/company', icon: Sparkles },
  { name: 'Thương hiệu & Footer', href: '/admin/branding', icon: Sliders },
  { name: 'Dự án', href: '/admin/projects', icon: Building2 },
  { name: 'Dịch vụ', href: '/admin/workspaces', icon: Layers },
  { name: 'Đội ngũ công khai', href: '/admin/team', icon: UserRound },
  { name: 'Tuyển dụng', href: '/admin/recruitment', icon: BriefcaseBusiness },
  { name: 'Khách hàng', href: '/admin/leads', icon: Database },
  { name: 'Thống kê', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Giám sát hệ thống', href: '/admin/system', icon: HeartPulse },
];

export default function AdminSidebar({ isOpen, setIsOpen, isMini, setIsMini }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const visibleItems = navItems.filter((item) =>
    isAdminPathAllowed(user.allowed_paths || [], item.href),
  );
  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    if (pathname === href) return true;
    if (href === '/admin/content') return pathname === '/admin/content';
    return pathname.startsWith(`${href}/`);
  };

  const toggleMini = () => {
    const value = !isMini;
    setIsMini(value);
    localStorage.setItem('adminSidebarMini', String(value));
  };

  return (
    <>
      {isOpen && <div className="admin-sidebar-backdrop lg:hidden" onClick={() => setIsOpen(false)} />}
      <aside
        className={`admin-sidebar flex flex-col fixed inset-y-0 left-0 z-50 transform transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isMini ? 'lg:w-[80px]' : 'w-[280px] lg:w-[244px] xl:w-[260px] 2xl:w-[280px]'}`}
      >
        <button
          onClick={toggleMini}
          className="admin-sidebar-toggle hidden lg:flex items-center justify-center absolute -right-3 top-6 p-1.5 rounded-full z-10 transition-colors cursor-pointer"
          aria-label="Thu gọn menu"
        >
          {isMini ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
        <div className={`admin-sidebar-brand ${isMini ? 'hidden' : ''}`}>
          <Link href="/admin" onClick={() => setIsOpen(false)} className="admin-sidebar-brand-link">
            <Image
              src="/images/minilogo.png"
              alt="Logo quản trị Maian Homes"
              width={44}
              height={44}
              priority
              className="admin-sidebar-brand-logo"
            />
            <span className="admin-sidebar-brand-copy">
              <strong>MAIAN HOMES</strong>
              <small>Management Console</small>
            </span>
          </Link>
        </div>
        {isMini && (
          <div className="admin-sidebar-brand admin-sidebar-brand--mini">
            <Link href="/admin" onClick={() => setIsOpen(false)} className="flex items-center justify-center">
              <Image
                src="/images/minilogo.png"
                alt="Biểu trưng Maian Homes thu nhỏ"
                width={36}
                height={36}
                className="h-8 w-auto object-contain"
              />
            </Link>
          </div>
        )}
        <nav className="admin-sidebar-nav flex-1 overflow-y-auto py-4 space-y-1">
          {!isMini && <p className="admin-sidebar-section-label">Khu vực quản trị</p>}
          {visibleItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={`${item.href}-${item.name}`}
                href={item.href}
                onClick={() => setIsOpen(false)}
                title={item.name}
                className={`admin-sidebar-link group flex items-center px-2.5 xl:px-3 2xl:px-3.5 mx-1.5 xl:mx-2 2xl:mx-3 py-1.5 xl:py-2 rounded-xl font-medium text-[11px] xl:text-xs 2xl:text-[13px] transition-all duration-200 ${
                  active
                    ? 'admin-sidebar-link--active font-bold'
                    : ''
                } ${isMini ? 'justify-center mx-2 px-0' : ''}`}
              >
                <item.icon
                  className={`shrink-0 transition-colors ${
                    active ? 'admin-sidebar-icon--active' : 'admin-sidebar-icon'
                  } ${isMini ? 'w-4.5 h-4.5' : 'w-3.5 h-3.5 xl:w-4 xl:h-4 mr-2 xl:mr-2.5 2xl:mr-3'}`}
                />
                {!isMini && <span className="truncate tracking-tight min-w-0">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          {!isMini && (
            <div className="admin-sidebar-user">
              <span className="admin-sidebar-user-avatar">{user.name?.charAt(0).toUpperCase() || 'M'}</span>
              <span className="min-w-0">
                <strong className="block truncate">{user.name}</strong>
                <small className="block truncate">{user.role}</small>
              </span>
            </div>
          )}
          <button
            onClick={logout}
            className={`admin-sidebar-logout w-full flex items-center px-3 xl:px-4 py-1.5 xl:py-2 rounded-xl text-xs xl:text-[13px] font-medium transition-colors cursor-pointer ${
              isMini ? 'justify-center px-0' : ''
            }`}
            title={isMini ? 'Đăng xuất' : undefined}
          >
            <LogOut className={`shrink-0 ${isMini ? 'w-4.5 h-4.5' : 'w-4 h-4 mr-2 xl:mr-3'}`} />
            {!isMini && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
