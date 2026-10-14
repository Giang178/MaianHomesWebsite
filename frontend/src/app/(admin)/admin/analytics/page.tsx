'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Globe,
  FileText,
  ArrowRight,
  Send,
  Layers,
  Calendar,
} from 'lucide-react';
import { noticeAdmin } from '@/components/admin/admin-dialog-service';
import {
  websiteAdminApi,
  type WebsiteAnalyticsSummary,
} from '@/features/website/admin/api';
import { downloadLeadExport } from '@/features/inquiries/admin/api';

type PeriodOption = 'today' | '7d' | '30d' | 'this_month' | 'all';

const PERIOD_LABELS: Record<PeriodOption, string> = {
  today: 'Hôm nay',
  '7d': '7 ngày qua',
  '30d': '30 ngày qua',
  this_month: 'Tháng này',
  all: 'Toàn thời gian',
};

export default function WebsiteAnalyticsPage() {
  const [period, setPeriod] = useState<PeriodOption>('all');
  const [data, setData] = useState<WebsiteAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<{
    date: string;
    count: number;
    new_count: number;
  } | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await websiteAdminApi.analytics.getSummary({ period });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu thống kê');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      setExporting(true);
      await downloadLeadExport('xlsx');
    } catch (err) {
      noticeAdmin(err instanceof Error ? err.message : 'Không thể xuất dữ liệu');
    } finally {
      setExporting(false);
    }
  };

  // Find max count in timeline for SVG scaling
  const maxTimelineCount = useMemo(() => {
    if (!data?.timeline?.length) return 1;
    const max = Math.max(...data.timeline.map((t) => t.count));
    return max > 0 ? max : 1;
  }, [data?.timeline]);

  // Top marketing channel
  const topChannel = useMemo(() => {
    if (!data?.by_utm_source?.length) return null;
    return data.by_utm_source[0];
  }, [data?.by_utm_source]);

  // Format date helper
  const formatDateVN = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="admin-module-page admin-module-page--analytics space-y-3 sm:space-y-3.5 lg:space-y-4 p-3 sm:p-4 lg:p-5 2xl:p-6 text-[#2D1B14] min-h-screen bg-slate-50/60">
      {/* 1. Header & Controls - Compact & Responsive */}
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-white p-3 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border border-[#E8E0D8] shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="flex h-8 w-8 sm:h-8.5 sm:w-8.5 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-xl bg-[#2D1B14] text-[#D4AF37] shadow-2xs">
            <BarChart3 className="h-4 w-4 lg:h-4.5 lg:w-4.5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg lg:text-xl 2xl:text-2xl font-bold font-serif text-[#2D1B14] tracking-tight">
                Thống Kê & Chuyển Đổi Website
              </h1>
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Live Insights
              </span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-[#6B5E55] max-w-2xl font-light line-clamp-1 sm:line-clamp-none">
              Tổng hợp dữ liệu biểu mẫu khách hàng, phân bổ nguồn truy cập và hiệu quả chuyển đổi thực tế.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto shrink-0">
          {/* Period selector */}
          <div className="inline-flex rounded-xl bg-[#FAF8F5] p-1 border border-[#E8E0D8] shadow-2xs">
            {(Object.keys(PERIOD_LABELS) as PeriodOption[]).map((key) => {
              const active = period === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriod(key)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] lg:text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
                      : 'text-[#6B5E55] hover:text-[#2D1B14] hover:bg-white'
                  }`}
                >
                  {PERIOD_LABELS[key]}
                </button>
              );
            })}
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => void fetchData(true)}
            disabled={loading || refreshing}
            className="p-1.5 sm:p-2 rounded-lg border border-[#E8E0D8] bg-[#FAF8F5] hover:bg-white text-[#6B5E55] hover:text-[#2D1B14] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Làm mới số liệu"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-[#C5A059]' : ''}`} />
          </button>

          {/* Export button */}
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2D1B14] hover:bg-[#1A100B] px-3.5 font-bold text-xs text-[#D4AF37] transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <Download className="h-3 w-3" />
            <span>{exporting ? 'Đang xuất…' : 'Xuất Excel'}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Top Metric Cards (Compact Space-Saving Layout - Zero Content Truncation) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {/* Card 1: Total Leads */}
        <Link
          href="/admin/leads"
          className="text-left rounded-xl border border-[#E8E0D8] bg-white p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-[#C5A059]/60 hover:shadow-xs transition-all group cursor-pointer"
          title="Xem danh sách toàn bộ khách hàng"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#FAF8F5] border border-[#E8E0D8] flex items-center justify-center text-[#C5A059] shrink-0 group-hover:scale-105 transition-transform">
                <Users className="w-3.5 h-3.5" />
              </div>
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {(data?.overview.growth_rate ?? 0) >= 0 ? `+${data?.overview.growth_rate ?? 100}%` : `${data?.overview.growth_rate}%`}
              </span>
            </div>
            <p className="text-base sm:text-lg xl:text-xl font-serif font-bold text-[#2D1B14] shrink-0 pl-1 leading-none tabular-nums">
              {loading ? '...' : (data?.overview.total ?? 0)}
            </p>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#6B5E55] block leading-tight">
              Tổng lượt gửi liên hệ
            </span>
            <p className="text-[9.5px] sm:text-[10px] text-[#8A7A6E] leading-tight mt-0.5 break-words">
              {loading ? 'Đang đồng bộ…' : `${data?.overview.processed ?? 0} liên hệ đã xử lý`}
            </p>
          </div>
        </Link>

        {/* Card 2: New Leads Waiting */}
        <Link
          href="/admin/leads?status=NEW"
          className="text-left rounded-xl border border-rose-200 bg-rose-50/40 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-rose-300 hover:shadow-xs transition-all cursor-pointer group"
          title="Lọc nhanh khách hàng chờ tiếp nhận"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-rose-100/80 border border-rose-200/80 flex items-center justify-center text-rose-800 shrink-0 group-hover:scale-105 transition-transform relative">
                <Clock className="w-3.5 h-3.5" />
                {!loading && (data?.overview.new ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-600"></span>
                  </span>
                )}
              </div>
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8.5px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                Cần liên hệ
              </span>
            </div>
            <p className="text-base sm:text-lg xl:text-xl font-serif font-bold text-rose-900 shrink-0 pl-1 leading-none tabular-nums">
              {loading ? '...' : (data?.overview.new ?? 0)}
            </p>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-rose-900 block leading-tight">
              Chờ tiếp nhận (Mới)
            </span>
            <p className="text-[9.5px] sm:text-[10px] text-rose-800/90 leading-tight mt-0.5 break-words">
              Khách hàng vừa để lại thông tin trên website
            </p>
          </div>
        </Link>

        {/* Card 3: Response Rate */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-emerald-300 hover:shadow-xs transition-all">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-100/80 border border-emerald-200/80 flex items-center justify-center text-emerald-800 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Tiến độ
              </span>
            </div>
            <p className="text-base sm:text-lg xl:text-xl font-serif font-bold text-emerald-900 shrink-0 pl-1 leading-none tabular-nums">
              {loading ? '...' : `${data?.overview.response_rate ?? 0}%`}
            </p>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-900 block leading-tight">
              Tỷ lệ xử lý
            </span>
            <p className="text-[9.5px] sm:text-[10px] text-emerald-800/90 leading-tight mt-0.5 break-words">
              Đã mở xem hoặc phản hồi bước đầu
            </p>
          </div>
        </div>

        {/* Card 4: Top Channel */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-amber-300 hover:shadow-xs transition-all">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-100/80 border border-amber-200/80 flex items-center justify-center text-amber-800 shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[8.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Hiệu quả nhất
              </span>
            </div>
            <p className="text-base sm:text-lg xl:text-xl font-serif font-bold text-amber-900 shrink-0 pl-1 leading-none tabular-nums">
              {loading ? '...' : `${topChannel?.percentage ?? 100}%`}
            </p>
          </div>

          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-950 block leading-tight">
              Kênh chuyển đổi tốt nhất
            </span>
            <p className="text-[9.5px] sm:text-[10px] text-amber-900/90 leading-tight mt-0.5 break-words">
              {loading ? 'Đang tính…' : (topChannel?.label || 'Truy cập trực tiếp (Direct / Organic)')} • Chiếm {topChannel?.percentage ?? 100}%
            </p>
          </div>
        </div>
      </div>

      {/* 3. Timeline Interactive Trend Chart - Compact Height */}
      <div className="rounded-xl sm:rounded-2xl border border-[#E8E0D8] bg-white p-3 sm:p-3.5 lg:p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 border-b border-[#E8E0D8] pb-2.5 sm:pb-3">
          <div>
            <h2 className="text-xs sm:text-sm lg:text-[15px] font-bold font-serif text-[#2D1B14] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#C5A059]" />
              <span>Xu hướng tiếp nhận thông tin theo ngày</span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#6B5E55] mt-0.5 font-light">
              Số lượng khách hàng gửi form từng ngày theo múi giờ Việt Nam (UTC+7)
            </p>
          </div>
          {hoveredDate && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-[#FAF8F5] px-2.5 py-0.5 text-[11px] border border-[#E8E0D8]">
              <span className="font-semibold text-[#6B5E55]">Ngày {formatDateVN(hoveredDate.date)}:</span>
              <strong className="text-[#2D1B14]">{hoveredDate.count} liên hệ</strong>
              {hoveredDate.new_count > 0 && (
                <span className="font-bold text-rose-600">({hoveredDate.new_count} mới)</span>
              )}
            </div>
          )}
        </div>

        {/* Chart Container - Compact h-36/h-40 */}
        <div className="mt-3 sm:mt-4">
          {loading ? (
            <div className="flex h-36 sm:h-40 items-center justify-center text-xs text-[#8A7A6E]">
              <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-[#C5A059]" />
              Đang tổng hợp dữ liệu thời gian...
            </div>
          ) : !data?.timeline || data.timeline.length === 0 ? (
            <div className="flex h-36 sm:h-40 flex-col items-center justify-center text-xs text-[#8A7A6E]">
              <Calendar className="h-6 w-6 text-[#8A7A6E]/40 mb-1.5" />
              Chưa có lượt gửi form nào trong khoảng thời gian đã chọn.
            </div>
          ) : (
            <div className="relative">
              {/* Bars view */}
              <div className="flex items-end gap-1 sm:gap-1.5 h-36 sm:h-40 pt-4 pb-1 overflow-x-auto scrollbar-none">
                {data.timeline.map((point) => {
                  const heightPercent = Math.max(8, Math.round((point.count / maxTimelineCount) * 100));
                  const isHovered = hoveredDate?.date === point.date;
                  return (
                    <div
                      key={point.date}
                      onMouseEnter={() => setHoveredDate(point)}
                      onMouseLeave={() => setHoveredDate(null)}
                      className="group flex-1 min-w-[16px] max-w-[40px] h-full flex flex-col justify-end items-center cursor-pointer relative"
                    >
                      {/* Count badge on hover */}
                      <div
                        className={`absolute -top-6 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap transition-all pointer-events-none z-10 ${
                          isHovered
                            ? 'opacity-100 scale-100 bg-[#2D1B14] text-[#D4AF37]'
                            : 'opacity-0 scale-90'
                        }`}
                      >
                        {point.count}
                      </div>

                      {/* Bar Pillar */}
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          point.count === 0
                            ? 'bg-stone-100'
                            : isHovered
                            ? 'bg-[#C5A059]'
                            : point.new_count > 0
                            ? 'bg-[#2D1B14]'
                            : 'bg-[#2D1B14]/75'
                        }`}
                        style={{ height: `${point.count === 0 ? 6 : heightPercent}%` }}
                      />

                      {/* Date label */}
                      <span className="mt-1.5 text-[9px] sm:text-[10px] text-[#8A7A6E] font-medium group-hover:text-[#2D1B14] transition-colors whitespace-nowrap">
                        {formatShortDate(point.date)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend - Compact */}
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] text-[#6B5E55] border-t border-[#E8E0D8] pt-2">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-xs bg-[#2D1B14]" />
                  Có liên hệ mới
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-xs bg-[#C5A059]" />
                  Đang chọn xem
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-xs bg-stone-200" />
                  Không phát sinh
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Deep Breakdown: 2 Columns - Compact Spacing */}
      <div className="grid gap-3 sm:gap-3.5 lg:gap-4 lg:grid-cols-2">
        {/* Column 1: By Form / Service */}
        <div className="rounded-xl sm:rounded-2xl border border-[#E8E0D8] bg-white p-3 sm:p-3.5 lg:p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-2.5">
            <h2 className="text-xs sm:text-sm lg:text-[15px] font-bold font-serif text-[#2D1B14] flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#C5A059]" />
              <span>Hiệu quả theo Nguồn Form & Dịch vụ</span>
            </h2>
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#8A7A6E]">
              {data?.by_form?.length ?? 0} nguồn
            </span>
          </div>

          <div className="mt-3.5 space-y-2.5 sm:space-y-3">
            {loading ? (
              <div className="py-6 text-center text-xs text-[#8A7A6E]">Đang phân tích form...</div>
            ) : !data?.by_form || data.by_form.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#8A7A6E]">Chưa có dữ liệu form nào.</div>
            ) : (
              data.by_form.map((form) => (
                <div key={form.form_id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold">
                    <span className="text-[#2D1B14] truncate max-w-[70%]" title={form.label}>
                      {form.label}
                    </span>
                    <span className="text-[#6B5E55]">
                      <strong className="text-[#2D1B14]">{form.count}</strong> ({form.percentage}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#FAF8F5] border border-[#E8E0D8]/60">
                    <div
                      className="h-full rounded-full bg-[#2D1B14] transition-all duration-500"
                      style={{ width: `${form.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Breakdown by product group (source) */}
          {data?.by_source && data.by_source.length > 0 && (
            <div className="mt-4 border-t border-[#E8E0D8] pt-3">
              <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#8A7A6E] mb-2">
                Theo nhóm sản phẩm
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {data.by_source.map((src) => (
                  <div
                    key={src.source}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E8E0D8] bg-[#FAF8F5] px-2.5 py-1 text-[11px] shadow-2xs"
                  >
                    <span className="font-semibold text-[#6B5E55]">{src.label}:</span>
                    <span className="font-bold text-[#2D1B14]">{src.count}</span>
                    <span className="text-[#8A7A6E] text-[9px]">({src.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Column 2: Marketing Channels (UTM) & Status Funnel */}
        <div className="rounded-xl sm:rounded-2xl border border-[#E8E0D8] bg-white p-3 sm:p-3.5 lg:p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-2.5">
              <h2 className="text-xs sm:text-sm lg:text-[15px] font-bold font-serif text-[#2D1B14] flex items-center gap-2">
                <Send className="h-4 w-4 text-[#C5A059]" />
                <span>Kênh tiếp thị & Chiến dịch (UTM)</span>
              </h2>
              <span className="text-[10px] sm:text-[11px] font-semibold text-[#8A7A6E]">
                {data?.by_utm_source?.length ?? 0} kênh
              </span>
            </div>

            <div className="mt-3.5 space-y-2.5 sm:space-y-3">
              {loading ? (
                <div className="py-6 text-center text-xs text-[#8A7A6E]">Đang phân tích kênh tiếp thị...</div>
              ) : !data?.by_utm_source || data.by_utm_source.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#8A7A6E]">Chưa có dữ liệu kênh tiếp thị.</div>
              ) : (
                data.by_utm_source.map((utm) => (
                  <div key={utm.source} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold">
                      <span className="text-[#2D1B14] truncate max-w-[70%]" title={utm.label}>
                        {utm.label}
                      </span>
                      <span className="text-[#6B5E55]">
                        <strong className="text-[#2D1B14]">{utm.count}</strong> ({utm.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#FAF8F5] border border-[#E8E0D8]/60">
                      <div
                        className="h-full rounded-full bg-[#C5A059] transition-all duration-500"
                        style={{ width: `${utm.percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Status Distribution Pills */}
          {data?.by_status && data.by_status.length > 0 && (
            <div className="mt-4 border-t border-[#E8E0D8] pt-3">
              <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#8A7A6E] mb-2">
                Quy trình tiếp nhận & lưu trữ
              </h3>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {data.by_status.map((st) => (
                  <div
                    key={st.status}
                    className="rounded-lg border border-[#E8E0D8] bg-[#FAF8F5] p-2 text-center shadow-2xs"
                  >
                    <span className="block text-[10px] font-semibold text-[#6B5E55] truncate">
                      {st.label}
                    </span>
                    <strong className="mt-0.5 block text-sm sm:text-base font-bold font-serif text-[#2D1B14]">
                      {st.count}
                    </strong>
                    <span className="text-[9px] text-[#8A7A6E]">{st.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Top Converting Pages & Recent Leads - Compact Table */}
      <div className="grid gap-3 sm:gap-3.5 lg:gap-4 lg:grid-cols-3">
        {/* Top Pages (1 Col) */}
        <div className="rounded-xl sm:rounded-2xl border border-[#E8E0D8] bg-white p-3 sm:p-3.5 lg:p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-2.5">
            <h2 className="text-xs sm:text-sm lg:text-[15px] font-bold font-serif text-[#2D1B14] flex items-center gap-2">
              <Globe className="h-4 w-4 text-[#C5A059]" />
              <span>Top trang phát sinh liên hệ</span>
            </h2>
          </div>

          <div className="mt-3 divide-y divide-[#E8E0D8]/60">
            {loading ? (
              <div className="py-6 text-center text-xs text-[#8A7A6E]">Đang tải trang...</div>
            ) : !data?.top_pages || data.top_pages.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#8A7A6E]">Chưa có thông tin trang.</div>
            ) : (
              data.top_pages.map((p, idx) => (
                <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <span className="block truncate text-[11px] sm:text-xs font-semibold text-[#2D1B14]" title={p.label}>
                      {p.label}
                    </span>
                    {p.page_url && (
                      <span className="block truncate text-[10px] text-[#8A7A6E]" title={p.page_url}>
                        {p.page_url}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[11px] sm:text-xs font-bold text-[#2D1B14]">{p.count}</span>
                    <span className="block text-[9px] text-[#8A7A6E]">({p.percentage}%)</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Inquiries (2 Cols) - PRIVACY ENHANCED: NO PHONE DISPLAY */}
        <div className="rounded-xl sm:rounded-2xl border border-[#E8E0D8] bg-white p-3 sm:p-3.5 lg:p-4 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#E8E0D8] pb-2.5">
            <div>
              <h2 className="text-xs sm:text-sm lg:text-[15px] font-bold font-serif text-[#2D1B14] flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#C5A059]" />
                <span>Liên hệ khách hàng gần nhất</span>
              </h2>
              <p className="text-[10px] sm:text-[11px] text-[#6B5E55] mt-0.5 font-light">
                Các lượt điền form mới nhất được ghi nhận từ website
              </p>
            </div>
            <Link
              href="/admin/leads"
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-[#2D1B14] hover:text-[#C5A059] transition-colors"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-3 overflow-x-auto">
            {loading ? (
              <div className="py-6 text-center text-xs text-[#8A7A6E]">Đang tải liên hệ...</div>
            ) : !data?.recent_leads || data.recent_leads.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#8A7A6E]">Chưa có liên hệ nào.</div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E8E0D8] text-[#8A7A6E] font-bold uppercase text-[9px] lg:text-[10px] tracking-wider">
                    <th className="pb-2 px-2">Khách hàng</th>
                    <th className="pb-2 px-2">Dịch vụ / Form</th>
                    <th className="pb-2 px-2">Thời gian</th>
                    <th className="pb-2 px-2 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E0D8]/60">
                  {data.recent_leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                      {/* Customer Name only, PRIVACY COMPLIANT: DO NOT SHOW PHONE NUMBER */}
                      <td className="py-2 lg:py-2.5 px-2 font-semibold text-[#2D1B14]">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#FAF8F5] border border-[#E8E0D8] text-[#C5A059] flex items-center justify-center font-bold text-[10px] shrink-0">
                            {lead.customer_name?.charAt(0)?.toUpperCase() || 'K'}
                          </div>
                          <span className="font-bold text-[#2D1B14] text-[11px] sm:text-xs">
                            {lead.customer_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 lg:py-2.5 px-2 text-[#6B5E55]">
                        <span className="inline-block max-w-[200px] truncate font-medium text-[11px] sm:text-xs" title={lead.form_label}>
                          {lead.form_label}
                        </span>
                      </td>
                      <td className="py-2 lg:py-2.5 px-2 text-[#8A7A6E] whitespace-nowrap text-[10px] sm:text-[11px]">
                        {formatDateVN(lead.submitted_at)}
                      </td>
                      <td className="py-2 lg:py-2.5 px-2 text-right whitespace-nowrap">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] lg:text-[10px] font-bold border"
                          style={{
                            backgroundColor: `${lead.status_color || '#64748B'}15`,
                            borderColor: `${lead.status_color || '#64748B'}40`,
                            color: lead.status_color || '#64748B',
                          }}
                        >
                          {lead.status_label || 'Chờ tiếp nhận'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
