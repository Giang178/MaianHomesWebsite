'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  Building2,
  Search,
} from 'lucide-react';
import { OfficeBuilding } from '../types';
import OfficeBuildingCard from './OfficeBuildingCard';
import WorkspaceFAQ from './WorkspaceFAQ';
import WorkspaceConsultationForm from './WorkspaceConsultationForm';

export type OfficeGradeType = 'A' | 'B' | 'C';

export interface GradeConfig {
  grade: OfficeGradeType;
  slug: string;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  heroImage: string;
  hero_alt_text?: string;
  priceDisplay: string;
  targetAudience: string;
  specs: Array<{ label: string; value: string; desc: string }>;
  criteriaList: Array<{ title: string; desc: string }>;
  faqs: Array<{ question: string; answer: string }>;
}

const createEmptyGradeConfig = (grade: OfficeGradeType): GradeConfig => ({
  grade,
  slug: `hang-${grade.toLowerCase()}`,
  name: '',
  badge: '',
  tagline: '',
  description: '',
  heroImage: '',
  priceDisplay: '',
  targetAudience: '',
  specs: [],
  criteriaList: [],
  faqs: [],
});

export const GRADE_CONFIGS: Record<OfficeGradeType, GradeConfig> = {
  A: {
    grade: 'A',
    slug: 'hang-a',
    name: 'Văn Phòng Cho Thuê Hạng A',
    badge: 'Tiêu Chuẩn Quốc Tế',
    tagline: 'Đẳng cấp doanh nghiệp toàn cầu tại trung tâm tài chính',
    description: 'Tòa nhà văn phòng Hạng A đạt chứng chỉ xanh LEED/BCA Green Mark, vị trí đắc địa tại Quận 1, Quận 3, Thủ Thiêm cùng hệ thống vận hành đạt chuẩn 5 sao.',
    heroImage: '/images/office/grade-a.jpg',
    hero_alt_text: 'Văn phòng cho thuê Hạng A cao cấp',
    priceDisplay: 'Từ $35 /m²/tháng',
    targetAudience: 'Tập đoàn đa quốc gia, ngân hàng thương mại, tổ chức tài chính hàng đầu.',
    specs: [
      { label: 'Chiều cao trần', value: '≥ 2.7m', desc: 'Trần hoàn thiện thông thoáng' },
      { label: 'Hệ thống điều hòa', value: 'Chiller BMS', desc: 'Điều hòa trung tâm tiết kiệm điện' },
      { label: 'Thang máy', value: '< 30s', desc: 'Thời gian chờ tốc độ cao' },
      { label: 'Điện dự phòng', value: '100%', desc: 'Hệ thống máy phát Cummins' },
    ],
    criteriaList: [
      { title: 'Vị trí chiến lược trung tâm', desc: 'Nằm tại các trục đường tài chính huyết mạch, tiếp cận hệ thống cơ quan nhà nước, ngân hàng và khách sạn 5 sao.' },
      { title: 'Chứng nhận công trình bền vững', desc: 'Đạt các tiêu chuẩn công trình xanh quốc tế như LEED Gold, LEED Platinum hoặc BCA Green Mark.' },
      { title: 'Đơn vị quản lý vận hành quốc tế', desc: 'Được vận hành chuyên nghiệp bởi các tập đoàn bất động sản quốc tế như CBRE, Savills, JLL.' },
      { title: 'Tiện ích tích hợp đẳng cấp', desc: 'Hầm đỗ xe thông minh, trung tâm hội nghị, sảnh lễ tân VIP và hệ thống kiểm soát an ninh đa tầng.' },
    ],
    faqs: [
      { question: 'Giá thuê văn phòng Hạng A đã gồm phí quản lý chưa?', answer: 'Thông thường giá chào thuê văn phòng Hạng A chưa gồm phí dịch vụ quản lý ($6 - $8/m²/tháng) và thuế VAT 10%.' },
      { question: 'Thời hạn hợp đồng thuê tối thiểu là bao lâu?', answer: 'Hợp đồng thuê văn phòng Hạng A tiêu chuẩn thường từ 3 đến 5 năm với kỳ thanh toán theo quý.' },
    ],
  },
  B: {
    grade: 'B',
    slug: 'hang-b',
    name: 'Văn Phòng Cho Thuê Hạng B',
    badge: 'Hiệu Quả & Chuyên Nghiệp',
    tagline: 'Giải pháp không gian làm việc tối ưu chi phí và hiệu suất',
    description: 'Văn phòng Hạng B sở hữu thiết kế hiện đại, diện tích sàn linh hoạt, trang bị tiện nghi đầy đủ và mức ngân sách cạnh tranh tại các quận phát triển năng động.',
    heroImage: '/images/office/grade-b.jpg',
    hero_alt_text: 'Văn phòng cho thuê Hạng B hiện đại',
    priceDisplay: 'Từ $20 - $35 /m²/tháng',
    targetAudience: 'Doanh nghiệp FDI quy mô vừa, công ty công nghệ, thương mại điện tử, agency.',
    specs: [
      { label: 'Chiều cao trần', value: '≥ 2.6m', desc: 'Độ cao trần tiêu chuẩn' },
      { label: 'Hệ thống điều hòa', value: 'VRV / VRF', desc: 'Hệ thống máy lạnh âm trần hiện đại' },
      { label: 'Thang máy', value: '2.0 - 2.5 m/s', desc: 'Thang máy tải khách tốc độ chuẩn' },
      { label: 'Điện dự phòng', value: '100%', desc: 'Đảm bảo hoạt động kinh doanh liên tục' },
    ],
    criteriaList: [
      { title: 'Tối ưu ngân sách doanh nghiệp', desc: 'Chi phí thuê và phí dịch vụ hợp lý hơn 30-40% so với Hạng A trong khi vẫn đảm bảo diện mạo chuyên nghiệp.' },
      { title: 'Vị trí kết nối giao thông thuận tiện', desc: 'Tọa lạc tại các quận trung tâm mở rộng như Quận 3, Quận 10, Phú Nhuận, Bình Thạnh.' },
      { title: 'Mặt bằng linh hoạt chia cắt', desc: 'Dễ dàng phân chia diện tích sàn từ 80m², 150m², 300m² đến nguyên sàn phù hợp nhiều mô hình nhân sự.' },
      { title: 'Bàn giao hoàn thiện kỹ thuật cơ bản', desc: 'Sàn nâng hoặc sàn bê tông cán phẳng, trần thạch cao khung xương chìm và hệ thống chiếu sáng chuẩn văn phòng.' },
    ],
    faqs: [
      { question: 'Văn phòng Hạng B có làm ngoài giờ được không?', answer: 'Có, các tòa nhà Hạng B thường có mức phí làm thêm ngoài giờ linh hoạt hoặc miễn phí tiền điều hòa ngoài giờ tùy thỏa thuận.' },
    ],
  },
  C: {
    grade: 'C',
    slug: 'hang-c',
    name: 'Văn Phòng Cho Thuê Hạng C',
    badge: 'Tiết Kiệm & Linh Hoạt',
    tagline: 'Lựa chọn khởi đầu thông minh cho doanh nghiệp tăng trưởng',
    description: 'Văn phòng Hạng C mang lại không gian làm việc thực tế, thủ tục thuê nhanh chóng, đáp ứng đầy đủ an toàn PCCC với mức giá thuê tiết kiệm nhất thị trường.',
    heroImage: '/images/office/grade-c.jpg',
    hero_alt_text: 'Văn phòng cho thuê Hạng C tiết kiệm',
    priceDisplay: 'Dưới $20 /m²/tháng',
    targetAudience: 'Doanh nghiệp Startup, công ty vừa và nhỏ, văn phòng đại diện.',
    specs: [
      { label: 'Chiều cao trần', value: '≥ 2.5m', desc: 'Độ cao trần cơ bản' },
      { label: 'Hệ thống điều hòa', value: 'Cục bộ / Multi', desc: 'Điều hòa lắp sẵn từng phòng' },
      { label: 'Thang máy', value: 'Tiêu chuẩn', desc: 'Thang máy khách hoạt động liên tục' },
      { label: 'An ninh', value: '24/7', desc: 'Bảo vệ và camera khu vực chung' },
    ],
    criteriaList: [
      { title: 'Ngân sách thuê tối ưu nhất', desc: 'Giá thuê kinh tế chỉ từ $12 - $18/m², phù hợp với các công ty khởi nghiệp kiểm soát dòng tiền ban đầu.' },
      { title: 'Điều kiện hợp đồng linh động', desc: 'Thời hạn thuê từ 1 - 2 năm, tiền cọc từ 2 - 3 tháng, thời gian thiết lập văn phòng nhanh chóng.' },
      { title: 'Mật độ tập trung đa dạng', desc: 'Phủ khắp các quận huyện tại TP.HCM, thuận tiện cho nhân viên di chuyển gần nơi cư trú.' },
      { title: 'Dịch vụ phụ trợ tiện lợi', desc: 'Gần kề các ngân hàng, bưu cục, khu ăn uống văn phòng và giao dịch hàng ngày.' },
    ],
    faqs: [
      { question: 'Văn phòng Hạng C có diện tích nhỏ từ 30 - 50m² không?', answer: 'Nhiều tòa nhà Hạng C hỗ trợ chia nhỏ diện tích từ 30m², 45m², 60m² cho các đội ngũ từ 5 - 10 người.' },
    ],
  },
};
interface OfficeGradeViewProps {
  currentGrade: OfficeGradeType;
  buildings: OfficeBuilding[];
  districts?: string[];
  gradeConfigs?: Partial<Record<OfficeGradeType, Partial<GradeConfig>>>;
  customConfig?: Partial<GradeConfig>;
}

export default function OfficeGradeView({ currentGrade, buildings, districts = [], gradeConfigs = {}, customConfig }: OfficeGradeViewProps) {
  const baseConfig = GRADE_CONFIGS[currentGrade];
  const config = useMemo(() => {
    if (!customConfig) return baseConfig;
    return {
      ...baseConfig,
      ...customConfig,
      name: customConfig.name?.trim() ? customConfig.name : baseConfig.name,
      badge: customConfig.badge?.trim() ? customConfig.badge : baseConfig.badge,
      tagline: customConfig.tagline?.trim() ? customConfig.tagline : baseConfig.tagline,
      description: customConfig.description?.trim() ? customConfig.description : baseConfig.description,
      heroImage: customConfig.heroImage?.trim() ? customConfig.heroImage : baseConfig.heroImage,
      hero_alt_text: customConfig.hero_alt_text || baseConfig.hero_alt_text || '',
      priceDisplay: customConfig.priceDisplay?.trim() ? customConfig.priceDisplay : baseConfig.priceDisplay,
      targetAudience: customConfig.targetAudience?.trim() ? customConfig.targetAudience : baseConfig.targetAudience,
      specs:
        customConfig.specs && customConfig.specs.length > 0
          ? customConfig.specs.map((item, idx) => ({
              label: item.label?.trim() ? item.label : (baseConfig.specs[idx]?.label || ''),
              value: item.value?.trim() ? item.value : (baseConfig.specs[idx]?.value || ''),
              desc: item.desc?.trim() ? item.desc : (baseConfig.specs[idx]?.desc || ''),
            }))
          : baseConfig.specs,
      criteriaList:
        customConfig.criteriaList && customConfig.criteriaList.length > 0
          ? customConfig.criteriaList
          : baseConfig.criteriaList,
      faqs: customConfig.faqs && customConfig.faqs.length > 0 ? customConfig.faqs : baseConfig.faqs,
    };
  }, [baseConfig, customConfig]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedDistrict, setSelectedDistrict] = useState<string>(searchParams?.get('district') || 'all');
  const [searchKeyword, setSearchKeyword] = useState<string>(searchParams?.get('search') || '');
  const [selectedBudget, setSelectedBudget] = useState<string>(searchParams?.get('budget_band') || 'all');
  const availableDistricts = districts || [];

  useEffect(() => {
    setSelectedDistrict(searchParams?.get('district') || 'all');
    setSearchKeyword(searchParams?.get('search') || '');
    setSelectedBudget(searchParams?.get('budget_band') || 'all');
  }, [searchParams]);

  const applyFilters = (next: {
    district?: string;
    budget?: string;
    search?: string;
  } = {}) => {
    const district = next.district ?? selectedDistrict;
    const budget = next.budget ?? selectedBudget;
    const search = next.search ?? searchKeyword;
    const params = new URLSearchParams(searchParams?.toString() || '');

    if (district === 'all') params.delete('district');
    else params.set('district', district);
    if (budget === 'all') params.delete('budget_band');
    else params.set('budget_band', budget);
    if (search.trim()) params.set('search', search.trim());
    else params.delete('search');

    setSelectedDistrict(district);
    setSelectedBudget(budget);
    setSearchKeyword(search);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // The backend owns filtering and pagination; this component only renders its response.
  const gradeBuildings = buildings;
  const allDistricts = availableDistricts;

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      {/* 1. HERO BANNER FOR THIS GRADE */}
      <section className="relative pt-32 pb-20 overflow-hidden bg-zinc-900 text-white">
        {config.heroImage ? (
          <Image
            src={config.heroImage}
            alt={config.hero_alt_text || config.name || ''}
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-25"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900/80 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Breadcrumb & Grade Switcher Pills */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-light">
              <Link href="/dich-vu-cho-thue/office" className="hover:text-white transition-colors">
                {config.name}
              </Link>
              <span>/</span>
              <span className="text-[#b84518] font-medium">{config.name}</span>
            </div>

            {/* Switch Grade Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-xs">
              {(['A', 'B', 'C'] as OfficeGradeType[]).map((gKey) => {
                const isActive = gKey === currentGrade;
                const gConf = { ...GRADE_CONFIGS[gKey], ...(gradeConfigs[gKey] || {}) };
                return (
                  <Link
                    key={gKey}
                    href={`/dich-vu-cho-thue/office/${gConf.slug}`}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      isActive
                        ? 'bg-[#b84518] text-white shadow-sm'
                        : 'text-zinc-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Hạng {gKey}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Main Title & Tagline */}
          <div className="max-w-3xl space-y-3">
            <span className="inline-block px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-widest bg-[#b84518]/90 text-white border border-[#b84518]">
              {config.badge}
            </span>
            <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white tracking-tight">
              {config.name}
            </h1>
            <p className="text-base sm:text-lg text-zinc-300 font-light leading-relaxed">
              {config.tagline}
            </p>
            <p className="text-xs sm:text-sm text-zinc-400 font-light leading-relaxed pt-1">
              {config.description}
            </p>
          </div>

          {/* Key Specs Pills Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-4">
            {config.specs.map((spec, idx) => (
              <div
                key={idx}
                className="p-3.5 sm:p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 space-y-1"
              >
                <span className="text-[11px] uppercase tracking-wider text-zinc-400 block font-medium">
                  {spec.label}
                </span>
                <span className="text-lg sm:text-xl font-bold font-serif text-white block">
                  {spec.value}
                </span>
                <span className="text-[11px] text-zinc-400 font-light block">{spec.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 2. DEDICATED FILTER BAR FOR THIS GRADE */}
      <section className="sticky top-[60px] sm:top-16 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 py-3 sm:py-4 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* District Filter Dropdown */}
              <select
                value={selectedDistrict}
                onChange={(e) => applyFilters({ district: e.target.value })}
                className="px-3.5 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-800 focus:outline-none focus:border-[#b84518] transition-colors"
              >
                <option value="all">Tất cả khu vực</option>
                {allDistricts.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>

              {/* Budget Filter */}
              <select
                value={selectedBudget}
                onChange={(e) => applyFilters({ budget: e.target.value })}
                className="px-3.5 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-800 focus:outline-none focus:border-[#b84518] transition-colors"
              >
                <option value="all">Khoảng ngân sách</option>
                <option value="under_20">Below $20 / m2</option>
                <option value="20_35">$20 - $35 / m2</option>
                <option value="over_35">Above $35 / m2</option>
              </select>

              {(selectedDistrict !== 'all' || selectedBudget !== 'all' || searchKeyword) && (
                <button
                  type="button"
                  onClick={() => applyFilters({ district: 'all', budget: 'all', search: '' })}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-[#b84518] hover:bg-orange-50 transition-colors"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>

            {/* Keyword Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyFilters({ search: e.currentTarget.value });
                }}
                onBlur={(e) => applyFilters({ search: e.currentTarget.value })}
                placeholder="Tìm tên tòa nhà, đường..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#b84518] transition-colors"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. BUILDING LIST GRID */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-zinc-900">
              Danh sách tòa nhà {config.name}
            </h2>
            <p className="text-xs text-zinc-500 font-light mt-0.5">
              Hiển thị {gradeBuildings.length} tòa nhà phù hợp với tiêu chí của bạn
            </p>
          </div>

          <a
            href="#tu-van"
            className="text-xs font-semibold text-[#b84518] hover:underline underline-offset-4"
          >
            Nhận báo giá theo nhu cầu
          </a>
        </div>

        {gradeBuildings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {gradeBuildings.map((building) => (
              <OfficeBuildingCard
                key={building.id || building._id || building.slug}
                building={building}
              />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center bg-zinc-50 border border-zinc-200 rounded-2xl p-8 max-w-md mx-auto space-y-3">
            <Building2 className="w-8 h-8 text-zinc-400 mx-auto" />
            <h3 className="text-base font-bold text-zinc-900 font-serif">
              Chưa tìm thấy tòa nhà phù hợp
            </h3>
            <p className="text-xs text-zinc-500 font-light">
              Thử thay đổi bộ lọc tìm kiếm hoặc liên hệ chuyên viên để nhận danh sách mặt bằng nội bộ chưa công khai.
            </p>
            <button
              type="button"
              onClick={() => applyFilters({ district: 'all', budget: 'all', search: '' })}
              className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-semibold text-xs tracking-wider transition-colors shadow-sm"
            >
              Xem tất cả tòa nhà {config.name}
            </button>
          </div>
        )}
      </section>

      {/* 4. TECHNICAL CRITERIA & STANDARDS SECTION */}
      <section className="py-16 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-[#b84518] block mb-1">
              — Tiêu chuẩn đánh giá thị trường
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-900">
              Đặc điểm định vị {config.name}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 font-light mt-1">
              Bộ tiêu chí thẩm định chất lượng công trình và giá trị thương hiệu theo tiêu chuẩn quốc tế.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {config.criteriaList.map((item, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm space-y-2 flex items-start gap-4"
              >
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#b84518] flex items-center justify-center shrink-0 font-bold text-sm">
                  0{idx + 1}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-900 font-serif">{item.title}</h3>
                  <p className="text-xs text-zinc-600 font-light leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. EXPLORE OTHER GRADES NAVIGATION CARDS */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#b84518] block mb-1">
            — So sánh các phân khúc khác
          </span>
          <h2 className="text-2xl font-serif font-bold text-zinc-900">
            Khám phá các hạng văn phòng khác
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['A', 'B', 'C'] as OfficeGradeType[])
            .filter((g) => g !== currentGrade)
            .map((otherGrade) => {
              const otherConf = { ...GRADE_CONFIGS[otherGrade], ...(gradeConfigs[otherGrade] || {}) };
              return (
                <Link
                  key={otherGrade}
                  href={`/dich-vu-cho-thue/office/${otherConf.slug}`}
                  className="group relative h-56 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-end p-6 border border-zinc-200"
                >
                  {otherConf.heroImage ? (
                    <Image
                      src={otherConf.heroImage}
                      alt={otherConf.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                  <div className="relative z-10 space-y-1 text-white">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/20 backdrop-blur-md inline-block">
                      {otherConf.badge}
                    </span>
                    <h3 className="text-xl font-bold font-serif text-white">{otherConf.name}</h3>
                    <p className="text-xs text-zinc-300 font-light line-clamp-1">
                      {otherConf.tagline}
                    </p>
                  </div>
                </Link>
              );
            })}
        </div>
      </section>

      {/* 6. FAQS SPECIFIC TO THIS GRADE */}
      <WorkspaceFAQ faqs={config.faqs} title={config.name || undefined} theme="light" />

      {/* 7. CONSULTATION FORM */}
      <div id="tu-van" className="py-12 sm:py-16 bg-white scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <WorkspaceConsultationForm
            source="OFFICE"
            theme="light"
            hideHeader={false}
            badge={config.badge}
            title={config.name}
            subtitle={config.description}
            prefillPlanName={config.name}
          />
        </div>
      </div>
    </div>
  );
}
