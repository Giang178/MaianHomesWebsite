'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  MapPin,
  Layers,
  ArrowUpDown,
  Car,
  ShieldCheck,
  Zap,
  Phone,
  Calendar,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Utensils,
  Coffee,
  CheckCircle2,
  Check,
  Clock,
} from 'lucide-react';
import OfficeBuildingCard from './OfficeBuildingCard';
import WorkspaceFAQ from './WorkspaceFAQ';
import WorkspaceConsultationForm from './WorkspaceConsultationForm';
import OfficeDetailGallerySlider from './OfficeDetailGallerySlider';
import OfficeConsultationModal from './OfficeConsultationModal';

interface OfficeDetailViewProps {
  building: any;
  units: any[];
  faqs: any[];
  relatedBuildings: any[];
  isPreview?: boolean;
}

export default function OfficeDetailView({
  building,
  units,
  faqs,
  relatedBuildings,
  isPreview = false,
}: OfficeDetailViewProps) {
  // Modal Popup State for Booking & Quotes
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'DAT_LICH' | 'BAO_GIA';
  }>({
    isOpen: false,
    type: 'DAT_LICH',
  });

  const openBookingModal = () => {
    setModalState({ isOpen: true, type: 'DAT_LICH' });
  };

  const openQuoteModal = () => {
    setModalState({ isOpen: true, type: 'BAO_GIA' });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const positiveNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

  const unitPrices = units
    .map((u: any) => u.rental_price)
    .filter(positiveNumber);
  const minPrice = positiveNumber(building.price_per_sqm_min)
    ? building.price_per_sqm_min
    : positiveNumber(building.min_price)
    ? building.min_price
    : unitPrices.length
    ? Math.min(...unitPrices)
    : null;
  const maxPrice = positiveNumber(building.price_per_sqm_max)
    ? building.price_per_sqm_max
    : positiveNumber(building.max_price)
    ? building.max_price
    : unitPrices.length
    ? Math.max(...unitPrices)
    : null;
  const priceDisplay =
    minPrice == null
      ? 'Liên hệ'
      : maxPrice == null || minPrice === maxPrice
      ? `$${minPrice}`
      : `$${minPrice}–${maxPrice}`;

  const unitAreas = units
    .map((u: any) => u.area)
    .filter(positiveNumber);
  const minArea = positiveNumber(building.min_area)
    ? building.min_area
    : unitAreas.length
    ? Math.min(...unitAreas)
    : null;
  const maxArea = positiveNumber(building.max_area)
    ? building.max_area
    : unitAreas.length
    ? Math.max(...unitAreas)
    : null;
  const areaText =
    minArea == null
      ? 'Chưa cập nhật'
      : maxArea == null || minArea === maxArea
      ? `${minArea} m²`
      : `${minArea} - ${maxArea} m²`;

  const gradeKey = String(building.building_grade || building.grade || '').trim().toUpperCase();
  const gradeLabel = gradeKey ? `Hạng ${gradeKey}` : 'Chưa cập nhật';
  const gradeHref = gradeKey
    ? `/dich-vu-cho-thue/office/hang-${gradeKey.toLowerCase()}`
    : '/dich-vu-cho-thue/office';

  const rawFloors = building.total_floors;
  const floorText =
    typeof rawFloors === 'string' && rawFloors.trim()
      ? rawFloors.trim()
      : positiveNumber(rawFloors)
      ? `${rawFloors} tầng`
      : '';
  const basementText = positiveNumber(building.basements) ? `${building.basements} hầm` : '';
  const scaleText = [floorText, basementText].filter(Boolean).join(' - ') || 'Chưa cập nhật';

  const motorbikeFee = building.motorbike_fee || building.motorcycle_parking_fee;
  const carFee = building.car_parking_fee;
  const parkingText =
    motorbikeFee && carFee
      ? `${motorbikeFee} • ${carFee}`
      : motorbikeFee || carFee
      ? `${motorbikeFee || carFee}`
      : 'Chưa cập nhật';
  const images = (building.images || []).map((img: any) =>
    typeof img === 'string' ? { url: img, alt_text: building.name, caption: '' } : img
  );

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      {isPreview && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-center py-2 px-4 text-xs font-semibold tracking-wider uppercase sticky top-16 z-30">
          Chế độ xem trước (Preview Mode) — Bản nháp tòa nhà
        </div>
      )}

      {/* =========================================================================
          1. HEADER (BADGES, TITLE, ADDRESS, PRICE TOP-RIGHT - EXACT MATCH IMAGE 2)
          ========================================================================= */}
      <div className="pt-28 pb-6 border-b border-zinc-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-2">
              {/* Breadcrumb Navigation */}
              <div className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-500 font-light mb-1">
                <Link href="/" className="hover:text-[#b84518] transition-colors">
                  Trang chủ
                </Link>
                <span>/</span>
                <Link href="/dich-vu-cho-thue/office" className="hover:text-[#b84518] transition-colors">
                  Văn phòng cho thuê
                </Link>
                <span>/</span>
                <Link
                  href={gradeHref}
                  className="hover:text-[#b84518] transition-colors"
                >
                  {gradeLabel}
                </Link>
                <span>/</span>
                <span className="text-zinc-800 font-medium truncate max-w-[200px] sm:max-w-none">
                  {building.name}
                </span>
              </div>

              {/* Badges: office grade and certification */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-md text-xs sm:text-sm font-bold uppercase tracking-wider bg-orange-50 text-[#b84518] border border-orange-200/60 shadow-sm">
                  {gradeKey ? `MAIAN OFFICE ${gradeLabel.toUpperCase()}` : 'MAIAN OFFICE'}
                </span>
                {building.certification && (
                  <span className="px-3 py-1 rounded-md text-xs sm:text-sm font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/60 shadow-sm flex items-center gap-1">
                    <span>🌱</span>
                    <span>{building.certification}</span>
                  </span>
                )}
              </div>

              {/* Title H1 */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-zinc-900 tracking-tight">
                {building.name}
              </h1>

              {/* Address */}
              <a
                href="#vi-tri"
                className="text-xs sm:text-sm text-zinc-600 hover:text-[#b84518] flex items-center gap-1.5 font-light transition-colors group cursor-pointer inline-flex"
              >
                <MapPin className="w-4 h-4 text-[#b84518] shrink-0 group-hover:scale-110 transition-transform" />
                <span className="underline decoration-dotted underline-offset-2">{building.address}</span>
                <span className="text-[10px] bg-orange-50 text-[#b84518] border border-orange-200/60 px-1.5 py-0.5 rounded font-semibold ml-1">
                  Xem bản đồ
                </span>
              </a>
            </div>

            {/* Price Box Top-Right (Exact Match Image 2) */}
            <div className="text-left lg:text-right shrink-0">
              <div className="flex items-baseline gap-1 lg:justify-end">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif text-[#b84518]">
                  {priceDisplay}
                </span>
                <span className="text-xs sm:text-sm text-zinc-500 font-normal">/m²/tháng</span>
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 font-light mt-0.5">
                Giá tham khảo · Chưa gồm phí dịch vụ & VAT
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. HERO GALLERY (SINGLE IMAGE VIEW WITH TOUCH SWIPE & THUMBNAILS)
          ========================================================================= */}
      <OfficeDetailGallerySlider
        images={images}
        buildingName={building.name}
      />

      {/* =========================================================================
          3. 4 QUICK STATS PILLS (HORIZONTAL ROW - EXACT MATCH IMAGE 2)
          ========================================================================= */}
      <section className="py-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-zinc-50 border border-zinc-200 text-sm">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-[#b84518] shrink-0 shadow-xs">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-zinc-400 text-[10px] sm:text-xs uppercase tracking-wider block font-medium">Phân hạng</span>
              <span className="font-semibold text-zinc-900 block leading-tight break-words">{gradeLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-[#b84518] shrink-0 shadow-xs">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-zinc-400 text-[10px] sm:text-xs uppercase tracking-wider block font-medium">Diện tích sàn</span>
              <span className="font-semibold text-zinc-900 block leading-tight break-words">{areaText}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-[#b84518] shrink-0 shadow-xs">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-zinc-400 text-[10px] sm:text-xs uppercase tracking-wider block font-medium">Quy mô</span>
              <span className="font-semibold text-zinc-900 block leading-tight break-words">{scaleText}</span>
            </div>
          </div>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-[#b84518] shrink-0 shadow-xs">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-zinc-400 text-[10px] sm:text-xs uppercase tracking-wider block font-medium">Thời hạn thuê</span>
                <span className="font-semibold text-zinc-900 block leading-tight break-words">
                  {building.lease_term_min
                    ? (String(building.lease_term_min).toLowerCase().startsWith('từ')
                        ? String(building.lease_term_min)
                        : `Từ ${building.lease_term_min}`)
                    : 'Đang cập nhật'}
                </span>
              </div>
            </div>
        </div>
      </section>

      {/* =========================================================================
          4. STICKY SUB-NAVIGATION TABS (EXACT MATCH IMAGE 2 - FULLY RESPONSIVE)
          ========================================================================= */}
      <div className="sticky top-[49px] sm:top-[53px] lg:top-[57px] xl:top-[59px] z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 py-2 sm:py-3 mb-6 sm:mb-8 shadow-xs">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <nav className="flex items-center justify-between sm:justify-start gap-1 sm:gap-8 text-sm font-semibold text-zinc-600">
            <a
              href="#tong-quan"
              className="text-zinc-900 border-b-2 border-zinc-900 pb-1 px-1.5 sm:px-0 text-center shrink-0 transition-colors"
            >
              Tổng quan
            </a>
            <a
              href="#thong-so"
              className="hover:text-zinc-900 pb-1 px-1.5 sm:px-0 text-center shrink-0 transition-colors"
            >
              <span className="sm:hidden">Thông số</span>
              <span className="hidden sm:inline">Thông số tòa nhà</span>
            </a>
            <a
              href="#mat-bang-trong"
              className="hover:text-zinc-900 pb-1 px-1.5 sm:px-0 text-center shrink-0 transition-colors"
            >
              <span className="sm:hidden">Sàn trống</span>
              <span className="hidden sm:inline">Mặt bằng sàn trống ({units.length})</span>
            </a>
            <a
              href="#chi-phi"
              className="hover:text-zinc-900 pb-1 px-1.5 sm:px-0 text-center shrink-0 transition-colors"
            >
              <span className="sm:hidden">Chi phí</span>
              <span className="hidden sm:inline">Giá & chi phí</span>
            </a>
            <a
              href="#tien-ich"
              className="hover:text-zinc-900 pb-1 px-1.5 sm:px-0 text-center shrink-0 transition-colors"
            >
              Tiện ích
            </a>
            <a
              href="#vi-tri"
              className="text-[#b84518] hover:text-[#a03c14] pb-1 px-1.5 sm:px-0 text-center shrink-0 font-bold flex items-center justify-center gap-0.5 sm:gap-1 transition-colors"
            >
              <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span className="sm:hidden">Vị trí</span>
              <span className="hidden sm:inline">Vị trí & Bản đồ</span>
            </a>
          </nav>
        </div>
      </div>

      {/* =========================================================================
          5. MAIN BODY (2 ASYMMETRIC COLUMNS - EXACT MATCH IMAGE 2)
          ========================================================================= */}
      <section className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* ==================== LEFT COLUMN: MAIN CONTENT (65%) ==================== */}
          <div className="lg:col-span-8 space-y-12">
            {/* 1. Tổng quan */}
            <div id="tong-quan" className="scroll-mt-24 sm:scroll-mt-32 space-y-4">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-900">
                {building.overview_title || `Tổng quan tòa nhà ${building.name}`}
              </h2>
              <div className="text-sm md:text-base text-zinc-600 leading-relaxed space-y-3 font-light">
                {building.description ? (
                  building.description
                    .split('\n')
                    .filter((line: string) => line.trim())
                    .map((paragraph: string, pIdx: number) => (
                      <p key={pIdx}>{paragraph}</p>
                    ))
                ) : (
                  <p>
                    Tòa nhà văn phòng {building.name} {building.building_grade ? `tiêu chuẩn Hạng ${building.building_grade}` : ''} tọa lạc tại {building.address || 'vị trí đắc địa'}, mang đến không gian làm việc hiện đại, diện tích sàn linh hoạt và kết nối giao thông thuận tiện cho các doanh nghiệp.
                  </p>
                )}
              </div>

              {/* Callout Note Box */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-orange-50/60 border border-orange-200/80 text-xs text-zinc-700 space-y-1">
                <strong className="text-[#b84518] block font-semibold">Gợi ý trước khi xem:</strong>
                <p className="font-light leading-relaxed">
                  Chuẩn bị số diện tích mong muốn, thời điểm chuyển văn phòng và các yêu cầu vận hành để buổi khảo sát hiệu quả hơn.
                </p>
              </div>
            </div>

            {/* 2. Thông số tòa nhà (Key-Value 2-Column Table) */}
            <div id="thong-so" className="scroll-mt-24 sm:scroll-mt-32 space-y-4 pt-4 border-t border-zinc-100">
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-zinc-900">Thông số tòa nhà</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm md:text-base">
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Hạng văn phòng</span>
                  <span className="font-semibold text-zinc-900 text-right">{gradeLabel}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Quy mô</span>
                  <span className="font-semibold text-zinc-900 text-right">{scaleText}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Diện tích sàn điển hình</span>
                  <span className="font-semibold text-zinc-900 text-right">
                    {building.typical_floor_area
                      ? (String(building.typical_floor_area).includes('m²')
                          ? String(building.typical_floor_area)
                          : `${building.typical_floor_area} m²`)
                      : 'Đang cập nhật'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Chiều cao trần</span>
                  <span className="font-semibold text-zinc-900 text-right">{building.ceiling_height || 'Đang cập nhật'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Năm hoàn thành</span>
                  <span className="font-semibold text-zinc-900 text-right">{building.year_completed || 'Đang cập nhật'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Thang máy</span>
                  <span className="font-semibold text-zinc-900 text-right">{building.elevators || 'Đang cập nhật'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Điều hòa</span>
                  <span className="font-semibold text-zinc-900 text-right">{building.air_conditioning || 'Đang cập nhật'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Điện dự phòng</span>
                  <span className="font-semibold text-zinc-900 text-right">{building.electricity_backup || 'Đang cập nhật'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Bãi đỗ xe</span>
                  <span className="font-semibold text-zinc-900 text-right">{basementText || (building.basements ? `${building.basements} tầng hầm` : 'Đang cập nhật')}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Hướng tòa nhà</span>
                  <span className="font-semibold text-zinc-900 text-right">{building.direction || 'Đang cập nhật'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Quản lý vận hành</span>
                  <span className="font-semibold text-zinc-900 text-right">{building.management_company || 'Đang cập nhật'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-100 gap-2">
                  <span className="text-zinc-500 font-light shrink-0">Diện tích khả dụng</span>
                  <span className="font-semibold text-zinc-900 text-right">{areaText}</span>
                </div>
              </div>
            </div>

            {/* 2.5 Mặt bằng sàn trống khả dụng (Units Table & Cards) */}
            <div id="mat-bang-trong" className="scroll-mt-24 sm:scroll-mt-32 space-y-4 pt-4 border-t border-zinc-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-serif font-bold text-zinc-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#b84518]" />
                    <span>Mặt bằng sàn trống khả dụng</span>
                  </h2>
                  <p className="text-xs text-zinc-500 font-light mt-0.5">
                    {units.length > 0
                      ? `Hiện có ${units.length} diện tích đang trống hoặc sắp bàn giao tại ${building.name}.`
                      : `Hiện tại các sàn tại ${building.name} đang được thương lượng hoặc cập nhật diện tích mới.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openQuoteModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#b84518] border border-orange-200/80 text-xs font-semibold self-start sm:self-auto transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Yêu cầu giữ chỗ sàn</span>
                </button>
              </div>

              {units.length > 0 ? (
                <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-zinc-700 divide-y divide-zinc-200">
                      <thead className="bg-zinc-50 font-semibold text-zinc-900 whitespace-nowrap">
                        <tr>
                          <th className="py-3 px-4">Vị trí tầng</th>
                          <th className="py-3 px-4">Diện tích</th>
                          <th className="py-3 px-4">Giá thuê</th>
                          <th className="py-3 px-4 min-w-[250px]">Tình trạng & Ghi chú</th>
                          <th className="py-3 px-4 text-right">Báo giá</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {units.map((unit: any, uIdx: number) => {
                          const unitPrice = positiveNumber(unit.rental_price)
                            ? `$${unit.rental_price} /m²/tháng`
                            : 'Liên hệ';
                          const isAvailable =
                            unit.availability_status === 'AVAILABLE' ||
                            !unit.availability_status;
                          return (
                            <tr key={unit.id || unit._id || uIdx} className="hover:bg-zinc-50/80 transition-colors">
                              <td className="py-3.5 px-4 text-zinc-900 font-semibold whitespace-nowrap">
                                {unit.floor || 'Đang cập nhật'}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="font-bold text-zinc-900">
                                  {unit.area || unit.area_sqm || '—'} m²
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-[#b84518] font-bold whitespace-nowrap">
                                {unitPrice}
                              </td>
                              <td className="py-3.5 px-4 max-w-sm">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                    isAvailable
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isAvailable ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                  />
                                  <span>{unit.available_from || (isAvailable ? 'Sẵn sàng' : 'Sắp trống')}</span>
                                </span>
                                {unit.notes && (
                                  <div className="text-xs text-zinc-500 font-light mt-1 leading-relaxed">
                                    {unit.notes}
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={openQuoteModal}
                                  className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-[#b84518] text-white text-[11px] font-semibold transition-colors shadow-2xs cursor-pointer"
                                >
                                  Nhận báo giá
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-200 text-center space-y-2">
                  <p className="text-xs text-zinc-600 font-light">
                    Các diện tích mặt bằng tại {building.name} biến động liên tục theo thời điểm. Vui lòng liên hệ chuyên viên để nhận mặt bằng cập nhật mới nhất hôm nay.
                  </p>
                  <button
                    type="button"
                    onClick={openQuoteModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-[#b84518] text-white text-xs font-semibold transition-colors"
                  >
                    <span>Yêu cầu danh sách sàn trống nội bộ</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* 3. Giá thuê & các khoản chi phí (Detailed Table) */}
            <div id="chi-phi" className="scroll-mt-24 sm:scroll-mt-32 space-y-4 pt-4 border-t border-zinc-100">
              <h2 className="text-xl font-serif font-bold text-zinc-900">Giá thuê & các khoản chi phí</h2>

              <div className="border border-zinc-200 rounded-2xl overflow-hidden divide-y divide-zinc-100 text-xs">
                {/* Highlighted Row: Giá thuê tham khảo */}
                <div className="flex items-center justify-between px-3.5 sm:px-5 py-3.5 bg-orange-50/70">
                  <span className="font-medium text-zinc-900">Giá thuê tham khảo</span>
                  <span className="text-sm font-bold text-[#b84518]">{priceDisplay} USD/m²/tháng</span>
                </div>
                <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 bg-white">
                  <span className="text-zinc-600 font-light">Phí quản lý / dịch vụ</span>
                  <span className="font-semibold text-zinc-900">
                    {building.management_fee_per_sqm
                      ? `${building.management_fee_per_sqm} USD/m²/tháng`
                      : 'Đang cập nhật'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 bg-white">
                  <span className="text-zinc-600 font-light">Thuế VAT</span>
                  <span className="font-semibold text-zinc-900">{building.vat_tax || 'Xác nhận theo báo giá'}</span>
                </div>
                <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 bg-white">
                  <span className="text-zinc-600 font-light">Tiền đặt cọc</span>
                  <span className="font-semibold text-zinc-900">{building.deposit_term || 'Thỏa thuận theo hợp đồng'}</span>
                </div>
                <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 bg-white">
                  <span className="text-zinc-600 font-light">Kỳ thanh toán</span>
                  <span className="font-semibold text-zinc-900">{building.payment_term || 'Thỏa thuận theo hợp đồng'}</span>
                </div>
                <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 bg-white">
                  <span className="text-zinc-600 font-light">Điện điều hòa</span>
                  <span className="font-semibold text-zinc-900">{building.electricity_fee || 'Đang cập nhật'}</span>
                </div>
                <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 bg-white">
                  <span className="text-zinc-600 font-light">Phí ngoài giờ</span>
                  <span className="font-semibold text-zinc-900">{building.overtime_fee || 'Thỏa thuận với tòa nhà'}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3.5 sm:px-5 py-3 bg-white gap-1">
                  <span className="text-zinc-600 font-light shrink-0">Gửi xe máy / Ô tô</span>
                  <span className="font-semibold text-zinc-900 text-left sm:text-right text-xs">
                    {parkingText}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 font-light italic">
                Mức giá và diện tích có thể thay đổi theo thời điểm, mặt bằng và điều kiện hợp đồng. Vui lòng liên hệ để có thông tin chính xác tại thời điểm.
              </p>

              <div>
                <button
                  type="button"
                  onClick={openQuoteModal}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b84518] hover:text-[#a03c14] hover:underline cursor-pointer"
                >
                  <span>Nhận báo giá cho {building.name}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 4. Tiện ích & vận hành (Dynamic from building.amenities) */}
            <div id="tien-ich" className="scroll-mt-24 sm:scroll-mt-32 space-y-4 pt-4 border-t border-zinc-100">
              <h2 className="text-xl font-serif font-bold text-zinc-900">Tiện ích & vận hành</h2>
              {Array.isArray(building.amenities) && building.amenities.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
                  {building.amenities.map((amenity: string, aIdx: number) => (
                    <div
                      key={aIdx}
                      className="p-3 sm:p-3.5 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center gap-2.5 min-w-0"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#b84518] shrink-0" />
                      <span className="font-medium text-zinc-800 text-xs leading-snug break-words">
                        {amenity}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 font-light leading-relaxed">
                  Danh mục tiện ích và dịch vụ vận hành của tòa nhà {building.name} đang được cập nhật chi tiết. Quý khách vui lòng liên hệ chuyên viên để nhận thông số trang thiết bị và tiêu chuẩn bàn giao mới nhất.
                </div>
              )}
            </div>

            {/* 5. Vị trí & kết nối (With Interactive Google Maps Embed) */}
            <div id="vi-tri" className="scroll-mt-24 sm:scroll-mt-32 space-y-4 pt-4 border-t border-zinc-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-serif font-bold text-zinc-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-[#b84518]" />
                  <span>Vị trí & kết nối</span>
                </h2>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(`${building.name} ${building.address}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#b84518] hover:text-[#a03c14] underline underline-offset-4 flex items-center gap-1 shrink-0"
                >
                  <span>Chỉ đường trên Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Address Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 border border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-[#b84518] shrink-0 mt-0.5 shadow-xs">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 text-sm sm:text-base font-serif">{building.name}</h3>
                    <p className="text-xs text-zinc-600 font-light mt-0.5">{building.address}</p>
                  </div>
                </div>

                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(`${building.name} ${building.address}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-[#b84518] hover:bg-[#a03c14] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm shrink-0 w-full sm:w-auto"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Mở Google Maps chỉ đường</span>
                </a>
              </div>

              {/* Interactive Google Maps Embed (Visible on both Mobile and Desktop) */}
              <div className="w-full h-72 sm:h-80 md:h-96 rounded-2xl overflow-hidden border border-zinc-200 bg-zinc-100 shadow-xs relative">
                <iframe
                  src={
                    building.map_embed_url ||
                    `https://maps.google.com/maps?q=${encodeURIComponent(`${building.name} ${building.address}`)}&t=&z=15&ie=UTF8&iwloc=&output=embed`
                  }
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Bản đồ vị trí ${building.name}`}
                  className="w-full h-full"
                />
              </div>

              {/* Location Highlights from CMS */}
              {(() => {
                const highlights = (building.location_highlights || []).filter((h: string) => h && h.trim());
                const displayHighlights = highlights.length > 0
                  ? highlights
                  : [
                      building.address ? `Tọa lạc tại trục đường huyết mạch ${building.address}` : '',
                      building.district ? `Khu vực trung tâm thương mại và dịch vụ ${building.district}` : '',
                      'Thuận tiện di chuyển và tiếp cận các dịch vụ công cộng',
                      'Kết nối giao thông nhanh chóng tới các quận lân cận',
                    ].filter(Boolean);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-600 font-light pt-2">
                    {displayHighlights.map((item: string, hIdx: number) => (
                      <div key={hIdx} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ==================== RIGHT COLUMN: STICKY SIDEBAR (35%) ==================== */}
          <div className="lg:col-span-4 relative lg:sticky lg:top-28 space-y-4">
            <div className="p-6 rounded-2xl bg-white border border-zinc-200 shadow-sm space-y-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#b84518] block mb-1">
                  — Sàn phòng bạn đang quan tâm
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-serif font-bold text-[#b84518]">{priceDisplay}</span>
                  <span className="text-xs text-zinc-500">/m²/tháng</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-light mt-0.5">
                  Giá tham khảo · Chưa gồm phí dịch vụ & VAT
                </p>
              </div>

              {/* Sample Floor Slots / Units List */}
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 font-light">Diện tích tham khảo</span>
                    <span className="font-bold text-zinc-900">{areaText}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 font-light">Phí dịch vụ</span>
                    <span className="font-bold text-zinc-900">
                      {building.management_fee_per_sqm
                        ? `${building.management_fee_per_sqm} USD/m²`
                        : 'Đang cập nhật'}
                    </span>
                  </div>

                  {units.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-700">
                        <span>Sàn trống ({units.length})</span>
                        <a href="#mat-bang-trong" className="text-[#b84518] hover:underline text-[10px]">
                          Xem chi tiết
                        </a>
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {units.slice(0, 4).map((u: any, idx: number) => (
                          <div
                            key={u.id || idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-white border border-zinc-200/60 text-[11px]"
                          >
                            <span className="font-medium text-zinc-800">{u.floor || 'Diện tích trống'}</span>
                            <span className="font-semibold text-zinc-900">{u.area || u.area_sqm} m²</span>
                            <span className="text-[#b84518] font-bold">
                              {positiveNumber(u.rental_price) ? `$${u.rental_price}` : 'Liên hệ'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Button 1: Đặt xem phòng (Opens Modal Popup) */}
                  <button
                    type="button"
                    onClick={openBookingModal}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#b84518] hover:bg-[#a03c14] text-white font-bold text-sm flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Đặt xem phòng</span>
                  </button>
                </div>





              </div>
              
              {/* Expert Advisory Box */}
              <div className="pt-4 border-t border-zinc-100 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 shrink-0 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-[#b84518]" />
                </div>
                <div className="text-xs space-y-1">
                  <span className="font-bold text-zinc-900 block">Chuyên viên Mai An Homes</span>
                  <p className="text-[11px] text-zinc-500 font-light">Đồng hành cùng mọi không gian phù hợp</p>
                  <div className="pt-1 space-y-0.5 text-[11px] text-zinc-600">
                    <div className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Tư vấn hoàn toàn miễn phí</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Làm rõ chi phí và điều kiện thuê</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. BOTTOM SECTION: ĐỀ XUẤT CÁC SẢN PHẨM CÙNG KHU VỰC VÀ PHÂN KHÚC (IMAGE 2)
          ========================================================================= */}
      {relatedBuildings.length > 0 && (
        <section className="py-16 bg-zinc-50/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#b84518] block mb-1">
                  — Thêm lựa chọn cho bạn
                </span>
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-900">
                  Khám phá văn phòng khác
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1 font-light">
                  Các tòa nhà cùng phân khúc {gradeLabel} hoặc khu vực {building.district}.
                </p>
              </div>

              <Link
                href="/dich-vu-cho-thue/office"
                className="text-xs font-semibold text-zinc-700 hover:text-[#b84518] underline underline-offset-4 transition-colors shrink-0"
              >
                Xem danh sách văn phòng
              </Link>
            </div>

            {/* 3 Related Building Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {relatedBuildings.map((relB) => (
                <OfficeBuildingCard key={relB.id || relB._id || relB.slug} building={relB} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQs Section */}
      <WorkspaceFAQ faqs={faqs} title={building.seo_metadata?.h1 || building.name} theme="light" />

      {/* Consultation Request Form (Static form kept at bottom for thorough readers) */}
      <div id="tu-van" className="py-12 sm:py-16 pb-28 sm:pb-28 lg:pb-16 bg-white scroll-mt-24 sm:scroll-mt-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <WorkspaceConsultationForm
            source="OFFICE"
            theme="light"
            hideHeader={true}
            initialBuilding={building.name}
            prefillBuildingName={building.name}
          />
        </div>
      </div>

      {/* =========================================================================
          7. MOBILE STICKY BOTTOM ACTION BAR (ONLY ON MOBILE/TABLET, HIDDEN ON DESKTOP)
          ========================================================================= */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold font-serif text-[#b84518] truncate">{priceDisplay}</span>
            <span className="text-[10px] text-zinc-500 font-normal">/m²/th</span>
          </div>
          <span className="text-[10px] text-zinc-400 block truncate">{areaText}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={building.contact_phone ? `tel:${building.contact_phone}` : undefined}
            className="p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 transition-colors"
            title="Gọi chuyên viên tư vấn"
          >
            <Phone className="w-4 h-4 text-[#b84518]" />
          </a>

          {/* Mobile CTA: Đặt lịch xem (Opens Modal Popup immediately) */}
          <button
            type="button"
            onClick={openBookingModal}
            className="py-2.5 px-4 rounded-xl bg-[#b84518] hover:bg-[#a03c14] text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Đặt lịch xem</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          8. CONSULTATION POPUP MODAL (SHOWS ON TOP OF SCREEN INSTEAD OF SCROLLING)
          ========================================================================= */}
      <OfficeConsultationModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        buildingName={building.name}
        type={modalState.type}
      />
    </div>
  );
}
