'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Activity, Server, Database, Mail, Cpu, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { adminLabel } from '@/lib/admin-labels';
import { usePermissions } from '@/lib/use-permissions';

import { errorMessage, formatDate } from '../shared/formatters';
import { StatusBadge } from '../shared/StatusBadge';
import { monitoringApi } from './api';
import type { HealthSummary, HealthTimeseries } from './types';

function getCheckIcon(name: string) {
  switch (name.toLowerCase()) {
    case 'database':
    case 'mongodb':
    case 'postgres':
      return Database;
    case 'company_email':
    case 'email':
    case 'smtp':
      return Mail;
    case 'cache':
    case 'redis':
      return Cpu;
    default:
      return Server;
  }
}

export function MonitoringPanel() {
  const { can } = usePermissions();
  const canRunChecks = can('website.system.monitoring.run');
  const [data, setData] = useState<HealthSummary | null>(null);
  const [history, setHistory] = useState<HealthTimeseries['items']>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, timeseries] = await Promise.all([
        monitoringApi.summary(),
        monitoringApi.timeseries(24),
      ]);
      setData(summary);
      setHistory(timeseries.items);
      setError('');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      void load();
    }, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const run = async () => {
    if (running || !canRunChecks) return;
    setRunning(true);
    setError('');
    try {
      const summary = await monitoringApi.run();
      setData(summary);
      setHistory((await monitoringApi.timeseries(24)).items);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setRunning(false);
    }
  };

  const recent = history.slice(-12).reverse();

  const isAllHealthy = data?.status === 'HEALTHY';
  const isDown = data?.status === 'DOWN';

  return (
    <div className="space-y-3 sm:space-y-3.5 lg:space-y-4">
      {/* Top Health Overview Card - Compact Slim Status Bar */}
      <section className="rounded-xl sm:rounded-2xl border border-[#E8E0D8] bg-white p-3 sm:p-3.5 lg:p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className={`w-8 h-8 sm:w-8.5 sm:h-8.5 lg:w-9 lg:h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                isAllHealthy
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : isDown
                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                    : 'bg-amber-50 text-amber-600 border-amber-200'
              }`}
            >
              <Activity className={`w-4 h-4 lg:w-4.5 lg:h-4.5 ${running ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm lg:text-[15px] 2xl:text-base font-serif font-bold text-[#2D1B14]">
                  Tình Trạng Sức Khỏe Dịch Vụ & Hạ Tầng
                </h2>
                <StatusBadge value={data?.status} />
              </div>
              <p className="mt-0.5 text-[10px] sm:text-[11px] text-[#8A7A6E]">
                Cập nhật lần cuối: <strong>{data?.generated_at ? formatDate(data.generated_at) : '—'}</strong> (Tự động cập nhật mỗi 30s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E8E0D8] bg-white px-2.5 text-[11px] lg:text-xs font-semibold text-[#6B5E55] hover:bg-[#FAF8F5] hover:text-[#2D1B14] transition-colors cursor-pointer disabled:opacity-60"
              disabled={loading || running}
              onClick={() => void load()}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
            {canRunChecks && (
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#2D1B14] hover:bg-[#1A100B] px-3 text-[11px] lg:text-xs font-bold text-[#D4AF37] transition-all cursor-pointer disabled:opacity-60 shadow-2xs"
                disabled={running}
                onClick={() => void run()}
              >
                <RefreshCw className={`h-3 w-3 ${running ? 'animate-spin' : ''}`} />
                {running ? 'Đang kiểm tra…' : 'Kiểm tra ngay'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-800">
            {error}
          </div>
        )}
      </section>

      {/* Subsystem Health Cards Grid - Compact & Responsive */}
      {loading && !data && (
        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-8 text-center text-xs text-gray-400">
          Đang tải trạng thái hệ thống…
        </div>
      )}

      {data?.checks && (
        <div className="grid gap-2.5 sm:gap-3 lg:gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {data.checks.map((check) => {
            const Icon = getCheckIcon(check.name);
            const isHealthy = check.status === 'HEALTHY';
            const isDegraded = check.status === 'DEGRADED';
            const latency = check.latency_ms;
            const tone = isHealthy
              ? { bar: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-700 border-emerald-100' }
              : isDegraded
                ? { bar: 'bg-amber-500', icon: 'bg-amber-50 text-amber-700 border-amber-100' }
                : { bar: 'bg-rose-500', icon: 'bg-rose-50 text-rose-700 border-rose-100' };

            return (
              <article
                key={check.name}
                className="group flex min-w-0 flex-col overflow-hidden rounded-xl sm:rounded-2xl border border-[#E8E0D8] bg-white shadow-2xs transition-all hover:-translate-y-0.5 hover:border-[#C5A059]/60 hover:shadow-xs"
              >
                <div className={`h-1 w-full ${tone.bar}`} />
                <div className="flex flex-1 flex-col p-3 sm:p-3.5 lg:p-4">
                  {/* Service info & Badge */}
                  <div className="flex min-w-0 items-start justify-between gap-2.5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${tone.icon}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="max-w-full break-words text-xs lg:text-[13px] 2xl:text-sm font-bold leading-snug text-[#2D1B14]"
                          title={adminLabel(check.name, 'monitoring')}
                        >
                          {adminLabel(check.name, 'monitoring')}
                        </p>
                        <span className="mt-0.5 block break-all font-mono text-[9px] lg:text-[10px] leading-tight text-gray-400" title={check.name}>
                          {check.name}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 scale-95 origin-top-right">
                      <StatusBadge value={check.status} />
                    </div>
                  </div>

                  {/* Latency metric */}
                  <div className="mt-3 flex items-baseline justify-between border-t border-[#F0EDE5] pt-2.5">
                    <span className="text-[10px] lg:text-[11px] font-semibold text-[#8A7A6E]">Độ trễ phản hồi</span>
                    <span className={`font-mono text-base lg:text-lg 2xl:text-xl font-bold leading-none ${latency == null ? 'text-gray-400' : latency < 50 ? 'text-emerald-700' : latency < 200 ? 'text-amber-700' : 'text-rose-700'}`}>
                      {latency == null ? '—' : `${latency} ms`}
                    </span>
                  </div>

                  {/* Status brief line */}
                  <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-[#E8E0D8]/60 bg-[#FAF8F5] p-2">
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${isHealthy ? 'bg-emerald-500' : isDegraded ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    <p className="line-clamp-2 break-words text-[10px] lg:text-[11px] leading-relaxed text-[#6B5E55]" title={check.message}>
                      {check.message || 'Hệ thống hoạt động bình thường.'}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 24-hour History Timeline Table - Compact */}
      <section className="overflow-hidden rounded-xl sm:rounded-2xl border border-[#E8E0D8] bg-white shadow-2xs">
        <div className="border-b border-[#E8E0D8] p-3 sm:p-3.5 lg:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div>
            <h3 className="text-xs sm:text-sm lg:text-[14px] font-serif font-bold text-[#2D1B14] flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#C5A059]" />
              Lịch sử 24 giờ
            </h3>
            <p className="text-[10px] sm:text-[11px] text-[#8A7A6E] mt-0.5">
              12 lần kiểm tra gần nhất; dữ liệu đầy đủ được lưu giữ 30 ngày.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-[#FAF8F5] border-b border-[#E8E0D8] text-[10px] lg:text-[11px] uppercase font-bold text-[#6B5E55] tracking-wider">
              <tr>
                <th className="px-3.5 py-2 lg:px-4 lg:py-2.5">Thời gian</th>
                <th className="px-3.5 py-2 lg:px-4 lg:py-2.5">Tổng thể</th>
                <th className="px-3.5 py-2 lg:px-4 lg:py-2.5">Thành phần bất thường</th>
                <th className="px-3.5 py-2 lg:px-4 lg:py-2.5 text-right">Độ trễ cao nhất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDE5]">
              {recent.map((snapshot) => {
                const unhealthy = snapshot.checks.filter((check) => check.status !== 'HEALTHY');
                const latency = Math.max(0, ...snapshot.checks.map((check) => check.latency_ms || 0));

                return (
                  <tr key={snapshot.generated_at} className="hover:bg-[#FAF8F5]/80 transition-colors">
                    <td className="px-3.5 py-2 lg:px-4 lg:py-2.5 font-medium text-slate-800 text-[11px] lg:text-xs">
                      {formatDate(snapshot.generated_at)}
                    </td>
                    <td className="px-3.5 py-2 lg:px-4 lg:py-2.5">
                      <StatusBadge value={snapshot.status} />
                    </td>
                    <td className="px-3.5 py-2 lg:px-4 lg:py-2.5 text-[11px] lg:text-xs">
                      {unhealthy.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {unhealthy.map((check) => (
                            <span key={check.name} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 text-[9px] lg:text-[10px] font-bold">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {adminLabel(check.name, 'monitoring')}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[11px] lg:text-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Bình thường
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2 lg:px-4 lg:py-2.5 text-right font-mono font-bold text-slate-700 text-[11px] lg:text-xs">
                      {latency ? `${latency} ms` : '—'}
                    </td>
                  </tr>
                );
              })}
              {!loading && !recent.length && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400 text-xs">
                    Chưa có lịch sử kiểm tra.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
