'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  FileCode,
  ListOrdered,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { companyKnowledgeApi } from '@/features/content/api';
import { adminConfirm, noticeAdmin } from '@/components/admin/admin-dialog-service';

type FAQ = { question: string; answer: string };
type Payload = {
  company_name: string;
  overview: string;
  services: string[];
  service_areas: string[];
  working_hours: string;
  consultation_process: string[];
  policies: string[];
  faqs: FAQ[];
  effective_date: string;
};
type Document = {
  version: number;
  workflow_status: string;
  publication_status: string;
  draft: Payload;
  published?: Payload | null;
};

const EMPTY: Payload = {
  company_name: 'Maian Homes',
  overview: '',
  services: [],
  service_areas: [],
  working_hours: '',
  consultation_process: [],
  policies: [],
  faqs: [],
  effective_date: '',
};

const toLines = (items: string[]) => (Array.isArray(items) ? items.join('\n') : '');
const fromLines = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const WORKFLOW_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT: { label: 'Bản nháp', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  PUBLISHED: { label: 'Đã xuất bản', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
};

const PUBLICATION_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  PUBLISHED: { label: 'Đang hiển thị cho AI & Web', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  NEVER_PUBLISHED: { label: 'Chưa từng xuất bản', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  UNPUBLISHED: { label: 'Đã tạm gỡ khỏi AI', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  ARCHIVED: { label: 'Đã lưu trữ', bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
};

export default function CompanyKnowledgePanel() {
  const { user } = useAuth();
  const permissions = new Set(user?.permissions || []);
  const canUpdate = permissions.has('*') || permissions.has('website.pages.update');
  const canPublish = permissions.has('*') || permissions.has('website.pages.publish');

  const [document, setDocument] = useState<Document | null>(null);
  const [draft, setDraft] = useState<Payload>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'profile' | 'services' | 'process' | 'faqs'>('profile');
  const [faqSearch, setFaqSearch] = useState('');
  const [showAiSimulator, setShowAiSimulator] = useState(false);
  const [showSchemaPreview, setShowSchemaPreview] = useState(false);
  const [showPublishedCompare, setShowPublishedCompare] = useState(false);
  const [simQuestion, setSimQuestion] = useState('');
  const [simAnswer, setSimAnswer] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const result = (await companyKnowledgeApi.get()) as Document;
      setDocument(result);
      setDraft({ ...EMPTY, ...(result.draft || {}) });
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load company knowledge.';
      setLoadError(message);
      noticeAdmin(message, 'error');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const draftChanged = useMemo(() => {
    return JSON.stringify(draft) !== JSON.stringify(document?.draft);
  }, [draft, document?.draft]);

  const save = async () => {
    if (!document || !canUpdate) return;
    setBusy(true);
    try {
      const result = (await companyKnowledgeApi.update(draft, document.version)) as Document;
      setDocument(result);
      setDraft(result.draft);
      noticeAdmin('Đã lưu bản nháp. Nội dung chưa được xuất bản.', 'success');
    } catch (error) {
      noticeAdmin(error instanceof Error ? error.message : 'Không thể lưu bản nháp.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const transition = async (action: 'publish' | 'unpublish') => {
    if (!document || !canUpdate) return;
    if (!(await adminConfirm(`Xác nhận thao tác ${action} cho phiên bản v${document.version}?`))) return;
    setBusy(true);
    try {
      let currentDocument = document;
      if (draftChanged) {
        currentDocument = (await companyKnowledgeApi.update(draft, document.version)) as Document;
        setDocument(currentDocument);
        setDraft(currentDocument.draft);
      }
      const result = (await companyKnowledgeApi.transition(action, currentDocument.version)) as Document;
      setDocument(result);
      setDraft(result.draft);
      setLoadError(null);
      noticeAdmin(action === 'publish' ? 'Đã xuất bản trực tiếp.' : 'Đã gỡ xuất bản.', 'success');
    } catch (error) {
      noticeAdmin(error instanceof Error ? error.message : 'Lỗi khi cập nhật nội dung.', 'error');
    } finally {
      setBusy(false);
    }
  };
  // Quality score & checklist calculation
  const qualityAudit = useMemo(() => {
    const checks = [
      { id: 'name', label: 'Tên công ty pháp lý', passed: Boolean(draft.company_name?.trim() && draft.company_name.length >= 3) },
      { id: 'overview', label: 'Lời giới thiệu doanh nghiệp (>= 50 ký tự)', passed: Boolean(draft.overview?.trim() && draft.overview.trim().length >= 50) },
      { id: 'services', label: 'Tối thiểu 3 dịch vụ bất động sản', passed: (draft.services?.length || 0) >= 3 },
      { id: 'areas', label: 'Tối thiểu 2 khu vực địa bàn hoạt động', passed: (draft.service_areas?.length || 0) >= 2 },
      { id: 'hours', label: 'Giờ làm việc & tiếp khách rõ ràng', passed: Boolean(draft.working_hours?.trim()) },
      { id: 'process', label: 'Quy trình tư vấn (>= 3 bước)', passed: (draft.consultation_process?.length || 0) >= 3 },
      { id: 'policies', label: 'Chính sách bảo vệ khách hàng (>= 2 mục)', passed: (draft.policies?.length || 0) >= 2 },
      { id: 'faqs', label: 'Bộ câu hỏi thường gặp FAQs (>= 3 câu)', passed: (draft.faqs?.filter((f) => f.question?.trim() && f.answer?.trim()).length || 0) >= 3 },
    ];
    const passedCount = checks.filter((c) => c.passed).length;
    const score = Math.round((passedCount / checks.length) * 100);
    return { checks, passedCount, total: checks.length, score };
  }, [draft]);

  // Maya Simulator response logic
  const handleAskMaya = () => {
    if (!simQuestion.trim()) return;
    const q = simQuestion.toLowerCase();
    let ans = '';

    if (q.includes('dịch vụ') || q.includes('làm gì') || q.includes('kinh doanh')) {
      ans = `Dạ chào quý khách! Maian Homes hiện đang cung cấp các dịch vụ bất động sản cao cấp bao gồm:\n${draft.services.map((s) => `• ${s}`).join('\n')}\n\nChúng tôi sẵn sàng hỗ trợ tư vấn chi tiết từng nhu cầu của quý khách!`;
    } else if (q.includes('khu vực') || q.includes('ở đâu') || q.includes('địa bàn')) {
      ans = `Dạ, Maian Homes hiện diện và phân phối bất động sản trọng điểm tại:\n${draft.service_areas.map((a) => `• ${a}`).join('\n')}.`;
    } else if (q.includes('giờ') || q.includes('mấy giờ') || q.includes('làm việc')) {
      ans = `Dạ, thời gian làm việc của Maian Homes là: ${draft.working_hours || 'Giờ hành chính từ Thứ 2 đến Thứ 7'}. Quý khách có thể để lại số điện thoại để chuyên viên liên hệ ngay!`;
    } else if (q.includes('quy trình') || q.includes('tư vấn') || q.includes('các bước')) {
      ans = `Quy trình tư vấn chuyên nghiệp tại Maian Homes bao gồm các bước:\n${draft.consultation_process.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
    } else {
      const matchFaq = draft.faqs.find((f) => f.question.toLowerCase().includes(q) || q.includes(f.question.toLowerCase().slice(0, 10)));
      if (matchFaq) {
        ans = `Dạ, câu trả lời từ chuyên gia Maian Homes: "${matchFaq.answer}"`;
      } else {
        ans = `Dựa trên tri thức doanh nghiệp hiện tại:\n${draft.overview}\n\n(Nếu quý khách cần thêm thông tin, chuyên viên tư vấn Maian Homes sẽ liên hệ ngay!)`;
      }
    }
    setSimAnswer(ans);
  };

  const filteredFaqs = useMemo(() => {
    if (!faqSearch.trim()) return draft.faqs;
    const term = faqSearch.toLowerCase();
    return draft.faqs.filter(
      (f) => f.question.toLowerCase().includes(term) || f.answer.toLowerCase().includes(term),
    );
  }, [draft.faqs, faqSearch]);

  const canPublishAction = Boolean(canPublish && document && (document.publication_status !== 'PUBLISHED' || draftChanged) && (document.draft || draft));
  const canUnpublish = Boolean(canPublish && document?.publication_status === 'PUBLISHED');

  if (busy && !document) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-sm text-[#6B5E55]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C5A059]" />
        <span className="font-semibold">Đang tải kho tri thức doanh nghiệp & dữ liệu AI...</span>
      </div>
    );
  }

  if (!document && !busy) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
        <div className="flex items-center gap-2.5 font-bold">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <span>{loadError || 'Không thể tải dữ liệu tri thức doanh nghiệp.'}</span>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-xl bg-rose-700 px-4 py-2 font-semibold text-white shadow-xs hover:bg-rose-800 transition"
        >
          Retry
        </button>
      </section>
    );
  }

  const workflowCfg = WORKFLOW_STATUS_CONFIG[document?.workflow_status || 'DRAFT'] || WORKFLOW_STATUS_CONFIG.DRAFT;
  const pubCfg = PUBLICATION_STATUS_CONFIG[document?.publication_status || 'NEVER_PUBLISHED'] || PUBLICATION_STATUS_CONFIG.NEVER_PUBLISHED;

  return (
    <div className="admin-module-page admin-module-page--company space-y-4 text-[#0A192F] pb-10">
      {/* ── 1. EXECUTIVE COMMAND HEADER ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8E0D8] bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2D1B14] to-[#4A3228] text-[#D4AF37] shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-[#2D1B14] tracking-tight">
                Kho Tri thức Doanh nghiệp & Dữ liệu AI
              </h1>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600">
                v{document?.version || 1}
              </span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold border ${workflowCfg.bg} ${workflowCfg.text} ${workflowCfg.border}`}>
                {workflowCfg.label}
              </span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium ${pubCfg.bg} ${pubCfg.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${pubCfg.dot}`} />
                {pubCfg.label}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#6B5E55]">
              Nguồn dữ liệu thẩm định chính thức phục vụ Trợ lý Mái Đỏ AI, FAQ Google Schema và thông tin giới thiệu công khai.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#E8E0D8] bg-[#FAF8F5] px-3 py-1 text-xs">
            <span className={`h-2 w-2 rounded-full ${busy ? 'animate-ping bg-amber-500' : draftChanged ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span className="font-medium text-[#6B5E55]">
              {busy ? 'Đang xử lý...' : draftChanged ? 'Có thay đổi chưa lưu' : 'Dữ liệu đã lưu'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAiSimulator(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 transition active:scale-95 shadow-2xs"
            title="Thử nghiệm câu trả lời của trợ lý Mái Đỏ AI"
          >
            <Bot className="h-3.5 w-3.5 text-purple-600" />
            <span className="hidden md:inline">Thử Mái Đỏ AI</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSchemaPreview(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95 shadow-2xs"
            title="Xem trước mã Schema Organization & FAQPage cho Google"
          >
            <FileCode className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden md:inline">Schema Google</span>
          </button>

          {canUpdate && (
            <button
              type="button"
              disabled={busy || !document}
              onClick={save}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2D1B14] px-3.5 py-1.5 text-xs font-bold text-[#D4AF37] shadow-xs hover:bg-[#3D2820] transition active:scale-95 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Lưu nháp</span>
            </button>
          )}

          {canPublishAction && (
            <button
              type="button"
              disabled={busy}
              onClick={() => transition('publish')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:brightness-110 transition active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Xuất bản</span>
            </button>
          )}

          {canUnpublish && (
            <button
              type="button"
              disabled={busy}
              onClick={() => transition('unpublish')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 shadow-2xs hover:bg-rose-50 transition active:scale-95 disabled:opacity-50"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>Gỡ xuất bản</span>
            </button>
          )}
        </div>
      </div>

      {/* Read-only notification banner */}
      {!canUpdate && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-blue-200 bg-blue-50 p-3.5 text-xs font-semibold text-blue-900">
          <ShieldAlert className="h-4 w-4 shrink-0 text-blue-600" />
          <span>Chế độ chỉ xem — tài khoản chưa được cấp quyền cập nhật nội dung tri thức.</span>
        </div>
      )}

      {/* ── 2. AI READINESS KPI CLUSTER (4 PILLARS) ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: AI Readiness Score */}
        <div className="rounded-2xl border border-[#E8E0D8] bg-white p-3.5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Độ hoàn thiện Tri thức AI
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Bot className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <strong className="text-2xl font-extrabold text-[#0A192F]">{qualityAudit.score}%</strong>
            <span className="text-xs text-slate-500 font-medium">
              ({qualityAudit.passedCount}/{qualityAudit.total} tiêu chí)
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full transition-all duration-500 ${
                qualityAudit.score >= 80 ? 'bg-emerald-500' : qualityAudit.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${qualityAudit.score}%` }}
            />
          </div>
        </div>

        {/* Card 2: FAQ Count */}
        <button
          type="button"
          onClick={() => setActiveTab('faqs')}
          className="text-left rounded-2xl border border-[#E8E0D8] bg-white p-3.5 shadow-2xs hover:border-[#C5A059] transition flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Ngân hàng FAQs Google & AI
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <MessageSquare className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <strong className="text-2xl font-extrabold text-[#0A192F]">{draft.faqs?.length || 0}</strong>
            <span className="text-xs text-slate-500 font-medium">câu hỏi nạp AI</span>
          </div>
          <p className="mt-2 text-[11px] text-blue-600 font-medium">
            → Xem & thêm câu hỏi FAQ
          </p>
        </button>

        {/* Card 3: Services & Areas */}
        <button
          type="button"
          onClick={() => setActiveTab('services')}
          className="text-left rounded-2xl border border-[#E8E0D8] bg-white p-3.5 shadow-2xs hover:border-[#C5A059] transition flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Dịch vụ & Khu vực
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <MapPin className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <strong className="text-2xl font-extrabold text-[#0A192F]">{draft.services?.length || 0}</strong>
            <span className="text-xs text-slate-500 font-medium">dịch vụ • {draft.service_areas?.length || 0} khu vực</span>
          </div>
          <p className="mt-2 text-[11px] text-emerald-600 font-medium">
            → Biên tập danh mục dịch vụ
          </p>
        </button>

        {/* Card 4: Process & Policies */}
        <button
          type="button"
          onClick={() => setActiveTab('process')}
          className="text-left rounded-2xl border border-[#E8E0D8] bg-white p-3.5 shadow-2xs hover:border-[#C5A059] transition flex flex-col justify-between cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Quy trình & Chính sách
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <ListOrdered className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <strong className="text-2xl font-extrabold text-[#0A192F]">{draft.consultation_process?.length || 0}</strong>
            <span className="text-xs text-slate-500 font-medium">bước tư vấn • {draft.policies?.length || 0} chính sách</span>
          </div>
          <p className="mt-2 text-[11px] text-purple-600 font-medium">
            → Chỉnh sửa quy trình
          </p>
        </button>
      </div>

      {/* ── 3. MAIN 2-COLUMN WORKSPACE ── */}
      <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        {/* ── LEFT COLUMN: STRUCTURED KNOWLEDGE STUDIO ── */}
        <div className="space-y-4">
          {/* Sub-tab Navigation */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#E8E0D8] bg-white p-1.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                activeTab === 'profile'
                  ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
                  : 'text-stone-600 hover:bg-[#FAF8F5] hover:text-[#2D1B14]'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>1. Định danh & Giới thiệu</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('services')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                activeTab === 'services'
                  ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
                  : 'text-stone-600 hover:bg-[#FAF8F5] hover:text-[#2D1B14]'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>2. Dịch vụ & Địa bàn</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">
                {draft.services?.length || 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('process')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                activeTab === 'process'
                  ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
                  : 'text-stone-600 hover:bg-[#FAF8F5] hover:text-[#2D1B14]'
              }`}
            >
              <ListOrdered className="h-3.5 w-3.5" />
              <span>3. Quy trình & Chính sách</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('faqs')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                activeTab === 'faqs'
                  ? 'bg-[#2D1B14] text-[#D4AF37] shadow-xs'
                  : 'text-stone-600 hover:bg-[#FAF8F5] hover:text-[#2D1B14]'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>4. Ngân hàng FAQs ({draft.faqs?.length || 0})</span>
            </button>
          </div>

          {/* Form Content Panel */}
          <fieldset
            disabled={!canUpdate}
            className="rounded-3xl border border-[#E8E0D8] bg-white p-4 sm:p-6 shadow-xs space-y-5 disabled:opacity-75"
          >
            {/* TAB 1: PROFILE & OVERVIEW */}
            {activeTab === 'profile' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-[#2D1B14]">
                    Thông tin Định danh & Lời giới thiệu Doanh nghiệp
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Cung cấp thông tin chuẩn xác để AI và khách hàng hiểu rõ thương hiệu Maian Homes.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-xs font-bold text-[#2D1B14] block">
                    <span>Tên công ty</span>
                    <input
                      aria-label="Tên công ty"
                      value={draft.company_name}
                      onChange={(e) => setDraft((c) => ({ ...c, company_name: e.target.value }))}
                      placeholder="CÔNG TY TNHH MAIAN HOMES"
                      className="w-full rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] p-2.5 text-xs text-stone-800 outline-none transition focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059] font-normal"
                    />
                  </label>

                  <label className="space-y-1.5 text-xs font-bold text-[#2D1B14] block">
                    <span>Ngày hiệu lực</span>
                    <input
                      type="date"
                      aria-label="Ngày hiệu lực"
                      value={draft.effective_date}
                      onChange={(e) => setDraft((c) => ({ ...c, effective_date: e.target.value }))}
                      className="w-full rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] p-2.5 text-xs text-stone-800 outline-none transition focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059] font-normal"
                    />
                  </label>
                </div>

                <label className="space-y-1.5 text-xs font-bold text-[#2D1B14] block">
                  <span>Giờ làm việc</span>
                  <input
                    aria-label="Giờ làm việc"
                    value={draft.working_hours}
                    onChange={(e) => setDraft((c) => ({ ...c, working_hours: e.target.value }))}
                    placeholder="Thứ 2 - Thứ 7: 08:30 - 18:00 (Hỗ trợ Hotline 24/7)"
                    className="w-full rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] p-2.5 text-xs text-stone-800 outline-none transition focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059] font-normal"
                  />
                </label>

                <label className="space-y-1.5 text-xs font-bold text-[#2D1B14] block">
                  <div className="flex items-center justify-between">
                    <span>Giới thiệu</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {draft.overview?.length || 0} ký tự (tối thiểu 50)
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    aria-label="Giới thiệu"
                    value={draft.overview}
                    onChange={(e) => setDraft((c) => ({ ...c, overview: e.target.value }))}
                    placeholder="Giới thiệu về vị thế thương hiệu, tầm nhìn, sứ mệnh và cam kết chất lượng của Maian Homes trong lĩnh vực bất động sản cao cấp..."
                    className="w-full rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] p-3 text-xs leading-relaxed text-stone-800 outline-none transition focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059] font-normal"
                  />
                </label>
              </div>
            )}

            {/* TAB 2: SERVICES & AREAS */}
            {activeTab === 'services' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-[#2D1B14]">
                    Hệ sinh thái Dịch vụ & Địa bàn Phân phối
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Mỗi dòng là một mục độc lập. Mái Đỏ AI sẽ trích xuất danh sách này khi tư vấn cho khách.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2 text-xs font-bold text-[#2D1B14] block">
                    <div className="flex items-center justify-between">
                      <span>Dịch vụ</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                        {draft.services?.length || 0} dịch vụ
                      </span>
                    </div>
                    <textarea
                      rows={7}
                      aria-label="Dịch vụ"
                      value={toLines(draft.services)}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, services: fromLines(e.target.value) }))
                      }
                      placeholder="Mỗi dòng là một mục&#10;Tư vấn dự án căn hộ & biệt thự cao cấp&#10;Ký gửi mua bán bất động sản chính chủ&#10;Không gian làm việc & Văn phòng trọn gói"
                      className="w-full rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] p-3 text-xs leading-relaxed text-stone-800 outline-none transition focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059] font-normal"
                    />
                  </label>

                  <label className="space-y-2 text-xs font-bold text-[#2D1B14] block">
                    <div className="flex items-center justify-between">
                      <span>Khu vực hoạt động</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                        {draft.service_areas?.length || 0} khu vực
                      </span>
                    </div>
                    <textarea
                      rows={7}
                      aria-label="Khu vực hoạt động"
                      value={toLines(draft.service_areas)}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, service_areas: fromLines(e.target.value) }))
                      }
                      placeholder="Mỗi dòng là một mục&#10;Hà Nội (Tây Hồ, Cầu Giấy, Nam Từ Liêm)&#10;TP. Hồ Chí Minh (Quận 1, Thủ Đức, Bình Thạnh)&#10;Đà Nẵng & Quảng Nam"
                      className="w-full rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] p-3 text-xs leading-relaxed text-stone-800 outline-none transition focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059] font-normal"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 3: PROCESS & POLICIES */}
            {activeTab === 'process' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="border-b border-slate-100 pb-3">
                  <h2 className="text-sm font-bold text-[#2D1B14]">
                    Quy trình Tư vấn Khách hàng & Chính sách Pháp lý
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Cấu trúc các bước chăm sóc khách hàng và điều khoản quyền lợi rõ ràng.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-2 text-xs font-bold text-[#2D1B14] block">
                    <div className="flex items-center justify-between">
                      <span>Quy trình tư vấn</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                        {draft.consultation_process?.length || 0} bước
                      </span>
                    </div>
                    <textarea
                      rows={7}
                      aria-label="Quy trình tư vấn"
                      value={toLines(draft.consultation_process)}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, consultation_process: fromLines(e.target.value) }))
                      }
                      placeholder="Mỗi dòng là một mục&#10;Tiếp nhận nhu cầu và khảo sát tài chính cá nhân&#10;Lựa chọn danh mục dự án phù hợp tiêu chí&#10;Hỗ trợ tham quan thực tế và thẩm định pháp lý&#10;Đồng hành thủ tục ký kết hợp đồng minh bạch"
                      className="w-full rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] p-3 text-xs leading-relaxed text-stone-800 outline-none transition focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059] font-normal"
                    />
                  </label>

                  <label className="space-y-2 text-xs font-bold text-[#2D1B14] block">
                    <div className="flex items-center justify-between">
                      <span>Chính sách</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                        {draft.policies?.length || 0} chính sách
                      </span>
                    </div>
                    <textarea
                      rows={7}
                      aria-label="Chính sách"
                      value={toLines(draft.policies)}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, policies: fromLines(e.target.value) }))
                      }
                      placeholder="Mỗi dòng là một mục&#10;100% bảo mật thông tin định danh và tài chính khách hàng&#10;Cam kết thông tin dự án trung thực, giá niêm yết trực tiếp từ chủ đầu tư&#10;Hỗ trợ pháp lý trọn đời cho toàn bộ giao dịch qua Maian Homes"
                      className="w-full rounded-xl border border-[#E8E0D8] bg-[#FAF8F5] p-3 text-xs leading-relaxed text-stone-800 outline-none transition focus:border-[#C5A059] focus:bg-white focus:ring-1 focus:ring-[#C5A059] font-normal"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 4: FAQS HUB */}
            {activeTab === 'faqs' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#2D1B14]">
                      Ngân hàng Câu hỏi Thường gặp (FAQ Hub)
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Được nhúng trực tiếp vào FAQ Schema Google và Grounding Context của Trợ lý Mái Đỏ AI.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative w-44 sm:w-56">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={faqSearch}
                        onChange={(e) => setFaqSearch(e.target.value)}
                        placeholder="Tìm câu hỏi / đáp..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[#C5A059] focus:bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setDraft((c) => ({
                          ...c,
                          faqs: [...c.faqs, { question: '', answer: '' }],
                        }))
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2D1B14] to-[#4A3228] px-3.5 py-1.5 text-xs font-bold text-[#D4AF37] hover:brightness-110 shadow-xs transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Thêm FAQ</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredFaqs.map((faq, index) => {
                    const originalIndex = draft.faqs.indexOf(faq);
                    return (
                      <div
                        key={originalIndex >= 0 ? originalIndex : index}
                        className="rounded-2xl border border-[#E8E0D8] bg-[#FAF8F5]/80 p-3 sm:p-4 space-y-2.5 hover:border-[#C5A059]/60 transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-[#2D1B14]">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#C5A059]/20 text-[10px] text-[#2D1B14] font-mono">
                              {index + 1}
                            </span>
                            <span>Câu hỏi {index + 1}</span>
                          </span>

                          <button
                            type="button"
                            aria-label={`Xóa FAQ ${index + 1}`}
                            onClick={() =>
                              setDraft((c) => ({
                                ...c,
                                faqs: c.faqs.filter((_, idx) => idx !== originalIndex),
                              }))
                            }
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                            title="Xóa câu hỏi này"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="text-[11px]">Xóa</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          <input
                            aria-label={`Câu hỏi ${index + 1}`}
                            value={faq.question}
                            onChange={(e) =>
                              setDraft((c) => ({
                                ...c,
                                faqs: c.faqs.map((item, idx) =>
                                  idx === originalIndex ? { ...item, question: e.target.value } : item,
                                ),
                              }))
                            }
                            placeholder="Ví dụ: Maian Homes cung cấp những dịch vụ bất động sản nào?"
                            className="w-full rounded-xl border border-[#E8E0D8] bg-white p-2.5 text-xs font-semibold text-stone-900 outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                          />

                          <textarea
                            rows={3}
                            aria-label={`Câu trả lời ${index + 1}`}
                            value={faq.answer}
                            onChange={(e) =>
                              setDraft((c) => ({
                                ...c,
                                faqs: c.faqs.map((item, idx) =>
                                  idx === originalIndex ? { ...item, answer: e.target.value } : item,
                                ),
                              }))
                            }
                            placeholder="Nhập câu trả lời đầy đủ, chi tiết, văn phong chuyên nghiệp và có căn cứ..."
                            className="w-full rounded-xl border border-[#E8E0D8] bg-white p-2.5 text-xs leading-relaxed text-stone-800 outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]"
                          />
                        </div>
                      </div>
                    );
                  })}

                  {filteredFaqs.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                      {draft.faqs.length === 0
                        ? 'Chưa có câu hỏi FAQ nào. Bấm nút "+ Thêm FAQ" để bổ sung câu hỏi đầu tiên!'
                        : 'Không tìm thấy câu hỏi nào phù hợp với từ khóa tìm kiếm.'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </fieldset>
        </div>

        {/* ── RIGHT COLUMN: AI AUDIT & MAYA SIMULATOR ── */}
        <div className="space-y-4">
          {/* Card A: Quality Gate: Tiêu chuẩn Nạp AI */}
          <div className="rounded-3xl border border-[#E8E0D8] bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-[#C5A059]" />
                <h3 className="text-sm font-bold text-[#2D1B14]">Tiêu chuẩn Dữ liệu AI</h3>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  qualityAudit.score >= 80
                    ? 'bg-emerald-50 text-emerald-700'
                    : qualityAudit.score >= 50
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {qualityAudit.score}% Đạt chuẩn
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {qualityAudit.checks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between text-xs py-1 text-slate-700"
                >
                  <div className="flex items-center gap-2">
                    {check.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <span className={check.passed ? 'font-medium text-slate-900' : 'text-slate-500'}>
                      {check.label}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] font-bold ${
                      check.passed ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {check.passed ? 'Đạt' : 'Cần nhập'}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
              Trợ lý ảo Mái Đỏ sẽ tự động học và ưu tiên trích xuất câu trả lời trực tiếp từ dữ liệu sau khi được bấm nút <strong>Xuất bản</strong>.
            </div>
          </div>

          {/* Card B: Live vs Draft Comparator Summary */}
          <div className="rounded-3xl border border-[#E8E0D8] bg-white p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-[#2D1B14]">Trạng thái So sánh Bản nháp</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  draftChanged ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {draftChanged ? 'Có chỉnh sửa' : 'Khớp bản lưu'}
              </span>
            </div>

            <div className="mt-3 space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Phiên bản cơ sở:</span>
                <strong className="font-mono text-[#0A192F]">v{document.version}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Dữ liệu Live hiện hành:</span>
                <strong className="text-emerald-700">
                  {document.published ? `Đã có bản Live` : 'Chưa có bản Live'}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Quy trình duyệt:</span>
                <strong className="text-blue-700">{workflowCfg.label}</strong>
              </div>
            </div>

            {document.published && (
              <button
                type="button"
                onClick={() => setShowPublishedCompare(true)}
                className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                So sánh chi tiết Bản nháp & Bản Live
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL 1: MAYA AI CHAT SIMULATOR ── */}
      {showAiSimulator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-[#E8E0D8] bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Mô phỏng Trợ lý ảo Mái Đỏ AI</h3>
                  <p className="text-[11px] text-slate-500">Thử nghiệm phản hồi dựa trên tri thức hiện tại</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiSimulator(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700">Câu hỏi mẫu thử nghiệm nhanh:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Maian Homes cung cấp dịch vụ gì?',
                  'Địa bàn hoạt động ở đâu?',
                  'Thời gian làm việc thế nào?',
                  'Quy trình tư vấn khách hàng?',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setSimQuestion(sample);
                    }}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={simQuestion}
                onChange={(e) => setSimQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskMaya()}
                placeholder="Nhập câu hỏi của khách hàng..."
                className="flex-1 rounded-xl border border-slate-200 p-2.5 text-xs outline-none focus:border-purple-600"
              />
              <button
                type="button"
                onClick={handleAskMaya}
                className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white hover:bg-purple-800 transition"
              >
                Hỏi Mái Đỏ
              </button>
            </div>

            {simAnswer && (
              <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-3.5 space-y-1.5 animate-in fade-in">
                <span className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                  <Bot className="h-3.5 w-3.5" /> Mái Đỏ Grounded AI trả lời:
                </span>
                <p className="text-xs text-purple-950 whitespace-pre-line leading-relaxed">
                  {simAnswer}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL 2: SCHEMA GOOGLE PREVIEW ── */}
      {showSchemaPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl border border-[#E8E0D8] bg-white p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Mã Schema Google (JSON-LD)</h3>
                  <p className="text-[11px] text-slate-500">Cấu trúc Organization & FAQPage xuất bản cho Search Engine</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSchemaPreview(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-200 p-4 rounded-2xl font-mono text-[11px] leading-relaxed">
              <pre>{JSON.stringify({
                '@context': 'https://schema.org',
                '@graph': [
                  {
                    '@type': 'RealEstateAgent',
                    name: draft.company_name || 'Maian Homes',
                    description: draft.overview,
                    openingHours: draft.working_hours,
                    areaServed: draft.service_areas,
                  },
                  {
                    '@type': 'FAQPage',
                    mainEntity: draft.faqs.map((f) => ({
                      '@type': 'Question',
                      name: f.question,
                      acceptedAnswer: {
                        '@type': 'Answer',
                        text: f.answer,
                      },
                    })),
                  },
                ],
              }, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: PUBLISHED COMPARATOR ── */}
      {showPublishedCompare && document.published && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-3xl rounded-3xl border border-[#E8E0D8] bg-white p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">So sánh Bản nháp vs Bản Live</h3>
                <p className="text-[11px] text-slate-500">Đối chiếu dữ liệu đang hiển thị công khai và bản chỉnh sửa</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPublishedCompare(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                  <span className="font-bold text-slate-700 block">BẢN LIVE ĐANG HIỂN THỊ</span>
                  <p><strong>Tên:</strong> {document.published.company_name}</p>
                  <p><strong>Giờ làm:</strong> {document.published.working_hours}</p>
                  <p><strong>Dịch vụ:</strong> {document.published.services?.length || 0} mục</p>
                  <p><strong>FAQs:</strong> {document.published.faqs?.length || 0} câu hỏi</p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 space-y-2">
                  <span className="font-bold text-amber-800 block">BẢN NHÁP HIỆN TẠI (v{document.version})</span>
                  <p><strong>Tên:</strong> {draft.company_name}</p>
                  <p><strong>Giờ làm:</strong> {draft.working_hours}</p>
                  <p><strong>Dịch vụ:</strong> {draft.services?.length || 0} mục</p>
                  <p><strong>FAQs:</strong> {draft.faqs?.length || 0} câu hỏi</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
