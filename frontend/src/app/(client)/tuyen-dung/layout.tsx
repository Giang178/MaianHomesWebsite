import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tuyển Dụng Cơ Hội Nghề Nghiệp',
  description: 'Khám phá các vị trí tuyển dụng chuyên viên tư vấn Bất động sản cao cấp, quản lý kinh doanh, marketing tại Hà Nội và TP.HCM cùng Maian Homes.',
  keywords: [
    'Tuyển dụng Bất động sản',
    'Việc làm Maian Homes',
    'Tuyển dụng Sales BĐS Hà Nội',
    'Tuyển dụng TP.HCM',
    'Việc làm BĐS Quận 10',
    'PropTech Careers'
  ]
};

export default function RecruitmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#FAF9F6] text-black min-h-screen pt-[var(--navbar-h)] w-full">
      {children}
    </div>
  );
}
