'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Database,
  MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isAdminPathAllowed } from '@/lib/admin-access';

interface AdminBottomNavProps {
  onOpenSidebar: () => void;
}

export default function AdminBottomNav({ onOpenSidebar }: AdminBottomNavProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const allowedPaths = user.allowed_paths || [];
  const canAccess = (path: string) => isAdminPathAllowed(allowedPaths, path);

  const navItems = [
    { name: 'Tổng quan', href: '/admin', icon: LayoutDashboard },
    { name: 'Dự án', href: '/admin/projects', icon: Building2 },
    { name: 'Khách hàng', href: '/admin/leads', icon: Database },
  ].filter((item) => canAccess(item.href));

  const isActive = (href: string) =>
    href === '/admin' ? pathname === href : pathname.startsWith(href);

  return (
    <nav
      className="admin-bottom-nav sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] safe-area-pb"
      aria-label="Thanh điều hướng dưới màn hình di động"
    >
      <div className="flex items-center justify-around max-w-md mx-auto h-14">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all rounded-lg select-none ${
                active
                  ? 'text-red-600 font-bold'
                  : 'text-slate-600 hover:text-red-600 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`} />
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">{item.name}</span>
            </Link>
          );
        })}

        {/* Nút Xem thêm tính năng mở Sidebar */}
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex flex-col items-center justify-center flex-1 py-1 text-slate-600 hover:text-red-600 hover:bg-slate-50 transition-all rounded-lg cursor-pointer select-none"
          aria-label="Xem thêm tính năng"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Thêm</span>
        </button>
      </div>
    </nav>
  );
}
