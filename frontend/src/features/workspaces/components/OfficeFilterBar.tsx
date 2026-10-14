'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  ChevronDown,
  X,
  MapPin,
  DollarSign,
  Ruler,
} from 'lucide-react';

interface OfficeFilterBarProps {
  totalCount?: number;
  districts?: string[];
  sortBy?: string;
  onSortChange?: (sort: string) => void;
}


const BUDGET_OPTIONS = [
  { value: 'all', label: 'Tất cả mức giá' },
  { value: 'under_20', label: 'Dưới $20 / m²' },
  { value: '20_35', label: '$20 - $35 / m²' },
  { value: 'over_35', label: 'Trên $35 / m²' },
];

const AREA_OPTIONS = [
  { value: 'all', label: 'Tất cả diện tích' },
  { value: 'under_100', label: 'Dưới 100 m²' },
  { value: '100_300', label: '100 - 300 m²' },
  { value: '300_500', label: '300 - 500 m²' },
  { value: 'over_500', label: 'Trên 500 m²' },
];

const GRADE_TABS = [
  { key: 'all', label: 'Tất cả văn phòng' },
  { key: 'A', label: 'Hạng A' },
  { key: 'B', label: 'Hạng B' },
  { key: 'C', label: 'Hạng C' },
];

const SORT_OPTIONS = [
  { value: 'default', label: 'Gợi ý cho bạn' },
  { value: 'price_asc', label: 'Giá: Thấp đến cao' },
  { value: 'price_desc', label: 'Giá: Cao đến thấp' },
  { value: 'area_desc', label: 'Diện tích: Lớn nhất' },
];

export default function OfficeFilterBar({
  totalCount = 6,
  districts = [],
  sortBy = 'default',
  onSortChange,
}: OfficeFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedDistrict, setSelectedDistrict] = useState(searchParams?.get('district') || 'all');
  const [selectedBudget, setSelectedBudget] = useState('all');
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState(searchParams?.get('grade') || 'all');
  const [keyword, setKeyword] = useState(searchParams?.get('search') || '');
  const districtOptions = [
    { value: 'all', label: 'All districts' },
    ...districts.map((district) => ({ value: district, label: district })),
  ];

  // Keep the controls in sync with the server-rendered query state.
  useEffect(() => {
    setSelectedDistrict(searchParams?.get('district') || 'all');
    setSelectedGrade(searchParams?.get('grade') || 'all');
    setKeyword(searchParams?.get('search') || '');

    setSelectedArea(searchParams?.get('area_band') || 'all');
    setSelectedBudget(searchParams?.get('budget_band') || 'all');
  }, [searchParams]);

  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const triggerFilter = (
    dist = selectedDistrict,
    bud = selectedBudget,
    area = selectedArea,
    grd = selectedGrade,
    kw = keyword
  ) => {
    const bOpt = BUDGET_OPTIONS.find((b) => b.value === bud);
    const aOpt = AREA_OPTIONS.find((a) => a.value === area);

    // Sync URL without hard page reload
    const params = new URLSearchParams();
    if (dist !== 'all') params.set('district', dist);
    if (grd !== 'all') params.set('grade', grd);
    if (bOpt?.value && bOpt.value !== 'all') params.set('budget_band', bOpt.value);
    if (aOpt?.value && aOpt.value !== 'all') params.set('area_band', aOpt.value);
    if (kw.trim()) params.set('search', kw.trim());

    const qs = params.toString();
    const newUrl = `/dich-vu-cho-thue/office${qs ? `?${qs}` : ''}#danh-sach-toa-nha`;
    router.replace(newUrl, { scroll: false });
  };

  const handleGradeSelect = (key: string) => {
    setSelectedGrade(key);
    triggerFilter(selectedDistrict, selectedBudget, selectedArea, key, keyword);
  };

  const currentDistrictLabel =
    districtOptions.find((d) => d.value === selectedDistrict)?.label || 'Tất cả khu vực';
  const currentBudgetLabel =
    BUDGET_OPTIONS.find((b) => b.value === selectedBudget)?.label || 'Tất cả mức giá';
  const currentAreaLabel =
    AREA_OPTIONS.find((a) => a.value === selectedArea)?.label || 'Tất cả diện tích';
  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.value === sortBy)?.label || 'Gợi ý cho bạn';

  return (
    <div ref={containerRef} className="space-y-10">
      {/* =========================================================================
          1. TOP MAIN FILTER BAR (3 DROPDOWNS + 1 BUTTON "TÌM VĂN PHÒNG")
          ========================================================================= */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-zinc-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          {/* Dropdown 1: Vị trí văn phòng */}
          <div className="relative">
            <span className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1 px-1">
              Vị trí văn phòng
            </span>
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'district' ? null : 'district')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 text-xs font-medium text-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <MapPin className="w-3.5 h-3.5 text-[#b84518] shrink-0" />
                <span className="truncate">{currentDistrictLabel}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
            </button>

            {openDropdown === 'district' && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-xl p-1.5 z-40 max-h-60 overflow-y-auto">
                {districtOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSelectedDistrict(opt.value);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedDistrict === opt.value
                        ? 'bg-zinc-900 text-white font-semibold'
                        : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dropdown 2: Ngân sách / m² / tháng */}
          <div className="relative">
            <span className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1 px-1">
              Ngân sách / m² / tháng
            </span>
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'budget' ? null : 'budget')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 text-xs font-medium text-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <DollarSign className="w-3.5 h-3.5 text-[#b84518] shrink-0" />
                <span className="truncate">{currentBudgetLabel}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
            </button>

            {openDropdown === 'budget' && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-xl p-1.5 z-40">
                {BUDGET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSelectedBudget(opt.value);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedBudget === opt.value
                        ? 'bg-zinc-900 text-white font-semibold'
                        : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dropdown 3: Diện tích cần thuê */}
          <div className="relative">
            <span className="block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-1 px-1">
              Diện tích cần thuê
            </span>
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'area' ? null : 'area')}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 text-xs font-medium text-zinc-800 transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <Ruler className="w-3.5 h-3.5 text-[#b84518] shrink-0" />
                <span className="truncate">{currentAreaLabel}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
            </button>

            {openDropdown === 'area' && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-xl p-1.5 z-40">
                {AREA_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSelectedArea(opt.value);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedArea === opt.value
                        ? 'bg-zinc-900 text-white font-semibold'
                        : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Button Submit: Tìm văn phòng */}
          <div className="pt-1 sm:pt-5">
            <button
              type="button"
              onClick={() => triggerFilter()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#b84518] hover:bg-[#a03c14] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-lg"
            >
              <Search className="w-4 h-4" />
              <span>Tìm văn phòng</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. SECTION HEADER & EXPLORATION TABS (EXACT MATCH IMAGE 1)
          ========================================================================= */}
      <div className="space-y-6">
        {/* Title Block */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#b84518] block mb-1">
              — Lựa chọn không gian của bạn
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-900">
              Văn phòng đáng khám phá
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1 font-light">
              Những địa chỉ phù hợp cho bước phát triển tiếp theo.
            </p>
          </div>

          <Link
            href="/lien-he"
            className="text-xs font-semibold text-zinc-700 hover:text-[#b84518] underline underline-offset-4 transition-colors shrink-0"
          >
            Cần gợi ý phù hợp hơn?
          </Link>
        </div>

        {/* Tab Buttons Row (Tất cả, Hạng A, Hạng B, Hạng C) + Count & Sort */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          {/* Grade Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {GRADE_TABS.map((tab) => {
              const isActive = selectedGrade === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleGradeSelect(tab.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-zinc-900 text-white shadow-sm'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right: Buildings Count & Sort Dropdown */}
          <div className="flex items-center gap-3 text-xs text-zinc-600 shrink-0">
            <span className="font-medium text-zinc-700">{totalCount} tòa nhà</span>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSortOpen(!sortOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 transition-colors"
              >
                <span>Sắp xếp: {currentSortLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </button>

              {sortOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-zinc-200 rounded-xl shadow-xl p-1.5 z-40">
                  {SORT_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => {
                        onSortChange?.(s.value);
                        setSortOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        sortBy === s.value
                          ? 'bg-zinc-900 text-white font-semibold'
                          : 'text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên tòa nhà, tên đường..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                triggerFilter(selectedDistrict, selectedBudget, selectedArea, selectedGrade, keyword);
              }
            }}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-all"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => {
                setKeyword('');
                triggerFilter(selectedDistrict, selectedBudget, selectedArea, selectedGrade, '');
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
