'use client';

import React, { FormEvent } from 'react';
import { RefreshCw, UserPlus, X } from 'lucide-react';
import type { UserRole } from '@/features/accounts/types';
import {
  PERMISSION_GROUPS,
  permissionAllowedForRole,
  permissionLabel,
} from '../constants';

interface AccountCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: {
    email: string;
    full_name: string;
    phone: string;
    role: UserRole;
    permissions: string[];
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      email: string;
      full_name: string;
      phone: string;
      role: UserRole;
      permissions: string[];
    }>
  >;
  presets: Record<'ADMIN' | 'MARKETING', string[]>;
  onSubmit: (event: FormEvent) => Promise<void>;
  busy: boolean;
  togglePermission: (permission: string) => void;
}

export default function AccountCreateModal({
  isOpen,
  onClose,
  form,
  setForm,
  presets,
  onSubmit,
  busy,
  togglePermission,
}: AccountCreateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-2xs">
      <form
        onSubmit={onSubmit}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#E8E0D8] bg-white p-5 shadow-2xl space-y-4 text-[#2D1B14]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h2 className="text-base font-bold text-[#2D1B14] flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#C5A059]" />
            <span>Tạo hồ sơ tài khoản mới</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-zinc-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs font-semibold text-gray-700">
            <span>Email đăng nhập *</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="nhanvien@maianhomes.vn"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-[#2D1B14] outline-none focus:border-[#D4AF37] focus:bg-white font-medium"
            />
          </label>

          <label className="block space-y-1 text-xs font-semibold text-gray-700">
            <span>Họ và tên *</span>
            <input
              required
              value={form.full_name}
              onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
              placeholder="Nguyễn Văn A"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-[#2D1B14] outline-none focus:border-[#D4AF37] focus:bg-white font-medium"
            />
          </label>

          <label className="block space-y-1 text-xs font-semibold text-gray-700">
            <span>Số điện thoại</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="0901234567"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-[#2D1B14] outline-none focus:border-[#D4AF37] focus:bg-white font-medium"
            />
          </label>

          <label className="block space-y-1 text-xs font-semibold text-gray-700">
            <span>Vai trò người dùng *</span>
            <select
              value={form.role}
              onChange={(e) => {
                const role = e.target.value as UserRole;
                setForm((prev) => ({
                  ...prev,
                  role,
                  permissions: [...(presets[role] || [])],
                }));
              }}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs text-[#2D1B14] font-medium outline-none focus:border-[#D4AF37] focus:bg-white cursor-pointer"
            >
              <option value="MARKETING">MARKETING (Biên tập viên)</option>
              <option value="ADMIN">ADMIN (Quản trị viên toàn hệ thống)</option>
            </select>
          </label>
        </div>

        {/* Permissions list */}
        <div className="space-y-2 border-t border-zinc-100 pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#2D1B14]">Quyền hạn cấp ban đầu:</span>
            <span className="font-bold text-[#AA820A] bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {form.permissions.length} quyền đã chọn
            </span>
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {PERMISSION_GROUPS.map((group) => {
              const allowedGroupValues = group.values.filter((p) =>
                permissionAllowedForRole(p, form.role)
              );
              return (
                <div key={group.label} className="rounded-lg border border-zinc-200 p-2.5 bg-zinc-50/40">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    {group.label}
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {allowedGroupValues.map((permission) => (
                      <label
                        key={permission}
                        className={`flex items-start gap-1.5 rounded p-1.5 text-[11px] cursor-pointer transition-all ${
                          form.permissions.includes(permission)
                            ? 'bg-amber-50/70 font-semibold text-[#2D1B14] border border-amber-200/60'
                            : 'bg-white text-gray-600 border border-transparent hover:bg-zinc-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.permissions.includes(permission)}
                          onChange={() => togglePermission(permission)}
                          className="accent-[#D4AF37] mt-0.5 cursor-pointer"
                        />
                        <span className="truncate">{permissionLabel(permission)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
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
            {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            <span>Lưu hồ sơ</span>
          </button>
        </div>
      </form>
    </div>
  );
}
