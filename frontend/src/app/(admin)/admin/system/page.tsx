'use client';

import { useState } from 'react';
import { Activity, Mail, Server } from 'lucide-react';
import { MonitoringPanel } from '@/features/website/admin/system/MonitoringPanel';
import { CompanyEmailPanel } from '@/features/website/admin/system/CompanyEmailPanel';
import { usePermissions } from '@/lib/use-permissions';

type TabView = 'all' | 'monitoring' | 'email';

export default function SystemMonitoringPage() {
  const { can } = usePermissions();
  const canReadMonitoring = can('website.system.monitoring.read');
  const canReadEmail = can('website.system.email.read');
  const [activeTab, setActiveTab] = useState<TabView>('all');

  return (
    <main className="admin-module-page admin-module-page--system space-y-3 sm:space-y-3.5 lg:space-y-4 p-3 sm:p-4 lg:p-5 2xl:p-6 text-[#2D1B14] min-h-screen bg-slate-50/60">
      {/* 1. Executive Luxury Header - Responsive & Compact */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-white p-3 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border border-[#E8E0D8] shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-xl bg-[#2D1B14] text-[#D4AF37] shadow-2xs">
            <Server className="h-4 w-4 lg:h-4.5 lg:w-4.5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg lg:text-xl 2xl:text-2xl font-bold font-serif text-[#2D1B14] tracking-tight">
                Giám Sát Hệ Thống & Hạ Tầng Kỹ Thuật
              </h1>
              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                v1.2.0 • Live
              </span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-[#6B5E55] max-w-2xl font-light line-clamp-1 sm:line-clamp-none">
              Theo dõi sức khỏe website thời gian thực, độ trễ API, kết nối cơ sở dữ liệu và cấu hình email công ty.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
          {/* Segmented Tab Navigation - Compact */}
          <div className="inline-flex rounded-xl bg-[#FAF8F5] p-1 border border-[#E8E0D8] shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-lg px-2.5 py-1 text-[11px] lg:text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
                  : 'text-[#6B5E55] hover:text-[#2D1B14] hover:bg-white'
              }`}
            >
              Tất cả
            </button>
            {canReadMonitoring && (
              <button
                type="button"
                onClick={() => setActiveTab('monitoring')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] lg:text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'monitoring'
                    ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
                    : 'text-[#6B5E55] hover:text-[#2D1B14] hover:bg-white'
                }`}
              >
                <Activity className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                <span>Sức khỏe dịch vụ</span>
              </button>
            )}
            {canReadEmail && (
              <button
                type="button"
                onClick={() => setActiveTab('email')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] lg:text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'email'
                    ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
                    : 'text-[#6B5E55] hover:text-[#2D1B14] hover:bg-white'
                }`}
              >
                <Mail className="w-3 h-3 lg:w-3.5 lg:h-3.5" />
                <span>Email SMTP</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Panels rendering based on tab and permissions */}
      {canReadMonitoring && (activeTab === 'all' || activeTab === 'monitoring') && (
        <MonitoringPanel />
      )}
      {canReadEmail && (activeTab === 'all' || activeTab === 'email') && (
        <CompanyEmailPanel />
      )}
      {!canReadMonitoring && !canReadEmail && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900 shadow-2xs">
          Tài khoản hiện tại chưa được cấp quyền truy cập xem thông tin giám sát hệ thống.
        </div>
      )}
    </main>
  );
}
