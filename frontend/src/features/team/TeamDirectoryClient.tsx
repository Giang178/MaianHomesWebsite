'use client';

import { useMemo, useState, useTransition } from 'react';
import { Search, X, RotateCcw, Users } from 'lucide-react';
import { TeamCard } from './TeamCard';
import { ProjectFilterDropdown, type ProjectOption } from './ProjectFilterDropdown';
import type { TeamMember } from './types';

// Helper chuẩn hóa tiếng Việt không dấu
function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function TeamDirectoryClient({
  members,
  initialProjectSlug = '',
}: {
  members: TeamMember[];
  initialProjectSlug?: string;
}) {
  const [selectedProject, setSelectedProject] = useState<string>(initialProjectSlug);
  const [searchMemberQuery, setSearchMemberQuery] = useState<string>('');
  const [, startTransition] = useTransition();

  // Extract unique projects from members
  const availableProjects = useMemo(() => {
    const projectMap = new Map<string, ProjectOption>();

    members.forEach((member) => {
      member.projects?.forEach((proj) => {
        if (!proj.slug && !proj.id) return;
        const key = proj.slug || proj.id;
        const existing = projectMap.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          projectMap.set(key, {
            id: proj.id || key,
            name: proj.name || 'Dự án',
            slug: proj.slug || key,
            count: 1,
          });
        }
      });
    });

    return Array.from(projectMap.values()).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi')
    );
  }, [members]);

  const handleProjectSelect = (slug: string) => {
    startTransition(() => {
      setSelectedProject(slug);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (slug) {
          url.searchParams.set('project', slug);
        } else {
          url.searchParams.delete('project');
          url.searchParams.delete('du_an');
        }
        window.history.replaceState({}, '', url.toString());
      }
    });
  };

  const handleResetFilters = () => {
    handleProjectSelect('');
    setSearchMemberQuery('');
  };

  // Filter members by project and search query
  const filteredMembers = useMemo(() => {
    return members
      .filter((member) => {
        // Filter by project
        const matchesProject = !selectedProject
          ? true
          : member.projects?.some(
              (p) => p.slug === selectedProject || p.id === selectedProject
            );

        // Filter by search query
        const matchesSearch = !searchMemberQuery.trim()
          ? true
          : (() => {
              const q = removeVietnameseTones(searchMemberQuery.trim());
              const nameMatch = removeVietnameseTones(member.full_name || '').includes(q);
              const posMatch = removeVietnameseTones(member.position || '').includes(q);
              const headlineMatch = removeVietnameseTones(member.headline || '').includes(q);
              const projectMatch = member.projects?.some((p) =>
                removeVietnameseTones(p.name || '').includes(q)
              );
              return nameMatch || posMatch || headlineMatch || projectMatch;
            })();

        return matchesProject && matchesSearch;
      })
      .sort((a, b) => {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return a.display_order - b.display_order;
      });
  }, [members, selectedProject, searchMemberQuery]);

  const isFiltering = !!selectedProject || !!searchMemberQuery.trim();

  return (
    <>
      {/* ── BỘ LỌC TỔNG HỢP: TÌM KIẾM & DROPDOWN DỰ ÁN ── */}
      <div className="mx-auto mt-4 sm:mt-6 w-full max-w-4xl px-4 sm:px-6">
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white/95 p-3 sm:p-4 shadow-sm backdrop-blur-md">
          {/* Hàng: Ô tìm kiếm + Dropdown dự án */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            {/* Ô tìm kiếm tên / chức vụ / dự án */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên chuyên gia, chức vụ..."
                value={searchMemberQuery}
                onChange={(e) => setSearchMemberQuery(e.target.value)}
                className="w-full rounded-xl sm:rounded-2xl border border-slate-200/90 bg-slate-50/70 py-2.5 pl-9 sm:pl-10 pr-9 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#B88A29] focus:bg-white focus:ring-2 focus:ring-[#B88A29]/15"
              />
              {searchMemberQuery && (
                <button
                  type="button"
                  onClick={() => setSearchMemberQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Project Filter Dropdown */}
            <ProjectFilterDropdown
              projects={availableProjects}
              selectedProjectSlug={selectedProject}
              onSelectProject={handleProjectSelect}
              totalMembersCount={members.length}
            />
          </div>
        </div>

        {/* Thanh trạng thái kết quả & Xóa bộ lọc khi đang tìm kiếm / lọc */}
        {isFiltering && (
          <div className="mt-3 flex items-center justify-between gap-2 px-1 text-xs font-medium text-slate-600">
            <div className="flex-1 min-w-0">
              <span className="truncate block">
                Tìm thấy <strong className="font-bold text-[#15243b]">{filteredMembers.length}</strong> chuyên gia
                {selectedProject && (
                  <> thuộc dự án <strong className="text-[#B88A29]">{availableProjects.find((p) => p.slug === selectedProject || p.id === selectedProject)?.name || selectedProject}</strong></>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 font-semibold text-[#B88A29] hover:text-[#15243b] transition-colors cursor-pointer text-[11px] sm:text-xs"
              >
                <RotateCcw className="size-3" />
                <span className="hidden sm:inline">Xóa bộ lọc</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DANH SÁCH CHUYÊN GIA: LƯỚI ── */}
      <section className="mx-auto mt-6 sm:mt-8 max-w-7xl px-3.5 sm:px-6 lg:px-8" aria-label="Danh sách chuyên gia">
        {filteredMembers.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-5 lg:gap-6">
            {filteredMembers.map((member) => (
              <TeamCard key={member.slug} member={member} variant="vertical" />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-14 sm:py-16 text-center shadow-xs max-w-xl mx-auto">
            <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Users className="size-6" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#15243b]">Chưa tìm thấy chuyên gia phù hợp</h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600">Hãy thử đổi dự án, nhóm vai trò hoặc tìm kiếm với từ khóa khác.</p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-5 inline-flex min-h-10 items-center rounded-full bg-[#B88A29] px-6 text-xs sm:text-sm font-bold text-white hover:bg-[#15243b] transition-colors cursor-pointer shadow-sm"
            >
              Xem tất cả đội ngũ ({members.length})
            </button>
          </div>
        )}
      </section>
    </>
  );
}
