'use client';

import {
  CheckCircle2,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCog,
  X,
} from 'lucide-react';
import type { AccountUser, UserRole } from '@/features/accounts/types';
import {
  PERMISSION_GROUPS,
  permissionAllowedForRole,
  permissionLabel,
  getPermissionRiskLevel,
} from '../constants';

interface PermissionStudioModalProps {
  permissionAccount: AccountUser | null;
  permissionRoleDraft: UserRole;
  permissionDraft: string[];
  permissionModalSearch: string;
  setPermissionModalSearch: (q: string) => void;
  presets: Record<'ADMIN' | 'MARKETING', string[]>;
  currentUserEmail?: string;
  canManagePermissions: boolean;
  busy: boolean;
  onClose: () => void;
  onRoleChange: (newRole: UserRole) => void;
  onApplyPreset: (permissions: string[]) => void;
  onTogglePermission: (permission: string) => void;
  onToggleGroup: (groupValues: readonly string[], grantAll: boolean) => void;
  onSave: () => Promise<void>;
}

export default function PermissionStudioModal({
  permissionAccount,
  permissionRoleDraft,
  permissionDraft,
  permissionModalSearch,
  setPermissionModalSearch,
  presets,
  currentUserEmail,
  canManagePermissions,
  busy,
  onClose,
  onRoleChange,
  onApplyPreset,
  onTogglePermission,
  onToggleGroup,
  onSave,
}: PermissionStudioModalProps) {
  if (!permissionAccount) return null;

  const isProtectedRole =
    permissionAccount.role === 'CEO' ||
    permissionAccount.email === currentUserEmail ||
    !canManagePermissions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-2xs">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-[#E8E0D8] bg-white shadow-2xl text-[#2D1B14] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 bg-zinc-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 text-[#C5A059] border border-amber-200/80 shadow-2xs">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2D1B14] leading-tight">
                Permission Studio · Phân quyền & Vai trò
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="font-semibold text-gray-800">{permissionAccount.full_name}</span> ·{' '}
                <span className="font-mono text-gray-600">{permissionAccount.email}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-zinc-200/60 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Role Switcher + Presets (4 cols on desktop) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Role Switcher */}
            <div className="bg-zinc-50/80 rounded-xl border border-zinc-200 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#2D1B14] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                  <span>Vai trò tài khoản (Role)</span>
                </label>

                {permissionAccount.role === 'CEO' ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    CEO (Tối cao)
                  </span>
                ) : null}
              </div>

              {!isProtectedRole ? (
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => onRoleChange('MARKETING')}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      permissionRoleDraft === 'MARKETING'
                        ? 'border-blue-400 bg-blue-50/70 shadow-2xs ring-1 ring-blue-300'
                        : 'border-zinc-200 bg-white hover:border-zinc-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-blue-900 block">MARKETING</span>
                      <span className="text-[10px] text-gray-500 block">Biên tập viên nội dung</span>
                    </div>
                    {permissionRoleDraft === 'MARKETING' && (
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                        ✓
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onRoleChange('ADMIN')}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      permissionRoleDraft === 'ADMIN'
                        ? 'border-[#2D1B14] bg-[#2D1B14] text-[#F3E6C6] shadow-2xs ring-1 ring-[#D4AF37]'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 text-gray-800'
                    }`}
                  >
                    <div>
                      <span
                        className={`text-xs font-bold block ${
                          permissionRoleDraft === 'ADMIN' ? 'text-[#D4AF37]' : 'text-zinc-900'
                        }`}
                      >
                        ADMIN
                      </span>
                      <span
                        className={`text-[10px] block ${
                          permissionRoleDraft === 'ADMIN' ? 'text-[#F3E6C6]/70' : 'text-gray-500'
                        }`}
                      >
                        Quản trị viên toàn hệ thống
                      </span>
                    </div>
                    {permissionRoleDraft === 'ADMIN' && (
                      <span className="w-4 h-4 rounded-full bg-[#D4AF37] text-[#1A1612] flex items-center justify-center text-[10px] font-bold">
                        ✓
                      </span>
                    )}
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-zinc-100 border border-zinc-200 text-xs text-gray-600 font-medium">
                  {permissionAccount.role} (Không thể thay đổi vai trò tài khoản này)
                </div>
              )}

              {permissionRoleDraft !== permissionAccount.role && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    Chuyển từ <strong>{permissionAccount.role}</strong> sang{' '}
                    <strong>{permissionRoleDraft}</strong>. Các quyền không hợp lệ sẽ tự động được lọc bỏ.
                  </span>
                </div>
              )}
            </div>

            {/* Quick Presets */}
            <div className="bg-zinc-50/80 rounded-xl border border-zinc-200 p-3.5 space-y-2.5">
              <span className="text-xs font-bold text-gray-700 block">Mẫu quyền gán nhanh:</span>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => onApplyPreset(presets.MARKETING || [])}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-zinc-200 hover:border-[#D4AF37] hover:bg-amber-50/60 text-gray-700 transition-all cursor-pointer shadow-2xs flex items-center justify-between"
                >
                  <span>Mẫu chuẩn Marketing</span>
                  <span className="text-[10px] font-bold text-gray-400">
                    {presets.MARKETING?.length || 0} quyền
                  </span>
                </button>

                {permissionRoleDraft === 'ADMIN' && (
                  <button
                    type="button"
                    onClick={() => onApplyPreset(presets.ADMIN || [])}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-zinc-200 hover:border-[#D4AF37] hover:bg-amber-50/60 text-gray-700 transition-all cursor-pointer shadow-2xs flex items-center justify-between"
                  >
                    <span>Toàn quyền Admin</span>
                    <span className="text-[10px] font-bold text-gray-400">
                      {presets.ADMIN?.length || 0} quyền
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Total Granted Pill */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#AA820A]" />
                <span className="text-xs font-bold text-amber-900">Tổng quyền đã gán:</span>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#D4AF37] text-white shadow-2xs">
                {permissionDraft.length} quyền
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN: Permission Groups Checklist (8 cols on desktop) */}
          <div className="lg:col-span-8 space-y-3.5">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={permissionModalSearch}
                onChange={(e) => setPermissionModalSearch(e.target.value)}
                placeholder="Tìm kiếm quyền hạn (ví dụ: dự án, bài viết, leads, xuất bản...)"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 py-2 pl-9 pr-4 text-xs text-[#2D1B14] outline-none focus:border-[#D4AF37] focus:bg-white font-medium transition-all"
              />
            </div>

            {/* Groups Checklist */}
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {PERMISSION_GROUPS.map((group) => {
                const allowedValues = group.values
                  .filter((p) => permissionAllowedForRole(p, permissionRoleDraft))
                  .filter((p) => {
                    const q = permissionModalSearch.trim().toLowerCase();
                    if (!q) return true;
                    return p.toLowerCase().includes(q) || permissionLabel(p).toLowerCase().includes(q);
                  });

                if (allowedValues.length === 0) return null;

                const grantedCount = allowedValues.filter((p) => permissionDraft.includes(p)).length;
                const allInGroupGranted = grantedCount === allowedValues.length;

                return (
                  <div
                    key={group.key}
                    className="rounded-xl border border-zinc-200 p-3.5 bg-zinc-50/40 hover:border-zinc-300 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                        <span className="text-xs font-bold text-[#2D1B14] uppercase tracking-wider">
                          {group.label}
                        </span>
                        <span className="text-[11px] font-semibold text-gray-400">
                          ({grantedCount}/{allowedValues.length})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleGroup(group.values, !allInGroupGranted)}
                        className="text-[11px] font-bold text-[#AA820A] hover:underline cursor-pointer"
                      >
                        {allInGroupGranted ? 'Bỏ chọn nhóm' : 'Chọn tất cả nhóm'}
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {allowedValues.map((permission) => {
                        const checked = permissionDraft.includes(permission);
                        const risk = getPermissionRiskLevel(permission);

                        return (
                          <label
                            key={permission}
                            className={`flex items-start gap-2 rounded-lg p-2 text-xs cursor-pointer transition-all border ${
                              checked
                                ? 'bg-amber-50/80 font-semibold text-[#2D1B14] border-amber-300/80 shadow-2xs'
                                : 'bg-white text-gray-600 border-zinc-200/80 hover:bg-zinc-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onTogglePermission(permission)}
                              className="accent-[#D4AF37] mt-0.5 cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate leading-tight flex items-center justify-between gap-1">
                                <span className="truncate">{permissionLabel(permission)}</span>
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    risk === 'sensitive'
                                      ? 'bg-rose-500'
                                      : risk === 'medium'
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  title={
                                    risk === 'sensitive'
                                      ? 'Quyền nhạy cảm (Xóa/Khóa/Quản lý)'
                                      : risk === 'medium'
                                      ? 'Quyền biên tập (Tạo/Sửa/Xuất bản)'
                                      : 'Quyền an toàn (Xem)'
                                  }
                                />
                              </div>
                              <span className="block text-[10px] text-gray-400 font-mono truncate mt-0.5">
                                {permission}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-zinc-100 px-6 py-4 bg-zinc-50/60">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-5 py-2 text-xs font-semibold text-gray-700 hover:bg-zinc-100 cursor-pointer transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#C5A059] px-6 py-2 text-xs font-bold text-white shadow-2xs hover:brightness-105 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
          >
            {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Lưu thay đổi</span>
          </button>
        </div>
      </div>
    </div>
  );
}
