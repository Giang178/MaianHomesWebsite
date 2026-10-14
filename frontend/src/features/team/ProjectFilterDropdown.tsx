'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Building2, ChevronDown, Check, Sparkles, Search, X } from 'lucide-react';

export interface ProjectOption {
  id: string;
  name: string;
  slug: string;
  count?: number;
}

interface ProjectFilterDropdownProps {
  projects: ProjectOption[];
  selectedProjectSlug: string;
  onSelectProject: (slug: string) => void;
  totalMembersCount?: number;
  className?: string;
}

// Chuẩn hóa chuỗi tiếng Việt không dấu để tìm kiếm nhanh
function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function ProjectFilterDropdown({
  projects,
  selectedProjectSlug,
  onSelectProject,
  className = '',
}: ProjectFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tìm dự án đang được chọn
  const selectedProject = useMemo(() => {
    if (!selectedProjectSlug) return null;
    return projects.find(
      (p) => p.slug === selectedProjectSlug || p.id === selectedProjectSlug
    );
  }, [projects, selectedProjectSlug]);

  // Lọc danh sách dự án theo ô tìm kiếm
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = removeVietnameseTones(searchQuery.trim());
    return projects.filter((p) =>
      removeVietnameseTones(p.name).includes(query)
    );
  }, [projects, searchQuery]);

  // Kiểm tra mục "Tất cả dự án" có phù hợp từ khóa không
  const matchAllOption = useMemo(() => {
    if (!searchQuery.trim()) return true;
    const query = removeVietnameseTones(searchQuery.trim());
    return removeVietnameseTones('tat ca du an').includes(query);
  }, [searchQuery]);

  // Tự động focus ô tìm kiếm khi mở Dropdown
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Đóng dropdown khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (slug: string) => {
    onSelectProject(slug);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`group flex w-full sm:w-[280px] items-center justify-between gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer shadow-xs ${
          selectedProject
            ? 'border-[#B88A29] bg-white text-[#15243b] ring-2 ring-[#B88A29]/15 shadow-sm'
            : 'border-slate-200 bg-white text-slate-800 hover:border-[#B88A29] hover:bg-slate-50/80'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 truncate text-left">
          {selectedProject ? (
            <Building2 className="size-4 shrink-0 text-[#B88A29]" />
          ) : (
            <Sparkles className="size-4 shrink-0 text-[#D4AF37]" />
          )}
          <span className="truncate font-medium">
            {selectedProject ? selectedProject.name : 'Tất cả dự án'}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {/* Nút Xóa nhanh lựa chọn */}
          {selectedProject && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  handleSelect('');
                }
              }}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              title="Xóa bộ lọc dự án"
              aria-label="Xóa bộ lọc dự án"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronDown
            className={`size-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#B88A29]' : 'group-hover:text-slate-600'
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-[320px] rounded-2xl border border-slate-200/90 bg-white p-2 shadow-[0_16px_40px_rgba(21,36,59,0.14)] z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Search Box inside Dropdown */}
          <div className="relative mb-2 px-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Tìm kiếm dự án..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-8 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#B88A29] focus:bg-white focus:ring-2 focus:ring-[#B88A29]/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* List Options */}
          <div className="max-h-64 overflow-y-auto pr-0.5 space-y-1 scrollbar-thin">
            {/* Mục: Tất cả dự án */}
            {matchAllOption && (
              <button
                type="button"
                role="option"
                aria-selected={!selectedProjectSlug}
                onClick={() => handleSelect('')}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-colors cursor-pointer text-left ${
                  !selectedProjectSlug
                    ? 'bg-[#15243b] text-white font-bold shadow-xs'
                    : 'text-slate-700 hover:bg-[#FAF8F5] hover:text-[#15243b] font-medium'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <Sparkles
                    className={`size-3.5 shrink-0 ${
                      !selectedProjectSlug ? 'text-[#D4AF37]' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">Tất cả dự án</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {!selectedProjectSlug && (
                    <Check className="size-3.5 text-[#D4AF37]" />
                  )}
                </div>
              </button>
            )}

            {matchAllOption && projects.length > 0 && (
              <div className="my-1 border-t border-slate-100" />
            )}

            {/* Danh sách từng dự án */}
            {filteredProjects.length === 0 && !matchAllOption ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                Không tìm thấy dự án phù hợp
              </div>
            ) : (
              filteredProjects.map((proj) => {
                const isSelected =
                  selectedProjectSlug === proj.slug ||
                  selectedProjectSlug === proj.id;
                return (
                  <button
                    key={proj.slug || proj.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(proj.slug)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-[#B88A29]/15 text-[#15243b] font-bold border border-[#B88A29]/30'
                        : 'text-slate-700 hover:bg-[#FAF8F5] hover:text-[#15243b] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate pr-2">
                      <Building2
                        className={`size-3.5 shrink-0 ${
                          isSelected ? 'text-[#B88A29]' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{proj.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && (
                        <Check className="size-3.5 text-[#B88A29]" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
