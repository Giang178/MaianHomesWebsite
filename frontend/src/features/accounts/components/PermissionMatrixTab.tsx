'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  PERMISSION_GROUPS,
  permissionLabel,
} from '../constants';

interface PermissionMatrixTabProps {
  presets: Record<'ADMIN' | 'MARKETING', string[]>;
  dependencies: Record<string, string[]>;
}

export default function PermissionMatrixTab({
  presets,
  dependencies,
}: PermissionMatrixTabProps) {
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixActiveGroup, setMatrixActiveGroup] = useState<string>('all');

  const matrixGroups = useMemo(() => {
    const q = matrixSearch.trim().toLowerCase();
    return PERMISSION_GROUPS.filter(
      (g) => matrixActiveGroup === 'all' || g.key === matrixActiveGroup
    )
      .map((g) => {
        const filteredValues = g.values.filter((p) => {
          if (!q) return true;
          return (
            p.toLowerCase().includes(q) || permissionLabel(p).toLowerCase().includes(q)
          );
        });
        return { ...g, values: filteredValues };
      })
      .filter((g) => g.values.length > 0);
  }, [matrixSearch, matrixActiveGroup]);

  return (
    <div className="space-y-3.5">
      {/* Top Filter Bar for Matrix */}
      <div className="bg-white rounded-xl border border-[#E8E0D8] p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            value={matrixSearch}
            onChange={(e) => setMatrixSearch(e.target.value)}
            placeholder="Tìm kiếm thao tác quyền hạn..."
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50/60 py-1.5 pl-8 pr-3 text-xs text-[#2D1B14] outline-none focus:border-[#D4AF37] focus:bg-white font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setMatrixActiveGroup('all')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              matrixActiveGroup === 'all'
                ? 'bg-[#2D1B14] text-white shadow-2xs font-bold'
                : 'bg-zinc-100 text-gray-600 hover:bg-zinc-200'
            }`}
          >
            Tất cả nhóm
          </button>
          {PERMISSION_GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setMatrixActiveGroup(g.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                matrixActiveGroup === g.key
                  ? 'bg-[#D4AF37] text-white shadow-2xs font-bold'
                  : 'bg-zinc-100 text-gray-600 hover:bg-zinc-200'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Matrix Tables Grouped */}
      <div className="space-y-3.5">
        {matrixGroups.map((group) => (
          <div
            key={group.key}
            className="bg-white rounded-xl border border-[#E8E0D8] shadow-2xs overflow-hidden"
          >
            <div className="bg-zinc-50/90 px-4 py-2.5 border-b border-[#E8E0D8] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                <h3 className="font-bold text-xs text-[#2D1B14]">{group.label}</h3>
                <span className="text-[11px] text-gray-400 hidden sm:inline">
                  · {group.description}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-200/70 text-zinc-700">
                {group.values.length} quyền
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[540px]">
                <thead className="border-b border-[#E8E0D8] bg-zinc-50/40 text-[10px] font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="py-2.5 px-4">Mô tả nghiệp vụ</th>
                    <th className="py-2.5 px-2 text-center w-20">CEO</th>
                    <th className="py-2.5 px-2 text-center w-20">ADMIN</th>
                    <th className="py-2.5 px-2 text-center w-24">MARKETING</th>
                    <th className="py-2.5 px-3">Phụ thuộc</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E0D8]/60">
                  {group.values.map((permission) => {
                    const adminAllowed = presets.ADMIN?.includes(permission);
                    const mktAllowed = presets.MARKETING?.includes(permission);
                    const deps = dependencies[permission] || [];

                    return (
                      <tr key={permission} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-[#2D1B14]">
                          <span className="block font-semibold">{permissionLabel(permission)}</span>
                          <span className="block font-mono text-[10px] text-gray-400 mt-0.5">
                            {permission}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200">
                            ✓
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {adminAllowed ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-[#F3E6C6] font-bold text-[10px]">
                              ✓
                            </span>
                          ) : (
                            <span className="text-gray-300 font-bold">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {mktAllowed ? (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                              ✓
                            </span>
                          ) : (
                            <span className="text-gray-300 font-bold">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-gray-500">
                          {deps.length > 0 ? (
                            <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                              Yêu cầu: {deps.map((d) => d.split('.').at(-1)).join(', ')}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-[10px]">Độc lập</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
