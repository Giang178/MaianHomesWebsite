'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { 
  UserCircle, Mail, Phone, ShieldCheck, Building2, Briefcase, 
  Calendar, Award, ArrowLeft, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { getAssetUrl } from '@/lib/api';

import {adminLabel} from '@/lib/admin-labels';
import {accountsApi} from '@/features/accounts/api';

export default function AdminProfilePage() {
  const { user, updateProfile } = useAuth();
  const currentUserId = user?.id;
  const currentUserEmail = user?.email;

  useEffect(() => {
    if (!currentUserEmail) return;
    let active = true;
    accountsApi.me().then((profile) => {
      if (!active) return;
      updateProfile({name: profile.full_name, phone: profile.phone || '', avatar_url: profile.avatar_url || ''});
    }).catch(() => undefined);
    return () => { active = false; };
  }, [currentUserId, currentUserEmail, updateProfile]);

  if (!user) {
    return (
      <div className="flex justify-center items-center py-20">
        <RefreshCw className="w-8 h-8 text-[#D4AF37] animate-spin" />
      </div>
    );
  }

  const fullName = user.name;
  const email = user.email;
  const phone = user.phone || 'Chưa cập nhật';
  const department = user.role;
  const position = adminLabel(user.role, 'role');
  const avatarUrl = getAssetUrl(user.avatar_url);
  const startDate = 'Tài khoản quản trị website';

  return (
    <div className="admin-module-page admin-module-page--profile space-y-8 font-sans">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-3xl border border-[#E5E2D9] shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#2D1B14]">Hồ Sơ Cá Nhân & Quản Trị Viên</h1>
          <p className="text-xs text-[#6B5E55] mt-1">Quản lý thông tin định danh và quyền truy cập hệ thống Enterprise Maian Homes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#2D1B14] rounded-2xl text-xs font-bold transition-all">
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Avatar & Account Badge (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-[#E5E2D9] shadow-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-r from-[#2D1B14] via-[#3D2B24] to-[#2D1B14]" />
            
            <div className="relative z-10 pt-8 flex flex-col items-center">
              <div className="relative mb-4">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={fullName}
                    width={128}
                    height={128}
                    unoptimized
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-xl bg-gray-100"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-[#2D1B14] text-[#D4AF37] border-4 border-white shadow-xl flex items-center justify-center text-4xl font-serif font-bold">
                    {fullName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <h2 className="text-xl font-serif font-bold text-[#2D1B14]">{fullName}</h2>
              <p className="text-xs font-black uppercase tracking-wider text-[#A8884A] mt-1 bg-[#FAF8F2] border border-[#E5E2D9] px-3 py-1 rounded-full inline-block">
                {adminLabel(user.role, 'role')}
              </p>

              <div className="w-full pt-6 mt-6 border-t border-gray-100 space-y-3 text-left">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 font-medium">Trạng thái tài khoản:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" /> Hoạt động
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 font-medium">Mã định danh:</span>
                  <span className="font-mono font-bold text-gray-700">{user.employee_code || 'Chưa cấp mã'}</span>
                </div>
              </div>
            </div>
          </div>


        </div>

        {/* Right Column: Detailed Personal Info (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-[#E5E2D9] shadow-sm space-y-6">
            <div className="pb-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-serif font-bold text-[#2D1B14]">Thông Tin Tài Khoản Website</h2>
                <p className="text-xs text-gray-500 mt-0.5">Thông tin định danh của tài khoản quản trị website</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600 font-bold uppercase">
                  <UserCircle className="w-4 h-4 text-[#D4AF37]" />
                  <span>Họ và tên</span>
                </div>
                <p className="text-sm font-bold text-[#2D1B14]">{fullName}</p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600 font-bold uppercase">
                  <Mail className="w-4 h-4 text-[#D4AF37]" />
                  <span>Địa chỉ Email</span>
                </div>
                <p className="text-sm font-bold text-[#2D1B14]">{email}</p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600 font-bold uppercase">
                  <Phone className="w-4 h-4 text-[#D4AF37]" />
                  <span>Số điện thoại</span>
                </div>
                <p className="text-sm font-bold text-[#2D1B14]">{phone}</p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600 font-bold uppercase">
                  <Building2 className="w-4 h-4 text-[#D4AF37]" />
                  <span>Nhóm tài khoản</span>
                </div>
                <p className="text-sm font-bold text-[#2D1B14]">{adminLabel(department, 'department')}</p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600 font-bold uppercase">
                  <Briefcase className="w-4 h-4 text-[#D4AF37]" />
                  <span>Chức vụ / Vị trí</span>
                </div>
                <p className="text-sm font-bold text-[#2D1B14]">{position}</p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600 font-bold uppercase">
                  <Calendar className="w-4 h-4 text-[#D4AF37]" />
                  <span>Phạm vi sử dụng</span>
                </div>
                <p className="text-sm font-bold text-[#2D1B14]">{startDate}</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#FAF8F2] border border-[#E5E2D9] flex items-start gap-3">
              <Award className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
              <div className="text-xs text-gray-700 leading-relaxed space-y-1">
                <p className="font-bold text-[#2D1B14]">Đặc quyền tài khoản {adminLabel(user.role, 'role')}:</p>
                <p>Bạn chỉ được truy cập và thao tác trên các chức năng đã được Admin cấp quyền riêng. Thay đổi quyền có hiệu lực ngay sau khi phiên đăng nhập được làm mới.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
