'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, ShieldCheck } from 'lucide-react';
import type { ValidationIssue, ValidationReport } from '../contracts/generated';

type IssueLocation = { step: string; control: string };

export default function ValidationPanel({
  report,
  onSelectIssue,
  resolveLocation,
}: {
  report?: ValidationReport | null;
  onSelectIssue?: (field: string) => void;
  resolveLocation?: (issue: ValidationIssue) => IssueLocation;
}) {
  if (!report) return null;
  const isReady = report.errors.length === 0;
  const groups = [
    ['SEO', 'Thiếu thông tin SEO'],
    ['GEO', 'Thiếu dữ liệu AI/GEO'],
    ['MEDIA', 'Hình ảnh & Đa phương tiện'],
    ['CONTENT', 'Nội dung chi tiết'],
  ] as const;

  return (
    <aside
      aria-live="polite"
      aria-label="Kết quả kiểm tra SEO và GEO"
      className={`rounded-xl border p-3 space-y-3 transition-all ${
        isReady
          ? 'border-emerald-200 bg-emerald-50/60 text-emerald-950 shadow-2xs'
          : 'border-amber-200 bg-amber-50/50 text-[#2D1B14] shadow-2xs'
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E5E2D9]">
        <div className="flex items-center gap-2.5">
          {isReady ? (
            <div className="w-8 h-8 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-amber-100/80 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          )}
          <div>
            <h3 className="text-xs font-serif font-bold tracking-tight text-[#2D1B14]">
              Chất Lượng SEO &amp; GEO
            </h3>
            <p className="text-[11px] text-[#8A7A6E] font-medium mt-0.5">
              {report.errors.length} lỗi bắt buộc · {report.warnings.length} cảnh báo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-xl border border-[#E5E2D9] shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-gray-400">Điểm</span>
          <span
            className={`text-xs font-mono font-bold ${
              isReady ? 'text-emerald-700' : 'text-amber-800'
            }`}
          >
            {report.score}/100
          </span>
        </div>
      </div>

      {(report.errors.length > 0 || report.warnings.length > 0) && (
        <div className="max-h-[380px] space-y-2.5 overflow-y-auto pr-1 custom-scrollbar">
          {groups.map(([group, label]) => {
            const items = report.errors.filter(item => (item.group || 'CONTENT') === group);
            if (!items.length) return null;
            return (
              <div key={group} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{label}</span>
                  </p>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {items.map(item => (
                    <IssueButton
                      key={`${item.code}-${item.field}`}
                      issue={item}
                      tone="error"
                      resolveLocation={resolveLocation}
                      onSelectIssue={onSelectIssue}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {report.warnings.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-[#E5E2D9]">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Cảnh báo tối ưu ({report.warnings.length})</span>
                </p>
              </div>
              <div className="space-y-1.5">
                {report.warnings.map(item => (
                  <IssueButton
                    key={`${item.code}-${item.field}`}
                    issue={item}
                    tone="warning"
                    resolveLocation={resolveLocation}
                    onSelectIssue={onSelectIssue}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isReady && (
        <div className="flex items-center gap-2 p-3 bg-emerald-100/70 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Dữ liệu đã đạt chuẩn Quality Gate và sẵn sàng để gửi duyệt/xuất bản.</span>
        </div>
      )}
    </aside>
  );
}

const ISSUE_TIPS: Record<string, string> = {
  META_TITLE_LENGTH: 'Độ dài 30-60 ký tự giúp Google hiển thị trọn vẹn tiêu đề trên cả Mobile và Desktop.',
  META_DESCRIPTION_LENGTH: 'Độ dài 120-160 ký tự tóm tắt hấp dẫn giúp tăng tỷ lệ nhấp chuột (CTR).',
  HERO_MISSING: 'Ảnh đại diện hoặc video YouTube giúp dự án nổi bật và thu hút khách hàng ngay khi vào trang.',
  KEY_FACTS_MISSING: 'Tối thiểu 3 dữ kiện quan trọng giúp các công cụ tìm kiếm AI (Gemini, Perplexity) trích dẫn dự án.',
  GEO_KEY_FACTS_MISSING: 'Tối thiểu 3 dữ kiện quan trọng giúp các công cụ tìm kiếm AI (Gemini, Perplexity) trích dẫn bài viết.',
  FAQ_MISSING: 'Tối thiểu 2 câu hỏi thường gặp giúp giải đáp thắc mắc ngay cho khách mua nhà.',
  GEO_FAQS_MISSING: 'Tối thiểu 2 câu hỏi thường gặp giúp giải đáp thắc mắc ngay cho độc giả.',
  IMAGE_ALT_MISSING: 'Thẻ Alt mô tả ảnh giúp Google lập chỉ mục hình ảnh và hỗ trợ người khiếm thị.',
  INLINE_IMAGE_ALT_MISSING: 'Mọi ảnh nội dòng đều cần thẻ Alt mô tả để đạt chuẩn trợ năng (Accessibility).',
  CONTENT_TOO_SHORT: 'Nội dung tối thiểu 300 từ giúp bài viết có chiều sâu thông tin và xếp hạng SEO tốt hơn.',
  CONTENT_HAS_H1: 'Tiêu đề trang đã là H1 duy nhất, không dùng H1 trong nội dung để tránh xung đột cấu trúc SEO.',
  H2_MISSING: 'Nội dung cần có ít nhất một tiêu đề H2 để phân đoạn thông tin rõ ràng cho người đọc.',
};

function IssueButton({
  issue,
  tone,
  resolveLocation,
  onSelectIssue,
}: {
  issue: ValidationIssue;
  tone: 'error' | 'warning';
  resolveLocation?: (issue: ValidationIssue) => IssueLocation;
  onSelectIssue?: (field: string) => void;
}) {
  const location = resolveLocation?.(issue) || { step: 'Biểu mẫu', control: issue.field };
  const isError = tone === 'error';
  const tip = ISSUE_TIPS[issue.code];

  return (
    <button
      type="button"
      onClick={() => onSelectIssue?.(issue.field)}
      className={`group block w-full rounded-xl border p-2.5 text-left transition-all hover:shadow-2xs focus:outline-none focus:ring-1 focus:ring-[#C5A059] ${
        isError
          ? 'bg-white border-rose-200 hover:border-rose-400'
          : 'bg-white border-amber-200 hover:border-amber-400'
      }`}
      aria-label={`Đi đến ${location.step}, ${location.control}`}
    >
      <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 mb-1 gap-1">
        <span className="leading-tight pr-1">Vị trí: {location.step} → {location.control}</span>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#C5A059] transition-transform group-hover:translate-x-0.5 shrink-0" />
      </div>
      <p className="text-xs text-[#2D1B14] font-medium leading-snug break-words">
        <span className={isError ? 'text-rose-600 font-bold' : 'text-amber-700 font-bold'}>
          {isError ? 'Cần sửa: ' : 'Lưu ý: '}
        </span>
        {issue.message}
      </p>
      {tip && (
        <p className="mt-1.5 text-[11px] text-[#6B5E55] bg-[#F5F2EB]/80 rounded-xl px-2 py-1 border border-[#E5E2D9] leading-relaxed break-words">
          💡 {tip}
        </p>
      )}
      <div className="mt-1.5 flex items-center justify-between text-[10px]">
        <span className="text-gray-400 font-mono">{location.control}</span>
        <span className="text-[#C5A059] font-bold group-hover:underline">Bấm để sửa →</span>
      </div>
    </button>
  );
}
