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

interface AccountsCardGridProps {
  accounts: AccountUser[];
  currentUserEmail?: string;
  currentUserRole?: string;
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

export default function AccountsCardGrid({
  accounts,
  currentUserEmail,
  currentUserRole,
  busyId,
  canUpdate,
  canManagePermissions,
  canDisable,
  onOpenEdit,
  onOpenPermissions,
  onIssueAccount,
  onRevokeSessions,
  onToggleLock,
}: AccountsCardGridProps) {
  const containerClassName = 'md:hidden space-y-3';

  if (accounts.length === 0) {
    return (
      <div className={containerClassName}>
        <div className="bg-white rounded-xl border border-[#E8E0D8] p-8 text-center text-gray-500 font-medium col-span-full">
          Không tìm thấy tài khoản nào phù hợp.
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {accounts.map((account) => {
        const protectedAccount = account.role === 'CEO' || account.email === currentUserEmail;
        const pending = account.status === 'PENDING_SETUP';
        const isActive = account.status === 'ACTIVE' && account.is_active;
        const isSelf = account.email === currentUserEmail;
        const canEditThisAccount = canUpdate && ['CEO', 'ADMIN'].includes(currentUserRole || '');

        return (
          <div
            key={account.id}
            className="rounded-xl border border-[#E8E0D8] bg-white p-4 shadow-2xs hover:shadow-card hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between"
          >
            <div>
              {/* Card Header: Avatar, Name, Email, Role */}
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#D4AF37]/60 bg-[#2D1B14]/5 shadow-2xs">
                    {account.avatar_url ? (
                      <Image
                        src={getAssetUrl(account.avatar_url) || ''}
                        alt={account.full_name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-[#AA820A] bg-amber-50">
                        {account.full_name ? account.full_name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#2D1B14] flex items-center gap-1.5 leading-snug">
                      <span className="truncate">{account.full_name}</span>
                      {isSelf && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#D4AF37]/20 text-[#AA820A] border border-[#D4AF37]/30 shrink-0">
                          Bạn
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate mt-0.5">{account.email}</div>
                  </div>
                </div>

                {/* Role Badge */}
                <div className="shrink-0">
                  {account.role === 'CEO' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow-2xs">
                      <Sparkles className="h-2.5 w-2.5 text-amber-600" />
                      CEO
                    </span>
                  ) : account.role === 'ADMIN' ? (
                    <button
                      type="button"
                      onClick={() => onOpenPermissions(account)}
                      title={protectedAccount ? 'Vai trò ADMIN' : 'Bấm để đổi vai trò hoặc điều chỉnh quyền'}
                      className={`inline-flex items-center gap-1 rounded-full border border-[#2D1B14] bg-[#2D1B14] px-2 py-0.5 text-[10px] font-bold text-[#F3E6C6] transition-transform ${
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
                      className={`inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800 transition-transform ${
                        !protectedAccount ? 'hover:scale-105 hover:border-blue-400 cursor-pointer shadow-2xs' : 'cursor-default'
                      }`}
                    >
                      <Shield className="h-2.5 w-2.5 text-blue-600" />
                      MARKETING
                    </button>
                  )}
                </div>
              </div>

              {/* Card Meta details */}
              <div className="mt-3.5 space-y-1.5 rounded-lg bg-zinc-50/70 p-2.5 text-xs border border-zinc-100">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Trạng thái:</span>
                  {pending ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                      <Clock className="w-3 h-3 text-amber-600" />
                      Chờ cấp
                    </span>
                  ) : isActive ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Hoạt động
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                      <Lock className="w-3 h-3 text-rose-600" />
                      Đã khóa
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Quyền hạn:</span>
                  <span className="font-semibold text-[#2D1B14] text-[11px]">
                    {account.permissions.includes('*') ? 'Toàn quyền (*)' : `${account.permissions.length} quyền`}
                  </span>
                </div>

                {account.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 font-medium">Điện thoại:</span>
                    <span className="text-gray-700 font-medium text-[11px]">{account.phone}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-gray-500 font-medium">Đăng nhập:</span>
                  <span className="text-gray-600 text-[11px]">{formatDate(account.last_login_at)}</span>
                </div>
              </div>
            </div>

            {/* Card Actions Footer */}
            <div className="mt-3.5 border-t border-zinc-100 pt-2.5 flex items-center justify-end gap-1.5">
              {pending && canUpdate && (
                <button
                  type="button"
                  disabled={busyId === account.id}
                  onClick={() => onIssueAccount(account)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D4AF37] text-white text-[11px] font-bold hover:brightness-105 active:scale-95 cursor-pointer shadow-2xs"
                  title="Gửi thư kích hoạt tài khoản"
                >
                  <KeyRound className="h-3 w-3" />
                  <span>Cấp TK</span>
                </button>
              )}

              {canEditThisAccount && (
                <button
                  type="button"
                  disabled={busyId === account.id}
                  onClick={() => onOpenEdit(account)}
                  className="p-1.5 rounded-lg border border-zinc-200 hover:border-[#D4AF37] bg-white text-gray-600 hover:text-[#AA820A] cursor-pointer shadow-2xs"
                  title="Sửa thông tin & vai trò"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}

              {account.role !== 'CEO' && canManagePermissions && (
                <button
                  type="button"
                  disabled={busyId === account.id}
                  onClick={() => onOpenPermissions(account)}
                  className="p-1.5 rounded-lg border border-zinc-200 hover:border-[#D4AF37] bg-white text-gray-600 hover:text-[#AA820A] cursor-pointer shadow-2xs"
                  title="Phân quyền & Thay đổi vai trò"
                >
                  <Shield className="h-3.5 w-3.5" />
                </button>
              )}

              {!pending && !protectedAccount && canDisable && (
                <button
                  type="button"
                  disabled={busyId === account.id}
                  onClick={() => onRevokeSessions(account)}
                  className="p-1.5 rounded-lg border border-zinc-200 text-gray-500 hover:text-gray-800 bg-white cursor-pointer shadow-2xs"
                  title="Thu hồi phiên"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}

              {!protectedAccount && !pending && canDisable && (
                <button
                  type="button"
                  disabled={busyId === account.id}
                  onClick={() => onToggleLock(account)}
                  className={`p-1.5 rounded-lg border cursor-pointer shadow-2xs transition-colors ${
                    account.status === 'LOCKED'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                  title={account.status === 'LOCKED' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                >
                  {account.status === 'LOCKED' ? (
                    <Unlock className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
