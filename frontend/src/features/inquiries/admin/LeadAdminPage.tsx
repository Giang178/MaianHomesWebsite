'use client';
/* eslint-disable @next/next/no-img-element -- User-managed preview URLs require native image behavior. */

import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Layers,
  Building2,
  Building,
  FileCheck2,
  Inbox,
  Phone,
  ExternalLink,
  Download,
  Search,
  X,
  Eye,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Tag,
  ShieldCheck,
  Image as ImageIcon,
} from 'lucide-react';
import { noticeAdmin } from '@/components/admin/admin-dialog-service';
import { usePermissions } from '@/lib/use-permissions';
import { inquiriesAdminApi, downloadLeadExport, downloadLeadImagesZip, type WebsiteLead, type WebsiteLeadCounts } from './api';

type SourceGroup = 'ALL' | 'COWORKING' | 'OFFICE' | 'PROJECT' | 'CONSIGNMENT' | 'WEBSITE';

interface TabConfig {
  key: SourceGroup;
  label: string;
  icon: typeof Users;
  color: string;
}

const TABS: TabConfig[] = [
  { key: 'ALL', label: 'Tất cả khách hàng', icon: Users, color: 'text-stone-700' },
  { key: 'COWORKING', label: 'Khách Co-working', icon: Layers, color: 'text-amber-600' },
  { key: 'OFFICE', label: 'Khách Thuê Văn phòng', icon: Building2, color: 'text-blue-600' },
  { key: 'PROJECT', label: 'Khách Dự án BĐS', icon: Building, color: 'text-emerald-600' },
  { key: 'CONSIGNMENT', label: 'Khách Ký gửi BĐS', icon: FileCheck2, color: 'text-purple-600' },
  { key: 'WEBSITE', label: 'Liên hệ chung', icon: Inbox, color: 'text-rose-600' },
];

export default function WebsiteLeadsPage() {
  const { can } = usePermissions();
  const canUpdate = can('website.leads.update') || can('website.leads.archive');
  const canExport = can('website.leads.export');
  const [selectedGroup, setSelectedGroup] = useState<SourceGroup>('ALL');
  const [items, setItems] = useState<WebsiteLead[]>([]);
  const [counts, setCounts] = useState<WebsiteLeadCounts | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<WebsiteLead | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [downloadingLeadImages, setDownloadingLeadImages] = useState(false);

  // Fetch counts summary
  const fetchCounts = useCallback(async () => {
    try {
      const res = await inquiriesAdminApi.counts();
      setCounts(res);
    } catch {
      // ignore
    }
  }, []);

  // Load leads list
  const loadLeads = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setMessage('');

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (selectedGroup !== 'ALL') params.set('source', selectedGroup);
      if (status) params.set('status', status);
      if (search) params.set('search', search);

      const res = await inquiriesAdminApi.list(params.toString());
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể tải dữ liệu khách hàng.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, limit, selectedGroup, status, search]);

  useEffect(() => {
    void fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  // Handle group change
  const handleGroupChange = (group: SourceGroup) => {
    setSelectedGroup(group);
    setPage(1);
  };

  // Handle status update
  const updateStatus = async (lead: WebsiteLead, next: 'VIEWED' | 'ARCHIVED') => {
    if (!canUpdate) return;
    try {
      setUpdatingId(lead.id);
      setMessage('');
      await inquiriesAdminApi.status(lead.id, next, lead.version);
      await loadLeads();
      await fetchCounts();
      if (selectedLead?.id === lead.id) {
        setSelectedLead((prev) => (prev ? { ...prev, status: next, version: prev.version + 1 } : null));
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle export
  const handleExport = async (format: 'csv' | 'xlsx' | 'zip') => {
    if (!canExport) return;
    try {
      if (format === 'zip') setExportingZip(true);
      const filters: Record<string, string> = {};
      if (selectedGroup !== 'ALL') filters.source = selectedGroup;
      if (status) filters.status = status;
      if (search) filters.search = search;
      await downloadLeadExport(format, filters);
      await loadLeads();
      await fetchCounts();
    } catch (err) {
      noticeAdmin(err instanceof Error ? err.message : 'Không thể xuất dữ liệu.');
    } finally {
      if (format === 'zip') setExportingZip(false);
    }
  };

  // Handle single lead photos download
  const handleDownloadLeadImages = async (leadId: string) => {
    if (!canExport) return;
    try {
      setDownloadingLeadImages(true);
      await downloadLeadImagesZip(leadId);
    } catch (err) {
      noticeAdmin(err instanceof Error ? err.message : 'Không thể tải bộ ảnh của khách hàng này.');
    } finally {
      setDownloadingLeadImages(false);
    }
  };

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setPage(1);
  };

  // Copy phone number
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Format date helper
  const formatDateVN = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // Clean phone number for tel: or zalo.me
  const getCleanPhone = (phone: string) => phone.replace(/[^\d+]/g, '');

  // Safely extract clean customer message, preventing raw JSON strings from displaying
  const getCleanLeadMessage = (lead: WebsiteLead): string => {
    const msg = (lead.message || lead.note || '').trim();
    if (!msg) return '';
    if (msg.startsWith('{') && msg.endsWith('}')) {
      try {
        const parsed = JSON.parse(msg);
        const prop = parsed.property || {};
        return prop.notes || prop.description || parsed.notes || parsed.description || parsed.message || '';
      } catch {
        return '';
      }
    }
    return msg;
  };

  const totalPagesCount = Math.ceil(total / limit) || 1;

  return (
    <div className="admin-module-page admin-module-page--leads space-y-6 p-6 text-[#2D1B14] min-h-screen">
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-[#2D1B14]/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2D1B14] text-[#D4AF37]">
              <Users className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-[#2D1B14] lg:text-3xl">
              Khách hàng & Yêu cầu tư vấn
            </h1>
          </div>
          <p className="mt-1 text-sm text-[#2D1B14]/70">
            Kho dữ liệu tiếp nhận từ website: Co-working, Thuê văn phòng, Dự án, Ký gửi BĐS và Liên hệ trực tiếp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              void loadLeads(true);
              void fetchCounts();
            }}
            disabled={loading || refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-stone-500 ${refreshing ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          <button
            type="button"
            onClick={() => void handleExport('csv')}
            disabled={!canExport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5 text-stone-500" />
            Xuất CSV
          </button>

          <button
            type="button"
            onClick={() => void handleExport('xlsx')}
            disabled={!canExport}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D1B14] px-4 py-2 text-xs font-bold text-[#D4AF37] hover:bg-[#3D271D] transition-colors shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Xuất Excel (.xlsx)
          </button>

          <button
            type="button"
            onClick={() => void handleExport('zip')}
            disabled={!canExport || exportingZip}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs disabled:opacity-50 ${
              selectedGroup === 'CONSIGNMENT'
                ? 'bg-purple-700 hover:bg-purple-800 text-white ring-2 ring-purple-300'
                : 'border border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
            title="Xuất file Excel kèm thư mục hình ảnh phân loại theo từng khách hàng ký gửi"
          >
            <Download className={`h-3.5 w-3.5 ${exportingZip ? 'animate-bounce' : ''}`} />
            {exportingZip ? 'Đang nén dữ liệu & ảnh...' : 'Xuất kèm ảnh (.zip)'}
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span>Tổng yêu cầu tiếp nhận</span>
            <Users className="h-4 w-4 text-stone-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-[#2D1B14]">
            {counts?.total ?? total}
          </div>
          <p className="mt-1 text-xs text-stone-400">Từ toàn bộ biểu mẫu website</p>
        </div>

        {/* New */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-rose-700 uppercase tracking-wider">
            <span>Chờ tiếp nhận (Mới)</span>
            <span className="flex h-2 w-2 rounded-full bg-rose-600 animate-ping" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600">
            {counts?.by_status?.NEW ?? 0}
          </div>
          <p className="mt-1 text-xs text-rose-600/80">Khách hàng cần liên hệ phản hồi sớm</p>
        </div>

        {/* Viewed */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-700 uppercase tracking-wider">
            <span>Đã xem / Tiếp nhận</span>
            <Eye className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-black text-blue-700">
            {counts?.by_status?.VIEWED ?? 0}
          </div>
          <p className="mt-1 text-xs text-blue-600/80">Đã mở xem và trao đổi bước đầu</p>
        </div>

        {/* Exported / Archived */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 uppercase tracking-wider">
            <span>Đã xuất / Lưu trữ</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-[#2D1B14]">
            {(counts?.by_status?.EXPORTED ?? 0) + (counts?.by_status?.ARCHIVED ?? 0)}
          </div>
          <p className="mt-1 text-xs text-stone-400">Đã đồng bộ sang CRM hoặc lưu trữ</p>
        </div>
      </div>

      {/* 3. Segmented Group Tabs (TÁCH BIỆT TỪNG NHÓM) */}
      <div className="flex overflow-x-auto gap-2 border-b border-stone-200 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedGroup === tab.key;
          const count =
            tab.key === 'ALL'
              ? counts?.total ?? total
              : counts?.by_source?.[tab.key] ?? 0;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleGroupChange(tab.key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#2D1B14] text-[#D4AF37] shadow-sm'
                  : 'bg-white text-stone-600 hover:bg-stone-100 hover:text-[#2D1B14] border border-stone-200'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-[#D4AF37]' : tab.color}`} />
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  isActive ? 'bg-[#D4AF37] text-[#2D1B14]' : 'bg-stone-100 text-stone-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. Search and Filter Bar */}
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên khách hàng, số điện thoại, email hoặc nội dung..."
            className="w-full rounded-xl border border-stone-200 pl-10 pr-4 py-2 text-xs outline-none focus:border-[#2D1B14] transition-colors"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 outline-none focus:border-[#2D1B14]"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="NEW">Chờ tiếp nhận (NEW)</option>
          <option value="VIEWED">Đã xem (VIEWED)</option>
          <option value="EXPORTED">Đã xuất (EXPORTED)</option>
          <option value="ARCHIVED">Lưu trữ (ARCHIVED)</option>
        </select>

        <button
          type="submit"
          className="rounded-xl bg-[#2D1B14] px-4 py-2 text-xs font-bold text-white hover:bg-[#3D271D] transition-colors"
        >
          Tìm kiếm
        </button>

        {(search || status) && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            <X className="h-3.5 w-3.5" />
            Xóa lọc
          </button>
        )}
      </form>

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{message}</span>
        </div>
      )}

      {/* 5. Leads Table */}
      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="admin-table-responsive w-full text-left text-xs min-w-[960px]">
            <thead className="border-b border-stone-100 bg-stone-50/70 text-stone-500 font-bold uppercase text-[10px] xl:text-[11px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">Khách hàng & Liên hệ</th>
                <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">Phân nhóm & Nguồn</th>
                {selectedGroup === 'COWORKING' && <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">Gói dịch vụ & Số chỗ</th>}
                {selectedGroup === 'OFFICE' && <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">Doanh nghiệp & Tòa nhà</th>}
                {selectedGroup === 'PROJECT' && <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">Dự án quan tâm</th>}
                {selectedGroup === 'CONSIGNMENT' && <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">Loại BĐS & Giá kỳ vọng</th>}
                {(selectedGroup === 'ALL' || selectedGroup === 'WEBSITE') && <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">Nội dung nhu cầu</th>}
                <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">Thời gian</th>
                <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4">Trạng thái</th>
                <th className="py-2.5 px-3.5 xl:py-3.5 xl:px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-stone-300" />
                    Đang tải danh sách khách hàng...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400">
                    <Inbox className="h-8 w-8 mx-auto mb-2 text-stone-300" />
                    Không tìm thấy khách hàng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                items.map((lead) => {
                  const isUpdating = updatingId === lead.id;
                  const details = lead.structured_details || {};
                  const cleanPhone = getCleanPhone(lead.phone);

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="group cursor-pointer hover:bg-stone-50/80 transition-colors"
                    >
                      {/* 1. Customer Column */}
                      <td data-label="Khách hàng" className="p-4">
                        <div className="font-bold text-[#2D1B14] text-sm group-hover:text-red-700 transition-colors">
                          {lead.customer_name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-medium text-stone-700">{lead.phone}</span>
                          <a
                            href={`tel:${cleanPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Gọi điện trực tiếp"
                            className="flex h-5 w-5 items-center justify-center rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          >
                            <Phone className="h-3 w-3" />
                          </a>
                          <a
                            href={`https://zalo.me/${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Mở chat Zalo"
                            className="flex h-5 w-5 items-center justify-center rounded bg-blue-50 text-blue-600 hover:bg-blue-100 font-black text-[9px]"
                          >
                            Z
                          </a>
                        </div>
                        {lead.email && (
                          <div className="text-[11px] text-stone-400 mt-0.5 truncate max-w-[200px]" title={lead.email}>
                            {lead.email}
                          </div>
                        )}
                      </td>

                      {/* 2. Group & Form Column */}
                      <td data-label="Nguồn" className="p-4">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="inline-block rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                            {lead.source_label || lead.source}
                          </span>
                          {lead.form_id === 'maya-chat-lead' && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800">
                              🤖 Chatbot Mái Đỏ
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-medium text-stone-500 mt-1 truncate max-w-[180px]" title={lead.form_label}>
                          {lead.form_label || lead.form_id}
                        </div>
                      </td>

                      {/* 3. Contextual Data Column */}
                      {selectedGroup === 'COWORKING' && (
                        <td data-label="Chi tiết" className="p-4">
                          <div className="font-semibold text-stone-900">
                            {details['Gói thuê quan tâm'] || details['Hình thức chỗ ngồi'] || 'Chỗ ngồi linh hoạt'}
                          </div>
                          {details['Số lượng chỗ ngồi dự kiến'] && (
                            <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                              {details['Số lượng chỗ ngồi dự kiến']} chỗ
                            </div>
                          )}
                        </td>
                      )}

                      {selectedGroup === 'OFFICE' && (
                        <td data-label="Chi tiết" className="p-4">
                          <div className="font-semibold text-stone-900">
                            {details['Tên doanh nghiệp'] || 'Chưa cung cấp'}
                          </div>
                          <div className="text-[11px] text-blue-700 mt-0.5">
                            {details['Tòa nhà quan tâm'] || details['Diện tích / Mã sàn'] || 'Tư vấn sàn trống'}
                            {details['Ngân sách dự kiến'] && ` • ${details['Ngân sách dự kiến']}`}
                          </div>
                        </td>
                      )}

                      {selectedGroup === 'PROJECT' && (
                        <td data-label="Chi tiết" className="p-4">
                          <div className="font-semibold text-emerald-800">
                            {lead.project_name_snapshot || 'Tư vấn danh mục BĐS'}
                          </div>
                          {lead.message && (
                            <div className="text-[11px] text-stone-400 truncate max-w-[220px]">
                              {lead.message}
                            </div>
                          )}
                        </td>
                      )}

                      {selectedGroup === 'CONSIGNMENT' && (
                        <td data-label="Chi tiết" className="p-4">
                          <div className="font-semibold text-purple-900 flex items-center gap-1.5">
                            <span>{details['Loại bất động sản'] || 'BĐS Ký gửi'}</span>
                            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[9px] text-purple-800 font-bold">
                              {details['Hình thức giao dịch'] || 'Bán'}
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-600 mt-0.5">
                            Giá kỳ vọng:{' '}
                            <strong className="text-emerald-700 font-bold">
                              {details['Giá kỳ vọng'] || details['Giá bán kỳ vọng'] || details['Giá thuê kỳ vọng'] || 'Thỏa thuận'}
                            </strong>
                          </div>
                          {details['Địa chỉ BĐS'] && (
                            <div className="text-[11px] text-stone-500 truncate max-w-[240px] mt-0.5" title={details['Địa chỉ BĐS']}>
                              📍 {details['Địa chỉ BĐS']}
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            {lead.consignment_media_urls && lead.consignment_media_urls.length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-700 font-semibold border border-purple-200">
                                <ImageIcon className="h-3 w-3" />
                                {lead.consignment_media_urls.length} ảnh thực tế
                              </span>
                            ) : (
                              <span className="text-[10px] text-stone-400">
                                Chưa đính kèm ảnh
                              </span>
                            )}
                            {getCleanLeadMessage(lead) && (
                              <span className="text-[10px] text-stone-500 italic truncate max-w-[150px]">
                                &ldquo;{getCleanLeadMessage(lead)}&rdquo;
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {(selectedGroup === 'ALL' || selectedGroup === 'WEBSITE') && (
                        <td data-label="Nhu cầu" className="p-4 max-w-[280px]">
                          {lead.source === 'CONSIGNMENT' ? (
                            <div>
                              <div className="font-semibold text-purple-900 flex items-center gap-1.5">
                                <span>{details['Loại bất động sản'] || 'Ký gửi BĐS'}</span>
                                {(details['Giá kỳ vọng'] || details['Giá bán kỳ vọng']) && (
                                  <span className="text-emerald-700 font-bold text-[11px]">
                                    • {details['Giá kỳ vọng'] || details['Giá bán kỳ vọng']}
                                  </span>
                                )}
                              </div>
                              {details['Địa chỉ BĐS'] && (
                                <div className="text-[10px] text-stone-500 truncate mt-0.5">
                                  📍 {details['Địa chỉ BĐS']}
                                </div>
                              )}
                              {getCleanLeadMessage(lead) ? (
                                <div className="text-[10px] text-stone-600 line-clamp-1 italic mt-0.5">
                                  &ldquo;{getCleanLeadMessage(lead)}&rdquo;
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="line-clamp-2 text-stone-700 text-[11px]" title={getCleanLeadMessage(lead)}>
                              {getCleanLeadMessage(lead) || 'Không có ghi chú thêm'}
                            </div>
                          )}
                          {details['Địa chỉ BĐS'] && lead.source !== 'CONSIGNMENT' && (
                            <div className="text-[10px] text-purple-700 truncate mt-0.5">
                              📍 {details['Địa chỉ BĐS']}
                            </div>
                          )}
                        </td>
                      )}

                      {/* 4. Time Column */}
                      <td data-label="Thời gian" className="p-4 whitespace-nowrap text-stone-500 font-medium">
                        {formatDateVN(lead.submitted_at)}
                      </td>

                      {/* 5. Status Column */}
                      <td data-label="Trạng thái" className="p-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                          style={{
                            backgroundColor: `${lead.status_color || '#64748B'}18`,
                            color: lead.status_color || '#64748B',
                          }}
                        >
                          {lead.status_label || lead.status}
                        </span>
                      </td>

                      {/* 6. Actions Column */}
                      <td data-label="Thao tác" className="p-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedLead(lead)}
                            className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 hover:border-[#2D1B14] hover:text-[#2D1B14] transition-colors"
                          >
                            Chi tiết
                          </button>

                          {lead.status === 'NEW' && (
                            <button
                              type="button"
                              disabled={!canUpdate || isUpdating}
                              onClick={() => void updateStatus(lead, 'VIEWED')}
                              className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                            >
                              Đã xem
                            </button>
                          )}

                          {lead.status !== 'ARCHIVED' && (
                            <button
                              type="button"
                              disabled={!canUpdate || isUpdating}
                              onClick={() => void updateStatus(lead, 'ARCHIVED')}
                              className="rounded-lg border border-stone-200 px-2 py-1 text-xs font-medium text-stone-400 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors"
                              title="Lưu trữ yêu cầu"
                            >
                              Lưu trữ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-100 p-4 text-xs text-stone-500">
          <div>
            Hiển thị <strong>{total === 0 ? 0 : (page - 1) * limit + 1}</strong> -{' '}
            <strong>{Math.min(page * limit, total)}</strong> trong tổng số <strong>{total}</strong> khách hàng
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Hiển thị:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold"
              >
                <option value={10}>10 dòng</option>
                <option value={20}>20 dòng</option>
                <option value={50}>50 dòng</option>
              </select>
            </div>

            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-bold text-[#2D1B14]">
                Trang {page} / {totalPagesCount}
              </span>
              <button
                type="button"
                disabled={page >= totalPagesCount}
                onClick={() => setPage((p) => Math.min(totalPagesCount, p + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Lead Detail Slide-Over Drawer (CHI TIẾT 100% ĐẦY ĐỦ THÔNG TIN) */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
          <div
            className="w-full max-w-xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col border-l border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-stone-100 p-6 bg-stone-50/50 sticky top-0 z-10">
              <div>
                <span className="inline-block rounded-md bg-[#2D1B14] px-2.5 py-0.5 text-[10px] font-black text-[#D4AF37] uppercase tracking-wider">
                  {selectedLead.source_label || selectedLead.source}
                </span>
                <h2 className="mt-1.5 text-xl font-bold text-[#2D1B14]">
                  {selectedLead.customer_name}
                </h2>
                <div className="text-xs text-stone-500 mt-0.5">
                  Mã tham chiếu: <span className="font-mono text-stone-700">{selectedLead.id}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stone-200 transition-colors"
              >
                <X className="h-5 w-5 text-stone-500" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 p-6 space-y-6 text-xs">
              {/* Status and Action Ribbon */}
              <div className="flex items-center justify-between rounded-xl bg-stone-50 p-4 border border-stone-200">
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-bold">Trạng thái xử lý</span>
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold mt-1"
                    style={{
                      backgroundColor: `${selectedLead.status_color}20`,
                      color: selectedLead.status_color,
                    }}
                  >
                    {selectedLead.status_label || selectedLead.status}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedLead.status === 'NEW' && (
                    <button
                      type="button"
                      disabled={!canUpdate || updatingId === selectedLead.id}
                      onClick={() => void updateStatus(selectedLead, 'VIEWED')}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      Đánh dấu đã xem
                    </button>
                  )}
                  {selectedLead.status !== 'ARCHIVED' && (
                    <button
                      type="button"
                      disabled={!canUpdate || updatingId === selectedLead.id}
                      onClick={() => void updateStatus(selectedLead, 'ARCHIVED')}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-red-600 hover:border-red-200"
                    >
                      Lưu trữ
                    </button>
                  )}
                </div>
              </div>

              {/* Contact Information Box */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-[#D4AF37]" />
                  Thông tin liên hệ trực tiếp
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
                    <span className="text-[10px] text-stone-400 block">Số điện thoại</span>
                    <strong className="text-sm text-[#2D1B14] block mt-0.5">{selectedLead.phone}</strong>
                    <div className="mt-2 flex items-center gap-1.5">
                      <a
                        href={`tel:${getCleanPhone(selectedLead.phone)}`}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-700"
                      >
                        <Phone className="h-2.5 w-2.5" />
                        Gọi ngay
                      </a>
                      <a
                        href={`https://zalo.me/${getCleanPhone(selectedLead.phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-blue-700"
                      >
                        Chat Zalo
                      </a>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(selectedLead.phone)}
                        className="rounded border border-stone-200 p-1 text-stone-500 hover:bg-white"
                        title="Sao chép số điện thoại"
                      >
                        {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
                    <span className="text-[10px] text-stone-400 block">Địa chỉ Email</span>
                    <strong className="text-xs text-[#2D1B14] block mt-0.5 truncate" title={selectedLead.email || 'Chưa cung cấp'}>
                      {selectedLead.email || 'Chưa cung cấp'}
                    </strong>
                    {selectedLead.email && (
                      <a
                        href={`mailto:${selectedLead.email}`}
                        className="mt-2 inline-flex items-center gap-1 text-[10px] text-blue-600 font-semibold hover:underline"
                      >
                        Gửi Email →
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Structured Details (100% CÁC TRƯỜNG DỮ LIỆU ĐÃ ĐIỀN) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-[#D4AF37]" />
                  Thông tin chi tiết theo biểu mẫu ({selectedLead.form_label})
                </h3>

                {selectedLead.project_name_snapshot && (
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3">
                    <span className="text-[10px] text-emerald-800 font-bold uppercase">Dự án quan tâm</span>
                    <div className="text-sm font-bold text-emerald-950 mt-0.5">
                      {selectedLead.project_name_snapshot}
                    </div>
                  </div>
                )}

                {/* Consignment Profile Card (NẾU LÀ KHÁCH KÝ GỬI) */}
                {selectedLead.source === 'CONSIGNMENT' ? (
                  <div className="rounded-2xl border-2 border-purple-200 bg-purple-50/20 p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                      <span className="text-xs font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Building className="h-4 w-4 text-purple-700" />
                        Hồ sơ Bất động sản Ký gửi
                      </span>
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-800">
                        {selectedLead.structured_details?.['Hình thức giao dịch'] || 'Bán'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-stone-400 block font-medium">Loại bất động sản</span>
                        <strong className="text-purple-950 font-bold text-sm">
                          {selectedLead.structured_details?.['Loại bất động sản'] || 'Chưa phân loại'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block font-medium">Giá kỳ vọng</span>
                        <strong className="text-emerald-700 font-black text-sm">
                          {selectedLead.structured_details?.['Giá kỳ vọng'] ||
                            selectedLead.structured_details?.['Giá bán kỳ vọng'] ||
                            selectedLead.structured_details?.['Giá thuê kỳ vọng'] ||
                            'Thỏa thuận'}
                        </strong>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-stone-400 block font-medium">Địa chỉ tài sản</span>
                        <strong className="text-stone-800 font-semibold block">
                          📍 {selectedLead.structured_details?.['Địa chỉ BĐS'] || 'Chưa cung cấp'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block font-medium">Vai trò người gửi</span>
                        <strong className="text-stone-800 font-medium">
                          {selectedLead.structured_details?.['Vai trò người gửi'] || 'Chủ sở hữu'}
                        </strong>
                      </div>
                      {selectedLead.structured_details?.['Diện tích'] && (
                        <div>
                          <span className="text-[10px] text-stone-400 block font-medium">Diện tích</span>
                          <strong className="text-stone-800 font-medium">
                            {selectedLead.structured_details?.['Diện tích']}
                          </strong>
                        </div>
                      )}
                      {selectedLead.structured_details?.['Pháp lý'] && (
                        <div>
                          <span className="text-[10px] text-stone-400 block font-medium">Tình trạng pháp lý</span>
                          <strong className="text-stone-800 font-medium">
                            {selectedLead.structured_details?.['Pháp lý']}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Structured Key-Value Pairs for other lead types */}
                    {selectedLead.structured_details && Object.keys(selectedLead.structured_details).length > 0 && (
                      <div className="rounded-xl border border-stone-200 bg-white divide-y divide-stone-100">
                        {Object.entries(selectedLead.structured_details).map(([key, value]) => (
                          <div key={key} className="flex justify-between p-3 gap-4 text-xs">
                            <span className="text-stone-500 font-medium shrink-0 max-w-[40%]">{key}:</span>
                            <strong className="text-[#2D1B14] text-right font-bold break-words">{value}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Actual Customer Note / Remark */}
                <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                  <span className="text-[10px] text-stone-400 uppercase font-bold block mb-1.5">
                    Lời nhắn / Nhu cầu chi tiết từ khách hàng
                  </span>
                  <div className="text-stone-800 text-xs whitespace-pre-wrap leading-relaxed">
                    {getCleanLeadMessage(selectedLead) || (
                      <span className="text-stone-400 italic">Khách hàng không để lại ghi chú thêm.</span>
                    )}
                  </div>
                </div>

                {/* Consignment Property Images Album */}
                {selectedLead.source === 'CONSIGNMENT' && (
                  <div className="rounded-2xl border border-purple-200 bg-purple-50/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                        <ImageIcon className="h-4 w-4 text-purple-600" />
                        Hình ảnh bất động sản ký gửi
                      </span>
                      {selectedLead.consignment_media_urls && selectedLead.consignment_media_urls.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-purple-200/80 px-2 py-0.5 text-[10px] font-bold text-purple-900">
                            {selectedLead.consignment_media_urls.length} ảnh
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleDownloadLeadImages(selectedLead.id)}
                            disabled={!canExport || downloadingLeadImages}
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-700 hover:bg-purple-800 text-white px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50"
                            title="Tải toàn bộ hình ảnh căn hộ của khách này về máy dưới dạng file nén .zip"
                          >
                            <Download className="h-3 w-3" />
                            {downloadingLeadImages ? 'Đang nén...' : 'Tải trọn bộ ảnh (.zip)'}
                          </button>
                        </div>
                      )}
                    </div>

                    {selectedLead.consignment_media_urls && selectedLead.consignment_media_urls.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2.5">
                        {selectedLead.consignment_media_urls.map((url, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setPreviewImage(url);
                              setPreviewImageIndex(idx);
                            }}
                            className="group relative aspect-4/3 rounded-xl overflow-hidden border border-purple-200 bg-white cursor-pointer hover:shadow-md transition-all"
                          >
                            <img
                              src={url}
                              alt={`BĐS Ký gửi ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                              <Eye className="h-5 w-5 drop-shadow" />
                            </div>
                            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                              Ảnh {idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-stone-200 bg-white/60 p-4 text-center">
                        <ImageIcon className="h-6 w-6 text-stone-300 mx-auto mb-1.5" />
                        <p className="text-xs text-stone-500 font-medium">Khách hàng chưa đính kèm ảnh tài sản</p>
                        <p className="text-[10px] text-stone-400 mt-0.5">Biểu mẫu tiếp nhận không có tệp đính kèm hoặc khách gửi thông tin sơ bộ.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Marketing & Attribution Box */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]" />
                  Nguồn gốc chuyển đổi & Kỹ thuật
                </h3>
                <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3 space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Thời điểm gửi form:</span>
                    <strong className="text-stone-800">{formatDateVN(selectedLead.submitted_at)}</strong>
                  </div>
                  {selectedLead.page_url && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Trang gửi:</span>
                      <a
                        href={selectedLead.page_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline truncate max-w-[65%]"
                      >
                        {selectedLead.page_url}
                      </a>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-stone-500">Kênh tiếp thị (UTM Source):</span>
                    <strong className="text-stone-800">{selectedLead.utm_source || 'direct (tự nhiên)'}</strong>
                  </div>
                  {selectedLead.utm_campaign && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Chiến dịch (UTM Campaign):</span>
                      <strong className="text-stone-800">{selectedLead.utm_campaign}</strong>
                    </div>
                  )}
                  {selectedLead.referrer && (
                    <div className="flex justify-between">
                      <span className="text-stone-500">Nguồn giới thiệu:</span>
                      <span className="text-stone-700 truncate max-w-[60%]">{selectedLead.referrer}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-stone-100 bg-stone-50 flex items-center justify-between text-xs">
              <span className="text-stone-400">Phiên bản bản ghi: v{selectedLead.version}</span>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="rounded-xl bg-[#2D1B14] px-4 py-2 font-bold text-[#D4AF37]"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      {previewImage && selectedLead && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => {
            setPreviewImage(null);
            setPreviewImageIndex(null);
          }}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt="Phóng to ảnh"
              className="max-w-full max-h-[75vh] rounded-2xl object-contain shadow-2xl bg-stone-900"
            />

            {/* Lightbox Controls */}
            <div className="mt-3 flex items-center gap-4 text-white">
              {previewImageIndex !== null && selectedLead.consignment_media_urls && selectedLead.consignment_media_urls.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const totalUrls = selectedLead.consignment_media_urls!.length;
                      const prevIdx = (previewImageIndex - 1 + totalUrls) % totalUrls;
                      setPreviewImageIndex(prevIdx);
                      setPreviewImage(selectedLead.consignment_media_urls![prevIdx]);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/30 backdrop-blur-xs transition"
                  >
                    <ChevronLeft className="h-4 w-4" /> Ảnh trước
                  </button>
                  <span className="text-xs font-semibold text-stone-300">
                    Ảnh {previewImageIndex + 1} / {selectedLead.consignment_media_urls.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const totalUrls = selectedLead.consignment_media_urls!.length;
                      const nextIdx = (previewImageIndex + 1) % totalUrls;
                      setPreviewImageIndex(nextIdx);
                      setPreviewImage(selectedLead.consignment_media_urls![nextIdx]);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold hover:bg-white/30 backdrop-blur-xs transition"
                  >
                    Ảnh sau <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}

              <a
                href={previewImage}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 transition"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Mở ảnh gốc
              </a>
            </div>

            <button
              type="button"
              onClick={() => {
                setPreviewImage(null);
                setPreviewImageIndex(null);
              }}
              className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-900 shadow-xl hover:bg-stone-100 transition"
              title="Đóng xem ảnh"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
