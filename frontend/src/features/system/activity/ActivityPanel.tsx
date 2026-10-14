'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { noticeAdmin } from '@/components/admin/admin-dialog-service';
import {
  ChevronRight, Clipboard, Download, Eye, Filter, RefreshCw, Search,
  ShieldAlert, Trash2, X, Database
} from 'lucide-react';

import { errorMessage, formatDate } from '../shared/formatters';
import { adminLabel } from '@/lib/admin-labels';
import { StatusBadge } from '../shared/StatusBadge';
import { fieldClass, primaryButtonClass, secondaryButtonClass } from '../shared/styles';
import { activityApi } from './api';
import type { ActivityEvent, ActivityFilters, ActivityMetadata, PurgePreview } from './types';

const EMPTY_FILTERS: ActivityFilters = {
  q: '', module: '', category: '', event_type: '', result: '', severity: '', target_type: '',
  target_id: '', ip_address: '', request_id: '', session_id: '', start: '', end: '',
};

const EMPTY_METADATA: ActivityMetadata = {
  modules: [], categories: [], results: [], severities: [], event_types: [],
};

const filterKeys = Object.keys(EMPTY_FILTERS) as Array<keyof ActivityFilters>;
const filterNames: Partial<Record<keyof ActivityFilters, string>> = {
  q: 'Tìm kiếm', module: 'Phân hệ', event_type: 'Hành động', result: 'Kết quả',
  category: 'Danh mục', severity: 'Mức độ', target_type: 'Loại đối tượng', target_id: 'ID đối tượng',
  ip_address: 'Địa chỉ IP', request_id: 'Request ID', session_id: 'Session ID', start: 'Từ ngày', end: 'Đến ngày',
};

function initialFilters(): ActivityFilters {
  if (typeof window === 'undefined') return EMPTY_FILTERS;
  const params = new URLSearchParams(window.location.search);
  return filterKeys.reduce((result, key) => ({ ...result, [key]: params.get(key) || '' }), { ...EMPTY_FILTERS });
}

function bangkokInput(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

function toUtc(value: string) {
  return value ? new Date(`${value}:00+07:00`).toISOString() : '';
}

function requestFilters(filters: ActivityFilters) {
  return { ...filters, start: toUtc(filters.start), end: toUtc(filters.end) };
}

function label(options: Array<{ value: string; label: string }>, value?: string) {
  return options.find(option => option.value === value)?.label || adminLabel(value, 'event');
}

const roleNames: Record<string, string> = {
  CEO: 'Tổng Giám đốc', ADMIN: 'Quản trị viên', MARKETING: 'Marketing',
  PUBLIC: 'Kênh công khai',
};

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-2xl bg-[#1E120D] p-4 text-xs font-mono leading-5 text-[#E5E2D9] border border-[#C5A059]/20 shadow-inner">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function ActivityPanel() {
  const [filters, setFilters] = useState<ActivityFilters>(initialFilters);
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [metadata, setMetadata] = useState<ActivityMetadata>(EMPTY_METADATA);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [customRange, setCustomRange] = useState(() => Boolean(initialFilters().start || initialFilters().end));
  const [selected, setSelected] = useState<ActivityEvent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgePreview, setPurgePreview] = useState<PurgePreview | null>(null);
  const [purgeReason, setPurgeReason] = useState('');
  const [purgeConfirmation, setPurgeConfirmation] = useState('');
  const [purging, setPurging] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const pageController = useRef<AbortController | null>(null);

  const activeFilterCount = useMemo(
    () => filterKeys.filter(key => Boolean(filters[key])).length,
    [filters],
  );

  const updateFilter = (key: keyof ActivityFilters, value: string) => {
    setFilters(current => ({ ...current, [key]: value }));
  };

  const getFilterDisplayValue = (key: keyof ActivityFilters, value: string) => {
    if (!value) return '';
    switch (key) {
      case 'module': return label(metadata.modules, value);
      case 'event_type': return label(metadata.event_types, value);
      case 'result': return label(metadata.results, value);
      case 'category': return label(metadata.categories, value);
      case 'severity': return label(metadata.severities, value);
      case 'start':
      case 'end':
        return value.replace('T', ' ');
      default:
        return value;
    }
  };

  useEffect(() => {
    activityApi.metadata().then(setMetadata).catch(cause => setError(errorMessage(cause)));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    filterKeys.forEach(key => filters[key] ? url.searchParams.set(key, String(filters[key])) : url.searchParams.delete(key));
    window.history.replaceState(null, '', url);
  }, [filters]);

  const loadFirstPage = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const page = await activityApi.list({ ...requestFilters(filters), limit: 50 }, signal);
      setItems(page.items);
      setNextCursor(page.next_cursor || null);
      setError('');
    } catch (cause) {
      const isAbort =
        (typeof DOMException !== 'undefined' && cause instanceof DOMException && cause.name === 'AbortError') ||
        (cause instanceof Error && cause.name === 'AbortError') ||
        (typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError');
      if (!isAbort) setError(errorMessage(cause));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    pageController.current?.abort();
    const controller = new AbortController();
    pageController.current = controller;
    const timer = window.setTimeout(() => void loadFirstPage(controller.signal), 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadFirstPage]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await activityApi.list({ ...requestFilters(filters), limit: 50, cursor: nextCursor });
      setItems(current => {
        const ids = new Set(current.map(item => item.id));
        return [...current, ...page.items.filter(item => !ids.has(item.id))];
      });
      setNextCursor(page.next_cursor || null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoadingMore(false);
    }
  };

  const openDetail = async (event: ActivityEvent) => {
    setSelected(event);
    setDetailLoading(true);
    try {
      setSelected(await activityApi.detail(event.id));
      window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setDetailLoading(false);
    }
  };

  const quickRange = (range: 'today' | '7d' | '30d' | 'all' | 'custom') => {
    setCustomRange(range === 'custom');
    if (range === 'all') {
      setFilters(current => ({ ...current, start: '', end: '' }));
      return;
    }
    if (range === 'custom') return;
    const now = new Date();
    const end = bangkokInput(now);
    if (range === 'today') {
      setFilters(current => ({ ...current, start: `${end.slice(0, 10)}T00:00`, end }));
      return;
    }
    const days = range === '7d' ? 7 : 30;
    setFilters(current => ({ ...current, start: bangkokInput(new Date(now.getTime() - days * 86_400_000)), end }));
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await activityApi.exportCsv(requestFilters(filters));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `activity-events-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setExporting(false);
    }
  };

  const openPurge = async () => {
    setPurgeOpen(true);
    setPurgePreview(null);
    setPurgeReason('');
    setPurgeConfirmation('');
    try {
      setPurgePreview(await activityApi.purgePreview());
    } catch (cause) {
      setError(errorMessage(cause));
      setPurgeOpen(false);
    }
  };

  const purge = async () => {
    if (!purgePreview) return;
    setPurging(true);
    try {
      const result = await activityApi.purge({
        preview_token: purgePreview.preview_token,
        reason: purgeReason,
        confirmation: purgeConfirmation,
      });
      setPurgeOpen(false);
      setError('');
      await loadFirstPage();
      window.setTimeout(() => setError(result.message), 0);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPurging(false);
    }
  };

  const copy = (value?: string) => {
    if (!value) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(value).catch(() => noticeAdmin('Không thể hoàn tất thao tác. Vui lòng thử lại.'));
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch {
        noticeAdmin('Không thể hoàn tất thao tác. Vui lòng thử lại.');
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="admin-module-page admin-module-page--activity space-y-6">
      {/* Search & Multi-layer Filter Panel */}
      <section className="rounded-3xl border border-[#E5E2D9] bg-white p-5 shadow-2xs space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              className={`${fieldClass} pl-10`}
              aria-label="Tìm kiếm nhật ký"
              placeholder="Tìm theo tên người thao tác hoặc tên đối tượng..."
              value={filters.q}
              onChange={event => updateFilter('q', event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className={secondaryButtonClass}
              onClick={() => void loadFirstPage()}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            <button
              className={primaryButtonClass}
              onClick={() => void exportCsv()}
              disabled={exporting}
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? 'Đang xuất…' : 'Xuất CSV'}
            </button>
          </div>
        </div>

        {/* Primary Filter Row */}
        <div className="grid gap-3 md:grid-cols-3 pt-3 border-t border-[#E5E2D9]/70">
          <Select label="Phân hệ" value={filters.module} options={metadata.modules} onChange={value => updateFilter('module', value)} />
          <Select label="Hành động" value={filters.event_type} options={metadata.event_types} onChange={value => updateFilter('event_type', value)} />
          <Select label="Kết quả" value={filters.result} options={metadata.results} onChange={value => updateFilter('result', value)} />
        </div>

        {/* Time Presets & Advanced Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['today', '7d', '30d', 'custom'] as const).map(range => (
              <button
                key={range}
                onClick={() => quickRange(range)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  (range === 'custom' && customRange) || (range === 'today' && filters.start.includes(new Date().toISOString().slice(0, 10)))
                    ? 'bg-[#2D1B14] text-[#D4AF37] shadow-2xs font-bold'
                    : 'bg-[#FAF9F6] text-slate-700 hover:bg-slate-100 border border-[#E5E2D9]'
                }`}
              >
                {range === 'today' ? 'Hôm nay' : range === '7d' ? '7 ngày' : range === '30d' ? '30 ngày' : 'Tùy chọn'}
              </button>
            ))}
          </div>

          <button
            className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 ${
              advanced ? 'bg-[#2D1B14] text-[#D4AF37] border-[#C5A059]' : 'bg-[#FAF9F6] border-[#E5E2D9] text-[#4A3B32] hover:bg-white'
            }`}
            onClick={() => setAdvanced(value => !value)}
          >
            <Filter className="h-3.5 w-3.5" />
            Tra cứu kỹ thuật
          </button>
        </div>

        {customRange && (
          <div className="grid gap-3 md:grid-cols-2 pt-3 border-t border-[#E5E2D9]/70">
            <Field label="Từ ngày" type="datetime-local" value={filters.start} onChange={value => updateFilter('start', value)} />
            <Field label="Đến ngày" type="datetime-local" value={filters.end} onChange={value => updateFilter('end', value)} />
          </div>
        )}

        {/* Advanced Technical Filters */}
        {advanced && (
          <div className="grid gap-3 border-t border-[#E5E2D9]/70 pt-4 md:grid-cols-2 xl:grid-cols-4 bg-[#FAF9F6]/50 p-4 rounded-2xl">
            <Select label="Danh mục" value={filters.category} options={metadata.categories} onChange={value => updateFilter('category', value)} />
            <Select label="Mức độ" value={filters.severity} options={metadata.severities} onChange={value => updateFilter('severity', value)} />
            <Field label="Loại đối tượng" value={filters.target_type} onChange={value => updateFilter('target_type', value)} />
            <Field label="ID đối tượng" value={filters.target_id} onChange={value => updateFilter('target_id', value)} />
            <Field label="Địa chỉ IP" value={filters.ip_address} onChange={value => updateFilter('ip_address', value)} />
            <Field label="Request ID" value={filters.request_id} onChange={value => updateFilter('request_id', value)} />
            <Field label="Session ID" value={filters.session_id} onChange={value => updateFilter('session_id', value)} />
          </div>
        )}

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-[#E5E2D9]/70 pt-3">
            <span className="text-[11px] font-bold text-[#8A7A6E] mr-1">Đang lọc:</span>
            {filterKeys.filter(key => filters[key]).map(key => (
              <button
                key={key}
                onClick={() => updateFilter(key, '')}
                className="inline-flex items-center gap-1 rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-100"
              >
                <span>{filterNames[key] || key}: {getFilterDisplayValue(key, String(filters[key]))}</span>
                <X className="h-3 w-3 text-amber-700" />
              </button>
            ))}
            <button
              className="rounded-xl border border-[#E5E2D9] bg-white px-2.5 py-1 text-xs font-bold text-gray-600 hover:bg-slate-50 ml-auto"
              onClick={() => { setFilters(EMPTY_FILTERS); setCustomRange(false); }}
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className={`rounded-2xl p-4 text-xs font-bold border ${
            error.startsWith('Đã xóa')
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {error}
        </div>
      )}

      {/* Main Audit Trail Table */}
      <section className="overflow-hidden rounded-3xl border border-[#E5E2D9] bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-[#FAF9F6] border-b border-[#E5E2D9] uppercase font-bold text-[#6B5E55]">
              <tr>
                <th className="px-4 py-3.5">Thời gian</th>
                <th className="px-4 py-3.5">Người thao tác</th>
                <th className="px-4 py-3.5">Hành động</th>
                <th className="px-4 py-3.5 text-center">Phân hệ</th>
                <th className="px-4 py-3.5">Tên đối tượng</th>
                <th className="px-4 py-3.5">Kết quả</th>
                <th className="px-4 py-3.5 text-right"><span className="sr-only">Chi tiết</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDE5]">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-[#FAF9F6]/80 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500 font-mono">
                    {formatDate(item.occurred_at || item.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <strong className="text-[#2D1B14] block">
                      {item.actor?.name || item.actor_name || item.actor?.email || item.actor_email || 'Hệ thống'}
                    </strong>
                    <span className="block text-[11px] text-gray-400">
                      {roleNames[item.actor?.role || item.actor_role || ''] || adminLabel(item.actor?.role || item.actor_role || item.actor?.type, 'role')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#2D1B14]">
                    {label(metadata.event_types, item.event_type)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge value={item.module} />
                  </td>
                  <td className="max-w-52 truncate px-4 py-3 text-gray-700">
                    {item.target?.label || 'Đối tượng chưa xác định'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={item.result} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      aria-label={`Xem chi tiết ${item.event_type}`}
                      onClick={() => void openDetail(item)}
                      className="p-1.5 rounded-xl hover:bg-slate-100 text-gray-500 hover:text-[#C5A059] transition-all"
                      title="Xem chi tiết"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    Đang tải nhật ký hoạt động…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    Không có nhật ký phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {nextCursor && (
        <div className="text-center">
          <button
            className={secondaryButtonClass}
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? 'Đang tải…' : 'Tải thêm nhật ký'}
          </button>
        </div>
      )}

      {/* Data Retention & Purge Panel */}
      <details className="rounded-3xl border border-[#E5E2D9] bg-white p-5 shadow-2xs group">
        <summary className="cursor-pointer text-xs font-bold text-[#2D1B14] flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#C5A059]" />
            Quản lý lưu trữ & Dọn dẹp dữ liệu cũ
          </span>
          <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="mt-4 pt-3 border-t border-[#E5E2D9]/70 space-y-3">
          <p className="text-xs text-[#8A7A6E]">
            Xóa nhật ký cũ luôn yêu cầu tính toán trước phạm vi bị ảnh hưởng, ghi rõ lý do và chuỗi xác nhận an toàn.
          </p>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-bold text-white shadow-xs"
            onClick={() => void openPurge()}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Xóa log cũ
          </button>
        </div>
      </details>

      {/* Investigation Event Drawer */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#2D1B14]/40 backdrop-blur-xs"
          role="presentation"
          onMouseDown={event => event.target === event.currentTarget && setSelected(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-detail-title"
            onKeyDown={event => event.key === 'Escape' && setSelected(null)}
            className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl space-y-5 border-l border-[#E5E2D9]"
          >
            <div className="flex items-start justify-between border-b border-[#E5E2D9] pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#C5A059] block">
                  Điều tra sự kiện an ninh
                </span>
                <h2 id="activity-detail-title" className="text-lg font-serif font-bold text-[#2D1B14] mt-0.5">
                  {label(metadata.event_types, selected.event_type)}
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                aria-label="Đóng chi tiết"
                onClick={() => setSelected(null)}
                className="p-1 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {detailLoading ? (
              <p className="p-12 text-center text-xs text-gray-400">Đang tải chi tiết sự kiện…</p>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={selected.result} />
                  <StatusBadge value={selected.severity} />
                  <StatusBadge value={selected.module} />
                </div>

                <DetailGrid event={selected} onCopy={copy} />

                {selected.change && Object.keys(selected.change.diff || {}).length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-bold text-[#2D1B14] uppercase tracking-wider">
                      Nội dung thay đổi (Diff)
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(selected.change.diff).map(([key, value]) => (
                        <div key={key} className="grid gap-2 rounded-2xl border border-[#E5E2D9] bg-[#FAF9F6] p-3 md:grid-cols-[140px_1fr_20px_1fr] items-center text-xs">
                          <strong className="font-mono text-[#2D1B14]">{key}</strong>
                          <code className="break-all rounded-lg bg-rose-50 p-1.5 text-rose-800 border border-rose-200/60 font-mono text-[11px]">
                            {JSON.stringify(value.before)}
                          </code>
                          <ChevronRight className="h-4 w-4 text-[#C5A059] mx-auto" />
                          <code className="break-all rounded-lg bg-emerald-50 p-1.5 text-emerald-800 border border-emerald-200/60 font-mono text-[11px]">
                            {JSON.stringify(value.after)}
                          </code>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="space-y-2">
                  <h3 className="text-xs font-bold text-[#2D1B14] uppercase tracking-wider">
                    Metadata đã làm sạch
                  </h3>
                  <JsonBlock value={selected.metadata || {}} />
                </section>

                <details className="rounded-2xl border border-[#E5E2D9] p-3 text-xs">
                  <summary className="cursor-pointer font-bold text-gray-500">
                    Dữ liệu sự kiện đầy đủ (Raw Payload)
                  </summary>
                  <div className="mt-2">
                    <JsonBlock value={selected} />
                  </div>
                </details>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Safe Log Purge Modal */}
      {purgeOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2D1B14]/50 backdrop-blur-xs p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="purge-title"
            className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl border border-[#E5E2D9] space-y-4"
          >
            <div className="flex items-start gap-3 pb-3 border-b border-[#E5E2D9]">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 id="purge-title" className="text-base font-serif font-bold text-[#2D1B14]">
                  Xóa nhật ký trên 180 ngày
                </h2>
                <p className="text-xs text-[#8A7A6E]">
                  Hành động không thể hoàn tác và sẽ được ghi lại trong audit trail bảo mật.
                </p>
              </div>
            </div>

            {!purgePreview ? (
              <p className="p-8 text-center text-xs text-gray-400">Đang tính toán phạm vi dữ liệu…</p>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="rounded-2xl bg-rose-50/70 border border-rose-200 p-4">
                  <strong className="text-2xl font-mono text-rose-700 block">
                    {purgePreview.eligible_count.toLocaleString('vi-VN')}
                  </strong>
                  <p className="text-xs text-rose-800 font-semibold mt-0.5">
                    bản ghi đủ điều kiện, trước {formatDate(purgePreview.cutoff)}
                  </p>
                  <p className="mt-2 text-xs text-gray-600">
                    {Object.entries(purgePreview.modules).map(([module, count]) => `${module}: ${count}`).join(' · ') || 'Không có dữ liệu cũ'}
                  </p>
                </div>

                <Field
                  label="Lý do (tối thiểu 10 ký tự)"
                  value={purgeReason}
                  onChange={setPurgeReason}
                />

                <Field
                  label={`Nhập chính xác: ${purgePreview.confirmation_text}`}
                  value={purgeConfirmation}
                  onChange={setPurgeConfirmation}
                />

                <div className="pt-3 border-t border-[#E5E2D9] flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded-xl border border-[#E5E2D9] text-xs font-bold text-gray-600 hover:bg-slate-50"
                    onClick={() => setPurgeOpen(false)}
                  >
                    Hủy
                  </button>
                  <button
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white shadow-xs disabled:opacity-40"
                    onClick={() => void purge()}
                    disabled={purging || purgeReason.trim().length < 10 || purgeConfirmation !== purgePreview.confirmation_text}
                  >
                    {purging ? 'Đang xóa…' : `Xóa ${purgePreview.eligible_count.toLocaleString('vi-VN')} bản ghi`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label: fieldLabel, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block text-xs font-bold text-[#6B5E55] space-y-1">
      <span>{fieldLabel}</span>
      <input
        type={type}
        className={fieldClass}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  );
}

function Select({ label: fieldLabel, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-bold text-[#6B5E55] space-y-1">
      <span>{fieldLabel}</span>
      <select
        className={fieldClass}
        value={value}
        onChange={event => onChange(event.target.value)}
      >
        <option value="">Tất cả</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailGrid({ event, onCopy }: { event: ActivityEvent; onCopy: (value?: string) => void }) {
  const rows = [
    ['Thời gian', formatDate(event.occurred_at)],
    ['Actor', event.actor?.name || event.actor?.email || event.actor_email || 'Hệ thống'],
    ['Vai trò', roleNames[event.actor?.role || event.actor_role || ''] || adminLabel(event.actor?.role || event.actor_role, 'role')],
    ['Đối tượng', `${event.target?.type || event.target_type || '—'} · ${event.target?.label || 'Đối tượng chưa xác định'}`],
    ['IP / Thiết bị', `${event.request?.ip_address || event.ip_address || '—'} · ${event.request?.browser || '—'} · ${event.request?.operating_system || '—'}`],
  ];

  const copyRows: Array<[string, string | undefined]> = [
    ['Event ID', event.id],
    ['Request ID', event.request?.request_id || event.request_id],
    ['Session ID', event.request?.session_id || event.session_id]
  ];

  return (
    <section className="space-y-3 text-xs">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {rows.map(([name, value]) => (
          <div key={name} className="rounded-2xl bg-[#FAF9F6] border border-[#E5E2D9] p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7A6E] block">{name}</span>
            <span className="break-all font-semibold text-[#2D1B14] mt-0.5 block">{value}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {copyRows.map(([name, value]) => (
          <div key={name} className="rounded-2xl bg-[#FAF9F6] border border-[#E5E2D9] p-3 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A7A6E]">{name}</span>
            <button
              className="flex items-center justify-between gap-1 font-mono text-[11px] text-[#2D1B14] hover:text-[#C5A059] mt-1 bg-white p-1.5 rounded-lg border border-[#E5E2D9]"
              onClick={() => onCopy(value)}
              title="Sao chép"
            >
              <span className="truncate">{value || '—'}</span>
              <Clipboard className="h-3 w-3 shrink-0 text-gray-400" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
