'use client';

import { useState, useEffect } from 'react';
import { workspaceApi } from '../api';
import { adminConfirm } from '@/components/admin/admin-dialog-service';
import {
  OfficeBuilding,
  OfficeLandingContent,
  WorkspaceFAQ,
} from '../types';
import { OfficeBuildingModal } from './OfficeBuildingModal';
import { OfficeUnitsModal } from './OfficeUnitsModal';
import { WorkspaceImageUploader } from './WorkspaceImageUploader';
import { WorkspaceVisibilityDialog } from './WorkspaceVisibilityDialog';
import { OfficeGradesAdminTab } from './OfficeGradesAdminTab';
import { GRADE_CONFIGS, OfficeGradeType } from '../components/OfficeGradeView';
import {
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Upload,
  Globe,
} from 'lucide-react';

export function OfficeAdminTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibilityChanging, setVisibilityChanging] = useState(false);
  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  const [buildingChangingId, setBuildingChangingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [expandedGradeIdx, setExpandedGradeIdx] = useState<number | null>(0);

  const [landing, setLanding] = useState<Partial<OfficeLandingContent>>({});

  const [buildings, setBuildings] = useState<OfficeBuilding[]>([]);
  const [faqs, setFaqs] = useState<WorkspaceFAQ[]>([]);

  // Sub-tabs: 'buildings' | 'landing_content' | 'grade_pages' | 'faqs' | 'seo'
  const [subTab, setSubTab] = useState<'buildings' | 'landing_content' | 'grade_pages' | 'faqs' | 'seo'>('buildings');

  const handleSubTabChange = async (tabKey: 'buildings' | 'landing_content' | 'grade_pages' | 'faqs' | 'seo') => {
    setSubTab(tabKey);
    if (tabKey === 'grade_pages' || subTab === 'grade_pages') {
      try {
        const data = await workspaceApi.getAdminOfficeLanding();
        if (data?.landing) {
          setLanding((prev) => ({
            ...prev,
            ...data.landing,
            grade_pages: data.landing.grade_pages || prev.grade_pages,
            version: data.landing.version || prev.version,
          }));
        }
      } catch {
        // ignore
      }
    }
  };

  // Modals state
  const [selectedBuildingForEdit, setSelectedBuildingForEdit] = useState<Partial<OfficeBuilding> | null>(null);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState(false);

  const [selectedBuildingForUnits, setSelectedBuildingForUnits] = useState<OfficeBuilding | null>(null);
  const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await workspaceApi.getAdminOfficeLanding();
      if (data?.landing) {
        const l = data.landing;
        const defaultGrades = (['A', 'B', 'C'] as OfficeGradeType[]).map((g) => {
          const c = GRADE_CONFIGS[g];
          return {
            id: `grade-${g.toLowerCase()}`,
            grade: g,
            name: c.name,
            subtitle: c.tagline,
            badge: c.badge,
            priceRange: c.priceDisplay,
            price_range: c.priceDisplay,
            description: c.description,
            imageUrl: c.heroImage,
            image_url: c.heroImage,
            alt_text: c.hero_alt_text || c.name,
            target_audience: c.targetAudience,
            ceiling_height: c.specs.find((s) => s.label.includes('trần'))?.value || '≥ 2.7m',
            air_conditioning: c.specs.find((s) => s.label.includes('điều hòa'))?.value || 'Chiller BMS',
            elevators: c.specs.find((s) => s.label.includes('thang'))?.value || '< 30s',
            management_company: 'CBRE / Savills',
            specs: c.specs,
            criteriaList: c.criteriaList,
            highlights: c.criteriaList.map((item) => item.title),
          };
        });

        const activeLoadedGrades = (l.grades && l.grades.length > 0) ? l.grades.map((g: any, idx: number) => {
          const gCode = (g.grade || (idx === 0 ? 'A' : idx === 1 ? 'B' : 'C')).toUpperCase() as OfficeGradeType;
          const c = GRADE_CONFIGS[gCode] || GRADE_CONFIGS.A;
          return {
            ...g,
            specs: g.specs && g.specs.length > 0 ? g.specs : c.specs,
            criteriaList: g.criteriaList && g.criteriaList.length > 0 ? g.criteriaList : c.criteriaList,
          };
        }) : defaultGrades;

        setLanding({
          ...l,
          title: l.hero_title || l.title || '',
          subtitle: l.hero_subtitle || l.subtitle || '',
          hero_image: l.hero_image_url || l.hero_image || '',
          hero_alt_text: l.hero_alt_text || '',
          hero_badge: l.hero_badge || '',
          hero_counters: (l.hero_counters && l.hero_counters.length > 0) ? l.hero_counters : [],
          grades_title: l.grades_title || 'Hệ Thống Tiêu Chuẩn Văn Phòng Hạng A - B - C',
          grades_subtitle: l.grades_subtitle || 'Khám phá các phân khúc chất lượng với thông số kỹ thuật chuẩn hóa, bảng giá tham chiếu và tiêu chí đánh giá phù hợp từng quy mô doanh nghiệp.',
          grades: activeLoadedGrades,
          districts_title: l.districts_title || '',
          districts_subtitle: l.districts_subtitle || '',
          districts: (l.districts && l.districts.length > 0) ? l.districts : [],
          process_badge: l.process_badge || '',
          process_title: l.process_title || '',
          process_subtitle: l.process_subtitle || '',
          process_steps: (l.process_steps && l.process_steps.length > 0) ? l.process_steps : [],
          market_section_title: l.market_section_title || '',
          market_section_description: l.market_section_description || '',
          consultation_badge: l.consultation_badge || '',
          consultation_title: l.consultation_title || '',
          consultation_description: l.consultation_description || '',
          seo: {
            meta_title: l.seo?.meta_title || l.seo_metadata?.title || '',
            meta_description: l.seo?.meta_description || l.seo_metadata?.description || '',
            keywords: Array.isArray(l.seo_metadata?.keywords)
              ? l.seo_metadata.keywords.join(', ')
              : (l.seo?.keywords || l.seo_metadata?.keywords || ''),
          },
          seo_metadata: {
            title: l.seo_metadata?.title || l.seo?.meta_title || '',
            description: l.seo_metadata?.description || l.seo?.meta_description || '',
            keywords: Array.isArray(l.seo_metadata?.keywords)
              ? l.seo_metadata.keywords
              : typeof l.seo?.keywords === 'string'
              ? (l.seo.keywords as string).split(',').map((k) => k.trim()).filter(Boolean)
              : [],
            canonical_url: l.seo_metadata?.canonical_url || '',
            robots: l.seo_metadata?.robots || 'index, follow',
          },
        });
      }
      if (data?.buildings) setBuildings(data.buildings);
      if (data?.faqs) setFaqs(data.faqs);
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Lỗi tải dữ liệu Office Leasing: ' + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveLanding = async () => {
    setSaving(true);
    setNotification(null);
    try {
      // Validate Alt text for Hero Banner
      if ((landing.hero_image || landing.hero_image_url) && !landing.hero_alt_text?.trim()) {
        throw new Error('Vui lòng nhập Alt text cho hình ảnh Hero Banner Cho thuê văn phòng.');
      }

      const activeGrades = landing.grades && landing.grades.length > 0 ? landing.grades : [];
      // Validate Alt text for Grade images
      for (let i = 0; i < activeGrades.length; i++) {
        const g = activeGrades[i];
        const img = g.imageUrl || g.image_url;
        const alt = (g.alt_text || g.image_alt || '').trim();
        if (img && !alt) {
          throw new Error(`Vui lòng nhập Alt text cho hình ảnh phân khúc "${g.name || i + 1}".`);
        }
      }
      const payload = {
        ...landing,
        grade_pages: landing.grade_pages || (landing as any).grade_pages || {},
        hero_title: landing.title || landing.hero_title,
        hero_subtitle: landing.subtitle || landing.hero_subtitle,
        hero_image_url: landing.hero_image || landing.hero_image_url,
        hero_alt_text: landing.hero_alt_text || '',
        title: landing.title || landing.hero_title,
        subtitle: landing.subtitle || landing.hero_subtitle,
        hero_image: landing.hero_image || landing.hero_image_url,
        grades_title: landing.grades_title || '',
        grades_subtitle: landing.grades_subtitle || '',
        grades: activeGrades.map((g) => ({
          ...g,
          price_range: g.price_range || g.priceRange,
          priceRange: g.priceRange || g.price_range,
          image_url: g.image_url || g.imageUrl,
          imageUrl: g.imageUrl || g.image_url,
          alt_text: g.alt_text || g.image_alt || '',
          image_alt: g.alt_text || g.image_alt || '',
          specs: g.specs || [],
          criteriaList: g.criteriaList || [],
        })),
        districts: activeGrades.map((g) => ({
          id: g.id,
          name: g.name,
          district_query: g.name,
          districtQuery: g.name,
          subtitle: g.subtitle,
          badge: g.badge,
          price_range: g.price_range || g.priceRange,
          priceRange: g.priceRange || g.price_range,
          description: g.description,
          image_url: g.image_url || g.imageUrl,
          imageUrl: g.imageUrl || g.image_url,
          alt_text: g.alt_text || g.image_alt || '',
          image_alt: g.alt_text || g.image_alt || '',
          highlights: g.highlights || [],
        })),
        process_steps: landing.process_steps || [],
        hero_counters: landing.hero_counters || [],
        seo_metadata: {
          title: landing.seo?.meta_title || landing.seo_metadata?.title || '',
          description: landing.seo?.meta_description || landing.seo_metadata?.description || '',
          keywords: typeof landing.seo?.keywords === 'string'
            ? (landing.seo.keywords as string).split(',').map((k) => k.trim()).filter(Boolean)
            : Array.isArray(landing.seo_metadata?.keywords)
            ? landing.seo_metadata.keywords
            : [],
        },
        seo: {
          meta_title: landing.seo?.meta_title || landing.seo_metadata?.title || '',
          meta_description: landing.seo?.meta_description || landing.seo_metadata?.description || '',
          keywords: typeof landing.seo?.keywords === 'string'
            ? landing.seo.keywords
            : Array.isArray(landing.seo_metadata?.keywords)
            ? landing.seo_metadata.keywords.join(', ')
            : '',
        },
      };

      const updated = await workspaceApi.updateAdminOfficeLanding({
        landing: payload,
        faqs,
      });
      setLanding((current) => ({
        ...current,
        status: updated.status,
        version: updated.version,
        grade_pages: updated.grade_pages || current.grade_pages,
      }));

      setNotification({
        type: 'success',
        message: 'Lưu cấu hình trang Maian Office thành công!',
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
    const isPublished = landing.status === 'PUBLISHED';
    const action = isPublished ? 'HIDE' : 'PUBLISH';
    setVisibilityChanging(true);
    setNotification(null);
    try {
      const updated = await workspaceApi.transitionOfficeLandingAdmin({
        action,
        expected_version: Number(landing.version || 1),
      });
      setLanding((current) => ({ ...current, status: updated.status, version: updated.version }));
      setVisibilityDialogOpen(false);
      setNotification({
        type: 'success',
        message: isPublished ? 'Đã gỡ trang Office khỏi website.' : 'Đã hiển thị lại trang Office.',
      });
    } catch (err) {
      setNotification({ type: 'error', message: 'Không thể thay đổi trạng thái trang: ' + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setVisibilityChanging(false);
    }
  };
  const handleSaveBuilding = async (buildingData: Partial<OfficeBuilding>) => {
    if (buildingData.id) {
      await workspaceApi.updateAdminBuilding(buildingData.id, buildingData);
    } else {
      await workspaceApi.createAdminBuilding(buildingData);
    }
    await loadData();
  };

  const handleDeleteBuilding = async (buildingId: string) => {
    if (!await adminConfirm('Xóa vĩnh viễn tòa nhà và toàn bộ mặt bằng liên quan? Thao tác không thể hoàn tác.')) return;
    try {
      await workspaceApi.deleteAdminBuilding(buildingId);
      setNotification({ type: 'success', message: 'Đã xóa tòa nhà thành công.' });
      await loadData();
    } catch (err) {
      setNotification({ type: 'error', message: 'Lỗi xóa tòa nhà: ' + (err instanceof Error ? err.message : String(err)) });
    }
  };

  const handleBuildingVisibility = async (building: OfficeBuilding) => {
    if (!building.id) return;
    const publishDraft = building.status === 'PUBLISHED' && building.has_draft;
    const action = building.status === 'PUBLISHED' && !publishDraft ? 'HIDE' : 'PUBLISH';
    setBuildingChangingId(building.id);
    setNotification(null);
    try {
      await workspaceApi.transitionBuildingAdmin(
        building.id,
        action,
        Number(building.version || 1),
      );
      setNotification({
        type: 'success',
        message: action === 'PUBLISH'
          ? 'Đã xuất bản tòa nhà thành công.'
          : 'Đã ẩn tòa nhà khỏi website.',
      });
      await loadData();
    } catch (err) {
      setNotification({
        type: 'error',
        message: 'Không thể thay đổi trạng thái tòa nhà: ' + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setBuildingChangingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-3 text-[#D4AF37]" />
        Đang tải dữ liệu Maian Office...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-zinc-900">Quản trị Maian Office</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              {buildings.length} Tòa nhà
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${landing.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-700'}`}>
              {landing.status === 'PUBLISHED' ? 'Đang hiển thị công khai' : 'Đã gỡ khỏi website'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Quản trị hệ thống tòa nhà văn phòng, danh sách diện tích sàn trống, bộ lọc tìm kiếm và nội dung trang chủ dịch vụ.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/dich-vu-cho-thue/office?preview=true"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition-colors"
          >
            <Eye className="w-4 h-4 text-zinc-500" />
            Xem trước trang Office
          </a>
          <button
            type="button"
            onClick={() => setVisibilityDialogOpen(true)}
            disabled={visibilityChanging || saving}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50 ${landing.status === 'PUBLISHED' ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
          >
            {visibilityChanging ? <RefreshCw className="w-4 h-4 animate-spin" /> : landing.status === 'PUBLISHED' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {landing.status === 'PUBLISHED' ? 'Gỡ trang' : 'Hiển thị lại'}
          </button>
          <button
            onClick={() => {
              setSelectedBuildingForEdit(null);
              setIsBuildingModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-semibold shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            Thêm tòa nhà mới
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
          { key: 'buildings', label: `Danh sách tòa nhà (${buildings.length})` },
          { key: 'landing_content', label: 'Nội dung trang Landing' },
          { key: 'grade_pages', label: 'Trang Phân Hạng A - B - C' },
          { key: 'faqs', label: `Câu hỏi thường gặp (${faqs.length})` },
          { key: 'seo', label: 'Cấu hình SEO / GEO' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleSubTabChange(tab.key as typeof subTab)}
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

      {/* 1. Danh sách tòa nhà */}
      {subTab === 'buildings' && (() => {
        const countA = buildings.filter((b) => (b.grade || b.building_grade) === 'A').length;
        const countB = buildings.filter((b) => (b.grade || b.building_grade) === 'B').length;
        const countC = buildings.filter((b) => (b.grade || b.building_grade) === 'C').length;

        const filteredBuildings = buildings.filter((b) => {
          const g = (b.grade || b.building_grade || '').toUpperCase();
          if (gradeFilter === 'ALL') return true;
          return g === gradeFilter;
        });

        return (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Các tòa nhà văn phòng đang quản lý</h3>
                <span className="text-xs text-zinc-500">
                  Lọc nhanh theo Hạng A, B, C và nhấn &quot;Sàn trống&quot; để cập nhật mặt bằng theo từng tầng
                </span>
              </div>

              {/* Quick Grade Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setGradeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    gradeFilter === 'ALL'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Tất cả ({buildings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGradeFilter('A')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    gradeFilter === 'A'
                      ? 'bg-amber-100 text-amber-900 shadow-sm border border-amber-300'
                      : 'text-zinc-600 hover:text-amber-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Hạng A ({countA})
                </button>
                <button
                  type="button"
                  onClick={() => setGradeFilter('B')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    gradeFilter === 'B'
                      ? 'bg-blue-100 text-blue-900 shadow-sm border border-blue-300'
                      : 'text-zinc-600 hover:text-blue-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Hạng B ({countB})
                </button>
                <button
                  type="button"
                  onClick={() => setGradeFilter('C')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    gradeFilter === 'C'
                      ? 'bg-emerald-100 text-emerald-900 shadow-sm border border-emerald-300'
                      : 'text-zinc-600 hover:text-emerald-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Hạng C ({countC})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-700">
                <thead className="bg-zinc-50 border-b border-zinc-200 font-semibold text-zinc-900 uppercase">
                  <tr>
                    <th className="py-3 px-4">Tòa nhà</th>
                    <th className="py-3 px-4">Hạng</th>
                    <th className="py-3 px-4">Khoảng giá thuê</th>
                    <th className="py-3 px-4">Đặc tính kỹ thuật</th>
                    <th className="py-3 px-4">Quy mô</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredBuildings.map((b) => {
                    const gradeVal = (b.grade || b.building_grade || '').toUpperCase();
                    const badgeClass =
                      gradeVal === 'A'
                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                        : gradeVal === 'B'
                        ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';

                    return (
                      <tr key={b.id} className="hover:bg-zinc-50/80">
                        <td className="py-3 px-4">
                          <div className="font-bold text-zinc-900 text-sm">{b.name}</div>
                          <div className="text-zinc-500 text-[11px] truncate max-w-xs">{b.address}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-md text-[11px] border ${badgeClass}`}>
                            Hạng {gradeVal}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#AA820A] font-bold text-sm">
                          ${b.price_per_sqm_min || 0} - ${b.price_per_sqm_max || 0}
                          <span className="text-zinc-400 font-normal text-[11px]">/m²</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-600">
                          <div>Trần: {b.ceiling_height || '—'}</div>
                          <div className="text-[11px] text-zinc-400 truncate max-w-[160px]">
                            {b.air_conditioning || '—'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-600">
                          {b.total_floors} tầng, {b.basements || 0} hầm
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              b.status === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setSelectedBuildingForUnits(b);
                              setIsUnitsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-medium"
                          >
                            <Layers className="w-3.5 h-3.5 text-[#AA820A]" />
                            Sàn trống
                          </button>
                          <a
                            href={`/dich-vu-cho-thue/office/${b.slug}?preview=true`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex p-1.5 text-zinc-500 hover:text-blue-700"
                            title="Xem trước"
                          >
                            <Eye className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleBuildingVisibility(b)}
                            disabled={buildingChangingId === b.id}
                            className="inline-flex p-1.5 text-zinc-500 hover:text-emerald-700 disabled:opacity-50"
                            title={
                              b.status === 'PUBLISHED' && !b.has_draft
                                ? 'Ẩn khỏi website'
                                : 'Xuất bản tòa nhà'
                            }
                          >
                            {buildingChangingId === b.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : b.status === 'PUBLISHED' && !b.has_draft ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBuildingForEdit(b);
                              setIsBuildingModalOpen(true);
                            }}
                            className="p-1.5 text-zinc-500 hover:text-zinc-800"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => b.id && handleDeleteBuilding(b.id)}
                            className="p-1.5 text-red-500 hover:text-red-700"
                            title="Xóa tòa nhà"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* 2. Nội dung trang Landing */}
      {subTab === 'landing_content' && (
        <div className="space-y-8">
          {/* Top Sticky Bar */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-base font-bold text-zinc-900">Nội dung & Banner Trang Chủ Văn Phòng</h3>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Tất cả dữ liệu nhập tại đây sẽ được tự động đồng bộ lên giao diện khách hàng mà không làm thay đổi bố cục chuẩn.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <a
                href="/dich-vu-cho-thue/office?preview=true"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition-colors"
              >
                <Eye className="w-4 h-4 text-zinc-500" />
                Xem trước trang Office
              </a>
              <button
                onClick={handleSaveLanding}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang lưu...' : 'Lưu tất cả nội dung'}
              </button>
            </div>
          </div>

          {/* SECTION 1: HERO BANNER & TRUST METRICS */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-200">
              <span className="w-7 h-7 rounded-lg bg-amber-50 text-[#D4AF37] flex items-center justify-center font-bold text-xs">
                1
              </span>
              <div>
                <h4 className="text-sm font-bold text-zinc-900">Hero Banner & Chỉ Số Uy Tín (Hero Section)</h4>
                <p className="text-xs text-zinc-500">Tiêu đề chính, hình ảnh nền và 4 chỉ số nổi bật đầu trang.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Badge phụ phía trên H1</label>
                <input
                  type="text"
                  value={landing.hero_badge || ''}
                  onChange={(e) => setLanding({ ...landing, hero_badge: e.target.value })}
                  placeholder="Maian Homes Commercial • Cho Thuê Văn Phòng"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Tiêu đề chính (H1)</label>
                <input
                  type="text"
                  value={landing.title || landing.hero_title || ''}
                  onChange={(e) =>
                    setLanding({ ...landing, title: e.target.value, hero_title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Tiêu đề phụ / Slogan</label>
                <input
                  type="text"
                  value={landing.subtitle || landing.hero_subtitle || ''}
                  onChange={(e) =>
                    setLanding({ ...landing, subtitle: e.target.value, hero_subtitle: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Mô tả mở rộng (Description)</label>
                <textarea
                  rows={2}
                  value={landing.hero_description || ''}
                  onChange={(e) => setLanding({ ...landing, hero_description: e.target.value })}
                  placeholder="Không gian làm việc chuyên nghiệp, đa dạng diện tích và vị trí đắc địa..."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <WorkspaceImageUploader
                  images={
                    landing.hero_image || landing.hero_image_url
                      ? [landing.hero_image || landing.hero_image_url || '']
                      : []
                  }
                  onChange={(imgs) =>
                    setLanding({ ...landing, hero_image: imgs[0] || '', hero_image_url: imgs[0] || '' })
                  }
                  altText={landing.hero_alt_text || ''}
                  onAltTextChange={(alt) => setLanding({ ...landing, hero_alt_text: alt })}
                  altLabel="Văn bản thay thế (Alt text cho Hero Banner)"
                  altPlaceholder="Ví dụ: Hệ thống tòa nhà văn phòng cho thuê cao cấp tại TP.HCM"
                  requireAlt={true}
                  maxFiles={1}
                  label="Hình ảnh Hero Banner trang Cho thuê văn phòng"
                  description="Tải ảnh banner chính của trang văn phòng (tối đa 50MB, hệ thống tự động tối ưu hóa WebP/AVIF độ nét cao)."
                  entityName={landing.hero_title || 'Cho thuê văn phòng TP.HCM'}
                  category="office"
                />
              </div>
            </div>

            {/* 4 Hero Counters */}
            <div className="pt-4 border-t border-zinc-200">
              <label className="block text-xs font-bold text-zinc-800 uppercase tracking-wider mb-3">
                4 Chỉ số thước đo uy tín (Hero Counters)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(landing.hero_counters || []).map((counter, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-zinc-200 bg-zinc-50/70 space-y-2">
                    <span className="text-[11px] font-bold text-[#D4AF37] uppercase">Chỉ số #{idx + 1}</span>
                    <div>
                      <label className="block text-[11px] text-zinc-600 mb-0.5">Số liệu / Giá trị</label>
                      <input
                        type="text"
                        value={counter.value || ''}
                        onChange={(e) => {
                          const copy = [...(landing.hero_counters || [])];
                          copy[idx] = { ...copy[idx], value: e.target.value };
                          setLanding({ ...landing, hero_counters: copy });
                        }}
                        className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-600 mb-0.5">Nhãn chính</label>
                      <input
                        type="text"
                        value={counter.label || ''}
                        onChange={(e) => {
                          const copy = [...(landing.hero_counters || [])];
                          copy[idx] = { ...copy[idx], label: e.target.value };
                          setLanding({ ...landing, hero_counters: copy });
                        }}
                        className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-zinc-600 mb-0.5">Ghi chú phụ</label>
                      <input
                        type="text"
                        value={counter.sublabel || ''}
                        onChange={(e) => {
                          const copy = [...(landing.hero_counters || [])];
                          copy[idx] = { ...copy[idx], sublabel: e.target.value };
                          setLanding({ ...landing, hero_counters: copy });
                        }}
                        className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-[11px] text-zinc-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 2: 3 GRADE SPOTLIGHTS (HẠNG A - B - C) */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-200">
              <span className="w-7 h-7 rounded-lg bg-amber-50 text-[#D4AF37] flex items-center justify-center font-bold text-xs">
                2
              </span>
              <div>
                <h4 className="text-sm font-bold text-zinc-900">Showcase 3 Hạng Văn Phòng A - B - C (Grade Showcase & Standards)</h4>
                <p className="text-xs text-zinc-500">Banner, thông số kỹ thuật tiêu chuẩn, khoảng giá và đối tượng doanh nghiệp của từng Hạng A, B, C.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Tiêu đề Section (H2)</label>
                <input
                  type="text"
                  value={landing.grades_title || ''}
                  onChange={(e) => setLanding({ ...landing, grades_title: e.target.value })}
                  placeholder="Hệ Thống Tiêu Chuẩn Văn Phòng Hạng A - B - C"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Mô tả phụ Section</label>
                <input
                  type="text"
                  value={landing.grades_subtitle || ''}
                  onChange={(e) => setLanding({ ...landing, grades_subtitle: e.target.value })}
                  placeholder="Khám phá các phân khúc chất lượng với thông số kỹ thuật chuẩn hóa, bảng giá tham chiếu và giải pháp phù hợp từng quy mô doanh nghiệp."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* 3 Grades Accordion */}
            <div className="space-y-4">
              {(landing.grades || []).map((gradeItem, gIdx) => {
                const isExpanded = expandedGradeIdx === gIdx;
                const currentImg = gradeItem.imageUrl || gradeItem.image_url || '';
                const gradeCode = (gradeItem.grade || (gIdx === 0 ? 'A' : gIdx === 1 ? 'B' : 'C')).toUpperCase();
                const badgeTheme =
                  gradeCode === 'A'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : gradeCode === 'B'
                    ? 'bg-blue-100 text-blue-900 border-blue-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300';

                return (
                  <div
                    key={gradeItem.id || gIdx}
                    className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50/50"
                  >
                    <div
                      onClick={() => setExpandedGradeIdx(isExpanded ? null : gIdx)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-100/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${badgeTheme}`}>
                          Hạng {gradeCode}
                        </span>
                        <div>
                          <div className="font-bold text-zinc-900 text-sm">{gradeItem.name}</div>
                          <div className="text-xs text-zinc-500">{gradeItem.subtitle}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-[#AA820A] px-2.5 py-1 bg-amber-50 rounded-full border border-amber-200">
                          {gradeItem.priceRange || gradeItem.price_range || 'Báo giá'}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-5 border-t border-zinc-200 bg-white space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Tên phân hạng</label>
                            <input
                              type="text"
                              value={gradeItem.name || ''}
                              onChange={(e) => {
                                const copy = [...(landing.grades || [])];
                                copy[gIdx] = { ...copy[gIdx], name: e.target.value };
                                setLanding({ ...landing, grades: copy });
                              }}
                              className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Tiêu đề phụ định vị</label>
                            <input
                              type="text"
                              value={gradeItem.subtitle || ''}
                              onChange={(e) => {
                                const copy = [...(landing.grades || [])];
                                copy[gIdx] = { ...copy[gIdx], subtitle: e.target.value };
                                setLanding({ ...landing, grades: copy });
                              }}
                              className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Badge thể loại</label>
                            <input
                              type="text"
                              value={gradeItem.badge || ''}
                              onChange={(e) => {
                                const copy = [...(landing.grades || [])];
                                copy[gIdx] = { ...copy[gIdx], badge: e.target.value };
                                setLanding({ ...landing, grades: copy });
                              }}
                              className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Khoảng giá thuê tham chiếu</label>
                            <input
                              type="text"
                              value={gradeItem.priceRange || gradeItem.price_range || ''}
                              onChange={(e) => {
                                const copy = [...(landing.grades || [])];
                                copy[gIdx] = {
                                  ...copy[gIdx],
                                  priceRange: e.target.value,
                                  price_range: e.target.value,
                                };
                                setLanding({ ...landing, grades: copy });
                              }}
                              className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs font-bold text-[#AA820A]"
                            />
                          </div>
                        </div>

                        {/* Technical Specs for Grade */}
                        <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-3">
                          <span className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                            Thông số kỹ thuật tiêu chuẩn của Hạng {gradeCode}
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-[11px] text-zinc-600 mb-1">Chiều cao trần hoàn thiện</label>
                              <input
                                type="text"
                                placeholder="Ví dụ: ≥ 2.7m"
                                value={gradeItem.ceiling_height || ''}
                                onChange={(e) => {
                                  const copy = [...(landing.grades || [])];
                                  copy[gIdx] = { ...copy[gIdx], ceiling_height: e.target.value };
                                  setLanding({ ...landing, grades: copy });
                                }}
                                className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-zinc-600 mb-1">Hệ thống điều hòa</label>
                              <input
                                type="text"
                                placeholder="Ví dụ: Chiller trung tâm thông minh BMS"
                                value={gradeItem.air_conditioning || ''}
                                onChange={(e) => {
                                  const copy = [...(landing.grades || [])];
                                  copy[gIdx] = { ...copy[gIdx], air_conditioning: e.target.value };
                                  setLanding({ ...landing, grades: copy });
                                }}
                                className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-zinc-600 mb-1">Hệ thống thang máy</label>
                              <input
                                type="text"
                                placeholder="Ví dụ: Tốc độ cao, chờ < 30s"
                                value={gradeItem.elevators || ''}
                                onChange={(e) => {
                                  const copy = [...(landing.grades || [])];
                                  copy[gIdx] = { ...copy[gIdx], elevators: e.target.value };
                                  setLanding({ ...landing, grades: copy });
                                }}
                                className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-zinc-600 mb-1">Đơn vị quản lý vận hành</label>
                              <input
                                type="text"
                                placeholder="Ví dụ: CBRE / Savills / JLL quốc tế"
                                value={gradeItem.management_company || ''}
                                onChange={(e) => {
                                  const copy = [...(landing.grades || [])];
                                  copy[gIdx] = { ...copy[gIdx], management_company: e.target.value };
                                  setLanding({ ...landing, grades: copy });
                                }}
                                className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs bg-white"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Đối tượng doanh nghiệp phù hợp</label>
                          <input
                            type="text"
                            value={gradeItem.target_audience || ''}
                            onChange={(e) => {
                              const copy = [...(landing.grades || [])];
                              copy[gIdx] = { ...copy[gIdx], target_audience: e.target.value };
                              setLanding({ ...landing, grades: copy });
                            }}
                            placeholder="Ví dụ: Tập đoàn đa quốc gia, ngân hàng, công ty tài chính"
                            className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Mô tả phân hạng</label>
                          <textarea
                            rows={2}
                            value={gradeItem.description || ''}
                            onChange={(e) => {
                              const copy = [...(landing.grades || [])];
                              copy[gIdx] = { ...copy[gIdx], description: e.target.value };
                              setLanding({ ...landing, grades: copy });
                            }}
                            className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs"
                          />
                        </div>

                        {/* Grade Banner Image */}
                        <div>
                          <WorkspaceImageUploader
                            images={currentImg ? [currentImg] : []}
                            onChange={(imgs) => {
                              const copy = [...(landing.grades || [])];
                              copy[gIdx] = {
                                ...copy[gIdx],
                                imageUrl: imgs[0] || '',
                                image_url: imgs[0] || '',
                              };
                              setLanding({ ...landing, grades: copy });
                            }}
                            altText={gradeItem.alt_text || gradeItem.image_alt || ''}
                            onAltTextChange={(val) => {
                              const copy = [...(landing.grades || [])];
                              copy[gIdx] = {
                                ...copy[gIdx],
                                alt_text: val,
                                image_alt: val,
                              };
                              setLanding({ ...landing, grades: copy });
                            }}
                            altLabel={`Văn bản thay thế (Alt text cho ảnh Hạng ${gradeCode})`}
                            altPlaceholder={`Ví dụ: Tòa nhà văn phòng cho thuê ${gradeItem.name} — Maian Homes`}
                            requireAlt={true}
                            maxFiles={1}
                            label={`Hình ảnh đại diện Hạng ${gradeCode}`}
                            description="Khuyến nghị: 800x600px, WebP/JPG < 50MB"
                            entityName={gradeItem.name || `Văn phòng Hạng ${gradeCode}`}
                            category="grade"
                          />
                        </div>

                        {/* 3. Bộ 4 Thông Số Kỹ Thuật Tiêu Chuẩn (Specs Grid) */}
                        <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200/80 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider block">
                              3. Bộ 4 Thông Số Kỹ Thuật Tiêu Chuẩn (Specs Grid — Hạng {gradeCode})
                            </span>
                            <span className="text-[10.5px] text-zinc-400">
                              Hiển thị dạng thẻ chỉ số kỹ thuật nổi bật trên Landing Page &amp; Trang con
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {[0, 1, 2, 3].map((sIdx) => {
                              const spec = gradeItem.specs?.[sIdx] || { label: '', value: '', desc: '' };
                              const defaultLabels = ['Chiều cao trần', 'Hệ thống điều hòa', 'Hệ thống thang máy', 'Điện dự phòng'];
                              const defaultPlaceholders = [
                                { label: 'Chiều cao trần', value: '≥ 2.7m', desc: 'Trần hoàn thiện thông thoáng' },
                                { label: 'Hệ thống điều hòa', value: 'Chiller BMS', desc: 'Điều hòa trung tâm tiết kiệm điện' },
                                { label: 'Hệ thống thang máy', value: '< 30s', desc: 'Thời gian chờ tốc độ cao' },
                                { label: 'Điện dự phòng', value: '100%', desc: 'Hệ thống máy phát tự động' },
                              ];
                              const def = defaultPlaceholders[sIdx] || { label: 'Thông số', value: 'Chuẩn', desc: 'Ghi chú' };

                              return (
                                <div key={sIdx} className="p-2.5 rounded-lg bg-white border border-zinc-200 space-y-1.5">
                                  <span className="text-[10px] font-bold text-[#AA820A] uppercase tracking-wider block">
                                    Thông số #{sIdx + 1}
                                  </span>
                                  <div>
                                    <label className="block text-[10.5px] text-zinc-500 mb-0.5">Tên thông số</label>
                                    <input
                                      type="text"
                                      placeholder={def.label}
                                      value={spec.label || ''}
                                      onChange={(e) => {
                                        const copy = [...(landing.grades || [])];
                                        const specsCopy = [...(copy[gIdx].specs || [
                                          { label: '', value: '', desc: '' },
                                          { label: '', value: '', desc: '' },
                                          { label: '', value: '', desc: '' },
                                          { label: '', value: '', desc: '' },
                                        ])];
                                        specsCopy[sIdx] = { ...specsCopy[sIdx], label: e.target.value };
                                        copy[gIdx] = { ...copy[gIdx], specs: specsCopy };
                                        setLanding({ ...landing, grades: copy });
                                      }}
                                      className="w-full px-2 py-1 border border-zinc-200 rounded text-xs font-medium"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10.5px] text-zinc-500 mb-0.5">Giá trị đo lường</label>
                                    <input
                                      type="text"
                                      placeholder={def.value}
                                      value={spec.value || ''}
                                      onChange={(e) => {
                                        const copy = [...(landing.grades || [])];
                                        const specsCopy = [...(copy[gIdx].specs || [
                                          { label: '', value: '', desc: '' },
                                          { label: '', value: '', desc: '' },
                                          { label: '', value: '', desc: '' },
                                          { label: '', value: '', desc: '' },
                                        ])];
                                        specsCopy[sIdx] = { ...specsCopy[sIdx], value: e.target.value };
                                        copy[gIdx] = { ...copy[gIdx], specs: specsCopy };
                                        setLanding({ ...landing, grades: copy });
                                      }}
                                      className="w-full px-2 py-1 border border-zinc-200 rounded text-xs font-bold text-zinc-900"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10.5px] text-zinc-500 mb-0.5">Ghi chú phụ</label>
                                    <input
                                      type="text"
                                      placeholder={def.desc}
                                      value={spec.desc || ''}
                                      onChange={(e) => {
                                        const copy = [...(landing.grades || [])];
                                        const specsCopy = [...(copy[gIdx].specs || [
                                          { label: '', value: '', desc: '' },
                                          { label: '', value: '', desc: '' },
                                          { label: '', value: '', desc: '' },
                                          { label: '', value: '', desc: '' },
                                        ])];
                                        specsCopy[sIdx] = { ...specsCopy[sIdx], desc: e.target.value };
                                        copy[gIdx] = { ...copy[gIdx], specs: specsCopy };
                                        setLanding({ ...landing, grades: copy });
                                      }}
                                      className="w-full px-2 py-1 border border-zinc-200 rounded text-[11px] text-zinc-500"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>



                        {/* 4 Highlights */}
                        <div>
                          <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                            4 Điểm nổi bật của Hạng {gradeCode} (Highlights)
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                            {[0, 1, 2, 3].map((hIdx) => (
                              <input
                                key={hIdx}
                                type="text"
                                value={gradeItem.highlights?.[hIdx] || ''}
                                onChange={(e) => {
                                  const copy = [...(landing.grades || [])];
                                  const hl = [...(copy[gIdx].highlights || [])];
                                  hl[hIdx] = e.target.value;
                                  copy[gIdx] = { ...copy[gIdx], highlights: hl };
                                  setLanding({ ...landing, grades: copy });
                                }}
                                placeholder={`Điểm nổi bật ${hIdx + 1}`}
                                className="w-full px-3 py-1.5 border border-zinc-300 rounded-lg text-xs"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: 4-STEP LEASING PROCESS */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-200">
              <span className="w-7 h-7 rounded-lg bg-amber-50 text-[#D4AF37] flex items-center justify-center font-bold text-xs">
                3
              </span>
              <div>
                <h4 className="text-sm font-bold text-zinc-900">Quy Trình 4 Bước Thuê Văn Phòng (Leasing Process)</h4>
                <p className="text-xs text-zinc-500">Các bước tư vấn doanh nghiệp 1-1 hiển thị trên trang chủ.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Badge quy trình</label>
                <input
                  type="text"
                  value={landing.process_badge || ''}
                  onChange={(e) => setLanding({ ...landing, process_badge: e.target.value })}
                  placeholder="Dịch Vụ Tư Vấn Doanh Nghiệp 1-1"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Tiêu đề quy trình (H2)</label>
                <input
                  type="text"
                  value={landing.process_title || ''}
                  onChange={(e) => setLanding({ ...landing, process_title: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Phụ đề quy trình</label>
                <input
                  type="text"
                  value={landing.process_subtitle || ''}
                  onChange={(e) => setLanding({ ...landing, process_subtitle: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(landing.process_steps || []).map((stepItem, sIdx) => (
                <div key={sIdx} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/60 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#D4AF37] text-white font-mono font-bold text-xs">
                      {stepItem.step || `0${sIdx + 1}`}
                    </span>
                    <span className="font-bold text-xs text-zinc-800">Bước {sIdx + 1}</span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-600 mb-1">Tên bước</label>
                    <input
                      type="text"
                      value={stepItem.title || ''}
                      onChange={(e) => {
                        const copy = [...(landing.process_steps || [])];
                        copy[sIdx] = { ...copy[sIdx], title: e.target.value };
                        setLanding({ ...landing, process_steps: copy });
                      }}
                      className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-600 mb-1">Tiêu đề phụ / Lợi ích</label>
                    <input
                      type="text"
                      value={stepItem.subtitle || ''}
                      onChange={(e) => {
                        const copy = [...(landing.process_steps || [])];
                        copy[sIdx] = { ...copy[sIdx], subtitle: e.target.value };
                        setLanding({ ...landing, process_steps: copy });
                      }}
                      className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-zinc-600 mb-1">Mô tả chi tiết bước</label>
                    <textarea
                      rows={2}
                      value={stepItem.description || ''}
                      onChange={(e) => {
                        const copy = [...(landing.process_steps || [])];
                        copy[sIdx] = { ...copy[sIdx], description: e.target.value };
                        setLanding({ ...landing, process_steps: copy });
                      }}
                      className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: MARKET OVERVIEW & GEO BLOCK */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-200">
              <span className="w-7 h-7 rounded-lg bg-amber-50 text-[#D4AF37] flex items-center justify-center font-bold text-xs">
                4
              </span>
              <div>
                <h4 className="text-sm font-bold text-zinc-900">
                  Thông Tin Thị Trường & Giá Trị Bản Địa (Semantic GEO Block)
                </h4>
                <p className="text-xs text-zinc-500">Khối văn bản tối ưu SEO ngữ nghĩa và trợ lý AI địa phương.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Tiêu đề khối thị trường (H2)</label>
                <input
                  type="text"
                  value={landing.market_section_title || ''}
                  onChange={(e) => setLanding({ ...landing, market_section_title: e.target.value })}
                  placeholder="Thông Tin Thị Trường Văn Phòng Cho Thuê TP. Hồ Chí Minh — Maian Homes"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Nội dung phân tích thị trường</label>
                <textarea
                  rows={4}
                  value={landing.market_section_description || ''}
                  onChange={(e) => setLanding({ ...landing, market_section_description: e.target.value })}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: CONSULTATION CTA BLOCK */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-200">
              <span className="w-7 h-7 rounded-lg bg-amber-50 text-[#D4AF37] flex items-center justify-center font-bold text-xs">
                5
              </span>
              <div>
                <h4 className="text-sm font-bold text-zinc-900">Form Đăng Ký Tư Vấn (Consultation CTA Block)</h4>
                <p className="text-xs text-zinc-500">Tiêu đề và thông điệp kêu gọi hành động cuối trang.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Badge form</label>
                <input
                  type="text"
                  value={landing.consultation_badge || ''}
                  onChange={(e) => setLanding({ ...landing, consultation_badge: e.target.value })}
                  placeholder="Đăng Ký Tư Vấn Trực Tiếp"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Tiêu đề form (H2)</label>
                <input
                  type="text"
                  value={landing.consultation_title || ''}
                  onChange={(e) => setLanding({ ...landing, consultation_title: e.target.value })}
                  placeholder="Nhận Báo Giá & Danh Sách Sàn Trống"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm font-medium"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Mô tả form</label>
                <textarea
                  rows={2}
                  value={landing.consultation_description || ''}
                  onChange={(e) => setLanding({ ...landing, consultation_description: e.target.value })}
                  placeholder="Chuyên viên văn phòng Maian Homes sẽ liên hệ trong 15 phút với bảng so sánh chi tiết các tòa nhà phù hợp với ngân sách của bạn."
                  className="w-full px-3 py-2 border border-zinc-300 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>

          {/* Bottom Save Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Nhớ kiểm tra lại bản xem trước sau khi lưu để xác nhận hiển thị hoàn hảo.
            </span>
            <div className="flex items-center gap-3">
              <a
                href="/dich-vu-cho-thue/office?preview=true"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-300 text-zinc-700 text-xs font-medium hover:bg-zinc-50 transition-colors"
              >
                <Eye className="w-4 h-4 text-zinc-500" />
                Xem trước trang Office
              </a>
              <button
                onClick={handleSaveLanding}
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-semibold shadow transition-all disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang lưu...' : 'Lưu tất cả nội dung'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2.5 Trang Phân Hạng A - B - C */}
      {subTab === 'grade_pages' && (
        <OfficeGradesAdminTab
          onSaved={(updated) => {
            setLanding((prev) => ({
              ...prev,
              grade_pages: updated.grade_pages || prev.grade_pages,
              version: updated.version || prev.version,
              status: updated.status || prev.status,
            }));
          }}
        />
      )}

      {/* 3. FAQs */}
      {subTab === 'faqs' && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-900">Câu hỏi thường gặp về Thuê Văn Phòng</h3>
            <button
              onClick={() =>
                setFaqs([
                  ...faqs,
                  {
                    id: 'faq-' + Date.now(),
                    question: 'Câu hỏi mới?',
                    answer: 'Câu trả lời chi tiết cho khách hàng...',
                    category: 'OFFICE',
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

          <div className="pt-4 border-t border-zinc-200 flex justify-end">
            <button
              onClick={handleSaveLanding}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-semibold shadow"
            >
              <Save className="w-4 h-4" />
              Lưu danh sách FAQs
            </button>
          </div>
        </div>
      )}

      {/* 4. SEO / GEO */}
      {subTab === 'seo' && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-zinc-200">
            <div>
              <h3 className="text-base font-bold text-zinc-900">Cấu hình SEO Onpage & Tín hiệu Định vị GEO (Trang Office)</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Tối ưu hóa công cụ tìm kiếm Google và thiết lập tín hiệu địa lý địa phương cho trang danh mục cho thuê văn phòng.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLanding((prev) => ({
                    ...prev,
                    seo: {
                      ...(prev.seo || {}),
                      meta_title: 'Cho Thuê Văn Phòng TP.HCM Chuyên Nghiệp | Hạng A, B, C | Mai An Homes'.slice(0, 65),
                      meta_description: 'Dịch vụ cho thuê văn phòng chuyên nghiệp tại TP.HCM. Cập nhật bảng giá, diện tích trống các tòa nhà văn phòng Hạng A, B, C tại Quận 1, Quận 3, Thủ Đức, Bình Thạnh...'.slice(0, 160),
                      keywords: 'cho thuê văn phòng tphcm, văn phòng hạng a, văn phòng hạng b, thuê văn phòng quận 1, mai an homes office',
                    },
                  }));
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[#AA820A] text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#AA820A]" /> AI gợi ý SEO
              </button>
              <button
                onClick={handleSaveLanding}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang lưu...' : 'Lưu cấu hình SEO'}
              </button>
            </div>
          </div>

          {/* Google SERP Snippet Preview */}
          <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" /> Xem trước kết quả tìm kiếm Google (SERP Snippet)
              </span>
              <span className="text-[10px] text-zinc-400">Google Desktop / Mobile Preview</span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-zinc-200 space-y-1 font-sans shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-zinc-600 truncate">
                <span className="text-zinc-500">https://maianhomes.com</span>
                <span className="text-zinc-400">›</span>
                <span className="text-zinc-600">dich-vu-cho-thue</span>
                <span className="text-zinc-400">›</span>
                <span className="text-zinc-800 font-medium">office</span>
              </div>
              <h3 className="text-base sm:text-lg text-[#1a0dab] hover:underline font-medium leading-snug cursor-pointer line-clamp-1">
                {landing.seo?.meta_title || 'Cho Thuê Văn Phòng Chuyên Nghiệp Hạng A, B, C | Mai An Homes'}
              </h3>
              <p className="text-xs sm:text-sm text-[#4d5156] leading-relaxed line-clamp-2">
                {landing.seo?.meta_description || 'Dịch vụ cho thuê văn phòng trọn gói tại TP.HCM. Báo giá minh bạch, diện tích linh hoạt từ 50m² - 2000m² tại các tòa nhà cao ốc hàng đầu.'}
              </p>
            </div>
          </div>

          {/* Meta inputs */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-zinc-800">Meta Title (Tiêu đề SEO)</label>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold ${
                      (landing.seo?.meta_title?.length || 0) >= 40 && (landing.seo?.meta_title?.length || 0) <= 65
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {(landing.seo?.meta_title?.length || 0)} / 65 ký tự
                  </span>
                  <span className="text-[10px] text-zinc-400">(Khuyên dùng: 40-65 ký tự)</span>
                </div>
              </div>
              <input
                type="text"
                value={landing.seo?.meta_title || ''}
                onChange={(e) =>
                  setLanding({
                    ...landing,
                    seo: { ...(landing.seo || {}), meta_title: e.target.value },
                  })
                }
                placeholder="Ví dụ: Cho Thuê Văn Phòng Chuyên Nghiệp TP.HCM | Hạng A, B, C - Mai An Homes"
                className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-zinc-800">Meta Description (Mô tả SEO)</label>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold ${
                      (landing.seo?.meta_description?.length || 0) >= 120 && (landing.seo?.meta_description?.length || 0) <= 165
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {(landing.seo?.meta_description?.length || 0)} / 165 ký tự
                  </span>
                  <span className="text-[10px] text-zinc-400">(Khuyên dùng: 120-165 ký tự)</span>
                </div>
              </div>
              <textarea
                rows={3}
                value={landing.seo?.meta_description || ''}
                onChange={(e) =>
                  setLanding({
                    ...landing,
                    seo: { ...(landing.seo || {}), meta_description: e.target.value },
                  })
                }
                placeholder="Nhập mô tả tóm tắt hấp dẫn thu hút khách hàng nhấp chuột từ kết quả tìm kiếm Google..."
                className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-800 mb-1">
                Từ khóa tìm kiếm (Keywords, cách nhau bằng dấu phẩy)
              </label>
              <input
                type="text"
                value={landing.seo?.keywords || ''}
                onChange={(e) =>
                  setLanding({
                    ...landing,
                    seo: { ...(landing.seo || {}), keywords: e.target.value },
                  })
                }
                placeholder="Ví dụ: cho thuê văn phòng tphcm, văn phòng hạng a, văn phòng quận 1"
                className="w-full px-3.5 py-2.5 border border-zinc-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]"
              />
            </div>
          </div>

          {/* GEO Local SEO Signals Summary */}
          <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#AA820A]" />
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                Tín hiệu GEO Local SEO đã tích hợp sẵn cho Landing Page
              </h4>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Trang đích Office đã được gắn tự động các thẻ meta định vị địa lý chuẩn quốc tế:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-white border border-zinc-200">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">geo.region</span>
                <span className="font-semibold text-zinc-900">VN-SG</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-zinc-200">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">geo.placename</span>
                <span className="font-semibold text-zinc-900">Hồ Chí Minh</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-zinc-200">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">geo.position</span>
                <span className="font-semibold text-zinc-900">10.7718;106.7042</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-zinc-200">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">ICBM (GPS)</span>
                <span className="font-semibold text-zinc-900">10.7718, 106.7042</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <OfficeBuildingModal
        isOpen={isBuildingModalOpen}
        building={selectedBuildingForEdit}
        onClose={() => setIsBuildingModalOpen(false)}
        onSave={handleSaveBuilding}
      />

      <OfficeUnitsModal
        isOpen={isUnitsModalOpen}
        building={selectedBuildingForUnits}
        onClose={() => setIsUnitsModalOpen(false)}
      />
      <WorkspaceVisibilityDialog
        open={visibilityDialogOpen}
        pageName="Office"
        isPublished={landing.status === 'PUBLISHED'}
        loading={visibilityChanging}
        description={landing.status === 'PUBLISHED' ? 'Nội dung và danh sách tòa nhà vẫn được lưu và có thể hiển thị lại bất cứ lúc nào.' : 'Trang Office sẽ hoạt động và hiển thị công khai trở lại.'}
        onCancel={() => setVisibilityDialogOpen(false)}
        onConfirm={handleVisibilityChange}
      />
    </div>
  );
}
