'use client';

import React, { useState, useEffect, useRef } from 'react';
import { OfficeBuilding, WorkspaceGalleryImage } from '../types';
import { workspaceApi } from '../api';
import { generateSingleAltText, generateBatchAltTexts } from '../utils/aiAltGenerator';
import {
  X,
  Save,
  Building2,
  Sliders,
  DollarSign,
  Image as ImageIcon,
  MapPin,
  FileText,
  Upload,
  Star,
  Trash2,
  RefreshCw,
  AlertCircle,
  Wand2,
  ChevronRight,
  ChevronLeft,
  Check,
  ShieldCheck,
  Sparkles,
  Car,
  Compass,
  Calendar,
  Layers,
  ArrowUpRight,
  Globe,
} from 'lucide-react';

interface OfficeBuildingModalProps {
  building: Partial<OfficeBuilding> | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (building: Partial<OfficeBuilding>) => Promise<void>;
}

type ActiveTab = 'basic' | 'specs' | 'pricing' | 'gallery' | 'location' | 'content' | 'seo';

const TABS: { id: ActiveTab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'basic', label: 'Thông tin cơ bản', icon: Building2, desc: 'Tên, hạng, địa chỉ' },
  { id: 'specs', label: 'Thông số kỹ thuật', icon: Sliders, desc: 'Quy mô, sàn, hệ thống' },
  { id: 'pricing', label: 'Giá & Chi phí', icon: DollarSign, desc: 'Giá thuê, phí dịch vụ' },
  { id: 'gallery', label: 'Thư viện ảnh', icon: ImageIcon, desc: 'Hình ảnh, Alt SEO' },
  { id: 'location', label: 'Vị trí & Bản đồ', icon: MapPin, desc: 'Google Map, kết nối' },
  { id: 'content', label: 'Tiện ích & Mô tả', icon: FileText, desc: 'Tiện ích, bài giới thiệu' },
  { id: 'seo', label: 'Cấu hình SEO / GEO', icon: Sparkles, desc: 'Thẻ Meta, SERP, GEO' },
];

const SUGGESTED_AMENITIES = [
  'Thang máy tốc độ cao Schindler / Mitsubishi',
  'Điều hòa trung tâm Chiller thông minh',
  'Máy phát điện dự phòng 100% công suất',
  'Hệ thống PCCC tự động đạt chuẩn quốc tế',
  'Bãi đỗ xe 2 tầng hầm rộng rãi',
  'Đội ngũ lễ tân chuyên nghiệp & an ninh 24/7',
  'Hệ thống thẻ từ kiểm soát ra vào & CCTV an ninh',
  'Sảnh đón khách sang trọng chuẩn 5 sao',
  'Đường truyền Internet cáp quang đa nhà mạng',
  'Khu vực pantry nước sạch & nghỉ ngơi từng tầng',
];

const EMPTY_BUILDING: Partial<OfficeBuilding> = {
  name: '',
  slug: '',
  building_grade: 'A',
  certification: '',
  address: '',
  district: '',
  city: 'TP. Hồ Chí Minh',
  price_per_sqm_min: undefined,
  price_per_sqm_max: undefined,
  management_fee_per_sqm: undefined,
  total_floors: undefined,
  basements: undefined,
  elevators: '',
  ceiling_height: '',
  typical_floor_area: '',
  direction: '',
  year_completed: '',
  air_conditioning: '',
  electricity_backup: '',
  management_company: '',
  lease_term_min: 'Từ 2 năm',
  motorcycle_parking_fee: '',
  car_parking_fee: '',
  electricity_fee: '',
  overtime_fee: '',
  vat_tax: '10%',
  deposit_term: '3 tháng tiền thuê',
  payment_term: 'Theo quý',
  images: [],
  amenities: [],
  location_highlights: ['', '', '', ''],
  description: '',
  map_embed_url: '',
  latitude: undefined,
  longitude: undefined,
  seo_metadata: {
    title: '',
    description: '',
    focus_keyword: '',
    keywords: '',
    h1: '',
    canonical_url: '',
    robots: 'index, follow',
  },
};

export function OfficeBuildingModal({
  building,
  isOpen,
  onClose,
  onSave,
}: OfficeBuildingModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('basic');

  const normalizeImages = (rawImages: any[]): WorkspaceGalleryImage[] => {
    if (!rawImages || !Array.isArray(rawImages)) return [];
    return rawImages.map((img, idx) => {
      if (typeof img === 'string') {
        return {
          id: `img-${idx}-${Date.now()}`,
          url: img,
          alt_text: '',
          caption: '',
          is_primary: idx === 0,
          display_order: idx + 1,
        };
      }
      return {
        id: img.id || `img-${idx}-${Date.now()}`,
        url: img.url || '',
        alt_text: img.alt_text || '',
        caption: img.caption || '',
        is_primary: Boolean(img.is_primary ?? idx === 0),
        display_order: img.display_order ?? idx + 1,
      };
    });
  };

  const [formData, setFormData] = useState<Partial<OfficeBuilding>>({
    ...EMPTY_BUILDING,
    ...building,
    city: building?.city || 'TP. Hồ Chí Minh',
    images: normalizeImages(building?.images || []),
    latitude: building?.latitude,
    longitude: building?.longitude,
    seo_metadata: {
      ...EMPTY_BUILDING.seo_metadata,
      ...(building?.seo_metadata || {}),
      keywords: Array.isArray(building?.seo_metadata?.keywords)
        ? (building.seo_metadata.keywords as string[]).join(', ')
        : (building?.seo_metadata?.keywords || ''),
    },
  });
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when building prop changes
  useEffect(() => {
    if (building) {
      setFormData({
        ...EMPTY_BUILDING,
        ...building,
        building_grade: building.building_grade || building.grade || 'A',
        city: building.city || 'TP. Hồ Chí Minh',
        latitude: building.latitude,
        longitude: building.longitude,
        images: normalizeImages(building.images || []),
        location_highlights: [
          building.location_highlights?.[0] || '',
          building.location_highlights?.[1] || '',
          building.location_highlights?.[2] || '',
          building.location_highlights?.[3] || '',
        ],
        seo_metadata: {
          title: building.seo_metadata?.title || '',
          description: building.seo_metadata?.description || '',
          focus_keyword: building.seo_metadata?.focus_keyword || '',
          keywords: Array.isArray(building.seo_metadata?.keywords)
            ? (building.seo_metadata.keywords as string[]).join(', ')
            : (building.seo_metadata?.keywords || ''),
          h1: building.seo_metadata?.h1 || '',
          canonical_url: building.seo_metadata?.canonical_url || '',
          robots: building.seo_metadata?.robots || 'index, follow',
        },
      });
    } else {
      setFormData({
        ...EMPTY_BUILDING,
        seo_metadata: { ...EMPTY_BUILDING.seo_metadata },
      });
    }
    setActiveTab('basic');
    setSubmitError(null);
  }, [building, isOpen]);

  if (!isOpen) return null;

  const currentGallery: WorkspaceGalleryImage[] = (formData.images || []) as WorkspaceGalleryImage[];

  // Helper to generate SEO-friendly slug
  const handleGenerateSlug = () => {
    if (!formData.name) return;
    const generated = formData.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    setFormData((prev) => ({ ...prev, slug: generated }));
  };

  // Helper to generate AI SEO metadata
  const handleAiGenerateSeo = () => {
    const name = formData.name || 'Tòa nhà văn phòng';
    const district = formData.district || 'TP.HCM';
    const grade = formData.building_grade ? `Hạng ${formData.building_grade}` : 'Cao cấp';
    const price = formData.price_per_sqm_min
      ? `Từ $${formData.price_per_sqm_min}/m²`
      : 'Giá tốt nhất';

    const aiTitle = `Cho Thuê Văn Phòng ${name} ${district} - ${grade} | Mai An Homes`.slice(0, 65);
    const aiDesc = `Cho thuê văn phòng tại ${name}, ${district}, TP.HCM. Tòa nhà ${grade} hiện đại, diện tích linh hoạt, giá thuê ${price}. Cập nhật diện tích trống & bảng giá mới nhất.`.slice(0, 160);
    const aiKeywords = `cho thuê văn phòng ${name}, văn phòng ${district}, văn phòng hạng ${formData.building_grade || 'a'}, văn phòng cho thuê tphcm`;
    const aiH1 = `Cho Thuê Văn Phòng ${name} - ${district}`;

    setFormData((prev) => ({
      ...prev,
      seo_metadata: {
        ...prev.seo_metadata,
        title: aiTitle,
        description: aiDesc,
        focus_keyword: `cho thuê văn phòng ${name}`,
        keywords: aiKeywords,
        h1: aiH1,
        robots: prev.seo_metadata?.robots || 'index, follow',
      },
    }));
  };

  // Upload images
  const handleUploadImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploadingImages(true);

    try {
      const newItems: WorkspaceGalleryImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          setUploadError(`File "${file.name}" không phải là ảnh hợp lệ.`);
          continue;
        }
        if (file.size > 50 * 1024 * 1024) {
          setUploadError(`File "${file.name}" vượt quá giới hạn 50MB.`);
          continue;
        }

        const res = await workspaceApi.uploadImage(file);
        if (res?.url) {
          const idx = currentGallery.length + newItems.length;
          const isPrimary = currentGallery.length === 0 && newItems.length === 0;
          const existingAlts = [
            ...currentGallery.map((img) => img.alt_text).filter(Boolean),
            ...newItems.map((img) => img.alt_text).filter(Boolean),
          ];

          // Tự động sinh Alt Text SEO độc nhất bằng AI để tránh trùng
          const autoAlt = generateSingleAltText({
            entityName: formData.name || 'Tòa nhà văn phòng',
            district: formData.district,
            city: formData.city,
            category: 'building',
            imageIndex: idx,
            isPrimary,
            existingAlts,
          });

          newItems.push({
            id: 'b-img-' + Date.now() + '-' + i,
            url: res.url,
            alt_text: autoAlt,
            caption: '',
            is_primary: isPrimary,
            display_order: idx + 1,
          });
        }
      }

      setFormData((prev) => ({
        ...prev,
        images: [...((prev.images as WorkspaceGalleryImage[]) || []), ...newItems],
      }));
    } catch (err) {
      setUploadError('Tải ảnh thất bại: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // AI sinh lại toàn bộ Alt text cho tất cả ảnh để đảm bảo không bị trùng
  const handleAiGenerateAllAlts = () => {
    if (currentGallery.length === 0) return;
    const generatedList = generateBatchAltTexts(currentGallery.length, {
      entityName: formData.name || 'Tòa nhà văn phòng',
      district: formData.district,
      city: formData.city,
      category: 'building',
    });
    const updated = currentGallery.map((img, idx) => ({
      ...img,
      alt_text: generatedList[idx] || img.alt_text,
    }));
    setFormData((prev) => ({ ...prev, images: updated }));
  };

  // AI gợi ý lại Alt text cho một ảnh cụ thể (loại trừ các alt của ảnh khác để tránh trùng)
  const handleAiGenerateSingleAlt = (idx: number) => {
    const existing = currentGallery
      .filter((_, i) => i !== idx)
      .map((img) => img.alt_text)
      .filter(Boolean);

    const newAlt = generateSingleAltText({
      entityName: formData.name || 'Tòa nhà văn phòng',
      district: formData.district,
      city: formData.city,
      category: 'building',
      imageIndex: idx,
      isPrimary: idx === 0 || Boolean(currentGallery[idx]?.is_primary),
      existingAlts: existing,
    });

    handleUpdateImageAlt(idx, newAlt);
  };

  const handleUpdateImageAlt = (idx: number, alt: string) => {
    const copy = [...currentGallery];
    copy[idx] = { ...copy[idx], alt_text: alt };
    setFormData({ ...formData, images: copy });
  };

  const handleUpdateImageCaption = (idx: number, caption: string) => {
    const copy = [...currentGallery];
    copy[idx] = { ...copy[idx], caption };
    setFormData({ ...formData, images: copy });
  };

  const handleSetPrimaryImage = (idx: number) => {
    const copy = currentGallery.map((img, i) => ({
      ...img,
      is_primary: i === idx,
    }));
    setFormData({ ...formData, images: copy });
  };

  const handleRemoveImage = (idx: number) => {
    const copy = currentGallery.filter((_, i) => i !== idx);
    if (copy.length > 0 && !copy.some((img) => img.is_primary)) {
      copy[0].is_primary = true;
    }
    setFormData({ ...formData, images: copy });
  };

  // Toggle quick amenity chip
  const handleToggleAmenity = (item: string) => {
    const current = Array.isArray(formData.amenities) ? [...formData.amenities] : [];
    const index = current.indexOf(item);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(item);
    }
    setFormData({ ...formData, amenities: current });
  };

  // Submit validation and save
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate required fields
    if (!formData.name?.trim()) {
      setActiveTab('basic');
      setSubmitError('Vui lòng nhập tên tòa nhà.');
      return;
    }
    if (!formData.address?.trim() || !formData.district?.trim()) {
      setActiveTab('basic');
      setSubmitError('Vui lòng nhập địa chỉ chi tiết và quận/huyện.');
      return;
    }

    // Validate SEO alt texts for uploaded images
    if (formData.images && formData.images.length > 0) {
      const missingIdx = formData.images.findIndex((img) => !img.alt_text?.trim());
      if (missingIdx !== -1) {
        setActiveTab('gallery');
        setSubmitError(
          `Vui lòng nhập văn bản thay thế (Alt text) cho ảnh thứ ${missingIdx + 1}. Đây là trường bắt buộc để tối ưu SEO.`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const submitPayload: Partial<OfficeBuilding> = {
        ...formData,
        latitude: formData.latitude !== undefined && formData.latitude !== null && !isNaN(Number(formData.latitude))
          ? Number(formData.latitude)
          : undefined,
        longitude: formData.longitude !== undefined && formData.longitude !== null && !isNaN(Number(formData.longitude))
          ? Number(formData.longitude)
          : undefined,
        seo_metadata: {
          ...formData.seo_metadata,
          keywords: typeof formData.seo_metadata?.keywords === 'string'
            ? (formData.seo_metadata.keywords as string)
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean) as any
            : (formData.seo_metadata?.keywords || []) as any,
        },
      };
      await onSave(submitPayload);
      onClose();
    } catch (err) {
      setSubmitError('Lỗi lưu tòa nhà: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Navigation between tabs
  const currentTabIndex = TABS.findIndex((t) => t.id === activeTab);
  const handlePrevTab = () => {
    if (currentTabIndex > 0) setActiveTab(TABS[currentTabIndex - 1].id);
  };
  const handleNextTab = () => {
    if (currentTabIndex < TABS.length - 1) setActiveTab(TABS[currentTabIndex + 1].id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-zinc-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* ================= MODAL HEADER ================= */}
        <div className="px-6 py-4 border-b border-zinc-200 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight text-white">
                  {formData.id ? `Chỉnh sửa: ${formData.name || 'Tòa nhà'}` : 'Soạn thảo tòa nhà văn phòng mới'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-amber-500/20 text-[#D4AF37] border border-[#D4AF37]/30">
                  {formData.id ? 'Bản lưu CMS' : 'Khởi tạo'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Thiết lập đầy đủ thông tin chuẩn SEO, thông số kỹ thuật, giá thuê và hình ảnh thực tế
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center justify-center"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ================= TAB NAVIGATION BAR ================= */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-zinc-50 border-b border-zinc-200 overflow-x-auto shrink-0 scrollbar-none">
          {TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-sm ring-1 ring-zinc-900'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    isActive ? 'bg-[#D4AF37] text-zinc-950' : 'text-zinc-400 group-hover:text-zinc-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span>{tab.label}</span>
                {tab.id === 'gallery' && currentGallery.length > 0 && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-amber-400/20 text-[#D4AF37]' : 'bg-zinc-200 text-zinc-700'
                    }`}
                  >
                    {currentGallery.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ================= FORM BODY ================= */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {submitError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 font-medium">{submitError}</div>
            </div>
          )}

          {/* ================= TAB 1: THÔNG TIN CƠ BẢN ================= */}
          {activeTab === 'basic' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Định danh */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#AA820A]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Định danh tòa nhà & Phân hạng
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Tên tòa nhà văn phòng <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Bitexco Financial Tower, Saigon Centre..."
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-sm font-medium text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white transition-all"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-zinc-700">
                        Đường dẫn tĩnh (Slug URL)
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateSlug}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#AA820A] hover:text-[#8D6B08] transition-colors"
                      >
                        <Wand2 className="w-3 h-3" /> Tự tạo từ tên
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="bitexco-financial-tower"
                      value={formData.slug || ''}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-mono text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Đường dẫn URL chi tiết: /dich-vu-cho-thue/office/<strong>{formData.slug || 'slug-toa-nha'}</strong>
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Chứng chỉ công trình xanh (Certification)
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: LEED Gold, LEED Platinum, Green Mark..."
                      value={formData.certification || ''}
                      onChange={(e) => setFormData({ ...formData, certification: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Hiển thị thành huy hiệu xanh trang nhã ở đầu trang chi tiết nếu có
                    </p>
                  </div>
                </div>

                {/* Chọn hạng tòa nhà A / B / C */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-2">
                    Phân hạng tiêu chuẩn tòa nhà (Building Grade)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        val: 'A',
                        label: 'Hạng A (Cao cấp nhất)',
                        desc: 'Tòa nhà biểu tượng, trung tâm tài chính, tiêu chuẩn quốc tế',
                        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
                      },
                      {
                        val: 'B',
                        label: 'Hạng B (Tiêu chuẩn cao)',
                        desc: 'Vị trí thuận tiện, tối ưu chi phí, quản lý chuyên nghiệp',
                        badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
                      },
                      {
                        val: 'C',
                        label: 'Hạng C (Tiết kiệm)',
                        desc: 'Chi phí hợp lý cho doanh nghiệp khởi nghiệp hoặc SME',
                        badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300',
                      },
                    ].map((g) => {
                      const isSelected = (formData.building_grade || formData.grade || 'A') === g.val;
                      return (
                        <div
                          key={g.val}
                          onClick={() => setFormData({ ...formData, building_grade: g.val as any })}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#D4AF37] bg-amber-50/50 shadow-sm'
                              : 'border-zinc-200 bg-white hover:border-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-zinc-900">{g.label}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#AA820A]" />}
                          </div>
                          <p className="text-[11px] text-zinc-500 leading-tight">{g.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Địa chỉ & Khu vực */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#AA820A]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Địa chỉ & Khu vực tòa nhà
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Địa chỉ chi tiết <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: 02 Hải Triều, Phường Bến Nghé"
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Quận / Huyện <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Quận 1, Quận Bình Thạnh..."
                      value={formData.district || ''}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Tỉnh / Thành phố
                    </label>
                    <input
                      type="text"
                      placeholder="TP. Hồ Chí Minh"
                      value={formData.city || 'TP. Hồ Chí Minh'}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Mã tham chiếu nội bộ (Code)
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: BTX-Q1"
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: THÔNG SỐ KỸ THUẬT ================= */}
          {activeTab === 'specs' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Quy mô & kết cấu */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#AA820A]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Quy mô cấu trúc & Kích thước sàn
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Số tầng nổi</label>
                    <input
                      type="number"
                      placeholder="Ví dụ: 25"
                      value={formData.total_floors || ''}
                      onChange={(e) => setFormData({ ...formData, total_floors: parseInt(e.target.value, 10) || '' })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Số tầng hầm</label>
                    <input
                      type="number"
                      placeholder="Ví dụ: 3"
                      value={formData.basements || ''}
                      onChange={(e) => setFormData({ ...formData, basements: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Diện tích sàn điển hình
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 1.029 m²"
                      value={formData.typical_floor_area || ''}
                      onChange={(e) => setFormData({ ...formData, typical_floor_area: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Chiều cao trần hoàn thiện
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 2.7 m"
                      value={formData.ceiling_height || ''}
                      onChange={(e) => setFormData({ ...formData, ceiling_height: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Hướng tòa nhà</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Đông Nam, Nam..."
                      value={formData.direction || ''}
                      onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Năm hoàn thành</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 2023"
                      value={formData.year_completed || ''}
                      onChange={(e) => setFormData({ ...formData, year_completed: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>

              {/* Hệ thống vận hành & kỹ thuật */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#AA820A]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Hệ thống kỹ thuật & Đơn vị quản lý
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Hệ thống thang máy
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 4 thang tốc độ cao Schindler + 1 thang hàng"
                      value={formData.elevators || ''}
                      onChange={(e) => setFormData({ ...formData, elevators: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Hệ thống điều hòa
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Chiller trung tâm thông minh Daikin VRV"
                      value={formData.air_conditioning || ''}
                      onChange={(e) => setFormData({ ...formData, air_conditioning: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Máy phát điện dự phòng
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 100% công suất tự động chuyển mạch Cummins"
                      value={formData.electricity_backup || ''}
                      onChange={(e) => setFormData({ ...formData, electricity_backup: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Đơn vị quản lý vận hành
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Savills, CBRE, Colliers hoặc Ban quản lý"
                      value={formData.management_company || ''}
                      onChange={(e) => setFormData({ ...formData, management_company: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: GIÁ THUÊ & CHI PHÍ ================= */}
          {activeTab === 'pricing' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Khung giá & Phí quản lý */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#AA820A]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Khoảng giá thuê & Phí quản lý dịch vụ
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Giá tối thiểu ($/m²/tháng)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Ví dụ: 35"
                      value={formData.price_per_sqm_min || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price_per_sqm_min: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Giá tối đa ($/m²/tháng)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Ví dụ: 45"
                      value={formData.price_per_sqm_max || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          price_per_sqm_max: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Phí quản lý ($/m²/tháng)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Ví dụ: 6.5"
                      value={formData.management_fee_per_sqm || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          management_fee_per_sqm: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>

              {/* Chi phí phụ trợ & Điều khoản thuê */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-[#AA820A]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Chi phí phụ trợ & Điều khoản hợp đồng
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Phí gửi xe máy
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 250.000 VNĐ/xe/tháng"
                      value={formData.motorcycle_parking_fee || ''}
                      onChange={(e) => setFormData({ ...formData, motorcycle_parking_fee: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Phí gửi xe ô tô
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 2.500.000 VNĐ/xe/tháng"
                      value={formData.car_parking_fee || ''}
                      onChange={(e) => setFormData({ ...formData, car_parking_fee: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Điện lạnh / Tiêu thụ
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Đã gồm trong phí dịch vụ"
                      value={formData.electricity_fee || ''}
                      onChange={(e) => setFormData({ ...formData, electricity_fee: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Phí làm ngoài giờ
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Thỏa thuận với tòa nhà"
                      value={formData.overtime_fee || ''}
                      onChange={(e) => setFormData({ ...formData, overtime_fee: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Thời hạn thuê tối thiểu
                    </label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Từ 2 năm"
                      value={formData.lease_term_min || ''}
                      onChange={(e) => setFormData({ ...formData, lease_term_min: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Thuế VAT</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 10%"
                      value={formData.vat_tax || ''}
                      onChange={(e) => setFormData({ ...formData, vat_tax: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Tiền đặt cọc</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 3 tháng tiền thuê"
                      value={formData.deposit_term || ''}
                      onChange={(e) => setFormData({ ...formData, deposit_term: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Kỳ thanh toán</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Theo quý / Theo tháng"
                      value={formData.payment_term || ''}
                      onChange={(e) => setFormData({ ...formData, payment_term: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: THƯ VIỆN HÌNH ẢNH ================= */}
          {activeTab === 'gallery' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#AA820A]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950">
                      Hình ảnh thực tế tòa nhà & Tối ưu SEO Alt Text ({currentGallery.length} ảnh)
                    </h4>
                  </div>
                  <p className="text-xs text-amber-800/80 mt-0.5">
                    Ảnh chụp mặt tiền, sảnh lễ tân, sàn làm việc, hầm xe. Mỗi ảnh bắt buộc có Alt Text để đạt chuẩn SEO Google.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {currentGallery.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAiGenerateAllAlts}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-[#856306] text-xs font-bold transition-all shadow-xs"
                      title="AI tự động phân tích và tạo mới Alt text độc nhất cho toàn bộ ảnh trong thư viện"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#B89327]" /> AI sinh lại toàn bộ Alt tránh trùng
                    </button>
                  )}

                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[#D4AF37] hover:text-white text-xs font-semibold shadow transition-all shrink-0">
                    {uploadingImages ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingImages ? 'Đang tải lên...' : 'Tải thêm ảnh từ máy'}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      disabled={uploadingImages}
                      className="hidden"
                      onChange={(e) => handleUploadImages(e.target.files)}
                    />
                  </label>
                </div>
              </div>

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {currentGallery.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-12 border-2 border-dashed border-zinc-300 hover:border-[#D4AF37] bg-zinc-50/50 hover:bg-amber-50/20 rounded-2xl text-center cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#AA820A] flex items-center justify-center mx-auto mb-3 shadow-sm border border-amber-200/50">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-zinc-900">
                    Chưa có hình ảnh nào cho tòa nhà này. Nhấn để tải ảnh lên.
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Định dạng JPG, PNG, WEBP • Tối đa 50MB/ảnh • Hỗ trợ tải nhiều ảnh cùng lúc • AI tự động sinh Alt tránh trùng
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentGallery.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-4 rounded-2xl border border-zinc-200 bg-white flex flex-col sm:flex-row gap-4 items-start shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Thumbnail Preview */}
                      <div className="relative w-full sm:w-36 aspect-video sm:aspect-square rounded-xl overflow-hidden border border-zinc-200 bg-zinc-900 shrink-0">
                        <img
                          src={item.url}
                          alt={item.alt_text || 'Ảnh tòa nhà'}
                          className="w-full h-full object-cover"
                        />
                        {item.is_primary && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[#D4AF37] text-zinc-950 text-[10px] font-extrabold shadow flex items-center gap-1">
                            <Star className="w-3 h-3 fill-zinc-950" /> Ảnh chính
                          </span>
                        )}
                      </div>

                      {/* SEO Alt & Caption Controls */}
                      <div className="w-full space-y-2.5">
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="flex items-center gap-1.5">
                              <label className="block text-[11px] font-bold text-zinc-800">
                                Văn bản thay thế (Alt text) <span className="text-red-500">*</span>
                              </label>
                              <button
                                type="button"
                                onClick={() => handleAiGenerateSingleAlt(idx)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-[#AA820A] bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors"
                                title="AI tạo Alt text riêng cho ảnh này tránh trùng với các ảnh khác"
                              >
                                <Sparkles className="w-3 h-3 text-[#AA820A]" /> AI gợi ý
                              </button>
                            </div>
                            <span
                              className={`text-[10px] font-medium ${
                                (item.alt_text || '').length > 0 ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              {(item.alt_text || '').length} ký tự
                            </span>
                          </div>
                          <input
                            type="text"
                            value={item.alt_text || ''}
                            onChange={(e) => handleUpdateImageAlt(idx, e.target.value)}
                            placeholder="Ví dụ: Mặt tiền tòa nhà Bitexco Financial Tower Quận 1"
                            className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-zinc-600 mb-0.5">
                            Chú thích ảnh (Caption hiển thị phóng to)
                          </label>
                          <input
                            type="text"
                            value={item.caption || ''}
                            onChange={(e) => handleUpdateImageCaption(idx, e.target.value)}
                            placeholder="Ví dụ: Sảnh đón tiếp tiêu chuẩn 5 sao"
                            className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white focus:outline-none focus:border-[#D4AF37]"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryImage(idx)}
                            className={`text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                              item.is_primary
                                ? 'bg-amber-100 text-amber-900 font-semibold'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                            }`}
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${item.is_primary ? 'fill-amber-700 text-amber-700' : 'text-zinc-400'}`}
                            />
                            {item.is_primary ? 'Đang là ảnh chính' : 'Đặt làm ảnh chính'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Xóa
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 5: VỊ TRÍ & BẢN ĐỒ ================= */}
          {activeTab === 'location' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Google Maps Embed URL */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#AA820A]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Bản đồ định vị Google Maps
                  </h4>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Link nhúng Google Maps iframe (Map Embed URL - Tùy chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="https://www.google.com/maps/embed?pb=!1m18!1m12!..."
                    value={formData.map_embed_url || ''}
                    onChange={(e) => setFormData({ ...formData, map_embed_url: e.target.value })}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Mẹo: Vào Google Maps → Chia sẻ → Nhúng bản đồ → Sao chép link trong thuộc tính <code>src=&quot;...&quot;</code>. Nếu để trống, hệ thống sẽ tự động tìm theo địa chỉ và quận của tòa nhà.
                  </p>
                </div>
              </div>

              {/* 4 Đặc điểm kết nối giao thông */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#AA820A]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                      4 Điểm nổi bật về vị trí & kết nối giao thông
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Hiển thị thành 4 thẻ thông tin nổi bật ngay dưới bản đồ định vị trên trang chi tiết tòa nhà.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[0, 1, 2, 3].map((idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-zinc-200 bg-white space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-700">
                        <span className="w-4 h-4 rounded-full bg-amber-100 text-[#AA820A] flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <span>Điểm nổi bật #{idx + 1}</span>
                      </div>
                      <input
                        type="text"
                        value={formData.location_highlights?.[idx] || ''}
                        placeholder={
                          idx === 0
                            ? 'Ví dụ: Kết nối nhanh đến trung tâm tài chính Quận 1 (5 phút)'
                            : idx === 1
                            ? 'Ví dụ: Gần sông Sài Gòn mang lại tầm nhìn thoáng đãng'
                            : idx === 2
                            ? 'Ví dụ: Liền kề các ngân hàng lớn và cơ quan hành chính'
                            : 'Ví dụ: Dễ dàng tiếp cận qua tuyến Metro số 1 Bến Thành - Suối Tiên'
                        }
                        onChange={(e) => {
                          const cur = [...(formData.location_highlights || ['', '', '', ''])];
                          cur[idx] = e.target.value;
                          setFormData({ ...formData, location_highlights: cur });
                        }}
                        className="w-full px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs bg-zinc-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 6: TIỆN ÍCH & MÔ TẢ ================= */}
          {activeTab === 'content' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Tiện ích tòa nhà */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#AA820A]" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                      Hệ thống tiện ích & dịch vụ tòa nhà
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Nhập mỗi tiện ích trên một dòng, hoặc nhấp vào các tiện ích gợi ý bên dưới để thêm nhanh.
                  </p>
                </div>

                {/* Gợi ý nhanh tiện ích */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-1.5">
                    Gợi ý tiện ích phổ biến (Bấm để thêm hoặc bỏ):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_AMENITIES.map((am) => {
                      const list = Array.isArray(formData.amenities) ? formData.amenities : [];
                      const isIncluded = list.some((item) => item.toLowerCase() === am.toLowerCase());
                      return (
                        <button
                          key={am}
                          type="button"
                          onClick={() => handleToggleAmenity(am)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                            isIncluded
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold'
                              : 'bg-white text-zinc-600 border border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          {isIncluded ? '✓ ' : '+ '}
                          {am}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Danh sách tiện ích thực tế ({Array.isArray(formData.amenities) ? formData.amenities.length : 0} tiện ích)
                  </label>
                  <textarea
                    rows={4}
                    value={Array.isArray(formData.amenities) ? formData.amenities.join('\n') : ''}
                    onChange={(e) => {
                      const list = e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setFormData({ ...formData, amenities: list });
                    }}
                    placeholder="4 thang máy tốc độ cao Schindler&#10;Máy phát điện dự phòng Cummins 100% công suất&#10;Bãi đỗ xe 2 tầng hầm rộng rãi&#10;Lễ tân tiếp đón & an ninh 24/7"
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Mô tả chi tiết tòa nhà */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#AA820A]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                    Bài viết mô tả chi tiết tòa nhà (Mục Tổng quan)
                  </h4>
                </div>
                <p className="text-xs text-zinc-500">
                  Nội dung này hiển thị trực tiếp tại mục Tổng quan tòa nhà trên trang chi tiết khách hàng xem. Có thể chia thành nhiều đoạn văn bằng cách nhấn Enter.
                </p>

                <textarea
                  rows={6}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Nhập bài viết giới thiệu tòa nhà: Vị trí chiến lược, kiến trúc thiết kế, ưu thế cho các doanh nghiệp đặt trụ sở tại đây..."
                  className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-xs bg-white leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                />
              </div>
            </div>
          )}

          {/* ================= TAB 7: CẤU HÌNH SEO / GEO ================= */}
          {activeTab === 'seo' && (
            <div className="space-y-6">
              {/* Header Card with AI Generator */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-zinc-50 to-amber-50/40 border border-amber-200/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D4AF37] text-zinc-950 flex items-center justify-center font-bold shadow-sm shrink-0">
                    <Sparkles className="w-5 h-5 fill-zinc-950" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                      Cấu hình SEO Onpage & Tín hiệu Định vị GEO
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Tối ưu hóa thẻ Meta Title, Meta Description, từ khóa và tọa độ GPS Local SEO cho Google & AI Search.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAiGenerateSeo}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold shadow transition-all shrink-0"
                >
                  <Wand2 className="w-4 h-4" /> AI tự động viết SEO chuẩn Google
                </button>
              </div>

              {/* Google SERP Snippet Preview */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" /> Xem trước kết quả tìm kiếm Google (SERP Preview)
                  </span>
                  <span className="text-[10px] text-zinc-400">Google Desktop / Mobile Search</span>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80 space-y-1 font-sans">
                  {/* URL */}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-600 truncate">
                    <span className="text-zinc-500">https://maianhomes.com</span>
                    <span className="text-zinc-400">›</span>
                    <span className="text-zinc-600">dich-vu-cho-thue</span>
                    <span className="text-zinc-400">›</span>
                    <span className="text-zinc-600">office</span>
                    <span className="text-zinc-400">›</span>
                    <span className="text-zinc-800 font-medium">{formData.slug || 'slug-toa-nha'}</span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base sm:text-lg text-[#1a0dab] hover:underline font-medium leading-snug cursor-pointer line-clamp-1">
                    {formData.seo_metadata?.title || (formData.name ? `Cho Thuê Văn Phòng ${formData.name} ${formData.district || ''} - Mai An Homes` : 'Tiêu đề tòa nhà văn phòng cho thuê | Mai An Homes')}
                  </h3>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-[#4d5156] leading-relaxed line-clamp-2">
                    {formData.seo_metadata?.description || formData.description || 'Thông tin cho thuê văn phòng chuyên nghiệp tại TP.HCM. Cập nhật diện tích trống, giá thuê và các tiện ích chi tiết.'}
                  </p>
                </div>
              </div>

              {/* Meta Title & Meta Description Form */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-5 shadow-sm">
                {/* Meta Title */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-zinc-800">
                      Thẻ Meta Title (Tiêu đề SEO)
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold ${
                          (formData.seo_metadata?.title?.length || 0) === 0
                            ? 'text-zinc-400'
                            : (formData.seo_metadata?.title?.length || 0) >= 40 && (formData.seo_metadata?.title?.length || 0) <= 65
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {(formData.seo_metadata?.title?.length || 0)} / 65 ký tự
                      </span>
                      <span className="text-[10px] text-zinc-400">(Khuyên dùng: 40-65 ký tự)</span>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={formData.seo_metadata?.title || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        seo_metadata: {
                          ...formData.seo_metadata,
                          title: e.target.value,
                        },
                      })
                    }
                    placeholder={`Ví dụ: Cho Thuê Văn Phòng ${formData.name || 'Tòa Nhà'} ${formData.district || 'Quận 1'} | Mai An Homes`}
                    className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                  />
                </div>

                {/* Meta Description */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-zinc-800">
                      Thẻ Meta Description (Mô tả SEO)
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-semibold ${
                          (formData.seo_metadata?.description?.length || 0) === 0
                            ? 'text-zinc-400'
                            : (formData.seo_metadata?.description?.length || 0) >= 120 && (formData.seo_metadata?.description?.length || 0) <= 165
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {(formData.seo_metadata?.description?.length || 0)} / 165 ký tự
                      </span>
                      <span className="text-[10px] text-zinc-400">(Khuyên dùng: 120-165 ký tự)</span>
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    value={formData.seo_metadata?.description || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        seo_metadata: {
                          ...formData.seo_metadata,
                          description: e.target.value,
                        },
                      })
                    }
                    placeholder="Mô tả tóm tắt tòa nhà hấp dẫn, có chứa từ khóa và lời kêu gọi hành động (CTA)..."
                    className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                  />
                </div>

                {/* Focus Keyword & Keywords */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1">
                      Từ khóa chính (Focus Keyword)
                    </label>
                    <input
                      type="text"
                      value={formData.seo_metadata?.focus_keyword || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          seo_metadata: {
                            ...formData.seo_metadata,
                            focus_keyword: e.target.value,
                          },
                        })
                      }
                      placeholder={`Ví dụ: cho thuê văn phòng ${formData.name || 'tòa nhà'}`}
                      className="w-full px-3.5 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1">
                      Từ khóa phụ (Keywords, cách nhau bằng dấu phẩy)
                    </label>
                    <input
                      type="text"
                      value={formData.seo_metadata?.keywords || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          seo_metadata: {
                            ...formData.seo_metadata,
                            keywords: e.target.value,
                          },
                        })
                      }
                      placeholder="Ví dụ: văn phòng hạng a, thuê văn phòng quận 1, văn phòng cao cấp"
                      className="w-full px-3.5 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* H1 Override & Canonical URL & Robots */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1">
                      Thẻ H1 tùy chỉnh (Tiêu đề chính)
                    </label>
                    <input
                      type="text"
                      value={formData.seo_metadata?.h1 || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          seo_metadata: {
                            ...formData.seo_metadata,
                            h1: e.target.value,
                          },
                        })
                      }
                      placeholder={formData.name || 'Để trống sẽ lấy tên tòa nhà'}
                      className="w-full px-3.5 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1">
                      Canonical URL (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={formData.seo_metadata?.canonical_url || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          seo_metadata: {
                            ...formData.seo_metadata,
                            canonical_url: e.target.value,
                          },
                        })
                      }
                      placeholder="https://maianhomes.com/dich-vu-cho-thue/office/..."
                      className="w-full px-3.5 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1">
                      Chỉ thị Robots (Robots Tag)
                    </label>
                    <select
                      value={formData.seo_metadata?.robots || 'index, follow'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          seo_metadata: {
                            ...formData.seo_metadata,
                            robots: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3.5 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    >
                      <option value="index, follow">index, follow (Cho phép Google index - Mặc định)</option>
                      <option value="noindex, follow">noindex, follow (Không index, theo dõi link)</option>
                      <option value="index, nofollow">index, nofollow (Index, không theo dõi link)</option>
                      <option value="noindex, nofollow">noindex, nofollow (Chặn hoàn toàn bọ tìm kiếm)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tọa độ Định vị GEO Local SEO */}
              <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#AA820A]" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                      Tọa độ Địa lý GEO / Local SEO (GPS Coordinates)
                    </h4>
                    <p className="text-[11px] text-zinc-500">
                      Tự động xuất thành thẻ Meta <code>geo.position</code>, <code>ICBM</code> và Schema.org <code>GeoCoordinates</code> giúp Google Maps và AI Search nhận diện chính xác vị trí.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1">
                      Vĩ độ (Latitude)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.latitude ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          latitude: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        })
                      }
                      placeholder="Ví dụ: 10.7718"
                      className="w-full px-3.5 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-800 mb-1">
                      Kinh độ (Longitude)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formData.longitude ?? ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          longitude: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        })
                      }
                      placeholder="Ví dụ: 106.7042"
                      className="w-full px-3.5 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                {formData.latitude && formData.longitude && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Tọa độ hợp lệ: <strong>{formData.latitude}, {formData.longitude}</strong>. Thẻ Meta GEO và Schema JSON-LD đã sẵn sàng hoạt động tối ưu.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= MODAL FOOTER ACTIONS ================= */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-zinc-200 mt-6 shrink-0">
            {/* Step navigation buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {currentTabIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrevTab}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Quay lại: {TABS[currentTabIndex - 1].label}
                </button>
              )}

              {currentTabIndex < TABS.length - 1 && (
                <button
                  type="button"
                  onClick={handleNextTab}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition-colors"
                >
                  Tiếp theo: {TABS[currentTabIndex + 1].label} <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition-colors"
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang lưu vào CMS...' : 'Lưu tòa nhà'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
