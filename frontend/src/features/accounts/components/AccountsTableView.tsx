'use client';

import Image from 'next/image';
import {
  Clock,
  KeyRound,
  Lock,
  Pencil,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Unlock,
} from 'lucide-react';
import type { AccountUser } from '@/features/accounts/types';
import { getAssetUrl } from '@/lib/api';
import { formatDate } from '../constants';

interface AccountsTableViewProps {
  accounts: AccountUser[];
  currentUserEmail?: string;
  currentUserRole?: string;
  loading: boolean;
  busyId: string | null;
  canUpdate: boolean;
  canManagePermissions: boolean;
  canDisable: boolean;
  onOpenEdit: (account: AccountUser) => void;
  onOpenPermissions: (account: AccountUser) => void;
  onIssueAccount: (account: AccountUser) => void;
  onRevokeSessions: (account: AccountUser) => void;
  onToggleLock: (account: AccountUser) => void;
}

export default function AccountsTableView({
  accounts,
  currentUserEmail,
  currentUserRole,
  loading,
  busyId,
  canUpdate,
  canManagePermissions,
  canDisable,
  onOpenEdit,
  onOpenPermissions,
  onIssueAccount,
  onRevokeSessions,
  onToggleLock,
}: AccountsTableViewProps) {
  return (
    <div className="hidden md:block overflow-x-auto rounded-xl border border-[#E8E0D8] bg-white shadow-2xs">
      <table className="w-full min-w-[880px] text-left text-xs">
        <thead className="border-b border-[#E8E0D8] bg-zinc-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          <tr>
            <th className="py-3 px-4">Người dùng / Tài khoản</th>
            <th className="py-3 px-3">Vai trò</th>
            <th className="py-3 px-3">Trạng thái</th>
            <th className="py-3 px-3">Quyền hạn</th>
            <th className="py-3 px-3">Đăng nhập cuối</th>
            <th className="py-3 px-4 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E8E0D8]/60">
          {loading ? (
            <tr>
              <td colSpan={6} className="py-12 text-center text-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#C5A059]" />
                  <span className="font-medium text-xs text-gray-600">Đang tải danh sách tài khoản...</span>
                </div>
              </td>
            </tr>
          ) : accounts.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-12 text-center text-gray-500 font-medium">
                Không tìm thấy tài khoản phù hợp với bộ lọc tìm kiếm.
              </td>
            </tr>
          ) : (
            accounts.map((account) => {
              const protectedAccount = account.role === 'CEO' || account.email === currentUserEmail;
              const pending = account.status === 'PENDING_SETUP';
              const isActive = account.status === 'ACTIVE' && account.is_active;
              const isSelf = account.email === currentUserEmail;
              const canEditThisAccount = canUpdate && ['CEO', 'ADMIN'].includes(currentUserRole || '');

              return (
                <tr key={account.id} className="hover:bg-zinc-50/80 transition-colors">
                  {/* Identity: Avatar + Name + Email */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-9 shrink-0 overflow-hidden rounded-full border border-[#D4AF37]/50 bg-[#2D1B14]/5 shadow-2xs">
                        {account.avatar_url ? (
                          <Image
                            src={getAssetUrl(account.avatar_url) || ''}
                            alt={account.full_name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[#AA820A] bg-amber-50">
                            {account.full_name ? account.full_name.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#2D1B14] flex items-center gap-1.5 leading-snug">
                          <span className="truncate">{account.full_name}</span>
                          {isSelf && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#D4AF37]/20 text-[#AA820A] border border-[#D4AF37]/30">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate mt-0.5">
                          <span className="truncate">{account.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role Badge */}
                  <td className="py-3 px-3">
                    {account.role === 'CEO' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 shadow-2xs">
                        <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                        CEO
                      </span>
                    ) : account.role === 'ADMIN' ? (
                      <button
                        type="button"
                        onClick={() => onOpenPermissions(account)}
                        title={protectedAccount ? 'Vai trò ADMIN' : 'Bấm để đổi vai trò hoặc điều chỉnh quyền'}
                        className={`inline-flex items-center gap-1 rounded-full border border-[#2D1B14] bg-[#2D1B14] px-2.5 py-0.5 text-[10px] font-bold text-[#F3E6C6] transition-all ${
                          !protectedAccount ? 'hover:scale-105 hover:border-[#D4AF37] cursor-pointer shadow-2xs' : 'cursor-default'
                        }`}
                      >
                        <ShieldCheck className="h-2.5 w-2.5 text-[#D4AF37]" />
                        ADMIN
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenPermissions(account)}
                        title={protectedAccount ? 'Vai trò MARKETING' : 'Bấm để đổi vai trò hoặc điều chỉnh quyền'}
                        className={`inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-800 transition-all ${
                          !protectedAccount ? 'hover:scale-105 hover:border-blue-400 cursor-pointer shadow-2xs' : 'cursor-default'
                        }`}
                      >
                        <Shield className="h-2.5 w-2.5 text-blue-600" />
                        MARKETING
                      </button>
                    )}
                  </td>

                  {/* Account Status */}
                  <td className="py-3 px-3">
                    {pending ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Chờ cấp
                      </span>
                    ) : isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <Lock className="w-3 h-3 text-rose-600" />
                        Đã khóa
                      </span>
                    )}
                  </td>

                  {/* Permissions Count */}
                  <td className="py-3 px-3">
                    {account.permissions.includes('*') ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        <Sparkles className="w-3 h-3 text-emerald-600" />
                        Toàn quyền (*)
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenPermissions(account)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-700 hover:text-[#AA820A] bg-zinc-100 hover:bg-amber-50 border border-zinc-200 hover:border-amber-300 px-2 py-0.5 rounded transition-colors cursor-pointer"
                        title="Bấm để chỉnh sửa quyền hạn hoặc vai trò"
                      >
                        <Shield className="w-3 h-3 text-[#C5A059]" />
                        <span>{account.permissions.length} quyền</span>
                      </button>
                    )}
                  </td>

                  {/* Last Login */}
                  <td className="py-3 px-3 text-[11px] text-gray-500 whitespace-nowrap">
                    {formatDate(account.last_login_at)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Issue Account Button */}
                      {pending && canUpdate && (
                        <button
                          type="button"
                          disabled={busyId === account.id}
                          onClick={() => onIssueAccount(account)}
                          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#C5A059] px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:brightness-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                          title="Gửi thư kích hoạt tài khoản"
                        >
                          <KeyRound className="h-3 w-3" />
                          <span>Cấp TK</span>
                        </button>
                      )}

                      {/* Edit Info Button */}
                      {canEditThisAccount && (
                        <button
                          type="button"
                          disabled={busyId === account.id}
                          onClick={() => onOpenEdit(account)}
                          title="Sửa thông tin tài khoản & vai trò"
                          className="p-1.5 rounded-lg border border-zinc-200 hover:border-[#D4AF37] bg-white hover:bg-amber-50 text-gray-600 hover:text-[#AA820A] transition-colors cursor-pointer shadow-2xs"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Manage Permissions Button */}
                      {account.role !== 'CEO' && canManagePermissions && (
                        <button
                          type="button"
                          disabled={busyId === account.id}
                          onClick={() => onOpenPermissions(account)}
                          title="Phân quyền & Đổi vai trò"
                          className="p-1.5 rounded-lg border border-zinc-200 hover:border-[#D4AF37] bg-white hover:bg-amber-50 text-gray-600 hover:text-[#AA820A] transition-colors cursor-pointer shadow-2xs"
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Revoke Sessions Button */}
                      {!pending && !protectedAccount && canDisable && (
                        <button
                          type="button"
                          disabled={busyId === account.id}
                          onClick={() => onRevokeSessions(account)}
                          title="Thu hồi toàn bộ phiên làm việc"
                          className="p-1.5 rounded-lg border border-zinc-200 hover:border-zinc-300 bg-white text-gray-500 hover:text-gray-800 transition-colors cursor-pointer shadow-2xs"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* Lock / Unlock Toggle Button */}
                      {!protectedAccount && !pending && canDisable && (
                        <button
                          type="button"
                          disabled={busyId === account.id}
                          onClick={() => onToggleLock(account)}
                          title={account.status === 'LOCKED' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer shadow-2xs ${
                            account.status === 'LOCKED'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          {account.status === 'LOCKED' ? (
                            <Unlock className="h-3.5 w-3.5" />
                          ) : (
                            <Lock className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
