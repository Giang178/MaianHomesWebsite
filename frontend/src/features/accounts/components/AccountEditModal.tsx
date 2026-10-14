'use client';

import React, { FormEvent } from 'react';
import Image from 'next/image';
import { Camera, RefreshCw, X } from 'lucide-react';
import type { AccountUser, UserRole } from '@/features/accounts/types';
import { getAssetUrl } from '@/lib/api';

interface AccountEditModalProps {
  editingAccount: AccountUser | null;
  accountDraft: {
    full_name: string;
    phone: string;
    role: UserRole;
  };
  setAccountDraft: React.Dispatch<
    React.SetStateAction<{
      full_name: string;
      phone: string;
      role: UserRole;
    }>
  >;
  avatarFile: File | null;
  avatarPreview: string | null;
  currentUserEmail?: string;
  canManagePermissions: boolean;
  busy: boolean;
  onClose: () => void;
  onSelectAvatar: (file?: File) => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}

export default function AccountEditModal({
  editingAccount,
  accountDraft,
  setAccountDraft,
  avatarFile,
  avatarPreview,
  currentUserEmail,
  canManagePermissions,
  busy,
  onClose,
  onSelectAvatar,
  onSubmit,
}: AccountEditModalProps) {
  if (!editingAccount) return null;

  const isProtected =
    editingAccount.role === 'CEO' || editingAccount.email === currentUserEmail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-2xs">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-[#E8E0D8] bg-white p-5 shadow-2xl space-y-4 text-[#2D1B14]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-[#2D1B14]">Sửa tài khoản</h2>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">{editingAccount.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-zinc-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Avatar Uploader */}
        <div className="flex items-center gap-3.5 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-[#D4AF37] bg-white shadow-2xs">
            {avatarPreview || editingAccount.avatar_url ? (
              <Image
                src={avatarPreview || getAssetUrl(editingAccount.avatar_url) || ''}
                alt={editingAccount.full_name}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-[#AA820A] bg-amber-50">
                {editingAccount.full_name ? editingAccount.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
          </div>

          <div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D4AF37]/50 bg-white px-3 py-1.5 text-xs font-bold text-[#AA820A] hover:bg-amber-50 transition-colors shadow-2xs">
              <Camera className="h-3.5 w-3.5" />
              <span>{avatarFile ? 'Đổi ảnh khác' : 'Tải ảnh đại diện'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onSelectAvatar(e.target.files?.[0])}
              />
            </label>
            <span className="block text-[10px] text-gray-400 mt-1 font-medium">
              JPEG, PNG, WebP · Tối đa 5 MB
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1 text-xs font-semibold text-gray-700">
            <span>Họ và tên *</span>
            <input
              required
              maxLength={200}
              value={accountDraft.full_name}
              onChange={(e) =>
                setAccountDraft((prev) => ({ ...prev, full_name: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-[#2D1B14] outline-none focus:border-[#D4AF37] focus:bg-white font-medium"
            />
          </label>

          <label className="block space-y-1 text-xs font-semibold text-gray-700">
            <span>Số điện thoại</span>
            <input
              type="tel"
              maxLength={50}
              value={accountDraft.phone}
              onChange={(e) =>
                setAccountDraft((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="0901234567"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-[#2D1B14] outline-none focus:border-[#D4AF37] focus:bg-white font-medium"
            />
          </label>

          {/* Role Selector in Edit Info */}
          <label className="block space-y-1 text-xs font-semibold text-gray-700">
            <span>Vai trò tài khoản</span>
            {isProtected || !canManagePermissions ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs text-gray-600 font-medium">
                {editingAccount.role} (Được bảo vệ - không thể đổi)
              </div>
            ) : (
              <select
                value={accountDraft.role}
                onChange={(e) =>
                  setAccountDraft((prev) => ({ ...prev, role: e.target.value as UserRole }))
                }
                className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-[#2D1B14] font-medium outline-none focus:border-[#D4AF37] focus:bg-white cursor-pointer"
              >
                <option value="MARKETING">MARKETING (Biên tập viên)</option>
                <option value="ADMIN">ADMIN (Quản trị viên toàn hệ thống)</option>
              </select>
            )}
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-zinc-100 cursor-pointer"
          >
            Hủy
          </button>
          <button
            disabled={busy}
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#C5A059] px-5 py-2 text-xs font-bold text-white shadow-2xs hover:brightness-105 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
            <span>Lưu thay đổi</span>
          </button>
        </div>
      </form>
    </div>
  );
}
