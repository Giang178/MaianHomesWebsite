import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Building2, ExternalLink } from 'lucide-react';
import OfficeGradesAdminTab from '@/features/workspaces/admin/OfficeGradesAdminTab';

export const metadata: Metadata = {
  title: 'Thiết Lập Trang Phân Hạng A, B, C | Maian Homes Admin',
  description: 'Quản trị độc lập hình ảnh banner, tiêu chuẩn kỹ thuật, đối tượng và FAQs cho từng trang Hạng A, B, C.',
};

export default function WorkspaceGradesPage() {
  return (
    <div className="admin-module-page admin-module-page--workspace-grades min-h-screen bg-zinc-50 p-6 sm:p-8 space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/workspaces"
            className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">Workspace Solutions / Maian Office</span>
              <span className="text-zinc-300">/</span>
              <span className="text-xs font-bold text-zinc-700">Trang Phân Hạng A - B - C</span>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 mt-0.5">
              Cấu hình Trang Chi Tiết Từng Hạng A - B - C
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dich-vu-cho-thue/office/hang-a"
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 text-xs font-medium hover:bg-zinc-100 transition-colors shadow-sm"
          >
            <Building2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            Xem live /hang-a <ExternalLink className="w-3 h-3 text-zinc-400" />
          </Link>
        </div>
      </div>

      <OfficeGradesAdminTab />
    </div>
  );
}
