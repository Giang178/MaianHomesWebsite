'use client';

import { useState, useEffect, useRef } from 'react';
import { workspaceApi } from '../api';
import {
  CoworkingSpace,
  SeatType,
  PricingPlan,
  WorkspaceFAQ,
  WorkspaceGalleryImage,
} from '../types';
import { WorkspaceImageUploader } from './WorkspaceImageUploader';
import { WorkspaceVisibilityDialog } from './WorkspaceVisibilityDialog';
import {
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Upload,
  X,
  Star,
  Sparkles,
  Image as ImageIcon,
  Users2,
} from 'lucide-react';

export function CoworkingAdminTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibilityChanging, setVisibilityChanging] = useState(false);
  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [space, setSpace] = useState<Partial<CoworkingSpace>>({});

  const [seatTypes, setSeatTypes] = useState<SeatType[]>([]);
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([]);
  const [faqs, setFaqs] = useState<WorkspaceFAQ[]>([]);

  // Sub-tabs within Co-working
  const [subTab, setSubTab] = useState<'info' | 'intro' | 'seats' | 'pricing' | 'amenities_gallery' | 'faqs' | 'seo'>('info');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await workspaceApi.getAdminCoworking();
      if (data?.space) {
        const sp = data.space;
        const rawGallery = sp.gallery || [];
        const formattedGallery: WorkspaceGalleryImage[] = rawGallery.map((item: any, idx: number) => {
          if (typeof item === 'string') {
            return {
              id: `gal-${idx + 1}`,
              url: item,
              alt_text: '',
              caption: '',
              is_primary: idx === 0,
              display_order: idx + 1,
            };
          }
          return {
            id: item.id || `gal-${idx + 1}`,
            url: item.url || '',
            alt_text: '',
            caption: item.caption || '',
            is_primary: Boolean(item.is_primary),
            display_order: item.display_order ?? idx + 1,
          };
        });

        setSpace({
          ...sp,
          hero_alt_text: sp.hero_alt_text || sp.hero?.alt_text || '',
          intro_image: sp.intro_image || sp.introduction?.image_url || '',
          intro_alt_text: sp.intro_alt_text || sp.introduction?.alt_text || '',
          intro_title: sp.intro_title || sp.introduction?.title || '',
          intro_short_desc: sp.intro_short_desc || sp.introduction?.short_desc || '',
          intro_full_desc: sp.intro_full_desc || sp.introduction?.full_desc || '',
          intro_highlights: Array.isArray(sp.intro_highlights)
            ? sp.intro_highlights
            : (Array.isArray(sp.introduction?.highlights) ? sp.introduction.highlights : []),
          intro_target_audience: Array.isArray(sp.intro_target_audience)
            ? sp.intro_target_audience
            : (Array.isArray(sp.introduction?.target_audience) ? sp.introduction.target_audience : []),
          gallery: formattedGallery,
        });
      }
      if (data?.seat_types) {
        setSeatTypes(
          data.seat_types.map((st: any) => ({
            ...st,
            alt_text: st.alt_text || '',
          }))
        );
      }
      if (data?.pricing_plans) setPricingPlans(data.pricing_plans);
      if (data?.faqs) setFaqs(data.faqs);
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Lỗi tải dữ liệu Co-working: ' + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveAll = async () => {
    setSaving(true);
    setNotification(null);
    try {
      // Validate Alt Text for Hero and Intro
      if (space.hero_image && !space.hero_alt_text?.trim()) {
        throw new Error('Vui lòng nhập Alt text cho hình ảnh Hero Banner Co-working.');
      }
      if (space.intro_image && !space.intro_alt_text?.trim()) {
        throw new Error('Vui lòng nhập Alt text cho hình ảnh Giới thiệu không gian.');
      }

      // Validate gallery images alt text
      const currentGal = (space.gallery || []) as any[];
      const missingGalIdx = currentGal.findIndex((img) => !img.alt_text?.trim());
      if (missingGalIdx !== -1) {
        throw new Error(`Vui lòng nhập Alt text cho hình ảnh thư viện thứ ${missingGalIdx + 1}.`);
      }
      // Validate seat types image alt text
      for (let i = 0; i < seatTypes.length; i++) {
        const st = seatTypes[i];
        if (st.image_url && !st.alt_text?.trim()) {
          throw new Error(`Vui lòng nhập Alt text cho hình ảnh loại chỗ ngồi "${st.name || i + 1}".`);
        }
      }

      // Ensure gallery has valid alt text
      const sanitizedGallery = (space.gallery || []).map((img: any, idx: number) => ({
        id: img.id || `gal-${idx + 1}`,
        url: img.url,
        alt_text: img.alt_text?.trim() || '',
        caption: img.caption || '',
        is_primary: Boolean(img.is_primary),
        display_order: img.display_order ?? idx + 1,
      }));

      // Ensure seat types have valid alt text, reference_price, capacity, and status
      const sanitizedSeatTypes = seatTypes.map((st, idx) => ({
        ...st,
        reference_price: st.reference_price?.trim() || null,
        capacity: st.capacity ? Number(st.capacity) : null,
        status: st.status || 'ACTIVE',
        display_order: st.display_order ?? idx + 1,
        alt_text: st.alt_text?.trim() || '',
      }));

      // Ensure pricing plans have sanitized benefits, badge, extra_fees, and featured boolean
      const sanitizedPricingPlans = pricingPlans.map((p, idx) => ({
        ...p,
        badge: p.badge?.trim() || '',
        extra_fees: p.extra_fees?.trim() || null,
        benefits: (Array.isArray(p.benefits) ? p.benefits : String(p.benefits || '').split('\n'))
          .map((b: string) => b.trim())
          .filter(Boolean),
        is_featured: Boolean(p.is_featured || p.badge?.trim()),
        display_order: p.display_order ?? idx + 1,
      }));

      const updated = await workspaceApi.updateAdminCoworking({
        space: {
          ...space,
          status: space.status || 'PUBLISHED',
          gallery: sanitizedGallery,
          intro_highlights: Array.isArray(space.intro_highlights)
            ? space.intro_highlights.map((h: string) => (typeof h === 'string' ? h.trim() : '')).filter(Boolean)
            : [],
          intro_target_audience: Array.isArray(space.intro_target_audience)
            ? space.intro_target_audience.map((t: string) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean)
            : [],
        },
        seat_types: sanitizedSeatTypes,
        pricing_plans: sanitizedPricingPlans,
        faqs,
      });

      setSpace((current) => ({ ...current, status: updated.status, version: updated.version }));

      setNotification({
        type: 'success',
        message: 'Lưu toàn bộ cấu hình Co-working Space thành công!',
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

  const handleVisibilityChange = async () => {
    const isPublished = space.status === 'PUBLISHED';
    const action = isPublished ? 'HIDE' : 'PUBLISH';
    setVisibilityChanging(true);
    setNotification(null);
    try {
      const updated = await workspaceApi.transitionCoworkingAdmin({
        action,
        expected_version: Number(space.version || 1),
      });
      setSpace((current) => ({ ...current, status: updated.status, version: updated.version }));
      setVisibilityDialogOpen(false);

      setNotification({
        type: 'success',
        message: isPublished ? 'Đã gỡ trang Co-working khỏi website.' : 'Đã hiển thị lại trang Co-working.',
      });
    } catch (err) {
      setNotification({ type: 'error', message: 'Không thể thay đổi trạng thái trang: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setVisibilityChanging(false);
    }
  };
  const handleGalleryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setGalleryUploading(true);
    try {
      const currentGallery = (space.gallery || []) as WorkspaceGalleryImage[];
      const newItems: WorkspaceGalleryImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        const res = await workspaceApi.uploadImage(file);
        if (res?.url) {
          const idx = currentGallery.length + newItems.length + 1;
          newItems.push({
            id: 'gal-' + Date.now() + '-' + i,
            url: res.url,
            alt_text: '',
            caption: '',
            is_primary: currentGallery.length === 0 && newItems.length === 0,
            display_order: idx,
          });
        }
      }

      setSpace({
        ...space,
        gallery: [...currentGallery, ...newItems],
      });
    } catch (err) {
      setNotification({ type: 'error', message: 'Tải ảnh gallery thất bại: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setGalleryUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-3 text-[#D4AF37]" />
        Đang tải dữ liệu Co-working Space...
      </div>
    );
  }

  const galleryList = (space.gallery || []) as WorkspaceGalleryImage[];

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-900">Quản trị Co-working Space</h2>
<span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${space.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'}`}>
              {space.status === 'PUBLISHED' ? 'Đang hiển thị công khai' : 'Đã gỡ khỏi website'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Quản lý thông tin, ảnh Hero Banner, loại chỗ ngồi, bảng giá, thư viện ảnh thực tế và cấu hình SEO.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/dich-vu-cho-thue/coworking?preview=true"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition-colors"
          >
            <Eye className="w-4 h-4 text-zinc-500" />
            Xem trước (Preview)
          </a>
          <button
            type="button"
            onClick={() => setVisibilityDialogOpen(true)}
            disabled={visibilityChanging || saving}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50 ${space.status === 'PUBLISHED' ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
          >
            {visibilityChanging ? <RefreshCw className="w-4 h-4 animate-spin" /> : space.status === 'PUBLISHED' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {space.status === 'PUBLISHED' ? 'Gỡ trang' : 'Hiển thị lại'}
          </button>
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu thay đổi
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

      {/* Sub-tabs Bar */}
      <div className="flex border-b border-zinc-200 gap-2 overflow-x-auto text-sm">
        {[
          { key: 'info', label: 'Thông tin chung & Banner' },
          { key: 'intro', label: 'Giới thiệu không gian' },
          { key: 'seats', label: `Chỗ ngồi (${seatTypes.length})` },
          { key: 'pricing', label: `Gói cước (${pricingPlans.length})` },
          { key: 'amenities_gallery', label: `Tiện ích & Gallery (${galleryList.length})` },
          { key: 'faqs', label: `FAQs (${faqs.length})` },
          { key: 'seo', label: 'Cấu hình SEO / GEO' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key as typeof subTab)}
            className={`px-4 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors ${
              subTab === tab.key
                ? 'border-[#D4AF37] text-zinc-900 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. Thông tin chung & Banner */}
      {subTab === 'info' && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Tên không gian</label>
              <input
                type="text"
                value={space.name || ''}
                onChange={(e) => setSpace({ ...space, name: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Khẩu hiệu / Tagline</label>
              <input
                type="text"
                value={space.tagline || ''}
                onChange={(e) => setSpace({ ...space, tagline: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Địa chỉ thực tế</label>
              <input
                type="text"
                value={space.address || ''}
                onChange={(e) => setSpace({ ...space, address: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Quận / Huyện</label>
              <input
                type="text"
                value={space.district || ''}
                onChange={(e) => setSpace({ ...space, district: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Tỉnh / Thành phố</label>
              <input
                type="text"
                value={space.city || ''}
                onChange={(e) => setSpace({ ...space, city: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Hotline liên hệ</label>
              <input
                type="text"
                value={space.phone || ''}
                onChange={(e) => setSpace({ ...space, phone: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Email tiếp nhận</label>
              <input
                type="email"
                value={space.email || ''}
                onChange={(e) => setSpace({ ...space, email: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Giờ mở cửa</label>
              <input
                type="text"
                value={space.opening_hours || ''}
                onChange={(e) => setSpace({ ...space, opening_hours: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            {/* HERO BANNER SECTION */}
            <div className="sm:col-span-2 pt-6 border-t border-zinc-200">
              <h3 className="text-sm font-bold text-zinc-900 mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#D4AF37]" />
                Hình ảnh Hero Banner Co-working Space (Upload trực tiếp)
              </h3>
              <WorkspaceImageUploader
                images={space.hero_image ? [space.hero_image] : []}
                onChange={(imgs) => setSpace({ ...space, hero_image: imgs[0] || '' })}
                maxFiles={1}
                label="Tải ảnh Hero Banner từ máy tính (Không dùng dán URL)"
                description="Định dạng JPG, PNG, WEBP (tối đa 50MB). Ảnh được tối ưu tự động chuẩn WebP/AVIF."
                altText={space.hero_alt_text || ''}
                onAltTextChange={(alt) => setSpace({ ...space, hero_alt_text: alt })}
                altLabel="Văn bản thay thế (Alt text cho ảnh Hero Banner)"
                altPlaceholder="Ví dụ: Không gian sảnh làm việc hiện đại tại Maian Co-working Space"
                requireAlt={true}
                entityName={space.name || 'Co-working Space'}
                category="coworking"
              />
            </div>

            {/* SHORTCUT TO INTRO TAB */}
            <div className="sm:col-span-2 p-5 rounded-2xl bg-[#FAF6EE] border border-[#E8E0D8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-[#2D1B14] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#AA820A]" />
                  Quản lý nội dung Giới thiệu không gian (Introduction)
                </h4>
                <p className="text-xs text-zinc-600 mt-1">
                  Bao gồm: Tiêu đề, mô tả, ảnh thực tế, <strong>Đặc quyền & Điểm nhấn</strong> và <strong>Đối tượng khách hàng lý tưởng</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('intro')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-semibold whitespace-nowrap shadow transition-colors cursor-pointer"
              >
                Mở tab Giới thiệu &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Giới thiệu không gian (Introduction Section) */}
      {subTab === 'intro' && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
            <div>
              <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#AA820A]" />
                Phần giới thiệu không gian (Introduction Section)
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Khu vực hiển thị nổi bật ngay bên dưới Hero Banner trên trang Co-working (/dich-vu-cho-thue/coworking).
              </p>
            </div>
            <a
              href="/dich-vu-cho-thue/coworking?preview=true"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50"
            >
              <Eye className="w-3.5 h-3.5 text-zinc-500" /> Xem thực tế
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Tiêu đề phần giới thiệu</label>
              <input
                type="text"
                value={space.intro_title || ''}
                onChange={(e) => setSpace({ ...space, intro_title: e.target.value })}
                placeholder="Không Gian Khơi Nguồn Sáng Tạo & Hiệu Suất"
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Mô tả ngắn</label>
              <input
                type="text"
                value={space.intro_short_desc || ''}
                onChange={(e) => setSpace({ ...space, intro_short_desc: e.target.value })}
                placeholder="Giải pháp chỗ ngồi làm việc hiện đại, chuyên nghiệp..."
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Mô tả chi tiết</label>
              <textarea
                rows={3}
                value={space.intro_full_desc || ''}
                onChange={(e) => setSpace({ ...space, intro_full_desc: e.target.value })}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div className="sm:col-span-2">
              <WorkspaceImageUploader
                images={space.intro_image ? [space.intro_image] : []}
                onChange={(imgs) => setSpace({ ...space, intro_image: imgs[0] || '' })}
                maxFiles={1}
                label="Hình ảnh phần Giới thiệu (Upload trực tiếp)"
                description="Tải ảnh minh họa góc làm việc hoặc nội thất thực tế từ thiết bị."
                altText={space.intro_alt_text || ''}
                onAltTextChange={(alt) => setSpace({ ...space, intro_alt_text: alt })}
                altLabel="Văn bản thay thế (Alt text cho ảnh Giới thiệu)"
                altPlaceholder="Ví dụ: Khu vực bàn làm việc mở và tiện ích văn phòng tại Maian Co-working"
                requireAlt={true}
                entityName={space.name || 'Co-working Space'}
                category="coworking"
              />
            </div>

            {/* ĐẶC QUYỀN & ĐIỂM NHẤN (HIGHLIGHTS) */}
            <div className="sm:col-span-2 p-5 rounded-2xl bg-amber-50/40 border border-amber-200/70 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#AA820A]" />
                  Đặc quyền & Điểm nhấn không gian (Highlights)
                </label>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-semibold">
                  Đã nhập {Array.isArray(space.intro_highlights) ? space.intro_highlights.filter(Boolean).length : 0} điểm nhấn
                </span>
              </div>
              <p className="text-xs text-zinc-600">
                Mỗi dòng là một điểm nhấn. Hiển thị dạng danh sách 2 cột kèm biểu tượng tick vàng trên trang Co-working.
              </p>
              <textarea
                rows={4}
                placeholder={'Không gian hiện đại, yên tĩnh\nVị trí đắc địa tại Quận 10\nTiện ích trọn gói miễn phí\nÁnh sáng tự nhiên và cây xanh'}
                value={Array.isArray(space.intro_highlights) ? space.intro_highlights.join('\n') : (space.intro_highlights || '')}
                onChange={(e) => {
                  const lines = e.target.value.split('\n');
                  setSpace({ ...space, intro_highlights: lines });
                }}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs sm:text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="text-zinc-500 font-medium">Gợi ý thêm nhanh:</span>
                {[
                  'Bàn ghế công thái học cao cấp',
                  'Trà & Cà phê miễn phí trọn ngày',
                  'Wifi băng thông rộng 500Mbps',
                  'Phòng họp riêng chuẩn hội nghị',
                  'Lễ tân & nhận bưu phẩm thư từ',
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      const current = Array.isArray(space.intro_highlights) ? [...space.intro_highlights] : [];
                      if (!current.includes(item)) {
                        setSpace({ ...space, intro_highlights: [...current, item] });
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white hover:bg-amber-100 text-zinc-700 hover:text-amber-950 border border-zinc-200 transition-colors cursor-pointer shadow-2xs"
                  >
                    + {item}
                  </button>
                ))}
              </div>
            </div>

            {/* ĐỐI TƯỢNG KHÁCH HÀNG LÝ TƯỞNG (TARGET AUDIENCE) */}
            <div className="sm:col-span-2 p-5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Users2 className="w-4 h-4 text-[#AA820A]" />
                  Đối tượng khách hàng lý tưởng (Target Audience)
                </label>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-200 text-zinc-800 font-semibold">
                  Đã nhập {Array.isArray(space.intro_target_audience) ? space.intro_target_audience.filter(Boolean).length : 0} đối tượng
                </span>
              </div>
              <p className="text-xs text-zinc-600">
                Mỗi dòng là một nhóm đối tượng. Hiển thị dạng thẻ tag thanh lịch ở phần chân của mục Giới thiệu không gian.
              </p>
              <textarea
                rows={4}
                placeholder={'Freelancer & Chuyên gia làm việc tự do\nStartup & Đội ngũ công nghệ\nChuyên gia tư vấn & Đại diện thương mại\nDoanh nghiệp vừa và nhỏ (SMEs)'}
                value={Array.isArray(space.intro_target_audience) ? space.intro_target_audience.join('\n') : (space.intro_target_audience || '')}
                onChange={(e) => {
                  const lines = e.target.value.split('\n');
                  setSpace({ ...space, intro_target_audience: lines });
                }}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs sm:text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="text-zinc-500 font-medium">Gợi ý thêm nhanh:</span>
                {[
                  'Freelancer & Chuyên gia làm việc tự do',
                  'Startup & Đội ngũ công nghệ',
                  'Chuyên gia tư vấn & Đại diện thương mại',
                  'Doanh nghiệp vừa và nhỏ (SMEs)',
                  'Cộng đồng Digital Nomads',
                  'Đội nhóm dự án ngắn hạn & dài hạn',
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      const current = Array.isArray(space.intro_target_audience) ? [...space.intro_target_audience] : [];
                      if (!current.includes(item)) {
                        setSpace({ ...space, intro_target_audience: [...current, item] });
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white hover:bg-amber-100 text-zinc-700 hover:text-amber-950 border border-zinc-200 transition-colors cursor-pointer shadow-2xs"
                  >
                    + {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Chỗ ngồi */}
      {subTab === 'seats' && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900">Danh sách loại chỗ ngồi</h3>
              <p className="text-xs text-zinc-500">Mỗi loại chỗ ngồi chỉ tải ảnh trực tiếp từ máy và có mục nhập Alt text chuẩn SEO.</p>
            </div>
            <button
              onClick={() =>
                setSeatTypes([
                  ...seatTypes,
                  {
                    id: 'seat-' + Date.now(),
                    name: '',
                    code: 'SEAT_' + (seatTypes.length + 1),
                    target_audience: '',
                    description: '',
                    features: [],
                    image_url: '',
                    alt_text: '',
                    capacity: null,
                    reference_price: '',
                    status: 'ACTIVE',
                    display_order: seatTypes.length + 1,
                  },
                ])
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Thêm loại chỗ ngồi
            </button>
          </div>

          <div className="space-y-6">
            {seatTypes.map((seat, idx) => (
              <div key={seat.id || idx} className="p-5 rounded-2xl border border-zinc-200 bg-zinc-50/50 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-zinc-900">#{idx + 1} {seat.name}</span>
                    {seat.status === 'INACTIVE' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-600 font-semibold">
                        Tạm ẩn
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSeatTypes(seatTypes.filter((_, i) => i !== idx))}
                    className="text-red-600 hover:text-red-700 p-1 flex items-center gap-1 text-xs cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" /> Xóa
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Tên loại chỗ ngồi <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={seat.name}
                      onChange={(e) => {
                        const copy = [...seatTypes];
                        copy[idx].name = e.target.value;
                        setSeatTypes(copy);
                      }}
                      placeholder="Ví dụ: Chỗ ngồi linh hoạt (Hot Desk)"
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Mã code</label>
                    <input
                      type="text"
                      value={seat.code}
                      onChange={(e) => {
                        const copy = [...seatTypes];
                        copy[idx].code = e.target.value;
                        setSeatTypes(copy);
                      }}
                      placeholder="HOT_DESK"
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Trạng thái</label>
                    <select
                      value={seat.status || 'ACTIVE'}
                      onChange={(e) => {
                        const copy = [...seatTypes];
                        copy[idx].status = e.target.value as 'ACTIVE' | 'INACTIVE';
                        setSeatTypes(copy);
                      }}
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white"
                    >
                      <option value="ACTIVE">Hiển thị (ACTIVE)</option>
                      <option value="INACTIVE">Tạm ẩn (INACTIVE)</option>
                    </select>
                  </div>

                  {/* Chi phí tham khảo */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-zinc-700">
                        Chi phí tham khảo
                      </label>
                      <span className="text-[10px] text-zinc-400">Hiển thị dưới thẻ</span>
                    </div>
                    <input
                      type="text"
                      value={seat.reference_price || ''}
                      onChange={(e) => {
                        const copy = [...seatTypes];
                        copy[idx].reference_price = e.target.value;
                        setSeatTypes(copy);
                      }}
                      placeholder="Ví dụ: Từ 150.000 đ/ngày hoặc Từ 2.500.000 đ/tháng"
                      className="w-full px-3 py-1.5 border border-amber-300 rounded-lg text-xs font-medium text-[#AA820A] bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />

                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Sức chứa / Số chỗ
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={seat.capacity ?? ''}
                      onChange={(e) => {
                        const copy = [...seatTypes];
                        copy[idx].capacity = e.target.value ? parseInt(e.target.value, 10) : null;
                        setSeatTypes(copy);
                      }}
                      placeholder="Ví dụ: 35"
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Đối tượng phù hợp</label>
                    <input
                      type="text"
                      value={seat.target_audience || ''}
                      onChange={(e) => {
                        const copy = [...seatTypes];
                        copy[idx].target_audience = e.target.value;
                        setSeatTypes(copy);
                      }}
                      placeholder="Cá nhân, Freelancer..."
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Mô tả đặc quyền</label>
                    <input
                      type="text"
                      value={seat.description || ''}
                      onChange={(e) => {
                        const copy = [...seatTypes];
                        copy[idx].description = e.target.value;
                        setSeatTypes(copy);
                      }}
                      placeholder="Mô tả chi tiết quyền lợi và đặc điểm của vị trí chỗ ngồi..."
                      className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                {/* UPLOAD ẢNH CHỖ NGỒI & ALT TEXT (KHÔNG DÙNG DÁN URL) */}
                <div className="pt-3 border-t border-zinc-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start bg-white p-3.5 rounded-xl border border-zinc-200 shadow-sm">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                        Hình ảnh chỗ ngồi (Upload từ máy tính)
                      </label>
                      {seat.image_url ? (
                        <div className="relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-900 aspect-video max-h-40 group">
                          <img
                            src={seat.image_url}
                            alt={seat.alt_text || seat.name || 'Ảnh chỗ ngồi'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <label className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-zinc-900 hover:bg-[#D4AF37] hover:text-white text-xs font-semibold shadow transition-colors">
                              <Upload className="w-3.5 h-3.5" /> Thay ảnh
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    const res = await workspaceApi.uploadImage(file);
                                    if (res?.url) {
                                      const copy = [...seatTypes];
                                      copy[idx].image_url = res.url;
                                      if (!copy[idx].alt_text) copy[idx].alt_text = '';
                                      setSeatTypes(copy);
                                    }
                                  } catch (err) {
                                    setNotification({ type: 'error', message: 'Lỗi upload ảnh: ' + String(err) });
                                  }
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const copy = [...seatTypes];
                                copy[idx].image_url = '';
                                setSeatTypes(copy);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs font-semibold shadow transition-colors"
                            >
                              <X className="w-3.5 h-3.5" /> Xóa
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className="cursor-pointer border-2 border-dashed border-zinc-300 hover:border-[#D4AF37] rounded-xl p-4 flex flex-col items-center justify-center text-center bg-zinc-50/60 hover:bg-amber-50/20 transition-all block">
                          <Upload className="w-5 h-5 text-[#AA820A] mb-1" />
                          <span className="text-xs font-semibold text-zinc-800">Tải ảnh chỗ ngồi từ máy tính</span>
                          <span className="text-[10px] text-zinc-400 mt-0.5">JPG, PNG, WEBP (tối đa 50MB)</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const res = await workspaceApi.uploadImage(file);
                                if (res?.url) {
                                  const copy = [...seatTypes];
                                  copy[idx].image_url = res.url;
                                      if (!copy[idx].alt_text) copy[idx].alt_text = '';
                                  setSeatTypes(copy);
                                }
                              } catch (err) {
                                setNotification({ type: 'error', message: 'Lỗi upload ảnh: ' + String(err) });
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-zinc-700">
                          Văn bản thay thế (Alt text) <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[10px] text-zinc-400">{(seat.alt_text || '').length} ký tự</span>
                      </div>
                      <input
                        type="text"
                        value={seat.alt_text || ''}
                        onChange={(e) => {
                          const copy = [...seatTypes];
                          copy[idx].alt_text = e.target.value;
                          setSeatTypes(copy);
                        }}
                        placeholder="Ví dụ: Bàn làm việc cố định Dedicated Desk công thái học"
                        className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] bg-white shadow-sm"
                      />
                      <p className="text-[11px] text-zinc-500 mt-1.5">
                        Mô tả chi tiết ảnh giúp bot tìm kiếm nhận diện loại chỗ ngồi và tăng thứ hạng từ khóa.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Gói cước */}
      {subTab === 'pricing' && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900">Danh sách gói cước (Dynamic Pricing)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Cấu hình các gói thuê linh hoạt, bảng giá, quyền lợi tiện ích và đánh dấu gói nổi bật.
              </p>
            </div>
            <button
              onClick={() =>
                setPricingPlans([
                  ...pricingPlans,
                  {
                    id: 'plan-' + Date.now(),
                    name: '',
                    code: 'PLAN_' + (pricingPlans.length + 1),
                    seat_type_name: seatTypes[0]?.name || '',
                    description: '',
                    price: null,
                    currency: 'VND',
                    billing_period: 'THANG',
                    duration: '',
                    benefits: [],
                    is_featured: false,
                    status: 'ACTIVE',
                    display_order: pricingPlans.length + 1,
                  },
                ])
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-semibold shadow transition-colors"
            >
              <Plus className="w-4 h-4" /> Thêm gói cước
            </button>
          </div>

          <div className="space-y-5">
            {pricingPlans.map((plan, idx) => (
              <div
                key={plan.id || idx}
                className={`p-5 rounded-2xl border transition-all duration-200 space-y-4 ${
                  plan.is_featured
                    ? 'border-[#D4AF37] bg-gradient-to-b from-[#FFFDF9] to-[#FAF8F5] shadow-xs'
                    : 'border-zinc-200 bg-zinc-50/50'
                }`}
              >
                {/* Header: Title, Featured Badge & Delete */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm text-zinc-900">
                      #{idx + 1} {plan.name || 'Gói cước'}
                    </span>
                    {(plan.badge?.trim() || plan.is_featured) && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#AA820A]" />
                        {plan.badge?.trim() || ''}
                      </span>
                    )}
                    {plan.seat_type_name && (
                      <span className="text-xs text-[#AA820A] bg-[#FAF6EE] px-2 py-0.5 rounded-md border border-[#D4AF37]/30">
                        {plan.seat_type_name}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPricingPlans(pricingPlans.filter((_, i) => i !== idx))}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Xóa gói cước này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Grid 1: Basic Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Tên gói cước</label>
                    <input
                      type="text"
                      placeholder="VD: Gói Ngày, Gói Cố Định"
                      value={plan.name || ''}
                      onChange={(e) => {
                        const copy = [...pricingPlans];
                        copy[idx] = { ...copy[idx], name: e.target.value };
                        setPricingPlans(copy);
                      }}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Nhóm chỗ ngồi</label>
                    <input
                      type="text"
                      placeholder="VD: Hot Desk, Dedicated Desk"
                      value={plan.seat_type_name || ''}
                      onChange={(e) => {
                        const copy = [...pricingPlans];
                        copy[idx] = { ...copy[idx], seat_type_name: e.target.value };
                        setPricingPlans(copy);
                      }}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Giá thuê (VNĐ)</label>
                    <input
                      type="number"
                      placeholder="VD: 2500000"
                      value={plan.price ?? 0}
                      onChange={(e) => {
                        const copy = [...pricingPlans];
                        copy[idx] = { ...copy[idx], price: Number(e.target.value) };
                        setPricingPlans(copy);
                      }}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Chu kỳ thanh toán</label>
                    <select
                      value={plan.billing_period || 'THANG'}
                      onChange={(e) => {
                        const copy = [...pricingPlans];
                        copy[idx] = { ...copy[idx], billing_period: e.target.value };
                        setPricingPlans(copy);
                      }}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    >
                      <option value="NGAY">Theo Ngày (/ ngày)</option>
                      <option value="TUAN">Theo Tuần (/ tuần)</option>
                      <option value="THANG">Theo Tháng (/ tháng)</option>
                      <option value="NAM">Theo Năm (/ năm)</option>
                      <option value="LIEN_HE">Giá liên hệ</option>
                    </select>
                  </div>
                </div>

                {/* Grid 2: Duration & Short Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Thời hạn áp dụng</label>
                    <input
                      type="text"
                      placeholder="VD: 30 ngày kể từ ngày kích hoạt"
                      value={plan.duration || ''}
                      onChange={(e) => {
                        const copy = [...pricingPlans];
                        copy[idx] = { ...copy[idx], duration: e.target.value };
                        setPricingPlans(copy);
                      }}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Mô tả ngắn gói cước</label>
                    <input
                      type="text"
                      placeholder="VD: Thích hợp cho freelancer làm việc tự do hoặc nhóm khởi nghiệp"
                      value={plan.description || ''}
                      onChange={(e) => {
                        const copy = [...pricingPlans];
                        copy[idx] = { ...copy[idx], description: e.target.value };
                        setPricingPlans(copy);
                      }}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />
                  </div>
                </div>

                {/* Extra Fees / VAT Note */}
                <div className="p-3 rounded-xl bg-zinc-100/70 border border-zinc-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-zinc-700">
                      Ghi chú phụ phí / Thuế VAT (Dòng hiển thị dưới cùng của thẻ giá)
                    </label>
                    {plan.extra_fees && (
                      <button
                        type="button"
                        onClick={() => {
                          const copy = [...pricingPlans];
                          copy[idx] = { ...copy[idx], extra_fees: '' };
                          setPricingPlans(copy);
                        }}
                        className="text-[11px] text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                      >
                        ✕ Để trống
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="VD: Chưa bao gồm VAT (để trống nếu không muốn hiển thị dòng này)"
                    value={plan.extra_fees || ''}
                    onChange={(e) => {
                      const copy = [...pricingPlans];
                      copy[idx] = { ...copy[idx], extra_fees: e.target.value };
                      setPricingPlans(copy);
                    }}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-zinc-400">Gợi ý nhanh:</span>
                    {[
                      'Chưa bao gồm VAT',
                      'Đã bao gồm 10% VAT',
                      'Chưa bao gồm VAT (nếu xuất hóa đơn)',
                      'Đã bao gồm thuế và phí dịch vụ',
                    ].map((vatOption) => (
                      <button
                        key={vatOption}
                        type="button"
                        onClick={() => {
                          const copy = [...pricingPlans];
                          copy[idx] = { ...copy[idx], extra_fees: vatOption };
                          setPricingPlans(copy);
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] border transition-colors cursor-pointer ${
                          plan.extra_fees === vatOption
                            ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
                            : 'bg-white text-zinc-600 border-zinc-200 hover:border-[#D4AF37]'
                        }`}
                      >
                        {vatOption}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid 3: Quyền lợi & Tiện ích đi kèm (Benefits) */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Quyền lợi & Tiện ích đi kèm (Mỗi dòng là một quyền lợi, hiển thị kèm dấu tick xanh trên bảng giá)
                  </label>
                  <textarea
                    rows={4}
                    placeholder={'Chỗ ngồi làm việc tự do\nWifi tốc độ cao 500Mbps\nMiễn phí nước uống, trà & cà phê\nSử dụng phòng họp 5h/tháng\nLễ tân đón khách chuyên nghiệp'}
                    value={Array.isArray(plan.benefits) ? plan.benefits.join('\n') : (plan.benefits || '')}
                    onChange={(e) => {
                      const copy = [...pricingPlans];
                      const lines = e.target.value.split('\n');
                      copy[idx] = { ...copy[idx], benefits: lines };
                      setPricingPlans(copy);
                    }}
                    className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  />
                  <span className="text-[11px] text-zinc-400 mt-1 block">
                    Đã nhập {Array.isArray(plan.benefits) ? plan.benefits.filter(Boolean).length : 0} quyền lợi
                  </span>
                </div>

                {/* Grid 4: Custom Badge / Label Settings */}
                <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#AA820A]" />
                      Nhãn huy hiệu hiển thị (Custom Badge / Label)
                    </label>
                    {plan.badge && (
                      <button
                        type="button"
                        onClick={() => {
                          const copy = [...pricingPlans];
                          copy[idx] = { ...copy[idx], badge: '', is_featured: false };
                          setPricingPlans(copy);
                        }}
                        className="text-[11px] text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                      >
                        ✕ Xóa nhãn
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
                    <input
                      type="text"
                      placeholder="Nhập nhãn tùy chỉnh (VD: Tiết kiệm 20%, Hot Deal...)"
                      value={plan.badge || ''}
                      onChange={(e) => {
                        const copy = [...pricingPlans];
                        const val = e.target.value;
                        copy[idx] = {
                          ...copy[idx],
                          badge: val,
                          is_featured: Boolean(val.trim()),
                        };
                        setPricingPlans(copy);
                      }}
                      className="sm:col-span-2 px-3 py-1.5 border border-amber-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    />

                    <label className="flex items-center gap-2 text-xs font-medium text-amber-950 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(plan.is_featured || plan.badge?.trim())}
                        onChange={(e) => {
                          const copy = [...pricingPlans];
                          copy[idx] = {
                            ...copy[idx],
                            is_featured: e.target.checked,
                            badge: e.target.checked ? (copy[idx].badge || '') : '',
                          };
                          setPricingPlans(copy);
                        }}
                        className="w-4 h-4 rounded text-[#D4AF37] focus:ring-[#D4AF37] cursor-pointer"
                      />
                      <span>Bật huy hiệu nổi bật</span>
                    </label>
                  </div>

                  {/* Preset Quick Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-zinc-500 font-medium">Gợi ý nhãn nhanh:</span>
                    {[
                      'Phổ biến nhất',
                      'Bán chạy nhất',
                      'Tiết kiệm 20%',
                      'Khuyên dùng',
                      'Hot Deal',
                      'Mới ra mắt',
                      'Doanh nghiệp',
                      'Linh hoạt',
                    ].map((badgeSuggestion) => (
                      <button
                        key={badgeSuggestion}
                        type="button"
                        onClick={() => {
                          const copy = [...pricingPlans];
                          copy[idx] = {
                            ...copy[idx],
                            badge: badgeSuggestion,
                            is_featured: true,
                          };
                          setPricingPlans(copy);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                          plan.badge === badgeSuggestion
                            ? 'bg-[#D4AF37] text-white border-[#D4AF37]'
                            : 'bg-white text-zinc-700 border-zinc-200 hover:border-[#D4AF37] hover:text-[#AA820A]'
                        }`}
                      >
                        + {badgeSuggestion}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid 5: Status */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200/80">
                  <label className="text-xs text-zinc-600 font-medium">Trạng thái gói cước:</label>
                  <select
                    value={plan.status || 'ACTIVE'}
                    onChange={(e) => {
                      const copy = [...pricingPlans];
                      copy[idx] = {
                        ...copy[idx],
                        status: e.target.value as 'ACTIVE' | 'HIDDEN',
                      };
                      setPricingPlans(copy);
                    }}
                    className="px-3 py-1.5 border border-zinc-300 rounded-xl text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  >
                    <option value="ACTIVE">Hiển thị (ACTIVE)</option>
                    <option value="HIDDEN">Ẩn (HIDDEN)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Tiện ích & Gallery (100% UPLOAD TỪ THIẾT BỊ + MỤC NHẬP ALT TEXT) */}
      {subTab === 'amenities_gallery' && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-8">
          {/* Tiện ích */}
          <div>
            <h3 className="text-base font-bold text-zinc-900 mb-2">Danh sách tiện ích dịch vụ</h3>
            <p className="text-xs text-zinc-500 mb-3">Mỗi dòng là một tiện ích (VD: Lễ tân đón tiếp, Trà & Cà phê miễn phí...)</p>
            <textarea
              rows={6}
              value={space.amenities?.join('\n') || ''}
              onChange={(e) =>
                setSpace({
                  ...space,
                  amenities: e.target.value.split('\n').filter((s) => s.trim().length > 0),
                })
              }
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            />
          </div>

          {/* Gallery hình ảnh thực tế */}
          <div className="pt-6 border-t border-zinc-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#D4AF37]" />
                  Thư viện ảnh thực tế Gallery ({galleryList.length} ảnh)
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Tất cả ảnh được tải trực tiếp từ máy tính (không dùng dán URL) và bắt buộc có mục nhập Alt text chuẩn SEO.
                </p>
              </div>

              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-semibold shadow transition-all">
                {galleryUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {galleryUploading ? 'Đang tải lên...' : 'Tải thêm ảnh từ máy tính'}
                <input
                  ref={galleryInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  disabled={galleryUploading}
                  className="hidden"
                  onChange={(e) => handleGalleryUpload(e.target.files)}
                />
              </label>
            </div>

            {/* Gallery Images List */}
            {galleryList.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-zinc-200 rounded-2xl text-center text-zinc-400 text-xs">
                Chưa có ảnh nào trong thư viện Gallery. Hãy nhấn nút &quot;Tải thêm ảnh từ máy tính&quot; ở trên để bắt đầu tải ảnh thực tế.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {galleryList.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 flex flex-col sm:flex-row gap-4 items-start shadow-sm"
                  >
                    <div className="relative w-full sm:w-36 aspect-video sm:aspect-square rounded-lg overflow-hidden border border-zinc-200 bg-zinc-900 shrink-0">
                      <img
                        src={item.url}
                        alt={item.alt_text || 'Ảnh gallery'}
                        className="w-full h-full object-cover"
                      />
                      {item.is_primary && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-[#D4AF37] text-white text-[9px] font-bold shadow flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-white" /> Chính
                        </span>
                      )}
                    </div>

                    <div className="w-full space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-zinc-700">
                            Văn bản thay thế (Alt text) <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[10px] text-zinc-400">{(item.alt_text || '').length} ký tự</span>
                        </div>
                        <input
                          type="text"
                          value={item.alt_text || ''}
                          onChange={(e) => {
                            const copy = [...galleryList];
                            copy[idx].alt_text = e.target.value;
                            setSpace({ ...space, gallery: copy });
                          }}
                          placeholder="Mô tả nội dung hình ảnh..."
                          className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37] bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-zinc-700 mb-1">
                          Chú thích ảnh (Caption)
                        </label>
                        <input
                          type="text"
                          value={item.caption || ''}
                          onChange={(e) => {
                            const copy = [...galleryList];
                            copy[idx].caption = e.target.value;
                            setSpace({ ...space, gallery: copy });
                          }}
                          placeholder="Ví dụ: Khu vực bàn làm việc mở..."
                          className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#D4AF37] bg-white"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(item.is_primary)}
                            onChange={(e) => {
                              const copy = galleryList.map((g, i) => ({
                                ...g,
                                is_primary: i === idx ? e.target.checked : false,
                              }));
                              setSpace({ ...space, gallery: copy });
                            }}
                            className="rounded text-[#D4AF37] focus:ring-[#D4AF37]"
                          />
                          Đặt làm ảnh chính
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            const copy = galleryList.filter((_, i) => i !== idx);
                            setSpace({ ...space, gallery: copy });
                          }}
                          className="text-red-600 hover:text-red-700 text-xs font-medium flex items-center gap-1 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa ảnh
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. FAQs */}
      {subTab === 'faqs' && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-900">Câu hỏi thường gặp (FAQs)</h3>
            <button
              onClick={() =>
                setFaqs([
                  ...faqs,
                  {
                    id: 'faq-' + Date.now(),
                    question: 'Câu hỏi mới?',
                    answer: 'Câu trả lời chi tiết cho khách hàng...',
                    category: 'COWORKING',
                    display_order: faqs.length + 1,
                  },
                ])
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Thêm FAQ
            </button>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div key={faq.id || idx} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-zinc-500 uppercase tracking-wider">FAQ #{idx + 1}</span>
                  <button
                    onClick={() => setFaqs(faqs.filter((_, i) => i !== idx))}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Câu hỏi</label>
                  <input
                    type="text"
                    value={faq.question}
                    onChange={(e) => {
                      const copy = [...faqs];
                      copy[idx].question = e.target.value;
                      setFaqs(copy);
                    }}
                    className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Câu trả lời</label>
                  <textarea
                    rows={2}
                    value={faq.answer}
                    onChange={(e) => {
                      const copy = [...faqs];
                      copy[idx].answer = e.target.value;
                      setFaqs(copy);
                    }}
                    className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. SEO / GEO */}
      {subTab === 'seo' && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Meta Title (Tiêu đề SEO)</label>
              <input
                type="text"
                value={space.seo?.meta_title || ''}
                onChange={(e) =>
                  setSpace({
                    ...space,
                    seo: { ...(space.seo || {}), meta_title: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
              <span className="text-[11px] text-zinc-400 mt-1 block">
                Độ dài lý tưởng: 50-60 ký tự ({space.seo?.meta_title?.length || 0} ký tự)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Meta Description (Mô tả SEO)</label>
              <textarea
                rows={3}
                value={space.seo?.meta_description || ''}
                onChange={(e) =>
                  setSpace({
                    ...space,
                    seo: { ...(space.seo || {}), meta_description: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
              <span className="text-[11px] text-zinc-400 mt-1 block">
                Độ dài lý tưởng: 150-160 ký tự ({space.seo?.meta_description?.length || 0} ký tự)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Canonical URL</label>
              <input
                type="text"
                value={space.seo?.canonical_url || ''}
                onChange={(e) =>
                  setSpace({
                    ...space,
                    seo: { ...(space.seo || {}), canonical_url: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">Robots Directives</label>
              <input
                type="text"
                value={space.seo?.robots_directives || 'index, follow'}
                onChange={(e) =>
                  setSpace({
                    ...space,
                    seo: { ...(space.seo || {}), robots_directives: e.target.value },
                  })
                }
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              />
            </div>
          </div>
        </div>
      )}
      <WorkspaceVisibilityDialog
        open={visibilityDialogOpen}
        pageName="Co-working"
        isPublished={space.status === 'PUBLISHED'}
        loading={visibilityChanging}
        description={space.status === 'PUBLISHED' ? 'Nội dung vẫn được lưu và có thể hiển thị lại bất cứ lúc nào.' : 'Trang Co-working sẽ hoạt động và hiển thị công khai trở lại.'}
        onCancel={() => setVisibilityDialogOpen(false)}
        onConfirm={handleVisibilityChange}
      />
    </div>
  );
}
