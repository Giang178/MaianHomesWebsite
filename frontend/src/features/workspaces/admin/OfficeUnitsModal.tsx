'use client';

import React, { useState, useEffect } from 'react';
import { OfficeBuilding, OfficeUnit } from '../types';
import { workspaceApi } from '../api';
import { adminConfirm } from '@/components/admin/admin-dialog-service';
import { X, Plus, Trash2, Edit2, Layers, RefreshCw } from 'lucide-react';

interface OfficeUnitsModalProps {
  building: OfficeBuilding | null;
  isOpen: boolean;
  onClose: () => void;
}

export function OfficeUnitsModal({ building, isOpen, onClose }: OfficeUnitsModalProps) {
  const [units, setUnits] = useState<OfficeUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Partial<OfficeUnit> | null>(null);
  const [savingUnit, setSavingUnit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadUnits = async () => {
    if (!building?.id) return;
    setLoading(true);
    try {
      const data = await workspaceApi.getAdminUnits(building.id);
      setUnits(data || []);
    } catch (err) {
      // Failed to load units
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && building) {
      loadUnits();
      setEditingUnit(null);
    }
  }, [isOpen, building]);

  if (!isOpen || !building) return null;

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit || !building.id) return;
    setErrorMessage(null);
    setSavingUnit(true);
    try {
      if (editingUnit.id) {
        await workspaceApi.updateAdminUnit(editingUnit.id, editingUnit);
      } else {
        await workspaceApi.createAdminUnit({
          ...editingUnit,
          building_id: building.id,
        });
      }
      setEditingUnit(null);
      await loadUnits();
    } catch (err) {
      setErrorMessage('Lỗi lưu sàn: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!await adminConfirm('Xóa vĩnh viễn mặt bằng này? Thao tác không thể hoàn tác.')) return;
    setErrorMessage(null);
    try {
      await workspaceApi.deleteAdminUnit(unitId);
      await loadUnits();
    } catch (err) {
      setErrorMessage('Lỗi xóa sàn: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const statusColors: Record<string, string> = {
    AVAILABLE: 'bg-emerald-100 text-emerald-800',
    UPCOMING: 'bg-blue-100 text-blue-800',
    NEGOTIATING: 'bg-amber-100 text-amber-800',
    RENTED: 'bg-zinc-200 text-zinc-700',
    SUSPENDED: 'bg-red-100 text-red-800',
    PENDING: 'bg-violet-100 text-violet-800',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#D4AF37]" />
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Quản lý sàn văn phòng: {building.name}
              </h3>
              <p className="text-xs text-zinc-500">
                Tổng cộng {units.length} mặt bằng được tạo ({units.filter(u => (u.status as string) === 'AVAILABLE' || u.availability_status === 'AVAILABLE').length} sàn đang trống)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
          {/* Add / Edit Form */}
          {editingUnit ? (
            <form onSubmit={handleSaveUnit} className="bg-zinc-50 p-4 rounded-xl border border-zinc-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                  {editingUnit.id ? `Chỉnh sửa mã sàn ${editingUnit.unit_code}` : 'Thêm diện tích trống mới'}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  Hủy
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Mã mặt bằng (Mã sàn) *</label>
                  <input
                    type="text"
                    required
                    value={editingUnit.unit_code || ''}
                    placeholder="VD: L08-01, MTC-L04-A..."
                    onChange={(e) => setEditingUnit({ ...editingUnit, unit_code: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Tầng *</label>
                  <input
                    type="text"
                    required
                    value={editingUnit.floor || ''}
                    placeholder="VD: Tầng 8"
                    onChange={(e) => setEditingUnit({ ...editingUnit, floor: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Diện tích (m²) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={editingUnit.area ?? editingUnit.area_sqm ?? 0}
                    onChange={(e) => setEditingUnit({ ...editingUnit, area: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Giá thuê ($/m²/tháng)</label>
                  <input
                    type="number"
                    value={editingUnit.rental_price ?? editingUnit.price_per_sqm ?? 0}
                    onChange={(e) => setEditingUnit({ ...editingUnit, rental_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Tình trạng cho thuê</label>
                  <select
                    value={editingUnit.availability_status || 'AVAILABLE'}
                    onChange={(e) => setEditingUnit({ ...editingUnit, availability_status: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs"
                  >
                    <option value="AVAILABLE">AVAILABLE (Đang trống)</option>
                    <option value="UPCOMING">UPCOMING (Sắp trống)</option>
                    <option value="NEGOTIATING">NEGOTIATING (Đang thương lượng)</option>
                    <option value="RENTED">RENTED (Đã thuê)</option>
                    <option value="SUSPENDED">SUSPENDED (Tạm ngưng)</option>
                    <option value="PENDING">PENDING (Chờ xác nhận)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Hiển thị trên website</label>
                  <select
                    value={editingUnit.status === 'HIDDEN' ? 'HIDDEN' : 'ACTIVE'}
                    onChange={(e) => setEditingUnit({ ...editingUnit, status: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs"
                  >
                    <option value="ACTIVE">ACTIVE (Hiển thị)</option>
                    <option value="HIDDEN">HIDDEN (Ẩn)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Hiện trạng bàn giao</label>
                  <input
                    type="text"
                    value={editingUnit.handover_condition || ''}
                    onChange={(e) => setEditingUnit({ ...editingUnit, handover_condition: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-600 mb-1">Thời gian bàn giao</label>
                  <input
                    type="text"
                    value={editingUnit.available_from || ''}
                    onChange={(e) => setEditingUnit({ ...editingUnit, available_from: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-zinc-300 rounded-lg text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={savingUnit}
                    className="w-full py-2 bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-semibold rounded-lg shadow"
                  >
                    {savingUnit ? 'Đang lưu...' : 'Lưu mặt bằng'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={() =>
                  setEditingUnit({
                    unit_code: '',
                    floor: '',
                    area: undefined,
                    rental_price: building.price_per_sqm_min as number | undefined,
                    availability_status: 'AVAILABLE',
                    status: 'ACTIVE',
                    handover_condition: '',
                    available_from: '',
                    display_order: units.length + 1,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#C5A028] text-white text-xs font-semibold shadow transition-colors"
              >
                <Plus className="w-4 h-4" /> Thêm sàn mới
              </button>
            </div>
          )}

          {/* Units Table */}
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D4AF37]" />
              Đang tải danh sách sàn...
            </div>
          ) : units.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-zinc-200">
              <table className="w-full text-left text-xs text-zinc-700">
                <thead className="bg-zinc-50 border-b border-zinc-200 font-semibold text-zinc-900 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Mã mặt bằng</th>
                    <th className="py-2.5 px-3">Vị trí tầng</th>
                    <th className="py-2.5 px-3">Diện tích</th>
                    <th className="py-2.5 px-3">Đơn giá ($/m²)</th>
                    <th className="py-2.5 px-3">Hiện trạng</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                    <th className="py-2.5 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {units.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-50/80">
                      <td className="py-2.5 px-3 font-semibold text-zinc-900 font-mono">
                        <span className="px-1.5 py-0.5 bg-zinc-100 rounded border border-zinc-200 text-xs">
                          {u.unit_code || (u as any).code || 'Chưa đặt mã'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">{u.floor}</td>
                      <td className="py-2.5 px-3 font-medium text-zinc-900">{u.area_sqm ?? u.area ?? 0} m²</td>
                      <td className="py-2.5 px-3 text-[#D4AF37] font-semibold">${u.price_per_sqm ?? u.rental_price ?? 0}</td>
                      <td className="py-2.5 px-3">{u.handover_condition || '—'}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusColors[u.availability_status as string] || statusColors[u.status as string] || 'bg-zinc-100 text-zinc-700'}`}>
                            {u.availability_status || u.status || 'AVAILABLE'}
                          </span>
                          {u.status === 'HIDDEN' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-200 text-zinc-700 font-medium">
                              Ẩn
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-2">
                        <button
                          onClick={() => setEditingUnit(u)}
                          className="p-1 text-zinc-500 hover:text-zinc-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => u.id && handleDeleteUnit(u.id)}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-200 rounded-xl">
              Chưa có sàn văn phòng nào trong tòa nhà này. Hãy nhấn &quot;Thêm sàn mới&quot; để tạo mặt bằng đầu tiên.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
