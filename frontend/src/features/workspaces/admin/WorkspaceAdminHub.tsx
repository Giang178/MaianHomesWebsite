'use client';

import { useState } from 'react';
import { usePermissions } from '@/lib/use-permissions';
import Link from 'next/link';
import { CoworkingAdminTab } from './CoworkingAdminTab';
import { OfficeAdminTab } from './OfficeAdminTab';
import { SeoGeoAuditTab } from './SeoGeoAuditTab';
import {
  Briefcase,
  Building2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface WorkspaceAdminHubProps {
  initialTab?: 'coworking' | 'office' | 'seo-geo';
}

export function WorkspaceAdminHub({ initialTab = 'coworking' }: WorkspaceAdminHubProps) {
  const { canAny } = usePermissions();
  const canManage = canAny('website.workspaces.update', 'website.workspaces.publish', 'website.workspaces.delete');
  const [activeTab, setActiveTab] = useState<'coworking' | 'office' | 'seo-geo'>(initialTab);

  return (
    <div className="admin-module-page admin-module-page--workspaces min-h-screen bg-[#FDFBF7] p-4 sm:p-6 xl:p-8 space-y-6 text-[#2D1B14]">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-[#E8E0D8] px-5 py-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#FAF6F0] text-[#C5A059] border border-[#E8E0D8] shadow-2xs">
            <Briefcase className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#2D1B14] leading-none">
                Quản trị Dịch vụ & Không gian Cho thuê
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D4AF37]/15 text-[#AA820A] border border-[#D4AF37]/30 uppercase tracking-wide">
                WORKSPACES & LEASING
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Điều hành nội dung, gói cước, mặt bằng và dữ liệu vận hành dịch vụ cho thuê Maian Homes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dich-vu-cho-thue/coworking"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E8E0D8] text-stone-700 text-xs font-semibold hover:border-[#C5A059] hover:text-[#C5A059] transition shadow-2xs"
          >
            <Briefcase className="w-3.5 h-3.5 text-[#C5A059]" />
            Xem Co-working live <ExternalLink className="w-3 h-3 text-stone-400" />
          </Link>
          <Link
            href="/dich-vu-cho-thue/office"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E8E0D8] text-stone-700 text-xs font-semibold hover:border-[#C5A059] hover:text-[#C5A059] transition shadow-2xs"
          >
            <Building2 className="w-3.5 h-3.5 text-[#C5A059]" />
            Xem Maian Office live <ExternalLink className="w-3 h-3 text-stone-400" />
          </Link>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-[#E8E0D8] shadow-2xs overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('coworking')}
          className={`flex items-center gap-1.5 xl:gap-2 px-3.5 py-2 rounded-xl text-xs xl:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'coworking'
              ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
              : 'text-stone-600 hover:bg-[#FAF8F5] hover:text-[#2D1B14]'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-[#C5A059]" />
          Co-working Space
        </button>

        <button
          onClick={() => setActiveTab('office')}
          className={`flex items-center gap-1.5 xl:gap-2 px-3.5 py-2 rounded-xl text-xs xl:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'office'
              ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
              : 'text-stone-600 hover:bg-[#FAF8F5] hover:text-[#2D1B14]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-[#C5A059]" />
          Maian Office
        </button>

        <button
          onClick={() => setActiveTab('seo-geo')}
          className={`flex items-center gap-1.5 xl:gap-2 px-3.5 py-2 rounded-xl text-xs xl:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'seo-geo'
              ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
              : 'text-stone-600 hover:bg-[#FAF8F5] hover:text-[#2D1B14]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 xl:w-4 xl:h-4 text-[#C5A059]" />
          Kiểm toán SEO / GEO
        </button>
      </div>

      {!canManage && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs font-semibold text-blue-900">
          Chế độ chỉ xem — tài khoản chưa được cấp quyền thay đổi dữ liệu dịch vụ.
        </div>
      )}
      <fieldset disabled={!canManage} className="min-w-0 space-y-6 disabled:opacity-80">
        {/* Tab 2: Co-working Space */}
        {activeTab === 'coworking' && <CoworkingAdminTab />}

        {/* Tab 3: Office Leasing */}
        {activeTab === 'office' && <OfficeAdminTab />}

        {/* Tab 4: SEO / GEO Audit */}
        {activeTab === 'seo-geo' && <SeoGeoAuditTab />}
      </fieldset>
    </div>
  );
}
