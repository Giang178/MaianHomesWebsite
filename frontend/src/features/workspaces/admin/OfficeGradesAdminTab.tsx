'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  ExternalLink,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  HelpCircle,
  Sparkles,
  Layers,
  Sliders,
  Search,
  Globe,
} from 'lucide-react';
import { workspaceApi } from '../api';
import { WorkspaceImageUploader } from './WorkspaceImageUploader';
import { GRADE_CONFIGS, OfficeGradeType } from '../components/OfficeGradeView';

interface SpecItem {
  label: string;
  value: string;
  desc: string;
}

interface CriteriaItem {
  title: string;
  desc: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface GradePageConfig {
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
  specs: SpecItem[];
  criteriaList: CriteriaItem[];
  faqs: FaqItem[];
  seo?: {
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string;
  };
}

const normalizeGradeConfig = (grade: OfficeGradeType, loaded?: any): GradePageConfig => {
  const base = GRADE_CONFIGS[grade];
  const specs = (loaded?.specs && Array.isArray(loaded.specs) && loaded.specs.length > 0)
    ? loaded.specs
    : base.specs;
  const criteriaList = (loaded?.criteriaList && Array.isArray(loaded.criteriaList) && loaded.criteriaList.length > 0)
    ? loaded.criteriaList
    : base.criteriaList;
  const faqs = (loaded?.faqs && Array.isArray(loaded.faqs) && loaded.faqs.length > 0)
    ? loaded.faqs
    : base.faqs;

  return {
    grade,
    slug: loaded?.slug || `hang-${grade.toLowerCase()}`,
    name: (loaded?.name && typeof loaded.name === 'string' && loaded.name.trim()) ? loaded.name : base.name,
    badge: (loaded?.badge && typeof loaded.badge === 'string' && loaded.badge.trim()) ? loaded.badge : base.badge,
    tagline: (loaded?.tagline && typeof loaded.tagline === 'string' && loaded.tagline.trim()) ? loaded.tagline : base.tagline,
    description: (loaded?.description && typeof loaded.description === 'string' && loaded.description.trim()) ? loaded.description : base.description,
    heroImage: (loaded?.heroImage && typeof loaded.heroImage === 'string' && loaded.heroImage.trim()) ? loaded.heroImage : base.heroImage,
    hero_alt_text: loaded?.hero_alt_text !== undefined ? loaded.hero_alt_text : (base.hero_alt_text || ''),
    priceDisplay: (loaded?.priceDisplay && typeof loaded.priceDisplay === 'string' && loaded.priceDisplay.trim()) ? loaded.priceDisplay : base.priceDisplay,
    targetAudience: (loaded?.targetAudience && typeof loaded.targetAudience === 'string' && loaded.targetAudience.trim()) ? loaded.targetAudience : base.targetAudience,
    specs: [0, 1, 2, 3].map((idx) => {
      const item = specs[idx] || {};
      const def = base.specs[idx] || { label: '', value: '', desc: '' };
      return {
        label: item.label !== undefined && item.label !== '' ? item.label : def.label,
        value: item.value !== undefined && item.value !== '' ? item.value : def.value,
        desc: item.desc !== undefined && item.desc !== '' ? item.desc : def.desc,
      };
    }),
    criteriaList: [0, 1, 2, 3].map((idx) => {
      const item = criteriaList[idx] || {};
      const def = base.criteriaList[idx] || { title: '', desc: '' };
      return {
        title: item.title !== undefined && item.title !== '' ? item.title : def.title,
        desc: item.desc !== undefined && item.desc !== '' ? item.desc : def.desc,
      };
    }),
    faqs,
    seo: {
      meta_title: loaded?.seo?.meta_title || '',
      meta_description: loaded?.seo?.meta_description || '',
      meta_keywords: loaded?.seo?.meta_keywords || '',
    },
  };
};

const INITIAL_GRADE_PAGES: Record<OfficeGradeType, GradePageConfig> = {
  A: normalizeGradeConfig('A'),
  B: normalizeGradeConfig('B'),
  C: normalizeGradeConfig('C'),
};

export interface OfficeGradesAdminTabProps {
  onSaved?: (updatedLanding: any) => void;
}

export function OfficeGradesAdminTab({ onSaved }: OfficeGradesAdminTabProps = {}) {
  const [activeGrade, setActiveGrade] = useState<OfficeGradeType>('A');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [landingRaw, setLandingRaw] = useState<any>(null);
  const [gradeConfigs, setGradeConfigs] = useState<Record<OfficeGradeType, GradePageConfig>>(INITIAL_GRADE_PAGES);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await workspaceApi.getAdminOfficeLanding();
      if (data?.landing) {
        setLandingRaw(data.landing);
        const gp = data.landing.grade_pages || {};
        setGradeConfigs({
          A: normalizeGradeConfig('A', gp.A),
          B: normalizeGradeConfig('B', gp.B),
          C: normalizeGradeConfig('C', gp.C),
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Lỗi tải dữ liệu Office Landing: ' + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentConfig = gradeConfigs[activeGrade];

  const updateCurrentConfig = (field: keyof GradePageConfig, value: any) => {
    setGradeConfigs((prev) => ({
      ...prev,
      [activeGrade]: {
        ...prev[activeGrade],
        [field]: value,
      },
    }));
  };

  const updateSpecItem = (index: number, field: keyof SpecItem, val: string) => {
    const base = GRADE_CONFIGS[activeGrade].specs;
    const list = [...(currentConfig.specs || [])];
    while (list.length < 4) {
      const idx = list.length;
      list.push({ ...(base[idx] || { label: '', value: '', desc: '' }) });
    }
    list[index] = { ...list[index], [field]: val };
    updateCurrentConfig('specs', list);
  };

  const updateCriteriaItem = (index: number, field: keyof CriteriaItem, val: string) => {
    const base = GRADE_CONFIGS[activeGrade].criteriaList;
    const list = [...(currentConfig.criteriaList || [])];
    while (list.length < 4) {
      const idx = list.length;
      list.push({ ...(base[idx] || { title: '', desc: '' }) });
    }
    list[index] = { ...list[index], [field]: val };
    updateCurrentConfig('criteriaList', list);
  };

  const handleAddFaq = () => {
    const list = [...(currentConfig.faqs || [])];
    list.push({
      question: 'Câu hỏi mới về thuê văn phòng Hạng ' + activeGrade + '?',
      answer: 'Nội dung giải đáp chi tiết cho khách hàng...',
    });
    updateCurrentConfig('faqs', list);
  };

  const handleRemoveFaq = (index: number) => {
    const list = (currentConfig.faqs || []).filter((_, idx) => idx !== index);
    updateCurrentConfig('faqs', list);
  };

  const handleUpdateFaq = (index: number, field: 'question' | 'answer', val: string) => {
    const list = [...(currentConfig.faqs || [])];
    if (list[index]) {
      list[index] = { ...list[index], [field]: val };
      updateCurrentConfig('faqs', list);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setNotification(null);
    try {
      const payloadLanding = {
        ...(landingRaw || {}),
        grade_pages: gradeConfigs,
      };

      const updated = await workspaceApi.updateAdminOfficeLanding({
        landing: payloadLanding,
        faqs: landingRaw?.faqs || [],
      });

      if (updated) {
        setLandingRaw(updated);
        const gp = updated.grade_pages || gradeConfigs;
        setGradeConfigs({
          A: normalizeGradeConfig('A', gp.A),
          B: normalizeGradeConfig('B', gp.B),
          C: normalizeGradeConfig('C', gp.C),
        });
        if (onSaved) {
          onSaved(updated);
        }
      }

      setNotification({
        type: 'success',
        message: `Đã lưu thành công cấu hình cho các trang Phân Hạng A, B, C!`,
      });
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Lỗi lưu dữ liệu: ' + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-3 text-[#D4AF37]" />
        Đang tải cấu hình các trang Phân Hạng A - B - C...
      </div>
    );
  }

  const gradeColors: Record<OfficeGradeType, { badge: string; border: string; bg: string; text: string }> = {
    A: {
      badge: 'bg-amber-100 text-amber-900 border-amber-300',
      border: 'border-amber-400',
      bg: 'bg-amber-50/60',
      text: 'text-amber-800',
    },
    B: {
      badge: 'bg-blue-100 text-blue-900 border-blue-300',
      border: 'border-blue-400',
      bg: 'bg-blue-50/60',
      text: 'text-blue-800',
    },
    C: {
      badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      border: 'border-emerald-400',
      bg: 'bg-emerald-50/60',
      text: 'text-emerald-800',
    },
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-zinc-900">Thiết lập Trang Chi Tiết Phân Hạng A - B - C</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#D4AF37]/20 text-[#AA820A] border border-[#D4AF37]/30">
              Trang Con Độc Lập
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Quản trị ảnh Banner lớn, khẩu hiệu định vị, 4 thông số kỹ thuật tiêu chuẩn, tiêu chí phân hạng và câu hỏi thường gặp (FAQs) cho từng trang: <code>/office/hang-a</code>, <code>/office/hang-b</code>, <code>/office/hang-c</code>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/dich-vu-cho-thue/office/${currentConfig.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-zinc-300 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <Building2 className="w-3.5 h-3.5 text-[#D4AF37]" />
            Xem trang Hạng {activeGrade} live <ExternalLink className="w-3 h-3 text-zinc-400" />
          </Link>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#bfa034] text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Đang lưu...' : 'Lưu cấu hình Phân Hạng'}
          </button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Grade Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['A', 'B', 'C'] as OfficeGradeType[]).map((g) => {
          const isSelected = activeGrade === g;
          const conf = gradeConfigs[g];
          const colors = gradeColors[g];
          return (
            <button
              key={g}
              type="button"
              onClick={() => setActiveGrade(g)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                isSelected
                  ? `bg-white ${colors.border} shadow-md ring-2 ring-offset-1 ${colors.border}`
                  : 'bg-zinc-50 border-zinc-200 hover:bg-white hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${colors.badge}`}>
                  Hạng {g}
                </span>
                <span className="text-[11px] text-zinc-400 font-medium">/office/{conf.slug}</span>
              </div>
              <div className="font-bold text-zinc-900 text-sm mt-2">{conf.name}</div>
              <div className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{conf.tagline}</div>
            </button>
          );
        })}
      </div>

      {/* Main Configuration Form for the Active Grade */}
      <div className="space-y-6">
        {/* 1. Header & General Info */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-200">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-bold text-zinc-900">
              1. Tiêu Đề, Khẩu Hiệu & Định Vị (Hạng {activeGrade})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Tên phân hạng *</label>
              <input
                type="text"
                value={currentConfig.name}
                onChange={(e) => updateCurrentConfig('name', e.target.value)}
                placeholder="Văn Phòng Hạng A"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Badge thể loại *</label>
              <input
                type="text"
                value={currentConfig.badge}
                onChange={(e) => updateCurrentConfig('badge', e.target.value)}
                placeholder="TIÊU CHUẨN QUỐC TẾ"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Khoảng giá tham chiếu *</label>
              <input
                type="text"
                value={currentConfig.priceDisplay}
                onChange={(e) => updateCurrentConfig('priceDisplay', e.target.value)}
                placeholder="$35 – $70+ /m²/tháng"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Khẩu hiệu / Tagline định vị *</label>
              <input
                type="text"
                value={currentConfig.tagline}
                onChange={(e) => updateCurrentConfig('tagline', e.target.value)}
                placeholder="Kiến tạo vị thế và biểu tượng thương hiệu cho các tập đoàn dẫn đầu"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Đối tượng doanh nghiệp phù hợp</label>
              <input
                type="text"
                value={currentConfig.targetAudience}
                onChange={(e) => updateCurrentConfig('targetAudience', e.target.value)}
                placeholder="Tập đoàn đa quốc gia, ngân hàng, quỹ tài chính, công nghệ hàng đầu"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Đoạn văn mô tả tổng quan phân hạng</label>
            <textarea
              rows={3}
              value={currentConfig.description}
              onChange={(e) => updateCurrentConfig('description', e.target.value)}
              placeholder="Giới thiệu chi tiết về đặc tính, vị trí, chứng chỉ và lợi thế của phân khúc văn phòng này..."
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
            />
          </div>
        </div>

        {/* 2. Hero Banner Image */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-200">
            <Building2 className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-bold text-zinc-900">
              2. Hình Ảnh Banner Lớn (Hero Banner) Cho Trang Hạng {activeGrade}
            </h3>
          </div>

          <div className="space-y-4">
            <WorkspaceImageUploader
              images={currentConfig.heroImage ? [currentConfig.heroImage] : []}
              onChange={(imgs) => updateCurrentConfig('heroImage', imgs[0] || '')}
              maxFiles={1}
              label={`Ảnh nền Hero Banner trang Hạng ${activeGrade}`}
              description="Tải ảnh kích thước lớn (đề xuất: 1920x1080px, tỉ lệ 16:9). Hệ thống tự động tối ưu hóa kích thước."
              altText={currentConfig.hero_alt_text || ''}
              onAltTextChange={(val) => updateCurrentConfig('hero_alt_text', val)}
              altLabel="Văn bản thay thế (Alt text cho ảnh banner) *"
              altPlaceholder={`Mô tả nội dung ảnh banner Hạng ${activeGrade} cho công cụ tìm kiếm Google...`}
              requireAlt={true}
              entityName={`Văn phòng cho thuê Hạng ${activeGrade}`}
              category="grade"
            />

          </div>
        </div>

        {/* 3. Specifications (4 key specs) */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-200">
            <Sliders className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-bold text-zinc-900">
              3. Bộ 4 Thông Số Kỹ Thuật Tiêu Chuẩn (Specs Grid)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((sIdx) => {
              const spec = (currentConfig.specs || [])[sIdx] || { label: '', value: '', desc: '' };
              const defaultLabels = ['Chiều cao trần', 'Hệ thống điều hòa', 'Hệ thống thang máy', 'Điện dự phòng'];
              const defaultPlaceholders = [
                { label: 'Chiều cao trần', value: '≥ 2.7m', desc: 'Trần hoàn thiện thông thoáng' },
                { label: 'Hệ thống điều hòa', value: 'Chiller BMS', desc: 'Điều hòa trung tâm tiết kiệm điện' },
                { label: 'Hệ thống thang máy', value: '< 30s', desc: 'Thời gian chờ tốc độ cao' },
                { label: 'Điện dự phòng', value: '100%', desc: 'Hệ thống máy phát tự động' },
              ];
              const def = defaultPlaceholders[sIdx] || { label: 'Thông số', value: 'Chuẩn', desc: 'Ghi chú' };

              return (
                <div key={sIdx} className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Thông số #{sIdx + 1}
                  </span>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-0.5">Tên thông số</label>
                    <input
                      type="text"
                      value={spec.label}
                      onChange={(e) => updateSpecItem(sIdx, 'label', e.target.value)}
                      placeholder={def.label}
                      className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-semibold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-0.5">Giá trị đo lường</label>
                    <input
                      type="text"
                      value={spec.value}
                      onChange={(e) => updateSpecItem(sIdx, 'value', e.target.value)}
                      placeholder={def.value}
                      className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-bold text-zinc-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-600 mb-0.5">Ghi chú phụ</label>
                    <input
                      type="text"
                      value={spec.desc}
                      onChange={(e) => updateSpecItem(sIdx, 'desc', e.target.value)}
                      placeholder={def.desc}
                      className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs text-zinc-500 bg-white"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>



        {/* 4. Criteria List */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-zinc-200">
            <Layers className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="text-sm font-bold text-zinc-900">
              4. 4 Tiêu Chuẩn Phân Loại & Đánh Giá Tòa Nhà (Criteria List) Cho Hạng {activeGrade}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(currentConfig.criteriaList || []).map((crit, cIdx) => (
              <div key={cIdx} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Tiêu chuẩn #{cIdx + 1}
                </span>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-0.5">Tiêu đề tiêu chuẩn</label>
                  <input
                    type="text"
                    value={crit.title}
                    onChange={(e) => updateCriteriaItem(cIdx, 'title', e.target.value)}
                    placeholder="Vị trí chiến lược trung tâm..."
                    className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 mb-0.5">Nội dung giải thích</label>
                  <textarea
                    rows={2}
                    value={crit.desc}
                    onChange={(e) => updateCriteriaItem(cIdx, 'desc', e.target.value)}
                    placeholder="Mô tả cụ thể về yêu cầu chất lượng của tiêu chuẩn này..."
                    className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white text-zinc-600"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. FAQs Specific to this Grade */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="text-sm font-bold text-zinc-900">
                5. Câu Hỏi Thường Gặp (FAQs) Dành Riêng Cho Hạng {activeGrade}
              </h3>
            </div>
            <button
              type="button"
              onClick={handleAddFaq}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-lg text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm câu hỏi
            </button>
          </div>

          <div className="space-y-3">
            {(currentConfig.faqs || []).map((faq, fIdx) => (
              <div key={fIdx} className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-zinc-700">Câu hỏi #{fIdx + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFaq(fIdx)}
                    className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa
                  </button>
                </div>
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => handleUpdateFaq(fIdx, 'question', e.target.value)}
                  placeholder="Nhập câu hỏi..."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs font-bold bg-white"
                />
                <textarea
                  rows={2}
                  value={faq.answer}
                  onChange={(e) => handleUpdateFaq(fIdx, 'answer', e.target.value)}
                  placeholder="Nhập câu trả lời..."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs bg-white text-zinc-600"
                />
              </div>
            ))}

            {(currentConfig.faqs || []).length === 0 && (
              <div className="text-center py-6 text-xs text-zinc-400 italic">
                Chưa có câu hỏi thường gặp nào cho Hạng {activeGrade}. Bấm &quot;Thêm câu hỏi&quot; để bổ sung.
              </div>
            )}
          </div>
        </div>

        {/* 6. SEO Metadata for this Grade */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-zinc-200">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="text-sm font-bold text-zinc-900">
                6. Cấu Hình SEO Onpage & SERP Cho Trang Hạng {activeGrade}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                const conf = currentConfig;
                const aiTitle = `Văn Phòng Hạng ${activeGrade} TP.HCM | ${conf.name} - Mai An Homes`.slice(0, 65);
                const aiDesc = `Cho thuê văn phòng Hạng ${activeGrade} cao cấp tại TP.HCM. ${conf.tagline}. Giá thuê ${conf.priceDisplay}, quản lý chuyên nghiệp, cập nhật diện tích sàn trống mới nhất.`.slice(0, 160);
                const aiKeywords = `văn phòng hạng ${activeGrade.toLowerCase()}, thuê văn phòng hạng ${activeGrade.toLowerCase()}, văn phòng cao cấp tphcm`;
                updateCurrentConfig('seo', {
                  ...conf.seo,
                  meta_title: aiTitle,
                  meta_description: aiDesc,
                  meta_keywords: aiKeywords,
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[#AA820A] text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#AA820A]" /> AI gợi ý SEO Hạng {activeGrade}
            </button>
          </div>

          {/* SERP Snippet Preview */}
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-4 space-y-1 font-sans">
            <div className="flex items-center gap-1.5 text-xs text-zinc-600 truncate">
              <span className="text-zinc-500">https://maianhomes.com</span>
              <span className="text-zinc-400">›</span>
              <span className="text-zinc-600">dich-vu-cho-thue</span>
              <span className="text-zinc-400">›</span>
              <span className="text-zinc-600">office</span>
              <span className="text-zinc-400">›</span>
              <span className="text-zinc-800 font-medium">{currentConfig.slug || `hang-${activeGrade.toLowerCase()}`}</span>
            </div>
            <h3 className="text-base sm:text-lg text-[#1a0dab] hover:underline font-medium leading-snug cursor-pointer line-clamp-1">
              {currentConfig.seo?.meta_title || `Cho Thuê Văn Phòng Hạng ${activeGrade} TP.HCM | Mai An Homes`}
            </h3>
            <p className="text-xs sm:text-sm text-[#4d5156] leading-relaxed line-clamp-2">
              {currentConfig.seo?.meta_description || currentConfig.description || `Danh sách tòa nhà văn phòng Hạng ${activeGrade} tiêu chuẩn quốc tế tại TP.HCM.`}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Tiêu đề SEO (Meta Title) *
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold ${
                      (currentConfig.seo?.meta_title?.length || 0) >= 40 && (currentConfig.seo?.meta_title?.length || 0) <= 65
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {(currentConfig.seo?.meta_title?.length || 0)} / 65 ký tự
                  </span>
                  <span className="text-[10px] text-zinc-400">(Khuyên dùng: 40-65 ký tự)</span>
                </div>
              </div>
              <input
                type="text"
                value={currentConfig.seo?.meta_title || ''}
                onChange={(e) =>
                  updateCurrentConfig('seo', {
                    ...currentConfig.seo,
                    meta_title: e.target.value,
                  })
                }
                placeholder={`Maian Office Hạng ${activeGrade} TP.HCM | Tiêu Chuẩn Quốc Tế – Maian Homes`}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-zinc-700">
                  Mô tả SEO (Meta Description) *
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold ${
                      (currentConfig.seo?.meta_description?.length || 0) >= 120 && (currentConfig.seo?.meta_description?.length || 0) <= 165
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {(currentConfig.seo?.meta_description?.length || 0)} / 165 ký tự
                  </span>
                  <span className="text-[10px] text-zinc-400">(Khuyên dùng: 120-165 ký tự)</span>
                </div>
              </div>
              <textarea
                rows={2}
                value={currentConfig.seo?.meta_description || ''}
                onChange={(e) =>
                  updateCurrentConfig('seo', {
                    ...currentConfig.seo,
                    meta_description: e.target.value,
                  })
                }
                placeholder={`Danh sách tòa nhà văn phòng Hạng ${activeGrade} cao cấp bậc nhất TP. Hồ Chí Minh...`}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Từ khóa SEO (Keywords)</label>
              <input
                type="text"
                value={currentConfig.seo?.meta_keywords || ''}
                onChange={(e) =>
                  updateCurrentConfig('seo', {
                    ...currentConfig.seo,
                    meta_keywords: e.target.value,
                  })
                }
                placeholder={`văn phòng hạng ${activeGrade.toLowerCase()}, thuê văn phòng hạng ${activeGrade.toLowerCase()} hcm, tòa nhà leed tp hcm`}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
              />
            </div>
          </div>
        </div>

        {/* Bottom Save Action */}
        <div className="flex justify-end pt-2 pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#bfa034] text-white text-sm font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Đang lưu cấu hình...' : 'Lưu tất cả cấu hình Phân Hạng A - B - C'}
          </button>
        </div>
      </div>
    </div>
  );
}
export default OfficeGradesAdminTab;
