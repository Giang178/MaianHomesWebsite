'use client';

import {
  HelpCircle,
  Search,
  Shield,
  Users,
  X,
} from 'lucide-react';

interface AccountsFilterToolbarProps {
  activeTab: 'accounts' | 'matrix' | 'policy';
  setActiveTab: (tab: 'accounts' | 'matrix' | 'policy') => void;
  accountsCount: number;
  query: string;
  setQuery: (q: string) => void;
  roleFilter: string;
  setRoleFilter: (r: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  onClearFilters: () => void;
}

export default function AccountsFilterToolbar({
  activeTab,
  setActiveTab,
  accountsCount,
  query,
  setQuery,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  onClearFilters,
}: AccountsFilterToolbarProps) {
  const hasActiveFilters = query.trim() !== '' || roleFilter !== 'ALL' || statusFilter !== 'ALL';

  return (
    <div className="bg-white rounded-xl border border-[#E8E0D8] p-2.5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-[#2D1B14] text-[#F8F3ED] shadow-2xs font-bold'
              : 'text-gray-600 hover:bg-zinc-100 hover:text-[#2D1B14]'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Danh sách tài khoản</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'accounts' ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            {accountsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-[#2D1B14] text-[#F8F3ED] shadow-2xs font-bold'
              : 'text-gray-600 hover:bg-zinc-100 hover:text-[#2D1B14]'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Ma trận quyền & Vai trò</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'matrix' ? 'bg-amber-300/30 text-amber-200' : 'bg-amber-50 text-amber-800'
            }`}
          >
            59
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('policy')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'policy'
              ? 'bg-[#2D1B14] text-[#F8F3ED] shadow-2xs font-bold'
              : 'text-gray-600 hover:bg-zinc-100 hover:text-[#2D1B14]'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>Chính sách bảo mật</span>
        </button>
      </div>

      {/* Filter Toolbar (Visible only on Accounts Tab) */}
      {activeTab === 'accounts' && (
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm tên, email, SĐT..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/70 py-1.5 pl-8 pr-7 text-xs text-[#2D1B14] outline-none focus:border-[#D4AF37] focus:bg-white transition-all font-medium"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-2.5 py-1.5 text-xs text-[#2D1B14] font-medium outline-none focus:border-[#D4AF37] focus:bg-white cursor-pointer"
          >
            <option value="ALL">Mọi vai trò</option>
            <option value="CEO">CEO</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MARKETING">MARKETING</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-2.5 py-1.5 text-xs text-[#2D1B14] font-medium outline-none focus:border-[#D4AF37] focus:bg-white cursor-pointer"
          >
            <option value="ALL">Mọi trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="PENDING">Chờ cấp</option>
            <option value="LOCKED">Đã khóa</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline px-1 py-1 cursor-pointer"
              title="Xóa bộ lọc"
            >
              Xóa lọc
            </button>
          )}
        </div>
      )}
    </div>
  );
}
