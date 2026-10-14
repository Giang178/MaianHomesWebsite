'use client';
/* eslint-disable @next/next/no-img-element -- Interactive coordinate editors and image previews require intrinsic geometry and direct img targets. */
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getAssetUrl } from '@/lib/api';
import {
  Plus, Trash2, Upload, Loader2, Sparkles, LayoutDashboard,
  BookOpen, MapPin, Layers, PhoneCall,
  AlertTriangle, ArrowLeft, ArrowRight,
  Save, ShieldCheck, Check, Eye, Monitor, Smartphone,
  ExternalLink, Columns
} from 'lucide-react';
import { aiApi } from '@/features/ai/api';
import { projectsApi } from '@/features/content/api/projects';
import {
  DEFAULT_PROJECT_FORM,
  normalizeProjectForm,
  projectImageEntries,
  projectImageMetadata,
  reconcileProjectImageMetadata,
  type AmenityGalleryItem,
  type AmenityItem,
  type FloorLayoutGroup,
  type ProjectFormData,
  type ProjectImageMetadata,
  type ProjectUploadResponse,
  type ProjectStatus,
  type UnitLayout,
  type LocationDistance,
} from './project-form-contract';
import type { ValidationIssue } from '@/features/content/contracts/generated';

export type { ProjectFormData } from './project-form-contract';
export const DEFAULT_FORM = DEFAULT_PROJECT_FORM;

// ─── Image Upload Profile Specifications ────────────────────────────────────
export const IMAGE_UPLOAD_PROFILES = {
  logo: { minWidth: 480, minHeight: 480, aspectRatio: 1, acceptedAspectRatios: [1], label: 'vuông 1:1' },
  hero: { minWidth: 1600, minHeight: 900, aspectRatio: 16 / 9, acceptedAspectRatios: [16 / 9], label: 'ngang 16:9' },
  background: { minWidth: 1600, minHeight: 900, aspectRatio: 16 / 9, acceptedAspectRatios: [16 / 9], label: 'ngang 16:9' },
  content: { minWidth: 1200, minHeight: 900, aspectRatio: 4 / 3, acceptedAspectRatios: [4 / 3, 16 / 9], label: 'ngang 4:3 hoặc 16:9' },
  story: { minWidth: 900, minHeight: 900, aspectRatio: 1, acceptedAspectRatios: [1, 4 / 3, 16 / 9], label: 'vuông 1:1 hoặc ảnh ngang' },
  plan: { minWidth: 900, minHeight: 900, aspectRatio: 1, acceptedAspectRatios: [1, 4 / 3, 16 / 9], label: 'vuông 1:1 hoặc ảnh ngang' },
  globalAmenityPlan: { minWidth: 1200, minHeight: 300, aspectRatio: 4, acceptedAspectRatios: [], acceptAnyLandscape: true, label: 'mọi tỷ lệ ảnh ngang' },
  unitLayout: { minWidth: 600, minHeight: 500, aspectRatio: 6 / 5, acceptedAspectRatios: [6 / 5, 4 / 3, 1, 16 / 9], label: 'tối thiểu 600×500, vuông hoặc ảnh ngang' },
} as const;

export const PROJECT_FORM_TABS = [
  'Khởi tạo & Hero Gallery',
  'Giới thiệu & Quick Facts',
  'Vị trí & Kết nối',
  'Mặt bằng & Thiết kế',
  'Tiện ích đặc quyền',
  'Chủ đầu tư & Liên hệ',
  'Kiểm soát SEO/GEO & FAQ',
] as const;

export const PROJECT_FORM_STEPS = [
  { id: 0, title: 'Khởi tạo & Hero Gallery', icon: LayoutDashboard, desc: 'Tên, giá, hotline, nhãn mở bán & ảnh Hero' },
  { id: 1, title: 'Giới thiệu & Quick Facts', icon: BookOpen, desc: 'Tổng quan, quy mô dự án, 3 ảnh phối cảnh & USPs' },
  { id: 2, title: 'Vị trí & Kết nối', icon: MapPin, desc: 'Địa chỉ, sơ đồ vị trí, Google Maps & cự ly liên kết' },
  { id: 3, title: 'Mặt bằng & Thiết kế', icon: Layers, desc: 'Master Plan, phân tầng & bản vẽ căn hộ' },
  { id: 4, title: 'Tiện ích đặc quyền', icon: Sparkles, desc: 'Bộ sưu tập Bento Grid & danh mục tiện ích' },
  { id: 5, title: 'Chủ đầu tư & Liên hệ', icon: PhoneCall, desc: 'Hồ sơ CĐT, dự án tiêu biểu & thông tin tư vấn' },
  { id: 6, title: 'Kiểm soát SEO/GEO & FAQ', icon: ShieldCheck, desc: 'Tiêu đề SEO, FAQs & AI Generator' },
] as const;

export function projectFieldTab(field: string): number {
  if (field.startsWith('seo_metadata')) return 6;
  if (['contact_', 'primary_color', 'accent_color', 'section_colors', 'developer', 'story_blocks'].some(p => field.startsWith(p))) return 5;
  if (['amenity_floors', 'amenity_map', 'amenity_gallery', 'amenities', 'outdoor_', 'indoor_', 'interior_'].some(p => field.startsWith(p))) return 4;
  if (['floor_layouts', 'master_plan', 'towers'].some(p => field.startsWith(p))) return 3;
  if (['location', 'map_embed_url', 'location_map'].some(p => field.startsWith(p))) return 2;
  if (['description', 'price_range', 'stats', 'overview_'].some(p => field.startsWith(p))) return 1;
  return 0;
}

const PROJECT_FIELD_LABELS: Record<string, string> = {
  name: 'Tên dự án',
  slug: 'Slug URL dự án',
  developer: 'Chủ đầu tư',
  description: 'Mô tả chi tiết',
  location: 'Địa chỉ dự án',
  location_description: 'Mô tả vị trí & kết nối',
  location_distances: 'Khoảng cách đến các điểm lân cận',
  hero_images: 'Ảnh Hero Slider',
  contact_phone: 'Hotline tư vấn',
  contact_email: 'Email nhận tài liệu',
  price_range: 'Khoảng giá',
  story_blocks: 'Câu chuyện thương hiệu',
  'seo_metadata.title': 'Tiêu đề SEO',
  'seo_metadata.description': 'Mô tả Meta SEO',
  'seo_metadata.focus_keyword': 'Từ khóa trọng tâm',
  'seo_metadata.keywords': 'Danh sách từ khóa phụ',
  'seo_metadata.usps': 'Điểm khác biệt USP',
  'seo_metadata.key_facts': 'Dữ kiện chứng minh',
  'seo_metadata.faqs': 'Câu hỏi thường gặp FAQ',
  'seo_metadata.sources': 'Nguồn tham khảo GEO',
};

export function projectIssueLocation(project: ProjectFormData, issue: ValidationIssue) {
  const tab = projectFieldTab(issue.field);
  const image = projectImageEntries(project).find(item => item.field === issue.field);
  let control = image?.label || PROJECT_FIELD_LABELS[issue.field] || issue.field;
  const sourceMatch = issue.field.match(/^seo_metadata\.sources\.(\d+)/);
  const faqMatch = issue.field.match(/^seo_metadata\.faqs\.(\d+)/);
  if (sourceMatch) control = `Nguồn tham khảo GEO #${Number(sourceMatch[1]) + 1}`;
  if (faqMatch) control = `FAQ #${Number(faqMatch[1]) + 1}`;
  if (!image && (issue.code.startsWith('IMAGE_') || issue.code === 'MEDIA_UNAVAILABLE')) {
    control = PROJECT_FIELD_LABELS[issue.field] || 'Ảnh dự án được nêu trong thông báo';
  }
  return {
    step: `Bước ${tab + 1}/${PROJECT_FORM_TABS.length} · ${PROJECT_FORM_TABS[tab]}`,
    control,
  };
}

export function clampAmenityCoordinate(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(100, Math.max(0, Number(parsed.toFixed(1))));
}

export function nextAmenityNumber(amenities?: Array<{ number?: number } | AmenityItem>): number {
  const usedNumbers = new Set(
    (amenities || [])
      .map(item => item?.number)
      .filter((number): number is number => typeof number === 'number' && Number.isInteger(number) && number > 0)
  );
  let next = 1;
  while (usedNumbers.has(next)) next += 1;
  return next;
}

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const ProjectContext = createContext<{
  project: ProjectFormData;
  update: (patch: Partial<ProjectFormData> | ((prev: ProjectFormData) => Partial<ProjectFormData>)) => void;
  notify: (type: 'success' | 'error', message: string) => void;
} | null>(null);

// ─── Reusable Field & Input Primitives ───────────────────────────────────────
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-[#2D1B14] flex items-center gap-1">
          {label}
          {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-white border border-[#E8E0D8] rounded-xl px-3.5 py-2.5 text-sm text-[#2D1B14] placeholder:text-gray-400 focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/15 transition-all disabled:bg-gray-50 disabled:text-gray-400 ${props.className || ''}`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full bg-white border border-[#E8E0D8] rounded-xl p-3.5 text-sm text-[#2D1B14] placeholder:text-gray-400 focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/15 transition-all ${props.className || ''}`}
    />
  );
}

// ─── Image Upload Field Component ───────────────────────────────────────────
interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  field: string;
  label: string;
  profile: keyof typeof IMAGE_UPLOAD_PROFILES;
}

export function ImageUploadField({ value, onChange, field, label, profile }: ImageUploadFieldProps) {
  const ctx = useContext(ProjectContext);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqs = IMAGE_UPLOAD_PROFILES[profile];
  const metadata = ctx ? projectImageMetadata(ctx.project, field, value) : null;
  const currentAlt = metadata?.alt_text || ctx?.project.seo_metadata.image_alts.find(item => item.url === value)?.alt_text || '';

  const updateAlt = (newAlt: string) => {
    if (!ctx) return;
    ctx.update(prev => {
      const nextMeta = {
        field,
        media_id: metadata?.media_id || '',
        url: value,
        alt_text: newAlt,
        width: metadata?.width || 0,
        height: metadata?.height || 0,
        focal_x: metadata?.focal_x ?? 50,
        focal_y: metadata?.focal_y ?? 50,
        variants: metadata?.variants || {},
      };
      const image_metadata = [
        ...prev.image_metadata.filter(item => item.field !== field),
        nextMeta,
      ];
      const image_alts = Array.from(
        new Map<string, { url: string; alt_text: string }>(
          image_metadata.filter(item => item.url).map(item => [item.url, { url: item.url, alt_text: item.alt_text }])
        ).values()
      );
      return { image_metadata, seo_metadata: { ...prev.seo_metadata, image_alts } };
    });
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      ctx?.notify('error', 'Chỉ hỗ trợ định dạng JPEG, PNG hoặc WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      ctx?.notify('error', 'Kích thước ảnh tối đa 20MB.');
      return;
    }
    setLoading(true);
    try {
      const res: ProjectUploadResponse = await projectsApi.upload(file);
      onChange(res.url);
      if (ctx) {
        ctx.update(prev => {
          const newMeta: ProjectImageMetadata = {
            field,
            media_id: res.id,
            url: res.url,
            alt_text: currentAlt || `${prev.name || 'Dự án'} - ${label}`,
            width: res.width,
            height: res.height,
            focal_x: 50,
            focal_y: 50,
            variants: res.variants,
          };
          const image_metadata = [...prev.image_metadata.filter(item => item.field !== field), newMeta];
          const image_alts = Array.from(
            new Map(image_metadata.map(item => [item.url, { url: item.url, alt_text: item.alt_text }])).values()
          );
          return { image_metadata, seo_metadata: { ...prev.seo_metadata, image_alts } };
        });
      }
      ctx?.notify('success', `Tải lên ${label} thành công.`);
    } catch (err: unknown) {
      ctx?.notify('error', err instanceof Error ? err.message : 'Tải ảnh thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-[#2D1B14]">{label}</span>
        <span className="text-[11px] text-gray-400 font-mono">
          Yêu cầu: {reqs.minWidth}×{reqs.minHeight}px ({reqs.label})
        </span>
      </div>

      {value ? (
        <div className="border border-[#E8E0D8] rounded-2xl p-3 bg-white space-y-3 shadow-xs">
          <div className="relative group rounded-xl overflow-hidden bg-slate-900 border border-[#E8E0D8] aspect-video max-h-56 flex items-center justify-center">
            <img
              src={getAssetUrl(value) || value}
              alt={currentAlt || label}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute top-2 left-2 bg-emerald-500/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-xs flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>Tự căn chỉnh nét</span>
            </div>
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white p-1.5 rounded-full backdrop-blur-xs transition-colors cursor-pointer"
              title="Xóa ảnh này"
              aria-label="Xóa ảnh này"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Alt text and SEO Suggestion */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label htmlFor={`alt-${field}`} className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
                Alt ảnh {label}
              </label>
              <button
                type="button"
                onClick={() => updateAlt(`${ctx?.project.name || 'Dự án'} - ${label}`)}
                className="text-[11px] font-bold text-[#C5A059] hover:underline cursor-pointer flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Gợi ý Alt chuẩn SEO
              </button>
            </div>
            <Input
              id={`alt-${field}`}
              aria-label={`Alt ảnh ${label}`}
              value={currentAlt}
              onChange={e => updateAlt(e.target.value)}
              placeholder={`Nhập alt mô tả ảnh ${label}...`}
              className="text-xs py-2"
            />
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={e => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files[0]) handleUpload(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${dragActive ? 'border-[#C5A059] bg-[#C5A059]/5' : 'border-[#E8E0D8] bg-[#FAF8F5] hover:border-[#C5A059] hover:bg-white'}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }}
          />
          {loading ? (
            <div className="flex flex-col items-center justify-center py-3 text-[#C5A059] gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs font-bold">Đang tải và tối ưu ảnh...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-2 text-gray-500 gap-1.5">
              <div className="w-10 h-10 rounded-full bg-[#C5A059]/10 text-[#C5A059] flex items-center justify-center mb-1">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-[#2D1B14]">Kéo thả ảnh vào đây hoặc nhấp để chọn tệp</p>
              <p className="text-[11px] text-gray-400">Định dạng JPEG, PNG hoặc WebP (tối đa 20MB)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TAB 0: KHỞI TẠO & HERO GALLERY ─────────────────────────────────────────
function Tab0Hero({ d, set }: { d: ProjectFormData; set: (patch: Partial<ProjectFormData> | ((prev: ProjectFormData) => Partial<ProjectFormData>)) => void }) {
  const MARKETING_TAG_OPTIONS = [
    'Mở bán đợt 1',
    'Suất ngoại giao',
    'Chính sách tốt',
    'Sắp bàn giao',
    'Sổ hồng lâu dài',
    'Cam kết thuê lại',
    'Ân hạn nợ gốc 0%',
  ];
  const [customTag, setCustomTag] = useState('');

  const toggleMarketingTag = (tag: string) => {
    const current = d.marketing_tags || [];
    set({
      marketing_tags: current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag],
    });
  };

  const addCustomTag = () => {
    if (!customTag.trim()) return;
    const current = d.marketing_tags || [];
    if (!current.includes(customTag.trim())) {
      set({ marketing_tags: [...current, customTag.trim()] });
    }
    setCustomTag('');
  };

  return (
    <div className="space-y-6">
      {/* 1. Nhận diện & Mở bán */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059] border-b border-[#E8E0D8] pb-3">
          1. Nhận diện & Thông tin mở bán chính
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Tên dự án" required>
            <Input
              value={d.name}
              onChange={e => {
                const newName = e.target.value;
                const autoSlug = newName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                set(prev => ({
                  name: newName,
                  slug: !prev.slug || prev.slug === prev.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
                    ? autoSlug
                    : prev.slug,
                }));
              }}
              placeholder="Grand Riverside Villas"
              required
            />
          </Field>
          <Field label="Đường dẫn tĩnh (Slug URL)" required hint="Định danh trang /du_an/[slug]">
            <Input
              value={d.slug}
              onChange={e => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              placeholder="grand-riverside-villas"
              required
            />
          </Field>

          <Field label="Trạng thái mở bán dự án">
            <select
              value={d.status}
              onChange={e => set({ status: e.target.value as ProjectStatus })}
              className="w-full bg-white border border-[#E8E0D8] rounded-xl px-3.5 py-2.5 text-sm text-[#2D1B14] font-medium outline-none focus:border-[#C5A059]"
            >
              <option value="AVAILABLE">Đang mở bán (AVAILABLE)</option>
              <option value="PRE_SALE">Sắp mở bán / Booking (PRE_SALE)</option>
              <option value="HANDING_OVER">Đang bàn giao (HANDING_OVER)</option>
            </select>
          </Field>

          <Field label="Khoảng giá dự kiến / mở bán" hint="Hiển thị tại banner giá">
            <Input
              value={d.price_range}
              onChange={e => set({ price_range: e.target.value })}
              placeholder="Ví dụ: 7 - 12 tỷ hoặc 120 - 135 triệu/m²"
            />
          </Field>

          <Field label="Chính sách chiết khấu ưu đãi" hint="Hiển thị góc banner giá">
            <Input
              value={d.stats?.['Chiết khấu'] || ''}
              onChange={e => set(prev => ({ stats: { ...prev.stats, 'Chiết khấu': e.target.value } }))}
              placeholder="Ví dụ: Chiết khấu tới 8%"
            />
          </Field>

          <Field label="Hotline PKD tư vấn" hint="Hiển thị thanh hotline nhanh">
            <Input
              value={d.contact_phone}
              onChange={e => set({ contact_phone: e.target.value })}
              placeholder="Ví dụ: 090 123 4567"
            />
          </Field>

          <Field label="Liên kết Video giới thiệu (YouTube URL)" hint="Nút xem video tại góc Hero">
            <Input
              value={d.hero_video_url}
              onChange={e => set({ hero_video_url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </Field>

          <div className="pt-6">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={Boolean(d.is_featured)}
                onChange={e => set({ is_featured: e.target.checked })}
                className="w-4 h-4 rounded text-[#C5A059] border-gray-300 focus:ring-[#C5A059] cursor-pointer"
              />
              <span className="text-xs font-bold text-[#0F1E36]">
                🌟 Đánh dấu Dự án nổi bật (Hiển thị ưu tiên trên Trang chủ & Danh mục Dự án)
              </span>
            </label>
            <p className="text-[11px] text-gray-500 mt-1 pl-6">
              Dự án nổi bật sẽ xuất hiện tại mục &quot;Dự án nổi bật&quot; trên Trang chủ và được xếp ưu tiên hiển thị trên danh mục Dự án (không hiển thị nhãn trong trang chi tiết dự án).
            </p>
          </div>
        </div>

        {/* Marketing Tags */}
        <div className="pt-3 border-t border-[#E8E0D8] space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[#2D1B14] block">
            Gắn nhãn tiếp thị nổi bật (Marketing Badges)
          </label>
          <div className="flex flex-wrap gap-2">
            {MARKETING_TAG_OPTIONS.map(tag => {
              const active = (d.marketing_tags || []).includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleMarketingTag(tag)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    active
                      ? 'bg-[#C5A059] border-[#C5A059] text-white shadow-xs'
                      : 'bg-white border-[#E8E0D8] text-gray-700 hover:border-[#C5A059]'
                  }`}
                >
                  {active ? `✓ ${tag}` : `+ ${tag}`}
                </button>
              );
            })}
            {(d.marketing_tags || [])
              .filter(t => !MARKETING_TAG_OPTIONS.includes(t))
              .map(t => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#C5A059] text-white border border-[#C5A059]"
                >
                  ✓ {t}
                  <button
                    type="button"
                    onClick={() => toggleMarketingTag(t)}
                    className="ml-1 hover:text-red-200 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
          </div>
          <div className="flex gap-2 max-w-sm pt-1">
            <Input
              value={customTag}
              onChange={e => setCustomTag(e.target.value)}
              placeholder="Thêm nhãn tiếp thị khác..."
              className="text-xs py-1.5"
            />
            <button
              type="button"
              onClick={addCustomTag}
              className="px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#F3EEEA] border border-[#E8E0D8] rounded-xl text-xs font-bold text-[#8A6A2F] shrink-0 cursor-pointer"
            >
              Thêm nhãn
            </button>
          </div>
        </div>
      </div>

      {/* Hero Media Uploads */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059]">
              2. Thư viện ảnh Hero Gallery (Cột 60% giao diện đầu trang)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Ảnh chính và dải thumbnail hiển thị trực tiếp ở phần đầu trang chi tiết dự án.
            </p>
          </div>
          <button
            type="button"
            onClick={() => set({ hero_images: [...(d.hero_images || []), ''] })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#F3EEEA] border border-[#E8E0D8] rounded-xl text-xs font-bold text-[#8A6A2F] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm ảnh Hero
          </button>
        </div>

        <div className="space-y-4 pt-1">
          {(d.hero_images || []).map((url, idx) => (
            <div key={idx} className="relative p-4 border border-[#E8E0D8] rounded-2xl bg-[#FAF8F5] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">
                  {idx === 0 ? '🌟 Ảnh Hero đại diện chính' : `Ảnh Hero #${idx + 1}`}
                </span>
                {d.hero_images.length > 1 && (
                  <button
                    type="button"
                    onClick={() => set({ hero_images: d.hero_images.filter((_, i) => i !== idx) })}
                    className="text-red-500 hover:text-red-700 text-xs font-bold p-1 cursor-pointer"
                  >
                    Xóa
                  </button>
                )}
              </div>
              <ImageUploadField
                field={`hero_images.${idx}`}
                label={`Hero - ảnh ${idx + 1}`}
                profile="hero"
                value={url}
                onChange={newUrl => {
                  const arr = [...d.hero_images];
                  arr[idx] = newUrl;
                  set({ hero_images: arr });
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TAB 1: GIỚI THIỆU & QUICK FACTS ────────────────────────────────────────
function Tab1Overview({ d, set }: { d: ProjectFormData; set: (patch: Partial<ProjectFormData> | ((prev: ProjectFormData) => Partial<ProjectFormData>)) => void }) {
  const [newStatKey, setNewStatKey] = useState('');
  const [newStatVal, setNewStatVal] = useState('');
  const [newUsp, setNewUsp] = useState('');

  const STANDARD_STATS = [
    { key: 'Loại hình', placeholder: 'Duplex, Penthouse, Căn hộ cao cấp', hint: 'Loại hình sản phẩm' },
    { key: 'Diện tích', placeholder: '67,000 m² hoặc 3.68 ha', hint: 'Tổng diện tích quỹ đất' },
    { key: 'Số block', placeholder: '6 Tòa tháp', hint: 'Số tòa tháp / block' },
    { key: 'Số tầng', placeholder: '34 tầng', hint: 'Chiều cao số tầng' },
    { key: 'Số căn hộ', placeholder: '1,980 căn cao cấp', hint: 'Tổng số lượng sản phẩm' },
    { key: 'Mật độ xây dựng (%)', placeholder: '20.7%', hint: 'Tỷ lệ mật độ xây dựng' },
    { key: 'Bàn giao', placeholder: 'Dự kiến Quý IV/2026', hint: 'Tiến độ bàn giao' },
    { key: 'Pháp lý', placeholder: 'Sổ hồng lâu dài', hint: 'Hình thức sở hữu' },
  ];

  const updateStatValue = (key: string, val: string) => {
    set(prev => ({
      stats: { ...prev.stats, [key]: val },
    }));
  };

  const addStat = () => {
    if (!newStatKey.trim() || !newStatVal.trim()) return;
    set(prev => ({ stats: { ...prev.stats, [newStatKey.trim()]: newStatVal.trim() } }));
    setNewStatKey('');
    setNewStatVal('');
  };

  const removeStat = (k: string) => {
    set(prev => {
      const next = { ...prev.stats };
      delete next[k];
      return { stats: next };
    });
  };

  const addUsp = () => {
    if (!newUsp.trim()) return;
    const current = d.seo_metadata?.usps || [];
    set(prev => ({
      seo_metadata: { ...prev.seo_metadata, usps: [...current, newUsp.trim()] },
    }));
    setNewUsp('');
  };

  const removeUsp = (idx: number) => {
    const current = d.seo_metadata?.usps || [];
    set(prev => ({
      seo_metadata: { ...prev.seo_metadata, usps: current.filter((_, i) => i !== idx) },
    }));
  };

  const overviewList = (d.overview_images && d.overview_images.length > 0) ? d.overview_images : [''];

  const addOverviewImage = () => {
    set(prev => ({
      overview_images: [...(prev.overview_images || []), ''],
    }));
  };

  const updateOverviewImage = (idx: number, url: string) => {
    const arr = [...(d.overview_images || [''])];
    arr[idx] = url;
    set({ overview_images: arr });
  };

  const removeOverviewImage = (idx: number) => {
    const arr = (d.overview_images || []).filter((_, i) => i !== idx);
    set({ overview_images: arr.length > 0 ? arr : [''] });
  };

  return (
    <div className="space-y-6">
      {/* 1. Giới thiệu tổng quan */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059] border-b border-[#E8E0D8] pb-3">
          1. Giới thiệu tổng quan dự án (Collapsible Description)
        </h3>
        <Field label="Mô tả chi tiết tổng quan" hint="Đoạn văn giới thiệu tầm vóc, phong cách sống (có nút Xem thêm / Thu gọn trên trang)">
          <Textarea
            rows={7}
            value={d.description}
            onChange={e => set({ description: e.target.value })}
            placeholder="Nhập mô tả toàn cảnh dự án..."
          />
        </Field>
      </div>

      {/* 2. Thông số quy mô dự án (2 cột hiển thị trên trang) */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-5">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059] border-b border-[#E8E0D8] pb-3">
            2. Thông số quy mô dự án (Quick Facts)
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Hiển thị trực tiếp tại bảng thông số 2 cột dọc trong mục Tổng quan trang chi tiết.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {STANDARD_STATS.map(item => (
            <Field key={item.key} label={item.key} hint={item.hint}>
              <Input
                value={d.stats?.[item.key] || ''}
                onChange={e => updateStatValue(item.key, e.target.value)}
                placeholder={item.placeholder}
                className="text-xs"
              />
            </Field>
          ))}
        </div>

        {/* Custom Stats list */}
        {Object.entries(d.stats || {}).filter(([k]) =>
          !STANDARD_STATS.some(s => s.key === k) &&
          !k.startsWith('developer_') &&
          !['Chiết khấu', 'overview_images', 'Vị trí ảnh', 'Vị trí bản đồ', 'Trạng thái'].includes(k)
        ).length > 0 && (
          <div className="pt-2 border-t border-[#E8E0D8] space-y-2">
            <span className="text-xs font-bold text-gray-700 block">Thông số tùy chỉnh khác:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {Object.entries(d.stats || {}).filter(([k]) =>
                !STANDARD_STATS.some(s => s.key === k) &&
                !k.startsWith('developer_') &&
                !['Chiết khấu', 'overview_images', 'Vị trí ảnh', 'Vị trí bản đồ', 'Trạng thái'].includes(k)
              ).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between p-2.5 bg-[#FAF8F5] border border-[#E8E0D8] rounded-xl text-xs">
                  <div>
                    <span className="font-bold text-gray-700 block">{k}</span>
                    <span className="text-[#C5A059] font-semibold">{v}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStat(k)}
                    className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-[#E8E0D8]">
          <Input
            value={newStatKey}
            onChange={e => setNewStatKey(e.target.value)}
            placeholder="Tên thông số khác..."
            className="flex-1 text-xs"
          />
          <Input
            value={newStatVal}
            onChange={e => setNewStatVal(e.target.value)}
            placeholder="Giá trị thông số..."
            className="flex-1 text-xs"
          />
          <button
            type="button"
            onClick={addStat}
            className="px-4 py-2 bg-[#FAF8F5] hover:bg-[#F3EEEA] border border-[#E8E0D8] text-[#8A6A2F] text-xs font-bold rounded-xl shrink-0 cursor-pointer"
          >
            + Thêm thông số
          </button>
        </div>
      </div>

      {/* 3. Hình ảnh phối cảnh dự án */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8E0D8] pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059]">
              3. Hình ảnh phối cảnh dự án (Section Tổng quan)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Có thể tải lên nhiều hình ảnh. Khi dự án có từ 3 hình ảnh trở lên, trang chi tiết sẽ tự động chuyển sang hiệu ứng Carousel mờ dần mỗi 4 giây.
            </p>
          </div>
          <button
            type="button"
            onClick={addOverviewImage}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#F3EEEA] border border-[#E8E0D8] rounded-xl text-xs font-bold text-[#8A6A2F] shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm ảnh phối cảnh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {overviewList.map((url, idx) => (
            <div key={idx} className="relative p-3 rounded-xl border border-[#E8E0D8] bg-[#FAF8F5]/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0F1E36]">Ảnh #{idx + 1}</span>
                {overviewList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOverviewImage(idx)}
                    className="text-red-500 hover:text-red-700 text-xs font-bold p-1 cursor-pointer"
                    title="Xóa ảnh này"
                  >
                    Xóa
                  </button>
                )}
              </div>
              <ImageUploadField
                field={`overview_images.${idx}`}
                label={`Phối cảnh ${idx + 1}`}
                profile="content"
                value={url || ''}
                onChange={newUrl => updateOverviewImage(idx, newUrl)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 4. Lý do lựa chọn & Giá trị độc bản (USPs) */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059] border-b border-[#E8E0D8] pb-3">
            4. Lý do lựa chọn & Giá trị độc bản (USPs)
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Hiển thị dạng thẻ điểm nhấn với icon tích xanh trên giao diện chi tiết dự án.
          </p>
        </div>

        <div className="space-y-2">
          {(d.seo_metadata?.usps || []).map((usp, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-[#FAF8F5] border border-[#E8E0D8] rounded-xl text-xs gap-3">
              <span className="font-semibold text-gray-800 leading-snug">{usp}</span>
              <button
                type="button"
                onClick={() => removeUsp(idx)}
                className="text-red-400 hover:text-red-600 p-1 shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <Input
            value={newUsp}
            onChange={e => setNewUsp(e.target.value)}
            placeholder="Nhập giá trị độc bản (VD: 100% Căn hộ sở hữu ban công panoramic view sông vĩnh viễn)..."
            className="flex-1 text-xs"
          />
          <button
            type="button"
            onClick={addUsp}
            className="px-4 py-2 bg-[#C5A059] hover:bg-[#B38F48] text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer"
          >
            + Thêm USP
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 2: VỊ TRÍ & KẾT NỐI ────────────────────────────────────────────────
function Tab2Location({ d, set }: { d: ProjectFormData; set: (patch: Partial<ProjectFormData> | ((prev: ProjectFormData) => Partial<ProjectFormData>)) => void }) {
  const [dest, setDest] = useState('');
  const [time, setTime] = useState('');
  const [km, setKm] = useState('');

  const addDistance = () => {
    if (!dest.trim()) return;
    const item: LocationDistance = {
      destination: dest.trim(),
      distance: time.trim() ? (time.trim().toLowerCase().includes('phút') ? time.trim() : `${time.trim()} phút`) : '5 phút',
      distance_km: km.trim() ? (km.trim().toLowerCase().includes('km') ? km.trim() : `${km.trim()} km`) : '2.0 km',
    };
    set({ location_distances: [...(d.location_distances || []), item] });
    setDest('');
    setTime('');
    setKm('');
  };

  const removeDistance = (idx: number) => {
    set({ location_distances: (d.location_distances || []).filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      {/* 1. Địa chỉ & Bản đồ vị trí */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059] border-b border-[#E8E0D8] pb-3">
          1. Địa chỉ & Bản đồ vị trí
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Địa chỉ dự án" required hint="Hiển thị trên header và tiêu đề vị trí">
            <Input
              value={d.location}
              onChange={e => set({ location: e.target.value })}
              placeholder="Mặt tiền Mai Chí Thọ, Phường An Phú, TP. Thủ Đức, TP.HCM"
              required
            />
          </Field>
          <Field label="Link nhúng Google Maps Iframe" hint="Dành cho chế độ xem bản đồ Google Maps">
            <Input
              value={d.map_embed_url}
              onChange={e => set({ map_embed_url: e.target.value })}
              placeholder="https://www.google.com/maps?q=...&output=embed"
            />
          </Field>
        </div>

        <ImageUploadField
          field="location_map_image"
          label="Sơ đồ vị trí - Bản đồ tĩnh"
          profile="plan"
          value={d.location_map_image}
          onChange={url => set({ location_map_image: url })}
        />
      </div>

      {/* 2. Bảng kết nối hạ tầng giao thông */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059] border-b border-[#E8E0D8] pb-3">
            2. Kết nối hạ tầng giao thông (Bảng 3 cột: Địa điểm - Thời gian - Khoảng cách)
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Hiển thị bảng danh sách các điểm kết nối trọng điểm, cự ly km và số phút di chuyển.
          </p>
        </div>

        <div className="border border-[#E8E0D8] rounded-xl overflow-hidden bg-white">
          <div className="bg-[#FAF8F5] border-b border-[#E8E0D8] px-4 py-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
            <span className="flex-1">Tên địa điểm kết nối</span>
            <span className="w-28 text-center">Thời gian</span>
            <span className="w-28 text-center">Khoảng cách</span>
            <span className="w-12 text-right">Xóa</span>
          </div>

          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {(d.location_distances || []).map((item, idx) => (
              <div key={idx} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                <span className="flex-1 font-semibold text-[#0F1E36]">{item.destination}</span>
                <span className="w-28 text-center font-bold text-[#C5A059] bg-[#C5A059]/10 py-1 rounded">
                  {item.distance}
                </span>
                <span className="w-28 text-center font-medium text-gray-600">{item.distance_km}</span>
                <div className="w-12 text-right">
                  <button
                    type="button"
                    onClick={() => removeDistance(idx)}
                    className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 inline" />
                  </button>
                </div>
              </div>
            ))}
            {(d.location_distances || []).length === 0 && (
              <div className="p-4 text-center text-xs text-gray-400">
                Chưa có điểm kết nối nào. Thêm điểm kết nối bên dưới.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
          <Input
            value={dest}
            onChange={e => setDest(e.target.value)}
            placeholder="Tên địa điểm (VD: Tuyến Metro số 1 Bến Thành)"
            className="text-xs sm:col-span-2"
          />
          <Input
            value={time}
            onChange={e => setTime(e.target.value)}
            placeholder="Thời gian (VD: 3 phút)"
            className="text-xs"
          />
          <Input
            value={km}
            onChange={e => setKm(e.target.value)}
            placeholder="Khoảng cách (VD: 1.2 km)"
            className="text-xs"
          />
          <button
            type="button"
            onClick={addDistance}
            className="px-4 py-2 bg-[#C5A059] hover:bg-[#B38F48] text-white text-xs font-bold rounded-xl sm:col-span-4 cursor-pointer"
          >
            + Thêm điểm kết nối
          </button>
        </div>

        <Field label="Ghi chú kết nối vị trí (Tùy chọn)">
          <Input
            value={d.location_distances_note || ''}
            onChange={e => set({ location_distances_note: e.target.value })}
            placeholder="Ví dụ: Thời gian di chuyển được tính theo giờ thấp điểm qua trục Mai Chí Thọ..."
            className="text-xs"
          />
        </Field>
      </div>
    </div>
  );
}

// ─── TAB 3: MẶT BẰNG & THIẾT KẾ ─────────────────────────────────────────────
function Tab3Layouts({ d, set }: { d: ProjectFormData; set: (patch: Partial<ProjectFormData> | ((prev: ProjectFormData) => Partial<ProjectFormData>)) => void }) {
  const [activeGroupIdx, setActiveGroupIdx] = useState(0);

  const addGroup = () => {
    const newGroup: FloorLayoutGroup = {
      group_name: `Tháp ${d.floor_layouts.length + 1}`,
      floors: [d.floor_layouts.length + 1],
      floor_map_image: '',
      unit_layouts: [],
      hotspots: [],
    };
    set({ floor_layouts: [...(d.floor_layouts || []), newGroup] });
    setActiveGroupIdx((d.floor_layouts || []).length);
  };

  const removeGroup = (idx: number) => {
    set({ floor_layouts: d.floor_layouts.filter((_, i) => i !== idx) });
    setActiveGroupIdx(Math.max(0, idx - 1));
  };

  const activeGroup = d.floor_layouts?.[activeGroupIdx];

  const addUnitLayout = () => {
    if (!activeGroup) return;
    const newUnit: UnitLayout = {
      name: `Căn A${activeGroup.unit_layouts.length + 1} - 2PN`,
      bedrooms: 2,
      bathrooms: 2,
      gross_area: 75.0,
      net_area: 68.5,
      door_direction: 'Tây Bắc',
      balcony_direction: 'Đông Nam',
      view_direction: 'Sông Sài Gòn',
      image_url: '',
      description: '',
    };
    const updated = [...d.floor_layouts];
    updated[activeGroupIdx] = {
      ...activeGroup,
      unit_layouts: [...activeGroup.unit_layouts, newUnit],
    };
    set({ floor_layouts: updated });
  };

  const updateUnit = (uIdx: number, patch: Partial<UnitLayout>) => {
    if (!activeGroup) return;
    const updated = [...d.floor_layouts];
    const unitList = [...activeGroup.unit_layouts];
    unitList[uIdx] = { ...unitList[uIdx], ...patch };
    updated[activeGroupIdx] = { ...activeGroup, unit_layouts: unitList };
    set({ floor_layouts: updated });
  };

  const removeUnit = (uIdx: number) => {
    if (!activeGroup) return;
    const updated = [...d.floor_layouts];
    updated[activeGroupIdx] = {
      ...activeGroup,
      unit_layouts: activeGroup.unit_layouts.filter((_, i) => i !== uIdx),
    };
    set({ floor_layouts: updated });
  };

  return (
    <div className="space-y-6">
      {/* 1. Mặt bằng tổng thể Master Plan */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059] border-b border-[#E8E0D8] pb-3">
            1. Sơ đồ quy hoạch tổng thể (Master Plan)
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Hiển thị trong tab &quot;Mặt bằng tổng thể&quot; của phần Mặt bằng & Thiết kế.
          </p>
        </div>
        <ImageUploadField
          field="master_plan_image"
          label="Mặt bằng tổng thể (Master Plan)"
          profile="plan"
          value={d.master_plan_image}
          onChange={url => set({ master_plan_image: url })}
        />
      </div>

      {/* 2. Nhóm mặt bằng phân tầng / Tháp */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059]">
              2. Nhóm mặt bằng tầng & Tháp (Towers / Floor Groups)
            </h3>
            <p className="text-xs text-gray-500">Mỗi tháp/nhóm tầng có sơ đồ mặt bằng tầng và danh sách bản vẽ các căn hộ.</p>
          </div>
          <button
            type="button"
            onClick={addGroup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C5A059] hover:bg-[#B38F48] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm Tháp / Nhóm tầng
          </button>
        </div>

        {d.floor_layouts.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {d.floor_layouts.map((grp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveGroupIdx(idx)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  activeGroupIdx === idx
                    ? 'bg-[#0F1E36] text-white border-[#0F1E36]'
                    : 'bg-[#FAF8F5] text-gray-700 border-[#E8E0D8] hover:border-[#C5A059]'
                }`}
              >
                {grp.group_name || `Nhóm ${idx + 1}`} ({grp.unit_layouts?.length || 0} mẫu căn)
              </button>
            ))}
          </div>
        ) : (
          <div className="p-8 border border-dashed border-[#E8E0D8] rounded-xl text-center text-xs text-gray-500">
            Chưa có tháp hoặc nhóm tầng nào. Nhấn &quot;+ Thêm Tháp / Nhóm tầng&quot; để bắt đầu!
          </div>
        )}
      </div>

      {activeGroup && (
        <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-3">
            <h4 className="text-sm font-bold text-[#0F1E36]">Cấu hình {activeGroup.group_name}</h4>
            <button
              type="button"
              onClick={() => removeGroup(activeGroupIdx)}
              className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa nhóm này
            </button>
          </div>

          <Field label="Tên Tháp / Phân khu / Nhóm tầng" required>
            <Input
              value={activeGroup.group_name}
              onChange={e => {
                const updated = [...d.floor_layouts];
                updated[activeGroupIdx] = { ...activeGroup, group_name: e.target.value };
                set({ floor_layouts: updated });
              }}
              placeholder="VD: Tháp Grove A5 hoặc Tầng 3-12"
            />
          </Field>

          <ImageUploadField
            field={`floor_layouts.${activeGroupIdx}.floor_map_image`}
            label={`Sơ đồ mặt bằng tầng - ${activeGroup.group_name}`}
            profile="plan"
            value={activeGroup.floor_map_image}
            onChange={url => {
              const updated = [...d.floor_layouts];
              updated[activeGroupIdx] = { ...activeGroup, floor_map_image: url };
              set({ floor_layouts: updated });
            }}
          />

          {/* Unit Layouts */}
          <div className="pt-4 border-t border-[#E8E0D8] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-[#C5A059]">
                  Danh sách thiết kế căn hộ ({activeGroup.unit_layouts?.length || 0} mẫu căn)
                </h5>
                <p className="text-[11px] text-gray-500">
                  Hiển thị chi tiết tại chế độ &quot;Bản vẽ căn hộ&quot;: Thông thủy, tim tường, số PN, WC, hướng cửa, hướng ban công, hướng view.
                </p>
              </div>
              <button
                type="button"
                onClick={addUnitLayout}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#F3EEEA] border border-[#E8E0D8] rounded-xl text-xs font-bold text-[#8A6A2F] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm mẫu căn
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {(activeGroup.unit_layouts || []).map((unit, uIdx) => (
                <div key={uIdx} className="border border-[#E8E0D8] rounded-2xl p-4.5 bg-[#FAF8F5] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-2">
                    <span className="text-xs font-black text-[#0F1E36]">
                      #{uIdx + 1}: {unit.name || 'Mẫu căn hộ mới'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeUnit(uIdx)}
                      className="text-red-400 hover:text-red-600 text-xs p-1 cursor-pointer"
                      title="Xóa mẫu căn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <Field label="Tên căn">
                      <Input
                        value={unit.name}
                        onChange={e => updateUnit(uIdx, { name: e.target.value })}
                        placeholder="Căn B6b - 2PN"
                        className="text-xs py-1.5 font-bold"
                      />
                    </Field>
                    <Field label="Số phòng ngủ">
                      <Input
                        type="number"
                        min={1}
                        value={unit.bedrooms}
                        onChange={e => updateUnit(uIdx, { bedrooms: Number(e.target.value) || 1 })}
                        className="text-xs py-1.5"
                      />
                    </Field>
                    <Field label="Số phòng tắm (WC)">
                      <Input
                        type="number"
                        min={1}
                        value={unit.bathrooms}
                        onChange={e => updateUnit(uIdx, { bathrooms: Number(e.target.value) || 1 })}
                        className="text-xs py-1.5"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <Field label="Thông thủy (m²)">
                      <Input
                        type="number"
                        step="0.1"
                        value={unit.net_area}
                        onChange={e => updateUnit(uIdx, { net_area: Number(e.target.value) || 0 })}
                        placeholder="73.2"
                        className="text-xs py-1.5"
                      />
                    </Field>
                    <Field label="Tim tường (m²)">
                      <Input
                        type="number"
                        step="0.1"
                        value={unit.gross_area}
                        onChange={e => updateUnit(uIdx, { gross_area: Number(e.target.value) || 0 })}
                        placeholder="79.5"
                        className="text-xs py-1.5"
                      />
                    </Field>
                    <Field label="Hướng cửa chính">
                      <Input
                        value={unit.door_direction || ''}
                        onChange={e => updateUnit(uIdx, { door_direction: e.target.value })}
                        placeholder="Tây Bắc"
                        className="text-xs py-1.5"
                      />
                    </Field>
                    <Field label="Hướng ban công">
                      <Input
                        value={unit.balcony_direction || ''}
                        onChange={e => updateUnit(uIdx, { balcony_direction: e.target.value })}
                        placeholder="Đông Nam"
                        className="text-xs py-1.5"
                      />
                    </Field>
                  </div>

                  <Field label="Tầm nhìn (View direction)">
                    <Input
                      value={unit.view_direction || ''}
                      onChange={e => updateUnit(uIdx, { view_direction: e.target.value })}
                      placeholder="Sông Sài Gòn & Công viên nội khu"
                      className="text-xs py-1.5"
                    />
                  </Field>

                  <ImageUploadField
                    field={`floor_layouts.${activeGroupIdx}.unit_layouts.${uIdx}.image_url`}
                    label={`Bản vẽ 2D - ${unit.name || 'Mẫu căn'}`}
                    profile="unitLayout"
                    value={unit.image_url}
                    onChange={url => updateUnit(uIdx, { image_url: url })}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB 4: TIỆN ÍCH ĐẶC QUYỀN ──────────────────────────────────────────────
function Tab4Amenities({ d, set }: { d: ProjectFormData; set: (patch: Partial<ProjectFormData> | ((prev: ProjectFormData) => Partial<ProjectFormData>)) => void }) {
  const [newAmenityName, setNewAmenityName] = useState('');

  const addGalleryItem = () => {
    const item: AmenityGalleryItem = {
      name: '',
      image_url: '',
      description: '',
      category: '',
    };
    set({ amenity_gallery: [...(d.amenity_gallery || []), item] });
  };

  const updateGalleryItem = (gi: number, patch: Partial<AmenityGalleryItem>) => {
    const arr = [...(d.amenity_gallery || [])];
    arr[gi] = { ...arr[gi], ...patch };
    set({ amenity_gallery: arr });
  };

  const removeGalleryItem = (gi: number) => {
    set({ amenity_gallery: (d.amenity_gallery || []).filter((_, i) => i !== gi) });
  };

  const addAmenityTag = () => {
    if (!newAmenityName.trim()) return;
    const current = d.amenities || [];
    if (!current.includes(newAmenityName.trim())) {
      set({ amenities: [...current, newAmenityName.trim()] });
    }
    setNewAmenityName('');
  };

  const removeAmenityTag = (idx: number) => {
    const current = d.amenities || [];
    set({ amenities: current.filter((_, i) => i !== idx) });
  };

  const syncAmenitiesFromGallery = () => {
    const names = (d.amenity_gallery || []).map(g => g.name.trim()).filter(Boolean);
    const setNames = new Set([...(d.amenities || []), ...names]);
    set({ amenities: Array.from(setNames) });
  };

  return (
    <div className="space-y-6">
      {/* 1. Bento Grid Gallery */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E0D8] pb-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059]">
              1. Bộ sưu tập Tiện ích đặc quyền (Bento Grid)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Hiển thị hình ảnh và tên tiện ích dạng Bento Grid sang trọng trên trang chi tiết.
            </p>
          </div>
          <button
            type="button"
            onClick={addGalleryItem}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C5A059] hover:bg-[#B38F48] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm tiện ích Bento Grid
          </button>
        </div>

        {/* Bento Grid Visual Guide */}
        <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8E0D8] text-[11px] text-gray-600 flex items-center gap-2">
          <span className="font-bold text-[#C5A059]">💡 Quy tắc bố cục Bento Grid:</span>
          <span>Tiện ích #1 là ảnh tâm điểm lớn (60%), #2 & #3 là 2 ảnh phụ (40%), từ #4 trở đi hiển thị lưới 3 cột đều đặn.</span>
        </div>

        {d.amenity_gallery.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(d.amenity_gallery || []).map((item, gi) => {
              const isFeatured = gi === 0;
              const isSecondary = gi === 1 || gi === 2;
              return (
                <div
                  key={gi}
                  className={`border rounded-2xl p-4.5 bg-[#FAF8F5] space-y-3.5 transition-all ${
                    isFeatured
                      ? 'border-[#C5A059] ring-2 ring-[#C5A059]/15'
                      : isSecondary
                      ? 'border-slate-300'
                      : 'border-[#E8E0D8]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#0F1E36] text-white font-mono">
                        #{gi + 1}
                      </span>
                      <span className="text-[11px] font-bold text-[#C5A059]">
                        {isFeatured ? 'Tâm điểm (Featured 60%)' : isSecondary ? 'Phụ (Secondary 40%)' : 'Lưới 3 cột'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGalleryItem(gi)}
                      className="text-red-400 hover:text-red-600 p-1 cursor-pointer transition-colors"
                      title="Xóa tiện ích"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <Field label="Tên tiện ích (hiển thị trên ảnh)" required>
                    <Input
                      value={item.name}
                      onChange={e => updateGalleryItem(gi, { name: e.target.value })}
                      placeholder="VD: Hồ bơi vô cực Lumina"
                      className="font-bold text-xs py-2"
                      required
                    />
                  </Field>

                  <ImageUploadField
                    field={`amenity_gallery.${gi}.image_url`}
                    label={`Thư viện tiện ích - ${item.name || gi + 1}`}
                    profile="content"
                    value={item.image_url}
                    onChange={url => updateGalleryItem(gi, { image_url: url })}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 border-2 border-dashed border-[#E8E0D8] rounded-2xl text-center space-y-2 bg-[#FAF8F5]">
            <p className="text-xs font-bold text-[#0F1E36]">Chưa có tiện ích nào trong Bento Grid</p>
            <button
              type="button"
              onClick={addGalleryItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C5A059] hover:bg-[#B38F48] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm tiện ích đầu tiên
            </button>
          </div>
        )}
      </div>

      {/* 2. Danh mục tiện ích (Thẻ danh sách số thứ tự) */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E8E0D8] pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059]">
              2. Danh mục tiện ích ({d.amenities?.length || 0} tiện ích)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Hiển thị danh mục số thứ tự + tên tiện ích (ở chân mục Tiện ích trên trang chi tiết).
            </p>
          </div>
          <button
            type="button"
            onClick={syncAmenitiesFromGallery}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FAF8F5] hover:bg-[#F3EEEA] border border-[#E8E0D8] rounded-xl text-xs font-bold text-[#8A6A2F] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Lấy tên từ Bento Grid
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(d.amenities || []).map((name, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 bg-[#FAF8F5] border border-[#E8E0D8] rounded-xl text-xs">
              <div className="flex items-center gap-2 truncate pr-2">
                <span className="w-5 h-5 rounded bg-[#C5A059]/10 text-[#C5A059] font-bold text-[10px] flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="font-semibold text-gray-800 truncate">{name}</span>
              </div>
              <button
                type="button"
                onClick={() => removeAmenityTag(idx)}
                className="text-red-400 hover:text-red-600 p-1 shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <Input
            value={newAmenityName}
            onChange={e => setNewAmenityName(e.target.value)}
            placeholder="Nhập tên tiện ích (VD: Phòng tiệc VIP Jumeirah, Vườn thiền Zen Garden...)"
            className="flex-1 text-xs"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAmenityTag(); } }}
          />
          <button
            type="button"
            onClick={addAmenityTag}
            className="px-4 py-2 bg-[#C5A059] hover:bg-[#B38F48] text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer"
          >
            + Thêm vào danh mục
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 5: CHỦ ĐẦU TƯ & TƯ VẤN ─────────────────────────────────────────────
function Tab5Contact({ d, set }: { d: ProjectFormData; set: (patch: Partial<ProjectFormData> | ((prev: ProjectFormData) => Partial<ProjectFormData>)) => void }) {
  const updateStatValue = (key: string, val: string) => {
    set(prev => ({
      stats: { ...prev.stats, [key]: val },
    }));
  };

  return (
    <div className="space-y-6">
      {/* 1. Hồ sơ Chủ Đầu Tư */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-5">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059] border-b border-[#E8E0D8] pb-3">
            1. Hồ sơ & Năng lực Chủ đầu tư
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Hiển thị tại mục &quot;Chủ đầu tư&quot; trên trang chi tiết (3 thông số nổi bật, bài giới thiệu và dự án tiêu biểu).
          </p>
        </div>

        <Field label="Tên chủ đầu tư / Đơn vị phát triển" required>
          <Input
            value={d.developer}
            onChange={e => set({ developer: e.target.value })}
            placeholder="Gamuda Land"
            className="font-bold"
            required
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          <Field label="Kinh nghiệm quốc tế" hint="Thông số cột 1">
            <Input
              value={d.stats?.['developer_experience'] || d.stats?.['Kinh nghiệm CĐT'] || ''}
              onChange={e => {
                updateStatValue('developer_experience', e.target.value);
                updateStatValue('Kinh nghiệm CĐT', e.target.value);
              }}
              placeholder="28+ Năm"
              className="text-xs font-bold"
            />
          </Field>
          <Field label="Khu đô thị sinh thái" hint="Thông số cột 2">
            <Input
              value={d.stats?.['developer_projects_count'] || d.stats?.['Quy mô CĐT'] || ''}
              onChange={e => {
                updateStatValue('developer_projects_count', e.target.value);
                updateStatValue('Quy mô CĐT', e.target.value);
              }}
              placeholder="11+ Khu đô thị"
              className="text-xs font-bold"
            />
          </Field>
          <Field label="Giải thưởng danh giá" hint="Thông số cột 3">
            <Input
              value={d.stats?.['developer_awards'] || d.stats?.['Giải thưởng CĐT'] || ''}
              onChange={e => {
                updateStatValue('developer_awards', e.target.value);
                updateStatValue('Giải thưởng CĐT', e.target.value);
              }}
              placeholder="75+ Giải thưởng"
              className="text-xs font-bold"
            />
          </Field>
        </div>

        <Field label="Mô tả năng lực & uy tín chủ đầu tư" hint="Đoạn văn giới thiệu CĐT trên trang chi tiết">
          <Textarea
            rows={5}
            value={d.developer_description || d.stats?.['developer_description'] || d.stats?.['Mô tả CĐT'] || ''}
            onChange={e => {
              set({ developer_description: e.target.value });
              updateStatValue('developer_description', e.target.value);
              updateStatValue('Mô tả CĐT', e.target.value);
            }}
            placeholder="Chia sẻ về tầm nhìn, triết lý kiến tạo sinh thái và cam kết uy tín của chủ đầu tư..."
          />
        </Field>

        <Field label="Các dự án tiêu biểu đã phát triển" hint="Phân tách bằng dấu phẩy hoặc xuống dòng">
          <Input
            value={d.stats?.['developer_notable_projects'] || d.stats?.['Dự án tiêu biểu CĐT'] || ''}
            onChange={e => {
              updateStatValue('developer_notable_projects', e.target.value);
              updateStatValue('Dự án tiêu biểu CĐT', e.target.value);
            }}
            placeholder="Celadon City (TP.HCM), Gamuda City (Hà Nội), Elysian (TP. Thủ Đức)"
            className="text-xs"
          />
        </Field>
      </div>

      {/* 2. Thông tin nhận tư vấn & Báo giá (Sidebar) */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059] border-b border-[#E8E0D8] pb-3">
            2. Thông tin tiếp nhận tư vấn & Hotline (Sidebar Form)
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Hiển thị tại card đăng ký tư vấn & báo giá cố định bên phải trang chi tiết.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Hotline PKD tư vấn 24/7">
            <Input
              value={d.contact_phone}
              onChange={e => set({ contact_phone: e.target.value })}
              placeholder="090 123 4567"
            />
          </Field>
          <Field label="Email tiếp nhận tư vấn">
            <Input
              value={d.contact_email}
              onChange={e => set({ contact_email: e.target.value })}
              placeholder="info@maianhomes.vn"
            />
          </Field>
          <Field label="Tiêu đề form tư vấn">
            <Input
              value={d.contact_title}
              onChange={e => set({ contact_title: e.target.value })}
              placeholder="Đăng ký tư vấn & Báo giá"
            />
          </Field>
          <Field label="Mô tả form tư vấn">
            <Input
              value={d.contact_description}
              onChange={e => set({ contact_description: e.target.value })}
              placeholder="Để lại thông tin để nhận bảng giá chi tiết từng căn và mặt bằng qua Zalo/Email."
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 6: KIỂM SOÁT SEO/GEO & FAQ ─────────────────────────────────────────
function Tab6SEO({ d, set }: { d: ProjectFormData; set: (patch: Partial<ProjectFormData>) => void }) {
  const ctx = useContext(ProjectContext);
  const [aiLoading, setAiLoading] = useState(false);
  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');

  const generateSeoWithAi = async () => {
    if (!d.name) {
      ctx?.notify('error', 'Vui lòng nhập tên dự án trước khi tạo SEO bằng AI.');
      return;
    }
    setAiLoading(true);
    try {
      const response = await aiApi.generateSeo(d.name, d.description || '', {
        location: d.location || '',
        developer: d.developer || '',
        status: d.status || '',
        price_range: d.price_range || '',
        amenities: d.amenities || [],
        marketing_tags: d.marketing_tags || [],
        sources: (d.seo_metadata.sources || []).map(s => ({ title: s.title, url: s.url })),
      });
      if (response?.data) {
        const seo = response.data;
        set({
          seo_metadata: {
            ...d.seo_metadata,
            title: seo.title || d.seo_metadata.title,
            description: seo.description || d.seo_metadata.description,
            focus_keyword: seo.focus_keyword || d.seo_metadata.focus_keyword,
            keywords: seo.keywords?.length ? seo.keywords : d.seo_metadata.keywords,
            usps: seo.usps?.length ? seo.usps : d.seo_metadata.usps,
            key_facts: seo.key_facts?.length ? seo.key_facts : d.seo_metadata.key_facts,
            faqs: seo.faqs?.length ? seo.faqs : d.seo_metadata.faqs,
          },
        });
        ctx?.notify('success', 'AI đã tối ưu và tự động điền nội dung SEO/GEO thành công!');
      }
    } catch (err: unknown) {
      ctx?.notify('error', err instanceof Error ? err.message : 'AI tạo SEO thất bại');
    } finally {
      setAiLoading(false);
    }
  };

  const addFaq = () => {
    if (!newFaqQ.trim() || !newFaqA.trim()) return;
    const faqs = [...(d.seo_metadata.faqs || []), { question: newFaqQ.trim(), answer: newFaqA.trim() }];
    set({ seo_metadata: { ...d.seo_metadata, faqs } });
    setNewFaqQ('');
    setNewFaqA('');
  };

  const removeFaq = (idx: number) => {
    const faqs = (d.seo_metadata.faqs || []).filter((_, i) => i !== idx);
    set({ seo_metadata: { ...d.seo_metadata, faqs } });
  };

  return (
    <div className="space-y-6">
      {/* AI Generate Button Bar */}
      <div className="bg-gradient-to-r from-[#0F1E36] to-[#1E3A5F] text-white p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#C5A059]" />
            <h3 className="text-base font-bold text-white">Trợ lý AI Tối Ưu SEO & GEO E-E-A-T</h3>
          </div>
          <p className="text-xs text-gray-300">
            Tự động tổng hợp dữ liệu dự án để viết Title, Meta, USPs và bộ câu hỏi FAQs chuẩn thực tế.
          </p>
        </div>
        <button
          type="button"
          onClick={generateSeoWithAi}
          disabled={aiLoading}
          className="px-5 py-2.5 bg-gradient-to-r from-[#C5A059] to-[#D4AF37] hover:from-[#B38F48] hover:to-[#C5A059] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-50"
        >
          {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>{aiLoading ? 'Đang tạo nội dung...' : 'Tối ưu tự động bằng AI'}</span>
        </button>
      </div>

      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059] border-b border-[#E8E0D8] pb-3">
          1. Thẻ Meta SEO cơ bản
        </h3>
        <Field label="Tiêu đề SEO (<title>)" hint={`${d.seo_metadata.title?.length || 0}/65 ký tự`}>
          <Input
            value={d.seo_metadata.title}
            onChange={e => set({ seo_metadata: { ...d.seo_metadata, title: e.target.value } })}
            placeholder="The Privé Quận 2 - Biểu tượng thượng lưu giữa Sài Gòn | Maian Homes"
          />
        </Field>
        <Field label="Mô tả Meta (<meta description>)" hint={`${d.seo_metadata.description?.length || 0}/160 ký tự`}>
          <Textarea
            rows={3}
            value={d.seo_metadata.description}
            onChange={e => set({ seo_metadata: { ...d.seo_metadata, description: e.target.value } })}
            placeholder="Khám phá The Privé Quận 2 - tổ hợp căn hộ nghỉ dưỡng cao cấp với chuỗi tiện ích chuẩn 5 sao..."
          />
        </Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Từ khóa trọng tâm (Focus Keyword)">
            <Input
              value={d.seo_metadata.focus_keyword}
              onChange={e => set({ seo_metadata: { ...d.seo_metadata, focus_keyword: e.target.value } })}
              placeholder="The Privé Quận 2"
            />
          </Field>
          <Field label="Từ khóa phụ (cách nhau bởi dấu phẩy)">
            <Input
              value={d.seo_metadata.keywords.join(', ')}
              onChange={e => set({ seo_metadata: { ...d.seo_metadata, keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) } })}
              placeholder="căn hộ cao cấp quận 2, dự án maian homes..."
            />
          </Field>
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-white border border-[#E8E0D8] rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#C5A059] border-b border-[#E8E0D8] pb-3">
          2. Câu hỏi thường gặp FAQs (Hỗ trợ AI Search & GEO)
        </h3>

        <div className="space-y-3">
          {(d.seo_metadata.faqs || []).map((faq, idx) => (
            <div key={idx} className="p-4 bg-[#FAF8F5] border border-[#E8E0D8] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[#0F1E36]">Q{idx + 1}: {faq.question}</span>
                <button type="button" onClick={() => removeFaq(idx)} className="text-red-400 hover:text-red-600 text-xs cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-gray-600">{faq.answer}</p>
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-2 border-t border-[#E8E0D8]">
          <Input value={newFaqQ} onChange={e => setNewFaqQ(e.target.value)} placeholder="Nhập câu hỏi thường gặp..." className="text-xs" />
          <Textarea rows={2} value={newFaqA} onChange={e => setNewFaqA(e.target.value)} placeholder="Nhập câu trả lời chi tiết chuẩn thực tế..." className="text-xs" />
          <button type="button" onClick={addFaq} className="px-4 py-2 bg-[#C5A059] hover:bg-[#B38F48] text-white text-xs font-bold rounded-xl cursor-pointer">
            + Thêm FAQ
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PROJECT FORM COMPONENT (MODERN STUDIO STUDIO VIEW) ─────────────────
interface ProjectFormProps {
  initialData?: Partial<ProjectFormData>;
  onSubmit: (data: ProjectFormData, andPublish?: boolean) => Promise<void>;
  isSubmitting: boolean;
  isEdit: boolean;
  canPublish?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onClose?: () => void;
}

export default function ProjectForm({ initialData, onSubmit, isSubmitting, isEdit, onDirtyChange, onClose }: ProjectFormProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [data, setData] = useState<ProjectFormData>(() => normalizeProjectForm(initialData));
  const initialSnapshot = useRef(JSON.stringify(normalizeProjectForm(initialData)));
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Studio Display Modes: 'editor' (Form only) | 'split' (Split 50/50 live preview) | 'preview' (Full live preview)
  const [viewMode, setViewMode] = useState<'editor' | 'split' | 'preview'>('editor');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const dirtyEffectInit = useRef(false);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 4000);
  }, []);

  const set = (patch: Partial<ProjectFormData> | ((prev: ProjectFormData) => Partial<ProjectFormData>)) => {
    setData(prev => {
      const updated = typeof patch === 'function' ? patch(prev) : patch;
      return reconcileProjectImageMetadata({ ...prev, ...updated });
    });
  };

  // Sync Live Preview with iframe
  const sendPreviewData = useCallback(() => {
    previewFrameRef.current?.contentWindow?.postMessage(
      { type: 'project-live-preview', project: data },
      window.location.origin
    );
  }, [data]);

  useEffect(() => {
    if (viewMode === 'split' || viewMode === 'preview') {
      sendPreviewData();
    }
  }, [data, viewMode, sendPreviewData]);

  useEffect(() => {
    const handleReady = (event: MessageEvent<unknown>) => {
      if (
        event.origin === window.location.origin &&
        event.data &&
        typeof event.data === 'object' &&
        (event.data as { type?: string }).type === 'project-live-preview-ready'
      ) {
        sendPreviewData();
      }
    };
    window.addEventListener('message', handleReady);
    return () => window.removeEventListener('message', handleReady);
  }, [sendPreviewData]);

  // Dirty detection
  useEffect(() => {
    if (!dirtyEffectInit.current) {
      dirtyEffectInit.current = true;
      return;
    }
    const isNowDirty = JSON.stringify(data) !== initialSnapshot.current;
    setDirty(isNowDirty);
    onDirtyChange?.(isNowDirty);
  }, [data, onDirtyChange]);

  const handleFormSubmit = async (andPublish = false) => {
    if (!data.name.trim()) {
      setActiveTab(0);
      notify('error', 'Vui lòng nhập Tên dự án ở bước Khởi tạo.');
      return;
    }
    try {
      await onSubmit(data, andPublish);
      initialSnapshot.current = JSON.stringify(data);
      setDirty(false);
      onDirtyChange?.(false);
      notify('success', andPublish ? 'Đã lưu và xuất bản dự án thành công!' : 'Đã lưu bản nháp dự án thành công!');
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : 'Lưu dự án thất bại');
    }
  };

  return (
    <ProjectContext.Provider value={{ project: data, update: set, notify }}>
      <div className="fixed inset-0 z-50 bg-[#F4EFEB] flex flex-col overflow-hidden text-[#2D1B14] font-sans">
        {/* ── TOP STUDIO HEADER ── */}
        <header className="h-16 bg-[#0F1E36] text-white px-5 flex items-center justify-between border-b border-slate-700/60 shrink-0 z-30 shadow-md">
          {/* Left: Close & Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors border border-slate-600/50 cursor-pointer"
              aria-label="Thoát trình tạo dự án"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Thoát</span>
            </button>
            <div className="h-5 w-px bg-slate-700 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-white truncate max-w-xs">
                  {data.name || 'Dự án mới'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30">
                  {isEdit ? 'Chỉnh sửa' : 'Tạo mới'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-mono hidden sm:block">
                /du_an/{data.slug || 'slug-du-an'}
              </p>
            </div>
          </div>

          {/* Middle: Studio View Mode Switcher */}
          <div className="hidden md:flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'editor' ? 'bg-[#C5A059] text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Soạn thảo
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'split' ? 'bg-[#C5A059] text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Columns className="w-3.5 h-3.5" /> Chia đôi Studio
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'preview' ? 'bg-[#C5A059] text-white shadow-xs' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Xem trước
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="hidden xl:inline text-[11px] text-amber-400 font-medium">
                ● Chưa lưu thay đổi
              </span>
            )}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFormSubmit(false)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-gray-200 border border-slate-600 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Lưu bản nháp</span>
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleFormSubmit(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#C5A059] to-[#D4AF37] hover:from-[#B38F48] hover:to-[#C5A059] text-white transition-all flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Lưu & Xuất bản ngay</span>
            </button>
          </div>
        </header>

        {/* ── NOTIFICATION TOAST ── */}
        {notice && (
          <div
            className={`fixed top-18 right-6 z-50 px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 text-white ${
              notice.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
            }`}
          >
            {notice.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{notice.message}</span>
          </div>
        )}

        {/* ── MAIN STUDIO BODY (SIDEBAR + WORKSPACE CANVAS + OPTIONAL LIVE PREVIEW) ── */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left Navigation Rail (7 Sections) */}
          <aside className="w-64 xl:w-72 bg-white border-r border-[#E8E0D8] p-3 flex flex-col shrink-0 custom-scrollbar overflow-y-auto">
            <div className="space-y-1.5">
              <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Phân đoạn dự án (1:1 Trang thực tế)
              </span>
              {PROJECT_FORM_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const active = activeTab === idx;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(idx);
                      if (viewMode === 'preview') setViewMode('split');
                    }}
                    className={`w-full text-left p-3 rounded-2xl transition-all flex items-start gap-3 cursor-pointer ${
                      active
                        ? 'bg-[#FAF8F5] border border-[#C5A059] shadow-xs'
                        : 'hover:bg-[#FAF8F5] border border-transparent text-gray-700'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        active ? 'bg-[#C5A059] text-white shadow-xs' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold truncate ${active ? 'text-[#0F1E36]' : 'text-gray-800'}`}>
                          {idx + 1}. {step.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{step.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto pt-4 border-t border-[#E8E0D8] text-[11px] text-gray-500 px-3 space-y-2">
              <div className="flex items-center justify-between font-bold text-gray-700">
                <span>Tiêu chuẩn trang thực tế</span>
                <span className="text-[#C5A059]">7 / 7 Mục</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-normal">
                Tất cả các trường nhập liệu đều đồng bộ trực tiếp với trang hiển thị thực tế `/du_an/[slug]`.
              </p>
            </div>
          </aside>

          {/* Center Editor Canvas (Hidden in Full Preview) */}
          {viewMode !== 'preview' && (
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar bg-[#F8F3ED]">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Step Banner */}
                <div className="bg-white border border-[#E8E0D8] rounded-2xl p-4 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059] block">
                      Mục {activeTab + 1} của {PROJECT_FORM_STEPS.length}
                    </span>
                    <h2 className="text-base font-bold text-[#0F1E36]">
                      {PROJECT_FORM_STEPS[activeTab]?.title}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {activeTab > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab(activeTab - 1)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 bg-[#FAF8F5] hover:bg-gray-100 border border-[#E8E0D8] transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Trước
                      </button>
                    )}
                    {activeTab < PROJECT_FORM_STEPS.length - 1 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab(activeTab + 1)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#0F1E36] bg-[#C5A059]/10 hover:bg-[#C5A059]/20 border border-[#C5A059]/30 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        Tiếp theo <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Form Panels */}
                {activeTab === 0 && <Tab0Hero d={data} set={set} />}
                {activeTab === 1 && <Tab1Overview d={data} set={set} />}
                {activeTab === 2 && <Tab2Location d={data} set={set} />}
                {activeTab === 3 && <Tab3Layouts d={data} set={set} />}
                {activeTab === 4 && <Tab4Amenities d={data} set={set} />}
                {activeTab === 5 && <Tab5Contact d={data} set={set} />}
                {activeTab === 6 && <Tab6SEO d={data} set={set} />}
              </div>
            </main>
          )}

          {/* Right Split / Full Live Preview Pane */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <aside
              className={`${
                viewMode === 'preview' ? 'flex-1' : 'w-1/2 hidden lg:flex'
              } flex-col bg-slate-900 border-l border-slate-800 shrink-0 transition-all duration-300 relative`}
            >
              {/* Preview Bar */}
              <div className="h-11 bg-slate-950 text-gray-300 px-4 flex items-center justify-between border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-white">Live Studio Preview (Trang Thực Tế)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    className={`p-1.5 rounded-lg ${previewDevice === 'desktop' ? 'bg-[#C5A059] text-white' : 'hover:bg-slate-800'}`}
                    title="Desktop (1440px)"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    className={`p-1.5 rounded-lg ${previewDevice === 'mobile' ? 'bg-[#C5A059] text-white' : 'hover:bg-slate-800'}`}
                    title="Mobile (375px)"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={`/du_an/${data.slug || 'the-prive'}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-gray-400 hover:text-white"
                    title="Mở tab mới"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Iframe Viewport Container */}
              <div className="flex-1 bg-slate-900 overflow-auto flex items-center justify-center p-2">
                <div
                  className={`h-full transition-all duration-300 bg-white shadow-2xl overflow-hidden ${
                    previewDevice === 'mobile'
                      ? 'w-[375px] rounded-3xl border-4 border-slate-800'
                      : 'w-full rounded-none'
                  }`}
                >
                  <iframe
                    ref={previewFrameRef}
                    src="/project-preview"
                    title="Live Studio Preview"
                    className="w-full h-full border-0"
                  />
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </ProjectContext.Provider>
  );
}
