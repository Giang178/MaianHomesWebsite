'use client';

import {
  Clock,
  Lock,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';

interface StatsProps {
  total: number;
  active: number;
  pending: number;
  locked: number;
  ceoCount: number;
  adminCount: number;
  marketingCount: number;
}

interface AccountsHeaderProps {
  stats: StatsProps;
  statusFilter: string;
  setStatusFilter: (filter: string) => void;
  setActiveTab: (tab: 'accounts' | 'matrix' | 'policy') => void;
  loading: boolean;
  onRefresh: () => void;
  canCreate: boolean;
  onOpenCreate: () => void;
}

export default function AccountsHeader({
  stats,
  statusFilter,
  setStatusFilter,
  setActiveTab,
  loading,
  onRefresh,
  canCreate,
  onOpenCreate,
}: AccountsHeaderProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E8E0D8] px-4 py-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
      {/* Left: Title + Inline Metrics */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50 text-[#C5A059] border border-amber-200/80 shadow-2xs">
            <ShieldCheck className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-[#2D1B14] leading-none">
                Tài khoản & Phân quyền
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D4AF37]/15 text-[#AA820A] border border-[#D4AF37]/30 uppercase tracking-wide">
                RBAC
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 hidden sm:block">
              Quản trị danh tính, vai trò và phân quyền hoạt động website
            </p>
          </div>
        </div>

        <div className="hidden lg:block h-7 w-px bg-zinc-200" />

        {/* Quick Metrics Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 font-semibold text-zinc-700">
            <Users className="w-3.5 h-3.5 text-zinc-500" />
            Tổng: <span className="font-bold text-[#2D1B14]">{stats.total}</span>
          </span>

          <button
            type="button"
            onClick={() => {
              setActiveTab('accounts');
              setStatusFilter(statusFilter === 'ACTIVE' ? 'ALL' : 'ACTIVE');
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold shadow-2xs'
                : 'bg-emerald-50/70 border-emerald-200/70 text-emerald-800 hover:bg-emerald-100'
            }`}
            title="Lọc tài khoản đang hoạt động"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{stats.active} Hoạt động</span>
          </button>

          {stats.pending > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('accounts');
                setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING');
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                statusFilter === 'PENDING'
                  ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold shadow-2xs'
                  : 'bg-amber-50/80 border-amber-200 text-amber-800 hover:bg-amber-100'
              }`}
              title="Lọc tài khoản chờ cấp"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>{stats.pending} Chờ cấp</span>
            </button>
          )}

          {stats.locked > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('accounts');
                setStatusFilter(statusFilter === 'LOCKED' ? 'ALL' : 'LOCKED');
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                statusFilter === 'LOCKED'
                  ? 'bg-rose-100 border-rose-300 text-rose-900 font-bold shadow-2xs'
                  : 'bg-rose-50/70 border-rose-200 text-rose-800 hover:bg-rose-100'
              }`}
              title="Lọc tài khoản tạm khóa"
            >
              <Lock className="w-3 h-3 text-rose-600" />
              <span>{stats.locked} Đã khóa</span>
            </button>
          )}

          <span className="hidden xl:inline-flex text-[11px] text-gray-500 pl-1 font-medium">
            ({stats.ceoCount} CEO · {stats.adminCount} Admin · {stats.marketingCount} Mkt)
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 text-xs font-medium transition-colors shadow-2xs hover:border-[#D4AF37] cursor-pointer"
          title="Làm mới dữ liệu"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#C5A059]' : ''}`} />
        </button>

        {canCreate && (
          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#C5A059] text-white text-xs font-bold shadow-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tạo hồ sơ mới</span>
          </button>
        )}
      </div>
    </div>
  );
}
