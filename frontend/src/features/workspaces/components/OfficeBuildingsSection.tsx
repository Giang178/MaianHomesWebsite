'use client';

import { useState, useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { OfficeBuilding } from '../types';
import OfficeFilterBar from './OfficeFilterBar';
import OfficeBuildingCard from './OfficeBuildingCard';

interface OfficeBuildingsSectionProps {
  buildings: OfficeBuilding[];
  districts?: string[];
}

type SortOption = 'default' | 'price_asc' | 'price_desc' | 'area_desc';

export default function OfficeBuildingsSection({ buildings, districts = [] }: OfficeBuildingsSectionProps) {
  const [sortBy, setSortBy] = useState<SortOption>('default');

  const sortedBuildings = useMemo(() => {
    const list = [...buildings];
    switch (sortBy) {
      case 'price_asc':
        return list.sort(
          (a, b) =>
            (a.price_per_sqm_min || a.min_price || 0) -
            (b.price_per_sqm_min || b.min_price || 0)
        );
      case 'price_desc':
        return list.sort(
          (a, b) =>
            (b.price_per_sqm_min || b.min_price || 0) -
            (a.price_per_sqm_min || a.min_price || 0)
        );
      case 'area_desc':
        return list.sort((a, b) => (b.max_area || 0) - (a.max_area || 0));
      default:
        return list;
    }
  }, [buildings, sortBy]);

  return (
    <section id="danh-sach-toa-nha" className="py-8 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24 space-y-6 sm:space-y-8">
      {/* 1. Filter Bar + Section Header & Exploration Tabs (Image 1 style) */}
      <OfficeFilterBar
        totalCount={sortedBuildings.length}
        districts={districts}
        sortBy={sortBy}
        onSortChange={(val) => setSortBy(val as SortOption)}
      />

      {/* 2. Grid 3 Columns of Building Cards (Image 1 style) */}
      {sortedBuildings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {sortedBuildings.map((building) => (
            <OfficeBuildingCard
              key={building.id || building._id || building.slug}
              building={building}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 text-center bg-zinc-50 border border-zinc-200 rounded-2xl p-8 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-full bg-zinc-200/70 text-zinc-500 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-serif text-zinc-900 font-medium mb-1.5">
            Không tìm thấy tòa nhà phù hợp
          </h3>
          <p className="text-zinc-500 text-xs sm:text-sm max-w-md mx-auto mb-5 font-light">
            Vui lòng thử điều chỉnh lại bộ lọc tìm kiếm (khoảng diện tích, ngân sách hoặc khu vực) để xem thêm kết quả.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white font-semibold text-xs tracking-wider transition-colors shadow-sm"
          >
            Đặt lại tất cả bộ lọc
          </button>
        </div>
      )}
    </section>
  );
}
